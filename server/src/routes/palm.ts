import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { VisionAssistedPalmAnalyzer } from '../palmAnalysis/visionAssistedAnalyzer';
import { buildFreeReading } from '../palmistry/staticPalmistryEngine';
import { generatePremiumReport } from '../palmistry/premiumPalmistryEngine';
import { generateDailyGuidance } from '../palmistry/dailyGuidanceService';
import { readingsById, dailyPalmGuidanceByKey, palmFollowupCounts, getUserTier, recordTransaction } from '../data/store';
import { AiProvider } from '../ai/types';
import { PALMISTRY_SYSTEM_PROMPT } from '../ai/systemPrompts';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { recordCompletedReading, invalidateMemoryForSource } from '../memory/memoryService';
import { PalmReading } from '../types/palm';
import { isAccepted } from '../palmistry/validation';

const analyzer = new VisionAssistedPalmAnalyzer();

const submitSchema = z.object({ image: z.string().min(1) });
const askSchema = z.object({ question: z.string().min(1).max(1000) });
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const MAX_FREE_PREMIUM_REPORTS = 1;
const MAX_FOLLOWUP_FREE = 2;

/** Same TEMPORARY testing shim as every other route in this app: no real
 * auth exists yet, identity comes from the x-demo-user header. */
function currentUserId(req: any): string {
  return (req.headers['x-demo-user'] as string) || 'demo-user';
}

function summarizePalmReading(r: PalmReading): string {
  const sectionCount = r.freeReading.sections.length;
  return `Palm reading on ${r.createdAt.slice(0, 10)}. Image quality: ${r.analysis.imageQuality.ok ? 'good' : 'issue'}. ` +
    `${sectionCount} feature(s) confidently matched. ${r.freeReading.summary}`;
}

function premiumReportsUsedBy(userId: string): number {
  return [...readingsById.values()].filter((r) => r.userId === userId && r.premiumReportGeneratedAt).length;
}

