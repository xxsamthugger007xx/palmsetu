/**
 * Pure heading math - no React Native imports, so this is independently
 * testable (see compass.test.ts) and reusable regardless of which sensor API
 * feeds it. Nothing here claims survey-grade accuracy; magnetometer-derived
 * headings are inherently approximate and sensitive to nearby metal/electronics.
 */

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export const DIRECTION_ORDER: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const DIRECTION_LABELS: Record<Direction, string> = {
  N: 'North', NE: 'Northeast', E: 'East', SE: 'Southeast',
  S: 'South', SW: 'Southwest', W: 'West', NW: 'Northwest',
};

/** Wraps any finite number of degrees into [0, 360). */
export function normalizeHeading(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Maps a 0-359.999 heading to the nearest of the 8 cardinal/intercardinal
 * directions, each covering a 45-degree sector centered on its heading. */
export function headingToDirection(deg: number): Direction {
  const normalized = normalizeHeading(deg);
  const index = Math.round(normalized / 45) % 8;
  return DIRECTION_ORDER[index];
}

/**
 * Circular mean of a set of headings (degrees), correctly handling the
 * 359->0 wraparound that a naive arithmetic average gets wrong (e.g. the
 * naive average of 359 and 1 is 180, which is backwards - the circular mean
 * correctly returns ~0).
 */
export function circularMeanHeading(headings: number[]): number | null {
  const valid = headings.filter((h) => Number.isFinite(h));
  if (valid.length === 0) return null;

  let sumSin = 0;
  let sumCos = 0;
  for (const h of valid) {
    const rad = (normalizeHeading(h) * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }
  const meanRad = Math.atan2(sumSin / valid.length, sumCos / valid.length);
  return normalizeHeading((meanRad * 180) / Math.PI);
}

/** Rolling circular-mean smoother: feed it readings one at a time, it keeps a
 * bounded window and returns the current smoothed heading. Rejects obviously
 * invalid (NaN/non-finite) samples without corrupting the running average. */
export class HeadingSmoother {
  private samples: number[] = [];

  constructor(private windowSize: number = 5) {}

  push(raw: number): number | null {
    if (!Number.isFinite(raw)) return circularMeanHeading(this.samples);
    this.samples.push(normalizeHeading(raw));
    if (this.samples.length > this.windowSize) this.samples.shift();
    return circularMeanHeading(this.samples);
  }

  reset() {
    this.samples = [];
  }
}
