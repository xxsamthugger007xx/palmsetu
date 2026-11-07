import {
  AstrologySystem, BirthProfile, DailyDeliveryPreference, DailyHoroscope,
  Relationship, RelationshipConsent, RelationshipDailyReport, ConsentType, UserIdentity, Gender,
} from '../types/astrology';
import { request } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function todayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const astrologyApi = {
  todayLocalDate,

  getProfile: () => request<BirthProfile>(BASE_URL, '/astrology/profile'),

  saveProfile: (payload: { birthDate: string; birthTime: string | null; birthPlace: string | null; latitude: number; longitude: number; preferredSystem: AstrologySystem; timezone: string }) =>
    request<BirthProfile>(BASE_URL, '/astrology/profile', { method: 'PUT', body: JSON.stringify(payload) }),

  // Identity (name, gender) - backend-persisted, decoupled from the birth
  // profile above. See UserIdentity in types/astrology.ts.
  getIdentity: () => request<UserIdentity>(BASE_URL, '/astrology/identity'),

  saveIdentity: (payload: { name: string; gender?: Gender | null }) =>
    request<UserIdentity>(BASE_URL, '/astrology/identity', { method: 'PUT', body: JSON.stringify(payload) }),

  getDaily: (localDate: string, system?: AstrologySystem) =>
    request<DailyHoroscope>(BASE_URL, `/astrology/daily?localDate=${localDate}${system ? `&system=${system}` : ''}`),

  retryDaily: (localDate: string, system?: AstrologySystem) =>
    request<DailyHoroscope>(BASE_URL, '/astrology/daily/retry', { method: 'POST', body: JSON.stringify({ localDate, system }) }),

  askFollowup: (horoscopeId: string, question: string) =>
    request<{ answer: string; crisisFlag?: boolean }>(BASE_URL, `/astrology/daily/${horoscopeId}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  createInvitation: () =>
    request<{ invitationId: string; code: string; expiresAt: string }>(BASE_URL, '/astrology/relationships/invitations', { method: 'POST' }),

  revokeInvitation: (invitationId: string) =>
    request<any>(BASE_URL, `/astrology/relationships/invitations/${invitationId}/revoke`, { method: 'POST' }),

  acceptInvitation: (code: string) =>
    request<Relationship>(BASE_URL, '/astrology/relationships/invitations/accept', { method: 'POST', body: JSON.stringify({ code }) }),

  getMyRelationship: () =>
    request<{ relationship: Relationship | null; myConsents: RelationshipConsent[] }>(BASE_URL, '/astrology/relationships/me'),

  updateConsent: (relationshipId: string, consentType: ConsentType, enabled: boolean) =>
    request<RelationshipConsent>(BASE_URL, `/astrology/relationships/${relationshipId}/consent`, {
      method: 'PATCH',
      body: JSON.stringify({ consentType, enabled }),
    }),

  disconnect: (relationshipId: string) =>
    request<Relationship>(BASE_URL, `/astrology/relationships/${relationshipId}/disconnect`, { method: 'POST' }),

  getSharedDaily: (relationshipId: string, localDate: string) =>
    request<RelationshipDailyReport>(BASE_URL, `/astrology/relationships/${relationshipId}/daily?localDate=${localDate}`),

  getRelationshipHistory: (relationshipId: string) =>
    request<{ items: RelationshipDailyReport[] }>(BASE_URL, `/astrology/relationships/${relationshipId}/history`),

  getPreferences: () => request<DailyDeliveryPreference>(BASE_URL, '/astrology/preferences'),

  savePreferences: (prefs: Partial<DailyDeliveryPreference>) =>
    request<DailyDeliveryPreference>(BASE_URL, '/astrology/preferences', { method: 'PUT', body: JSON.stringify(prefs) }),
};
