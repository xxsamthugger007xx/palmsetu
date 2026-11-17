import { SoulmateAgeRange, SoulmateGender, SoulmateStyle } from '../types/soulmate';

/**
 * Local, template-based personality/compatibility text - NO AI text-
 * generation call of any kind. Replaces the earlier AI-authored version;
 * every description and trait below is a prewritten, hand-authored string,
 * deterministically combined from the user's own questionnaire answers.
 * Entertainment only - see the disclaimer every client screen shows
 * alongside the result.
 */

export interface SoulmatePersonality {
  description: string;
  traits: string[];
}

const GENDER_WORD: Record<SoulmateGender, string> = {
  male: 'he',
  female: 'she',
  'no-preference': 'they',
};

const AGE_FLAVOR: Record<SoulmateAgeRange, string> = {
  '18-24': 'a spirited, curious energy, still discovering exactly who they want to become',
  '25-30': 'an ambitious, grounded energy, building a life they are genuinely proud of',
  '31-35': 'a settled, self-assured energy, comfortable in their own skin',
  '36-40': 'a steady, generous energy, shaped by years of real experience',
  '40+': 'a wise, unhurried energy, having long since stopped chasing things that do not matter',
};

const STYLE_FLAVOR: Record<SoulmateStyle, string> = {
  pencil: 'quietly detail-oriented, the kind of person who notices the small things',
  charcoal: 'intense and a little mysterious, with feelings that run deep beneath a calm surface',
  'soft-portrait': 'gentle and warm, someone who puts others at ease almost immediately',
};

const TRAIT_BANK: string[] = [
  'Likely to value honest, calm communication over drama.',
  'Brings a playful, grounding energy to everyday moments.',
  'Compatibility here leans on shared trust and mutual respect.',
  'Tends to show love through small, consistent gestures rather than grand ones.',
  'Finds comfort in routine, but keeps room for spontaneity.',
  'Communicates feelings directly instead of letting things build up.',
  'Draws energy from quiet one-on-one time rather than big crowds.',
  'Takes commitments seriously once trust has genuinely been earned.',
  'Enjoys a good debate, but never holds a grudge afterward.',
  'Notices when you are having an off day before you even say anything.',
  'Prefers steady, dependable affection over dramatic gestures.',
  'Has a dry sense of humor that grows on you slowly.',
];

/** Simple string hash so the same questionnaire answers deterministically
 * pick the same flavor text and trait set - no randomness needed, and no
 * external call of any kind. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function generateSoulmatePersonality(params: {
  preferredGender: SoulmateGender;
  preferredAgeRange: SoulmateAgeRange;
  preferredCountry: string;
  style: SoulmateStyle;
}): SoulmatePersonality {
  const pronoun = GENDER_WORD[params.preferredGender];
  const ageFlavor = AGE_FLAVOR[params.preferredAgeRange];
  const styleFlavor = STYLE_FLAVOR[params.style];

  const description =
    `This imagined connection carries ${ageFlavor}. ` +
    `Beyond that, ${pronoun} comes across as ${styleFlavor} - the kind of presence that tends to make ` +
    `a relationship feel easy rather than effortful.`;

  const seed = hashString(`${params.preferredGender}|${params.preferredAgeRange}|${params.preferredCountry}|${params.style}`);
  const traits: string[] = [];
  const used = new Set<number>();
  let i = seed;
  while (traits.length < 3) {
    const idx = i % TRAIT_BANK.length;
    if (!used.has(idx)) {
      used.add(idx);
      traits.push(TRAIT_BANK[idx]);
    }
    i = (i * 7 + 13) >>> 0;
  }

  return { description, traits };
}
