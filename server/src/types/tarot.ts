export type Arcana = 'major' | 'minor';
export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';
export type Rank =
  | 'ace' | 'two' | 'three' | 'four' | 'five' | 'six' | 'seven' | 'eight' | 'nine' | 'ten'
  | 'page' | 'knight' | 'queen' | 'king';
export type Orientation = 'upright' | 'reversed';

export interface TarotCard {
  id: string; // stable slug, e.g. "major-00-the-fool", "minor-wands-ace"
  name: string;
  arcana: Arcana;
  suit: Suit | null;
  rank: Rank | null;
  number: number | null; // Major Arcana 0-21; null for Minor
  uprightKeywords: string[];
  reversedKeywords: string[];
  general: string;
  love: string;
  career: string;
  personalGrowth: string;
  reversedGeneral: string;
  symbolism: string;
  reflectionPrompt: string;
  artwork: string; // asset reference / key - see assets README
  contentVersion: string;
}

export type ReadingCategory = 'general' | 'love' | 'career' | 'question';
export type SpreadType =
  | 'one-card' | 'three-card-ppf' | 'three-card-scg' | 'three-card-mbs' | 'celtic-cross'
  | 'love-relationship' | 'career-finance' | 'yes-no' | 'relationship-compatibility';
export type ReadingStatus = 'drawn' | 'interpreted' | 'failed';
export type DetailedReportStatus = 'none' | 'ready' | 'failed';

export interface SpreadPosition {
  index: number;
  name: string;
  description: string;
}

export interface SpreadDefinition {
  id: SpreadType;
  title: string;
  description: string;
  cardCount: number;
  positions: SpreadPosition[];
  premium: boolean;
  available: boolean; // false = defined but not yet enabled in product (e.g. celtic-cross)
}

export interface TarotDraw {
  cardId: string;
  positionIndex: number;
  positionName: string;
  orientation: Orientation;
}

export interface CardInterpretation {
  positionIndex: number;
  cardId: string;
  text: string;
}

export type YesNoTendency = 'yes' | 'no' | 'uncertain';

/** Distinct response shape for the Yes/No spread - a tendency plus its
 * traditional card basis, context and advice, rather than the generic
 * per-position/overall shape used by every other spread. */
export interface YesNoResult {
  tendency: YesNoTendency;
  traditionalBasis: string;
  context: string;
  advice: string;
}

export interface TarotInterpretation {
  cardInterpretations: CardInterpretation[];
  overallInterpretation: string;
  reflectionPrompts: string[];
  /** Only populated on the premium AI-synthesized detailed report, not the free
   * static interpretation. */
  practicalSuggestions?: string[];
  /** Only populated for the 'yes-no' spread - see YesNoResult. */
  yesNo?: YesNoResult;
  /** Only populated for the free daily tarot card. True once a saved birth
   * profile exists and the guidance framing was personalized from it - the
   * card drawn is never affected, only the interpretation text. False (with
   * personalizedNote explaining the honest fallback) when no profile exists. */
  personalized?: boolean;
  personalizedNote?: string;
  modelVersion: string; // 'static-fallback-v1' or the AI provider/model identifier
  createdAt: string;
}

export interface TarotReading {
  id: string;
  userId: string;
  readingType: ReadingCategory;
  spreadType: SpreadType;
  question: string | null;
  status: ReadingStatus;
  draws: TarotDraw[];
  /** Free, immediate, deterministic per-card interpretation - never requires
   * an AI call, so it's always available at no cost right after the draw. */
  interpretation: TarotInterpretation | null;
  /** Premium-gated AI-synthesized cohesive reading across all selected cards.
   * Null until the user unlocks it via /detailed-report. */
  detailedReport: TarotInterpretation | null;
  detailedReportStatus: DetailedReportStatus;
  saved: boolean;
  createdAt: string;
  completedAt: string | null;
  datasetVersion: string;
}

export interface TarotJournalEntry {
  id: string;
  userId: string;
  readingId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTarot {
  id: string;
  userId: string;
  localDate: string; // YYYY-MM-DD, client-supplied local calendar day
  readingId: string;
  cardId: string;
  orientation: Orientation;
}
