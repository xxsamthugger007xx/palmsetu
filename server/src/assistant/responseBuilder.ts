import { AiProvider } from '../ai/types';
import { AssistantFeature, AssistantMessage } from '../data/store';
import { AssistantConfig } from '../data/assistantConfig';
import { buildAssistantSystemPrompt } from './systemPrompts';
import { detectFeature, detectFeatureHeuristic } from './intentDetection';
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
): Promise<AssistantReplyResult> {
  const t0 = Date.now();
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
    const reply = `Solune doesn't have a ${notImplemented} feature yet, so this isn't something I can look up for you - it isn't a premium limitation, it simply hasn't been built.`;
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
      `I can help with tarot, astrology, gemstone, vastu, or palm questions using your real Solune data. ` +
      `Could you tell me which of those this is about?`;

    const smallTalkMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content:
          `${buildAssistantSystemPrompt(config)}\n\n` +
          `The user's last message did not clearly point to a specific Solune feature (tarot, astrology, gemstone, ` +
          `vastu, or palm) - it may be small talk, an acknowledgment like "okay" or "thanks", or a genuinely unrelated ` +
          `question. Reply briefly and naturally, in one short message. Do not repeat the exact same sentence you may ` +
          `have used earlier in this conversation - vary your phrasing. If it's small talk or an acknowledgment, ` +
          `respond warmly and briefly. If it seems like a real question outside tarot/astrology/gemstone/vastu/palm, ` +
          `say plainly that you can only help with those five areas right now. Never invent chart data, card names, ` +
          `or personal details - you have none to reference here. Keep it to 1-2 sentences.`,
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
      reply = fallbackReply; // honest static fallback, never a fabricated answer
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
  const mode = classifyMode(message, entitlement.hasPremiumUpsell);
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
    success = false;
    reply = 'I ran into an issue generating a response just now - please try again in a moment.';
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
