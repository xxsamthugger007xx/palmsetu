import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { buildAdminRouter, handleAdminLogin } from './admin';
import { MockProvider } from '../ai/mockProvider';
import { createAdminUser } from '../auth/adminAuth';
import { getPricingCents, setPricingCents, defaultPricingCents } from '../data/pricing';
import { getSubscriptionBasePrices, setSubscriptionBasePrices, defaultSubscriptionBasePrices } from '../data/subscriptionPlans';
import { getAiBudgetCaps, setAiBudgetCaps } from '../ai/budget';
import { getFeatureFlags, setFeatureFlag } from '../data/featureFlags';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/admin/login', handleAdminLogin);
  app.use('/admin', buildAdminRouter(new MockProvider()));
  return app;
}

async function loginAs(app: express.Express, email: string, password: string): Promise<string> {
  const res = await request(app).post('/admin/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token;
}

describe('routes/admin - live config (pricing, AI budget, feature flags, admin users)', () => {
  let app: express.Express;
  let superToken: string;
  let viewerToken: string;

  beforeEach(async () => {
    app = buildApp();
    // Reset every config domain back to defaults so tests don't leak state across runs.
    setPricingCents(defaultPricingCents());
    setSubscriptionBasePrices(defaultSubscriptionBasePrices());
    setAiBudgetCaps({ premiumMonthlyBudgetInr: 100, freeMonthlyBudgetInr: 25, freeChatDailyMessages: 5, freeChatMonthlyInr: 10, freeChatDailyPerIp: 60 });
    for (const f of getFeatureFlags()) setFeatureFlag(f.key, true);

    const superEmail = `super-${Date.now()}@test.solune`;
    await createAdminUser(superEmail, 'super-secret-password-123', 'super_admin');
    superToken = await loginAs(app, superEmail, 'super-secret-password-123');

    const viewerEmail = `viewer-${Date.now()}@test.solune`;
    await createAdminUser(viewerEmail, 'viewer-secret-password-123', 'viewer');
    viewerToken = await loginAs(app, viewerEmail, 'viewer-secret-password-123');
  });

  it('GET /admin/pricing is readable by any admin role and reflects live overrides', async () => {
    const res = await request(app).get('/admin/pricing').set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.subscriptionPlans).toHaveLength(3);
    expect(res.body.featurePricingCents.soulmate_sketch).toBe(9900);
  });

  it('PUT /admin/pricing updates subscription base prices and feature prices, recomputing derived plan fields', async () => {
    const res = await request(app)
      .put('/admin/pricing')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ subscriptionBasePrices: { monthlyCents: 59900 }, featurePricingCents: { soulmate_sketch: 14900 } });
    expect(res.status).toBe(200);
    expect(res.body.subscriptionBasePrices.monthlyCents).toBe(59900);
    expect(res.body.featurePricingCents.soulmate_sketch).toBe(14900);
    const monthlyPlan = res.body.subscriptionPlans.find((p: any) => p.id === 'monthly');
    expect(monthlyPlan.priceCents).toBe(59900);
    expect(monthlyPlan.effectiveMonthlyCents).toBe(59900);

    // Persisted - a fresh read sees the same values.
    expect(getPricingCents().soulmate_sketch).toBe(14900);
    expect(getSubscriptionBasePrices().monthlyCents).toBe(59900);
  });

  it('PUT /admin/pricing is forbidden for a non-super_admin role', async () => {
    const res = await request(app).put('/admin/pricing').set('Authorization', `Bearer ${viewerToken}`).send({ subscriptionBasePrices: { monthlyCents: 1 } });
    expect(res.status).toBe(403);
  });

  it('PUT /admin/pricing ignores non-numeric or negative values rather than corrupting state', async () => {
    const before = getPricingCents().soulmate_sketch;
    const res = await request(app)
      .put('/admin/pricing')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ featurePricingCents: { soulmate_sketch: -5 }, subscriptionBasePrices: { monthlyCents: 'not-a-number' } });
    expect(res.status).toBe(200);
    expect(res.body.featurePricingCents.soulmate_sketch).toBe(before);
  });

  it('GET/PUT /admin/ai-budget round-trips live budget caps', async () => {
    const put = await request(app)
      .put('/admin/ai-budget')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ premiumMonthlyBudgetInr: 250, freeChatDailyMessages: 10 });
    expect(put.status).toBe(200);
    expect(put.body.caps.premiumMonthlyBudgetInr).toBe(250);
    expect(put.body.caps.freeChatDailyMessages).toBe(10);

    const get = await request(app).get('/admin/ai-budget').set('Authorization', `Bearer ${viewerToken}`);
    expect(get.body.caps.premiumMonthlyBudgetInr).toBe(250);
    expect(getAiBudgetCaps().premiumMonthlyBudgetInr).toBe(250);
  });

  it('GET/PUT /admin/feature-flags toggles a flag live and is denied for non-super_admin writes', async () => {
    const get = await request(app).get('/admin/feature-flags').set('Authorization', `Bearer ${viewerToken}`);
    expect(get.status).toBe(200);
    const flag = get.body.flags.find((f: any) => f.key === 'soulmateSketch');
    expect(flag.enabled).toBe(true);

    const denied = await request(app).put('/admin/feature-flags/soulmateSketch').set('Authorization', `Bearer ${viewerToken}`).send({ enabled: false });
    expect(denied.status).toBe(403);

    const put = await request(app).put('/admin/feature-flags/soulmateSketch').set('Authorization', `Bearer ${superToken}`).send({ enabled: false });
    expect(put.status).toBe(200);
    expect(put.body.flags.find((f: any) => f.key === 'soulmateSketch').enabled).toBe(false);

    const unknown = await request(app).put('/admin/feature-flags/notARealFlag').set('Authorization', `Bearer ${superToken}`).send({ enabled: false });
    expect(unknown.status).toBe(404);
  });

  it('admin (staff) management: super_admin can invite, change role, and disable another admin', async () => {
    const newEmail = `staff-${Date.now()}@test.solune`;
    const create = await request(app)
      .post('/admin/admins')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ email: newEmail, password: 'a-decent-password-123', role: 'analyst' });
    expect(create.status).toBe(200);
    expect(create.body.role).toBe('analyst');
    const newId = create.body.id;

    const list = await request(app).get('/admin/admins').set('Authorization', `Bearer ${superToken}`);
    expect(list.status).toBe(200);
    expect(list.body.admins.some((a: any) => a.id === newId)).toBe(true);

    const roleChange = await request(app).put(`/admin/admins/${newId}/role`).set('Authorization', `Bearer ${superToken}`).send({ role: 'viewer' });
    expect(roleChange.status).toBe(200);

    const disable = await request(app).put(`/admin/admins/${newId}/status`).set('Authorization', `Bearer ${superToken}`).send({ status: 'disabled' });
    expect(disable.status).toBe(200);

    // A disabled admin's sessions are revoked and they can no longer log in.
    const loginAttempt = await request(app).post('/admin/login').send({ email: newEmail, password: 'a-decent-password-123' });
    expect(loginAttempt.status).toBe(401);
  });

  it('a non-super_admin cannot list or manage admin accounts', async () => {
    const list = await request(app).get('/admin/admins').set('Authorization', `Bearer ${viewerToken}`);
    expect(list.status).toBe(403);
    const create = await request(app).post('/admin/admins').set('Authorization', `Bearer ${viewerToken}`).send({ email: 'x@test.solune', password: 'whatever-12345', role: 'viewer' });
    expect(create.status).toBe(403);
  });

  it('a user cannot disable their own admin account', async () => {
    const selfEmail = `self-${Date.now()}@test.solune`;
    await createAdminUser(selfEmail, 'self-secret-password-123', 'super_admin');
    const selfToken = await loginAs(app, selfEmail, 'self-secret-password-123');
    const whoami = await request(app).get('/admin/admins').set('Authorization', `Bearer ${selfToken}`);
    const self = whoami.body.admins.find((a: any) => a.email === selfEmail);
    const res = await request(app).put(`/admin/admins/${self.id}/status`).set('Authorization', `Bearer ${selfToken}`).send({ status: 'disabled' });
    expect(res.status).toBe(400);
  });
});
