export type SoulmateGender = 'male' | 'female' | 'no-preference';
export type SoulmateAgeRange = '18-24' | '25-30' | '31-35' | '36-40' | '40+';
export type SoulmateStyle = 'pencil' | 'charcoal' | 'soft-portrait';
export type SoulmateGenerationStatus = 'pending_payment' | 'payment_verified' | 'generating' | 'completed' | 'failed';

export interface SoulmateSketch {
  id: string;
  userId: string;
  preferredGender: SoulmateGender;
  preferredAgeRange: SoulmateAgeRange;
  preferredCountry: string;
  style: SoulmateStyle;
  generationStatus: SoulmateGenerationStatus;
  isFreeTrial: boolean;
  orderId: string | null;
  paymentId: string | null;
  priceCents: number;
  currency: string;
  /** Filename of a bundled static portrait asset - resolve via
   * SOULMATE_SKETCH_REGISTRY (data/soulmateSketchRegistry.ts) before
   * passing to <Image source=.../>. Never a network URL. */
  imageFilename: string | null;
  personalityDescription: string | null;
  compatibilityInsights: string[] | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}
