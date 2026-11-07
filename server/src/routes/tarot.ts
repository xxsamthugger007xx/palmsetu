import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { AiProvider } from '../ai/types';
import { TAROT_SYSTEM_PROMPT } from '../ai/tarotSystemPrompt';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { tarotCatalogue, getCardOrThrow } from '../tarot/catalogue';
import { listAvailableSpreads, getSpread } from '../tarot/spreads';
import { drawSpread } from '../tarot/drawService';
import { buildStaticInterpretation, generateDetailedReport } from '../tarot/interpretationService';
import { personalizeDailyInterpretation } from '../tarot/dailyPersonalization';
import { isSpreadAllowed, checkDailyReadingLimit, checkFollowupLimit } from '../tarot/entitlements';
import {
  tarotReadingsById,
  tarotJournalById,
  dailyTarotByUserDate,
  tarotFollowupCounts,
  getUserTier,
  recordTransaction,
  birthProfiles,
} from '../data/store';
import { ReadingCategory, SpreadType, TarotReading } from '../types/tarot';
import { recordCompletedReading, invalidateMemoryForSource } from '../memory/memoryService';
import { getCardOrThrow as getCard } from '../tarot/catalogue';

/** Compact, factual summary of a reading for the memory layer - card names,
 * positions, orientations and the question only, never the full
 * interpretation/report text (keeps memory cheap and premium-safe, see
 * memoryService.ts). */
function summarizeTarotReading(reading: TarotReading): string {
  const cards = reading.draws
    .map((d) => `${d.positionName}: ${getCard(d.cardId).name} (${d.orientation})`)
    .join(', ');
  const q = reading.question ? ` Question: ${reading.question}.` : '';
  return `${reading.readingType} ${reading.spreadType} reading on ${reading.createdAt.slice(0, 10)}. Cards: ${cards}.${q}`;
}

/** TEMPORARY testing shim, same as every other route in this app: no real auth
 * exists yet. This previously used a hardcoded DEMO_USER constant that ignored
 * this header entirely, which silently broke multi-user testing/entitlement
 * checks for tarot specifically while every other feature already read it. */
function currentUserId(req: any): string {
  return (req.headers['x-demo-user'] as string) || 'demo-user';
}

const DATASET_VERSION = 'solune-tarot-1.0';
const MAX_QUESTION_LENGTH = 500;

const categorySchema = z.enum(['general', 'love', 'career', 'question']);
const spreadSchema = z.enum([
  'one-card', 'three-card-ppf', 'three-card-scg', 'three-card-mbs', 'celtic-cross',
  'love-relationship', 'career-finance', 'yes-no', 'relationship-compatibility',
]);

const startReadingSchema = z.object({
  readingType: categorySchema,
  spreadType: spreadSchema,
  question: z.string().trim().max(MAX_QUESTION_LENGTH).optional(),
});

const journalSchema = z.object({ content: z.string().trim().min(1).max(5000) });
const askSchema = z.object({ question: z.string().trim().min(1).max(1000) });
const dailySchema = z.object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

function ownedReadingOr404(res: any, userId: string, readingId: string): TarotReading | undefined {
  const reading = tarotReadingsById.get(readingId);
  if (!reading || reading.userId !== userId) {
    res.status(404).json({ error: 'Reading not found' });
    return undefined;
  }
  return reading;
}

