import { describe, expect, it } from 'vitest';
import {
  normalizeHeading, headingToDirection, circularMeanHeading, HeadingSmoother,
} from './compass';

describe('normalizeHeading', () => {
  it('wraps values above 360 into [0,360)', () => {
    expect(normalizeHeading(370)).toBe(10);
    expect(normalizeHeading(720)).toBe(0);
  });

  it('wraps negative values into [0,360)', () => {
    expect(normalizeHeading(-10)).toBe(350);
    expect(normalizeHeading(-370)).toBe(350);
  });

  it('returns 0 for non-finite input rather than throwing or propagating NaN', () => {
    expect(normalizeHeading(NaN)).toBe(0);
    expect(normalizeHeading(Infinity)).toBe(0);
  });
});

describe('headingToDirection', () => {
  it('maps exact cardinal/intercardinal headings correctly', () => {
    expect(headingToDirection(0)).toBe('N');
    expect(headingToDirection(45)).toBe('NE');
    expect(headingToDirection(90)).toBe('E');
    expect(headingToDirection(135)).toBe('SE');
    expect(headingToDirection(180)).toBe('S');
    expect(headingToDirection(225)).toBe('SW');
    expect(headingToDirection(270)).toBe('W');
    expect(headingToDirection(315)).toBe('NW');
  });

  it('maps a heading just below 360 back to N (wraparound)', () => {
    expect(headingToDirection(359)).toBe('N');
  });

  it('maps a heading in the middle of a sector to that sector', () => {
    expect(headingToDirection(20)).toBe('N'); // closer to 0 than to 45
    expect(headingToDirection(30)).toBe('NE'); // closer to 45 than to 0
  });
});

describe('circularMeanHeading', () => {
  it('averages headings away from the 0/360 boundary normally', () => {
    expect(circularMeanHeading([80, 100])).toBeCloseTo(90, 0);
  });

  it('correctly averages across the 359/0 boundary (naive average would be wrong)', () => {
    // naive arithmetic mean of 359 and 1 is 180 (exactly backwards) - circular mean must be ~0
    const result = circularMeanHeading([359, 1]);
    expect(result).not.toBeNull();
    expect(result! < 5 || result! > 355).toBe(true);
  });

  it('returns null for an empty or all-invalid input array', () => {
    expect(circularMeanHeading([])).toBeNull();
    expect(circularMeanHeading([NaN, Infinity])).toBeNull();
  });

  it('ignores invalid samples mixed in with valid ones', () => {
    const result = circularMeanHeading([90, NaN, 90]);
    expect(result).toBeCloseTo(90, 0);
  });
});

describe('HeadingSmoother', () => {
  it('smooths a noisy sequence of readings around a stable heading', () => {
    const smoother = new HeadingSmoother(5);
    smoother.push(88);
    smoother.push(92);
    smoother.push(89);
    smoother.push(91);
    const result = smoother.push(90);
    expect(result).toBeCloseTo(90, 0);
  });

  it('keeps working correctly across the 0/360 wraparound', () => {
    const smoother = new HeadingSmoother(4);
    smoother.push(358);
    smoother.push(1);
    smoother.push(359);
    const result = smoother.push(2);
    expect(result).not.toBeNull();
    expect(result! < 10 || result! > 350).toBe(true);
  });

  it('respects the window size, dropping old samples', () => {
    const smoother = new HeadingSmoother(2);
    smoother.push(0);
    smoother.push(0);
    const result = smoother.push(90); // window is now [0, 90], not [0,0,90]
    expect(result).toBeCloseTo(45, 0);
  });

  it('does not corrupt the running average on an invalid sample', () => {
    const smoother = new HeadingSmoother(5);
    smoother.push(90);
    smoother.push(90);
    const result = smoother.push(NaN);
    expect(result).toBeCloseTo(90, 0);
  });

  it('reset() clears accumulated samples', () => {
    const smoother = new HeadingSmoother(5);
    smoother.push(90);
    smoother.reset();
    const result = smoother.push(180);
    expect(result).toBeCloseTo(180, 0);
  });
});
