import { DailyPalmGuidance, PalmReading } from '../types/palm';

import { request as baseRequest } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function request<T>(path: string, options?: RequestInit): Promise<T> {
  return baseRequest<T>(BASE_URL, path, options);
}

export const palmApi = {
  submitReading: (imageBase64: string) =>
    request<PalmReading>('/palm/readings', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64 }),
    }),

  getReading: (id: string) => request<PalmReading>(`/palm/readings/${id}`),

  listReadings: () => request<{ items: PalmReading[] }>('/palm/readings'),

  getLimits: () =>
    request<{ tier: string; premiumReportsUsed: number; freeLimit: number; canGeneratePremiumReport: boolean }>('/palm/limits'),

  generatePremiumReport: (id: string) =>
    request<PalmReading>(`/palm/readings/${id}/premium-report`, { method: 'POST' }),

  askAboutReading: (id: string, question: string) =>
    request<{ answer: string; crisisFlag?: boolean }>(`/palm/readings/${id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  deleteReading: (id: string) => request<{ ok: true }>(`/palm/readings/${id}`, { method: 'DELETE' }),

  getDailyGuidance: (localDate: string) =>
    request<DailyPalmGuidance>(`/palm/daily-guidance?localDate=${localDate}`),
};
