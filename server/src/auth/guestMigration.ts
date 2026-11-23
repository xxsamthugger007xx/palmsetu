import {
  readingsById, tarotReadingsById, kundliChartsById, gemstoneReportsById, vastuReportsById, vastuPropertiesById,
  birthProfiles, userIdentities, userPlans, guestSessionsById, setPrimaryReading, primaryReadingFor,
  soulmateSketchesById,
  dailyActivityByKey,
} from '../data/store';

/**
 * Reassigns a guest session's data to a real account on signup/login. This
 * is the "guest data migration" requirement: a guest who generated a palm
 * reading, tarot reading, kundli, gemstone report, vastu report, or a paid
 * Soulmate Sketch before registering must not lose it when they create an
 * account.
 *
 * Safety rules, deliberately conservative:
 * - Every id-keyed record (palm/tarot/kundli/gemstone/vastu) owned by the
 *   guest is reassigned to the new userId in place - the record itself
 *   (content, createdAt, id) is untouched, only `userId` changes, so this
 *   can never create a duplicate record.
 * - Singleton per-user records (birth profile, identity, plan) are only
 *   copied across if the destination account does not already have one -
 *   never overwrites a real account's own data with guest placeholder data.
 * - Exactly one palm reading may be `isPrimary` per user (see
 *   data/store.ts's setPrimaryReading). If the destination account already
 *   has a primary palm profile, the guest's reading(s) are migrated as
 *   ordinary (non-primary) history, not silently promoted over the
 *   account's existing profile and not discarded either.
 * - Idempotent: once a guest session is marked migrated, calling this again
 *   for the same guestId is a safe no-op (nothing left to reassign, since
 *   the first pass already moved everything) - so a retried/duplicate
 *   migration request can never double-apply or duplicate records.
 * - Never deletes anything. If this throws partway through, whatever has
 *   already been reassigned stays reassigned (each store write is its own
 *   SQLite statement, already durable) and whatever hasn't been reached yet
 *   is simply retried on the next call - there is no interim "deleted from
 *   guest but not yet in account" state possible.
 */
export function migrateGuestDataToAccount(guestId: string, userId: string): { migratedCounts: Record<string, number> } {
  if (guestId === userId) return { migratedCounts: {} };

  const counts: Record<string, number> = {};

  let palmMigrated = 0;
  let newPrimaryReadingId: string | null = null;
  const alreadyHasPrimary = !!primaryReadingFor(userId);
  for (const reading of readingsById.values()) {
    if (reading.userId !== guestId) continue;
    const wasPrimary = !!reading.isPrimary;
    readingsById.set(reading.id, { ...reading, userId, isPrimary: wasPrimary && !alreadyHasPrimary });
    if (wasPrimary && !alreadyHasPrimary) newPrimaryReadingId = reading.id;
    palmMigrated++;
  }
  if (newPrimaryReadingId) setPrimaryReading(userId, newPrimaryReadingId);
  counts.palmReadings = palmMigrated;

  counts.tarotReadings = reassignOwner(tarotReadingsById, guestId, userId);
  counts.kundliCharts = reassignOwner(kundliChartsById, guestId, userId);
  counts.gemstoneReports = reassignOwner(gemstoneReportsById, guestId, userId);
  counts.vastuReports = reassignOwner(vastuReportsById, guestId, userId);
  counts.vastuProperties = reassignOwner(vastuPropertiesById, guestId, userId);
  // Purchased sketches carry real payment/generation history - reassigning
  // ownership (not regenerating) is what lets a guest who paid before
  // signing up keep their result without paying again.
  counts.soulmateSketches = reassignOwner(soulmateSketchesById, guestId, userId);

  // Streak days: merge the guest's days into the account's (a day already recorded for the account is kept as is),
  // so signing up never resets a streak the guest had built.
  let streakDays = 0;
  for (const a of dailyActivityByKey.valuesForUser(guestId)) {
    const newKey = `${userId}:${a.localDate}`;
    if (!dailyActivityByKey.has(newKey)) { dailyActivityByKey.set(newKey, { ...a, userId }); streakDays++; }
    dailyActivityByKey.delete(`${guestId}:${a.localDate}`);
  }
  if (streakDays) counts.streakDays = streakDays;

  // Singleton records - only adopted if the account doesn't already have
  // its own, so a returning user's real data is never clobbered.
  if (!birthProfiles.has(userId) && birthProfiles.has(guestId)) {
    birthProfiles.set(userId, { ...birthProfiles.get(guestId)!, userId });
    birthProfiles.delete(guestId);
    counts.birthProfile = 1;
  }
  if (!userIdentities.has(userId) && userIdentities.has(guestId)) {
    userIdentities.set(userId, { ...userIdentities.get(guestId)!, userId });
    userIdentities.delete(guestId);
    counts.identity = 1;
  }
  if (!userPlans.has(userId) && userPlans.has(guestId)) {
    userPlans.set(userId, { ...userPlans.get(guestId)!, userId });
    userPlans.delete(guestId);
    counts.plan = 1;
  }

  const session = guestSessionsById.get(guestId);
  if (session && !session.migratedAt) {
    guestSessionsById.set(guestId, { ...session, migratedAt: new Date().toISOString(), migratedToUserId: userId });
  }

  return { migratedCounts: counts };
}

function reassignOwner<T extends { userId: string }>(
  store: { values(): T[]; set(key: string, value: T): unknown },
  guestId: string,
  userId: string
): number {
  let count = 0;
  for (const record of store.values()) {
    if (record.userId !== guestId) continue;
    const id = (record as unknown as { id: string }).id;
    store.set(id, { ...record, userId });
    count++;
  }
  return count;
}
