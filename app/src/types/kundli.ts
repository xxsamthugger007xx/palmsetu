export type KundliChartStyle = 'northIndia' | 'southIndia' | 'western';
export type KundliSubject = 'self' | 'other';

export interface KundliPlanetPlacement {
  planet: string;
  siderealLongitude: number;
  sign: string;
  signIndex: number;
  degreeInSign: { deg: number; min: number };
  house: number;
}

export interface KundliDashaPeriod {
  lord: string;
  startDate: string;
  endDate: string;
}

export interface KundliChartData {
  ascendantSign: string;
  ascendantSiderealLongitude: number;
  placements: KundliPlanetPlacement[];
  currentDasha: KundliDashaPeriod;
  engineVersion: string;
  houseSystem: string;
  ayanamsa: string;
}

export interface KundliChart {
  id: string;
  userId: string;
  subject: KundliSubject;
  subjectName: string | null;
  style: KundliChartStyle;
  birthDate: string;
  birthTime: string;
  latitude: number;
  longitude: number;
  chart: KundliChartData;
  createdAt: string;
}

export interface KundliLimits {
  tier: 'free' | 'premium';
  canGenerateSelf: boolean;
  canGenerateOther: boolean;
  generationsUsed: number;
  freeLimit: number;
}

export interface SoulEnergyReading {
  id: string;
  userId: string;
  localDate: string;
  calculationReference: string;
  corePersonality: string;
  mindAndEmotions: string;
  careerStyle: string;
  loveAndRelationships: string;
  strengths: string[];
  challenges: string[];
  balanceTip: string;
  dataCompleteness: 'full' | 'partial';
  contentVersion: string;
  createdAt: string;
}
