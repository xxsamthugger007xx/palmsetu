import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../data/db';

/**
 * Real Super Admin authentication for the browser admin panel, replacing
 * the old single-shared-password-in-an-env-var + in-memory-session
 * mechanism that used to live in routes/admin.ts. Backed by the
 * admin_users / admin_sessions / admin_login_history tables (see
 * data/db.ts). Sessions and login history are now durable across restarts,
 * which the old mechanism explicitly was not.
 *
 * There is still no public admin registration anywhere - the only way an
 * admin_users row is created is bootstrapSuperAdminIfNeeded() below (first
 * boot only, from env vars) or a future "invite staff" admin-only endpoint
 * that does not exist yet.
 */

export const ADMIN_ROLES = ['super_admin', 'analyst', 'viewer'] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  mfaSecret: string | null;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SALT_ROUNDS = 12;

function nowIso(): string {
  return new Date().toISOString();
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// --- admin_users ------------------------------------------------------------

const userStmts = {
  byEmail: db.prepare('SELECT * FROM admin_users WHERE email = ?'),
  byId: db.prepare('SELECT * FROM admin_users WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) as c FROM admin_users'),
  insert: db.prepare(`
    INSERT INTO admin_users (id, email, passwordHash, role, status, mfaSecret, mfaEnabled, createdAt, updatedAt)
    VALUES (@id, @email, @passwordHash, @role, @status, @mfaSecret, @mfaEnabled, @createdAt, @updatedAt)
  `),
  setMfa: db.prepare('UPDATE admin_users SET mfaSecret = ?, mfaEnabled = ?, updatedAt = ? WHERE id = ?'),
  all: db.prepare('SELECT id, email, role, status, mfaEnabled, createdAt, updatedAt FROM admin_users ORDER BY createdAt ASC'),
  setRole: db.prepare('UPDATE admin_users SET role = ?, updatedAt = ? WHERE id = ?'),
  setStatus: db.prepare('UPDATE admin_users SET status = ?, updatedAt = ? WHERE id = ?'),
};

function rowToAdminUser(row: any): AdminUser {
  return { ...row, mfaEnabled: !!row.mfaEnabled };
}

export function findAdminByEmail(email: string): AdminUser | undefined {
  const row = userStmts.byEmail.get(email.toLowerCase());
  return row ? rowToAdminUser(row) : undefined;
}

export function findAdminById(id: string): AdminUser | undefined {
  const row = userStmts.byId.get(id);
  return row ? rowToAdminUser(row) : undefined;
}

export function listAdminUsers() {
  return userStmts.all.all();
}

/**
 * Creates the first Super Admin from environment variables, but only if
 * admin_users is completely empty - idempotent and safe to call on every
 * boot. This is the "controlled administrative setup process" instead of a
 * hardcoded credential: the actual password only ever lives in the
 * deploy environment's secret store, never in source.
 */
export async function bootstrapSuperAdminIfNeeded(): Promise<{ created: boolean; email?: string }> {
  const existing = (userStmts.count.get() as { c: number }).c;
  if (existing > 0) return { created: false };

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.warn(
      '[adminAuth] No admin_users exist yet and SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD are not set - ' +
      'the admin panel has no one who can log in. Set both env vars and restart to provision the first Super Admin.',
    );
    return { created: false };
  }
  if (password.length < 12) {
    console.warn('[adminAuth] SUPER_ADMIN_PASSWORD is shorter than 12 characters - refusing to provision. Use a longer password.');
    return { created: false };
  }

  const now = nowIso();
  const admin: AdminUser = {
    id: `admin-${crypto.randomUUID()}`,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    role: 'super_admin',
    status: 'active',
    mfaSecret: null,
    mfaEnabled: false,
    createdAt: now,
    updatedAt: now,
  };
  userStmts.insert.run({ ...admin, mfaEnabled: 0 });
  // eslint-disable-next-line no-console
  console.log(`[adminAuth] Provisioned first Super Admin: ${admin.email}`);
  return { created: true, email: admin.email };
}

/**
 * Invites a new staff admin (analyst/viewer, or another super_admin) -
 * called only from an authenticated super_admin admin route. The invited
 * admin's first password is set here directly (no email-invite flow exists
 * yet); the admin panel should ask the inviter to communicate it
 * out-of-band and prompt the new admin to log in once.
 */
export async function createAdminUser(email: string, password: string, role: AdminRole): Promise<AdminUser> {
  if (findAdminByEmail(email)) throw new Error('An admin with that email already exists.');
  const now = nowIso();
  const admin: AdminUser = {
    id: `admin-${crypto.randomUUID()}`,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    role,
    status: 'active',
    mfaSecret: null,
    mfaEnabled: false,
    createdAt: now,
    updatedAt: now,
  };
  userStmts.insert.run({ ...admin, mfaEnabled: 0 });
  return admin;
}

export function setAdminRole(adminId: string, role: AdminRole): void {
  userStmts.setRole.run(role, nowIso(), adminId);
}

