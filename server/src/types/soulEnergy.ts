export interface SoulEnergyReading {
  id: string;
  userId: string;
  localDate: string;
  calculationReference: string; // engine version + sun/moon/ascendant used as grounding
  corePersonality: string;
  mindAndEmotions: string;
  careerStyle: string;
  loveAndRelationships: string;
  strengths: string[];
  challenges: string[];
  balanceTip: string;
  dataCompleteness: 'full' | 'partial'; // partial = no ascendant (birth time/location unknown)
  contentVersion: string;
  createdAt: string;
}
