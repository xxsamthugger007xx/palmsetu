import { SoulmateSketch } from '../types/soulmate';
import { request as baseRequest, getAuthToken } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function request<T>(path: string, options?: RequestInit): Promise<T> {
  return baseRequest<T>(BASE_URL, path, options);
}

export interface SoulmateQuestionnaireAnswers {
  preferredGender: SoulmateSketch['preferredGender'];
  preferredAgeRange: SoulmateSketch['preferredAgeRange'];
  preferredCountry: string;
  style: SoulmateSketch['style'];
}

export const soulmateApi = {
  recordPageView: () => request<{ ok: true }>('/soulmate/events/page-view', { method: 'POST' }).catch(() => {}),
  recordQuestionnaireStarted: () => request<{ ok: true }>('/soulmate/events/questionnaire-started', { method: 'POST' }).catch(() => {}),

  createSketch: (answers: SoulmateQuestionnaireAnswers) =>
    request<{ sketch: SoulmateSketch; orderId: string | null; amountCents: number; currency: string; razorpayKeyId: string | null }>(
      '/soulmate/sketches',
      { method: 'POST', body: JSON.stringify(answers) }
    ),

  verifyPayment: (sketchId: string, payload: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    request<{ sketch: SoulmateSketch }>(`/soulmate/sketches/${sketchId}/verify-payment`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generate: (sketchId: string) =>
    request<{ sketch: SoulmateSketch }>(`/soulmate/sketches/${sketchId}/generate`, { method: 'POST' }),

  getSketch: (sketchId: string) => request<SoulmateSketch>(`/soulmate/sketches/${sketchId}`),

  listSketches: () => request<{ items: SoulmateSketch[] }>('/soulmate/sketches'),

  recordShare: (sketchId: string) => request<{ ok: true }>(`/soulmate/sketches/${sketchId}/share`, { method: 'POST' }).catch(() => {}),

  deleteSketch: (sketchId: string) => request<{ ok: true }>(`/soulmate/sketches/${sketchId}`, { method: 'DELETE' }),

  /** Watermarked version, composited fresh server-side from the bundled
   * catalogue original on every request - use this for sharing only. The
   * unwatermarked portrait itself is never fetched over the network: the
   * app renders it directly from its own bundled asset registry (see
   * data/soulmateSketchRegistry.ts), resolved by sketch.imageFilename. */
  shareImageUrl: (sketchId: string) => {
    const token = getAuthToken();
    return `${BASE_URL}/soulmate/sketches/${sketchId}/share-image${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};
