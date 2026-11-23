import { describe, it, expect } from 'vitest';
import { deviceLocalDate } from '../services/apiRequest';

describe('deviceLocalDate', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(deviceLocalDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(deviceLocalDate(new Date(2026, 10, 24, 0, 1))).toBe('2026-11-24');
  });
});
