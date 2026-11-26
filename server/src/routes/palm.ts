import { signPath, verifySignedPath } from '../auth/signedUrl';
import { redactLockedSections, teaserText } from '../palmistry/teaser';
import { Router, Request } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { VisionAssistedPalmAnalyzer } from '../palmAnalysis/visionAssistedAnalyzer';
import { buildFreeReading } from '../palmistry/staticPalmistryEngine';
import { generatePremiumReport } from '../palmistry/premiumPalmistryEngine';
import { generateDailyGuidance } from '../palmistry/dailyGuidanceService';
import {
  readingsById, dailyPalmGuidanceByKey, palmFollowupCounts, getUserTier, recordTransaction,
  isPalmSectionUnlocked, unlockedPalmSectionsFor, unlockPalmSection, sectionUnlocksUsedBy,
  primaryReadingFor, setPrimaryReading,
} from '../data/store';
import { AiProvider } from '../ai/types';
import { PALMISTRY_SYSTEM_PROMPT } from '../ai/systemPrompts';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { recordCompletedReading, invalidateMemoryForSource } from '../memory/memoryService';
import { recordEvent } from '../events/eventTracker';
import { PalmReading } from '../types/palm';
import { isAccepted } from '../palmistry/validation';
import { buildPremiumSectionsByCategory } from '../palmistry/premiumPalmistryEngine';
import { saveReadingImage, readReadingImage, deleteReadingImage } from '../palmistry/imageStorage';
import { isFeatureEnabled } from '../data/featureFlags';

const analyzer = new VisionAssistedPalmAnalyzer();

const submitSchema = z.object({
  image: z.string().min(1),
  // Explicit, user-confirmed opt-in to replace an existing palm profile.
  // Never defaults to true - a bare duplicate POST (double-tap, retry)
  // must never silently create a second profile.
  allowRescan: z.boolean().optional(),
  // Which hand the user says they photographed - the vision model also
  // guesses this from the image (analysis.hand), but the user's own
  // selection is ground truth about their own body and must win when
  // both exist (see below, after analysis runs).
  hand: z.enum(['left', 'right']).optional(),
});
const askSchema = z.object({ question: z.string().min(1).max(1000) });
const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Full palm detail is a Premium purchase. (Env overrides exist only so a free taste can be re-enabled later.)
const MAX_FREE_PREMIUM_REPORTS = Number(process.env.PALM_FREE_PREMIUM_REPORTS ?? 0);
const MAX_FOLLOWUP_FREE = 0; // follow-up AI questions are Premium-only
// Section-wise unlock quota is tracked independently from the whole-bundle
// quota above (MAX_FREE_PREMIUM_REPORTS) - a free user gets one free single
// section AND, separately, the existing one free complete-bundle report.
// Keeping them independent avoids silently changing the behavior of the
// already-tested whole-report quota.
const MAX_FREE_SECTION_UNLOCKS = Number(process.env.PALM_FREE_SECTION_UNLOCKS ?? 0);

/** Same TEMPORARY testing shim as every other route in this app: no real
 * auth exists yet, identity comes from the x-demo-user header. */
function currentUserId(req: Request): string {
  // Prefers the real resolved auth context (see auth/middleware.ts's
  // attachAuthContext, mounted globally in index.ts) - falls back to the
  // legacy header read directly only for a test harness that builds this
  // router's Express app without that middleware mounted.
  if (req.auth?.userId) return req.auth.userId;
  return (req.headers['x-demo-user'] as string) || 'demo-user';
}

function summarizePalmReading(r: PalmReading): string {
  const sectionCount = r.freeReading.sections.length;
  return `Palm reading on ${r.createdAt.slice(0, 10)}. Image quality: ${r.analysis.imageQuality.ok ? 'good' : 'issue'}. ` +
    `${sectionCount} feature(s) confidently matched. ${r.freeReading.summary}`;
}

function premiumReportsUsedBy(userId: string): number {
  return readingsById.valuesForUser(userId).filter((r) => r.premiumReportGeneratedAt).length;
}

/** The section keys actually detected on this reading - the only values a
 * section-unlock request is ever allowed to name. Never derived from a
 * fixed list of "all possible sections", only from what the free reading
 * genuinely produced, so an undetected line can never be "unlocked". */
function detectedSectionKeys(reading: PalmReading): string[] {
  const keys = reading.freeReading.sections.map((s) => s.sectionKey).filter((k): k is NonNullable<typeof k> => !!k);
  return [...new Set<string>(keys)];
}


