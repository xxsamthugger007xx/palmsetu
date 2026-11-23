import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import { buildBillingRouter } from './billing';
import { attachAuthContext } from '../auth/middleware';
import { signGuestToken } from '../auth/tokens';
import { getUserTier, transactions, userPlans } from '../data/store';
import { isOverBudget, addSpend } from '../ai/budget';

const app = express();
app.use(express.json());
app.use(attachAuthContext);
app.use('/billing', buildBillingRouter());

const guestId = () => `guest-${uuid()}`;
const bearer = (id: string) => ({ Authorization: `Bearer ${signGuestToken(id)}` });
const rc = (entitlement: object | null, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ subscriber: { entitlements: entitlement ? { premium: entitlement } : {} } }), { status }));

beforeEach(() => { process.env.REVENUECAT_SECRET_API_KEY = 'rc_secret'; });
afterEach(() => { vi.restoreAllMocks(); delete process.env.REVENUECAT_SECRET_API_KEY; });

describe('POST /billing/confirm-purchase', () => {
  it('503 BILLING_NOT_CONFIGURED when the server has no RevenueCat key', async () => {
    delete process.env.REVENUECAT_SECRET_API_KEY;
    const r = await request(app).post('/billing/confirm-purchase').set(bearer(guestId())).send({});
    expect(r.status).toBe(503); expect(r.body.code).toBe('BILLING_NOT_CONFIGURED');
  });

  it('402 NOT_ENTITLED when RevenueCat shows no active premium entitlement, and grants nothing', async () => {
    const id = guestId(); rc(null);
    const r = await request(app).post('/billing/confirm-purchase').set(bearer(id)).send({});
    expect(r.status).toBe(402); expect(r.body.code).toBe('NOT_ENTITLED');
    expect(getUserTier(id)).toBe('free');
  });

  it('402 for an entitlement that has already expired', async () => {
    const id = guestId(); rc({ expires_date: new Date(Date.now() - 86_400_000).toISOString(), product_identifier: 'palmsetu_premium_monthly' });
    expect((await request(app).post('/billing/confirm-purchase').set(bearer(id)).send({})).status).toBe(402);
    expect(getUserTier(id)).toBe('free');
  });

  it('502 VERIFICATION_FAILED when RevenueCat errors, and grants nothing', async () => {
    const id = guestId(); rc(null, 500);
    const r = await request(app).post('/billing/confirm-purchase').set(bearer(id)).send({});
    expect(r.status).toBe(502); expect(r.body.code).toBe('VERIFICATION_FAILED');
    expect(getUserTier(id)).toBe('free');
  });

  it('grants Premium for an active entitlement, maps the plan from the product id, and records ONE transaction even if called again', async () => {
    const id = guestId();
    rc({ expires_date: new Date(Date.now() + 30 * 86_400_000).toISOString(), purchase_date: new Date().toISOString(), product_identifier: 'palmsetu_premium_annual' });
    const first = await request(app).post('/billing/confirm-purchase').set(bearer(id)).send({});
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ tier: 'premium', planId: 'annual' });
    expect(getUserTier(id)).toBe('premium');
    const second = await request(app).post('/billing/confirm-purchase').set(bearer(id)).send({}); // app-open re-check
    expect(second.status).toBe(200);
    expect(transactions.filter((t: any) => t.userId === id && t.feature === 'premium_subscription').length).toBe(1);
    userPlans.delete(id);
  });

  it('asks RevenueCat about the signed-in user, never a client-supplied id, and treats no-expiry (lifetime) entitlements as active', async () => {
    const id = guestId();
    const f = rc({ expires_date: null, product_identifier: 'palmsetu_premium_monthly' });
    await request(app).post('/billing/confirm-purchase').set(bearer(id)).send({ appUserId: 'someone-elses-id' });
    expect(String(f.mock.calls[0][0])).toContain(encodeURIComponent(id));
    expect(String(f.mock.calls[0][0])).not.toContain('someone-elses-id');
    expect(getUserTier(id)).toBe('premium');
    userPlans.delete(id);
  });

  it('a purchase puts the user under the monthly AI cap, and the cap releases the moment Premium ends', async () => {
    const id = guestId();
    rc({ expires_date: new Date(Date.now() + 86_400_000).toISOString(), product_identifier: 'palmsetu_premium_monthly' });
    await request(app).post('/billing/confirm-purchase').set(bearer(id)).send({});
    addSpend(id, 150);
    expect(isOverBudget(id)).toBe(true);
    userPlans.delete(id);
    expect(isOverBudget(id)).toBe(false);
  });
});

describe('billing read endpoints', () => {
  it('status reflects the real plan; plans are served from the backend', async () => {
    const id = guestId();
    expect((await request(app).get('/billing/status').set(bearer(id))).body.tier).toBe('free');
    userPlans.set(id, { userId: id, tier: 'premium', planId: 'monthly', status: 'active' } as any);
    expect((await request(app).get('/billing/status').set(bearer(id))).body).toMatchObject({ tier: 'premium', planId: 'monthly' });
    const plans = await request(app).get('/billing/plans');
    expect(plans.body.plans.map((p: any) => p.id).sort()).toEqual(['annual', 'monthly', 'quarterly']);
    userPlans.delete(id);
  });

  it('configured reflects whether the server key exists', async () => {
    expect((await request(app).get('/billing/configured')).body).toEqual({ configured: true });
    delete process.env.REVENUECAT_SECRET_API_KEY;
    expect((await request(app).get('/billing/configured')).body).toEqual({ configured: false });
  });
});
