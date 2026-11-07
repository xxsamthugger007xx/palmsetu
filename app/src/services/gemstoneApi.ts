import { GemstoneReport } from '../types/gemstone';

import { request as baseRequest } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function request<T>(path: string, options?: RequestInit): Promise<T> {
  return baseRequest<T>(BASE_URL, path, options);
}

export const gemstoneApi = {
  getLimits: () =>
    request<{ tier: 'free' | 'premium'; canCreateReport: boolean; reportsUsed: number; freeLimit: number }>('/gemstone/limits'),

  createReport: (goals: string[], budget: string | null) =>
    request<GemstoneReport>('/gemstone/reports', { method: 'POST', body: JSON.stringify({ goals, budget }) }),

  getHistory: () => request<{ items: GemstoneReport[] }>('/gemstone/reports'),

  getReport: (id: string) => request<GemstoneReport>(`/gemstone/reports/${id}`),

  saveReport: (id: string, saved: boolean) =>
    request<GemstoneReport>(`/gemstone/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ saved }) }),

  deleteReport: (id: string) => request<{ ok: true }>(`/gemstone/reports/${id}`, { method: 'DELETE' }),

  askFollowup: (id: string, question: string) =>
    request<{ answer: string; crisisFlag?: boolean }>(`/gemstone/reports/${id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
};
