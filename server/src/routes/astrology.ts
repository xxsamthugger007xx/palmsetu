import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { AiProvider } from '../ai/types';
import { ASTROLOGY_SYSTEM_PROMPT } from '../ai/astrologySystemPrompt';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { computeNatalSummary, computeKundli, ENGINE_VERSION } from '../astrology/engine';
import { generateDailyHoroscope } from '../astrology/horoscopeService';
import { generateSoulEnergyReading } from '../astrology/soulEnergyService';
import { generateSharedReport } from '../relationships/relationshipReportService';
import {
  createInvitation, acceptInvitation, revokeInvitation, disconnectRelationship, InvitationError,
} from '../relationships/invitationService';
import {
  birthProfiles, dailyHoroscopesByKey, astrologyFollowupCounts,
  partnerInvitations, relationshipsById, activeRelationshipByUser, relationshipConsents,
  relationshipDailyReportsByKey, deliveryPreferences, getUserTier,
  kundliChartsById, soulEnergyReadingsByKey, recordTransaction, userIdentities,
} from '../data/store';
import { AstrologySystem, BirthProfile, ConsentType, DailyHoroscope, RelationshipDailyReport, UserIdentity } from '../types/astrology';
import { KundliChart, KundliChartStyle } from '../types/kundli';
import { recordCompletedReading } from '../memory/memoryService';

/** Compact factual summary for the memory layer - sign/theme facts only,
 * never the full guidance text (keeps memory cheap and premium-safe). */
function summarizeHoroscope(h: DailyHoroscope): string {
  return `${h.astrologySystem} daily horoscope for ${h.localDate}. Theme: ${h.dailyTheme}. Focus: ${h.focus?.priority ?? ''}.`;
}

/**
 * TEMPORARY testing shim: this app has no real authentication yet (same gap noted
 * in palm/tarot routes). To exercise the two-sided relationship flow without auth,
 * we read an `x-demo-user` header and default to 'demo-user'. This must be removed
 * and replaced with real session-derived identity before this ever ships - a client
 * must never be trusted to assert its own user ID in production.
 */
function currentUserId(req: any): string {
  return (req.headers['x-demo-user'] as string) || 'demo-user';
}

const CONTENT_VERSION = 'solune-astrology-1.0';
const MAX_FOLLOWUP_FREE = 2;

const birthProfileSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Required, not optional: exact birth time materially changes Moon sign/nakshatra
  // and transit results, so the client UI now always collects it via a time picker.
  birthTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  birthPlace: z.string().min(1).max(200),
  // Real city-center coordinates from the client's city picker (see
  // app/src/data/birthplaces.ts) - required so ascendant/house/dasha
  // calculation never needs to ask the user for raw latitude/longitude.
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  preferredSystem: z.enum(['vedic', 'western']),
  timezone: z.string().min(1),
});

const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Identity (name, gender) is collected during onboarding, before any birth
// date/time/place exists, so it cannot be validated/stored as part of
// birthProfileSchema above (birthDate etc. are required there). name is
// required because every screen that renders a profile (AppHeader, Home,
// ProfileScreen) expects one; gender stays optional/nullable - callers that
// render it (AIAvatar) already fall back to 'prefer-not-to-say' when it is
// absent (see OnboardingScreen's `gender={gender ?? 'prefer-not-to-say'}`),
// so storage-level optionality does not break any existing render path.
const userIdentitySchema = z.object({
  name: z.string().min(1).max(100),
  gender: z.enum(['woman', 'man', 'non-binary', 'prefer-not-to-say']).nullable().optional(),
});

function requireProfile(res: any, userId: string): BirthProfile | undefined {
  const profile = birthProfiles.get(userId);
  if (!profile) {
    res.status(400).json({ error: 'Birth profile not set up yet.', code: 'NO_PROFILE' });
    return undefined;
  }
  return profile;
}

