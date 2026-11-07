import { TarotDraw } from '../types/tarot';

export interface CardCombination {
  /** Card ids involved, order-independent. A match requires ALL of these ids
   * to be present among the reading's drawn cards (regardless of position or
   * orientation - combination knowledge in tarot tradition is about which
   * cards appear together, not their individual orientation). */
  cardIds: string[];
  interpretation: string;
  /** Always 'traditional' - every entry here is a well-established pairing
   * drawn from common tarot teaching, never invented for this app. This
   * field exists so the AI prompt and any future UI can label it honestly
   * and distinguish it from an AI-synthesized relational reading. */
  source: 'traditional';
}

/**
 * Curated knowledge base of established Tarot card combinations. This is
 * deliberately small and sourced, not exhaustive - it covers Major-Major,
 * Major-Minor and suit-pair interactions that are widely taught, so the AI
 * has a fixed, non-fabricated anchor to incorporate when a drawn spread
 * happens to contain one of these pairs. When no entry matches, the AI may
 * synthesize its own relational reading from individual card meanings (see
 * interpretationService.ts), but must label that synthesis as its own,
 * never as an established combination.
 */
export const CARD_COMBINATIONS: CardCombination[] = [
  {
    cardIds: ['major-06-the-lovers', 'minor-cups-two'],
    interpretation: 'A strong, traditionally harmonious pairing: both cards point to a genuine union, mutual attraction, or a meaningful choice made from the heart. Together they reinforce a reading of real emotional connection rather than mere attraction.',
    source: 'traditional',
  },
  {
    cardIds: ['major-16-the-tower', 'major-17-the-star'],
    interpretation: 'A classic traditional sequence: sudden upheaval or the collapse of something unsustainable (The Tower), followed by hope, healing and renewal (The Star). Read together, they suggest that the disruption is the necessary clearing before something gentler can take root.',
    source: 'traditional',
  },
  {
    cardIds: ['major-18-the-moon', 'minor-swords-seven'],
    interpretation: 'Both cards traditionally relate to confusion, deception or things not being fully seen. Together they strengthen a reading of illusion, half-truths, or a situation where not everything has been disclosed - worth more time and clarity before acting.',
    source: 'traditional',
  },
  {
    cardIds: ['major-19-the-sun', 'minor-cups-ten'],
    interpretation: 'A traditionally very positive pairing: joy, vitality and success (The Sun) combined with lasting emotional fulfillment and family/relational happiness (Ten of Cups). Together they point to a genuinely contented, harmonious outcome.',
    source: 'traditional',
  },
  {
    cardIds: ['major-13-death', 'major-21-the-world'],
    interpretation: 'A traditional "ending into completion" pairing: Death marks the close of one chapter, and The World marks the fulfillment of a full cycle. Together they suggest a definitive ending that is also a genuine, satisfying completion rather than a loss.',
    source: 'traditional',
  },
  {
    cardIds: ['major-00-the-fool', 'major-01-the-magician'],
    interpretation: 'The Fool\'s leap of faith paired with The Magician\'s skill and resourcefulness traditionally reads as having both the willingness to begin and the tools to make it real - a strong omen for starting something new.',
    source: 'traditional',
  },
  {
    cardIds: ['major-02-the-high-priestess', 'major-09-the-hermit'],
    interpretation: 'Both cards point to inner knowing and withdrawal from external noise. Together they traditionally suggest this is a time for quiet reflection and trusting intuition over outside opinion, rather than a time for action.',
    source: 'traditional',
  },
  {
    cardIds: ['major-03-the-empress', 'minor-pentacles-ten'],
    interpretation: 'The Empress\'s abundance and nurturing paired with the Ten of Pentacles\' material security and family legacy traditionally reads as lasting, well-rooted abundance - not fleeting good fortune.',
    source: 'traditional',
  },
  {
    cardIds: ['major-04-the-emperor', 'major-05-the-hierophant'],
    interpretation: 'Two traditionally structured authority cards together point to convention, established order and working within existing systems or rules, rather than improvising.',
    source: 'traditional',
  },
  {
    cardIds: ['major-15-the-devil', 'minor-cups-two'],
    interpretation: 'A traditionally cautionary pairing: a bond (Two of Cups) shadowed by unhealthy attachment, restriction, or an imbalance of power (The Devil). Suggests looking honestly at whether a connection is truly free or has become a trap.',
    source: 'traditional',
  },
  {
    cardIds: ['major-10-wheel-of-fortune', 'major-21-the-world'],
    interpretation: 'Two cycle-completion cards together traditionally strengthen a reading of a major turn of fortune arriving alongside the genuine close of a long chapter.',
    source: 'traditional',
  },
  {
    cardIds: ['major-11-justice', 'minor-swords-knight'],
    interpretation: 'Justice\'s fairness and truth paired with the Knight of Swords\' decisive, fast action traditionally suggests a swift, assertive move toward a fair or overdue resolution.',
    source: 'traditional',
  },
  {
    cardIds: ['major-12-the-hanged-man', 'minor-swords-eight'],
    interpretation: 'Both cards traditionally relate to feeling stuck or suspended. Together they reinforce a reading of being caught in a holding pattern, often by one\'s own perspective rather than the actual circumstances - a prompt to pause rather than force movement.',
    source: 'traditional',
  },
  {
    cardIds: ['major-14-temperance', 'minor-cups-two'],
    interpretation: 'Temperance\'s balance and moderation alongside the Two of Cups\' mutual connection traditionally points to a relationship or situation defined by genuine give-and-take and patience, rather than intensity or urgency.',
    source: 'traditional',
  },
  {
    cardIds: ['major-07-the-chariot', 'minor-wands-knight'],
    interpretation: 'Two traditionally fast-moving, willful cards together strongly reinforce a reading of determined forward motion and a drive to push through obstacles toward a clear goal.',
    source: 'traditional',
  },
  {
    cardIds: ['major-08-strength', 'minor-wands-king'],
    interpretation: 'Strength\'s quiet, inner courage paired with the King of Wands\' confident, visible leadership traditionally suggests mastery that comes from genuine inner resolve rather than force or ego.',
    source: 'traditional',
  },
  {
    cardIds: ['major-20-judgement', 'major-13-death'],
    interpretation: 'A traditional "reckoning and rebirth" pairing: Death\'s ending combined with Judgement\'s awakening and reckoning suggests a decisive turning point where the past is being honestly reviewed before a genuine new start.',
    source: 'traditional',
  },
  {
    cardIds: ['minor-wands-ace', 'minor-cups-ace'],
    interpretation: 'Two Aces together traditionally amplify new-beginning energy across both drive/passion (Wands) and feeling/connection (Cups) - a strong sign that something genuinely new is forming on more than one front.',
    source: 'traditional',
  },
  {
    cardIds: ['minor-swords-ace', 'minor-pentacles-ace'],
    interpretation: 'The Ace of Swords\' mental clarity paired with the Ace of Pentacles\' material opportunity traditionally suggests a clear-headed decision opening a genuine practical opportunity.',
    source: 'traditional',
  },
  {
    cardIds: ['minor-cups-ten', 'minor-pentacles-ten'],
    interpretation: 'Two "Ten" culmination cards from Cups and Pentacles together traditionally reinforce a reading of lasting fulfillment across both emotional/family life and material security.',
    source: 'traditional',
  },
  {
    cardIds: ['minor-swords-five', 'minor-swords-seven'],
    interpretation: 'Two conflict-themed Swords cards together strengthen a traditional reading of ongoing tension, win/lose thinking, or trust being tested - worth examining honestly rather than escalating further.',
    source: 'traditional',
  },
  {
    cardIds: ['minor-wands-nine', 'minor-wands-ten'],
    interpretation: 'Two late-stage Wands cards together traditionally point to being close to a goal but worn down by the effort - a reminder to pace the final push rather than burn out just before completion.',
    source: 'traditional',
  },
  {
    cardIds: ['minor-pentacles-five', 'minor-pentacles-nine'],
    interpretation: 'Pentacles\' hardship (Five) paired with its self-sufficient comfort (Nine) traditionally reads as a difficult material period giving way to independently-earned stability.',
    source: 'traditional',
  },
  {
    cardIds: ['minor-cups-five', 'minor-cups-six'],
    interpretation: 'Cups\' disappointment (Five) moving into nostalgic sweetness or reconciliation (Six) traditionally suggests processing a loss or regret and finding comfort by reconnecting with something gentler from the past.',
    source: 'traditional',
  },
  {
    cardIds: ['major-06-the-lovers', 'major-15-the-devil'],
    interpretation: 'A traditional cautionary contrast: genuine union and choice (The Lovers) against unhealthy bondage or temptation (The Devil). Together they prompt an honest look at whether a connection is freely chosen or has become restrictive.',
    source: 'traditional',
  },
  {
    cardIds: ['minor-wands-queen', 'minor-cups-king'],
    interpretation: 'Wands\' confident warmth (Queen) paired with Cups\' emotionally mature, steady leadership (King) traditionally suggests a relationship or dynamic balancing passion with calm emotional steadiness.',
    source: 'traditional',
  },
];

/** Finds every curated combination whose required cards are all present
 * among the drawn cards (order-independent, orientation-independent).
 * Returns an empty array when nothing matches - callers must not invent a
 * fallback combination when this is empty. */
export function findMatchingCombinations(draws: TarotDraw[]): CardCombination[] {
  const presentIds = new Set(draws.map((d) => d.cardId));
  return CARD_COMBINATIONS.filter((combo) => combo.cardIds.every((id) => presentIds.has(id)));
}
