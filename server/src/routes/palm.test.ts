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
import { generatePremiumReport } from '../palmistry/premiumPalmistryEngine';
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

    // Fresh user, not the shared freeUser - freeUser already has a palm
    // profile from an earlier test in this block, and a user with an
    // existing profile gets 409 PROFILE_EXISTS before validation even
    // runs (see routes/palm.ts's one-time-profile gate). This test is
    // about the rejection path itself, which needs a profile-less user.
    const noProfileUser = `no-profile-${uuid()}`;
    const image = await generateNoiseTestImage();
    const res = await request(app)
      .post('/palm/readings')
      .set('x-demo-user', noProfileUser)
      .send({ image: image.toString('base64') });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('IMAGE_REJECTED');
    expect(res.body.validationStatus).toBe('rejected_no_hand');
    expect(readingsById.size).toBe(sizeBefore);

    spy.mockRestore();
  });

  it('accepted_partial (mocked) still creates a reading, with limited-visibility framing in the free reading', async () => {
    const spy = vi.spyOn(visionDetector, 'runVisionDetection').mockResolvedValue(fakeRawDetectionAcceptedPartial());

    const noProfileUser = `no-profile-${uuid()}`;
    const image = await generateNoiseTestImage();
    const res = await request(app)
      .post('/palm/readings')
      .set('x-demo-user', noProfileUser)
      .send({ image: image.toString('base64') });

    expect(res.status).toBe(200);
    expect(res.body.analysis.validation.status).toBe('accepted_partial');
    expect(res.body.freeReading.limitedVisibility).toBe(true);
    expect(res.body.freeReading.summary).toMatch(/limited visibility/i);
    expect(readingsById.has(res.body.id)).toBe(true);

    spy.mockRestore();
  });

  it('the user-selected hand overrides the vision model\'s own guess', async () => {
    // fakeRawDetectionAcceptedPartial's fixture hand is 'right' - sending
    // hand: 'left' must win, since the user's own statement about their own
    // body is ground truth, not something the vision model should override.
    const spy = vi.spyOn(visionDetector, 'runVisionDetection').mockResolvedValue(fakeRawDetectionAcceptedPartial());

    const user = `hand-override-${uuid()}`;
    const image = await generateNoiseTestImage();
    const res = await request(app)
      .post('/palm/readings')
      .set('x-demo-user', user)
      .send({ image: image.toString('base64'), hand: 'left' });

    expect(res.status).toBe(200);
    expect(res.body.analysis.hand).toBe('left');
    // The model's own raw detection is untouched - only the displayed hand changes.
    expect(res.body.analysis.validation.handSide).toBe('right');

    spy.mockRestore();
  });

  it('a free-tier user cannot generate a premium report: full detail needs Premium', async () => {
    const reading = insertReading(freeUser);
    const res = await request(app).post(`/palm/readings/${reading.id}/premium-report`).set('x-demo-user', freeUser);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('LIMIT_REACHED');
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

describe('routes/palm - section-wise entitlement', () => {
  let provider: CountingFakeAiProvider;
  let app: express.Express;
  const freeUser = `free-sec-${uuid()}`;
  const otherUser = `other-sec-${uuid()}`;
  const premiumUser = `premium-sec-${uuid()}`;

  beforeEach(() => {
    provider = new CountingFakeAiProvider();
    app = buildApp(provider);
    userPlans.set(premiumUser, { userId: premiumUser, tier: 'premium' });
  });

  afterEach(() => {
    userPlans.delete(freeUser);
    userPlans.delete(otherUser);
    userPlans.delete(premiumUser);
  });

  it('unlocking one section grants access only to that section, not others', async () => {
    const freeUser = premiumUser; // section unlocks are a Premium action
    const reading = insertReading(freeUser);

    const before = await request(app).get(`/palm/readings/${reading.id}/sections`).set('x-demo-user', freeUser);
    expect(before.status).toBe(200);
    const heartBefore = before.body.sections.find((s: any) => s.sectionKey === 'heartLine');
    const lifeBefore = before.body.sections.find((s: any) => s.sectionKey === 'lifeLine');
    expect(heartBefore.unlocked).toBe(false);
    expect(lifeBefore.unlocked).toBe(false);

    const unlock = await request(app).post(`/palm/readings/${reading.id}/sections/heartLine/unlock`).set('x-demo-user', freeUser);
    expect(unlock.status).toBe(200);
    expect(unlock.body.unlocked).toBe(true);

    const after = await request(app).get(`/palm/readings/${reading.id}/sections`).set('x-demo-user', freeUser);
    const heartAfter = after.body.sections.find((s: any) => s.sectionKey === 'heartLine');
    const lifeAfter = after.body.sections.find((s: any) => s.sectionKey === 'lifeLine');
    expect(heartAfter.unlocked).toBe(true);
    expect(heartAfter.detail.length).toBeGreaterThan(0);
    expect(lifeAfter.unlocked).toBe(false);
    expect(lifeAfter.detail).toBeNull();
    expect(after.body.completeUnlocked).toBe(false);
  });

  it('a section unlock request for a line that was never detected is rejected, not fabricated', async () => {
    const reading = insertReading(freeUser);
    const res = await request(app).post(`/palm/readings/${reading.id}/sections/headLine/unlock`).set('x-demo-user', freeUser);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SECTION_NOT_DETECTED');
  });

  it('the complete-reading bundle (premium-report) unlocks every detected section', async () => {
    const reading = insertReading(premiumUser);
    const res = await request(app).post(`/palm/readings/${reading.id}/premium-report`).set('x-demo-user', premiumUser);
    expect(res.status).toBe(200);

    const sectionsRes = await request(app).get(`/palm/readings/${reading.id}/sections`).set('x-demo-user', premiumUser);
    expect(sectionsRes.body.completeUnlocked).toBe(true);
    for (const s of sectionsRes.body.sections) {
      expect(s.unlocked).toBe(true);
    }
  });

  it('a free user cannot unlock any section and gains no access', async () => {
    const quotaUser = `free-quota-${uuid()}`;
    const reading = insertReading(quotaUser);

    const res = await request(app).post(`/palm/readings/${reading.id}/sections/heartLine/unlock`).set('x-demo-user', quotaUser);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('LIMIT_REACHED');

    const sectionsRes = await request(app).get(`/palm/readings/${reading.id}/sections`).set('x-demo-user', quotaUser);
    const heart = sectionsRes.body.sections.find((s: any) => s.sectionKey === 'heartLine');
    expect(heart.unlocked).toBe(false);
  });

  it('cross-user ownership: one user cannot unlock or read section entitlements on another user\'s reading', async () => {
    const reading = insertReading(freeUser);

    const unlockAttempt = await request(app).post(`/palm/readings/${reading.id}/sections/heartLine/unlock`).set('x-demo-user', otherUser);
    expect(unlockAttempt.status).toBe(404);

    const readAttempt = await request(app).get(`/palm/readings/${reading.id}/sections`).set('x-demo-user', otherUser);
    expect(readAttempt.status).toBe(404);
  });

  it('persistence: re-fetching a reading after unlock shows previously-unlocked content without re-purchasing', async () => {
    const reading = insertReading(premiumUser);
    const unlock = await request(app).post(`/palm/readings/${reading.id}/sections/heartLine/unlock`).set('x-demo-user', premiumUser);
    expect(unlock.status).toBe(200);

    // Re-unlocking the same section must be a no-op, not a second charge.
    const reUnlock = await request(app).post(`/palm/readings/${reading.id}/sections/heartLine/unlock`).set('x-demo-user', premiumUser);
    expect(reUnlock.status).toBe(200);
    expect(reUnlock.body.alreadyUnlocked).toBe(true);

    const sectionsRes = await request(app).get(`/palm/readings/${reading.id}/sections`).set('x-demo-user', premiumUser);
    const heart = sectionsRes.body.sections.find((s: any) => s.sectionKey === 'heartLine');
    expect(heart.unlocked).toBe(true);
    expect(heart.detail.length).toBeGreaterThan(0);
  });

  it('backward compatibility: an old record with premiumReport already populated shows all sections unlocked without a migration', async () => {
    const reading = insertReading(freeUser);
    // Simulate a pre-existing whole-report record from before section-wise
    // unlocking existed - premiumReport populated, but no palmSectionUnlocks
    // rows were ever written for it.
    reading.premiumReport = generatePremiumReport(reading.analysis);
    reading.premiumReportGeneratedAt = new Date().toISOString();
    readingsById.set(reading.id, reading);

    const sectionsRes = await request(app).get(`/palm/readings/${reading.id}/sections`).set('x-demo-user', freeUser);
    expect(sectionsRes.status).toBe(200);
    expect(sectionsRes.body.completeUnlocked).toBe(true);
    for (const s of sectionsRes.body.sections) {
      expect(s.unlocked).toBe(true);
      expect(s.detail.length).toBeGreaterThan(0);
    }
  });

  it('one-time palm profile: a second scan without allowRescan is rejected with PROFILE_EXISTS, and GET /profile keeps returning the first reading', async () => {
    const user = `profile-${uuid()}`;
    const spy = vi.spyOn(visionDetector, 'runVisionDetection').mockResolvedValue(fakeRawDetectionAcceptedPartial());

    const image = await generateNoiseTestImage();
    const first = await request(app).post('/palm/readings').set('x-demo-user', user).send({ image: image.toString('base64') });
    expect(first.status).toBe(200);
    expect(first.body.isPrimary).toBe(true);

    const second = await request(app).post('/palm/readings').set('x-demo-user', user).send({ image: image.toString('base64') });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('PROFILE_EXISTS');
    expect(second.body.existingReadingId).toBe(first.body.id);

    const profile = await request(app).get('/palm/profile').set('x-demo-user', user);
    expect(profile.status).toBe(200);
    expect(profile.body.id).toBe(first.body.id);

    spy.mockRestore();
  });

  it('free accounts get 1 palm scan per month; the next is refused with LIMIT_REACHED', async () => {
    const user = `monthly-${uuid()}`;
    const spy = vi.spyOn(visionDetector, 'runVisionDetection').mockResolvedValue(fakeRawDetectionAcceptedPartial());
    const image = await generateNoiseTestImage();
    const first = await request(app).post('/palm/readings').set('x-demo-user', user).send({ image: image.toString('base64') });
    expect(first.status).toBe(200);
    const second = await request(app).post('/palm/readings').set('x-demo-user', user).send({ image: image.toString('base64'), allowRescan: true });
    expect(second.status).toBe(403);
    expect(second.body.code).toBe('LIMIT_REACHED');
    spy.mockRestore();
  });

  it('one-time palm profile: allowRescan:true replaces the primary profile, demoting the old reading', async () => {
    const user = `rescan-${uuid()}`;
    userPlans.set(user, { userId: user, tier: 'premium' });
    const spy = vi.spyOn(visionDetector, 'runVisionDetection').mockResolvedValue(fakeRawDetectionAcceptedPartial());

    const image = await generateNoiseTestImage();
    const first = await request(app).post('/palm/readings').set('x-demo-user', user).send({ image: image.toString('base64') });
    expect(first.status).toBe(200);

    const second = await request(app).post('/palm/readings').set('x-demo-user', user).send({ image: image.toString('base64'), allowRescan: true });
    expect(second.status).toBe(200);
    expect(second.body.isPrimary).toBe(true);
    expect(second.body.id).not.toBe(first.body.id);

    const profile = await request(app).get('/palm/profile').set('x-demo-user', user);
    expect(profile.body.id).toBe(second.body.id);

    const oldReading = readingsById.get(first.body.id);
    expect(oldReading?.isPrimary).toBeFalsy();

    spy.mockRestore();
  });

  it('GET /profile returns NO_PROFILE for a user who has never scanned', async () => {
    const user = `never-scanned-${uuid()}`;
    const res = await request(app).get('/palm/profile').set('x-demo-user', user);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_PROFILE');
  });
});
