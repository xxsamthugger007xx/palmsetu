import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { AiProvider } from '../ai/types';
import { VASTU_SYSTEM_PROMPT } from '../ai/vastuSystemPrompt';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { listDirections } from '../vastu/knowledgeEngine';
import { buildVastuReportContent } from '../vastu/reportService';
import {
  vastuPropertiesById, vastuReportsById, vastuFollowupCounts, getUserTier, recordTransaction,
} from '../data/store';
import { PropertyProfile, VastuReport } from '../types/vastu';
import { recordCompletedReading, invalidateMemoryForSource } from '../memory/memoryService';

/** TEMPORARY testing shim, same as the rest of this app's routes: no real auth yet. */
function currentUserId(req: any): string {
  return (req.headers['x-demo-user'] as string) || 'demo-user';
}

function summarizeVastuReport(r: VastuReport): string {
  const rooms = r.roomAnalyses.map((a) => `${a.roomLabel} facing ${a.direction} (${a.alignment})`).join('; ');
  return `Vastu report on ${r.createdAt.slice(0, 10)} (${r.propertyType}, ${r.completeness}). ${rooms}`;
}

const MAX_PROPERTIES_FREE = 1;
const MAX_FOLLOWUP_FREE = 2;

const directionEnum = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

const propertySchema = z.object({
  propertyType: z.enum(['apartment', 'independent-house', 'office', 'shop', 'other']),
  rooms: z.object({
    entrance: directionEnum.nullable().optional(),
    livingRoom: directionEnum.nullable().optional(),
    kitchen: directionEnum.nullable().optional(),
    masterBedroom: directionEnum.nullable().optional(),
    prayerRoom: directionEnum.nullable().optional(),
    bathroom: directionEnum.nullable().optional(),
  }),
  notes: z.string().max(2000).nullable().optional(),
});

function ownedPropertyOr404(res: any, userId: string, id: string): PropertyProfile | undefined {
  const p = vastuPropertiesById.get(id);
  if (!p || p.userId !== userId) {
    res.status(404).json({ error: 'Property not found' });
    return undefined;
  }
  return p;
}

function ownedReportOr404(res: any, userId: string, id: string): VastuReport | undefined {
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

  router.get('/limits', (req, res) => {
    const userId = currentUserId(req);
    const tier = getUserTier(userId);
    const propertyCount = [...vastuPropertiesById.values()].filter((p) => p.userId === userId).length;
    res.json({
      tier,
      canCreateProperty: tier === 'premium' || propertyCount < MAX_PROPERTIES_FREE,
      propertiesUsed: propertyCount,
      freeLimit: MAX_PROPERTIES_FREE,
    });
  });

  // --- Properties ---------------------------------------------------------------
  router.post('/properties', (req, res) => {
    const userId = currentUserId(req);
    const parsed = propertySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const tier = getUserTier(userId);
    const existingCount = [...vastuPropertiesById.values()].filter((p) => p.userId === userId).length;
    if (tier !== 'premium' && existingCount >= MAX_PROPERTIES_FREE) {
      return res.status(403).json({ error: 'Free plan allows 1 saved property. Upgrade for additional properties.', code: 'LIMIT_REACHED' });
    }

    const now = new Date().toISOString();
    const property: PropertyProfile = {
      id: uuid(),
      userId,
      propertyType: parsed.data.propertyType,
      rooms: {
        entrance: parsed.data.rooms.entrance ?? null,
        livingRoom: parsed.data.rooms.livingRoom ?? null,
        kitchen: parsed.data.rooms.kitchen ?? null,
        masterBedroom: parsed.data.rooms.masterBedroom ?? null,
        prayerRoom: parsed.data.rooms.prayerRoom ?? null,
        bathroom: parsed.data.rooms.bathroom ?? null,
      },
      notes: parsed.data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    vastuPropertiesById.set(property.id, property);
    // Same reasoning as gemstone reports: this property only exists because
    // the user is premium and already past the free quota, so it is one
    // real premium unlock. Each property is a new record, never a retry.
    if (tier === 'premium' && existingCount >= MAX_PROPERTIES_FREE) {
      recordTransaction(userId, 'vastu_premium_report');
    }
    res.json(property);
  });

  router.get('/properties', (req, res) => {
    const userId = currentUserId(req);
    const items = [...vastuPropertiesById.values()]
      .filter((p) => p.userId === userId)
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

    if (parsed.data.propertyType) property.propertyType = parsed.data.propertyType;
    if (parsed.data.rooms) Object.assign(property.rooms, parsed.data.rooms);
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
    const items = [...vastuReportsById.values()]
      .filter((r) => r.userId === userId)
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

    const tier = getUserTier(userId);
    const askedSoFar = vastuFollowupCounts.get(report.id) ?? 0;
    if (tier !== 'premium' && askedSoFar >= MAX_FOLLOWUP_FREE) {
      return res.status(403).json({ error: `Free plan allows ${MAX_FOLLOWUP_FREE} follow-up questions per report.` });
    }

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
