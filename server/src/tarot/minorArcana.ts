import { TarotCard, Rank, Suit } from '../types/tarot';

const CONTENT_VERSION = 'solune-tarot-1.0';

const SUIT_META: Record<Suit, { theme: string; domain: string; element: string; keywordsUpright: string; keywordsReversed: string }> = {
  wands: { theme: 'ambition and creative energy', domain: 'drive, passion and initiative', element: 'fire', keywordsUpright: 'energy', keywordsReversed: 'burnout' },
  cups: { theme: 'emotion and connection', domain: 'feelings, relationships and intuition', element: 'water', keywordsUpright: 'openness', keywordsReversed: 'withdrawal' },
  swords: { theme: 'thought and communication', domain: 'clarity, conflict and decision-making', element: 'air', keywordsUpright: 'clarity', keywordsReversed: 'confusion' },
  pentacles: { theme: 'resources and stability', domain: 'work, money and the material world', element: 'earth', keywordsUpright: 'groundedness', keywordsReversed: 'instability' },
};

const RANK_META: Record<Rank, { label: string; stage: string; uprightFragment: string; reversedFragment: string }> = {
  ace: { label: 'Ace', stage: 'a pure beginning', uprightFragment: 'a fresh, unformed opportunity in this area', reversedFragment: 'an opportunity not yet recognized or acted on' },
  two: { label: 'Two', stage: 'an early choice or balance', uprightFragment: 'weighing a choice or balancing two forces', reversedFragment: 'indecision or imbalance between two options' },
  three: { label: 'Three', stage: 'early growth', uprightFragment: 'early collaboration or the first signs of progress', reversedFragment: 'delays or friction in early progress' },
  four: { label: 'Four', stage: 'stability', uprightFragment: 'a pause to consolidate what’s been built so far', reversedFragment: 'stagnation from staying too long in comfort' },
  five: { label: 'Five', stage: 'tension or conflict', uprightFragment: 'friction, competition or a challenge to work through', reversedFragment: 'conflict beginning to ease or be avoided' },
  six: { label: 'Six', stage: 'a turning point toward ease', uprightFragment: 'a shift toward cooperation, relief or progress', reversedFragment: 'an imbalance of give and take' },
  seven: { label: 'Seven', stage: 'assessment', uprightFragment: 'taking stock of effort already invested', reversedFragment: 'doubt about whether the effort is worth it' },
  eight: { label: 'Eight', stage: 'momentum', uprightFragment: 'fast movement or a concentrated burst of focus', reversedFragment: 'feeling stuck despite wanting to move forward' },
  nine: { label: 'Nine', stage: 'near completion', uprightFragment: 'resilience built from nearly reaching a goal', reversedFragment: 'exhaustion or guardedness near the finish' },
  ten: { label: 'Ten', stage: 'culmination', uprightFragment: 'the full weight or reward of a completed cycle', reversedFragment: 'feeling burdened by what has accumulated' },
  page: { label: 'Page', stage: 'a curious beginner’s energy', uprightFragment: 'approaching this area with curiosity and openness to learning', reversedFragment: 'immaturity or a message not yet understood' },
  knight: { label: 'Knight', stage: 'active pursuit', uprightFragment: 'pursuing this area with focus and momentum', reversedFragment: 'acting impulsively or losing direction' },
  queen: { label: 'Queen', stage: 'intuitive mastery', uprightFragment: 'a mature, intuitive command of this area', reversedFragment: 'self-doubt undermining natural strength here' },
  king: { label: 'King', stage: 'grounded mastery', uprightFragment: 'confident, grounded authority in this area', reversedFragment: 'control used rigidly or for the wrong reasons' },
};

const SUITS: Suit[] = ['wands', 'cups', 'swords', 'pentacles'];
const RANKS: Rank[] = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'page', 'knight', 'queen', 'king'];

function cardName(suit: Suit, rank: Rank): string {
  const suitLabel = suit.charAt(0).toUpperCase() + suit.slice(1);
  return `${RANK_META[rank].label} of ${suitLabel}`;
}

/**
 * Minor Arcana - 56 cards, generated from suit × rank templates. Content is original
 * to this project: each card combines a suit theme with a rank stage into a distinct,
 * non-repeating sentence rather than reusing one generic paragraph across all 56 cards.
 */
export function buildMinorArcana(): TarotCard[] {
  const cards: TarotCard[] = [];

  for (const suit of SUITS) {
    const suitMeta = SUIT_META[suit];
    for (const rank of RANKS) {
      const rankMeta = RANK_META[rank];
      const name = cardName(suit, rank);
      const id = `minor-${suit}-${rank}`;

      cards.push({
        id,
        name,
        arcana: 'minor',
        suit,
        rank,
        number: null,
        uprightKeywords: [suitMeta.keywordsUpright, rankMeta.stage],
        reversedKeywords: [suitMeta.keywordsReversed, `blocked ${rankMeta.stage}`],
        general: `In the suit of ${suit}, tied to ${suitMeta.domain}, this card traditionally points to ${rankMeta.uprightFragment}.`,
        love: `In matters of connection, suggests ${rankMeta.uprightFragment.replace('this area', 'your relationships')}.`,
        career: `In work and goals, points to ${rankMeta.uprightFragment.replace('this area', 'your current efforts')}.`,
        personalGrowth: `As a personal reflection, invites you to notice ${rankMeta.uprightFragment.replace('this area', 'this part of your life')}.`,
        reversedGeneral: `Reversed, this card traditionally points to ${rankMeta.reversedFragment}, tinged with the ${suitMeta.keywordsReversed} that can show up in the suit of ${suit}.`,
        symbolism: `The suit of ${suit} is traditionally associated with ${suitMeta.theme} (element: ${suitMeta.element}); the ${rankMeta.label.toLowerCase()} marks ${rankMeta.stage}.`,
        reflectionPrompt: `Where in your life are you experiencing ${rankMeta.stage} connected to ${suitMeta.domain}?`,
        artwork: `minor_${suit}_${rank}`,
        contentVersion: CONTENT_VERSION,
      });
    }
  }

  return cards;
}
