import { describe, it, expect } from 'vitest';
import { requestLocalDate } from './localDate';

const at = (iso: string) => new Date(iso);
const h = (v?: string) => ({ headers: v === undefined ? {} : { 'x-local-date': v } });

describe('requestLocalDate', () => {
  it('uses the caller\'s date when it is a real date within a day of UTC (India at 1 AM is already "tomorrow" vs UTC)', () => {
    expect(requestLocalDate(h('2026-11-25'), at('2026-11-24T19:30:00Z'))).toBe('2026-11-25'); // 1:00 AM IST
    expect(requestLocalDate(h('2026-11-23'), at('2026-11-24T02:00:00Z'))).toBe('2026-11-23'); // US evening
  });
  it('falls back to the UTC date for missing, malformed, impossible or far-off values', () => {
    const now = at('2026-11-24T12:00:00Z');
    for (const bad of [undefined, 'yesterday', '2026-13-40', '2026-02-30', '2026-11-30', '2024-01-01', '']) {
      expect(requestLocalDate(h(bad), now)).toBe('2026-11-24');
    }
  });
});
