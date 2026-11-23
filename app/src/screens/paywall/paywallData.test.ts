import { describe, it, expect, vi } from 'vitest';
vi.mock('lucide-react-native', () => ({ ScanLine: 'ScanLine', Layers: 'Layers', Heart: 'Heart', Moon: 'Moon', MessageCircle: 'MessageCircle', Leaf: 'Leaf' }));
import { BENEFIT_CATEGORIES, COMPARISON_ROW_KEYS, formatRupees, periodSuffix, planCtaLabel } from './paywallData';
import en from '../../i18n/locales/en.json';

const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}|${JSON.stringify(o)}` : k);
const get = (path: string) => path.split('.').reduce<any>((a, k) => a?.[k], (en as any).paywall);

describe('paywall data', () => {
  it('formats prices in rupees with Indian digit grouping', () => {
    expect(formatRupees(9900)).toBe('₹99');
    expect(formatRupees(299900)).toBe('₹2,999');
    expect(formatRupees(1299900)).toBe('₹12,999');
  });
  it('labels billing periods through i18n keys', () => {
    expect(periodSuffix('monthly', t)).toBe('paywall.period.monthly');
    expect(periodSuffix('quarterly', t)).toBe('paywall.period.quarterly');
    expect(periodSuffix('annual', t)).toBe('paywall.period.annual');
  });
  it('builds the checkout button label', () => {
    expect(planCtaLabel(undefined, t)).toBe('paywall.cta.unlock');
    expect(planCtaLabel({ label: 'Annual', priceCents: 299900 } as any, t)).toBe('paywall.cta.continueWith|{"plan":"Annual","price":"₹2,999"}');
  });
  it('every benefit title, tagline and point, and every comparison cell, exists in the English locale', () => {
    const missing: string[] = [];
    for (const c of BENEFIT_CATEGORIES) {
      for (const k of ['title', 'tagline', ...Array.from({ length: c.pointCount }, (_, i) => `p${i + 1}`)]) if (!get(`benefits.${c.key}.${k}`)) missing.push(`benefits.${c.key}.${k}`);
      if (get(`benefits.${c.key}.p${c.pointCount + 1}`)) missing.push(`benefits.${c.key}: more points in locale than pointCount`);
    }
    for (const r of COMPARISON_ROW_KEYS) for (const k of ['label', 'free', 'premium']) if (!get(`compare.${r}.${k}`)) missing.push(`compare.${r}.${k}`);
    expect(missing).toEqual([]);
  });
});
