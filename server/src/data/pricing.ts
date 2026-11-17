/**
 * ASSUMED / TEST PRICING TABLE - NOT REAL MONEY.
 *
 * There is no payment gateway anywhere in this app (no Stripe, no App Store or
 * Play Billing receipt validation). No real transaction has ever occurred and
 * no real money has ever moved. The prices below are placeholders chosen for
 * illustration only, picked to look plausible for an Indian-market spiritual
 * app, in INR-equivalent cents (paise) stored as integer `amountCents` with
 * currency 'INR'.
 *
 * Why this exists: the admin panel needs to report revenue broken down per
 * feature, but there is nothing real to report on yet. Rather than fabricate
 * random transaction amounts on every request (which would be dishonest and
 * misleading to anyone reading the dashboard), this file defines one fixed
 * price per premium unlock type, and a transaction record is written exactly
 * once, at the moment that specific premium content/action is actually
 * granted server-side (see server/src/data/store.ts `transactions` and the
 * call sites in routes/tarot.ts, routes/gemstone.ts, routes/vastu.ts and
 * index.ts's /dev/set-tier). The moment a real billing integration (Stripe,
 * App Store, Play Billing) is wired in, these recordTransaction() calls can
 * be swapped to fire from real payment-success webhooks instead, and the
 * admin reporting code built on top of `transactions` does not need to
 * change at all.
 *
 * PRICING_TABLE_VERSION is stamped onto every transaction so that if these
 * assumed prices are revised later, historical transactions still show which
 * price list produced them.
 */

export const PRICING_TABLE_VERSION = 'assumed-v1-2026-10-26';

export type PricedFeature =
  | 'premium_subscription'
  | 'tarot_detailed_report'
  | 'gemstone_premium_report'
  | 'vastu_premium_report'
  | 'astrology_premium_report'
  | 'palm_premium_report'
  | 'palm_section_unlock'
  | 'soulmate_sketch';

export const CURRENCY = 'INR';

/** Prices in cents (paise). All ASSUMED/TEST values, not real prices. */
export const PRICING_CENTS: Record<PricedFeature, number> = {
  // General tier upgrade fallback price - /dev/set-tier now records the
  // real per-plan price from data/subscriptionPlans.ts via its
  // amountCentsOverride param instead of this value for every real call;
  // this remains only as the Record's required default for the key.
  premium_subscription: 49_900, // INR 499.00 (monthly plan price, the lowest of the three real plans)
  tarot_detailed_report: 4900, // ~ INR 49.00 per AI-synthesized detailed report
  gemstone_premium_report: 9900, // ~ INR 99.00 per report beyond the free quota
  vastu_premium_report: 14900, // ~ INR 149.00 per property/report beyond the free quota
  astrology_premium_report: 9900, // ~ INR 99.00, reserved: no astrology route is premium-gated yet
  // `palm_premium_report` is now the "complete reading" bundle price
  // (unlocks every detected section at once) rather than the only premium
  // palm price point - kept as its own entry, same amount, for backward
  // compatibility with historical transaction rows that already used it.
  palm_premium_report: 7900, // ~ INR 79.00, complete-reading bundle (all detected sections).
  // One flat price for unlocking any single line/section (Heart Line,
  // Head Line, a mount, etc), rather than a separate SKU per section.
  // Reasoning: sections vary in how much content they contain (a mount
  // section may be much shorter than a Heart Line section with several
  // matched characteristics), and pricing each differently would require
  // fabricating a "value" distinction between lines that this app has no
  // honest basis for. A single flat per-section price, cheaper than the
  // complete bundle, keeps the bundle the obviously better deal without
  // inventing per-line price tiers.
  palm_section_unlock: 2900, // ~ INR 29.00 per individual section unlock.
  // Illustrative launch price per spec: one AI-generated soulmate portrait.
  // Unlike every other price above, this one is actually charged through a
  // real payment flow (see payments/razorpay.ts) rather than only logged
  // at the moment free content is granted - see that file's own comment
  // for exactly what "real" means here given no live gateway keys exist
  // yet in this environment.
  soulmate_sketch: 9900, // ~ INR 99.00 per generated sketch.
};
