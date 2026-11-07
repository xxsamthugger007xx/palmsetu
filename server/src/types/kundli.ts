import { KundliChartData } from '../astrology/engine';

export type KundliChartStyle = 'northIndia' | 'southIndia' | 'western';
export type KundliSubject = 'self' | 'other';

export interface KundliChart {
  id: string;
  userId: string; // owner (the account that generated it, even for "other" subject)
  subject: KundliSubject;
  subjectName: string | null; // populated for "other" subject
  style: KundliChartStyle;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:MM:SS
  latitude: number;
  longitude: number;
  chart: KundliChartData;
  createdAt: string;
}
