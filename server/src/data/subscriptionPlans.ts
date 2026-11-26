import { getConfig, setConfig } from './runtimeConfig';

/**
 * Canonical Palm Setu Premium subscription plans - the single source of
 * truth for pricing, used by GET /billing/plans (so the mobile app never
 * hardcodes a price) and by the admin panel's subscription reporting.
 *
 * Base prices are durable, admin-editable runtime config (see
 * data/runtimeConfig.ts) rather than hardcoded constants - edit them live
 * from the admin panel's Pricing tab (GET/PUT /admin/pricing, super_admin
 * only for the write) with no redeploy needed; every derived field
 * (effective monthly price, savings %) is recomputed from whatever base
 * prices are currently in effect. The constants below remain only as the
 * fallback used until an admin first overrides them.
 *
 * These are NOT yet backed by a real billing integration - see
 * routes/billing.ts and the Paywall screen for exactly what that means
 * today. Changing a price here changes what the app displays and what
 * /dev/set-tier records, but it does NOT change any real App Store Connect
 * / Google Play Console product, since none are configured yet (see each
 * PlanConfig's `storeProductId` fields, which are placeholders that MUST
 * be replaced with real product IDs once those products exist).
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

export interface SubscriptionBasePrices {
  monthlyCents: number;
  quarterlyCents: number;
  annualCents: number;
}

const DEFAULT_BASE_PRICES: SubscriptionBasePrices = {
  monthlyCents: 49_900, // INR 499.00
  quarterlyCents: 129_900, // INR 1,299.00
  annualCents: 459_900, // INR 4,599.00
};

const CONFIG_KEY = 'subscriptionBasePrices';

function round(n: number): number {
  return Math.round(n);
}

function computePlans(base: SubscriptionBasePrices): SubscriptionPlan[] {
  const { monthlyCents, quarterlyCents, annualCents } = base;
  return [
    {
      id: 'monthly',
      label: 'Monthly',
      priceCents: monthlyCents,
      currency: 'INR',
      billingPeriod: 'monthly',
      billingPeriodMonths: 1,
      effectiveMonthlyCents: monthlyCents,
      savingsPercentVsMonthly: 0,
      badge: null,
      storeProductId: { ios: 'palmsetu_premium_monthly', android: 'palmsetu_premium_monthly' },
    },
    {
      id: 'quarterly',
      label: 'Quarterly',
      priceCents: quarterlyCents,
      currency: 'INR',
      billingPeriod: 'quarterly',
      billingPeriodMonths: 3,
      effectiveMonthlyCents: round(quarterlyCents / 3),
      // vs. paying the monthly price for 3 months
      savingsPercentVsMonthly: round((1 - quarterlyCents / (monthlyCents * 3)) * 100),
      badge: 'POPULAR_CHOICE',
      storeProductId: { ios: 'palmsetu_premium_quarterly', android: 'palmsetu_premium_quarterly' },
    },
    {
      id: 'annual',
      label: 'Annual',
      priceCents: annualCents,
      currency: 'INR',
      billingPeriod: 'annual',
      billingPeriodMonths: 12,
      effectiveMonthlyCents: round(annualCents / 12),
      // vs. paying the monthly price for 12 months
      savingsPercentVsMonthly: round((1 - annualCents / (monthlyCents * 12)) * 100),
      badge: 'BEST_VALUE',
      storeProductId: { ios: 'palmsetu_premium_annual', android: 'palmsetu_premium_annual' },
    },
  ];
}

export function getSubscriptionBasePrices(): SubscriptionBasePrices {
  return getConfig(CONFIG_KEY, DEFAULT_BASE_PRICES);
}

export function setSubscriptionBasePrices(overrides: Partial<SubscriptionBasePrices>): SubscriptionBasePrices {
  const merged = { ...getSubscriptionBasePrices(), ...overrides };
  return setConfig(CONFIG_KEY, merged);
}

export function defaultSubscriptionBasePrices(): SubscriptionBasePrices {
  return { ...DEFAULT_BASE_PRICES };
}

export function getSubscriptionPlans(): SubscriptionPlan[] {
  return computePlans(getSubscriptionBasePrices());
}

export function getPlan(id: BillingPeriod): SubscriptionPlan {
  const plan = getSubscriptionPlans().find((p) => p.id === id);
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
