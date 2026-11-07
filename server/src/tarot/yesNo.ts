import { Orientation, Rank, YesNoTendency } from '../types/tarot';

/**
 * Traditional (simplified) Major Arcana yes/no leanings, as commonly used in
 * quick single-card yes/no tarot practice. This is a well-known
 * simplification of each card's broad traditional nature, not a universal or
 * authoritative rule - genuinely divinatory yes/no tarot varies by tradition
 * and deck, which is why the response also always surfaces the card's real
 * traditional meaning (context/advice) alongside the tendency, rather than
 * presenting the tendency alone as a certainty.
 */
const MAJOR_TENDENCY: Record<string, YesNoTendency> = {
  'major-00-the-fool': 'yes',
  'major-01-the-magician': 'yes',
  'major-02-the-high-priestess': 'uncertain',
  'major-03-the-empress': 'yes',
  'major-04-the-emperor': 'yes',
  'major-05-the-hierophant': 'uncertain',
  'major-06-the-lovers': 'yes',
  'major-07-the-chariot': 'yes',
  'major-08-strength': 'yes',
  'major-09-the-hermit': 'no',
  'major-10-wheel-of-fortune': 'uncertain',
  'major-11-justice': 'uncertain',
  'major-12-the-hanged-man': 'no',
  'major-13-death': 'no',
  'major-14-temperance': 'uncertain',
  'major-15-the-devil': 'no',
  'major-16-the-tower': 'no',
  'major-17-the-star': 'yes',
  'major-18-the-moon': 'uncertain',
  'major-19-the-sun': 'yes',
  'major-20-judgement': 'yes',
  'major-21-the-world': 'yes',
};

/**
 * Traditional (simplified) Minor Arcana yes/no leaning by rank, applied the
 * same way across all four suits - another common simplification in quick
 * yes/no practice (rank generally matters more than suit for this specific
 * purpose, since rank tracks a situation's stage of development).
 */
const RANK_TENDENCY: Record<Rank, YesNoTendency> = {
  ace: 'yes',
  two: 'uncertain',
  three: 'yes',
  four: 'uncertain',
  five: 'no',
  six: 'yes',
  seven: 'uncertain',
  eight: 'yes',
  nine: 'uncertain',
  ten: 'yes',
  page: 'uncertain',
  knight: 'yes',
  queen: 'yes',
  king: 'yes',
};

function flip(t: YesNoTendency): YesNoTendency {
  if (t === 'yes') return 'no';
  if (t === 'no') return 'yes';
  return 'uncertain';
}

/**
 * Computes the traditional yes/no tendency for a single drawn card. Reversal
 * traditionally inverts a clear yes/no lean (a blocked "yes" reads as "no"
 * and vice versa) but an already-uncertain card stays uncertain - reversing
 * ambiguity doesn't traditionally produce certainty.
 */
export function computeYesNoTendency(
  cardId: string,
  orientation: Orientation,
  rank: Rank | null,
): YesNoTendency {
  const base = cardId in MAJOR_TENDENCY ? MAJOR_TENDENCY[cardId] : rank ? RANK_TENDENCY[rank] : 'uncertain';
  return orientation === 'reversed' ? flip(base) : base;
}