export function buildTarotRouter(aiProvider: AiProvider) {
  const router = Router();

  // --- Catalogue -----------------------------------------------------------
  router.get('/catalogue', (_req, res) => {
    res.json({ cards: tarotCatalogue, datasetVersion: DATASET_VERSION });
  });

  router.get('/spreads', (_req, res) => {
    res.json({ spreads: listAvailableSpreads() });
  });

  router.get('/limits', (req, res) => {
    const userId = currentUserId(req);
    res.json({
      tier: getUserTier(userId),
      dailyReading: checkDailyReadingLimit(userId),
    });
  });

  // --- Daily card ------------------------------------------------------------
  router.get('/daily', (req, res) => {
    const parsed = dailySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Query param localDate=YYYY-MM-DD is required' });

    const userId = currentUserId(req);
    const key = `${userId}:${parsed.data.localDate}`;
    const existing = dailyTarotByUserDate.get(key);

    if (existing) {
      const reading = tarotReadingsById.get(existing.readingId);
      return res.json({ daily: existing, reading });
    }

    // First reveal of the day for this user: draw once and persist it. The
    // draw itself is never influenced by the user's birth profile - only the
    // interpretation text is personalized afterward, see dailyPersonalization.ts.
    const draws = drawSpread('one-card');
    const card = getCardOrThrow(draws[0].cardId);
    const profile = birthProfiles.get(userId) ?? null;
    const interpretation = personalizeDailyInterpretation(
      buildStaticInterpretation(draws, 'general', 'one-card'),
      card,
      draws[0].orientation,
      profile,
    );
    const readingId = uuid();
    const reading: TarotReading = {
      id: readingId,
      userId,
      readingType: 'general',
      spreadType: 'one-card',
      question: null,
      status: 'interpreted',
      draws,
      interpretation,
      detailedReport: null,
      detailedReportStatus: 'none',
      saved: false,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      datasetVersion: DATASET_VERSION,
    };
    tarotReadingsById.set(readingId, reading);
    recordCompletedReading(userId, 'tarot', readingId, getUserTier(userId), summarizeTarotReading(reading));

    const daily = {
      id: uuid(),
      userId,
      localDate: parsed.data.localDate,
      readingId,
      cardId: draws[0].cardId,
      orientation: draws[0].orientation,
    };
    dailyTarotByUserDate.set(key, daily);

    res.json({ daily, reading });
  });

  // --- Start a reading (draws cards server-side; client never chooses them) --
  router.post('/readings', (req, res) => {
    const parsed = startReadingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const userId = currentUserId(req);
    const { readingType, spreadType, question } = parsed.data;

    if (readingType === 'question' && (!question || question.trim().length < 3)) {
      return res.status(400).json({ error: 'A personal question reading requires a question of at least 3 characters.' });
    }
    if (question && containsCrisisLanguage(question)) {
      return res.json({ crisisFlag: true, message: CRISIS_RESPONSE });
    }

    const spreadCheck = isSpreadAllowed(userId, spreadType as SpreadType);
    if (!spreadCheck.allowed) return res.status(403).json({ error: spreadCheck.reason });

    const limitCheck = checkDailyReadingLimit(userId);
    if (!limitCheck.allowed) return res.status(403).json({ error: limitCheck.reason });

    const draws = drawSpread(spreadType as SpreadType);
    const readingId = uuid();
    const reading: TarotReading = {
      id: readingId,
      userId,
      readingType: readingType as ReadingCategory,
      spreadType: spreadType as SpreadType,
      question: question ?? null,
      status: 'drawn',
      draws,
      interpretation: null,
      detailedReport: null,
      detailedReportStatus: 'none',
      saved: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      datasetVersion: DATASET_VERSION,
    };
    tarotReadingsById.set(readingId, reading);

    res.json(reading);
  });

  // --- Free basic interpretation for an already-drawn reading ------------------
  // Always deterministic/static - this must never require an AI call, so every
  // user gets genuine value immediately after revealing their cards, at no cost.
  router.post('/readings/:id/interpret', (req, res) => {
    const userId = currentUserId(req);
    const reading = ownedReadingOr404(res, userId, req.params.id);
    if (!reading) return;

    if (reading.interpretation) {
      return res.json(reading); // idempotent - don't re-roll or duplicate work
    }

    reading.interpretation = buildStaticInterpretation(reading.draws, reading.readingType, reading.spreadType);
    reading.status = 'interpreted';
    reading.completedAt = new Date().toISOString();
    tarotReadingsById.set(reading.id, reading);

    // Genuine completion point for a tarot reading: it now has a real
    // interpretation, not just a draw. Never recorded on draw/start, and
    // never recorded for a reading that failed to interpret.
    recordCompletedReading(userId, 'tarot', reading.id, getUserTier(userId), summarizeTarotReading(reading));

    res.json(reading);
  });

  // --- Premium: cohesive AI-synthesized detailed report -----------------------
  router.post('/readings/:id/detailed-report', async (req, res) => {
    const userId = currentUserId(req);
    const reading = ownedReadingOr404(res, userId, req.params.id);
    if (!reading) return;

    if (reading.detailedReportStatus === 'ready' && reading.detailedReport) {
      return res.json(reading); // idempotent - reopening never re-generates (or re-bills) it
    }

    const tier = getUserTier(userId);
    if (tier !== 'premium') {
      return res.status(403).json({ error: 'Detailed AI readings require Solune Premium.', code: 'PREMIUM_REQUIRED' });
    }

    const report = await generateDetailedReport(reading.draws, reading.readingType, reading.question, aiProvider, reading.spreadType);
    if (!report) {
      reading.detailedReportStatus = 'failed';
      return res.status(502).json({
        error: 'The detailed reading could not be generated right now. Please try again - you have not been charged for this attempt.',
        code: 'GENERATION_FAILED',
      });
    }

    reading.detailedReport = report;
    reading.detailedReportStatus = 'ready';
    recordTransaction(userId, 'tarot_detailed_report');
    res.json(reading);
  });

  // --- Follow-up question (does not mutate the original draw) ----------------
  router.post('/readings/:id/ask', async (req, res) => {
    const userId = currentUserId(req);
    const reading = ownedReadingOr404(res, userId, req.params.id);
    if (!reading) return;

    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    if (containsCrisisLanguage(parsed.data.question)) {
      return res.json({ answer: CRISIS_RESPONSE, crisisFlag: true });
    }

    const askedSoFar = tarotFollowupCounts.get(reading.id) ?? 0;
    const followupCheck = checkFollowupLimit(userId, reading.id, askedSoFar);
    if (!followupCheck.allowed) return res.status(403).json({ error: followupCheck.reason });

    const cardContext = reading.draws
      .map((d) => {
        const card = getCardOrThrow(d.cardId);
        return `${d.positionName}: ${card.name} (${d.orientation})`;
      })
      .join('\n');
    const interpretationContext = reading.interpretation?.overallInterpretation ?? '';

    let answer: string;
    try {
      answer = await aiProvider.complete([
        { role: 'system', content: TAROT_SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            `Original reading (do not change these cards):\n${cardContext}\n\n` +
            `Prior interpretation summary: ${interpretationContext}\n\n` +
            `Follow-up question: ${parsed.data.question}`,
        },
      ]);
    } catch {
      answer = 'I’m unable to generate a follow-up response right now - please try again in a moment.';
    }

    tarotFollowupCounts.set(reading.id, askedSoFar + 1);
    res.json({ answer });
  });

  // --- History -----------------------------------------------------------------
  router.get('/readings', (req, res) => {
    const userId = currentUserId(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Number(req.query.pageSize) || 20);

    const all = [...tarotReadingsById.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);

    res.json({ items, page, pageSize, total: all.length });
  });

  router.get('/readings/:id', (req, res) => {
    const reading = ownedReadingOr404(res, currentUserId(req), req.params.id);
    if (!reading) return;
    res.json(reading);
  });

  router.patch('/readings/:id', (req, res) => {
    const reading = ownedReadingOr404(res, currentUserId(req), req.params.id);
    if (!reading) return;
    if (typeof req.body.saved === 'boolean') reading.saved = req.body.saved;
    res.json(reading);
  });

  router.delete('/readings/:id', (req, res) => {
    const reading = ownedReadingOr404(res, currentUserId(req), req.params.id);
    if (!reading) return;
    tarotReadingsById.delete(reading.id);
    for (const [jid, entry] of tarotJournalById) {
      if (entry.readingId === reading.id) tarotJournalById.delete(jid);
    }
    res.json({ ok: true });
  });

  // --- Journal -------------------------------------------------------------
  router.post('/readings/:id/journal', (req, res) => {
    const reading = ownedReadingOr404(res, currentUserId(req), req.params.id);
    if (!reading) return;

    const parsed = journalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const now = new Date().toISOString();
    const entry = {
      id: uuid(),
      userId: currentUserId(req),
      readingId: reading.id,
      content: parsed.data.content,
      createdAt: now,
      updatedAt: now,
    };
    tarotJournalById.set(entry.id, entry);
    res.json(entry);
  });

  router.patch('/journal/:id', (req, res) => {
    const entry = tarotJournalById.get(req.params.id);
    if (!entry || entry.userId !== currentUserId(req)) return res.status(404).json({ error: 'Journal entry not found' });

    const parsed = journalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    entry.content = parsed.data.content;
    entry.updatedAt = new Date().toISOString();
    res.json(entry);
  });

  router.delete('/journal/:id', (req, res) => {
    const entry = tarotJournalById.get(req.params.id);
    if (!entry || entry.userId !== currentUserId(req)) return res.status(404).json({ error: 'Journal entry not found' });
    tarotJournalById.delete(entry.id);
    res.json({ ok: true });
  });

  return router;
}
