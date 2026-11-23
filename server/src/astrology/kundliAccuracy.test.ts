import { describe, it, expect } from 'vitest';
import { birthInstantUtc, ascendantLongitudeTropical, computeKundli } from './engine';

describe('birthInstantUtc', () => {
  it('converts local birth time to UTC using the IANA zone', () => {
    expect(birthInstantUtc('1995-06-15', '10:30', 'Asia/Kolkata').toISOString()).toBe('1995-06-15T05:00:00.000Z');
    expect(birthInstantUtc('1995-06-15', '10:30', 'America/New_York').toISOString()).toBe('1995-06-15T14:30:00.000Z');
  });
  it('falls back to UTC without a zone or time', () => {
    expect(birthInstantUtc('1995-06-15', '10:30').toISOString()).toBe('1995-06-15T10:30:00.000Z');
    expect(birthInstantUtc('1995-06-15', null, 'Asia/Kolkata').toISOString()).toBe('1995-06-15T12:00:00.000Z');
  });
});

describe('ascendant', () => {
  it('rises on the eastern horizon, not the western (Delhi, 10:30 IST 1995-06-15 is Leo/Virgo, not Aquarius)', () => {
    const asc = ascendantLongitudeTropical(new Date('1995-06-15T05:00:00Z'), 28.61, 77.21);
    expect(asc).toBeGreaterThan(145);
    expect(asc).toBeLessThan(156);
  });
  it('kundli lagna for the same birth is Leo (sidereal)', () => {
    const c = computeKundli({ date: new Date('1995-06-15T05:00:00Z'), latitude: 28.61, longitude: 77.21 });
    expect(c.ascendantSign).toBe('Leo');
  });
});
