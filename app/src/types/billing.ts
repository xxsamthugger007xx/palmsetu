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

export interface CouponValidation {
  valid: boolean;
  reason?: string;
  discountPercent?: number;
  originalPriceCents?: number;
  discountedPriceCents?: number;
}

/** Premium users' monthly AI allowance (estimated spend), from GET /billing/ai-budget. */
export interface AiBudgetStatus {
  capped: boolean;
  limitInr: number | null;
  usedInr: number;
  remainingInr: number | null;
  resetsOn: string; // YYYY-MM-DD, first day of next month (UTC)
}
