import { Router } from 'express';
import { z } from 'zod';
import { SUBSCRIPTION_PLANS, getPlan, addPeriod, BillingPeriod } from '../data/subscriptionPlans';
import { getUserTier, userPlans } from '../data/store';
import { recordEvent } from '../events/eventTracker';

/**
 * Subscription plan listing and purchase-funnel tracking, NOT a purchase
 * API - there is no billing SDK wired into this app yet (see the Paywall
 * screen and the implementation report for what's missing). This exists so
 * the mobile app never hardcodes a price: it fetches the canonical plan
 * list from here, which is the same data data/subscriptionPlans.ts feeds
 * to everything else (admin panel, /dev/set-tier), so pricing can never
 * drift between the app and the backend.
 */

function currentUserId(req: any): string {
  return req.auth?.userId ?? 'demo-user';
}

const funnelEventSchema = z.object({
  // Deliberately NOT including PURCHASE_SUCCESS/PURCHASE_FAILED/PURCHASE_RESTORED
  // here - this app cannot complete a real purchase yet, so those event
  // types must only ever be written by a real, verified billing
  // integration (a future webhook/receipt-validation handler), never by a
  // client-reported "I clicked buy" beacon that could be spoofed into a
  // fake PURCHASE_SUCCESS event.
  type: z.enum(['SUBSCRIPTION_SCREEN_OPENED', 'SUBSCRIPTION_PLAN_SELECTED', 'CHECKOUT_INITIATED']),
  planId: z.enum(['monthly', 'quarterly', 'annual']).optional(),
});

export function buildBillingRouter() {
  const router = Router();

  router.get('/plans', (_req, res) => {
    res.json({ plans: SUBSCRIPTION_PLANS });
  });

  router.get('/status', (req, res) => {
    const userId = currentUserId(req);
    const tier = getUserTier(userId);
    const plan = userPlans.get(userId);
    res.json({
      tier,
      planId: plan?.planId ?? null,
      status: plan?.status ?? (tier === 'premium' ? 'active' : null),
      startedAt: plan?.startedAt ?? null,
      renewsAt: plan?.renewsAt ?? null,
      expiresAt: plan?.expiresAt ?? null,
    });
  });

  router.post('/funnel-event', (req, res) => {
    const parsed = funnelEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    const userId = currentUserId(req);
    recordEvent({
      userId,
      eventType: parsed.data.type,
      feature: 'subscription',
      metadata: parsed.data.planId ? { planId: parsed.data.planId } : undefined,
    });
    res.json({ ok: true });
  });

  return router;
}

/** Used only by /dev/set-tier (index.ts) to populate real plan metadata
 * for a dev-granted premium tier - see UserPlan's doc comment for why this
 * is still the only writer of these fields today. */
export function buildDevPlanMetadata(planId: BillingPeriod, startedAt: string) {
  const plan = getPlan(planId);
  return {
    planId: plan.id,
    productId: plan.storeProductId.android,
    priceCents: plan.priceCents,
    currency: plan.currency,
    startedAt,
    renewsAt: addPeriod(startedAt, plan.billingPeriod),
    status: 'active' as const,
  };
}