export function setAdminStatus(adminId: string, status: 'active' | 'disabled'): void {
  userStmts.setStatus.run(status, nowIso(), adminId);
  if (status === 'disabled') revokeAllSessionsForAdmin(adminId);
}

// --- password verification ---------------------------------------------------

export async function verifyAdminPassword(admin: AdminUser, plain: string): Promise<boolean> {
  return bcrypt.compare(plain, admin.passwordHash);
}

// --- TOTP (RFC 6238), no external dependency ---------------------------------

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

/** Accepts the current 30s window and one window on either side, to tolerate clock drift. */
export function verifyTotpCode(secret: string, code: string): boolean {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (const delta of [0, -1, 1]) {
    if (hotp(secret, counter + delta) === code.trim()) return true;
  }
  return false;
}

export function totpOtpauthUrl(email: string, secret: string): string {
  const label = encodeURIComponent(`Palm Setu Admin:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Palm Setu Admin')}&digits=6&period=30`;
}

export function setAdminMfa(adminId: string, secret: string | null, enabled: boolean) {
  userStmts.setMfa.run(secret, enabled ? 1 : 0, nowIso(), adminId);
}

// --- login rate limiting (per ip+email, in-memory - resets on restart, --------
// acceptable since a real failed-login row is also durably logged below) -----

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;
const attemptsByKey = new Map<string, { failures: number; lockedUntil: number | null }>();

export function isLoginLocked(ip: string, email: string): number | null {
  const state = attemptsByKey.get(`${ip}:${email.toLowerCase()}`);
  if (state?.lockedUntil && state.lockedUntil > Date.now()) {
    return Math.ceil((state.lockedUntil - Date.now()) / 1000);
  }
  return null;
}

function recordLoginFailure(ip: string, email: string) {
  const key = `${ip}:${email.toLowerCase()}`;
  const state = attemptsByKey.get(key) ?? { failures: 0, lockedUntil: null };
  state.failures += 1;
  if (state.failures >= MAX_FAILED_ATTEMPTS) {
    state.lockedUntil = Date.now() + LOCKOUT_MS;
    state.failures = 0;
  }
  attemptsByKey.set(key, state);
}

function clearLoginFailures(ip: string, email: string) {
  attemptsByKey.delete(`${ip}:${email.toLowerCase()}`);
}

// --- login history (durable) --------------------------------------------------

const loginHistoryStmts = {
  insert: db.prepare(`
    INSERT INTO admin_login_history (id, adminId, email, success, failureReason, ip, userAgent, createdAt)
    VALUES (@id, @adminId, @email, @success, @failureReason, @ip, @userAgent, @createdAt)
  `),
  list: db.prepare('SELECT * FROM admin_login_history ORDER BY createdAt DESC LIMIT ? OFFSET ?'),
  count: db.prepare('SELECT COUNT(*) as c FROM admin_login_history'),
};

function recordLoginHistory(entry: { adminId: string | null; email: string; success: boolean; failureReason?: string; ip: string; userAgent: string }) {
  loginHistoryStmts.insert.run({
    id: crypto.randomUUID(),
    adminId: entry.adminId,
    email: entry.email,
    success: entry.success ? 1 : 0,
    failureReason: entry.failureReason ?? null,
    ip: entry.ip,
    userAgent: entry.userAgent,
    createdAt: nowIso(),
  });
}

export function listLoginHistory(page: number, pageSize: number) {
  const total = (loginHistoryStmts.count.get() as { c: number }).c;
  const entries = loginHistoryStmts.list.all(pageSize, (page - 1) * pageSize);
  return { total, entries };
}

// --- sessions (durable, token stored only as a hash) ---------------------------

const sessionStmts = {
  insert: db.prepare(`
    INSERT INTO admin_sessions (id, adminId, tokenHash, createdAt, expiresAt, ip, userAgent)
    VALUES (@id, @adminId, @tokenHash, @createdAt, @expiresAt, @ip, @userAgent)
  `),
  byTokenHash: db.prepare('SELECT * FROM admin_sessions WHERE tokenHash = ? AND revokedAt IS NULL'),
  byAdmin: db.prepare('SELECT * FROM admin_sessions WHERE adminId = ? ORDER BY createdAt DESC'),
  revoke: db.prepare('UPDATE admin_sessions SET revokedAt = ? WHERE id = ? AND adminId = ?'),
  revokeAllForAdmin: db.prepare('UPDATE admin_sessions SET revokedAt = ? WHERE adminId = ? AND revokedAt IS NULL'),
};

export interface AdminSessionContext {
  sessionId: string;
  adminId: string;
  role: AdminRole;
}

export function createAdminSession(adminId: string, role: AdminRole, ip: string, userAgent: string): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  sessionStmts.insert.run({
    id: crypto.randomUUID(),
    adminId,
    tokenHash: sha256(token),
    createdAt: nowIso(),
    expiresAt,
    ip,
    userAgent,
  });
  // role is looked up fresh on every request from admin_users, never trusted
  // from the token itself - the token is an opaque bearer credential only.
  void role;
  return { token, expiresAt };
}

