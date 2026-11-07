import { BirthProfile } from '../types/astrology';
import { Orientation, TarotCard, TarotInterpretation } from '../types/tarot';

/**
 * Personalizes the FREE daily card's interpretation text using the user's
 * saved astrology profile, if one exists - never changes which card was
 * drawn (that stays a genuinely unbiased crypto-shuffle draw, see
 * drawService.ts). When no profile exists, returns an honest,
 * clearly-labeled non-personalized version rather than fabricating birth
 * details - matching the pattern already used by astrology/horoscopeService.ts
 * for grounding content strictly in real saved data.
 */
export function personalizeDailyInterpretation(
  interpretation: TarotInterpretation,
  card: TarotCard,
  orientation: Orientation,
  profile: BirthProfile | null,
): TarotInterpretation {
  if (!profile) {
    return {
      ...interpretation,
      personalized: false,
      personalizedNote:
        'This is a non-personalized daily card. Add your birth details in the Astrology section to see today\'s card framed around your own chart.',
    };
  }

  const sunSign = profile.natal.sunSignTropical;
  const moonSign = profile.preferredSystem === 'vedic' ? profile.natal.moonSignSidereal : profile.natal.moonSignTropical;
  const keyword = (orientation === 'upright' ? card.uprightKeywords[0] : card.reversedKeywords[0]) ?? 'this theme';

  const personalizedNote =
    `With your ${sunSign} Sun and ${moonSign} Moon, today's ${card.name} (${orientation}) is worth reading through that lens: ` +
    `notice where ${keyword} shows up in how you're moving through the day, and where your ${sunSign} nature and ${moonSign} emotional tone ` +
    `either reinforce or push back against it.`;

  return { ...interpretation, personalized: true, personalizedNote };
}
