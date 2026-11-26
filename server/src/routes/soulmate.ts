import { Router, Request } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { SoulmateSketch } from '../types/soulmate';
import { soulmateSketchesById, isPaymentIdUsed, recordTransaction } from '../data/store';
import { PRICING_CENTS, CURRENCY } from '../data/pricing';
import { createOrder, verifyPaymentSignature, verifyWebhookSignature, getPublicKeyId } from '../payments/razorpay';
import { pickSoulmateImage } from '../soulmate/catalogMatcher';
import { generateSoulmatePersonality } from '../soulmate/personality';
import { isReadableSoulmateCatalogImage, readSoulmateCatalogImage } from '../soulmate/imageStorage';
import { addWatermark } from '../soulmate/watermark';
import { recordSoulmateEvent } from '../soulmate/analytics';
import { recordEvent } from '../events/eventTracker';

/**
 * Soulmate Sketch backend. NO AI image-generation or AI text-generation
 * call happens anywhere in this file - the portrait comes from a bundled
 * static image library (soulmate/catalogMatcher.ts) and the personality
 * reflection is prewritten template text (soulmate/personality.ts). This
 * route file never imports an AiProvider or any AI client module.
 */

/** Same TEMPORARY testing shim as every other route in this app - prefers
 * the real resolved auth context, falls back to the legacy header only for
 * a bare test harness. See auth/middleware.ts's attachAuthContext. */
function currentUserId(req: Request): string {
  if (req.auth?.userId) return req.auth.userId;
  return (req.headers['x-demo-user'] as string) || 'demo-user';
}

const questionnaireSchema = z.object({
  preferredGender: z.enum(['male', 'female', 'no-preference']),
  preferredAgeRange: z.enum(['18-24', '25-30', '31-35', '36-40', '40+']),
  preferredCountry: z.string().min(1).max(60),
  style: z.enum(['pencil', 'charcoal', 'soft-portrait']),
});

const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

function ownedSketch(req: Request, id: string): SoulmateSketch | null {
  const sketch = soulmateSketchesById.get(id);
  if (!sketch || sketch.userId !== currentUserId(req)) return null;
  return sketch;
}

