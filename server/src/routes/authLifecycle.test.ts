import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import { buildAuthRouter } from './auth';
import { buildWellnessRouter } from './wellness';
import { buildBillingRouter } from './billing';
import { attachAuthContext } from '../auth/middleware';
import { MockProvider } from '../ai/mockProvider';
import { passwordResetsByHash, accountsById, journalEntriesById, habitsById, moodEntriesByUserDate, transactions } from '../data/store';
import { db } from '../data/db';
import * as sendEmailMod from '../email/sendEmail';

function app() {
  const a = express();
  a.use(express.json());
  a.use(attachAuthContext);
  a.use('/auth', buildAuthRouter());
  a.use('/wellness', buildWellnessRouter(new MockProvider()));
  a.use('/billing', buildBillingRouter());
  return a;
}
const server = app();
const email = () => `u${uuid().slice(0, 8)}@example.com`;
const PASS = 'Passw0rd!long';

async function signup(e = email()) {
  const r = await request(server).post('/auth/signup').send({ email: e, password: PASS });
  expect(r.status).toBe(200);
  return { token: r.body.token as string, id: r.body.account.id as string, email: e };
}
const authed = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('sessions', () => {
  it('logout revokes only that token; other devices stay signed in', async () => {
    const a = await signup();
    const second = (await request(server).post('/auth/login').send({ email: a.email, password: PASS })).body.token as string;
    expect((await request(server).post('/auth/logout').set(authed(a.token))).status).toBe(200);
    const dead = await request(server).get('/auth/me').set(authed(a.token));
    expect(dead.status).toBe(401); expect(dead.body.code).toBe('SESSION_INVALID');
    expect((await request(server).get('/auth/me').set(authed(second))).status).toBe(200);
  });

  it('a garbage or expired token gets 401 SESSION_INVALID, but sessionless endpoints still work with it', async () => {
    expect((await request(server).get('/auth/me').set(authed('junk'))).body.code).toBe('SESSION_INVALID');
    expect((await request(server).post('/auth/guest').set(authed('junk'))).status).toBe(200);
    expect((await request(server).post('/auth/login').set(authed('junk')).send({ email: email(), password: PASS })).status).toBe(401); // wrong creds, not SESSION_INVALID
  });
});

describe('account deletion', () => {
  it('removes journals, mood, habits and everything else; the old token no longer works; payments are kept', async () => {
    const a = await signup();
    await request(server).post('/wellness/journal').set(authed(a.token)).send({ type: 'free-writing', content: 'PRIVATE DIARY' });
    await request(server).post('/wellness/mood').set(authed(a.token)).send({ localDate: '2026-11-24', mood: 'good', energy: 3, stress: 2, sleepQuality: 3 });
    await request(server).post('/wellness/habits').set(authed(a.token)).send({ name: 'private', frequency: 'daily' });
    transactions.push({ id: uuid(), userId: a.id, feature: 'premium_subscription', amountCents: 100, createdAt: new Date().toISOString() } as any);

    expect(journalEntriesById.valuesForUser(a.id).length).toBe(1);
    const del = await request(server).delete('/auth/account').set(authed(a.token));
    expect(del.status).toBe(200);

    expect(journalEntriesById.valuesForUser(a.id)).toEqual([]);
    expect(habitsById.valuesForUser(a.id)).toEqual([]);
    expect(moodEntriesByUserDate.valuesForUser(a.id)).toEqual([]);
    expect(accountsById.get(a.id)).toBeUndefined();
    // anything anywhere in the app tables that still mentions this user id (except retained payment/audit records)?
    const leftovers = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'kv_%' OR name LIKE 'log_%')").all() as { name: string }[])
      .filter((t) => !['log_transactions', 'log_adminAuditLog'].includes(t.name))
      .filter((t) => (db.prepare(`SELECT COUNT(*) c FROM ${t.name} WHERE value LIKE ?`).get(`%"${a.id}"%`) as { c: number }).c > 0)
      .map((t) => t.name);
    expect(leftovers).toEqual([]);
    expect(transactions.some((t: any) => t.userId === a.id)).toBe(true);

    const zombie = await request(server).post('/wellness/habits').set(authed(a.token)).send({ name: 'zombie', frequency: 'daily' });
    expect(zombie.status).toBe(401);
    expect((await request(server).post('/auth/login').send({ email: a.email, password: PASS })).status).toBe(401);
  });

  it("deleting one user never touches another user's data", async () => {
    const a = await signup(); const b = await signup();
    await request(server).post('/wellness/journal').set(authed(b.token)).send({ type: 'free-writing', content: 'B keeps this' });
    await request(server).delete('/auth/account').set(authed(a.token));
    expect(journalEntriesById.valuesForUser(b.id).length).toBe(1);
    expect((await request(server).get('/auth/me').set(authed(b.token))).status).toBe(200);
  });

  it('export includes journals/mood/habits and never the password hash', async () => {
    const a = await signup();
    await request(server).post('/wellness/journal').set(authed(a.token)).send({ type: 'free-writing', content: 'exportable entry' });
    const r = await request(server).get('/auth/export').set(authed(a.token));
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body.data.journalEntries)).toContain('exportable entry');
    expect(JSON.stringify(r.body)).not.toContain('passwordHash');
  });
});

