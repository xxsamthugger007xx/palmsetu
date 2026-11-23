import { AiProvider } from '../ai/types';
import { AssistantFeature } from '../data/store';
import { getAllAstrologyKnowledgeEntries } from '../astrology/knowledgeBase/knowledgeBaseService';
import { AstrologySystemId } from '../astrology/knowledgeBase/types';
import { tarotCatalogue } from '../tarot/catalogue';
import { TarotCard } from '../types/tarot';
import { allGemstoneDefinitions } from '../gemstone/recommendationEngine';
import { GemstonePlanet } from '../types/gemstone';
import { listDirections } from '../vastu/knowledgeEngine';
import { Direction } from '../types/vastu';
import { KnowledgeEntry } from '../palmistry/knowledgeBase/types';

/**
 * Intent/feature detection for the assistant.
 *
 * DESIGN CHOICE: keyword/heuristic matching, not an AI classification call.
 * Reasoning: MockProvider (used whenever ANTHROPIC_API_KEY is unset, which is
 * the default dev/test setup for this repo per server/src/index.ts) just
 * echoes the prompt back - it cannot actually classify anything, so an
 * AI-based classifier would silently degrade to "always unknown" in the exact
 * environment this is most likely to be exercised and tested in. A small
 * deterministic keyword matcher is reliable, free, instant, and testable,
 * and degrades gracefully by design (unmatched input -> 'unknown', never a
 * thrown error), satisfying the "must not crash the whole chat" requirement
 * without depending on the AiProvider at all for this step.
 */
const FEATURE_KEYWORDS: Record<Exclude<AssistantFeature, 'unknown'>, string[]> = {
  tarot: ['tarot', 'card reading', 'the cards', 'my cards', 'spread', 'arcana'],
  astrology: [
    'astrology', 'horoscope', 'birth chart', 'natal', 'zodiac', 'rashi', 'nakshatra',
    'moon sign', 'sun sign', 'vedic', 'transit', 'daily reading', 'compatibility', 'partner',
  ],
  gemstone: ['gemstone', 'gem stone', 'ruby', 'sapphire', 'emerald', 'pearl', 'coral', 'stone recommendation', 'birthstone'],
  vastu: ['vastu', 'feng shui', 'house direction', 'room direction', 'entrance direction', 'kitchen direction', 'property'],
  palm: ['palm', 'palmistry', 'heart line', 'head line', 'life line', 'fate line'],
};

export function detectFeatureHeuristic(message: string): AssistantFeature {
  const text = message.toLowerCase();
  let best: AssistantFeature = 'unknown';
  let bestScore = 0;
  for (const [feature, keywords] of Object.entries(FEATURE_KEYWORDS) as [Exclude<AssistantFeature, 'unknown'>, string[]][]) {
    const score = keywords.reduce((sum, kw) => (text.includes(kw) ? sum + 1 : sum), 0);
    if (score > bestScore) {
      bestScore = score;
      best = feature;
    }
  }
  return best;
}

/**
 * Best-effort AI-assisted classification, used only as a secondary signal
 * when the heuristic finds nothing (bestScore 0 -> 'unknown'). Any failure
 * (thrown error, unparseable reply, mock echo) falls back to 'unknown'
 * rather than throwing, so a classification failure never crashes the chat.
 */
