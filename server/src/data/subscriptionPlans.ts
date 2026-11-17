/**
 * Canonical Palm Setu Premium subscription plans - the single source of
 * truth for pricing, used by GET /billing/plans (so the mobile app never
 * hardcodes a price) and by the admin panel's subscription reporting.
 *
 * These are the FINAL, approved prices (not placeholders, unlike the rest
 * of data/pricing.ts). They are NOT yet backed by a real billing
 * integration - see routes/billing.ts and the Paywall screen for exactly
 * what that means today. Changing a price here changes what the app
 * displays and what /dev/set-tier records, but it does NOT change any
 * real App Store Connect / Google Play Console product, since none are
 * configured yet (see each PlanConfig's `storeProductId` fields, which are
 * placeholders that MUST be replaced with real product IDs once those
 * products exist - see the paywall implementation report for the exact
 * configuration required).
 */

export type BillingPeriod = 'monthly' | 'quarterly' | 'annual';

export interface SubscriptionPlan {
  id: BillingPeriod;
  label: string;
  priceCents: number; // INR paise
  currency: 'INR';
  billingPeriod: BillingPeriod;
  billingPeriodMonths: number;
  effectiveMonthlyCents: number;
  savingsPercentVsMonthly: number; // 0 for the monthly plan itself
  badge: 'BEST_VALUE' | 'POPULAR_CHOICE' | null;
  /** Placeholder store product identifiers - NOT yet created in App Store
   * Connect / Google Play Console. See the implementation report for the
   * exact setup required before these can back a real purchase. */
  storeProductId: { ios: string; android: string };
}

const MONTHLY_CENTS = 49_900; // INR 499.00
const QUARTERLY_CENTS = 129_900; // INR 1,299.00
const ANNUAL_CENTS = 459_900; // INR 4,599.00

function round(n: number): number {
  return Math.round(n);
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    priceCents: MONTHLY_CENTS,
    currency: 'INR',
    billingPeriod: 'monthly',
    billingPeriodMonths: 1,
    effectiveMonthlyCents: MONTHLY_CENTS,
    savingsPercentVsMonthly: 0,
    badge: null,
    storeProductId: { ios: 'palmsetu_premium_monthly', android: 'palmsetu_premium_monthly' },
  },
  {
    id: 'quarterly',
    label: 'Quarterly',
    priceCents: QUARTERLY_CENTS,
    currency: 'INR',
    billingPeriod: 'quarterly',
    billingPeriodMonths: 3,
    effectiveMonthlyCents: round(QUARTERLY_CENTS / 3),
    // vs. paying the monthly price for 3 months (3 * 49900 = 149700)
    savingsPercentVsMonthly: round((1 - QUARTERLY_CENTS / (MONTHLY_CENTS * 3)) * 100),
    badge: 'POPULAR_CHOICE',
    storeProductId: { ios: 'palmsetu_premium_quarterly', android: 'palmsetu_premium_quarterly' },
  },
  {
    id: 'annual',
    label: 'Annual',
    priceCents: ANNUAL_CENTS,
    currency: 'INR',
    billingPeriod: 'annual',
    billingPeriodMonths: 12,
    effectiveMonthlyCents: round(ANNUAL_CENTS / 12),
    // vs. paying the monthly price for 12 months (12 * 49900 = 598800)
    savingsPercentVsMonthly: round((1 - ANNUAL_CENTS / (MONTHLY_CENTS * 12)) * 100),
    badge: 'BEST_VALUE',
    storeProductId: { ios: 'palmsetu_premium_annual', android: 'palmsetu_premium_annual' },
  },
];

export function getPlan(id: BillingPeriod): SubscriptionPlan {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown subscription plan id: ${id}`);
  return plan;
}

export function addPeriod(fromIso: string, period: BillingPeriod): string {
  const d = new Date(fromIso);
  if (period === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (period === 'quarterly') d.setMonth(d.getMonth() + 3);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}
