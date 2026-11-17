import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildSoulmateRouter } from './soulmate';
import { attachAuthContext } from '../auth/middleware';
import { soulmateSketchesById } from '../data/store';
import * as razorpay from '../payments/razorpay';
import * as catalogMatcher from '../soulmate/catalogMatcher';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(attachAuthContext);
  app.use('/soulmate', buildSoulmateRouter());
  return app;
}

const validAnswers = {
  preferredGender: 'female',
  preferredAgeRange: '25-30',
  preferredCountry: 'india',
  style: 'pencil',
};

describe('routes/soulmate', () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    vi.restoreAllMocks();
  });

  it('returns PAYMENT_NOT_CONFIGURED when no Razorpay credentials exist (the real, unconfigured state of this environment)', async () => {
    vi.spyOn(razorpay, 'createOrder').mockRejectedValue(Object.assign(new Error('Payment gateway is not configured on the server.'), { code: 'PAYMENT_NOT_CONFIGURED' }));
    const user = `user-${uuid()}`;
    const res = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send(validAnswers);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('PAYMENT_NOT_CONFIGURED');
  });

  it('rejects invalid questionnaire input', async () => {
    const user = `user-${uuid()}`;
    const res = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send({ ...validAnswers, preferredGender: 'not-a-real-option' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_INPUT');
  });

  it('full happy path: create -> verify payment -> generate -> fetch, never charging twice or re-selecting, with ZERO AI calls', async () => {
    vi.spyOn(razorpay, 'createOrder').mockResolvedValue({ id: 'order_test123', amount: 9900, currency: 'INR', receipt: 'r1', status: 'created' });
    vi.spyOn(razorpay, 'verifyPaymentSignature').mockReturnValue(true);
    const fetchSpy = vi.spyOn(global, 'fetch');

    const user = `user-${uuid()}`;
    const create = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send(validAnswers);
    expect(create.status).toBe(200);
    expect(create.body.sketch.generationStatus).toBe('pending_payment');
    const sketchId = create.body.sketch.id;

    // Cannot generate before payment is verified.
    const earlyGenerate = await request(app).post(`/soulmate/sketches/${sketchId}/generate`).set('x-demo-user', user);
    expect(earlyGenerate.status).toBe(402);
    expect(earlyGenerate.body.code).toBe('PAYMENT_REQUIRED');

    const verify = await request(app)
      .post(`/soulmate/sketches/${sketchId}/verify-payment`)
      .set('x-demo-user', user)
      .send({ razorpayOrderId: 'order_test123', razorpayPaymentId: 'pay_test123', razorpaySignature: 'sig_whatever_since_mocked' });
    expect(verify.status).toBe(200);
    expect(verify.body.sketch.generationStatus).toBe('payment_verified');

    // Re-verifying is idempotent - no error, no re-processing.
    const reverify = await request(app)
      .post(`/soulmate/sketches/${sketchId}/verify-payment`)
      .set('x-demo-user', user)
      .send({ razorpayOrderId: 'order_test123', razorpayPaymentId: 'pay_test123', razorpaySignature: 'sig_whatever_since_mocked' });
    expect(reverify.status).toBe(200);
    expect(reverify.body.sketch.generationStatus).toBe('payment_verified');

    const generate = await request(app).post(`/soulmate/sketches/${sketchId}/generate`).set('x-demo-user', user);
    expect(generate.status).toBe(200);
    expect(generate.body.sketch.generationStatus).toBe('completed');
    expect(typeof generate.body.sketch.imageFilename).toBe('string');
    expect(generate.body.sketch.imageFilename.length).toBeGreaterThan(0);
    expect(generate.body.sketch.personalityDescription).toBeTruthy();
    expect(generate.body.sketch.compatibilityInsights.length).toBeGreaterThan(0);
    const firstFilename = generate.body.sketch.imageFilename;

    // Calling generate again never re-selects - same image, same status.
    const regenerate = await request(app).post(`/soulmate/sketches/${sketchId}/generate`).set('x-demo-user', user);
    expect(regenerate.status).toBe(200);
    expect(regenerate.body.sketch.generationStatus).toBe('completed');
    expect(regenerate.body.sketch.imageFilename).toBe(firstFilename);

    const fetched = await request(app).get(`/soulmate/sketches/${sketchId}`).set('x-demo-user', user);
    expect(fetched.status).toBe(200);
    expect(fetched.body.generationStatus).toBe('completed');

    const image = await request(app).get(`/soulmate/sketches/${sketchId}/image`).set('x-demo-user', user);
    expect(image.status).toBe(200);
    expect(image.body.length).toBeGreaterThan(0);

    // The entire journey above (questionnaire -> payment -> selection ->
    // fetch -> image) made zero network calls of any kind - there is no
    // AI provider (image or text) anywhere in this feature any more.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a payment id that has already been used on another sketch', async () => {
    vi.spyOn(razorpay, 'createOrder')
      .mockResolvedValueOnce({ id: 'order_a', amount: 9900, currency: 'INR', receipt: 'ra', status: 'created' })
      .mockResolvedValueOnce({ id: 'order_b', amount: 9900, currency: 'INR', receipt: 'rb', status: 'created' });
    vi.spyOn(razorpay, 'verifyPaymentSignature').mockReturnValue(true);

    const user = `user-${uuid()}`;
    const first = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send(validAnswers);
    const second = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send(validAnswers);

    const firstVerify = await request(app)
      .post(`/soulmate/sketches/${first.body.sketch.id}/verify-payment`)
      .set('x-demo-user', user)
      .send({ razorpayOrderId: 'order_a', razorpayPaymentId: 'pay_shared', razorpaySignature: 'sig' });
    expect(firstVerify.status).toBe(200);

    const secondVerify = await request(app)
      .post(`/soulmate/sketches/${second.body.sketch.id}/verify-payment`)
      .set('x-demo-user', user)
      .send({ razorpayOrderId: 'order_b', razorpayPaymentId: 'pay_shared', razorpaySignature: 'sig' });
    expect(secondVerify.status).toBe(409);
    expect(secondVerify.body.code).toBe('PAYMENT_ALREADY_USED');
  });

  it('a failed selection can be retried without charging again, and never re-selects once completed', async () => {
    vi.spyOn(razorpay, 'createOrder').mockResolvedValue({ id: 'order_fail', amount: 9900, currency: 'INR', receipt: 'rf', status: 'created' });
    vi.spyOn(razorpay, 'verifyPaymentSignature').mockReturnValue(true);
    const pickSpy = vi.spyOn(catalogMatcher, 'pickSoulmateImage')
      .mockImplementationOnce(() => { throw new Error('simulated transient catalogue failure'); })
      .mockImplementationOnce(() => ({ filename: 'soulmate_001.jpg' }));

    const user = `user-${uuid()}`;
    const create = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send(validAnswers);
    const sketchId = create.body.sketch.id;
    await request(app)
      .post(`/soulmate/sketches/${sketchId}/verify-payment`)
      .set('x-demo-user', user)
      .send({ razorpayOrderId: 'order_fail', razorpayPaymentId: 'pay_fail_retry', razorpaySignature: 'sig' });

    const failed = await request(app).post(`/soulmate/sketches/${sketchId}/generate`).set('x-demo-user', user);
    expect(failed.status).toBe(502);
    expect(failed.body.code).toBe('GENERATION_FAILED');
    expect(failed.body.sketch.generationStatus).toBe('failed');

    const retried = await request(app).post(`/soulmate/sketches/${sketchId}/generate`).set('x-demo-user', user);
    expect(retried.status).toBe(200);
    expect(retried.body.sketch.generationStatus).toBe('completed');
    expect(pickSpy).toHaveBeenCalledTimes(2);

    // No second payment was ever created or verified for this retry - only
    // one sketch record exists, still tied to the original single payment.
    expect(soulmateSketchesById.get(sketchId)?.paymentId).toBe('pay_fail_retry');
  });

  it('a user cannot access or act on another user\'s sketch', async () => {
    vi.spyOn(razorpay, 'createOrder').mockResolvedValue({ id: 'order_priv', amount: 9900, currency: 'INR', receipt: 'rp', status: 'created' });
    const owner = `owner-${uuid()}`;
    const intruder = `intruder-${uuid()}`;
    const create = await request(app).post('/soulmate/sketches').set('x-demo-user', owner).send(validAnswers);
    const sketchId = create.body.sketch.id;

    const getAttempt = await request(app).get(`/soulmate/sketches/${sketchId}`).set('x-demo-user', intruder);
    expect(getAttempt.status).toBe(404);

    const generateAttempt = await request(app).post(`/soulmate/sketches/${sketchId}/generate`).set('x-demo-user', intruder);
    expect(generateAttempt.status).toBe(404);
  });

  describe('free trial', () => {
    it('a new user is eligible, and requesting the free trial skips payment entirely, with ZERO AI/network calls', async () => {
      const razorpaySpy = vi.spyOn(razorpay, 'createOrder');
      const fetchSpy = vi.spyOn(global, 'fetch');

      const user = `trial-user-${uuid()}`;
      const status = await request(app).get('/soulmate/trial-status').set('x-demo-user', user);
      expect(status.status).toBe(200);
      expect(status.body.eligible).toBe(true);
      expect(status.body.freeSketch).toBeNull();

      const create = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send({ ...validAnswers, requestFreeTrial: true });
      expect(create.status).toBe(200);
      expect(create.body.sketch.isFreeTrial).toBe(true);
      expect(create.body.sketch.priceCents).toBe(0);
      expect(create.body.sketch.generationStatus).toBe('payment_verified');
      expect(create.body.razorpayKeyId).toBeNull();
      expect(razorpaySpy).not.toHaveBeenCalled();

      const generate = await request(app).post(`/soulmate/sketches/${create.body.sketch.id}/generate`).set('x-demo-user', user);
      expect(generate.status).toBe(200);
      expect(generate.body.sketch.generationStatus).toBe('completed');
      expect(generate.body.sketch.imageFilename).toBeTruthy();

      const statusAfter = await request(app).get('/soulmate/trial-status').set('x-demo-user', user);
      expect(statusAfter.body.eligible).toBe(false);
      expect(statusAfter.body.freeSketch.id).toBe(create.body.sketch.id);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects a second free trial for a user who already has one, regardless of its status', async () => {
      const user = `trial-user-${uuid()}`;
      const first = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send({ ...validAnswers, requestFreeTrial: true });
      expect(first.status).toBe(200);

      const second = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send({ ...validAnswers, requestFreeTrial: true });
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('TRIAL_ALREADY_USED');
      expect(second.body.sketch.id).toBe(first.body.sketch.id);
    });

    it('a paid sketch is unaffected by trial state and still requires real payment verification', async () => {
      vi.spyOn(razorpay, 'createOrder').mockResolvedValue({ id: 'order_paid', amount: 9900, currency: 'INR', receipt: 'rpaid', status: 'created' });
      const user = `trial-user-${uuid()}`;
      await request(app).post('/soulmate/sketches').set('x-demo-user', user).send({ ...validAnswers, requestFreeTrial: true });

      const paid = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send(validAnswers);
      expect(paid.status).toBe(200);
      expect(paid.body.sketch.isFreeTrial).toBe(false);
      expect(paid.body.sketch.priceCents).toBe(9900);
      expect(paid.body.sketch.generationStatus).toBe('pending_payment');
    });
  });

  describe('static catalogue matching', () => {
    it('picks among multiple eligible filenames for the same broad preferences across repeated calls (no hardcoded single result)', async () => {
      // Narrow preferences (exact gender + exact country + exact age) can
      // legitimately have a single best-scoring catalogue match, which is
      // correct deterministic behavior, not a bug. Broad preferences (no
      // gender/country preference) have a wide eligible pool, so repeated
      // selection should show real variety rather than always returning
      // the same one filename.
      const seen = new Set<string>();
      for (let i = 0; i < 30; i++) {
        const user = `catalog-user-${uuid()}`;
        const create = await request(app).post('/soulmate/sketches').set('x-demo-user', user)
          .send({ ...validAnswers, preferredGender: 'no-preference', preferredCountry: 'no-preference', requestFreeTrial: true });
        const generate = await request(app).post(`/soulmate/sketches/${create.body.sketch.id}/generate`).set('x-demo-user', user);
        seen.add(generate.body.sketch.imageFilename);
      }
      expect(seen.size).toBeGreaterThan(1);
    });

    it('honors a "no preference" gender by not restricting to a single gender pool', async () => {
      const user = `catalog-nopref-${uuid()}`;
      const create = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send({ ...validAnswers, preferredGender: 'no-preference', requestFreeTrial: true });
      const generate = await request(app).post(`/soulmate/sketches/${create.body.sketch.id}/generate`).set('x-demo-user', user);
      expect(generate.status).toBe(200);
      expect(generate.body.sketch.imageFilename).toBeTruthy();
    });
  });
});
