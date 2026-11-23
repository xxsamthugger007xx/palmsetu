import { Building2, Home, Store, Briefcase, HelpCircle } from 'lucide-react-native';
import { PropertyRoom, PropertyType, RoomCategory } from '../../types/vastu';

export const propertyTypes: { id: PropertyType; label: string; icon: typeof Home }[] = [
  { id: 'apartment', label: 'Apartment', icon: Building2 },
  { id: 'independent-house', label: 'House', icon: Home },
  { id: 'office', label: 'Office', icon: Briefcase },
  { id: 'shop', label: 'Shop', icon: Store },
  { id: 'other', label: 'Other', icon: HelpCircle },
];

export const COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6];

export const COMMON_ROOMS: { category: RoomCategory; roomId: string; defaultName: string }[] = [
  { category: 'entrance', roomId: 'entrance-1', defaultName: 'Main Entrance' },
  { category: 'livingRoom', roomId: 'livingRoom-1', defaultName: 'Living Room' },
  { category: 'kitchen', roomId: 'kitchen-1', defaultName: 'Kitchen' },
  { category: 'prayerRoom', roomId: 'prayerRoom-1', defaultName: 'Prayer / Meditation Room' },
];

export const CUSTOM_ROOM_SUGGESTIONS = [
  'Study Room', 'Balcony', 'Dining Room', 'Store Room', 'Pooja Room', 'Garage', 'Staircase', 'Garden', 'Office Room', 'Utility Room',
];

export function defaultBedroomName(index: number): string {
  return index === 1 ? 'Master Bedroom' : `Bedroom ${index}`;
}
export function defaultBathroomName(index: number): string {
  return `Bathroom ${index}`;
}

/** Rebuilds the bedroom/bathroom slice of `rooms` for a new count, keeping
 * every room that still fits (same roomId -> same direction/name preserved)
 * and only ever adding/removing from the end - never reassigning an
 * existing room's direction to a different index. */
export function resizeCountedRooms(
  rooms: PropertyRoom[],
  category: 'bedroom' | 'bathroom',
  newCount: number,
  defaultName: (i: number) => string,
): PropertyRoom[] {
  const prefix = category;
  const others = rooms.filter((r) => r.category !== category);
  const existing = rooms.filter((r) => r.category === category);
  const next: PropertyRoom[] = [];
  for (let i = 1; i <= newCount; i++) {
    const roomId = `${prefix}-${i}`;
    const found = existing.find((r) => r.roomId === roomId);
    next.push(found ?? { roomId, category, name: defaultName(i), direction: null });
  }
  return [...others, ...next];
}

export function countedRoomsLoseData(rooms: PropertyRoom[], category: 'bedroom' | 'bathroom', newCount: number): boolean {
  return rooms.some((r) => r.category === category && Number(r.roomId.split('-')[1]) > newCount && r.direction);
}

