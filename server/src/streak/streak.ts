/** Pure streak maths over a set of YYYY-MM-DD days, so it can be tested without a database. */

const DAY_MS = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const shift = (d: string, n: number) => new Date(toMs(d) + n * DAY_MS).toISOString().slice(0, 10);

export const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365] as const;

export interface StreakSummary {
  current: number;
  longest: number;
  totalDays: number;
  checkedInToday: boolean;
  /** true when the streak is alive but today is not done yet (it breaks if tomorrow passes with no check-in) */
  atRisk: boolean;
  /** the last 7 calendar days ending today, oldest first, each marked done or not */
  week: { date: string; done: boolean }[];
  /** set when today's check-in just reached a milestone length */
  milestone: number | null;
}

/**
 * Forgiving "current" streak: consecutive days ending today, or ending yesterday if today has not happened yet
 * (so the streak isn't shown as broken in the morning before the user has opened the app).
 */
export function computeStreak(days: Iterable<string>, today: string): StreakSummary {
  const set = new Set(days);
  const checkedInToday = set.has(today);

  let anchor = checkedInToday ? today : shift(today, -1);
  let current = 0;
  while (set.has(anchor)) { current++; anchor = shift(anchor, -1); }

  const sorted = [...set].sort();
  let longest = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    run = prev && shift(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  const week = Array.from({ length: 7 }, (_, i) => { const d = shift(today, i - 6); return { date: d, done: set.has(d) }; });
  const milestone = checkedInToday && (MILESTONES as readonly number[]).includes(current) ? current : null;
  return { current, longest, totalDays: set.size, checkedInToday, atRisk: !checkedInToday && current > 0, week, milestone };
}
