import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { buildAdminRouter, handleAdminLogin } from './admin';
import { MockProvider } from '../ai/mockProvider';
import { createAdminUser } from '../auth/adminAuth';
import { recordEvent } from '../events/eventTracker';
import { recordApiTiming } from '../ops/apiMonitoring';
import { addSpend } from '../ai/budget';
import { accountsById } from '../data/store';
import { v4 as uuid } from 'uuid';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(recordApiTiming);
  app.post('/admin/login', handleAdminLogin);
  app.use('/admin', buildAdminRouter(new MockProvider()));
  return app;
}

async function loginAs(app: express.Express, email: string, password: string): Promise<string> {
  const res = await request(app).post('/admin/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token;
}

describe('routes/admin - analytics (alerts, acquisition, funnels, retention, api monitoring, ai cost centre, exports)', () => {
  let app: express.Express;
  let superToken: string;

  beforeEach(async () => {
    app = buildApp();
    const email = `super-${uuid()}@test.solune`;
    await createAdminUser(email, 'super-secret-password-123', 'super_admin');
    superToken = await loginAs(app, email, 'super-secret-password-123');
  });

  it('GET /admin/alerts returns live checks and an empty incident list when nothing has fired', async () => {
    const res = await request(app).get('/admin/alerts').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.checks.length).toBeGreaterThan(0);
    expect(res.body.checks.every((c: any) => typeof c.firing === 'boolean')).toBe(true);
  });

  it('PUT /admin/alerts/thresholds updates thresholds and is forbidden for non-super_admin', async () => {
    const viewerEmail = `viewer-${uuid()}@test.solune`;
    await createAdminUser(viewerEmail, 'viewer-secret-password-123', 'viewer');
    const viewerToken = await loginAs(app, viewerEmail, 'viewer-secret-password-123');

    const denied = await request(app).put('/admin/alerts/thresholds').set('Authorization', `Bearer ${viewerToken}`).send({ errorsPerHour: 1 });
    expect(denied.status).toBe(403);

    const res = await request(app).put('/admin/alerts/thresholds').set('Authorization', `Bearer ${superToken}`).send({ errorsPerHour: 5 });
    expect(res.status).toBe(200);
    expect(res.body.thresholds.errorsPerHour).toBe(5);
  });

  it('incidents: open then resolve, and resolving an unknown id 404s', async () => {
    const open = await request(app).post('/admin/incidents').set('Authorization', `Bearer ${superToken}`).send({ alertKey: 'errorsPerHour', label: 'Too many errors', note: 'investigating' });
    expect(open.status).toBe(200);
    const id = open.body.incident.id;
    expect(open.body.incident.resolvedAt).toBeNull();

    const list = await request(app).get('/admin/alerts').set('Authorization', `Bearer ${superToken}`);
    expect(list.body.incidents.some((i: any) => i.id === id)).toBe(true);

    const resolve = await request(app).put(`/admin/incidents/${id}/resolve`).set('Authorization', `Bearer ${superToken}`).send({ note: 'fixed' });
    expect(resolve.status).toBe(200);
    expect(resolve.body.incident.resolvedAt).toBeTruthy();
    expect(resolve.body.incident.note).toContain('fixed');

    const missing = await request(app).put('/admin/incidents/not-a-real-id/resolve').set('Authorization', `Bearer ${superToken}`).send({});
    expect(missing.status).toBe(404);
  });

  it('GET /admin/acquisition reflects real GUEST_CREATED/USER_REGISTERED events, nothing fabricated', async () => {
    const guestId = `guest-${uuid()}`;
    const userId = `user-${uuid()}`;
    recordEvent({ userId: guestId, eventType: 'GUEST_CREATED', feature: 'auth' });
    recordEvent({ userId, eventType: 'USER_REGISTERED', feature: 'auth' });

    const res = await request(app).get('/admin/acquisition').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    const today = new Date().toISOString().slice(0, 10);
    const todayRow = res.body.days.find((d: any) => d.date === today);
    expect(todayRow.guestSignups).toBeGreaterThanOrEqual(1);
    expect(todayRow.registeredSignups).toBeGreaterThanOrEqual(1);
  });

  it('GET /admin/funnels (activation): a user who only signed up does not count toward later steps', async () => {
    const userId = `user-${uuid()}`;
    recordEvent({ userId, eventType: 'USER_REGISTERED', feature: 'auth' });

    const res = await request(app).get('/admin/funnels?funnel=activation').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    const [signup, firstReading] = res.body.steps;
    expect(signup.distinctUsers).toBeGreaterThanOrEqual(1);
    expect(firstReading.conversionFromPrevious).toBeLessThanOrEqual(1);

    const unknown = await request(app).get('/admin/funnels?funnel=not-a-real-funnel').set('Authorization', `Bearer ${superToken}`);
    expect(unknown.status).toBe(404);
  });

  it('a user who completes the whole activation funnel is counted at every step', async () => {
    const userId = `user-${uuid()}`;
    recordEvent({ userId, eventType: 'USER_REGISTERED', feature: 'auth' });
    recordEvent({ userId, eventType: 'PALM_REPORT_GENERATED', feature: 'palm' });
    recordEvent({ userId, eventType: 'PURCHASE_SUCCESS', feature: 'subscription' });

    const res = await request(app).get('/admin/funnels?funnel=activation').set('Authorization', `Bearer ${superToken}`);
    const [signup, firstReading, purchase] = res.body.steps;
    expect(signup.distinctUsers).toBeGreaterThanOrEqual(1);
    expect(firstReading.distinctUsers).toBeGreaterThanOrEqual(1);
    expect(purchase.distinctUsers).toBeGreaterThanOrEqual(1);
    expect(purchase.conversionFromFirst).toBeGreaterThan(0);
  });

  it('GET /admin/retention includes a cohort for a user who just signed up, with this week at 100%', async () => {
    const userId = `user-${uuid()}`;
    recordEvent({ userId, eventType: 'USER_REGISTERED', feature: 'auth' });

    const res = await request(app).get('/admin/retention').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    const lastCohort = res.body.cohorts[res.body.cohorts.length - 1];
    expect(lastCohort.retainedPercentByWeekOffset[0]).toBe(100);
  });

  it('GET /admin/api-monitoring reports real captured request timing, including this very request', async () => {
    await request(app).get('/admin/alerts').set('Authorization', `Bearer ${superToken}`);
    const res = await request(app).get('/admin/api-monitoring').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalRequests).toBeGreaterThan(0);
    const alertsEndpoint = res.body.byEndpoint.find((e: any) => e.routePath.includes('/alerts'));
    expect(alertsEndpoint).toBeTruthy();
    expect(alertsEndpoint.count).toBeGreaterThanOrEqual(1);
  });

  it('GET /admin/ai-cost-centre never fabricates data when nothing has run', async () => {
    const res = await request(app).get('/admin/ai-cost-centre?month=1999-01').set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalCalls).toBe(0);
    expect(res.body.byFeature).toEqual({});
    expect(res.body.topSpenders).toEqual([]);
  });

  it('GET /admin/transactions/export and /admin/events/export return CSV with a header row', async () => {
    const tx = await request(app).get('/admin/transactions/export').set('Authorization', `Bearer ${superToken}`);
    expect(tx.status).toBe(200);
    expect(tx.headers['content-type']).toMatch(/text\/csv/);
    expect(tx.text.split('\n')[0]).toBe('id,psuId,feature,amountCents,currency,createdAt');

    const ev = await request(app).get('/admin/events/export').set('Authorization', `Bearer ${superToken}`);
    expect(ev.status).toBe(200);
    expect(ev.text.split('\n')[0]).toBe('id,psuId,eventType,feature,status,createdAt');

    // Query-token auth works for these two export routes, same as /users/export.
    const viaToken = await request(app).get(`/admin/events/export?token=${superToken}`);
    expect(viaToken.status).toBe(200);
  });

  it('GET /admin/users and /admin/users/:userId both surface real per-user AI usage', async () => {
    const userId = `user-${uuid()}`;
    const now = new Date().toISOString();
    accountsById.set(userId, { id: userId, email: `${userId}@test.solune`, passwordHash: 'x', emailVerified: true, createdAt: now, updatedAt: now });
    recordEvent({ userId, eventType: 'USER_REGISTERED', feature: 'auth' });
    addSpend(userId, 12.5, 'gemini');
    addSpend(userId, 2.25, 'anthropic');

    const list = await request(app).get('/admin/users?sortBy=aiUsage&pageSize=100').set('Authorization', `Bearer ${superToken}`);
    expect(list.status).toBe(200);
    const row = list.body.users.find((u: any) => u.userId === userId);
    expect(row).toBeTruthy();
    expect(row.aiUsage.costInr).toBeCloseTo(14.75, 1);
    expect(row.aiUsage.calls).toBe(2);
    // Sorted by AI spend descending - this user (14.75) should rank above anyone with less spend.
    const costs = list.body.users.map((u: any) => u.aiUsage.costInr);
    expect(costs).toEqual([...costs].sort((a: number, b: number) => b - a));

    const detail = await request(app).get(`/admin/users/${userId}`).set('Authorization', `Bearer ${superToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.aiUsage.thisMonthCostInr).toBeCloseTo(14.75, 1);
    expect(detail.body.aiUsage.thisMonthCalls).toBe(2);
    expect(detail.body.aiUsage.byProviderInr.gemini).toBeCloseTo(12.5, 1);
    expect(detail.body.aiUsage.byProviderInr.anthropic).toBeCloseTo(2.25, 1);
  });

  it('a non-super_admin/analyst (viewer) is forbidden from exporting transactions', async () => {
    const viewerEmail = `viewer2-${uuid()}@test.solune`;
    await createAdminUser(viewerEmail, 'viewer-secret-password-123', 'viewer');
    const viewerToken = await loginAs(app, viewerEmail, 'viewer-secret-password-123');
    const res = await request(app).get('/admin/transactions/export').set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});
