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
  status: ReadingStatus;
  draws: TarotDraw[];
  interpretation: TarotInterpretation | null;
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
  localDate: string;
  readingId: string;
  cardId: string;
  orientation: Orientation;
}
