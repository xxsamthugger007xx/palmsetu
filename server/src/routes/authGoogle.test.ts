import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildAuthRouter } from './auth';
import { attachAuthContext } from '../auth/middleware';
import { findAccountByEmail } from '../data/store';

const TOKEN = 'x'.repeat(40);

function appWith(identity: { sub: string; email: string; emailVerified: boolean } | null) {
  const app = express();
  app.use(express.json());
  app.use(attachAuthContext);
  app.use('/auth', buildAuthRouter(async () => identity));
  return app;
}

describe('POST /auth/google', () => {
  const prev = process.env.GOOGLE_CLIENT_IDS;
  beforeEach(() => { process.env.GOOGLE_CLIENT_IDS = 'test-client.apps.googleusercontent.com'; });
  afterEach(() => { process.env.GOOGLE_CLIENT_IDS = prev; });

  it('creates a verified account on first Google sign-in, then signs into the same one', async () => {
    const email = `g-${Date.now()}@example.com`;
    const app = appWith({ sub: `sub-${email}`, email, emailVerified: true });
    const first = await request(app).post('/auth/google').send({ idToken: TOKEN });
    expect(first.status).toBe(200);
    expect(first.body.created).toBe(true);
    expect(first.body.account.emailVerified).toBe(true);
    const second = await request(app).post('/auth/google').send({ idToken: TOKEN });
    expect(second.body.created).toBe(false);
    expect(second.body.account.id).toBe(first.body.account.id);
  });

  it('links to an existing email/password account instead of creating a duplicate', async () => {
    const email = `link-${Date.now()}@example.com`;
    const existing = await request(appWith(null)).post('/auth/signup').send({ email, password: 'password123' });
    const res = await request(appWith({ sub: `sub-${email}`, email, emailVerified: true })).post('/auth/google').send({ idToken: TOKEN });
    expect(res.body.account.id).toBe(existing.body.account.id);
    expect(findAccountByEmail(email)?.googleSub).toBe(`sub-${email}`);
  });

  it('rejects an invalid token and an unverified Google email', async () => {
    expect((await request(appWith(null)).post('/auth/google').send({ idToken: TOKEN })).status).toBe(401);
    const unverified = appWith({ sub: 's', email: 'u@example.com', emailVerified: false });
    expect((await request(unverified).post('/auth/google').send({ idToken: TOKEN })).status).toBe(401);
  });

  it('says so when Google sign-in is not configured', async () => {
    delete process.env.GOOGLE_CLIENT_IDS;
    const res = await request(appWith(null)).post('/auth/google').send({ idToken: TOKEN });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('GOOGLE_NOT_CONFIGURED');
  });
});
