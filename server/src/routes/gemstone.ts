import { Router, Request } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { AiProvider } from '../ai/types';
import { GEMSTONE_SYSTEM_PROMPT } from '../ai/gemstoneSystemPrompt';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { buildGemstoneReportContent } from '../gemstone/reportService';
import { birthProfiles, gemstoneReportsById, gemstoneFollowupCounts, getUserTier, recordTransaction } from '../data/store';
import { GemstoneReport } from '../types/gemstone';
import { recordCompletedReading, invalidateMemoryForSource } from '../memory/memoryService';

/** TEMPORARY testing shim, same as astrology/tarot routes: no real auth exists yet. */
function currentUserId(req: Request): string {
  // Prefers the real resolved auth context (see auth/middleware.ts's
  // attachAuthContext, mounted globally in index.ts) - falls back to the
  // legacy header read directly only for a test harness that builds this
  // router's Express app without that middleware mounted.
  if (req.auth?.userId) return req.auth.userId;
  return (req.headers['x-demo-user'] as string) || 'demo-user';
}

function summarizeGemstoneReport(r: GemstoneReport): string {
  const main = r.primary.gemstone
    ? `Recommended: ${r.primary.gemstone.nameEnglish} (${r.primary.gemstone.nameHindi}). Rule: ${r.primary.ruleExplanation}.`
    : `No gemstone recommended: ${r.primary.reasonUnavailable ?? 'unknown reason'}.`;
  return `Gemstone report on ${r.createdAt.slice(0, 10)}${r.goal ? ` (goal: ${r.goal})` : ''}. ${main}`;
}

const MAX_FOLLOWUP_FREE = 0; // follow-up AI questions are Premium-only
// Gemstone Guide is a premium-only feature - free-tier users cannot generate
// any report at all. Premium users get PREMIUM_INCLUDED_REPORTS bundled into
// their subscription before an additional report charges a separate
// per-report unlock (see the recordTransaction call below).
const PREMIUM_INCLUDED_REPORTS = 1;

const createReportSchema = z.object({
  goals: z.array(z.enum(['career', 'relationships', 'confidence', 'education', 'finances', 'general'])).max(6).optional(),
  budget: z.string().max(100).nullable().optional(),
});

export function buildGemstoneRouter(aiProvider: AiProvider) {
  const router = Router();

  router.get('/limits', (req, res) => {
    const userId = currentUserId(req);
    const tier = getUserTier(userId);
    const reportCount = gemstoneReportsById.valuesForUser(userId).length;
    res.json({
      tier,
      canCreateReport: tier === 'premium',
      reportsUsed: reportCount,
      freeLimit: 0,
    });
  });

  router.post('/reports', async (req, res) => {
    const userId = currentUserId(req);
    const profile = birthProfiles.get(userId);
    if (!profile) {
      return res.status(400).json({
        error: 'Birth profile not set up yet. Complete birth details in Daily Cosmic Guidance first.',
        code: 'NO_PROFILE',
      });
    }

    const parsed = createReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const tier = getUserTier(userId);
    if (tier !== 'premium') {
      return res.status(403).json({ error: 'Gemstone Guide is a Premium feature. Upgrade to generate your personalized guide.', code: 'LIMIT_REACHED' });
    }
    const existingCount = gemstoneReportsById.valuesForUser(userId).length;

    const goalText = parsed.data.goals && parsed.data.goals.length > 0 ? parsed.data.goals.join(', ') : null;
    const content = await buildGemstoneReportContent(profile, goalText, aiProvider);
    const report: GemstoneReport = {
      id: uuid(),
      userId,
      createdAt: new Date().toISOString(),
      goal: goalText,
      budget: parsed.data.budget ?? null,
      saved: false,
      ...content,
    };
    gemstoneReportsById.set(report.id, report);
    // The first PREMIUM_INCLUDED_REPORTS reports are bundled into the
    // subscription; each one beyond that is a distinct new record (not an
    // idempotent retry), so charging once per creation here is correct.
    if (existingCount >= PREMIUM_INCLUDED_REPORTS) {
      recordTransaction(userId, 'gemstone_premium_report');
    }
    recordCompletedReading(userId, 'gemstone', report.id, tier, summarizeGemstoneReport(report));
    res.json(report);
  });

  router.get('/reports', (req, res) => {
    const userId = currentUserId(req);
    const items = gemstoneReportsById.valuesForUser(userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ items });
  });

  router.get('/reports/:id', (req, res) => {
    const report = gemstoneReportsById.get(req.params.id);
    if (!report || report.userId !== currentUserId(req)) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  });

  router.patch('/reports/:id', (req, res) => {
    const report = gemstoneReportsById.get(req.params.id);
    if (!report || report.userId !== currentUserId(req)) return res.status(404).json({ error: 'Report not found' });
    if (typeof req.body.saved === 'boolean') report.saved = req.body.saved;
    res.json(report);
  });

  router.delete('/reports/:id', (req, res) => {
    const userId = currentUserId(req);
    const report = gemstoneReportsById.get(req.params.id);
    if (!report || report.userId !== userId) return res.status(404).json({ error: 'Report not found' });
    gemstoneReportsById.delete(report.id);
    gemstoneFollowupCounts.delete(report.id);
    invalidateMemoryForSource(userId, report.id);
    res.json({ ok: true });
  });

  router.post('/reports/:id/ask', async (req, res) => {
    const userId = currentUserId(req);
    const report = gemstoneReportsById.get(req.params.id);
    if (!report || report.userId !== userId) return res.status(404).json({ error: 'Report not found' });

    const question = String(req.body.question ?? '').trim();
    if (!question) return res.status(400).json({ error: 'question is required' });
    if (containsCrisisLanguage(question)) return res.json({ answer: CRISIS_RESPONSE, crisisFlag: true });

    const tier = getUserTier(userId);
    const askedSoFar = gemstoneFollowupCounts.get(report.id) ?? 0;
    if (tier !== 'premium' && askedSoFar >= MAX_FOLLOWUP_FREE) {
      return res.status(403).json({ error: 'Follow-up questions are a Premium feature. Upgrade to ask more.' });
    }

    let answer: string;
    try {
      const context = report.primary.gemstone
        ? `Recommended gemstone: ${report.primary.gemstone.nameEnglish} (${report.primary.gemstone.nameHindi}). ${report.primary.ruleExplanation}`
        : report.primary.reasonUnavailable ?? 'No gemstone could be recommended from the available chart data.';
      answer = await aiProvider.complete([
        { role: 'system', content: GEMSTONE_SYSTEM_PROMPT },
        { role: 'user', content: `${context}\n\nFollow-up question: ${question}` },
      ]);
    } catch {
      answer = 'Unable to generate a follow-up response right now - please try again shortly.';
    }
    gemstoneFollowupCounts.set(report.id, askedSoFar + 1);
    res.json({ answer });
  });

  return router;
}