export function buildPalmRouter(aiProvider: AiProvider) {
  const router = Router();

  // Free reading generation - this handler must NEVER call into any AI
  // provider. Only VisionAssistedPalmAnalyzer (image quality + vision
  // detection, a separate concern from AI narrative generation) and
  // buildFreeReading (100% deterministic, see staticPalmistryEngine.ts's
  // own import-level guarantee) run here.
  router.post('/readings', async (req, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const userId = currentUserId(req);
    const imageBuffer = Buffer.from(parsed.data.image, 'base64');

    const analysis = await analyzer.analyze(imageBuffer);

    // Validation gate: an image that isn't a usable palm photo (no hand,
    // back of hand, wrong body part, multiple hands) or that fails the
    // real pixel-quality checks must be rejected BEFORE any reading record
    // is created - no readingsById entry, no recordCompletedReading call,
    // nothing that looks like a saved, completed analysis.
    if (!isAccepted(analysis.validation.status)) {
      return res.status(422).json({
        error: analysis.validation.reason ?? 'This photo could not be used for a palm reading.',
        code: 'IMAGE_REJECTED',
        validationStatus: analysis.validation.status,
        imageQuality: analysis.imageQuality,
      });
    }

    const freeReading = buildFreeReading(analysis);

    const reading: PalmReading = {
      id: uuid(),
      userId,
      createdAt: new Date().toISOString(),
      analysis,
      freeReading,
      premiumReportAvailable: true,
      premiumReport: null,
      premiumReportGeneratedAt: null,
    };

    readingsById.set(reading.id, reading);
    // Genuine completion point - the full reading (analysis + free reading)
    // was built successfully, not a partial/failed attempt.
    recordCompletedReading(userId, 'palm', reading.id, getUserTier(userId), summarizePalmReading(reading));
    res.json(reading);
  });

  router.get('/readings/:id', (req, res) => {
    const reading = readingsById.get(req.params.id);
    if (!reading || reading.userId !== currentUserId(req)) return res.status(404).json({ error: 'Reading not found' });
    res.json(reading);
  });

  router.get('/readings', (req, res) => {
    const userId = currentUserId(req);
    const items = [...readingsById.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ items });
  });

  router.get('/limits', (req, res) => {
    const userId = currentUserId(req);
    const tier = getUserTier(userId);
    const used = premiumReportsUsedBy(userId);
    res.json({ tier, premiumReportsUsed: used, freeLimit: MAX_FREE_PREMIUM_REPORTS, canGeneratePremiumReport: tier === 'premium' || used < MAX_FREE_PREMIUM_REPORTS });
  });

  // Premium report generation - entitlement is verified HERE. This is
  // entirely deterministic now: generatePremiumReport never calls an
  // AiProvider (see premiumPalmistryEngine.ts's own import-level
  // guarantee). A cached report is returned on reopen without
  // regenerating anything.
  router.post('/readings/:id/premium-report', async (req, res) => {
    const userId = currentUserId(req);
    const reading = readingsById.get(req.params.id);
    if (!reading || reading.userId !== userId) return res.status(404).json({ error: 'Reading not found' });

    if (reading.premiumReport) {
      return res.json(reading); // cached - never regenerate on read
    }

    const tier = getUserTier(userId);
    const used = premiumReportsUsedBy(userId);
    if (tier !== 'premium' && used >= MAX_FREE_PREMIUM_REPORTS) {
      return res.status(403).json({ error: `Free plan allows ${MAX_FREE_PREMIUM_REPORTS} premium palm report. Upgrade for additional reports.`, code: 'LIMIT_REACHED' });
    }

    const premiumReport = generatePremiumReport(reading.analysis);
    reading.premiumReport = premiumReport;
    reading.premiumReportGeneratedAt = new Date().toISOString();

    // This generation only happened because the user is premium and had
    // already used up the free quota, so it represents one real premium
    // unlock - mirrors the exact gemstone.ts recordTransaction call site.
    if (tier === 'premium' && used >= MAX_FREE_PREMIUM_REPORTS) {
      recordTransaction(userId, 'palm_premium_report');
    }
    res.json(reading);
  });

  router.post('/readings/:id/ask', async (req, res) => {
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const userId = currentUserId(req);
    const reading = readingsById.get(req.params.id);
    if (!reading || reading.userId !== userId) return res.status(404).json({ error: 'Reading not found' });

    if (containsCrisisLanguage(parsed.data.question)) return res.json({ answer: CRISIS_RESPONSE, crisisFlag: true });

    const tier = getUserTier(userId);
    const askedSoFar = palmFollowupCounts.get(reading.id) ?? 0;
    if (tier !== 'premium' && askedSoFar >= MAX_FOLLOWUP_FREE) {
      return res.status(403).json({ error: `Free plan allows ${MAX_FOLLOWUP_FREE} follow-up questions per reading.`, code: 'LIMIT_REACHED' });
    }

    const context = reading.freeReading.sections.map((s) => `${s.title}: ${s.text}`).join('\n');

    let answer: string;
    try {
      answer = await aiProvider.complete([
        { role: 'system', content: PALMISTRY_SYSTEM_PROMPT },
        { role: 'user', content: `Here is the user's reading:\n${context}\n\nFollow-up question: ${parsed.data.question}` },
      ]);
    } catch {
      answer = 'Unable to generate a follow-up response right now - please try again shortly.';
    }
    palmFollowupCounts.set(reading.id, askedSoFar + 1);
    res.json({ answer });
  });

  router.delete('/readings/:id', (req, res) => {
    const userId = currentUserId(req);
    const reading = readingsById.get(req.params.id);
    if (!reading || reading.userId !== userId) return res.status(404).json({ error: 'Reading not found' });
    readingsById.delete(reading.id);
    palmFollowupCounts.delete(reading.id);
    invalidateMemoryForSource(userId, reading.id);
    res.json({ ok: true });
  });

  // Daily palm guidance - zero AI calls (see dailyGuidanceService.ts),
  // cached once per user per local calendar day. The client supplies
  // localDate the same way routes/astrology.ts does, since the server has
  // no reliable way to know the user's local timezone on its own.
  router.get('/daily-guidance', (req, res) => {
    const userId = currentUserId(req);
    const dateParsed = localDateSchema.safeParse(req.query.localDate);
    if (!dateParsed.success) return res.status(400).json({ error: 'Query param localDate=YYYY-MM-DD is required' });
    const localDate = dateParsed.data;

    const key = `${userId}:${localDate}`;
    const cached = dailyPalmGuidanceByKey.get(key);
    if (cached) return res.json(cached);

    const latestReading = [...readingsById.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!latestReading) {
      return res.status(400).json({ error: 'No saved palm reading yet - submit a palm photo first.', code: 'NO_READING' });
    }

    const guidance = { ...generateDailyGuidance(userId, localDate, latestReading), createdAt: new Date().toISOString() };
    dailyPalmGuidanceByKey.set(key, guidance);
    res.json(guidance);
  });

  return router;
}
