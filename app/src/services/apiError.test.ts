import { describe, it, expect, vi } from 'vitest';
vi.mock('../i18n', () => ({ default: { t: (k: string) => k } }));
import { asApiError } from './apiRequest';

describe('asApiError', () => {
  it('passes real errors through with their API fields', () => {
    const e = Object.assign(new Error('boom'), { status: 403, code: 'LIMIT_REACHED', isNetworkError: false });
    const out = asApiError(e);
    expect(out).toBe(e);
    expect(out.status).toBe(403); expect(out.code).toBe('LIMIT_REACHED');
  });
  it('wraps non-Error throws so .message is always a string', () => {
    expect(asApiError('plain string').message).toBe('plain string');
    expect(asApiError(undefined).message).toBe('Unknown error');
    expect(asApiError({ foo: 1 }).isNetworkError).toBe(false);
  });
});