/** Resolves a bearer token to an admin + role, or null if missing/expired/revoked/disabled. */
export function resolveAdminSession(token: string): AdminSessionContext | null {
  const row = sessionStmts.byTokenHash.get(sha256(token)) as any;
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null;
  const admin = findAdminById(row.adminId);
  if (!admin || admin.status !== 'active') return null;
  return { sessionId: row.id, adminId: admin.id, role: admin.role };
}

export function listSessionsForAdmin(adminId: string) {
  return (sessionStmts.byAdmin.all(adminId) as any[]).map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    revokedAt: s.revokedAt,
    ip: s.ip,
    userAgent: s.userAgent,
    active: !s.revokedAt && new Date(s.expiresAt).getTime() > Date.now(),
  }));
}

export function revokeSession(adminId: string, sessionId: string): boolean {
  const info = sessionStmts.revoke.run(nowIso(), sessionId, adminId);
  return info.changes > 0;
}

export function revokeAllSessionsForAdmin(adminId: string) {
  sessionStmts.revokeAllForAdmin.run(nowIso(), adminId);
}

// --- login flow ----------------------------------------------------------------

export type LoginResult =
  | { ok: true; token: string; expiresAt: string; role: AdminRole; adminId: string; email: string }
  | { ok: false; status: number; error: string; retryAfterSeconds?: number };

export async function performAdminLogin(params: { email: string; password: string; totpCode?: string; ip: string; userAgent: string }): Promise<LoginResult> {
  const { email, password, totpCode, ip, userAgent } = params;

  const lockedFor = isLoginLocked(ip, email);
  if (lockedFor) {
    return { ok: false, status: 429, error: `Too many failed login attempts. Try again in ${lockedFor}s.`, retryAfterSeconds: lockedFor };
  }

  const admin = findAdminByEmail(email);
  if (!admin || admin.status !== 'active') {
    recordLoginFailure(ip, email);
    recordLoginHistory({ adminId: admin?.id ?? null, email, success: false, failureReason: 'invalid_credentials', ip, userAgent });
    return { ok: false, status: 401, error: 'Incorrect email or password.' };
  }

  const passwordOk = await verifyAdminPassword(admin, password);
  if (!passwordOk) {
    recordLoginFailure(ip, email);
    recordLoginHistory({ adminId: admin.id, email, success: false, failureReason: 'invalid_credentials', ip, userAgent });
    return { ok: false, status: 401, error: 'Incorrect email or password.' };
  }

  if (admin.mfaEnabled) {
    if (!totpCode) {
      return { ok: false, status: 401, error: 'MFA code required.' };
    }
    if (!admin.mfaSecret || !verifyTotpCode(admin.mfaSecret, totpCode)) {
      recordLoginFailure(ip, email);
      recordLoginHistory({ adminId: admin.id, email, success: false, failureReason: 'invalid_mfa', ip, userAgent });
      return { ok: false, status: 401, error: 'Incorrect MFA code.' };
    }
  }

  clearLoginFailures(ip, email);
  recordLoginHistory({ adminId: admin.id, email, success: true, ip, userAgent });
  const { token, expiresAt } = createAdminSession(admin.id, admin.role, ip, userAgent);
  return { ok: true, token, expiresAt, role: admin.role, adminId: admin.id, email: admin.email };
}

// --- admin action audit log (durable) -------------------------------------------

const auditStmts = {
  insert: db.prepare(`
    INSERT INTO admin_audit_log (id, adminId, action, path, targetType, targetId, reason, outcome, metadata, createdAt)
    VALUES (@id, @adminId, @action, @path, @targetType, @targetId, @reason, @outcome, @metadata, @createdAt)
  `),
  list: db.prepare('SELECT * FROM admin_audit_log ORDER BY createdAt DESC LIMIT ? OFFSET ?'),
  count: db.prepare('SELECT COUNT(*) as c FROM admin_audit_log'),
};

export function logAdminAudit(entry: {
  adminId: string;
  action: string;
  path: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  outcome?: 'success' | 'denied' | 'error';
  metadata?: Record<string, unknown>;
}) {
  auditStmts.insert.run({
    id: crypto.randomUUID(),
    adminId: entry.adminId,
    action: entry.action,
    path: entry.path,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    reason: entry.reason ?? null,
    outcome: entry.outcome ?? 'success',
    metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    createdAt: nowIso(),
  });
}

export function listAdminAudit(page: number, pageSize: number) {
  const total = (auditStmts.count.get() as { c: number }).c;
  const entries = (auditStmts.list.all(pageSize, (page - 1) * pageSize) as any[]).map((e) => ({
    ...e,
    adminEmail: findAdminById(e.adminId)?.email ?? null,
    adminRole: findAdminById(e.adminId)?.role ?? null,
    metadata: e.metadata ? JSON.parse(e.metadata) : null,
  }));
  return { total, entries };
}
