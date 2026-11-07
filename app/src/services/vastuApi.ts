import { PropertyProfile, RoomDirections, VastuDirectionEntry, VastuReport } from '../types/vastu';

import { request as baseRequest } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function request<T>(path: string, options?: RequestInit): Promise<T> {
  return baseRequest<T>(BASE_URL, path, options);
}

export const vastuApi = {
  getDirections: () => request<{ directions: VastuDirectionEntry[] }>('/vastu/directions'),

  getLimits: () =>
    request<{ tier: 'free' | 'premium'; canCreateProperty: boolean; propertiesUsed: number; freeLimit: number }>('/vastu/limits'),

  createProperty: (propertyType: string, rooms: Partial<RoomDirections>, notes: string | null) =>
    request<PropertyProfile>('/vastu/properties', {
      method: 'POST',
      body: JSON.stringify({ propertyType, rooms, notes }),
    }),

  getProperties: () => request<{ items: PropertyProfile[] }>('/vastu/properties'),

  getProperty: (id: string) => request<PropertyProfile>(`/vastu/properties/${id}`),

  deleteProperty: (id: string) => request<{ ok: true }>(`/vastu/properties/${id}`, { method: 'DELETE' }),

  generateReport: (propertyId: string) =>
    request<VastuReport>(`/vastu/properties/${propertyId}/report`, { method: 'POST' }),

  getReports: () => request<{ items: VastuReport[] }>('/vastu/reports'),

  getReport: (id: string) => request<VastuReport>(`/vastu/reports/${id}`),

  saveReport: (id: string, saved: boolean) =>
    request<VastuReport>(`/vastu/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ saved }) }),

  toggleChecklistItem: (reportId: string, itemId: string, completed: boolean) =>
    request<VastuReport>(`/vastu/reports/${reportId}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  deleteReport: (id: string) => request<{ ok: true }>(`/vastu/reports/${id}`, { method: 'DELETE' }),

  askFollowup: (id: string, question: string) =>
    request<{ answer: string; crisisFlag?: boolean }>(`/vastu/reports/${id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
};
