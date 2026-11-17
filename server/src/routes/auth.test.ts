import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeEach } from 'vitest';
import { buildAuthRouter } from './auth';
import { attachAuthContext } from '../auth/middleware';
import { buildPalmRouter } from './palm';
import { accountsById, readingsById, guestSessionsById } from '../data/store';
import { CountingFakeAiProvider, fixtureAnalysisWithMatches } from '../palmistry/testFixtures';
import { buildFreeReading } from '../palmistry/staticPalmistryEngine';
import { PalmReading } from '../types/palm';

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(attachAuthContext);
  app.use('/auth', buildAuthRouter());
  app.use('/palm', buildPalmRouter(new CountingFakeAiProvider()));
  return app;
}

function insertReading(userId: string, isPrimary = true): PalmReading {
  const analysis = fixtureAnalysisWithMatches();
  const reading: PalmReading = {
    id: uuid(),
    userId,
    createdAt: new Date().toISOString(),
    analysis,
    freeReading: buildFreeReading(analysis),
    premiumReportAvailable: true,
    premiumReport: null,
    premiumReportGeneratedAt: null,
    isPrimary,
  };
  readingsById.set(reading.id, reading);
  return reading;
}

describe('routes/auth', () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
  });

  it('creates a guest session and resolves it as an unverified guest identity', async () => {
    const guest = await request(app).post('/auth/guest');
    expect(guest.status).toBe(200);
    expect(guest.body.token).toBeTruthy();
    expect(guest.body.guestId).toMatch(/^guest-/);

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${guest.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.isGuest).toBe(true);
    expect(me.body.userId).toBe(guest.body.guestId);
  });

  it('rejects signup with a password shorter than 8 characters', async () => {
    const res = await request(app).post('/auth/signup').send({ email: `${uuid()}@example.com`, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_INPUT');
  });

  it('signs up a new account, logs in with the same credentials, and blocks a duplicate email', async () => {
    const email = `${uuid()}@example.com`;
    const signup = await request(app).post('/auth/signup').send({ email, password: 'correct-horse' });
    expect(signup.status).toBe(200);
    expect(signup.body.account.email).toBe(email.toLowerCase());
    expect(signup.body.token).toBeTruthy();

    const dup = await request(app).post('/auth/signup').send({ email, password: 'another-password' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('EMAIL_TAKEN');

    const login = await request(app).post('/auth/login').send({ email, password: 'correct-horse' });
    expect(login.status).toBe(200);
    expect(login.body.account.email).toBe(email.toLowerCase());

    const wrongPassword = await request(app).post('/auth/login').send({ email, password: 'nope-nope-nope' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('migrates a guest palm profile to the new account on signup, keeping it as the primary reading', async () => {
    const guest = await request(app).post('/auth/guest');
    const guestId: string = guest.body.guestId;
    const guestToken: string = guest.body.token;
    const reading = insertReading(guestId, true);

    const email = `${uuid()}@example.com`;
    const signup = await request(app)
      .post('/auth/signup')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ email, password: 'correct-horse' });
    expect(signup.status).toBe(200);
    const userId = signup.body.account.id;

    const migrated = readingsById.get(reading.id);
    expect(migrated?.userId).toBe(userId);
    expect(migrated?.isPrimary).toBe(true);

    const profile = await request(app)
      .get('/palm/profile')
      .set('Authorization', `Bearer ${signup.body.token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.id).toBe(reading.id);

    const session = guestSessionsById.get(guestId);
    expect(session?.migratedAt).toBeTruthy();
    expect(session?.migratedToUserId).toBe(userId);
  });

  it('does not let a guest claim another guest or account\'s data by only changing the header - requireAccount rejects guests outright', async () => {
    const guest = await request(app).post('/auth/guest');
    const res = await request(app).delete('/auth/account').set('Authorization', `Bearer ${guest.body.token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ACCOUNT_REQUIRED');
  });

  it('deletes an account and its owned palm reading (and image) on DELETE /auth/account', async () => {
    const email = `${uuid()}@example.com`;
    const signup = await request(app).post('/auth/signup').send({ email, password: 'correct-horse' });
    const userId = signup.body.account.id;
    const reading = insertReading(userId, true);

    const del = await request(app).delete('/auth/account').set('Authorization', `Bearer ${signup.body.token}`);
    expect(del.status).toBe(200);
    expect(accountsById.has(userId)).toBe(false);
    expect(readingsById.has(reading.id)).toBe(false);
  });
});