export function buildPalmRouter(aiProvider: AiProvider) {
  const router = Router();

  /** What the owner may see: locked sections reduced to a teaser (see palmistry/teaser.ts). */
  const forOwner = (reading: PalmReading) => redactLockedSections(reading, new Set(unlockedPalmSectionsFor(reading.id)));

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

    // Palm scanning is a one-time profile, not a repeatable feature: if the
    // user already has a primary reading, refuse to generate a new one
    // unless they explicitly confirmed a rescan (allowRescan: true). This
    // also protects against duplicate API calls (double-tap, retry after a
    // slow response) ever producing two profiles - the check happens before
    // any AI call or image persistence, so a blocked duplicate costs
    // nothing and creates nothing.
    const existingProfile = primaryReadingFor(userId);
    if (existingProfile && !parsed.data.allowRescan) {
      return res.status(409).json({
        error: 'A palm profile already exists for this account. Confirm a rescan to replace it.',
        code: 'PROFILE_EXISTS',
        existingReadingId: existingProfile.id,
      });
    }
    if (existingProfile && parsed.data.allowRescan && !isFeatureEnabled('palmRescan')) {
      return res.status(503).json({ error: 'Palm rescan is temporarily unavailable.', code: 'FEATURE_DISABLED' });
    }

    // Free plan: a limited number of palm scans per calendar month (rejected photos never create a reading, so they don't count).
    if (getUserTier(userId) !== 'premium') {
      const freeScans = Math.max(0, Number(process.env.PALM_FREE_SCANS_PER_MONTH ?? 1) || 0);
      const month = new Date().toISOString().slice(0, 7);
      let used = 0;
      for (const r of readingsById.valuesForUser(userId)) if (r.createdAt.startsWith(month)) used++;
      if (used >= freeScans) {
        return res.status(403).json({
          error: `Free accounts get ${freeScans} palm scan${freeScans === 1 ? '' : 's'} per month. Upgrade to Premium for more.`,
          code: 'LIMIT_REACHED',
        });
      }
    }

    const imageBuffer = Buffer.from(parsed.data.image, 'base64');

    const analysis = await analyzer.analyze(imageBuffer);

    // The user's own stated hand always wins over the vision model's guess
    // - it's a direct fact about their own body, not an interpretation, and
    // the model can and does get left/right wrong (e.g. ambiguous framing,
    // a photo of the hand from an angle the model misreads as mirrored).
    // analysis.validation.handSide (the model's own raw guess, used for the
    // separate "does this disagree with what you selected" warning on the
    // client) is left untouched - only the displayed/stored hand changes.
    if (parsed.data.hand) {
      analysis.hand = parsed.data.hand;
    }

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
    const readingId = uuid();

    // Persist the original captured photo to disk, mirroring this app's
    // existing solune.db on-disk persistence convention. A failure here must
    // never block the reading itself from being saved/returned - the reading
    // record is still complete and useful without its photo, so this is best
    // effort, not a hard dependency.
    let hasStoredImage = false;
    let imageHash: string | undefined;
    try {
      const saved = saveReadingImage(readingId, imageBuffer);
      hasStoredImage = true;
      imageHash = saved.hash;
    } catch {
      hasStoredImage = false;
    }

    const reading: PalmReading = {
      id: readingId,
      userId,
      createdAt: new Date().toISOString(),
      analysis,
      freeReading,
      premiumReportAvailable: true,
      premiumReport: null,
      premiumReportGeneratedAt: null,
      hasStoredImage,
      imageHash,
    };

    readingsById.set(reading.id, reading);
    // This becomes the user's one primary palm profile - demotes any prior
    // primary reading (the rescan-replaced one) in the same operation.
    setPrimaryReading(userId, reading.id);
    // Genuine completion point - the full reading (analysis + free reading)
    // was built successfully, not a partial/failed attempt.
    recordCompletedReading(userId, 'palm', reading.id, getUserTier(userId), summarizePalmReading(reading));
    recordEvent({ userId, eventType: 'PALM_REPORT_GENERATED', feature: 'palm', metadata: { readingId: reading.id } });
    res.json(forOwner(readingsById.get(reading.id)!));
  });

  router.get('/readings/:id', (req, res) => {
    const reading = readingsById.get(req.params.id);
    if (!reading || reading.userId !== currentUserId(req)) return res.status(404).json({ error: 'Reading not found' });
    res.json(forOwner(reading));
  });

  // Stored palm photo. Served to the owner (Authorization header) OR to anyone holding a short-lived signed URL
  // minted by /readings/:id/image-url below - <Image> cannot send custom headers reliably, and the old workaround
  // (session token in the query string) leaked long-lived credentials into URLs/logs.
  router.get('/readings/:id/image', (req, res) => {
    const reading = readingsById.get(req.params.id);
    const signedOk = verifySignedPath(`/palm/readings/${req.params.id}/image`, req.query.exp, req.query.sig);
    if (!reading || (!signedOk && reading.userId !== currentUserId(req))) return res.status(404).json({ error: 'Reading not found' });
    const buffer = readReadingImage(reading.id);
    if (!buffer) return res.status(404).json({ error: 'No stored image for this reading' });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.send(buffer);
  });

  // Owner-only: mints a 10-minute signed URL for the photo above.
  router.get('/readings/:id/image-url', (req, res) => {
    const reading = readingsById.get(req.params.id);
    if (!reading || reading.userId !== currentUserId(req)) return res.status(404).json({ error: 'Reading not found' });
    const path = `/palm/readings/${reading.id}/image`;
    const { exp, sig } = signPath(path);
    res.json({ url: `${path}?exp=${exp}&sig=${sig}`, expiresAt: new Date(exp * 1000).toISOString() });
  });

  // The one-time palm profile: the user's single primary reading, if they
  // have completed a scan. Returning users hit this on every Palm Scan
  // visit instead of re-submitting a photo - never regenerates anything,
  // just reads the already-saved reading.
  router.get('/profile', (req, res) => {
    const userId = currentUserId(req);
    const profile = primaryReadingFor(userId);
    if (!profile) return res.status(404).json({ error: 'No palm profile yet', code: 'NO_PROFILE' });
    res.json(forOwner(profile));
  });

  router.get('/readings', (req, res) => {
    const userId = currentUserId(req);
    const items = readingsById.valuesForUser(userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(forOwner);
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
      return res.status(403).json({ error: 'The full palm reading is part of Palm Setu Premium.', code: 'LIMIT_REACHED' });
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

    // The complete-reading bundle is equivalent to unlocking every
    // detected section at once - mark them as unlocked in the section-wise
    // store too, so GET /readings/:id/sections (the new per-section view)
    // reflects this without needing a separate "is this a legacy whole-
    // report record" branch everywhere that endpoint is read from.
    for (const section of detectedSectionKeys(reading)) {
      unlockPalmSection(reading.id, userId, section);
    }
    res.json(reading);
  });

  // Section-wise entitlement: unlock ONE detected line/section for this
  // reading. Same simulated-purchase pattern as every other premium
  // feature in this app (tier check -> quota check -> recordTransaction ->
  // grant) - there is no real payment gateway, this never charges real
  // money, it only writes a transaction row for the admin revenue report.
  router.post('/readings/:id/sections/:section/unlock', async (req, res) => {
    const userId = currentUserId(req);
    const reading = readingsById.get(req.params.id);
    if (!reading || reading.userId !== userId) return res.status(404).json({ error: 'Reading not found' });

    const section = req.params.section;
    if (!detectedSectionKeys(reading).includes(section)) {
      // Never let a client "unlock" a line that was never actually
      // detected in this reading - that would be fabricating a feature.
      return res.status(400).json({ error: 'This section was not detected in this reading, so it cannot be unlocked.', code: 'SECTION_NOT_DETECTED' });
    }

    // Legacy whole-report records, or a section already unlocked, are
    // idempotent no-ops - never re-charge.
    if (reading.premiumReport || isPalmSectionUnlocked(reading.id, section)) {
      return res.json({ unlocked: true, section, alreadyUnlocked: true });
    }

    const tier = getUserTier(userId);
    const used = sectionUnlocksUsedBy(userId);
    if (tier !== 'premium' && used >= MAX_FREE_SECTION_UNLOCKS) {
      return res.status(403).json({ error: 'Full palm detail is part of Palm Setu Premium.', code: 'LIMIT_REACHED' });
    }

    unlockPalmSection(reading.id, userId, section);
    if (tier === 'premium' && used >= MAX_FREE_SECTION_UNLOCKS) {
      recordTransaction(userId, 'palm_section_unlock');
    }
    res.json({ unlocked: true, section });
  });

  // Section-wise read: for each section the free reading actually
  // detected, report whether it's unlocked and, only if so, include its
  // detailed premium content (reusing premiumPalmistryEngine's existing
  // per-line content generation - nothing new is generated here, only
  // gated differently). Old whole-report records (premiumReport populated)
  // are treated as every detected section being unlocked, for backward
  // compatibility.
  router.get('/readings/:id/sections', (req, res) => {
    const userId = currentUserId(req);
    const reading = readingsById.get(req.params.id);
    if (!reading || reading.userId !== userId) return res.status(404).json({ error: 'Reading not found' });

    const legacyAllUnlocked = !!reading.premiumReport;
    const unlockedSet = new Set(unlockedPalmSectionsFor(reading.id));
    const { byCategory } = buildPremiumSectionsByCategory(reading.analysis);
    const detected = detectedSectionKeys(reading);

    const sections = reading.freeReading.sections.map((s) => {
      const key = s.sectionKey ?? 'unknown';
      const unlocked = legacyAllUnlocked || unlockedSet.has(key);
      return {
        sectionKey: key,
        title: s.title,
        // Locked sections get only the opening line; the rest is part of what unlocking reveals.
        freeText: unlocked ? s.text : teaserText(s.text),
        freeTextTruncated: !unlocked,
        unlocked,
        detail: unlocked ? (byCategory[key] ?? []) : null,
      };
    });

    res.json({
      sections,
      completeUnlocked: legacyAllUnlocked || (detected.length > 0 && detected.every((k) => unlockedSet.has(k))),
    });
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
      return res.status(403).json({ error: 'Follow-up questions are a Premium feature. Upgrade to ask more.', code: 'LIMIT_REACHED' });
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
    deleteReadingImage(reading.id);
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

    const latestReading = readingsById.valuesForUser(userId)
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