export function buildAstrologyRouter(aiProvider: AiProvider) {
  const router = Router();

  // --- Birth profile ---------------------------------------------------------
  router.put('/profile', (req, res) => {
    const userId = currentUserId(req);
    const parsed = birthProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const { birthDate, birthTime, birthPlace, latitude, longitude, preferredSystem, timezone } = parsed.data;
    const natal = computeNatalSummary(birthDate, birthTime ?? null);

    const profile: BirthProfile = {
      userId,
      birthDate,
      birthTime: birthTime ?? null,
      birthPlace: birthPlace ?? null,
      birthLatitude: latitude,
      birthLongitude: longitude,
      preferredSystem,
      timezone,
      natal,
      updatedAt: new Date().toISOString(),
    };
    birthProfiles.set(userId, profile);
    res.json(profile);
  });

  router.get('/profile', (req, res) => {
    const profile = birthProfiles.get(currentUserId(req));
    if (!profile) return res.status(404).json({ error: 'No birth profile set up yet.' });
    res.json(profile);
  });

  // --- Identity (name, gender) - backend-persisted, decoupled from the birth
  // profile above so it can be set during onboarding before birth details
  // exist. See UserIdentity in types/astrology.ts for why this is a separate
  // record rather than merged fields on BirthProfile. -----------------------
  router.get('/identity', (req, res) => {
    const identity = userIdentities.get(currentUserId(req));
    if (!identity) return res.status(404).json({ error: 'No identity set up yet.' });
    res.json(identity);
  });

  router.put('/identity', (req, res) => {
    const userId = currentUserId(req);
    const parsed = userIdentitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const identity: UserIdentity = {
      userId,
      name: parsed.data.name,
      gender: parsed.data.gender ?? null,
      updatedAt: new Date().toISOString(),
    };
    userIdentities.set(userId, identity);
    res.json(identity);
  });

  // --- Daily horoscope (lazy-generated, idempotent per user+date+system) -----
  router.get('/daily', async (req, res) => {
    const userId = currentUserId(req);
    const profile = requireProfile(res, userId);
    if (!profile) return;

    const dateParsed = localDateSchema.safeParse(req.query.localDate);
    if (!dateParsed.success) return res.status(400).json({ error: 'Query param localDate=YYYY-MM-DD is required' });
    const localDate = dateParsed.data;
    const system = (req.query.system as AstrologySystem) || profile.preferredSystem;
    if (system !== 'vedic' && system !== 'western') return res.status(400).json({ error: 'system must be vedic or western' });

    const key = `${userId}:${localDate}:${system}`;
    const existing = dailyHoroscopesByKey.get(key);
    if (existing) return res.json(existing); // idempotent - never regenerate on refresh

    try {
      const content = await generateDailyHoroscope(profile, localDate, system, aiProvider);
      const horoscope: DailyHoroscope = {
        id: uuid(),
        userId,
        localDate,
        timezone: profile.timezone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        generationStatus: 'ready',
        ...content,
      };
      dailyHoroscopesByKey.set(key, horoscope);
      // Genuine completion point: generation succeeded. The failure branch
      // below never records a memory - a failed horoscope is not a memory.
      recordCompletedReading(userId, 'astrology', horoscope.id, getUserTier(userId), summarizeHoroscope(horoscope));
      res.json(horoscope);
    } catch (err) {
      const failed: DailyHoroscope = {
        id: uuid(),
        userId,
        localDate,
        timezone: profile.timezone,
        astrologySystem: system,
        calculationReference: ENGINE_VERSION,
        transitContext: null as any,
        summary: '', dailyTheme: '', focus: { priority: '', action: '' }, careerGuidance: '',
        relationshipGuidance: '', selfCarePrompt: '', doSuggestions: [], mindfulOfSuggestions: [],
        dailyChallenge: '', reflectionQuestion: '', astrologicalExplanation: '',
        dataCompleteness: profile.natal.birthTimeKnown ? 'full' : 'partial',
        contentVersion: CONTENT_VERSION,
        generationStatus: 'failed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      dailyHoroscopesByKey.set(key, failed);
      res.status(500).json({ error: 'Generation failed. Use the retry endpoint.', horoscope: failed });
    }
  });

  router.post('/daily/retry', async (req, res) => {
    const userId = currentUserId(req);
    const profile = requireProfile(res, userId);
    if (!profile) return;

    const dateParsed = localDateSchema.safeParse(req.body.localDate);
    if (!dateParsed.success) return res.status(400).json({ error: 'localDate=YYYY-MM-DD is required' });
    const localDate = dateParsed.data;
    const system: AstrologySystem = req.body.system || profile.preferredSystem;
    const key = `${userId}:${localDate}:${system}`;

    const existing = dailyHoroscopesByKey.get(key);
    if (existing && existing.generationStatus === 'ready') return res.json(existing); // already succeeded - idempotent

    const content = await generateDailyHoroscope(profile, localDate, system, aiProvider);
    const horoscope: DailyHoroscope = {
      id: existing?.id ?? uuid(),
      userId, localDate, timezone: profile.timezone,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generationStatus: 'ready',
      ...content,
    };
    dailyHoroscopesByKey.set(key, horoscope);
    recordCompletedReading(userId, 'astrology', horoscope.id, getUserTier(userId), summarizeHoroscope(horoscope));
    res.json(horoscope);
  });

  router.post('/daily/:id/ask', async (req, res) => {
    const userId = currentUserId(req);
    const horoscope = [...dailyHoroscopesByKey.values()].find((h) => h.id === req.params.id);
    if (!horoscope || horoscope.userId !== userId) return res.status(404).json({ error: 'Not found' });

    const question = String(req.body.question ?? '').trim();
    if (!question) return res.status(400).json({ error: 'question is required' });
    if (containsCrisisLanguage(question)) return res.json({ answer: CRISIS_RESPONSE, crisisFlag: true });

    const askedSoFar = astrologyFollowupCounts.get(horoscope.id) ?? 0;
    if (askedSoFar >= MAX_FOLLOWUP_FREE) {
      return res.status(403).json({ error: `Free plan allows ${MAX_FOLLOWUP_FREE} follow-up questions per reading.` });
    }

    let answer: string;
    try {
      answer = await aiProvider.complete([
        { role: 'system', content: ASTROLOGY_SYSTEM_PROMPT },
        { role: 'user', content: `Today's reading summary: ${horoscope.summary}\n\nFollow-up question: ${question}` },
      ]);
    } catch {
      answer = 'Unable to generate a follow-up response right now - please try again shortly.';
    }
    astrologyFollowupCounts.set(horoscope.id, askedSoFar + 1);
    res.json({ answer });
  });

  // --- Relationship: invitations -----------------------------------------------
  router.post('/relationships/invitations', (req, res) => {
    try {
      const { invitation, plaintextCode } = createInvitation(currentUserId(req));
      res.json({ invitationId: invitation.id, code: plaintextCode, expiresAt: invitation.expiresAt });
    } catch (err) {
      if (err instanceof InvitationError) return res.status(409).json({ error: err.message, code: err.code });
      throw err;
    }
  });

  router.post('/relationships/invitations/:id/revoke', (req, res) => {
    try {
      const inv = revokeInvitation(req.params.id, currentUserId(req));
      res.json(inv);
    } catch (err) {
      if (err instanceof InvitationError) return res.status(409).json({ error: err.message, code: err.code });
      throw err;
    }
  });

  router.post('/relationships/invitations/accept', (req, res) => {
    const code = String(req.body.code ?? '');
    if (!code) return res.status(400).json({ error: 'code is required' });
    try {
      const relationship = acceptInvitation(code, currentUserId(req));
      res.json(relationship);
    } catch (err) {
      if (err instanceof InvitationError) return res.status(409).json({ error: err.message, code: err.code });
      throw err;
    }
  });

  // --- Relationship: status, consent, disconnect -------------------------------
  router.get('/relationships/me', (req, res) => {
    const userId = currentUserId(req);
    const relId = activeRelationshipByUser.get(userId);
    if (!relId) return res.json({ relationship: null });
    const relationship = relationshipsById.get(relId);
    const consents = [...relationshipConsents.values()].filter((c) => c.relationshipId === relId && c.userId === userId);
    res.json({ relationship, myConsents: consents });
  });

  router.patch('/relationships/:id/consent', (req, res) => {
    const userId = currentUserId(req);
    const rel = relationshipsById.get(req.params.id);
    if (!rel || (rel.userAId !== userId && rel.userBId !== userId)) return res.status(404).json({ error: 'Not found' });

    const consentType = req.body.consentType as ConsentType;
    const enabled = Boolean(req.body.enabled);
    const key = `${rel.id}:${userId}:${consentType}`;
    const existing = relationshipConsents.get(key);
    if (!existing) return res.status(400).json({ error: 'Unknown consent type' });

    existing.enabled = enabled;
    existing.updatedAt = new Date().toISOString();
    res.json(existing);
  });

  router.post('/relationships/:id/disconnect', (req, res) => {
    try {
      const rel = disconnectRelationship(req.params.id, currentUserId(req));
      res.json(rel);
    } catch (err) {
      if (err instanceof InvitationError) return res.status(409).json({ error: err.message, code: err.code });
      throw err;
    }
  });

  // --- Relationship: shared daily report ---------------------------------------
  router.get('/relationships/:id/daily', async (req, res) => {
    const userId = currentUserId(req);
    const rel = relationshipsById.get(req.params.id);
    if (!rel || rel.status !== 'active' || (rel.userAId !== userId && rel.userBId !== userId)) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    const myConsent = relationshipConsents.get(`${rel.id}:${userId}:receiveSharedReadings`);
    if (!myConsent?.enabled) {
      return res.status(403).json({ error: 'You have opted out of shared relationship readings.' });
    }

    const dateParsed = localDateSchema.safeParse(req.query.localDate);
    if (!dateParsed.success) return res.status(400).json({ error: 'Query param localDate=YYYY-MM-DD is required' });
    const localDate = dateParsed.data;

    const key = `${rel.id}:${localDate}`;
    const existing = relationshipDailyReportsByKey.get(key);
    if (existing) return res.json(existing);

    const profileA = birthProfiles.get(rel.userAId);
    const profileB = birthProfiles.get(rel.userBId);
    if (!profileA || !profileB) {
      return res.status(400).json({ error: 'Both partners need a birth profile set up before a shared reading can be generated.' });
    }

    const content = await generateSharedReport(profileA, profileB, localDate, aiProvider);
    const report: RelationshipDailyReport = {
      id: uuid(),
      relationshipId: rel.id,
      localDate,
      createdAt: new Date().toISOString(),
      generationStatus: 'ready',
      ...content,
    };
    relationshipDailyReportsByKey.set(key, report);
    res.json(report);
  });

  router.get('/relationships/:id/history', (req, res) => {
    const userId = currentUserId(req);
    const rel = relationshipsById.get(req.params.id);
    if (!rel || (rel.userAId !== userId && rel.userBId !== userId)) return res.status(404).json({ error: 'Not found' });

    const reports = [...relationshipDailyReportsByKey.values()]
      .filter((r) => r.relationshipId === rel.id)
      .sort((a, b) => b.localDate.localeCompare(a.localDate));
    res.json({ items: reports });
  });

  // --- Delivery preferences (no real push wiring yet - see README) -------------
  router.get('/preferences', (req, res) => {
    const userId = currentUserId(req);
    const prefs = deliveryPreferences.get(userId) ?? {
      userId, dailyHoroscopeEnabled: false, relationshipMessageEnabled: false,
      preferredLocalTime: '08:00', quietHoursStart: null, quietHoursEnd: null,
      previewMode: 'discreet' as const, updatedAt: new Date().toISOString(),
    };
    res.json(prefs);
  });

  router.put('/preferences', (req, res) => {
    const userId = currentUserId(req);
    const prefs = {
      userId,
      dailyHoroscopeEnabled: Boolean(req.body.dailyHoroscopeEnabled),
      relationshipMessageEnabled: Boolean(req.body.relationshipMessageEnabled),
      preferredLocalTime: req.body.preferredLocalTime ?? '08:00',
      quietHoursStart: req.body.quietHoursStart ?? null,
      quietHoursEnd: req.body.quietHoursEnd ?? null,
      previewMode: req.body.previewMode === 'detailed' ? ('detailed' as const) : ('discreet' as const),
      updatedAt: new Date().toISOString(),
    };
    deliveryPreferences.set(userId, prefs);
    res.json(prefs);
  });

  // --- Kundli (Vedic chart) generation ----------------------------------------
  //
  // Free tier gets exactly ONE real kundli generation (any style) lifetime,
  // same MAX_*_FREE=1 pattern as routes/gemstone.ts and routes/vastu.ts.
  // "Other person's astrology" always requires premium, regardless of the
  // free quota, since it's a separate feature from the user's own free slot.
  const MAX_KUNDLI_FREE = 1;

  const kundliCreateSchema = z.object({
    style: z.enum(['northIndia', 'southIndia', 'western']),
    subject: z.enum(['self', 'other']),
    subjectName: z.string().min(1).max(100).optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    birthTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    // Only required for subject 'other' (city picked from the client's
    // BIRTHPLACES list, same as the profile setup flow). For 'self' the
    // coordinates already live on the saved birth profile and are never
    // re-asked from the user.
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  });

  router.get('/kundli/limits', (req, res) => {
    const userId = currentUserId(req);
    const tier = getUserTier(userId);
    const count = [...kundliChartsById.values()].filter((c) => c.userId === userId).length;
    res.json({
      tier,
      canGenerateSelf: tier === 'premium' || count < MAX_KUNDLI_FREE,
      canGenerateOther: tier === 'premium',
      generationsUsed: count,
      freeLimit: MAX_KUNDLI_FREE,
    });
  });

  router.post('/kundli', async (req, res) => {
    const userId = currentUserId(req);
    const parsed = kundliCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const { style, subject } = parsed.data;

    let birthDate: string;
    let birthTime: string;
    let latitude: number;
    let longitude: number;
    if (subject === 'self') {
      const profile = requireProfile(res, userId);
      if (!profile) return;
      if (!profile.birthTime) {
        return res.status(400).json({
          error: 'Lagna/houses require an exact birth time. Add your birth time in Daily Cosmic Guidance first.',
          code: 'BIRTH_TIME_REQUIRED',
        });
      }
      if (profile.birthLatitude == null || profile.birthLongitude == null) {
        return res.status(400).json({
          error: 'Lagna/houses require a birthplace. Add your birthplace in Daily Cosmic Guidance first.',
          code: 'BIRTHPLACE_REQUIRED',
        });
      }
      birthDate = profile.birthDate;
      birthTime = profile.birthTime;
      latitude = profile.birthLatitude;
      longitude = profile.birthLongitude;
    } else {
      if (
        !parsed.data.birthDate || !parsed.data.birthTime || !parsed.data.subjectName
        || parsed.data.latitude === undefined || parsed.data.longitude === undefined
      ) {
        return res.status(400).json({
          error: 'subjectName, birthDate, birthTime and a birthplace are required for "other" subject.',
        });
      }
      birthDate = parsed.data.birthDate;
      birthTime = parsed.data.birthTime;
      latitude = parsed.data.latitude;
      longitude = parsed.data.longitude;
    }

    const tier = getUserTier(userId);
    const existingCount = [...kundliChartsById.values()].filter((c) => c.userId === userId).length;

    if (subject === 'other' && tier !== 'premium') {
      return res.status(403).json({
        error: "Other person's astrology is a premium feature. Upgrade to generate another person's kundli.",
        code: 'PREMIUM_REQUIRED',
      });
    }
    if (subject === 'self' && tier !== 'premium' && existingCount >= MAX_KUNDLI_FREE) {
      return res.status(403).json({
        error: `Free plan allows ${MAX_KUNDLI_FREE} kundli generation. Upgrade for additional chart generations.`,
        code: 'LIMIT_REACHED',
      });
    }

    const birthInstantUtc = new Date(`${birthDate}T${birthTime.length === 5 ? `${birthTime}:00` : birthTime}Z`);
    const chartData = computeKundli({ date: birthInstantUtc, latitude, longitude });

    const chart: KundliChart = {
      id: uuid(),
      userId,
      subject,
      subjectName: subject === 'other' ? parsed.data.subjectName ?? null : null,
      style,
      birthDate,
      birthTime,
      latitude,
      longitude,
      chart: chartData,
      createdAt: new Date().toISOString(),
    };
    kundliChartsById.set(chart.id, chart);

    // Charge exactly once per generation that goes beyond the free self-slot,
    // mirroring the gemstone/vastu recordTransaction call sites: this slot
    // genuinely required premium to reach (either the "other" gate above, or
    // the free self quota already being used up), so it's one real unlock.
    if (tier === 'premium' && (subject === 'other' || existingCount >= MAX_KUNDLI_FREE)) {
      recordTransaction(userId, 'astrology_premium_report');
    }
    recordCompletedReading(
      userId, 'astrology', chart.id, tier,
      `Kundli chart (${style}) generated for ${subject === 'self' ? 'self' : chart.subjectName ?? 'another person'}. Ascendant: ${chartData.ascendantSign}. Current dasha: ${chartData.currentDasha.lord}.`
    );
    res.json(chart);
  });

  router.get('/kundli', (req, res) => {
    const userId = currentUserId(req);
    const items = [...kundliChartsById.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ items });
  });

  router.get('/kundli/:id', (req, res) => {
    const chart = kundliChartsById.get(req.params.id);
    if (!chart || chart.userId !== currentUserId(req)) return res.status(404).json({ error: 'Chart not found' });
    res.json(chart);
  });

  // --- Soul Energy Reading (AI personality reading) ---------------------------
  // One real AI-generated reading per user per local day, same idempotent-per-
  // key shape as the daily horoscope. No premium gate (matches the existing
  // entitlementCheck.ts note that astrology has no premium gate beyond kundli).
  router.get('/soul-energy', async (req, res) => {
    const userId = currentUserId(req);
    const profile = requireProfile(res, userId);
    if (!profile) return;

    const dateParsed = localDateSchema.safeParse(req.query.localDate);
    if (!dateParsed.success) return res.status(400).json({ error: 'Query param localDate=YYYY-MM-DD is required' });
    const localDate = dateParsed.data;

    const key = `${userId}:${localDate}`;
    const existing = soulEnergyReadingsByKey.get(key);
    if (existing) return res.json(existing); // idempotent, same as daily horoscope

    // Ascendant requires exact coordinates, which the birth profile does not
    // store (only a free-text place name) - so this grounds on Sun/Moon/
    // nakshatra only, honestly, with no fabricated rising sign.
    try {
      const content = await generateSoulEnergyReading(profile, null, aiProvider);
      const reading = { id: uuid(), userId, localDate, createdAt: new Date().toISOString(), ...content };
      soulEnergyReadingsByKey.set(key, reading);
      recordCompletedReading(
        userId, 'astrology', reading.id, getUserTier(userId),
        `Soul Energy Reading generated for ${localDate}. Core personality: ${reading.corePersonality.slice(0, 80)}...`
      );
      res.json(reading);
    } catch (err) {
      console.warn('[soul-energy] generation failed:', err);
      res.status(502).json({ error: 'Soul Energy Reading generation failed. Please try again.' });
    }
  });

  return router;
}
