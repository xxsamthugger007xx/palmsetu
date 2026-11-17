import { request } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface AccountPublic {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthResult {
  token: string;
  account: AccountPublic;
}

export const authApi = {
  createGuestSession: () => request<{ token: string; guestId: string }>(BASE_URL, '/auth/guest', { method: 'POST' }),

  signUp: (email: string, password: string, turnstileToken: string | undefined) =>
    request<AuthResult>(BASE_URL, '/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, turnstileToken }) }),

  logIn: (email: string, password: string, turnstileToken: string | undefined) =>
    request<AuthResult>(BASE_URL, '/auth/login', { method: 'POST', body: JSON.stringify({ email, password, turnstileToken }) }),

  me: () => request<{ isGuest: true; userId: string } | { isGuest: false; account: AccountPublic }>(BASE_URL, '/auth/me'),

  logOut: () => request<{ ok: true }>(BASE_URL, '/auth/logout', { method: 'POST' }),

  migrateGuest: (guestToken: string) =>
    request<{ migratedCounts: Record<string, number> }>(BASE_URL, '/auth/migrate-guest', {
      method: 'POST',
      body: JSON.stringify({ guestToken }),
    }),

  deleteAccount: () => request<{ ok: true }>(BASE_URL, '/auth/account', { method: 'DELETE' }),

  exportData: () => request<Record<string, unknown>>(BASE_URL, '/auth/export'),
};
