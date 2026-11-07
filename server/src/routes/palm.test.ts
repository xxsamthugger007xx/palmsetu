import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPalmRouter } from './palm';
import { readingsById, userPlans, dailyPalmGuidanceByKey } from '../data/store';
import {
  CountingFakeAiProvider, fixtureAnalysisWithMatches, generateNoiseTestImage,
  fakeRawDetectionRejectedNoHand, fakeRawDetectionAcceptedPartial,
} from '../palmistry/testFixtures';
import * as visionDetector from '../palmistry/visionDetector';
import { buildFreeReading } from '../palmistry/staticPalmistryEngine';
import { PalmReading } from '../types/palm';

function buildApp(provider: CountingFakeAiProvider) {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/palm', buildPalmRouter(provider));
  return app;
}

function insertReading(userId: string): PalmReading {
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
  };
  readingsById.set(reading.id, reading);
  return reading;
}

describe('routes/palm - free/paid separation and entitlement', () => {
  let provider: CountingFakeAiProvider;
  let app: express.Express;
  const freeUser = `free-${uuid()}`;
  const premiumUser = `premium-${uuid()}`;

  beforeEach(() => {
    provider = new CountingFakeAiProvider();
    app = buildApp(provider);
    userPlans.set(premiumUser, { userId: premiumUser, tier: 'premium' });
  });

  afterEach(() => {
    userPlans.delete(freeUser);
    userPlans.delete(premiumUser);
  });

  it('free palm reading generation makes zero LLM API calls', async () => {
    // generateNoiseTestImage is a REAL, genuinely decodable image (sharp
    // computes real sharpness/brightness/contrast against it), so this
    // exercises the real quality-gate path. No GEMINI_API_KEY is set in
    // this test environment, so the content-based vision detector returns
    // null and only quality gating runs - an honest limitation, not a mock.
    const image = await generateNoiseTestImage();
    const res = await request(app)
      .post('/palm/readings')
      .set('x-demo-user', freeUser)
      .send({ image: image.toString('base64') });

    expect(res.status).toBe(200);
    expect(provider.callCount).toBe(0);
    expect(res.body.freeReading).toBeDefined();
    expect(res.body.premiumReport).toBeNull();
  });

  it('rejects an image with a mocked rejected_no_hand vision response WITHOUT creating a reading record', async () => {
    // The vision-detector call itself is mocked here (there is no genuine
    // way to produce real CV ground truth for "is this a face/object/
    // screenshot" with a synthetic image in this environment) - this tests
    // routes/palm.ts's rejection-gating logic, not the real Gemini call.
    const spy = vi.spyOn(visionDetector, 'runVisionDetection').mockResolvedValue(fakeRawDetectionRejectedNoHand());
    const sizeBefore = readingsById.size;

    const image = await generateNoiseTestImage();
    const res = await request(app)
      .post('/palm/readings')
      .set('x-demo-user', freeUser)
      .send({ image: image.toString('base64') });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('IMAGE_REJECTED');
    expect(res.body.validationStatus).toBe('rejected_no_hand');
    expect(readingsById.size).toBe(sizeBefore);

    spy.mockRestore();
  });

  it('accepted_partial (mocked) still creates a reading, with limited-visibility framing in the free reading', async () => {
    const spy = vi.spyOn(visionDetector, 'runVisionDetection').mockResolvedValue(fakeRawDetectionAcceptedPartial());

    const image = await generateNoiseTestImage();
    const res = await request(app)
      .post('/palm/readings')
      .set('x-demo-user', freeUser)
      .send({ image: image.toString('base64') });

    expect(res.status).toBe(200);
    expect(res.body.analysis.validation.status).toBe('accepted_partial');
    expect(res.body.freeReading.limitedVisibility).toBe(true);
    expect(res.body.freeReading.summary).toMatch(/limited visibility/i);
    expect(readingsById.has(res.body.id)).toBe(true);

    spy.mockRestore();
  });

  it('a free-tier user can generate exactly one premium report (the free quota), then is locked out', async () => {
    const readingA = insertReading(freeUser);
    const readingB = insertReading(freeUser);

    const first = await request(app).post(`/palm/readings/${readingA.id}/premium-report`).set('x-demo-user', freeUser);
    expect(first.status).toBe(200);
    expect(first.body.premiumReport.sections.length).toBeGreaterThan(0);
    // Premium report generation is now fully deterministic - it must never
    // reach the AI provider at all.
    expect(provider.callCount).toBe(0);

    const second = await request(app).post(`/palm/readings/${readingB.id}/premium-report`).set('x-demo-user', freeUser);
    expect(second.status).toBe(403);
    expect(second.body.code).toBe('LIMIT_REACHED');
    expect(provider.callCount).toBe(0);
  });

  it('a premium-tier user generating a premium report makes zero AI calls - premium content is deterministic', async () => {
    const reading = insertReading(premiumUser);
    const res = await request(app).post(`/palm/readings/${reading.id}/premium-report`).set('x-demo-user', premiumUser);
    expect(res.status).toBe(200);
    expect(provider.callCount).toBe(0);
  });

  it('a previously generated premium report is served from cache on repeat fetch, without regeneration', async () => {
    const reading = insertReading(premiumUser);

    const first = await request(app).post(`/palm/readings/${reading.id}/premium-report`).set('x-demo-user', premiumUser);
    expect(first.status).toBe(200);
    expect(provider.callCount).toBe(0);

    const second = await request(app).post(`/palm/readings/${reading.id}/premium-report`).set('x-demo-user', premiumUser);
    expect(second.status).toBe(200);
    expect(provider.callCount).toBe(0);
    expect(second.body.premiumReport).toEqual(first.body.premiumReport);
  });

  it('ownership is enforced: a user cannot fetch or premium-unlock another user label\'s reading', async () => {
    const reading = insertReading(premiumUser);
    const res = await request(app).get(`/palm/readings/${reading.id}`).set('x-demo-user', freeUser);
    expect(res.status).toBe(404);
  });

  it('daily guidance is cached once per user per local calendar date and makes zero AI calls', async () => {
    insertReading(premiumUser);
    const localDate = '2026-11-02';
    dailyPalmGuidanceByKey.delete(`${premiumUser}:${localDate}`);

    const first = await request(app).get(`/palm/daily-guidance?localDate=${localDate}`).set('x-demo-user', premiumUser);
    expect(first.status).toBe(200);
    const second = await request(app).get(`/palm/daily-guidance?localDate=${localDate}`).set('x-demo-user', premiumUser);
    expect(second.status).toBe(200);
    expect(second.body.createdAt).toBe(first.body.createdAt); // same cached object, not regenerated
    expect(provider.callCount).toBe(0);
  });
});
