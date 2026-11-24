import { AiProvider } from '../ai/types';
import { AssistantFeature, AssistantMessage, userIdentities } from '../data/store';
import { AssistantConfig } from '../data/assistantConfig';
import { buildAssistantSystemPrompt } from './systemPrompts';
import {
  detectFeature, detectFeatureHeuristic, detectAstrologyTopic,
  detectTarotCard, detectGemstonePlanet, detectVastuDirection, detectPalmCategory,
} from './intentDetection';
import { getAstrologyKnowledge } from '../astrology/knowledgeBase/knowledgeBaseService';
import { buildGemstoneDefinition } from '../gemstone/recommendationEngine';
import { getDirectionEntry } from '../vastu/knowledgeEngine';
import { getKnowledgeEntriesByCategory } from '../palmistry/knowledgeBase/knowledgeBaseService';
import { retrieveUserData, retrieveUserDataForFeature, hasDataFor, UserFeatureData } from './dataRetrieval';
import { evaluateEntitlement, PremiumCard } from './entitlementCheck';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { classifyMode, generationOptionsForMode, AssistantMode } from './modeClassifier';
import { retrieveRelevantMemories, extractAndStoreFacts } from '../memory/memoryService';

const FEATURES_NOT_IMPLEMENTED = ['numerology', 'moolaank', 'bhagyank'];

export interface AssistantReplyResult {
  reply: string;
  detectedFeature: AssistantFeature | null;
  premiumCard: PremiumCard | null;
  suggestedFollowUps: string[];
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  success: boolean;
  /** FAST / DEEP_ANALYSIS / PREMIUM_REPORT classification (see
   * modeClassifier.ts). Null when no AI call happened at all (crisis
   * response, unimplemented-feature notice, unknown feature, or no data on
   * file) - there is no "mode" to speak of when nothing was generated. */
  mode: AssistantMode | null;
  /** Real wall-clock timing instrumentation through the pipeline, in ms.
   * Undefined stages mean that step was skipped (e.g. no AI call needed). */
  timings: {
    intentDetectionMs?: number;
    dataRetrievalMs?: number;
    timeToFirstTokenMs?: number;
    generationMs?: number;
    totalMs: number;
  };
}

export interface StageEvent {
  key: string;
  label: string;
}

/**
 * Fired at each REAL pipeline step as it genuinely happens - never ahead of
 * the work it describes. The label only becomes feature-specific (e.g.
 * "Accessing your Kundli...") once detectFeature() has actually resolved a
 * feature AND retrieveUserData() has actually returned real data for it;
 * before that it stays generic. There are no artificial delays here - a
 * stage fires and the pipeline moves on immediately once the real step it
 * describes completes.
 */
export type OnStage = (event: StageEvent) => void;

/**
 * Rough token estimate: ~4 characters per token, same ballpark heuristic used
 * by most providers for English text. This is NOT real token metering - there
 * is none anywhere in this codebase - it exists only so the admin panel has
 * an honestly-labeled directional number instead of nothing. Cost estimate
 * uses a documented flat assumed rate, same honesty framing as
 * server/src/data/pricing.ts's assumed billing table.
 */
export const ASSUMED_COST_PER_1K_INPUT_TOKENS_CENTS = 0.3;
export const ASSUMED_COST_PER_1K_OUTPUT_TOKENS_CENTS = 1.5;

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * ASSUMED_COST_PER_1K_INPUT_TOKENS_CENTS +
    (outputTokens / 1000) * ASSUMED_COST_PER_1K_OUTPUT_TOKENS_CENTS;
}

class AiDisabledError extends Error {}
const NO_AI_PROVIDER: AiProvider = {
  complete: async () => { throw new AiDisabledError('AI disabled for this plan'); },
} as unknown as AiProvider;

function isAiDisabled(p: AiProvider): boolean { return p === NO_AI_PROVIDER; }

