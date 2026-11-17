import { db } from '../data/db';

/**
 * Palm Setu User ID: a permanent, human-readable identifier ("PSU-000001")
 * assigned once per account UUID and never reused or changed. The internal
 * UUID (Account.id) remains the real foreign key everywhere else in the
 * app - this is purely a display/search convenience layered on top, backed
 * by user_psu_ids (see data/db.ts).
 *
 * Scoped to real registered accounts only (Account.id), not guest sessions:
 * guests have no durable identity to attach a permanent ID to, and the spec
 * this was built against calls out "every user" in the context of
 * registration, which guests never complete.
 */

const PSU_PREFIX = 'PSU-';
const PSU_DIGITS = 6;

function formatPsuId(seq: number): string {
  return `${PSU_PREFIX}${String(seq).padStart(PSU_DIGITS, '0')}`;
}

const stmts = {
  getByUuid: db.prepare('SELECT psuId FROM user_psu_ids WHERE uuid = ?'),
  getByPsuId: db.prepare('SELECT uuid FROM user_psu_ids WHERE psuId = ?'),
  insert: db.prepare('INSERT INTO user_psu_ids (uuid, psuId, createdAt) VALUES (?, ?, ?)'),
  updatePsuId: db.prepare('UPDATE user_psu_ids SET psuId = ? WHERE seq = ?'),
  countAll: db.prepare('SELECT COUNT(*) as c FROM user_psu_ids'),
};

/**
 * Returns the existing PSU ID for this UUID, or atomically assigns and
 * returns a new one. Call this exactly once per account at registration
 * time, and it is also safe to call repeatedly (idempotent) for backfill.
 */
export function getOrCreatePsuId(uuid: string): string {
  const existing = stmts.getByUuid.get(uuid) as { psuId: string } | undefined;
  if (existing) return existing.psuId;

  const assign = db.transaction((u: string) => {
    // Re-check inside the transaction in case of a backfill race (two
    // callers both missing the row before either had inserted).
    const row = stmts.getByUuid.get(u) as { psuId: string } | undefined;
    if (row) return row.psuId;
    const info = stmts.insert.run(u, '', new Date().toISOString());
    const seq = Number(info.lastInsertRowid);
    const psuId = formatPsuId(seq);
    stmts.updatePsuId.run(psuId, seq);
    return psuId;
  });

  return assign(uuid);
}

export function getPsuIdForUuid(uuid: string): string | null {
  const row = stmts.getByUuid.get(uuid) as { psuId: string } | undefined;
  return row?.psuId ?? null;
}

export function getUuidForPsuId(psuId: string): string | null {
  const row = stmts.getByPsuId.get(psuId.trim().toUpperCase()) as { uuid: string } | undefined;
  return row?.uuid ?? null;
}

export function psuIdCount(): number {
  return (stmts.countAll.get() as { c: number }).c;
}

/**
 * One-time (but safe-to-repeat) backfill: assigns a PSU ID to every
 * existing account that doesn't have one yet, oldest-first by
 * Account.createdAt, so IDs roughly track registration order. Run on every
 * server boot (see index.ts) - a no-op after the first successful run
 * since getOrCreatePsuId is idempotent per UUID.
 */
export function backfillPsuIds(accounts: { id: string; createdAt: string }[]): number {
  const sorted = [...accounts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let assigned = 0;
  for (const account of sorted) {
    const before = stmts.getByUuid.get(account.id) as { psuId: string } | undefined;
    if (before) continue;
    getOrCreatePsuId(account.id);
    assigned += 1;
  }
  return assigned;
}
