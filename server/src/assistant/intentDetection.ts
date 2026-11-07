import { AiProvider } from '../ai/types';
import { AssistantFeature } from '../data/store';

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
