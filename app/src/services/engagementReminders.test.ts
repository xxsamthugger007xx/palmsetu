import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('../utils/tr', () => ({ tr: (k: string) => k }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));

import { isValidTime, nextOccurrence } from './notificationScheduler';

describe('isValidTime', () => {
  it('accepts HH:mm 24h only', () => {
    expect(isValidTime('08:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('8:00')).toBe(false);
    expect(isValidTime('08:60')).toBe(false);
  });
});

describe('nextOccurrence', () => {
  const from = new Date(2026, 5, 10, 12, 0, 0);
  it('later today if still ahead', () => {
    const d = nextOccurrence('20:00', from, false);
    expect(d.getDate()).toBe(10);
    expect(d.getHours()).toBe(20);
  });
  it('tomorrow if already passed', () => {
    expect(nextOccurrence('08:00', from, false).getDate()).toBe(11);
  });
  it('forced tomorrow', () => {
    expect(nextOccurrence('20:00', from, true).getDate()).toBe(11);
  });
});
