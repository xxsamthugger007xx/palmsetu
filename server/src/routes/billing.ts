import { getBudgetStatus } from '../ai/budget';
import { Router, Request } from 'express';
import { z } from 'zod';
import { getSubscriptionPlans, getPlan, addPeriod, BillingPeriod } from '../data/subscriptionPlans';
import { getUserTier, userPlans, recordTransaction } from '../data/store';
import { recordEvent } from '../events/eventTracker';

/**
 * Subscription plan listing, purchase-funnel tracking, and real purchase
 * verification via RevenueCat. The mobile app never hardcodes a price: it
 * fetches the canonical plan list from here, the same data
 * data/subscriptionPlans.ts feeds to everything else (admin panel,
 * /dev/set-tier), so pricing can never drift between the app and backend.
 *
 * REVENUECAT_SECRET_API_KEY (server-only secret, never the public SDK key
 * the app uses) must be set for /confirm-purchase to do anything - without
 * it, this route honestly reports billing as unconfigured rather than
 * granting Premium on a client's unverified say-so.
 */

const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';

function revenueCatSecretKey(): string | null {
  return process.env.REVENUECAT_SECRET_API_KEY || null;
}

/** Reverse lookup: RevenueCat reports back whichever store product id the
 * purchase was actually for - map it to our own plan id rather than
 * trusting whatever planId the client claims to have bought. */
function planIdForProductId(productId: string): BillingPeriod | null {
  const plan = getSubscriptionPlans().find((p) => p.storeProductId.android === productId || p.storeProductId.ios === productId);
  return plan?.id ?? null;
}

function currentUserId(req: Request): string {
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
    res.json({ plans: getSubscriptionPlans() });
  });

  // Premium users' monthly AI allowance (estimated spend vs the cap) - see ai/budget.ts.
  router.get('/ai-budget', (req, res) => {
    res.json(getBudgetStatus(currentUserId(req)));
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

  // Lets the app know whether to show real purchase buttons at all, without
  // leaking the secret key itself.
  router.get('/configured', (_req, res) => {
    res.json({ configured: !!revenueCatSecretKey() });
  });

  // Called right after the client's RevenueCat SDK reports a successful
  // purchase/restore. Never trusts that report alone - re-checks the
  // subscriber's actual entitlement status against RevenueCat's own API
  // using the server-only secret key, so a compromised or buggy client can
  // never grant itself Premium. This is also what actually records a real
  // PURCHASE_SUCCESS event (the funnel-event route above deliberately
  // cannot).
  router.post('/confirm-purchase', async (req, res) => {
    const userId = currentUserId(req);
    const secretKey = revenueCatSecretKey();
    if (!secretKey) {
      return res.status(503).json({ error: 'Billing is not configured on this server yet.', code: 'BILLING_NOT_CONFIGURED' });
    }

    // Always the authenticated user's own id - NEVER a client-supplied one. (It used to read req.body.appUserId, so
    // anyone could submit a premium subscriber's id and be granted their Premium.) The app registers this same id
    // with RevenueCat, so purchases follow the account across devices.
    const appUserId = userId;

    let subscriber: any;
    try {
      const resp = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (!resp.ok) {
        return res.status(502).json({ error: `RevenueCat lookup failed (${resp.status}).`, code: 'VERIFICATION_FAILED' });
      }
      const body = (await resp.json()) as { subscriber: any };
      subscriber = body.subscriber;
    } catch (err) {
      console.error('[billing] RevenueCat verification request failed:', err);
      return res.status(502).json({ error: 'Could not verify purchase right now. Please try again.', code: 'VERIFICATION_FAILED' });
    }

    const entitlement = subscriber?.entitlements?.premium;
    const isActive = !!entitlement && (!entitlement.expires_date || new Date(entitlement.expires_date).getTime() > Date.now());
    if (!isActive) {
      return res.status(402).json({ error: 'No active Premium entitlement found for this purchase.', code: 'NOT_ENTITLED' });
    }

    const productId = entitlement.product_identifier as string;
    const planId = planIdForProductId(productId) ?? 'monthly';
    const plan = getPlan(planId);
    const now = new Date().toISOString();
    const wasPremium = getUserTier(userId) === 'premium';

    userPlans.set(userId, {
      userId,
      tier: 'premium',
      planId: plan.id,
      productId,
      priceCents: plan.priceCents,
      currency: plan.currency,
      startedAt: entitlement.purchase_date ?? now,
      renewsAt: entitlement.expires_date ?? addPeriod(now, plan.billingPeriod),
      status: 'active',
    });

    // Only record one transaction per genuinely new activation - RevenueCat
    // will call this again on every app-open/restore check, which must
    // never re-count as a new purchase.
    if (!wasPremium) {
      recordTransaction(userId, 'premium_subscription', plan.priceCents);
      recordEvent({ userId, eventType: 'PURCHASE_SUCCESS', feature: 'subscription', dedupeKey: `revenuecat:${appUserId}:${productId}`, metadata: { planId: plan.id, productId } });
    }

    res.json({ tier: 'premium', planId: plan.id, renewsAt: entitlement.expires_date ?? null });
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
