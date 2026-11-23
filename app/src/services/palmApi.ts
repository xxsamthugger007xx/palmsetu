import { DailyPalmGuidance, PalmReading, PalmSectionsResponse } from '../types/palm';

import { request as baseRequest } from './apiRequest';

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

  /** Short-lived signed URL (about 10 minutes) for showing a stored palm photo in an <Image>. <Image> makes its
   * own native request and cannot reliably send the Authorization header, so the server mints a URL that carries
   * its own expiring signature instead of the app putting the long-lived session token in a query string. */
  getImageUrl: async (id: string): Promise<string> => {
    const { url } = await request<{ url: string }>(`/palm/readings/${id}/image-url`);
    return `${BASE_URL}${url}`;
  },

  getDailyGuidance: (localDate: string) =>
    request<DailyPalmGuidance>(`/palm/daily-guidance?localDate=${localDate}`),
};
