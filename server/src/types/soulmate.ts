/**
 * Soulmate Sketch: a paid, artistic portrait of an imagined soulmate, based
 * on a short preference questionnaire. Entertainment only - never implies a
 * real, scientifically predicted, or factual future partner.
 *
 * The portrait is selected from a pre-generated static image library (see
 * soulmate/catalogMatcher.ts and data/soulmateCatalogAssets/) - there is NO
 * AI image-generation call anywhere in this feature. The personality
 * reflection is template-based local text (soulmate/personality.ts), also
 * with no AI text-generation call.
 */

export type SoulmateGender = 'male' | 'female' | 'no-preference';
export type SoulmateAgeRange = '18-24' | '25-30' | '31-35' | '36-40' | '40+';
export type SoulmateStyle = 'pencil' | 'charcoal' | 'soft-portrait';

/**
 * Lifecycle of one purchase (or free trial) + selection. Payment must be
 * verified before selection ever runs (see routes/soulmate.ts) -
 * 'pending_payment' is the only status that exists before a real,
 * server-verified payment (or a genuine free-trial grant), and nothing in
 * 'payment_verified' or later ever re-charges the user, even on a retry
 * after 'failed'.
 */
export type SoulmateGenerationStatus =
  | 'pending_payment'
  | 'payment_verified'
  | 'generating'
  | 'completed'
  | 'failed';

export interface SoulmateSketch {
  id: string;
  userId: string;
  preferredGender: SoulmateGender;
  preferredAgeRange: SoulmateAgeRange;
  /** Free-form (e.g. "india", "united-states", or any other country the
   * expandable selector allows) - not a closed enum, since the questionnaire
   * explicitly allows selecting additional countries beyond the shortlist. */
  preferredCountry: string;
  style: SoulmateStyle;
  generationStatus: SoulmateGenerationStatus;

  /** True for the one free-trial sketch this user is entitled to - see
   * data/store.ts's freeTrialSketchFor(). A free-trial sketch skips payment
   * entirely (priceCents 0, orderId/paymentId null, generationStatus starts
   * at 'payment_verified' instead of 'pending_payment') but otherwise goes
   * through the exact same selection pipeline as a paid one. */
  isFreeTrial: boolean;

  // Payment - see payments/razorpay.ts. orderId is created immediately
  // (before payment), paymentId/signature are only ever set after a
  // real, server-verified payment.
  orderId: string | null;
  paymentId: string | null;
  priceCents: number;
  currency: string;

  // Selection output - only ever populated once generationStatus is
  // 'completed'. imageFilename is a filename from the static catalogue
  // (catalogMatcher.ts) - the same filename is reused on every refresh, it
  // is never re-rolled once set.
  imageFilename: string | null;
  personalityDescription: string | null;
  compatibilityInsights: string[] | null;
  failureReason: string | null;

  createdAt: string;
  updatedAt: string;
}
