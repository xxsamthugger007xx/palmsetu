import { ScanLine, Layers, Heart, Moon, MessageCircle, Leaf } from 'lucide-react-native';
import { BillingPeriod, SubscriptionPlan } from '../../types/billing';

type TFn = (key: string, options?: Record<string, unknown>) => string;

export type BenefitCategory = {
  key: string;
  icon: typeof ScanLine;
  /** i18n keys (paywall.benefits.<key>.title / .tagline / .p1..pN) */
  pointCount: number;
};

// Every point is grounded in a real, currently-enforced server-side entitlement check (server/src/tarot/entitlements.ts,
// palm.ts, gemstone.ts, vastu.ts, astrology.ts, wellness/entitlements.ts, assistant/entitlementCheck.ts) - not aspirational
// copy. Numbers match the real free-tier caps so nothing here overpromises. The wording lives in the locale files
// (paywall.benefits.*) so it can be translated; this list only says which categories exist, their icon and point count.
export const BENEFIT_CATEGORIES: BenefitCategory[] = [
  { key: 'palm', icon: ScanLine, pointCount: 4 },
  { key: 'tarot', icon: Layers, pointCount: 4 },
  { key: 'compatibility', icon: Heart, pointCount: 3 },
  { key: 'astrology', icon: Moon, pointCount: 3 },
  { key: 'ai', icon: MessageCircle, pointCount: 3 },
  { key: 'wellness', icon: Leaf, pointCount: 5 },
];

/** Rows of the Free vs Premium table; wording in paywall.compare.<key>.label/.free/.premium. */
export const COMPARISON_ROW_KEYS = ['palm', 'tarotSpreads', 'tarotFollowups', 'kundli', 'otherChart', 'assistant', 'companion', 'habits', 'moodHistory'] as const;

export function formatRupees(cents: number): string {
  return `₹${(cents / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function periodSuffix(period: BillingPeriod, t: TFn): string {
  if (period === 'monthly') return t('paywall.period.monthly');
  if (period === 'quarterly') return t('paywall.period.quarterly');
  return t('paywall.period.annual');
}

export function planCtaLabel(plan: SubscriptionPlan | undefined, t: TFn): string {
  if (!plan) return t('paywall.cta.unlock');
  return t('paywall.cta.continueWith', { plan: plan.label, price: formatRupees(plan.priceCents) });
}
