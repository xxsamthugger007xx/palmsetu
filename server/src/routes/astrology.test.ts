import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';
import { buildAstrologyRouter } from './astrology';
import { CountingFakeAiProvider } from '../palmistry/testFixtures';
import { birthProfiles, dailyHoroscopesByKey, userIdentities } from '../data/store';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/astrology', buildAstrologyRouter(new CountingFakeAiProvider()));
  return app;
}

const validProfilePayload = {
  birthDate: '1990-05-15',
  birthTime: '08:30:00',
  birthPlace: 'Mumbai, India',
  latitude: 19.076,
  longitude: 72.8777,
  preferredSystem: 'vedic' as const,
  timezone: 'Asia/Kolkata',
};

describe('routes/astrology - identity (name/gender)', () => {
  it('rejects a missing name', async () => {
    const app = buildApp();
    const userId = `test-${uuid()}`;
    const res = await request(app)
      .put('/astrology/identity')
      .set('x-demo-user', userId)
      .send({ gender: 'woman' });
    expect(res.status).toBe(400);
  });

  it('accepts a name with no gender (gender is optional)', async () => {
    const app = buildApp();
    const userId = `test-${uuid()}`;
    const res = await request(app)
      .put('/astrology/identity')
      .set('x-demo-user', userId)
      .send({ name: 'Asha' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Asha');
    expect(res.body.gender).toBeNull();

    const fetched = await request(app).get('/astrology/identity').set('x-demo-user', userId);
    expect(fetched.status).toBe(200);
    expect(fetched.body.name).toBe('Asha');
  });

  it('persists name and gender together and returns them on GET', async () => {
    const app = buildApp();
    const userId = `test-${uuid()}`;
    const res = await request(app)
      .put('/astrology/identity')
      .set('x-demo-user', userId)
      .send({ name: 'Priya', gender: 'woman' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Priya', gender: 'woman', userId });

    const stored = userIdentities.get(userId);
    expect(stored?.name).toBe('Priya');
    expect(stored?.gender).toBe('woman');
  });

  it('404s for a user with no identity set up yet', async () => {
    const app = buildApp();
    const res = await request(app).get('/astrology/identity').set('x-demo-user', `nobody-${uuid()}`);
    expect(res.status).toBe(404);
  });
});

describe('routes/astrology - profile edits never retroactively change stored readings', () => {
  it('editing the birth profile does not change a previously-generated daily horoscope', async () => {
    const app = buildApp();
    const userId = `test-${uuid()}`;

    await request(app).put('/astrology/profile').set('x-demo-user', userId).send(validProfilePayload);

    const localDate = '2026-01-01';
    // Pin system=vedic explicitly on both calls below so the lookup key
    // (`${userId}:${localDate}:${system}`) stays identical even after the
    // profile's preferredSystem changes - otherwise the second call would
    // hit a different, never-before-generated key and this test would not
    // actually exercise the "does an edit retroactively change it" question.
    const first = await request(app)
      .get(`/astrology/daily?localDate=${localDate}&system=vedic`)
      .set('x-demo-user', userId);
    expect(first.status).toBe(200);
    const originalSummary = first.body.summary;
    const originalId = first.body.id;
    expect(originalId).toBeTruthy();

    // Now edit the profile materially (different birth date/place/system).
    await request(app)
      .put('/astrology/profile')
      .set('x-demo-user', userId)
      .send({
        ...validProfilePayload,
        birthDate: '1985-11-02',
        birthPlace: 'Delhi, India',
        preferredSystem: 'western',
      });

    const second = await request(app)
      .get(`/astrology/daily?localDate=${localDate}&system=vedic`)
      .set('x-demo-user', userId);
    expect(second.status).toBe(200);
    // Idempotent-per-key: the already-stored horoscope for this date/system
    // key is returned unchanged, never regenerated from the edited profile.
    expect(second.body.id).toBe(originalId);
    expect(second.body.summary).toBe(originalSummary);

    // Sanity: the profile on file really did change.
    const updatedProfile = birthProfiles.get(userId);
    expect(updatedProfile?.birthDate).toBe('1985-11-02');
  });
});
