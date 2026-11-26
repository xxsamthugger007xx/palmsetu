import { SqliteMap } from './sqliteCollections';
import { BillingPeriod } from './subscriptionPlans';

/**
 * Subscription discount coupons, created and monitored from the admin
 * panel's Coupons tab. Scoped to the Premium subscription paywall only
 * (not Soulmate Sketch, which has its own real Razorpay checkout).
 *
 * Important honesty note, same spirit as data/pricing.ts: subscription
 * purchases go through RevenueCat/Play Billing/App Store, which this
 * backend does not control the price of - a coupon here discounts what
 * this app DISPLAYS and RECORDS (the price shown pre-purchase, and the
 * transaction amount logged once a real purchase is confirmed), not what
 * the store itself charges the card. Making the real charge match
 * requires a matching promotional price configured in Play Console / App
 * Store Connect for the specific product - this system does not and
 * cannot do that. See routes/billing.ts's confirm-purchase for exactly
 * where the discounted amount gets recorded.
 */
export interface Coupon {
  code: string; // always stored/looked-up uppercase
  description: string;
  discountPercent: number; // 1-100
  active: boolean;
  planRestriction: 'all' | BillingPeriod;
  maxRedemptions: number | null; // null = unlimited
  redemptionCount: number;
  expiresAt: string | null; // ISO date, null = never
  createdAt: string;
  updatedAt: string;
}

const couponsByCode = new SqliteMap<string, Coupon>('coupons');

export function listCoupons(): Coupon[] {
  return couponsByCode.values().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCoupon(code: string): Coupon | undefined {
  return couponsByCode.get(code.trim().toUpperCase());
}

export interface CreateCouponInput {
  code: string;
  description?: string;
  discountPercent: number;
  planRestriction?: Coupon['planRestriction'];
  maxRedemptions?: number | null;
  expiresAt?: string | null;
}

export function createCoupon(input: CreateCouponInput): Coupon {
  const code = input.code.trim().toUpperCase();
  const now = new Date().toISOString();
  const coupon: Coupon = {
    code,
    description: input.description ?? '',
    discountPercent: input.discountPercent,
    active: true,
    planRestriction: input.planRestriction ?? 'all',
    maxRedemptions: input.maxRedemptions ?? null,
    redemptionCount: 0,
    expiresAt: input.expiresAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
  couponsByCode.set(code, coupon);
  return coupon;
}

export interface UpdateCouponInput {
  description?: string;
  discountPercent?: number;
  active?: boolean;
  planRestriction?: Coupon['planRestriction'];
  maxRedemptions?: number | null;
  expiresAt?: string | null;
}

export function updateCoupon(code: string, patch: UpdateCouponInput): Coupon | null {
  const existing = getCoupon(code);
  if (!existing) return null;
  const updated: Coupon = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  couponsByCode.set(existing.code, updated);
  return updated;
}

export function deleteCoupon(code: string): boolean {
  const existing = getCoupon(code);
  if (!existing) return false;
  couponsByCode.delete(existing.code);
  return true;
}

export interface CouponValidation {
  valid: boolean;
  reason?: string;
  coupon?: Coupon;
  originalPriceCents?: number;
  discountedPriceCents?: number;
}

/** Validates a coupon for a specific plan + its current price - never mutates redemption state (see
 * redeemCoupon, called only once a purchase is actually confirmed). */
export function validateCouponForPlan(code: string, planId: BillingPeriod, priceCents: number): CouponValidation {
  const coupon = getCoupon(code);
  if (!coupon) return { valid: false, reason: 'Invalid coupon code.' };
  if (!coupon.active) return { valid: false, reason: 'This coupon is no longer active.' };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return { valid: false, reason: 'This coupon has expired.' };
  if (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions) {
    return { valid: false, reason: 'This coupon has reached its redemption limit.' };
  }
  if (coupon.planRestriction !== 'all' && coupon.planRestriction !== planId) {
    return { valid: false, reason: `This coupon only applies to the ${coupon.planRestriction} plan.` };
  }
  const discountedPriceCents = Math.round(priceCents * (1 - coupon.discountPercent / 100));
  return { valid: true, coupon, originalPriceCents: priceCents, discountedPriceCents };
}

export function redeemCoupon(code: string): void {
  const coupon = getCoupon(code);
  if (!coupon) return;
  couponsByCode.set(coupon.code, { ...coupon, redemptionCount: coupon.redemptionCount + 1, updatedAt: new Date().toISOString() });
}