export function buildSoulmateRouter() {
  const router = Router();

  router.post('/events/page-view', (req, res) => {
    recordSoulmateEvent(currentUserId(req), 'page_viewed');
    res.json({ ok: true });
  });

  router.post('/events/questionnaire-started', (req, res) => {
    recordSoulmateEvent(currentUserId(req), 'questionnaire_started');
    res.json({ ok: true });
  });

  // Soulmate Sketch is a premium-only feature - there is no free trial.
  // Kept so any pre-existing client build asking for trial status gets a
  // clean "not eligible" response instead of a 404.
  router.get('/trial-status', (req, res) => {
    res.json({ eligible: false, freeSketch: null });
  });

  // Starts a new sketch. Always the paid path: creates a real Razorpay
  // order, generationStatus starts at 'pending_payment', nothing is
  // selected until that payment is verified (see /verify-payment below).
  router.post('/sketches', async (req, res) => {
    const parsed = questionnaireSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'INVALID_INPUT' });

    const userId = currentUserId(req);
    const id = uuid();
    const now = new Date().toISOString();

    recordSoulmateEvent(userId, 'questionnaire_completed', {
      gender: parsed.data.preferredGender, ageRange: parsed.data.preferredAgeRange,
      country: parsed.data.preferredCountry, style: parsed.data.style,
    });

    const priceCents = PRICING_CENTS.soulmate_sketch;
    recordSoulmateEvent(userId, 'payment_attempted', { priceCents });

    let orderId: string;
    try {
      const order = await createOrder(priceCents, CURRENCY, id);
      orderId = order.id;
    } catch (err: any) {
      if (err?.code === 'PAYMENT_NOT_CONFIGURED') {
        return res.status(503).json({
          error: 'Payments are not yet available - the payment gateway has not been configured on this server.',
          code: 'PAYMENT_NOT_CONFIGURED',
        });
      }
      console.warn('[soulmate] order creation failed:', err);
      return res.status(502).json({ error: 'Could not start payment. Please try again.', code: 'ORDER_FAILED' });
    }

    const sketch: SoulmateSketch = {
      id,
      userId,
      preferredGender: parsed.data.preferredGender,
      preferredAgeRange: parsed.data.preferredAgeRange,
      preferredCountry: parsed.data.preferredCountry,
      style: parsed.data.style,
      generationStatus: 'pending_payment',
      isFreeTrial: false,
      orderId,
      paymentId: null,
      priceCents,
      currency: CURRENCY,
      imageFilename: null,
      personalityDescription: null,
      compatibilityInsights: null,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    };
    soulmateSketchesById.set(id, sketch);

    res.json({ sketch, orderId, amountCents: priceCents, currency: CURRENCY, razorpayKeyId: getPublicKeyId() });
  });

  // Client-reported payment confirmation - verified server-side via the
  // real Razorpay signature algorithm (payments/razorpay.ts). This is the
  // ONLY place generationStatus moves past 'pending_payment', and only
  // when verifyPaymentSignature genuinely returns true.
  router.post('/sketches/:id/verify-payment', (req, res) => {
    const sketch = ownedSketch(req, req.params.id);
    if (!sketch) return res.status(404).json({ error: 'Sketch not found', code: 'NOT_FOUND' });

    if (sketch.generationStatus !== 'pending_payment') {
      return res.json({ sketch });
    }

    const parsed = verifyPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'INVALID_INPUT' });

    if (parsed.data.razorpayOrderId !== sketch.orderId) {
      return res.status(400).json({ error: 'Order mismatch.', code: 'ORDER_MISMATCH' });
    }
    if (isPaymentIdUsed(parsed.data.razorpayPaymentId)) {
      return res.status(409).json({ error: 'This payment has already been used.', code: 'PAYMENT_ALREADY_USED' });
    }

    const valid = verifyPaymentSignature(parsed.data.razorpayOrderId, parsed.data.razorpayPaymentId, parsed.data.razorpaySignature);
    if (!valid) {
      recordSoulmateEvent(sketch.userId, 'payment_failed', { sketchId: sketch.id });
      recordEvent({ userId: sketch.userId, eventType: 'PAYMENT_FAILED', feature: 'soulmate', status: 'failure', metadata: { sketchId: sketch.id, reason: 'signature_invalid' } });
      return res.status(400).json({ error: 'Payment verification failed.', code: 'PAYMENT_VERIFICATION_FAILED' });
    }

    const updated: SoulmateSketch = {
      ...sketch,
      generationStatus: 'payment_verified',
      paymentId: parsed.data.razorpayPaymentId,
      updatedAt: new Date().toISOString(),
    };
    soulmateSketchesById.set(sketch.id, updated);
    recordTransaction(sketch.userId, 'soulmate_sketch');
    recordSoulmateEvent(sketch.userId, 'payment_succeeded', { sketchId: sketch.id, priceCents: sketch.priceCents });
    recordEvent({
      userId: sketch.userId, eventType: 'PAYMENT_SUCCESS', feature: 'soulmate',
      dedupeKey: `payment:${parsed.data.razorpayPaymentId}`,
      metadata: { sketchId: sketch.id, priceCents: sketch.priceCents, via: 'client_verify' },
    });

    res.json({ sketch: updated });
  });

  router.post('/webhook', (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const rawBody: Buffer | undefined = req.rawBody;
    if (!signature || !rawBody || !verifyWebhookSignature(rawBody.toString('utf8'), signature)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const orderId = req.body?.payload?.payment?.entity?.order_id;
    const paymentId = req.body?.payload?.payment?.entity?.id;
    if (orderId && paymentId && !isPaymentIdUsed(paymentId)) {
      const sketch = [...soulmateSketchesById.values()].find((s) => s.orderId === orderId);
      if (sketch && sketch.generationStatus === 'pending_payment') {
        soulmateSketchesById.set(sketch.id, { ...sketch, generationStatus: 'payment_verified', paymentId, updatedAt: new Date().toISOString() });
        recordTransaction(sketch.userId, 'soulmate_sketch');
        recordSoulmateEvent(sketch.userId, 'payment_succeeded', { sketchId: sketch.id, priceCents: sketch.priceCents, via: 'webhook' });
        recordEvent({
          userId: sketch.userId, eventType: 'PAYMENT_SUCCESS', feature: 'soulmate',
          dedupeKey: `payment:${paymentId}`, // webhook can be redelivered by Razorpay; never double-count
          metadata: { sketchId: sketch.id, priceCents: sketch.priceCents, via: 'webhook' },
        });
      }
    }
    res.json({ ok: true });
  });

  // Selection - only reachable once payment (or the free trial) is
  // verified. Retriable after a failure with no additional charge or
  // trial consumption. Guards against duplicate concurrent jobs by
  // immediately flipping to 'generating' and rejecting a second call
  // while that's still the status. Picking the portrait and personality
  // text is pure local computation - no AI provider, no network call, and
  // therefore nothing here can fail due to an external API/quota issue.
  // The try/catch remains only as a defensive guard (e.g. a corrupt
  // catalogue), never because of an external dependency.
  router.post('/sketches/:id/generate', async (req, res) => {
    const sketch = ownedSketch(req, req.params.id);
    if (!sketch) return res.status(404).json({ error: 'Sketch not found', code: 'NOT_FOUND' });

    if (sketch.generationStatus === 'completed') return res.json({ sketch }); // never re-select for an existing result
    if (sketch.generationStatus === 'generating') {
      return res.status(409).json({ error: 'Generation is already in progress.', code: 'GENERATION_IN_PROGRESS' });
    }
    if (sketch.generationStatus === 'pending_payment') {
      return res.status(402).json({ error: 'Payment has not been verified yet.', code: 'PAYMENT_REQUIRED' });
    }

    soulmateSketchesById.set(sketch.id, { ...sketch, generationStatus: 'generating', updatedAt: new Date().toISOString() });
    recordSoulmateEvent(sketch.userId, 'generation_attempted', { sketchId: sketch.id });

    try {
      const { filename } = pickSoulmateImage(sketch);
      if (!await isReadableSoulmateCatalogImage(filename)) {
        throw new Error('The selected portrait is unavailable or unreadable.');
      }
      const personality = generateSoulmatePersonality(sketch);

      const completed: SoulmateSketch = {
        ...sketch,
        generationStatus: 'completed',
        imageFilename: filename,
        personalityDescription: personality.description,
        compatibilityInsights: personality.traits,
        failureReason: null,
        updatedAt: new Date().toISOString(),
      };
      soulmateSketchesById.set(sketch.id, completed);
      recordSoulmateEvent(sketch.userId, 'generation_completed', { sketchId: sketch.id });
      res.json({ sketch: completed });
    } catch (err: any) {
      const current = soulmateSketchesById.get(sketch.id) ?? sketch;
      const failed: SoulmateSketch = {
        ...current,
        generationStatus: 'failed',
        failureReason: err?.message ?? 'Could not select your sketch.',
        updatedAt: new Date().toISOString(),
      };
      soulmateSketchesById.set(sketch.id, failed);
      recordSoulmateEvent(sketch.userId, 'generation_failed', { sketchId: sketch.id, reason: String(err?.message ?? 'unknown') });
      res.status(502).json({ error: 'Could not prepare your sketch. You can retry without paying again.', code: 'GENERATION_FAILED', sketch: failed });
    }
  });

  router.get('/sketches/:id', (req, res) => {
    const sketch = ownedSketch(req, req.params.id);
    if (!sketch) return res.status(404).json({ error: 'Sketch not found', code: 'NOT_FOUND' });
    res.json(sketch);
  });

  router.get('/sketches', (req, res) => {
    const userId = currentUserId(req);
    const items = soulmateSketchesById.valuesForUser(userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ items });
  });

  // Serves the raw bundled catalogue image by the filename stored on the
  // sketch - the client normally renders this straight from its own local
  // asset registry (no network needed), but this stays available for any
  // client/platform that needs the bytes over HTTP.
  router.get('/sketches/:id/image', (req, res) => {
    const sketch = ownedSketch(req, req.params.id);
    if (!sketch) return res.status(404).json({ error: 'Sketch not found', code: 'NOT_FOUND' });
    if (!sketch.imageFilename) return res.status(404).json({ error: 'No image for this sketch' });
    const stored = readSoulmateCatalogImage(sketch.imageFilename);
    if (!stored) return res.status(404).json({ error: 'No stored image for this sketch' });
    res.setHeader('Content-Type', stored.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(stored.buffer);
  });

  // Watermarked version for sharing - computed fresh on every request from
  // the catalogue original, never persisted, so the bundled asset itself
  // stays watermark-free.
  router.get('/sketches/:id/share-image', async (req, res) => {
    const sketch = ownedSketch(req, req.params.id);
    if (!sketch) return res.status(404).json({ error: 'Sketch not found', code: 'NOT_FOUND' });
    if (!sketch.imageFilename) return res.status(404).json({ error: 'No image for this sketch' });
    const stored = readSoulmateCatalogImage(sketch.imageFilename);
    if (!stored) return res.status(404).json({ error: 'No stored image for this sketch' });
    try {
      const watermarked = await addWatermark(stored.buffer);
      res.setHeader('Content-Type', 'image/png');
      res.send(watermarked);
    } catch (err) {
      console.warn('[soulmate] watermark compositing failed, serving original instead:', err);
      res.setHeader('Content-Type', stored.mimeType);
      res.send(stored.buffer);
    }
  });

  router.post('/sketches/:id/share', (req, res) => {
    const sketch = ownedSketch(req, req.params.id);
    if (!sketch) return res.status(404).json({ error: 'Sketch not found', code: 'NOT_FOUND' });
    recordSoulmateEvent(sketch.userId, 'share_event', { sketchId: sketch.id });
    res.json({ ok: true });
  });

  router.delete('/sketches/:id', (req, res) => {
    const sketch = ownedSketch(req, req.params.id);
    if (!sketch) return res.status(404).json({ error: 'Sketch not found', code: 'NOT_FOUND' });
    // The matched portrait is a shared bundled asset, not a per-sketch
    // file, so deleting a sketch only ever removes its database record.
    soulmateSketchesById.delete(sketch.id);
    res.json({ ok: true });
  });

  return router;
}
