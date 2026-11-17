import { DailyPalmGuidance, PalmReading, PalmSectionsResponse } from '../types/palm';

import { request as baseRequest, getAuthToken } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function request<T>(path: string, options?: RequestInit): Promise<T> {
  return baseRequest<T>(BASE_URL, path, options);
}

export const palmApi = {
  submitReading: (imageBase64: string, allowRescan?: boolean, hand?: 'left' | 'right') =>
    request<PalmReading>('/palm/readings', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64, allowRescan, hand }),
    }),

  /** The user's one permanent palm profile. Rejects with code NO_PROFILE
   * (404) if they have never completed a scan - callers branch on that to
   * show the first-time "Scan my palm" experience instead. */
  getProfile: () => request<PalmReading>('/palm/profile'),

  getReading: (id: string) => request<PalmReading>(`/palm/readings/${id}`),

  listReadings: () => request<{ items: PalmReading[] }>('/palm/readings'),

  getLimits: () =>
    request<{ tier: string; premiumReportsUsed: number; freeLimit: number; canGeneratePremiumReport: boolean }>('/palm/limits'),

  generatePremiumReport: (id: string) =>
    request<PalmReading>(`/palm/readings/${id}/premium-report`, { method: 'POST' }),

  getSections: (id: string) =>
    request<PalmSectionsResponse>(`/palm/readings/${id}/sections`),

  unlockSection: (id: string, section: string) =>
    request<{ unlocked: boolean; section: string; alreadyUnlocked?: boolean }>(
      `/palm/readings/${id}/sections/${section}/unlock`,
      { method: 'POST' }
    ),

  askAboutReading: (id: string, question: string) =>
    request<{ answer: string; crisisFlag?: boolean }>(`/palm/readings/${id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  deleteReading: (id: string) => request<{ ok: true }>(`/palm/readings/${id}`, { method: 'DELETE' }),

  /** Direct URL for displaying a stored palm photo in an <Image>. Embeds
   * the session token as a `?token=` query param, which the server accepts
   * as an alternative to the Authorization header (see auth/context.ts) -
   * RN's <Image> component makes its own native network request and does
   * not reliably attach custom headers the way apiRequest.ts's fetch()
   * wrapper does on every other call, so a header-only approach silently
   * 404s on some platforms/cache states even for an image the caller
   * genuinely owns. The query param is the primary mechanism; imageHeaders()
   * below is still passed too, as harmless defense in depth. */
  imageUrl: (id: string) => {
    const token = getAuthToken();
    return `${BASE_URL}/palm/readings/${id}/image${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  /** Headers to pair with imageUrl() on an <Image source={{ uri, headers }}>
   * - carries the same session token every other request already sends,
   * just attached manually since Image requests don't go through
   * apiRequest.ts. Returns {} (no Authorization header) if there is no
   * current token yet, matching how a plain request() call behaves before
   * AuthContext finishes its first bootstrap. */
  imageHeaders: (): Record<string, string> => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  getDailyGuidance: (localDate: string) =>
    request<DailyPalmGuidance>(`/palm/daily-guidance?localDate=${localDate}`),
};
