import { request as baseRequest } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface StreakSummary {
  current: number;
  longest: number;
  totalDays: number;
  checkedInToday: boolean;
  /** streak is alive but today isn't done yet */
  atRisk: boolean;
  /** last 7 days ending today, oldest first */
  week: { date: string; done: boolean }[];
  /** set when today's check-in reached a milestone length (3, 7, 14, 30, ...) */
  milestone: number | null;
}

export const streakApi = {
  get: () => baseRequest<StreakSummary>(BASE_URL, '/streak'),
  /** Idempotent: records today (the device's own calendar day) once, returns the updated streak. */
  checkin: () => baseRequest<StreakSummary & { newlyCheckedIn: boolean }>(BASE_URL, '/streak/checkin', { method: 'POST', body: '{}' }),
};
