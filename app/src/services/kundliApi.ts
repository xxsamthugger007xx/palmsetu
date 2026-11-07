import { KundliChart, KundliChartStyle, KundliLimits, KundliSubject, SoulEnergyReading } from '../types/kundli';

import { request as baseRequest } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function request<T>(path: string, options?: RequestInit): Promise<T> {
  return baseRequest<T>(BASE_URL, path, options);
}

export interface CreateKundliPayload {
  style: KundliChartStyle;
  subject: KundliSubject;
  subjectName?: string;
  birthDate?: string;
  birthTime?: string;
  // Only needed for subject 'other' (self uses the saved profile's coordinates).
  latitude?: number;
  longitude?: number;
}

function todayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const kundliApi = {
  todayLocalDate,
  getLimits: () => request<KundliLimits>('/astrology/kundli/limits'),
  create: (payload: CreateKundliPayload) =>
    request<KundliChart>('/astrology/kundli', { method: 'POST', body: JSON.stringify(payload) }),
  getHistory: () => request<{ items: KundliChart[] }>('/astrology/kundli'),
  getById: (id: string) => request<KundliChart>(`/astrology/kundli/${id}`),
  getSoulEnergy: (localDate: string) =>
    request<SoulEnergyReading>(`/astrology/soul-energy?localDate=${localDate}`),
};