function humanize(id: string): string {
  return id.replace(/^major-\d+-/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Plain-language answer built only from the user's stored free-tier data (used when the AI is off for the plan). */
function describeForUser(feature: AssistantFeature, data: UserFeatureData): string {
  switch (feature) {
    case 'tarot': {
      const r = data.tarot!;
      const cards = r.draws.map((d) => `${d.positionName}: ${humanize(d.cardId)}${d.orientation === 'reversed' ? ' (reversed)' : ''}`).join('\n');
      return `Your latest ${humanize(r.spreadType)} reading:\n${cards}` + (r.interpretation?.overallInterpretation ? `\n\n${r.interpretation.overallInterpretation}` : '');
    }
    case 'astrology': {
      const profile = data.astrology.profile!;
      const h = data.astrology.latestHoroscope;
      const moon = profile.natal.moonSignSidereal ?? profile.natal.moonSignTropical;
      return `Your moon sign is ${moon} (${profile.preferredSystem} system).` + (h ? `\n\nToday's horoscope: ${h.summary}` : '');
    }
    case 'gemstone': {
      const r = data.gemstone!;
      return r.primary.gemstone
        ? `Your recommended gemstone is ${r.primary.gemstone.nameEnglish} (${r.primary.gemstone.nameHindi}).\n\n${r.primary.ruleExplanation}`
        : `A gemstone couldn't be recommended from your chart data: ${r.primary.reasonUnavailable ?? 'unknown reason'}.`;
    }
    case 'vastu': {
      const r = data.vastu!;
      return `Your Vastu report:\n` + r.roomAnalyses.map((a) => `- ${a.roomLabel} facing ${a.direction}: ${a.alignment}`).join('\n');
    }
    case 'palm': {
      const r = data.palm!;
      return `From your palm reading:\n` + r.freeReading.sections.map((x: { title: string; text: string }) => `${x.title}: ${x.text}`).join('\n');
    }
    default:
      return '';
  }
}

const DEFAULT_FREE_NOTE = '\n\nUpgrade to Premium to chat with the full AI assistant about anything.';

function mentionsUnimplementedFeature(message: string): string | null {
  const text = message.toLowerCase();
  for (const kw of FEATURES_NOT_IMPLEMENTED) {
    if (text.includes(kw)) return kw;
  }
  return null;
}

function describeFreeData(feature: AssistantFeature, data: UserFeatureData): string {
  switch (feature) {
    case 'tarot': {
      const r = data.tarot!;
      const cards = r.draws.map((d) => `${d.positionName}: ${d.cardId} (${d.orientation})`).join('; ');
      let text = `Latest tarot reading (${r.readingType}, ${r.spreadType}): ${cards}. ` +
        `Static interpretation available: ${r.interpretation ? 'yes' : 'not generated yet'}. ` +
        `Detailed AI report status: ${r.detailedReportStatus}.`;
      // Real second-most-recent reading, only when one genuinely exists -
      // supports "compare my last two readings" without inventing a second
      // reading when the user has only ever taken one.
      if (data.tarotRecent.length >= 2) {
        const prev = data.tarotRecent[1];
        const prevCards = prev.draws.map((d) => `${d.positionName}: ${d.cardId} (${d.orientation})`).join('; ');
        text += ` Previous tarot reading (${prev.createdAt.slice(0, 10)}, ${prev.readingType}, ${prev.spreadType}): ${prevCards}.`;
      }
      return text;
    }
    case 'astrology': {
      const profile = data.astrology.profile!;
      const h = data.astrology.latestHoroscope;
      return `Birth profile on file (system: ${profile.preferredSystem}, moon sign: ${profile.natal.moonSignSidereal ?? profile.natal.moonSignTropical}). ` +
        (h ? `Latest daily horoscope (${h.localDate}): ${h.summary}` : 'No daily horoscope generated yet.');
    }
    case 'gemstone': {
      const r = data.gemstone!;
      return r.primary.gemstone
        ? `Recommended gemstone: ${r.primary.gemstone.nameEnglish} (${r.primary.gemstone.nameHindi}), rule: ${r.primary.ruleExplanation}.`
        : `No gemstone could be recommended from available chart data: ${r.primary.reasonUnavailable ?? 'unknown reason'}.`;
    }
    case 'vastu': {
      const r = data.vastu!;
      const rooms = r.roomAnalyses.map((a) => `${a.roomLabel} facing ${a.direction} (${a.alignment})`).join('; ');
      return `Vastu report room analysis: ${rooms}.`;
    }
    case 'palm': {
      const r = data.palm!;
      const sections = r.freeReading.sections.map((s: { title: string; text: string }) => `${s.title}: ${s.text}`).join('; ');
      let text = `Palm reading sections: ${sections}.`;
      // Real uncertain-feature notes (e.g. why the fate line wasn't
      // detected) so the assistant can give a genuine answer to "why
      // wasn't my fate line detected" instead of a generic non-answer.
      if (r.analysis.uncertainFeatures.length > 0) {
        text += ` Features not confidently detected in this photo, with the honest reason: ${r.analysis.uncertainFeatures.join(' ')}`;
      }
      // Real second-most-recent reading, only when one genuinely exists -
      // supports "compare my last two palm readings" without inventing a
      // second reading when the user has only ever taken one. Only
      // free-tier-safe section titles/text, never premium report text.
      if (data.palmRecent.length >= 2) {
        const prev = data.palmRecent[1];
        const prevSections = prev.freeReading.sections.map((s: { title: string; text: string }) => `${s.title}: ${s.text}`).join('; ');
        text += ` Previous palm reading (${prev.createdAt.slice(0, 10)}): ${prevSections}.`;
      }
      return text;
    }
    default:
      return '';
  }
}

function noDataMessage(feature: AssistantFeature, config: AssistantConfig): string {
  const labels: Record<string, { what: string; where: string }> = {
    tarot: { what: 'tarot reading', where: 'the Tarot section' },
    astrology: { what: 'birth profile', where: 'Daily Cosmic Guidance' },
    gemstone: { what: 'gemstone report', where: 'the Gemstone section' },
    vastu: { what: 'vastu report', where: 'the Vastu Compass section' },
    palm: { what: 'palm reading', where: 'the Palm Scan section' },
  };
  const l = labels[feature as string];
  if (!l) return "I don't have any data on file for that yet.";
  return `You don't have a ${l.what} on file yet, so I can't answer from real data. Head to ${l.where} to set that up first, and I'll be able to help once it exists.`;
}

/** Feature-specific "retrieving" labels, only ever used AFTER real data for
 * that feature has actually been retrieved - see OnStage doc above. */
function dataStageLabel(feature: AssistantFeature): string {
  switch (feature) {
    case 'astrology': return 'Accessing your Kundli...';
    case 'tarot': return 'Reviewing your tarot draw...';
    case 'gemstone': return 'Checking your gemstone recommendation...';
    case 'vastu': return 'Reviewing your Vastu report...';
    case 'palm': return 'Reading your palm analysis...';
    default: return 'Gathering your data...';
  }
}

function defaultFollowUps(feature: AssistantFeature | null, data: UserFeatureData): string[] {
  const out: string[] = [];
  if (feature === 'tarot' && data.tarot) out.push('What does my latest card mean?');
  if (feature === 'tarot' && data.tarotRecent.length >= 2) out.push('Compare my last two readings');
  if (feature === 'astrology' && data.astrology.profile) out.push("What's my moon sign?");
  if (feature === 'gemstone' && data.gemstone) out.push('Why was this gemstone recommended?');
  if (feature === 'vastu' && data.vastu) out.push('Which rooms in my property need attention?');
  if (feature === 'palm' && data.palm) out.push('What does my heart line suggest?');
  if (feature === 'palm' && data.palmRecent.length >= 2) out.push('Compare my last two palm readings');
  if (out.length === 0) out.push('What can you help me with?');
  return out;
}

/**
 * Shared general-knowledge answer path for tarot/gemstone/vastu/palm,
 * mirroring the astrology knowledge-base branch in buildAssistantReply
 * below: a conceptual question ("what is the Fool card", "what is the
 * heart line") is answered from real, typed reference content, grounded
 * with the same "use ONLY this content, never invent" instruction, rather
 * than requiring a personal reading/profile/report to exist first.
 */
async function answerFromReferenceContent(opts: {
  aiProvider: AiProvider;
  config: AssistantConfig;
  history: AssistantMessage[];
  message: string;
  feature: AssistantFeature;
  data: UserFeatureData;
  onStage?: OnStage;
  knowledgeBlock: string;
  fallbackText: string;
  stageLabel: string;
  intentDetectionMs: number;
  dataRetrievalMs: number;
  t0: number;
}): Promise<AssistantReplyResult> {
  const {
    aiProvider, config, history, message, feature, data, onStage,
    knowledgeBlock, fallbackText, stageLabel, intentDetectionMs, dataRetrievalMs, t0,
  } = opts;

  onStage?.({ key: 'data', label: stageLabel });
  const systemPrompt = buildAssistantSystemPrompt(config);
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content } as const)),
    {
      role: 'user',
      content:
        `Answer the user's general knowledge question using ONLY the real traditional reference content below - ` +
        `do not invent, add, or imply any claim beyond it. Keep the tone traditional/symbolic, never a guaranteed ` +
        `prediction, and never present this as the user's own personal reading unless their real data is also given.\n\n` +
        `=== REAL REFERENCE CONTENT - the only facts you may reference ===\n${knowledgeBlock}\n=== END REFERENCE CONTENT ===\n\n` +
        `User question: ${message}`,
    },
  ];

  onStage?.({ key: 'generation', label: 'Writing your answer...' });
  const generationStart = Date.now();
  let reply: string;
  let success = true;
  try {
    reply = await aiProvider.complete(messages, generationOptionsForMode('fast'));
    if (!reply.trim()) reply = fallbackText;
  } catch {
    success = isAiDisabled(aiProvider);
    reply = fallbackText; // honest static fallback: the real reference content itself, never fabricated
  }
  const generationMs = Date.now() - generationStart;

  return {
    reply,
    detectedFeature: feature,
    premiumCard: null,
    suggestedFollowUps: defaultFollowUps(feature, data),
    estimatedInputTokens: estimateTokens(systemPrompt + knowledgeBlock + message),
    estimatedOutputTokens: estimateTokens(reply),
    success,
    mode: 'fast',
    timings: { intentDetectionMs, dataRetrievalMs, generationMs, totalMs: Date.now() - t0 },
  };
}

