import { describe, it, expect } from 'vitest';
import { isLoadFailure } from './loadFailure';

describe('isLoadFailure', () => {
  it('treats offline, timeouts and 5xx as failures', () => {
    expect(isLoadFailure({ isNetworkError: true })).toBe(true);
    expect(isLoadFailure({ status: 500 })).toBe(true);
    expect(isLoadFailure({ status: 503 })).toBe(true);
    expect(isLoadFailure(new Error('boom'))).toBe(true);
    expect(isLoadFailure(undefined)).toBe(true);
  });
  it('treats expected 4xx answers (e.g. 404 nothing yet, 403 limit) as normal', () => {
    expect(isLoadFailure({ status: 404 })).toBe(false);
    expect(isLoadFailure({ status: 403 })).toBe(false);
    expect(isLoadFailure({ status: 400 })).toBe(false);
  });
});
