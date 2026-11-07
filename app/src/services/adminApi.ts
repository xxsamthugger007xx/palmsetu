/**
 * Thin HTTP client for the admin endpoints only. Every call sends the
 * prototype-grade `x-admin-role` header instead of real admin auth - see the
 * big comment in server/src/routes/admin.ts for why this is not real auth.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface AdminOverview {
  range: { since: string | null; until: string | null };
  totalUsers: number;
  usersByTier: { premium: number; free: number };
  readingsByFeature: Record<'tarot' | 'gemstone' | 'vastu' | 'astrology' | 'palm' | 'companion', number>;
  revenue: { available: false; reason: string };
  aiCost: { available: false; reason: string };
}

export interface AdminUserRow {
  userId: string;
  tier: 'free' | 'premium';
  readingCounts: Record<'tarot' | 'gemstone' | 'vastu' | 'astrology' | 'palm' | 'companion', number>;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface AdminUsersResponse {
  total: number;
  page: number;
  pageSize: number;
  users: AdminUserRow[];
}

export interface AdminFeatureBreakdown {
  total: number;
  byTier: { premium: number; free: number };
  [key: string]: unknown;
}

export interface AdminSystem {
  uptimeSeconds: number;
  nodeVersion: string;
  aiProvider: 'anthropic' | 'mock';
  recordCountsByStore: Record<string, number>;
  note: string;
  errorMonitoring: { available: false; reason: string };
}

async function adminRequest<T>(path: string, adminRole: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-admin-role': adminRole },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Admin API ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export const adminApi = {
  getOverview: (adminRole: string, params?: { since?: string; until?: string }) =>
    adminRequest<AdminOverview>(`/admin/overview${qs(params)}`, adminRole),

  getUsers: (adminRole: string, params?: { page?: number; pageSize?: number; search?: string }) =>
    adminRequest<AdminUsersResponse>(`/admin/users${qs(params)}`, adminRole),

  getUserDetail: (adminRole: string, userId: string) =>
    adminRequest<AdminUserRow>(`/admin/users/${encodeURIComponent(userId)}`, adminRole),

  getFeature: (adminRole: string, feature: 'tarot' | 'gemstone' | 'vastu' | 'astrology' | 'palm') =>
    adminRequest<AdminFeatureBreakdown>(`/admin/${feature}`, adminRole),

  getSystem: (adminRole: string) => adminRequest<AdminSystem>('/admin/system', adminRole),
};

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}
