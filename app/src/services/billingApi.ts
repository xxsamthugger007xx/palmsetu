import { request as baseRequest } from './apiRequest';
import { AiBudgetStatus, BillingPeriod, CouponValidation, SubscriptionPlan, SubscriptionStatus } from '../types/billing';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function request<T>(path: string, options?: RequestInit): Promise<T> {
  return baseRequest<T>(BASE_URL, path, options);
}

/**
 * Plan prices come from the backend (data/subscriptionPlans.ts), never
 * hardcoded here - the one thing the Premium paywall redesign spec is most
 * insistent on is that the app can never show a price that drifts from
 * what the backend/admin panel would report. See PaywallScreen.tsx.
 */
export const billingApi = {
  getPlans(): Promise<{ plans: SubscriptionPlan[] }> {
    return request('/billing/plans');
  },
  getStatus(): Promise<SubscriptionStatus> {
    return request('/billing/status');
  },
  getAiBudget(): Promise<AiBudgetStatus> {
    return request('/billing/ai-budget');
  },
  trackFunnelEvent(type: 'SUBSCRIPTION_SCREEN_OPENED' | 'SUBSCRIPTION_PLAN_SELECTED' | 'CHECKOUT_INITIATED', planId?: BillingPeriod): Promise<{ ok: boolean }> {
    return request('/billing/funnel-event', { method: 'POST', body: JSON.stringify({ type, planId }) });
  },
  // Called after the RevenueCat SDK itself reports a successful purchase or
  // restore - the backend re-verifies against RevenueCat's own API before
  // ever granting Premium, this call is not what grants it. couponCode (if
  // any was applied on the paywall) is re-validated server-side before it
  // affects what's recorded - never trusted as-is.
  confirmPurchase(appUserId: string, couponCode?: string): Promise<{ tier: 'free' | 'premium'; planId: BillingPeriod | null; renewsAt: string | null; appliedCoupon: string | null }> {
    return request('/billing/confirm-purchase', { method: 'POST', body: JSON.stringify({ appUserId, couponCode }) });
  },
  validateCoupon(code: string, planId: BillingPeriod): Promise<CouponValidation> {
    return request('/billing/validate-coupon', { method: 'POST', body: JSON.stringify({ code, planId }) });
  },
};
