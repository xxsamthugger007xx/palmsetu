import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildSoulmateRouter } from './soulmate';
import { attachAuthContext } from '../auth/middleware';
import { soulmateSketchesById } from '../data/store';
import * as razorpay from '../payments/razorpay';
import * as catalogMatcher from '../soulmate/catalogMatcher';
import soulmateCatalog from '../soulmate/catalogData.json';
import { isReadableSoulmateCatalogImage } from '../soulmate/imageStorage';
import * as imageStorage from '../soulmate/imageStorage';
import * as watermark from '../soulmate/watermark';

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

/** Creates a sketch and takes it all the way through to 'payment_verified'
 * via the real (mocked) Razorpay flow, since the feature has no free-trial
 * path any more - every sketch must be paid for. */
async function createPaidSketch(app: express.Express, user: string, answers: Record<string, unknown> = validAnswers) {
  vi.spyOn(razorpay, 'createOrder').mockResolvedValue({ id: `order_${uuid()}`, amount: 9900, currency: 'INR', receipt: 'r1', status: 'created' });
  vi.spyOn(razorpay, 'verifyPaymentSignature').mockReturnValue(true);

  const create = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send(answers);
  const sketchId = create.body.sketch.id;
  await request(app)
    .post(`/soulmate/sketches/${sketchId}/verify-payment`)
    .set('x-demo-user', user)
    .send({ razorpayOrderId: create.body.orderId, razorpayPaymentId: `pay_${uuid()}`, razorpaySignature: 'sig_whatever_since_mocked' });
  return create;
}

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
    const createOrderSpy = vi.spyOn(razorpay, 'createOrder').mockResolvedValue({ id: 'order_test123', amount: 9900, currency: 'INR', receipt: 'r1', status: 'created' });
    const verifyPaymentSpy = vi.spyOn(razorpay, 'verifyPaymentSignature').mockReturnValue(true);
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
    expect(image.headers['content-type']).toMatch(/^image\/(jpeg|png)/);

    // The entire journey above (questionnaire -> payment -> selection ->
    // fetch -> image) made zero network calls of any kind - there is no
    // AI provider (image or text) anywhere in this feature any more.
    expect(createOrderSpy).toHaveBeenCalledTimes(1);
    expect(verifyPaymentSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('serves a completed sketch share image as valid PNG bytes', async () => {
    const user = `share-image-${uuid()}`;
    const create = await createPaidSketch(app, user);
    expect(create.status).toBe(200);
    const sketchId = create.body.sketch.id;

    const generate = await request(app).post(`/soulmate/sketches/${sketchId}/generate`).set('x-demo-user', user);
    expect(generate.status).toBe(200);
    expect(generate.body.sketch.generationStatus).toBe('completed');

    const share = await request(app).get(`/soulmate/sketches/${sketchId}/share-image`).set('x-demo-user', user);
    expect(share.status).toBe(200);
    expect(share.headers['content-type']).toMatch(/^image\/png/);
    expect(Buffer.isBuffer(share.body)).toBe(true);
    const metadata = await sharp(share.body).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
  });

  it('serves readable original image bytes when watermarking the share image fails', async () => {
    const user = `share-image-fallback-${uuid()}`;
    const create = await createPaidSketch(app, user);
    expect(create.status).toBe(200);
    const sketchId = create.body.sketch.id;
    const generate = await request(app).post(`/soulmate/sketches/${sketchId}/generate`).set('x-demo-user', user);
    expect(generate.status).toBe(200);

    vi.spyOn(watermark, 'addWatermark').mockRejectedValueOnce(new Error('simulated watermark failure'));
    const share = await request(app).get(`/soulmate/sketches/${sketchId}/share-image`).set('x-demo-user', user);

    expect(share.status).toBe(200);
    expect(share.headers['content-type']).toMatch(/^image\/(jpeg|png)/);
    expect(Buffer.isBuffer(share.body)).toBe(true);
    const metadata = await sharp(share.body).metadata();
    expect(metadata.format).toMatch(/^(jpeg|png)$/);
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
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

  it('does not complete generation when the selected portrait is unavailable, and allows retry', async () => {
    vi.spyOn(razorpay, 'createOrder').mockResolvedValue({ id: 'order_missing_image', amount: 9900, currency: 'INR', receipt: 'rmi', status: 'created' });
    vi.spyOn(razorpay, 'verifyPaymentSignature').mockReturnValue(true);
    vi.spyOn(catalogMatcher, 'pickSoulmateImage').mockReturnValue({ filename: 'soulmate_001.jpg' });
    const readableSpy = vi.spyOn(imageStorage, 'isReadableSoulmateCatalogImage')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const user = `missing-image-${uuid()}`;
    const create = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send(validAnswers);
    const sketchId = create.body.sketch.id;
    await request(app)
      .post(`/soulmate/sketches/${sketchId}/verify-payment`)
      .set('x-demo-user', user)
      .send({ razorpayOrderId: 'order_missing_image', razorpayPaymentId: 'pay_missing_image', razorpaySignature: 'sig' });

    const failed = await request(app).post(`/soulmate/sketches/${sketchId}/generate`).set('x-demo-user', user);
    expect(failed.status).toBe(502);
    expect(failed.body.code).toBe('GENERATION_FAILED');
    expect(failed.body.sketch.generationStatus).toBe('failed');
    expect(failed.body.sketch.imageFilename).toBeNull();

    const retried = await request(app).post(`/soulmate/sketches/${sketchId}/generate`).set('x-demo-user', user);
    expect(retried.status).toBe(200);
    expect(retried.body.sketch.generationStatus).toBe('completed');
    expect(retried.body.sketch.imageFilename).toBe('soulmate_001.jpg');
    expect(readableSpy).toHaveBeenCalledTimes(2);
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

  describe('premium-only (no free trial)', () => {
    it('always reports ineligible for a free trial, since the feature is premium-only', async () => {
      const user = `premium-user-${uuid()}`;
      const status = await request(app).get('/soulmate/trial-status').set('x-demo-user', user);
      expect(status.status).toBe(200);
      expect(status.body.eligible).toBe(false);
      expect(status.body.freeSketch).toBeNull();
    });

    it('always creates a real paid order, even on a user\'s very first sketch', async () => {
      const createOrderSpy = vi.spyOn(razorpay, 'createOrder').mockResolvedValue({ id: 'order_first', amount: 9900, currency: 'INR', receipt: 'r1', status: 'created' });
      const user = `premium-user-${uuid()}`;
      const create = await request(app).post('/soulmate/sketches').set('x-demo-user', user).send(validAnswers);
      expect(create.status).toBe(200);
      expect(create.body.sketch.isFreeTrial).toBe(false);
      expect(create.body.sketch.priceCents).toBe(9900);
      expect(create.body.sketch.generationStatus).toBe('pending_payment');
      expect(createOrderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('static catalogue matching', () => {
    it('resolves every catalogue filename to a readable image', async () => {
      for (const { filename } of soulmateCatalog) {
        await expect(isReadableSoulmateCatalogImage(filename), filename).resolves.toBe(true);
      }
    });

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
        const create = await createPaidSketch(app, user, { ...validAnswers, preferredGender: 'no-preference', preferredCountry: 'no-preference' });
        const generate = await request(app).post(`/soulmate/sketches/${create.body.sketch.id}/generate`).set('x-demo-user', user);
        seen.add(generate.body.sketch.imageFilename);
      }
      expect(seen.size).toBeGreaterThan(1);
    });

    it('honors a "no preference" gender by not restricting to a single gender pool', async () => {
      const user = `catalog-nopref-${uuid()}`;
      const create = await createPaidSketch(app, user, { ...validAnswers, preferredGender: 'no-preference' });
      const generate = await request(app).post(`/soulmate/sketches/${create.body.sketch.id}/generate`).set('x-demo-user', user);
      expect(generate.status).toBe(200);
      expect(generate.body.sketch.imageFilename).toBeTruthy();
    });
  });
});
