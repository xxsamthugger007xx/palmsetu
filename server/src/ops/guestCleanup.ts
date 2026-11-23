import { db } from '../data/db';
import { deleteAllUserData } from '../auth/accountData';
import { reportError } from './alerts';

/**
 * Guest sessions are created for everyone who opens the app, and used to live forever. This removes guests (and every
 * row of their data, via the same generic deletion used for account deletion) once they are older than
 * GUEST_RETENTION_DAYS (default 90). A guest who signed up or logged in has already had their data moved to the
 * account (auth/guestMigration.ts), so their old guest record is just an empty shell and goes too.
 * Bounded per run (GUEST_CLEANUP_BATCH, default 100) so a big backlog is worked off over several runs instead of
 * blocking the server.
 */
const retentionDays = () => Math.max(7, Number(process.env.GUEST_RETENTION_DAYS) || 90);
const batchSize = () => Math.max(1, Number(process.env.GUEST_CLEANUP_BATCH) || 100);

let lastRun: { at: string; deletedGuests: number; remainingEstimate: number } | null = null;
export const lastGuestCleanup = () => lastRun;

export function cleanupExpiredGuests(now: Date = new Date()): { deletedGuests: number; remaining: number } {
  const cutoff = new Date(now.getTime() - retentionDays() * 86_400_000).toISOString();
  const due = db.prepare(
    "SELECT key FROM kv_guestSessions WHERE json_extract(value, '$.createdAt') < ? ORDER BY json_extract(value, '$.createdAt') LIMIT ?",
  ).all(cutoff, batchSize()) as { key: string }[];

  let deleted = 0;
  for (const { key } of due) {
    if (!key.startsWith('guest-')) continue; // only ever touch guest ids
    deleteAllUserData(key); // removes the session record itself too (it contains the guest id)
    db.prepare('DELETE FROM kv_guestSessions WHERE key = ?').run(key);
    deleted++;
  }
  const remaining = (db.prepare("SELECT COUNT(*) c FROM kv_guestSessions WHERE json_extract(value, '$.createdAt') < ?").get(cutoff) as { c: number }).c;
  lastRun = { at: now.toISOString(), deletedGuests: deleted, remainingEstimate: remaining };
  if (deleted) console.log(`[solune] guest cleanup: removed ${deleted} expired guest session(s), ${remaining} still due`);
  return { deletedGuests: deleted, remaining };
}

export function startGuestCleanup(): void {
  if (process.env.NODE_ENV === 'test' || process.env.GUEST_CLEANUP_ENABLED === 'false') return;
  const run = () => { try { cleanupExpiredGuests(); } catch (err) { reportError('guest-cleanup', err); } };
  setTimeout(run, 60_000).unref(); // a minute after boot, so startup stays quick
  setInterval(run, 6 * 3_600_000).unref();
}
