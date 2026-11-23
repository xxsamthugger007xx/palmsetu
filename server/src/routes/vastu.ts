import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { AiProvider } from '../ai/types';
import { VASTU_SYSTEM_PROMPT } from '../ai/vastuSystemPrompt';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { listDirections } from '../vastu/knowledgeEngine';
import { buildVastuReportContent } from '../vastu/reportService';
import {
  vastuPropertiesById, vastuReportsById, vastuFollowupCounts, getUserTier,
} from '../data/store';
import { PropertyProfile, VastuReport } from '../types/vastu';
import { recordCompletedReading, invalidateMemoryForSource } from '../memory/memoryService';

/** TEMPORARY testing shim, same as the rest of this app's routes: no real auth yet. */
function currentUserId(req: Request): string {
  // Prefers the real resolved auth context (see auth/middleware.ts's
  // attachAuthContext, mounted globally in index.ts) - falls back to the
  // legacy header read directly only for a test harness that builds this
  // router's Express app without that middleware mounted.
  if (req.auth?.userId) return req.auth.userId;
  return (req.headers['x-demo-user'] as string) || 'demo-user';
}

function summarizeVastuReport(r: VastuReport): string {
  const rooms = r.roomAnalyses.map((a) => `${a.roomLabel} facing ${a.direction} (${a.alignment})`).join('; ');
  return `Vastu report on ${r.createdAt.slice(0, 10)} (${r.propertyType}, ${r.completeness}). ${rooms}`;
}

const directionEnum = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'C']);
const roomCategoryEnum = z.enum(['entrance', 'livingRoom', 'kitchen', 'bedroom', 'prayerRoom', 'bathroom', 'custom']);

const roomSchema = z.object({
  roomId: z.string().min(1).max(100),
  category: roomCategoryEnum,
  name: z.string().min(1).max(100),
  direction: directionEnum.nullable(),
});

// Generous but bounded - prevents a pathological payload (thousands of
// "rooms") rather than reflecting any real property size limit.
const MAX_ROOMS = 60;

const propertySchema = z.object({
  propertyType: z.enum(['apartment', 'independent-house', 'office', 'shop', 'other']),
  bedroomCount: z.number().int().min(0).max(20),
  bathroomCount: z.number().int().min(0).max(20),
  rooms: z.array(roomSchema).max(MAX_ROOMS),
  notes: z.string().max(2000).nullable().optional(),
});

/** Every roomId in the array must be unique - a duplicate would mean two
 * rooms silently sharing one analysis slot, which analyzeProperty has no
 * way to detect on its own since it just iterates the array it's given. */
function validateUniqueRoomIds(rooms: { roomId: string }[]): string | null {
  const seen = new Set<string>();
  for (const r of rooms) {
    if (seen.has(r.roomId)) return `Duplicate roomId: ${r.roomId}`;
    seen.add(r.roomId);
  }
  return null;
}

function ownedPropertyOr404(res: Response, userId: string, id: string): PropertyProfile | undefined {
  const p = vastuPropertiesById.get(id);
  if (!p || p.userId !== userId) {
    res.status(404).json({ error: 'Property not found' });
    return undefined;
  }
  return p;
}

function ownedReportOr404(res: Response, userId: string, id: string): VastuReport | undefined {
  const r = vastuReportsById.get(id);
  if (!r || r.userId !== userId) {
    res.status(404).json({ error: 'Report not found' });
    return undefined;
  }
  return r;
}

