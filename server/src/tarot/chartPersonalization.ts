import { BirthProfile } from '../types/astrology';
import { TarotDraw } from '../types/tarot';
import { getCardOrThrow } from './catalogue';

/**
 * Optional birth-chart personalisation layer for a FULL reading's premium
 * detailed report - entirely separate from which cards were drawn (that
 * stays a genuinely unbiased crypto-shuffle draw, see drawService.ts, and
 * is never influenced by birth data). This only adds a distinct,
 * clearly-labeled perspective section built from the user's own saved,
 * already-calculated chart (profile.natal), reusing the same
 * engine/astrology/engine.ts output the Astrology section itself displays -
 * never a new or AI-invented calculation. Deterministic and AI-free, so it
 * costs nothing extra to attach.
 *
 * Returns null when no birth profile exists - the caller omits the section
 * entirely rather than fabricating one, matching the honest-fallback
 * convention used throughout this app (see dailyPersonalization.ts).
 */
export function buildBirthChartPerspective(draws: TarotDraw[], profile: BirthProfile | null): string | null {
  if (!profile) return null;

  const sunSign = profile.natal.sunSignTropical;
  const moonSign = profile.preferredSystem === 'vedic' ? profile.natal.moonSignSidereal : profile.natal.moonSignTropical;
  const systemLabel = profile.preferredSystem === 'vedic' ? 'Vedic' : 'Western';

  const keywordLines = draws.slice(0, 3).map((d) => {
    const card = getCardOrThrow(d.cardId);
    const keyword = (d.orientation === 'upright' ? card.uprightKeywords[0] : card.reversedKeywords[0]) ?? card.name;
    return `${d.positionName}'s ${card.name} (${keyword})`;
  });

  return (
    `This is a separate, optional perspective from your ${systemLabel} birth chart (Sun in ${sunSign}, Moon in ${moonSign}) - ` +
    `it does not change which cards were drawn, only offers another lens on them. Consider ${keywordLines.join(', ')} alongside ` +
    `your ${sunSign} Sun and ${moonSign} Moon: where does your chart's own nature reinforce what the cards are pointing to, and ` +
    `where might it pull you in a different direction?`
  );
}
