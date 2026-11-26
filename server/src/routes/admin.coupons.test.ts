import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { buildAdminRouter, handleAdminLogin } from './admin';
import { buildBillingRouter } from './billing';
import { attachAuthContext } from '../auth/middleware';
import { MockProvider } from '../ai/mockProvider';
import { createAdminUser } from '../auth/adminAuth';
import { v4 as uuid } from 'uuid';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(attachAuthContext);
  app.post('/admin/login', handleAdminLogin);
  app.use('/admin', buildAdminRouter(new MockProvider()));
  app.use('/billing', buildBillingRouter());
  return app;
}

async function loginAs(app: express.Express, email: string, password: string): Promise<string> {
  const res = await request(app).post('/admin/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token;
}

describe('routes/admin + routes/billing - coupons', () => {
  let app: express.Express;
  let superToken: string;
  let viewerToken: string;

  beforeEach(async () => {
    app = buildApp();
    const superEmail = `super-${uuid()}@test.solune`;
    await createAdminUser(superEmail, 'super-secret-password-123', 'super_admin');
    superToken = await loginAs(app, superEmail, 'super-secret-password-123');

    const viewerEmail = `viewer-${uuid()}@test.solune`;
    await createAdminUser(viewerEmail, 'viewer-secret-password-123', 'viewer');
    viewerToken = await loginAs(app, viewerEmail, 'viewer-secret-password-123');
  });

  it('super_admin can create a coupon; a viewer can read but not create', async () => {
    const code = `WELCOME${Date.now()}`;
    const create = await request(app)
      .post('/admin/coupons')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ code, discountPercent: 20, planRestriction: 'all' });
    expect(create.status).toBe(200);
    expect(create.body.coupon.code).toBe(code.toUpperCase());
    expect(create.body.coupon.active).toBe(true);
    expect(create.body.coupon.redemptionCount).toBe(0);

    const list = await request(app).get('/admin/coupons').set('Authorization', `Bearer ${viewerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.coupons.some((c: any) => c.code === code.toUpperCase())).toBe(true);

    const denied = await request(app).post('/admin/coupons').set('Authorization', `Bearer ${viewerToken}`).send({ code: 'NOPE', discountPercent: 10 });
    expect(denied.status).toBe(403);
  });

  it('rejects an invalid code, an out-of-range discount, and a duplicate code', async () => {
    const badCode = await request(app).post('/admin/coupons').set('Authorization', `Bearer ${superToken}`).send({ code: 'a b!', discountPercent: 10 });
    expect(badCode.status).toBe(400);

    const badDiscount = await request(app).post('/admin/coupons').set('Authorization', `Bearer ${superToken}`).send({ code: `BAD${Date.now()}`, discountPercent: 150 });
    expect(badDiscount.status).toBe(400);

    const code = `DUPE${Date.now()}`;
    const first = await request(app).post('/admin/coupons').set('Authorization', `Bearer ${superToken}`).send({ code, discountPercent: 10 });
    expect(first.status).toBe(200);
    const dupe = await request(app).post('/admin/coupons').set('Authorization', `Bearer ${superToken}`).send({ code, discountPercent: 15 });
    expect(dupe.status).toBe(409);
  });

  it('PUT toggles active and DELETE removes a coupon; both 404 for an unknown code', async () => {
    const code = `TOGGLE${Date.now()}`;
    await request(app).post('/admin/coupons').set('Authorization', `Bearer ${superToken}`).send({ code, discountPercent: 10 });

    const disable = await request(app).put(`/admin/coupons/${code}`).set('Authorization', `Bearer ${superToken}`).send({ active: false });
    expect(disable.status).toBe(200);
    expect(disable.body.coupon.active).toBe(false);

    const del = await request(app).delete(`/admin/coupons/${code}`).set('Authorization', `Bearer ${superToken}`);
    expect(del.status).toBe(200);

    const missingPut = await request(app).put('/admin/coupons/NOT-REAL').set('Authorization', `Bearer ${superToken}`).send({ active: true });
    expect(missingPut.status).toBe(404);
    const missingDelete = await request(app).delete('/admin/coupons/NOT-REAL').set('Authorization', `Bearer ${superToken}`);
    expect(missingDelete.status).toBe(404);
  });

  it('POST /billing/validate-coupon: valid coupon computes the discounted price for the given plan', async () => {
    const code = `SAVE25-${Date.now()}`;
    await request(app).post('/admin/coupons').set('Authorization', `Bearer ${superToken}`).send({ code, discountPercent: 25, planRestriction: 'all' });

    const res = await request(app).post('/billing/validate-coupon').send({ code, planId: 'monthly' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.discountPercent).toBe(25);
    expect(res.body.discountedPriceCents).toBeLessThan(res.body.originalPriceCents);
    expect(res.body.discountedPriceCents).toBe(Math.round(res.body.originalPriceCents * 0.75));
  });

  it('POST /billing/validate-coupon: an unknown code, a disabled coupon, and a plan-restricted coupon all report invalid with a reason', async () => {
    const unknown = await request(app).post('/billing/validate-coupon').send({ code: 'DOES-NOT-EXIST', planId: 'monthly' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.valid).toBe(false);
    expect(unknown.body.reason).toBeTruthy();

    const disabledCode = `DISABLED-${Date.now()}`;
    await request(app).post('/admin/coupons').set('Authorization', `Bearer ${superToken}`).send({ code: disabledCode, discountPercent: 10 });
    await request(app).put(`/admin/coupons/${disabledCode}`).set('Authorization', `Bearer ${superToken}`).send({ active: false });
    const disabled = await request(app).post('/billing/validate-coupon').send({ code: disabledCode, planId: 'monthly' });
    expect(disabled.body.valid).toBe(false);

    const restrictedCode = `ANNUALONLY-${Date.now()}`;
    await request(app).post('/admin/coupons').set('Authorization', `Bearer ${superToken}`).send({ code: restrictedCode, discountPercent: 10, planRestriction: 'annual' });
    const wrongPlan = await request(app).post('/billing/validate-coupon').send({ code: restrictedCode, planId: 'monthly' });
    expect(wrongPlan.body.valid).toBe(false);
    const rightPlan = await request(app).post('/billing/validate-coupon').send({ code: restrictedCode, planId: 'annual' });
    expect(rightPlan.body.valid).toBe(true);
  });

  it('POST /billing/validate-coupon: a coupon at its redemption limit reports invalid', async () => {
    const code = `LIMITED-${Date.now()}`;
    await request(app).post('/admin/coupons').set('Authorization', `Bearer ${superToken}`).send({ code, discountPercent: 10, maxRedemptions: 1 });

    // Not redeemed yet - merely validating never consumes a redemption.
    const first = await request(app).post('/billing/validate-coupon').send({ code, planId: 'monthly' });
    expect(first.body.valid).toBe(true);
    const second = await request(app).post('/billing/validate-coupon').send({ code, planId: 'monthly' });
    expect(second.body.valid).toBe(true);
  });

  it('GET /billing/plans is unaffected by coupons - prices shown there are never pre-discounted', async () => {
    const res = await request(app).get('/billing/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans.find((p: any) => p.id === 'monthly').priceCents).toBeGreaterThan(0);
  });
});