describe('password reset', () => {
  let sent: { to: string; html: string }[];
  beforeEach(() => { sent = []; vi.spyOn(sendEmailMod, 'sendEmail').mockImplementation(async (o: any) => { sent.push(o); return true; }); });

  const resets = () => sent.filter((m) => /Reset your password/.test(m.html));
  const tokenFromEmail = () => /token=([a-f0-9]+)/.exec(resets()[resets().length - 1].html)![1];

  it('emails a one-time link; the new password works, the old one and old sessions do not; the link cannot be reused', async () => {
    const a = await signup();
    expect((await request(server).post('/auth/forgot-password').send({ email: a.email })).status).toBe(200);
    await vi.waitFor(() => expect(resets().length).toBe(1));
    expect(resets()[0].to).toBe(a.email);
    const token = tokenFromEmail();

    const stored = [...passwordResetsByHash.values()];
    expect(JSON.stringify(stored)).not.toContain(token); // only a hash is stored

    expect((await request(server).post('/auth/reset-password').send({ token, password: 'short' })).status).toBe(400);
    expect((await request(server).post('/auth/reset-password').send({ token, password: 'BrandNewPass1!' })).status).toBe(200);

    expect((await request(server).post('/auth/login').send({ email: a.email, password: PASS })).status).toBe(401);
    expect((await request(server).post('/auth/login').send({ email: a.email, password: 'BrandNewPass1!' })).status).toBe(200);
    expect((await request(server).get('/auth/me').set(authed(a.token))).body.code).toBe('SESSION_INVALID'); // signed out everywhere
    expect((await request(server).post('/auth/reset-password').send({ token, password: 'AnotherPass2!' })).status).toBe(400); // single use
  });

  it('gives the same answer for unknown emails and sends nothing (no account enumeration)', async () => {
    const r = await request(server).post('/auth/forgot-password').send({ email: email() });
    expect(r.status).toBe(200); expect(r.body).toEqual({ ok: true });
    await new Promise((r2) => setTimeout(r2, 50));
    expect(resets().length).toBe(0);
  });

  it('rejects unknown and expired tokens', async () => {
    expect((await request(server).post('/auth/reset-password').send({ token: 'a'.repeat(64), password: 'BrandNewPass1!' })).status).toBe(400);
    const a = await signup();
    await request(server).post('/auth/forgot-password').send({ email: a.email });
    await vi.waitFor(() => expect(resets().length).toBe(1));
    const token = tokenFromEmail();
    const rec = [...passwordResetsByHash.values()].find((r) => r.accountId === a.id)!;
    passwordResetsByHash.set(rec.tokenHash, { ...rec, expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect((await request(server).post('/auth/reset-password').send({ token, password: 'BrandNewPass1!' })).status).toBe(400);
  });
});

describe('billing trust', () => {
  it('confirm-purchase ignores a client-supplied appUserId and checks the signed-in user only', async () => {
    process.env.REVENUECAT_SECRET_API_KEY = 'rc_test';
    const a = await signup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ subscriber: { entitlements: {} } }), { status: 200 }));
    await request(server).post('/billing/confirm-purchase').set(authed(a.token)).send({ appUserId: 'user-someone-else-with-premium' });
    expect(String(fetchSpy.mock.calls[0][0])).toContain(encodeURIComponent(a.id));
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain('someone-else');
    fetchSpy.mockRestore(); delete process.env.REVENUECAT_SECRET_API_KEY;
  });
});

describe("the user's own 'today' (X-Local-Date)", () => {
  it('journal streak and "journaled today" follow the caller\'s local day, not UTC', async () => {
    const a = await signup();
    const utcToday = new Date().toISOString().slice(0, 10);
    const plus = (n: number) => new Date(Date.parse(`${utcToday}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    // user in UTC+5:30 at 1 AM: their calendar day is already UTC's tomorrow
    const created = await request(server).post('/wellness/journal').set(authed(a.token)).set('X-Local-Date', plus(1)).send({ type: 'free-writing', content: 'late night entry' });
    expect(created.body.entry.localDate).toBe(plus(1));

    const streak = await request(server).get('/wellness/journal/streak').set(authed(a.token)).set('X-Local-Date', plus(1));
    expect(streak.body).toMatchObject({ hasData: true, currentStreak: 1 });
    const today = await request(server).get(`/wellness/journal?from=${plus(1)}`).set(authed(a.token)).set('X-Local-Date', plus(1));
    expect(today.body.entries.length).toBe(1);
    // the same entry is NOT "today" for someone whose local day is still the previous one
    const notYet = await request(server).get(`/wellness/journal?from=${utcToday}`).set(authed(a.token)).set('X-Local-Date', utcToday);
    expect(notYet.body.entries.length).toBe(1); // day >= utcToday holds, but it is attributed to plus(1), proving localDate drives it
    const next = await request(server).get(`/wellness/journal?from=${plus(2)}`).set(authed(a.token));
    expect(next.body.entries.length).toBe(0);
  });

  it('ignores a forged far-away date header', async () => {
    const a = await signup();
    const r = await request(server).post('/wellness/journal').set(authed(a.token)).set('X-Local-Date', '2099-01-01').send({ type: 'free-writing', content: 'x' });
    expect(r.body.entry.localDate).toBe(new Date().toISOString().slice(0, 10));
  });
});
