import { describe, it, expect, vi } from 'vitest';
vi.mock('lucide-react-native', () => ({ Building2: 'B', Home: 'H', Store: 'S', Briefcase: 'Br', HelpCircle: 'Q' }));
import { resizeCountedRooms, countedRoomsLoseData, defaultBedroomName, defaultBathroomName, COMMON_ROOMS } from './vastuRooms';
import type { PropertyRoom } from '../../types/vastu';

const room = (roomId: string, category: PropertyRoom['category'], direction: PropertyRoom['direction'] = null, name = roomId): PropertyRoom => ({ roomId, category, name, direction });

describe('vastu room helpers', () => {
  it('names bedrooms and bathrooms by position', () => {
    expect(defaultBedroomName(1)).toBe('Master Bedroom');
    expect(defaultBedroomName(3)).toBe('Bedroom 3');
    expect(defaultBathroomName(2)).toBe('Bathroom 2');
  });

  it('growing the count keeps existing rooms (and their directions) and appends new ones', () => {
    const rooms = [room('bedroom-1', 'bedroom', 'NE', 'Master'), room('kitchen-1', 'kitchen', 'SE')];
    const next = resizeCountedRooms(rooms, 'bedroom', 3, defaultBedroomName);
    expect(next.filter((r) => r.category === 'bedroom').map((r) => r.roomId)).toEqual(['bedroom-1', 'bedroom-2', 'bedroom-3']);
    expect(next.find((r) => r.roomId === 'bedroom-1')).toMatchObject({ direction: 'NE', name: 'Master' });
    expect(next.find((r) => r.roomId === 'bedroom-3')).toMatchObject({ direction: null, name: 'Bedroom 3' });
    expect(next.find((r) => r.roomId === 'kitchen-1')?.direction).toBe('SE');
  });

  it('shrinking removes only from the end and never touches other categories', () => {
    const rooms = [room('bedroom-1', 'bedroom', 'N'), room('bedroom-2', 'bedroom', 'S'), room('bathroom-1', 'bathroom', 'E')];
    const next = resizeCountedRooms(rooms, 'bedroom', 1, defaultBedroomName);
    expect(next.map((r) => r.roomId).sort()).toEqual(['bathroom-1', 'bedroom-1']);
    expect(next.find((r) => r.roomId === 'bedroom-1')?.direction).toBe('N');
    expect(resizeCountedRooms(rooms, 'bedroom', 0, defaultBedroomName).filter((r) => r.category === 'bedroom')).toEqual([]);
  });

  it('warns only when shrinking would drop a room that already has a direction', () => {
    const rooms = [room('bedroom-1', 'bedroom', null), room('bedroom-2', 'bedroom', 'S')];
    expect(countedRoomsLoseData(rooms, 'bedroom', 1)).toBe(true);
    expect(countedRoomsLoseData(rooms, 'bedroom', 2)).toBe(false);
    expect(countedRoomsLoseData([room('bedroom-1', 'bedroom'), room('bedroom-2', 'bedroom')], 'bedroom', 1)).toBe(false);
  });

  it('offers the four common rooms with stable ids', () => {
    expect(COMMON_ROOMS.map((r) => r.roomId)).toEqual(['entrance-1', 'livingRoom-1', 'kitchen-1', 'prayerRoom-1']);
  });
});
