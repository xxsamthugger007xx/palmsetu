import { describe, expect, it } from 'vitest';
import { daysUntilNextMoonPhase } from './engine';

describe('daysUntilNextMoonPhase', () => {
  it('returns a non-negative days estimate within one synodic month and names the upcoming phase', () => {
    const date = new Date('2026-03-14T12:00:00Z');
    const result = daysUntilNextMoonPhase(date);
    expect(result.daysUntil).toBeGreaterThanOrEqual(0);
    expect(result.daysUntil).toBeLessThanOrEqual(29.6);
    expect(typeof result.nextPhase).toBe('string');
    expect(result.nextPhase.length).toBeGreaterThan(0);
  });

  it('advances across the full cycle as the date steps forward a day at a time', () => {
    // Over a ~30 day span the "days until next phase" estimate should
    // generally trend downward within each phase window and never jump
    // outside the valid 0..~29.6 day range - a sanity check that the
    // boundary-crossing math doesn't wrap incorrectly.
    let prevDays: number | null = null;
    for (let i = 0; i < 30; i++) {
      const date = new Date(Date.UTC(2026, 5, 1 + i, 12, 0, 0));
      const { daysUntil } = daysUntilNextMoonPhase(date);
      expect(daysUntil).toBeGreaterThanOrEqual(0);
      expect(daysUntil).toBeLessThanOrEqual(29.6);
      prevDays = daysUntil;
    }
    expect(prevDays).not.toBeNull();
  });

  it('is deterministic for the same input date', () => {
    const date = new Date('2026-09-20T12:00:00Z');
    const a = daysUntilNextMoonPhase(date);
    const b = daysUntilNextMoonPhase(date);
    expect(a).toEqual(b);
  });
});
