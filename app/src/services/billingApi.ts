import { request as baseRequest } from './apiRequest';
import { BillingPeriod, SubscriptionPlan, SubscriptionStatus } from '../types/billing';

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
  // Real funnel events only - there is deliberately no purchase-completion
  // call here. A genuine purchase can only ever be confirmed by a verified
  // billing SDK/webhook, never a client-reported "it worked" beacon.
  trackFunnelEvent(type: 'SUBSCRIPTION_SCREEN_OPENED' | 'SUBSCRIPTION_PLAN_SELECTED' | 'CHECKOUT_INITIATED', planId?: BillingPeriod): Promise<{ ok: boolean }> {
    return request('/billing/funnel-event', { method: 'POST', body: JSON.stringify({ type, planId }) });
  },
};
