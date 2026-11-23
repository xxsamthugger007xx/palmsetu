import { describe, it, expect } from 'vitest';
import { v4 as uuid } from 'uuid';
import { createGuestSession, guestSessionsById, habitsById, journalEntriesById, accountsById } from '../data/store';
import { cleanupExpiredGuests } from './guestCleanup';

function seedGuest(ageDays: number) {
  const id = `guest-${uuid()}`;
  createGuestSession(id);
  const created = new Date(Date.now() - ageDays * 86_400_000).toISOString();
  guestSessionsById.set(id, { ...guestSessionsById.get(id)!, createdAt: created } as any);
  habitsById.set(uuid(), { id: uuid(), userId: id, name: 'h', frequency: 'daily', active: true, createdAt: created } as any);
  const jid = uuid();
  journalEntriesById.set(jid, { id: jid, userId: id, type: 'free-writing', content: 'guest diary', createdAt: created } as any);
  return id;
}

describe('guest cleanup', () => {
  it('deletes guests past retention with all their data; keeps recent guests and real accounts', () => {
    const old = seedGuest(120); const fresh = seedGuest(5);
    const acctId = `user-${uuid()}`;
    accountsById.set(acctId, { id: acctId, email: `${acctId}@x.com`, passwordHash: 'x', emailVerified: false, createdAt: '', updatedAt: '' } as any);
    habitsById.set(uuid(), { id: uuid(), userId: acctId, name: 'keep', frequency: 'daily', active: true, createdAt: new Date().toISOString() } as any);

    const r = cleanupExpiredGuests();
    expect(r.deletedGuests).toBeGreaterThanOrEqual(1);
    expect(guestSessionsById.get(old)).toBeUndefined();
    expect(habitsById.valuesForUser(old)).toEqual([]);
    expect(journalEntriesById.valuesForUser(old)).toEqual([]);
    expect(guestSessionsById.get(fresh)).toBeDefined();
    expect(habitsById.valuesForUser(fresh).length).toBe(1);
    expect(habitsById.valuesForUser(acctId).length).toBe(1);
  });

  it('works through a backlog in bounded batches', () => {
    process.env.GUEST_CLEANUP_BATCH = '2';
    for (let i = 0; i < 5; i++) seedGuest(200);
    const first = cleanupExpiredGuests();
    expect(first.deletedGuests).toBe(2);
    expect(first.remaining).toBeGreaterThanOrEqual(3);
    delete process.env.GUEST_CLEANUP_BATCH;
    while (cleanupExpiredGuests().remaining > 0) { /* drain */ }
  });
});
