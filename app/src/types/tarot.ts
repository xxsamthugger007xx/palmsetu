export type Arcana = 'major' | 'minor';
export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';
export type Orientation = 'upright' | 'reversed';

export interface TarotCard {
  id: string;
  name: string;
  arcana: Arcana;
  suit: Suit | null;
  rank: string | null;
  number: number | null;
  uprightKeywords: string[];
  reversedKeywords: string[];
  general: string;
  love: string;
  career: string;
  personalGrowth: string;
  reversedGeneral: string;
  symbolism: string;
  reflectionPrompt: string;
  artwork: string;
  contentVersion: string;
}

export type ReadingCategory = 'general' | 'love' | 'career' | 'question';
export type SpreadType =
  | 'one-card' | 'three-card-ppf' | 'three-card-scg' | 'three-card-mbs' | 'five-card' | 'celtic-cross'
  | 'love-relationship' | 'career-finance' | 'yes-no' | 'relationship-compatibility';
export type ReadingStatus = 'drawn' | 'interpreted' | 'failed';
export type DetailedReportStatus = 'none' | 'generating' | 'ready' | 'failed';

export function formatSpreadLabel(spreadType: SpreadType): string {
  return spreadType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  available: boolean;
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
  practicalSuggestions?: string[];
  /** Optional birth-chart personalisation on the premium detailed report
   * only - null when the user has no saved birth profile. Never affects
   * which cards were drawn. */
  birthChartPerspective?: string | null;
  yesNo?: YesNoResult;
  personalized?: boolean;
  personalizedNote?: string;
  modelVersion: string;
  createdAt: string;
}

export interface TarotReading {
  id: string;
  userId: string;
  readingType: ReadingCategory;
  spreadType: SpreadType;
  question: string | null;
  /** Optional display label for the 'relationship-compatibility' spread
   * only - a first name/nickname, never an account or full identity. See
   * server/src/types/tarot.ts's TarotReading for why this is intentionally
   * lighter than the Relationships/invitation system. */
  secondPersonName: string | null;
  status: ReadingStatus;
  draws: TarotDraw[];
  interpretation: TarotInterpretation | null;
  detailedReport: TarotInterpretation | null;
  detailedReportStatus: DetailedReportStatus;
  followupMessages: TarotFollowupMessage[];
  saved: boolean;
  createdAt: string;
  completedAt: string | null;
  datasetVersion: string;
}

export interface TarotFollowupMessage {
  question: string;
  answer: string;
  createdAt: string;
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
  localDate: string;
  readingId: string;
  cardId: string;
  orientation: Orientation;
}
