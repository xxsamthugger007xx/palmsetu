import crypto from 'crypto';

/**
 * Real Razorpay integration shape - order creation, payment signature
 * verification, and webhook signature verification, implemented exactly
 * per Razorpay's documented algorithms. This is the first genuinely
 * real-payment-gateway-shaped code in this app (every other premium
 * feature only simulates a tier/transaction log, see data/pricing.ts's own
 * doc comment) - but it is INERT without real credentials: no
 * RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET exist in this environment, so
 * createOrder() throws a clear, loud error rather than fabricating a fake
 * order, and verifyPaymentSignature()/verifyWebhookSignature() will simply
 * never find a valid match for any real request since there is no real
 * secret to compute against. Nothing here ever reports a payment as
 * verified without that real cryptographic check passing.
 *
 * Once real keys are set, this requires no further code changes - only the
 * env vars.
 */

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  receipt: string;
  status: string;
}

function getCredentials(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

let warnedMissingCredentials = false;

/**
 * Creates a real Razorpay order via their Orders API. Throws
 * PAYMENT_NOT_CONFIGURED if no credentials exist - callers must surface
 * this as a real error to the client, never silently proceed as if an
 * order was created.
 */
export async function createOrder(amountCents: number, currency: string, receipt: string): Promise<RazorpayOrder> {
  const creds = getCredentials();
  if (!creds) {
    if (!warnedMissingCredentials) {
      console.warn('[payments/razorpay] RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are not set - Soulmate Sketch payments cannot be created until configured.');
      warnedMissingCredentials = true;
    }
    const err = new Error('Payment gateway is not configured on the server.');
    (err as any).code = 'PAYMENT_NOT_CONFIGURED';
    throw err;
  }

  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ amount: amountCents, currency, receipt }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Razorpay order creation failed: ${res.status} ${body}`);
  }

  return (await res.json()) as RazorpayOrder;
}

/**
 * Verifies a client-reported payment per Razorpay's documented algorithm:
 * HMAC-SHA256(order_id + "|" + payment_id, key_secret) must equal the
 * signature Razorpay's checkout returned to the client. This is the actual
 * cryptographic proof that the payment is real and was not fabricated by
 * the frontend - see routes/soulmate.ts's verify-payment endpoint, which
 * is the only place a sketch's status is allowed to move past
 * 'pending_payment', and only when this returns true.
 */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const creds = getCredentials();
  if (!creds) return false; // never verifies true without a real secret to check against

  const expected = crypto
    .createHmac('sha256', creds.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Constant-time comparison - a payment signature is a security-sensitive
  // value, timing differences in a naive === comparison could leak it.
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Verifies a Razorpay webhook request's `x-razorpay-signature` header
 * against the raw request body, using the separate webhook secret
 * configured in the Razorpay dashboard (never the same as key_secret).
 * This is the server-to-server confirmation path - more trustworthy than
 * the client-reported verify-payment call above, since it comes directly
 * from Razorpay's own servers rather than through the user's device.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return false;

  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/** The public key id is safe to expose to the client (Razorpay's own
 * checkout SDK requires it) - the secret never leaves the server. Returns
 * null if unconfigured, so the client can show an honest "unavailable"
 * state instead of a broken checkout widget. */
export function getPublicKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID ?? null;
}