export function buildVastuRouter(aiProvider: AiProvider) {
  const router = Router();

  // --- Reference data ---------------------------------------------------------
  router.get('/directions', (_req, res) => {
    res.json({ directions: listDirections() });
  });

  // Vastu is fully free - no property-count or follow-up limit, per explicit
  // product decision. canCreateProperty/freeLimit are kept in the response
  // shape (rather than removed) so the app's existing consumers of this
  // endpoint don't need a shape change, but they now always report "no limit".
  router.get('/limits', (req, res) => {
    const userId = currentUserId(req);
    const propertyCount = vastuPropertiesById.valuesForUser(userId).length;
    res.json({
      tier: getUserTier(userId),
      canCreateProperty: true,
      propertiesUsed: propertyCount,
      freeLimit: null,
    });
  });

  // --- Properties ---------------------------------------------------------------
  router.post('/properties', (req, res) => {
    const userId = currentUserId(req);
    const parsed = propertySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const dupError = validateUniqueRoomIds(parsed.data.rooms);
    if (dupError) return res.status(400).json({ error: dupError });

    const now = new Date().toISOString();
    const property: PropertyProfile = {
      id: uuid(),
      userId,
      propertyType: parsed.data.propertyType,
      bedroomCount: parsed.data.bedroomCount,
      bathroomCount: parsed.data.bathroomCount,
      rooms: parsed.data.rooms,
      notes: parsed.data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    vastuPropertiesById.set(property.id, property);
    res.json(property);
  });

  router.get('/properties', (req, res) => {
    const userId = currentUserId(req);
    const items = vastuPropertiesById.valuesForUser(userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ items });
  });

  router.get('/properties/:id', (req, res) => {
    const property = ownedPropertyOr404(res, currentUserId(req), req.params.id);
    if (!property) return;
    res.json(property);
  });

  router.patch('/properties/:id', (req, res) => {
    const property = ownedPropertyOr404(res, currentUserId(req), req.params.id);
    if (!property) return;

    const parsed = propertySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    if (parsed.data.rooms) {
      const dupError = validateUniqueRoomIds(parsed.data.rooms);
      if (dupError) return res.status(400).json({ error: dupError });
    }

    if (parsed.data.propertyType) property.propertyType = parsed.data.propertyType;
    if (parsed.data.bedroomCount !== undefined) property.bedroomCount = parsed.data.bedroomCount;
    if (parsed.data.bathroomCount !== undefined) property.bathroomCount = parsed.data.bathroomCount;
    // The client always resends its full current room list (never a
    // sparse/partial one) - rooms is an array, not a fixed set of named
    // slots, so there is no safe way to "merge" a partial array by
    // position without risking misaligning one room's direction onto a
    // completely different room. A full replace is the only safe option.
    if (parsed.data.rooms) property.rooms = parsed.data.rooms;
    if (parsed.data.notes !== undefined) property.notes = parsed.data.notes ?? null;
    property.updatedAt = new Date().toISOString();

    res.json(property);
  });

  router.delete('/properties/:id', (req, res) => {
    const userId = currentUserId(req);
    const property = ownedPropertyOr404(res, userId, req.params.id);
    if (!property) return;
    vastuPropertiesById.delete(property.id);
    for (const [rid, report] of vastuReportsById) {
      if (report.propertyId === property.id) {
        vastuReportsById.delete(rid);
        vastuFollowupCounts.delete(rid);
        invalidateMemoryForSource(userId, rid);
      }
    }
    res.json({ ok: true });
  });

  // --- Reports -------------------------------------------------------------------
  router.post('/properties/:id/report', async (req, res) => {
    const userId = currentUserId(req);
    const property = ownedPropertyOr404(res, userId, req.params.id);
    if (!property) return;

    const content = await buildVastuReportContent(property, aiProvider);
    const now = new Date().toISOString();
    const report: VastuReport = {
      id: uuid(),
      userId,
      propertyId: property.id,
      createdAt: now,
      updatedAt: now,
      saved: false,
      ...content,
    };
    vastuReportsById.set(report.id, report);
    recordCompletedReading(userId, 'vastu', report.id, getUserTier(userId), summarizeVastuReport(report));
    res.json(report);
  });

  router.get('/reports', (req, res) => {
    const userId = currentUserId(req);
    const items = vastuReportsById.valuesForUser(userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ items });
  });

  router.get('/reports/:id', (req, res) => {
    const report = ownedReportOr404(res, currentUserId(req), req.params.id);
    if (!report) return;
    res.json(report);
  });

  router.patch('/reports/:id', (req, res) => {
    const report = ownedReportOr404(res, currentUserId(req), req.params.id);
    if (!report) return;
    if (typeof req.body.saved === 'boolean') report.saved = req.body.saved;
    report.updatedAt = new Date().toISOString();
    res.json(report);
  });

  router.patch('/reports/:id/checklist/:itemId', (req, res) => {
    const report = ownedReportOr404(res, currentUserId(req), req.params.id);
    if (!report) return;

    const item = report.checklist.find((i) => i.id === req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Checklist item not found' });

    if (typeof req.body.completed === 'boolean') item.completed = req.body.completed;
    report.updatedAt = new Date().toISOString();
    res.json(report);
  });

  router.delete('/reports/:id', (req, res) => {
    const userId = currentUserId(req);
    const report = ownedReportOr404(res, userId, req.params.id);
    if (!report) return;
    vastuReportsById.delete(report.id);
    vastuFollowupCounts.delete(report.id);
    invalidateMemoryForSource(userId, report.id);
    res.json({ ok: true });
  });

  router.post('/reports/:id/ask', async (req, res) => {
    const userId = currentUserId(req);
    const report = ownedReportOr404(res, userId, req.params.id);
    if (!report) return;

    const question = String(req.body.question ?? '').trim();
    if (!question) return res.status(400).json({ error: 'question is required' });
    if (containsCrisisLanguage(question)) return res.json({ answer: CRISIS_RESPONSE, crisisFlag: true });

    const askedSoFar = vastuFollowupCounts.get(report.id) ?? 0;

    let answer: string;
    try {
      const context = report.roomAnalyses
        .map((a) => `${a.roomLabel}: facing ${a.direction} (${a.alignment}). ${a.guidance}`)
        .join('\n');
      answer = await aiProvider.complete([
        { role: 'system', content: VASTU_SYSTEM_PROMPT },
        { role: 'user', content: `${context}\n\nFollow-up question: ${question}` },
      ]);
    } catch {
      answer = 'Unable to generate a follow-up response right now - please try again shortly.';
    }
    vastuFollowupCounts.set(report.id, askedSoFar + 1);
    res.json({ answer });
  });

  return router;
}
