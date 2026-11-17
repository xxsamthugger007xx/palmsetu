import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';
import { buildAstrologyRouter } from './astrology';
import { CountingFakeAiProvider } from '../palmistry/testFixtures';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/astrology', buildAstrologyRouter(new CountingFakeAiProvider()));
  return app;
}

describe('routes/astrology - onboarding draft (partial save/merge)', () => {
  it('404s when nothing has been saved yet', async () => {
    const app = buildApp();
    const res = await request(app).get('/astrology/onboarding-draft').set('x-demo-user', `test-${uuid()}`);
    expect(res.status).toBe(404);
  });

  it('a second partial save does not wipe fields saved by an earlier partial save', async () => {
    const app = buildApp();
    const userId = `test-${uuid()}`;

    const first = await request(app)
      .patch('/astrology/onboarding-draft')
      .set('x-demo-user', userId)
      .send({ preferredSystem: 'vedic' });
    expect(first.status).toBe(200);
    expect(first.body.preferredSystem).toBe('vedic');
    expect(first.body.birthDate).toBeNull();

    const second = await request(app)
      .patch('/astrology/onboarding-draft')
      .set('x-demo-user', userId)
      .send({ birthDate: '1995-03-10' });
    expect(second.status).toBe(200);
    // The critical assertion: preferredSystem from the FIRST save must
    // still be present after a completely separate second save that never
    // mentioned it.
    expect(second.body.preferredSystem).toBe('vedic');
    expect(second.body.birthDate).toBe('1995-03-10');

    const third = await request(app)
      .patch('/astrology/onboarding-draft')
      .set('x-demo-user', userId)
      .send({ birthPlace: 'Mumbai, India', latitude: 19.076, longitude: 72.8777, timezone: 'Asia/Kolkata' });
    expect(third.status).toBe(200);
    expect(third.body.preferredSystem).toBe('vedic');
    expect(third.body.birthDate).toBe('1995-03-10');
    expect(third.body.birthPlace).toBe('Mumbai, India');
    expect(third.body.birthLatitude).toBe(19.076);

    const fetched = await request(app).get('/astrology/onboarding-draft').set('x-demo-user', userId);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toMatchObject({
      preferredSystem: 'vedic',
      birthDate: '1995-03-10',
      birthPlace: 'Mumbai, India',
      birthLatitude: 19.076,
      birthLongitude: 72.8777,
      timezone: 'Asia/Kolkata',
    });
  });

  it('records an explicit "I don\'t know my birth time" skip without requiring a time value', async () => {
    const app = buildApp();
    const userId = `test-${uuid()}`;
    const res = await request(app)
      .patch('/astrology/onboarding-draft')
      .set('x-demo-user', userId)
      .send({ birthTime: null, birthTimeSkipped: true });
    expect(res.status).toBe(200);
    expect(res.body.birthTime).toBeNull();
    expect(res.body.birthTimeSkipped).toBe(true);
  });

  it('rejects an invalid preferredSystem value', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch('/astrology/onboarding-draft')
      .set('x-demo-user', `test-${uuid()}`)
      .send({ preferredSystem: 'astrology-but-wrong' });
    expect(res.status).toBe(400);
  });
});

describe('routes/astrology - PUT /profile accepts a null birthTime (skip option)', () => {
  it('saves a complete profile with birthTime: null and computes a partial-data natal summary', async () => {
    const app = buildApp();
    const userId = `test-${uuid()}`;
    const res = await request(app)
      .put('/astrology/profile')
      .set('x-demo-user', userId)
      .send({
        birthDate: '1995-03-10',
        birthTime: null,
        birthPlace: 'Mumbai, India',
        latitude: 19.076,
        longitude: 72.8777,
        preferredSystem: 'vedic',
        timezone: 'Asia/Kolkata',
      });
    expect(res.status).toBe(200);
    expect(res.body.birthTime).toBeNull();
    expect(res.body.natal.birthTimeKnown).toBe(false);
  });
});