/**
 * Core entitlement-aware response assembly. Never generates locked premium
 * content inline - when a premium upsell applies, the free portion is
 * answered from real data and a structured premiumCard is attached pointing
 * at the real existing premium endpoint/screen; the model is never asked to
 * produce the premium content itself.
 */
export async function buildAssistantReply(
  userId: string,
  message: string,
  history: AssistantMessage[],
  aiProvider: AiProvider,
  config: AssistantConfig,
  screenContext?: AssistantFeature,
  onStage?: OnStage,
  onChunk?: (text: string) => void,
  options: { aiEnabled?: boolean; fastOnly?: boolean; noAiNote?: string } = {},
): Promise<AssistantReplyResult> {
  const t0 = Date.now();
  // Free accounts get the same assistant but with NO AI call: every answer is built from the user's stored data and the
  // built-in reference content. The wrapped provider refuses to run, so each AI call site takes its existing
  // non-AI fallback path, and nothing is ever spent.
  const aiEnabled = options.aiEnabled !== false;
  if (!aiEnabled) aiProvider = NO_AI_PROVIDER;
  const freeNote = options.noAiNote ?? DEFAULT_FREE_NOTE;
  if (containsCrisisLanguage(message)) {
    return {
      reply: CRISIS_RESPONSE,
      detectedFeature: null,
      premiumCard: null,
      suggestedFollowUps: [],
      estimatedInputTokens: estimateTokens(message),
      estimatedOutputTokens: estimateTokens(CRISIS_RESPONSE),
      success: true,
      mode: null,
      timings: { totalMs: Date.now() - t0 },
    };
  }

  const notImplemented = mentionsUnimplementedFeature(message);
  if (notImplemented) {
    const reply = `Palm Setu doesn't have a ${notImplemented} feature yet, so this isn't something I can look up for you - it isn't a premium limitation, it simply hasn't been built.`;
    return {
      reply,
      detectedFeature: null,
      premiumCard: null,
      suggestedFollowUps: ['What can you help me with?'],
      estimatedInputTokens: estimateTokens(message),
      estimatedOutputTokens: estimateTokens(reply),
      success: true,
      mode: null,
      timings: { totalMs: Date.now() - t0 },
    };
  }

  onStage?.({ key: 'intent', label: 'Understanding your question...' });

  const intentStart = Date.now();
  // Fast path: the free keyword heuristic is instant and handles the common
  // case. Only when it finds nothing AND there is no screenContext hint do
  // we fall back to a second AI call to classify - that fallback is a real
  // extra network round-trip (seconds, not ms), so screenContext is checked
  // first to skip it whenever the hint alone can resolve the feature. The
  // screen the user opened the assistant from never overrides an explicit
  // match in the message text, and it carries no user data, just a feature
  // name, so it cannot leak anything premium on its own.
  let feature: AssistantFeature = detectFeatureHeuristic(message);
  // General astrology knowledge questions ("what does the 7th house mean",
  // "tell me about Scorpio") often don't contain any of FEATURE_KEYWORDS'
  // astrology words, so the plain heuristic above would misclassify them as
  // 'unknown'. Checking both systems' knowledge-base topic names here (sign/
  // rashi, house/bhava, planet/graha, nakshatra, dasha, concept) closes that
  // gap without touching FEATURE_KEYWORDS itself.
  if (feature === 'unknown' && (detectAstrologyTopic(message, 'vedic') || detectAstrologyTopic(message, 'western'))) {
    feature = 'astrology';
  }
  if (feature === 'unknown' && screenContext && screenContext !== 'unknown') {
    feature = screenContext;
  } else if (feature === 'unknown') {
    try {
      feature = await detectFeature(message, aiProvider);
    } catch {
      feature = 'unknown'; // classification must never crash the chat
    }
  }
  const intentDetectionMs = Date.now() - intentStart;

  onStage?.({ key: 'retrieval', label: 'Gathering your data...' });
  // Feature-scoped lookup once the feature is known (the common case) -
  // avoids scanning all five in-memory stores when only one is relevant.
  const retrievalStart = Date.now();
  const data = retrieveUserDataForFeature(feature, userId);
  const dataRetrievalMs = Date.now() - retrievalStart;

  if (feature === 'unknown') {
    // No personal/private user data is involved here at all (nothing was
    // retrieved, nothing could be invented about the user's chart/cards/
    // etc), so it's safe to let the model respond naturally instead of
    // repeating one hardcoded paragraph verbatim - that static string used
    // to fire identically even for plain conversational replies like "okay"
    // or "thanks", which reads as a broken, looping bot rather than an
    // assistant actually listening. This still never fabricates feature
    // data; it only decides HOW to phrase "I don't have a specific feature
    // to look up yet" / "got it, let me know when you're ready" naturally.
    onStage?.({ key: 'generation', label: 'Writing your answer...' });
    const fallbackReply =
      `I couldn't answer that just now. Please try again, or ask me about your tarot, astrology, gemstone, vastu or palm readings.`;

    // Real wellness summary (mood/habits/challenges/goals/discovery themes,
    // never raw journal text) - included here, rather than as a sixth
    // AssistantFeature branch, so a question like "how have I been feeling
    // this month" gets a real, grounded answer without restructuring the
    // tarot/astrology/gemstone/vastu/palm intent-detection pipeline. See
    // dataRetrieval.ts's buildWellnessSummary for exactly what this is built
    // from and what it deliberately omits (raw journal content).
    const wellnessContext = data.wellness.hasAnyData
      ? `\n\nReal wellness data on file for this user (you may use this ONLY to answer wellness-related questions ` +
        `like mood/habits/journaling/goals - never invent anything beyond these facts, and never diagnose):\n` +
        `Recent mood check-ins (most recent first, mood label only): ${data.wellness.recentMoods.map((m) => `${m.localDate}: ${m.mood}`).join(', ') || 'none'}.\n` +
        `Recent discovery themes (what has been on their mind, last 14 days): ${data.wellness.recentDiscoveryThemes.join(', ') || 'none'}.\n` +
        `Active habits: ${data.wellness.activeHabitNames.join(', ') || 'none'}.\n` +
        `Active challenges: ${data.wellness.activeChallenges.map((c) => `${c.challengeId} (day ${c.currentDay})`).join(', ') || 'none'}.\n` +
        `Active goals: ${data.wellness.activeGoalTitles.join(', ') || 'none'}.\n` +
        `Journal entries in the last 30 days: ${data.wellness.journalEntryCountLast30Days} (count only - you do not have access to their content).`
      : '';

    const astroProfile = data.astrology.profile;
    const astroContext = astroProfile
      ? `\n\nThe user's real astrology details (use these to give astrology-flavoured, practical answers about their day, ` +
        `plans or feelings - e.g. a meeting, interview, trip or decision - while never guaranteeing an outcome): ` +
        `moon sign ${astroProfile.natal.moonSignSidereal ?? astroProfile.natal.moonSignTropical} (${astroProfile.preferredSystem} system)` +
        `${data.astrology.latestHoroscope ? `; today's horoscope (${data.astrology.latestHoroscope.localDate}): ${data.astrology.latestHoroscope.summary}` : ''}.`
      : `\n\nThe user has no birth profile on file; for questions about their day or plans, answer practically and suggest ` +
        `adding their birth details for a more personal astrological view.`;

    const focusAreas = userIdentities.get(userId)?.focus ?? [];
    const focusContext = focusAreas.length
      ? `\n\nThe user told us they most want guidance on: ${focusAreas.join(', ')}. Lean towards these when it fits, without forcing them in.`
      : '';

    const smallTalkMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content:
          `${buildAssistantSystemPrompt(config)}\n\n` +
          `The user's last message did not point to one specific Palm Setu reading (tarot, astrology, gemstone, ` +
          `vastu, or palm). Answer it helpfully and directly like a knowledgeable, friendly general assistant: ` +
          `general knowledge, advice, explanations, writing, planning, small talk, and wellness questions are all ` +
          `fine - do not refuse a topic just because it is outside astrology or palmistry. Give a complete, useful ` +
          `answer (a few sentences, longer if the question needs it), and vary your phrasing from earlier replies. ` +
          `Wellness questions should use the real wellness data below when it is given. If the question is really ` +
          `about the user's OWN tarot cards, chart, gemstone, vastu or palm reading, ask which one they mean ` +
          `rather than guessing. Never invent personal chart data, card draws, palm features or details about the ` +
          `user that are not explicitly given to you, and keep to the safety rules above (no medical, legal or ` +
          `financial authority, no guarantees about the future). For questions about how something will go (a meeting, ` +
          `interview, date, exam, trip), answer in an astrology-informed, encouraging and practical way, make clear it is ` +
          `guidance rather than a prediction, and keep it brief.${astroContext}${focusContext}${wellnessContext}`,
      },
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content } as const)),
    ];

    let reply = fallbackReply;
    let success = true;
    const generationStart = Date.now();
    try {
      reply = await aiProvider.complete(smallTalkMessages, generationOptionsForMode('fast'));
      if (!reply.trim()) reply = fallbackReply;
    } catch {
      reply = isAiDisabled(aiProvider)
        ? `I can answer questions about your tarot, astrology, gemstone, vastu and palm readings, and explain cards, signs, houses, gemstones, directions and palm lines. Try asking "What is my moon sign?" or "What does the heart line mean?".${freeNote}`
        : fallbackReply; // honest static fallback, never a fabricated answer
    }
    const generationMs = Date.now() - generationStart;

    return {
      reply,
      detectedFeature: null,
      premiumCard: null,
      suggestedFollowUps: defaultFollowUps(null, data),
      estimatedInputTokens: estimateTokens(message),
      estimatedOutputTokens: estimateTokens(reply),
      success,
      mode: 'fast',
      timings: { intentDetectionMs, dataRetrievalMs, generationMs, totalMs: Date.now() - t0 },
    };
  }

  // General astrology knowledge questions (sign/rashi, house/bhava, planet/
  // graha, nakshatra, dasha, or core-concept meaning) are answered from the
  // real, researched, typed astrology knowledge base (see
  // astrology/knowledgeBase/) rather than requiring a birth profile on file
  // - "what does the 7th house mean" is a real question even for a user who
  // has never generated a chart. System-aware: a Vedic-preference user asking
  // about a sign gets Rashi-framed content, a Western-preference user gets
  // tropical-sign-framed content, and the two are never mixed into one
  // answer unless the user's message itself asks for a comparison.
  // "What is MY moon sign" / "what's my rising sign" are personal-chart
  // questions about this specific user's real computed placements - those
  // must keep going through the existing real-chart-data flow below (with
  // its full streaming support), never the generic knowledge-base lookup,
  // since a bare word like "moon" would otherwise also match the Moon
  // graha/planet knowledge entry and silently short-circuit a personal
  // question into a generic one.
  const isPersonalChartQuestion = /\bmy\b/.test(message.toLowerCase());
  if (feature === 'astrology' && !isPersonalChartQuestion) {
    const text = message.toLowerCase();
    const mentionsVedic = /\bvedic\b/.test(text);
    const mentionsWestern = /\bwestern\b/.test(text);
    const wantsComparison = (mentionsVedic && mentionsWestern) || /\bcompar/.test(text);
    const profileSystem = data.astrology.profile?.preferredSystem ?? null;

    // Default to Western framing only when the user genuinely gave us no
    // signal at all (no explicit system mention, no birth profile on file) -
    // a reasonable, clearly-labeled default for a generic knowledge
    // question, never presented as tied to a specific user's real chart.
    const resolvedSystem: 'vedic' | 'western' | null = wantsComparison
      ? null
      : mentionsVedic ? 'vedic'
      : mentionsWestern ? 'western'
      : profileSystem ?? 'western';

    if (!wantsComparison && resolvedSystem) {
      const topic = detectAstrologyTopic(message, resolvedSystem);
      const entry = topic ? getAstrologyKnowledge(topic, resolvedSystem) : undefined;
      if (entry) {
        onStage?.({ key: 'data', label: 'Consulting traditional astrology reference...' });
        const knowledgeBlock =
          `Traditional ${resolvedSystem === 'vedic' ? 'Vedic' : 'Western'} astrology reference entry for "${entry.name}" ` +
          `(category: ${entry.category}):\nSummary: ${entry.summary}\nDetailed: ${entry.detailed}\n` +
          (entry.rulingPlanet ? `Ruling planet: ${entry.rulingPlanet}\n` : '') +
          (entry.element ? `Element: ${entry.element}\n` : '') +
          (entry.modality ? `Modality: ${entry.modality}\n` : '') +
          (entry.traits && entry.traits.length ? `Traits: ${entry.traits.join(', ')}\n` : '') +
          `Limitations/what this does NOT mean: ${entry.limitations}`;

        const systemPrompt = buildAssistantSystemPrompt(config);
        const knowledgeMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-6).map((m) => ({ role: m.role, content: m.content } as const)),
          {
            role: 'user',
            content:
              `Answer the user's astrology knowledge question using ONLY the real traditional reference content below - ` +
              `do not invent, add, or imply any claim beyond it. Stay entirely within the ${resolvedSystem === 'vedic' ? 'Vedic' : 'Western'} ` +
              `tradition's framing and do not mix in the other system's terminology unless the user explicitly asked for a comparison. ` +
              `Keep the tone traditional/symbolic, never a guaranteed prediction.\n\n` +
              `=== REAL TRADITIONAL REFERENCE CONTENT - the only facts you may reference ===\n${knowledgeBlock}\n=== END REFERENCE CONTENT ===\n\n` +
              `User question: ${message}`,
          },
        ];

        onStage?.({ key: 'generation', label: 'Writing your answer...' });
        const generationStart = Date.now();
        let reply: string;
        let success = true;
        try {
          reply = await aiProvider.complete(knowledgeMessages, generationOptionsForMode('fast'));
          if (!reply.trim()) reply = entry.detailed;
        } catch {
          success = isAiDisabled(aiProvider);
          reply = entry.detailed; // honest static fallback: the real reference content itself, never fabricated
        }
        const generationMs = Date.now() - generationStart;

        return {
          reply,
          detectedFeature: feature,
          premiumCard: null,
          suggestedFollowUps: defaultFollowUps(feature, data),
          estimatedInputTokens: estimateTokens(systemPrompt + knowledgeBlock + message),
          estimatedOutputTokens: estimateTokens(reply),
          success,
          mode: 'fast',
          timings: { intentDetectionMs, dataRetrievalMs, generationMs, totalMs: Date.now() - t0 },
        };
      }
    }
    // No topic recognized in the knowledge base (or the user asked for a
    // cross-system comparison, which this pass deliberately keeps out of
    // scope) - fall through to the normal chart-data-based astrology flow
    // below, which requires a birth profile on file. This is the honest
    // "not grounded in specific reference content" fallback: the reply will
    // either come from the user's real chart data, or (if that is also
    // missing) the normal noDataMessage below.
  }

  // General tarot/gemstone/vastu/palm knowledge questions (card meaning,
  // gemstone tradition, direction meaning, palm line/feature meaning) are
  // answered from real reference content the same way astrology's is
  // above - "what is the Fool card" or "what is the heart line" are real
  // questions even for a user with no reading/profile/report on file yet.
  // Same "my"-guard as astrology: a personal question ("what does my
  // latest card mean") must keep going through the real-reading flow below,
  // never get short-circuited into a generic lookup.
  if (!isPersonalChartQuestion) {
    if (feature === 'tarot') {
      const card = detectTarotCard(message);
      if (card) {
        const knowledgeBlock =
          `Tarot reference for "${card.name}" (${card.arcana} arcana${card.suit ? `, suit of ${card.suit}` : ''}):\n` +
          `Upright keywords: ${card.uprightKeywords.join(', ')}\nReversed keywords: ${card.reversedKeywords.join(', ')}\n` +
          `General meaning: ${card.general}\nSymbolism: ${card.symbolism}\nReflection prompt: ${card.reflectionPrompt}`;
        return answerFromReferenceContent({
          aiProvider, config, history, message, feature, data, onStage,
          knowledgeBlock, fallbackText: card.general, stageLabel: 'Consulting the tarot catalogue...',
          intentDetectionMs, dataRetrievalMs, t0,
        });
      }
    }

    if (feature === 'gemstone') {
      const planet = detectGemstonePlanet(message);
      if (planet) {
        const g = buildGemstoneDefinition(planet);
        const knowledgeBlock =
          `Traditional gemstone reference for ${g.nameEnglish} (${g.nameHindi}), associated with ${planet}:\n` +
          `Traditional day to wear: ${g.traditionalDay}\nTraditional finger: ${g.traditionalFinger}\n` +
          `Traditional metal: ${g.traditionalMetal}\nCustomary practice: ${g.customaryPractice}\n` +
          `Alternative stone: ${g.alternativeName} (never astrologically equivalent to the primary stone).\n` +
          `Limitations: this is a traditional astrological association only, never a medical, financial, or guaranteed-outcome claim.`;
        return answerFromReferenceContent({
          aiProvider, config, history, message, feature, data, onStage,
          knowledgeBlock, fallbackText: g.customaryPractice, stageLabel: 'Consulting gemstone tradition...',
          intentDetectionMs, dataRetrievalMs, t0,
        });
      }
    }

    if (feature === 'vastu') {
      const direction = detectVastuDirection(message);
      if (direction) {
        const entry = getDirectionEntry(direction);
        const knowledgeBlock =
          `Traditional Vastu reference for the ${entry.label} direction${entry.sanskritName ? ` (${entry.sanskritName})` : ''}:\n` +
          `Traditional association: ${entry.traditionalAssociation}\nRecommendations: ${entry.recommendations.join('; ')}\n` +
          `Best for home: ${entry.bestForHome.join(', ') || 'none specifically documented'}\n` +
          `Best for work: ${entry.bestForWork.join(', ') || 'none specifically documented'}\n` +
          `Limitations: ${entry.limitations}\nSource: ${entry.sourceReference}`;
        return answerFromReferenceContent({
          aiProvider, config, history, message, feature, data, onStage,
          knowledgeBlock, fallbackText: entry.traditionalAssociation, stageLabel: 'Consulting Vastu reference...',
          intentDetectionMs, dataRetrievalMs, t0,
        });
      }
    }

    if (feature === 'palm') {
      const category = detectPalmCategory(message);
      if (category) {
        // No single "general" entry per category exists in this knowledge
        // base (only per-variation ones, e.g. "heart-line-long",
        // "heart-line-short") - picking just one variation and presenting
        // it as THE definition would misrepresent the real content. Instead,
        // a handful of real variations are summarized together, honestly
        // framed as "this is one of several forms, here is what a few of
        // them traditionally mean" rather than a single verdict.
        const entries = getKnowledgeEntriesByCategory(category).slice(0, 4);
        if (entries.length > 0) {
          const knowledgeBlock =
            `Traditional palmistry reference for this feature - it can appear in different forms, each with its own ` +
            `traditional meaning (the user's own palm reading would show which form actually applies to them):\n` +
            entries.map((e) => `- ${e.featureName}: ${e.traditionalMeaning}`).join('\n') +
            `\nLimitations: ${entries[0].limitations}`;
          return answerFromReferenceContent({
            aiProvider, config, history, message, feature, data, onStage,
            knowledgeBlock, fallbackText: entries[0].traditionalMeaning, stageLabel: 'Consulting palmistry reference...',
            intentDetectionMs, dataRetrievalMs, t0,
          });
        }
      }
    }
  }

  if (!hasDataFor(feature, data)) {
    const reply = noDataMessage(feature, config);
    return {
      reply,
      detectedFeature: feature,
      premiumCard: null,
      suggestedFollowUps: defaultFollowUps(feature, data),
      estimatedInputTokens: estimateTokens(message),
      estimatedOutputTokens: estimateTokens(reply),
      success: true,
      mode: null,
      timings: { intentDetectionMs, dataRetrievalMs, totalMs: Date.now() - t0 },
    };
  }

  // Real data for this feature genuinely exists at this point (hasDataFor
  // passed above), so it is now safe to show a feature-specific stage label.
  onStage?.({ key: 'data', label: dataStageLabel(feature) });

  const entitlement = evaluateEntitlement(userId, feature, data, config.premiumRecommendationCopy);
  onStage?.({ key: 'entitlement', label: 'Checking your plan...' });

  // Lightweight rule-based mode classification - no extra AI call, see
  // modeClassifier.ts. This only tunes reasoning budget/output length for
  // the reply that is about to be generated below; it never changes what
  // data is shown or bypasses the entitlement check above.
  const mode = options.fastOnly ? 'fast' : classifyMode(message, entitlement.hasPremiumUpsell);
  const generationOptions = generationOptionsForMode(mode);

  const freeDataSummary = describeFreeData(feature, data);
  const systemPrompt = buildAssistantSystemPrompt(config);

  // Historical memory retrieval (Priority 3): cheap SQL keyword/feature/
  // recency ranking, never a second AI call, never raw report content - see
  // memoryService.ts. Premium-safety is enforced at write time (every
  // summary saved there is already free-tier-safe, the same facts
  // describeFreeData() above would show a free user), so no separate
  // current-entitlement re-check is needed on the read path here.
  const memories = retrieveRelevantMemories(userId, message, feature, 5);
  const historicalMemorySummary = memories.length
    ? memories.map((m) => `- [${m.createdAt.slice(0, 10)}] ${m.summary}`).join('\n')
    : null;

  const contextualInstruction = entitlement.hasPremiumUpsell
    ? mode === 'premium_report'
      ? 'Answer fully using ONLY the free data given below, and clearly point the user to the specific premium report/feature that unlocks the rest - a separate premium card will also be shown, so do not try to replicate or preview that premium content yourself.'
      : 'Answer fully using ONLY the free data given below. Do not generate or imply the deeper premium-only content - a separate premium card will be shown to the user, so do not try to replicate or preview that premium content yourself.'
    : mode === 'deep_analysis'
      ? 'The user wants a more thorough, detailed answer. Answer fully using ONLY the data given below, going deeper into the implications of that data than a one-line answer would, while still never inventing facts beyond it.'
      : 'Answer fully using ONLY the data given below.';

  const promptMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content } as const)),
    {
      role: 'user',
      content:
        `${contextualInstruction}\n\n` +
        `=== REAL USER DATA (${feature}) - the only facts you may reference ===\n${freeDataSummary}\n=== END REAL USER DATA ===\n\n` +
        (historicalMemorySummary
          ? `=== REAL HISTORICAL RECORDS for this user (with their real dates) - you may reference these for ` +
            `questions about past readings, but never invent dates/cards/facts beyond what is literally listed ===\n${historicalMemorySummary}\n=== END HISTORICAL RECORDS ===\n\n`
          : '') +
        `Ground your entire answer in exactly the facts between the markers above. Do not invent, assume, or add any ` +
        `chart points, card names, numbers, directions, or details that are not literally present there. If the user asks ` +
        `about something the data above does not cover, say plainly that you do not have that specific detail on file, ` +
        `rather than filling the gap with generic or invented advice.\n\n` +
        `Answer directly and concisely: lead with the direct answer, use short paragraphs, and do not repeat the same ` +
        `disclaimer in every message. If more depth would help, mention briefly that you can go deeper rather than ` +
        `writing the long version by default.\n\n` +
        `User question: ${message}`,
    },
  ];

  onStage?.({ key: 'generation', label: 'Writing your answer...' });

  const generationStart = Date.now();
  let timeToFirstTokenMs: number | undefined;
  const wrappedOnChunk = onChunk
    ? (text: string) => {
        if (timeToFirstTokenMs === undefined) timeToFirstTokenMs = Date.now() - generationStart;
        onChunk(text);
      }
    : undefined;

  let reply: string;
  let success = true;
  try {
    if (wrappedOnChunk && typeof aiProvider.streamComplete === 'function') {
      reply = await aiProvider.streamComplete(promptMessages, wrappedOnChunk, generationOptions);
    } else {
      reply = await aiProvider.complete(promptMessages, generationOptions);
      // Provider can't stream (e.g. Mock/Anthropic today) - emit the full
      // reply as a single chunk so streaming callers still receive the text.
      wrappedOnChunk?.(reply);
    }
  } catch {
    if (isAiDisabled(aiProvider)) {
      reply = describeForUser(feature, data) + freeNote;
      wrappedOnChunk?.(reply);
    } else {
      success = false;
      reply = 'I ran into an issue generating a response just now - please try again in a moment.';
    }
  }
  const generationMs = Date.now() - generationStart;

  // Fire-and-forget durable-fact extraction: cheap rule-based pattern match
  // (not an AI call), run after the reply is already computed so it never
  // delays the user-facing response. Swallow any error - never let
  // best-effort memory bookkeeping break the chat.
  try {
    extractAndStoreFacts(userId, message, null);
  } catch { /* never let memory extraction break the chat */ }

  return {
    reply,
    detectedFeature: feature,
    mode,
    premiumCard: entitlement.premiumCard,
    suggestedFollowUps: defaultFollowUps(feature, data),
    estimatedInputTokens: estimateTokens(systemPrompt + freeDataSummary + message),
    estimatedOutputTokens: estimateTokens(reply),
    success,
    timings: { intentDetectionMs, dataRetrievalMs, timeToFirstTokenMs, generationMs, totalMs: Date.now() - t0 },
  };
}
