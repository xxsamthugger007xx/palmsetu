import {
  DailyTarot,
  ReadingCategory,
  SpreadDefinition,
  SpreadType,
  TarotCard,
  TarotJournalEntry,
  TarotReading,
} from '../types/tarot';

import { request as baseRequest } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function request<T>(path: string, options?: RequestInit): Promise<T> {
  return baseRequest<T>(BASE_URL, path, options);
}

function todayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const tarotApi = {
  getCatalogue: () => request<{ cards: TarotCard[]; datasetVersion: string }>('/tarot/catalogue'),

  getSpreads: () => request<{ spreads: SpreadDefinition[] }>('/tarot/spreads'),

  getLimits: () => request<{ tier: 'free' | 'premium'; dailyReading: { allowed: boolean; reason?: string } }>('/tarot/limits'),

  getDailyCard: () =>
    request<{ daily: DailyTarot; reading: TarotReading }>(`/tarot/daily?localDate=${todayLocalDate()}`),

  startReading: (readingType: ReadingCategory, spreadType: SpreadType, question?: string) =>
    request<TarotReading | { crisisFlag: true; message: string }>('/tarot/readings', {
      method: 'POST',
      body: JSON.stringify({ readingType, spreadType, question }),
    }),

  interpretReading: (readingId: string) =>
    request<TarotReading>(`/tarot/readings/${readingId}/interpret`, { method: 'POST' }),

  getDetailedReport: (readingId: string) =>
    request<TarotReading>(`/tarot/readings/${readingId}/detailed-report`, { method: 'POST' }),

  askFollowup: (readingId: string, question: string) =>
    request<{ answer: string; crisisFlag?: boolean }>(`/tarot/readings/${readingId}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  getHistory: (page = 1, pageSize = 20) =>
    request<{ items: TarotReading[]; page: number; pageSize: number; total: number }>(
      `/tarot/readings?page=${page}&pageSize=${pageSize}`
    ),

  getReading: (readingId: string) => request<TarotReading>(`/tarot/readings/${readingId}`),

  saveReading: (readingId: string, saved: boolean) =>
    request<TarotReading>(`/tarot/readings/${readingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ saved }),
    }),

  deleteReading: (readingId: string) =>
    request<{ ok: true }>(`/tarot/readings/${readingId}`, { method: 'DELETE' }),

  addJournalEntry: (readingId: string, content: string) =>
    request<TarotJournalEntry>(`/tarot/readings/${readingId}/journal`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deleteJournalEntry: (journalId: string) =>
    request<{ ok: true }>(`/tarot/journal/${journalId}`, { method: 'DELETE' }),
};
