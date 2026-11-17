import { PropertyProfile, PropertyRoom } from '../types/vastu';

/**
 * One-time (but safe-to-repeat) migration from the old fixed-room
 * PropertyProfile shape (rooms as a single object with exactly one
 * entrance/livingRoom/kitchen/masterBedroom/prayerRoom/bathroom slot) to
 * the new per-instance shape (rooms: PropertyRoom[], supporting any number
 * of bedrooms/bathrooms). See types/vastu.ts for the new shape.
 *
 * Every old room is preserved, including ones whose direction was null
 * (never silently dropped) - this is a lossless structural conversion, not
 * a data cleanup. Detection is based on `rooms` being a plain object
 * instead of an array, so this is idempotent: an already-migrated row is
 * left untouched on every later call.
 */

interface LegacyRoomDirections {
  entrance?: string | null;
  livingRoom?: string | null;
  kitchen?: string | null;
  masterBedroom?: string | null;
  prayerRoom?: string | null;
  bathroom?: string | null;
}

interface LegacyPropertyProfile {
  id: string;
  userId: string;
  propertyType: PropertyProfile['propertyType'];
  rooms: LegacyRoomDirections;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function needsMigration(raw: unknown): raw is LegacyPropertyProfile {
  if (!raw || typeof raw !== 'object') return false;
  const rooms = (raw as any).rooms;
  return rooms != null && typeof rooms === 'object' && !Array.isArray(rooms);
}

export function migrateLegacyPropertyProfile(legacy: LegacyPropertyProfile): PropertyProfile {
  const rooms: PropertyRoom[] = [
    { roomId: 'entrance-1', category: 'entrance', name: 'Main Entrance', direction: (legacy.rooms.entrance as any) ?? null },
    { roomId: 'livingRoom-1', category: 'livingRoom', name: 'Living Room', direction: (legacy.rooms.livingRoom as any) ?? null },
    { roomId: 'kitchen-1', category: 'kitchen', name: 'Kitchen', direction: (legacy.rooms.kitchen as any) ?? null },
    { roomId: 'bedroom-1', category: 'bedroom', name: 'Master Bedroom', direction: (legacy.rooms.masterBedroom as any) ?? null },
    { roomId: 'prayerRoom-1', category: 'prayerRoom', name: 'Prayer / Meditation Room', direction: (legacy.rooms.prayerRoom as any) ?? null },
    { roomId: 'bathroom-1', category: 'bathroom', name: 'Bathroom 1', direction: (legacy.rooms.bathroom as any) ?? null },
  ];

  return {
    id: legacy.id,
    userId: legacy.userId,
    propertyType: legacy.propertyType,
    bedroomCount: 1,
    bathroomCount: 1,
    rooms,
    notes: legacy.notes,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  };
}

/** Runs the migration over every stored property, in-place via the same
 * SqliteMap the rest of the app uses - safe to call on every boot. */
export function migrateVastuPropertiesIfNeeded(vastuPropertiesById: {
  entries(): Iterable<[string, PropertyProfile]>;
  set(key: string, value: PropertyProfile): unknown;
}): number {
  let migrated = 0;
  for (const [id, raw] of vastuPropertiesById.entries()) {
    if (needsMigration(raw)) {
      vastuPropertiesById.set(id, migrateLegacyPropertyProfile(raw as unknown as LegacyPropertyProfile));
      migrated += 1;
    }
  }
  return migrated;
}
