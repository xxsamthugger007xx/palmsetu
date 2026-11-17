export type BillingPeriod = 'monthly' | 'quarterly' | 'annual';

export interface SubscriptionPlan {
  id: BillingPeriod;
  label: string;
  priceCents: number;
  currency: 'INR';
  billingPeriod: BillingPeriod;
  billingPeriodMonths: number;
  effectiveMonthlyCents: number;
  savingsPercentVsMonthly: number;
  badge: 'BEST_VALUE' | 'POPULAR_CHOICE' | null;
  storeProductId: { ios: string; android: string };
}

export interface SubscriptionStatus {
  tier: 'free' | 'premium';
  planId: BillingPeriod | null;
  status: 'active' | 'cancelled' | 'expired' | null;
  startedAt: string | null;
  renewsAt: string | null;
  expiresAt: string | null;
}