export async function detectFeature(message: string, aiProvider: AiProvider): Promise<AssistantFeature> {
  const heuristic = detectFeatureHeuristic(message);
  if (heuristic !== 'unknown') return heuristic;

  try {
    const reply = await aiProvider.complete([
      {
        role: 'system',
        content:
          'Classify the user message into exactly one of: tarot, astrology, gemstone, vastu, palm, unknown. ' +
          'Reply with only that single word, nothing else.',
      },
      { role: 'user', content: message },
    ]);
    const word = reply.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z]/g, '');
    if (word === 'tarot' || word === 'astrology' || word === 'gemstone' || word === 'vastu' || word === 'palm') {
      return word;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Lightweight astrology-knowledge topic detector: scans the user's message
 * for any sign/rashi, house/bhava, planet/graha, nakshatra, or dasha name
 * (or alias) that exists in the astrology knowledge base for the given
 * system, and returns the longest matching alias/name - the same string
 * getAstrologyKnowledge() in knowledgeBaseService.ts can then look up.
 * Deterministic, no AI call, same keyword-matching design choice as
 * detectFeatureHeuristic() above. Returns null when nothing matches, which
 * callers must treat as an honest "no known topic detected" signal.
 */
export function detectAstrologyTopic(message: string, system: AstrologySystemId): string | null {
  const text = message.toLowerCase();
  const entries = getAllAstrologyKnowledgeEntries().filter((e) => e.system === system);

  let best: string | null = null;
  let bestLength = 0;
  for (const entry of entries) {
    const needles = [entry.name.toLowerCase(), ...entry.aliases.map((a) => a.toLowerCase())];
    for (const needle of needles) {
      // Strip parenthetical qualifiers like " (aries)" from compound names
      // so a plain alias match (already present in `aliases`) is what's
      // actually tested against the raw message text.
      const cleaned = needle.replace(/\s*\(.*?\)\s*/g, '').trim();
      if (cleaned.length >= 3 && text.includes(cleaned) && cleaned.length > bestLength) {
        best = cleaned;
        bestLength = cleaned.length;
      }
    }
  }
  return best;
}

/**
 * General-knowledge topic detectors for tarot/gemstone/vastu/palm, same
 * deterministic keyword-matching design as detectAstrologyTopic above (no
 * AI call, "no match" -> null is an honest signal, never a guess). These
 * let a conceptual question ("what is the heart line", "what is the Fool
 * card") be answered from real reference content even when the user has no
 * personal reading/profile/report on file yet - see responseBuilder.ts for
 * how each is wired into the reply pipeline.
 */

/** Matches a tarot card by name, e.g. "the fool", "ace of wands". Prefers
 * the longest matching name so "the sun" doesn't win over "the sun
 * reversed" (not a real card id, but the longest-match rule is cheap
 * insurance against any such future card-name overlap). */
export function detectTarotCard(message: string): TarotCard | null {
  const text = message.toLowerCase();
  let best: TarotCard | null = null;
  let bestLength = 0;
  for (const card of tarotCatalogue) {
    const name = card.name.toLowerCase();
    const bare = name.replace(/^the\s+/, '');
    for (const needle of [name, bare]) {
      if (needle.length >= 3 && text.includes(needle) && needle.length > bestLength) {
        best = card;
        bestLength = needle.length;
      }
    }
  }
  return best;
}

const PLANET_ALIASES: Record<GemstonePlanet, string[]> = {
  Sun: ['sun'], Moon: ['moon'], Mars: ['mars'], Mercury: ['mercury'], Jupiter: ['jupiter'],
  Venus: ['venus'], Saturn: ['saturn'], Rahu: ['rahu'], Ketu: ['ketu'],
};

/** Matches a gemstone by its own name (e.g. "ruby", "blue sapphire") or by
 * the planet it is traditionally associated with (e.g. "saturn's gemstone"). */
export function detectGemstonePlanet(message: string): GemstonePlanet | null {
  const text = message.toLowerCase();
  let best: GemstonePlanet | null = null;
  let bestLength = 0;
  for (const def of allGemstoneDefinitions()) {
    const needles = [
      def.nameEnglish.toLowerCase(), def.nameHindi.toLowerCase(), def.alternativeName.toLowerCase(),
      ...PLANET_ALIASES[def.planet],
    ];
    for (const needle of needles) {
      if (needle.length >= 3 && text.includes(needle) && needle.length > bestLength) {
        best = def.planet;
        bestLength = needle.length;
      }
    }
  }
  return best;
}

/** Matches a vastu direction by its label or Sanskrit name (e.g.
 * "northeast", "ishan corner"). Checks longer/more specific labels (e.g.
 * "Northeast") before their substrings (e.g. "North", "East") so a compound
 * direction is never mis-split into its two component directions. */
export function detectVastuDirection(message: string): Direction | null {
  const text = message.toLowerCase();
  const entries = [...listDirections()].sort((a, b) => b.label.length - a.label.length);
  for (const entry of entries) {
    const needles = [entry.label.toLowerCase(), ...(entry.sanskritName ? [entry.sanskritName.toLowerCase()] : [])];
    if (needles.some((n) => text.includes(n))) return entry.code;
  }
  return null;
}

const PALM_CATEGORY_KEYWORDS: Record<KnowledgeEntry['category'], string[]> = {
  heartLine: ['heart line'],
  headLine: ['head line'],
  lifeLine: ['life line'],
  fateLine: ['fate line'],
  minorLine: ['sun line', 'mercury line', 'girdle of venus', 'bracelet', 'minor line'],
  mount: ['mount of venus', 'mount of jupiter', 'mount of saturn', 'mount of sun', 'mount of mercury', 'mount of mars', 'mount of moon', 'mount'],
  finger: ['index finger', 'middle finger', 'ring finger', 'little finger', 'pinky finger', 'finger length', 'finger'],
  thumb: ['thumb'],
  nail: ['nail shape', 'nails', 'fingernail'],
  handShape: ['hand shape', 'square hand', 'earth hand', 'air hand', 'water hand', 'fire hand', 'conic hand', 'spatulate hand'],
  marking: ['star on', 'cross on', 'triangle on', 'grille on', 'island on', 'palm marking'],
};

/** Matches a palmistry feature category (e.g. "heart line", "mount of
 * venus") from the message text. Unlike the other three detectors above,
 * this resolves to a CATEGORY, not one specific knowledge-base entry -
 * the palmistry knowledge base has no single "general" entry per category,
 * only per-variation ones (see getKnowledgeEntriesByCategory in
 * responseBuilder.ts for how a category answer is synthesized from those). */
export function detectPalmCategory(message: string): KnowledgeEntry['category'] | null {
  const text = message.toLowerCase();
  let best: KnowledgeEntry['category'] | null = null;
  let bestLength = 0;
  for (const [category, keywords] of Object.entries(PALM_CATEGORY_KEYWORDS) as [KnowledgeEntry['category'], string[]][]) {
    for (const kw of keywords) {
      if (text.includes(kw) && kw.length > bestLength) {
        best = category;
        bestLength = kw.length;
      }
    }
  }
  return best;
}
