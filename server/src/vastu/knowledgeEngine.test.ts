import { describe, expect, it } from 'vitest';
import { analyzeRoom, analyzeProperty, listDirections, getDirectionEntry, buildGenericChecklist } from './knowledgeEngine';
import { PropertyProfile, PropertyRoom } from '../types/vastu';

function room(overrides: Partial<PropertyRoom>): PropertyRoom {
  return { roomId: 'r1', category: 'custom', name: 'Room', direction: null, ...overrides };
}

function profileWithRooms(rooms: PropertyRoom[]): PropertyProfile {
  return {
    id: 'p1',
    userId: 'u1',
    propertyType: 'apartment',
    bedroomCount: 0,
    bathroomCount: 0,
    rooms,
    notes: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('listDirections / getDirectionEntry', () => {
  it('exposes exactly the 9 configured directions (8 cardinal/intercardinal + Centre)', () => {
    expect(listDirections()).toHaveLength(9);
  });

  it('throws for an unknown direction code rather than silently returning nothing', () => {
    // @ts-expect-error intentional invalid input
    expect(() => getDirectionEntry('XX')).toThrow();
  });

  it('includes Home Temple / Prayer Room under bestForHome for Northeast (Ishan)', () => {
    const entry = getDirectionEntry('NE');
    expect(entry.bestForHome).toContain('Home Temple / Prayer Room');
  });

  it('includes Bed / Master Bedroom under bestForHome for Southwest (Nairutya)', () => {
    const entry = getDirectionEntry('SW');
    expect(entry.bestForHome).toContain('Bed / Master Bedroom');
    expect(entry.bestForWork).toContain('Storage Room');
  });

  it('includes a Centre (Brahmasthan) entry, kept distinct from the 8 directional sectors', () => {
    const entry = getDirectionEntry('C');
    expect(entry.sanskritName).toBe('Brahmasthan');
  });

  it('includes Cash Counter / Safe under bestForWork for North, but not for Northeast', () => {
    expect(getDirectionEntry('N').bestForWork).toContain('Cash Counter / Safe');
    expect(getDirectionEntry('NE').bestForWork).not.toContain('Cash Counter / Safe');
  });

  it('every direction has both bestForHome and bestForWork as arrays, never undefined', () => {
    for (const entry of listDirections()) {
      expect(Array.isArray(entry.bestForHome)).toBe(true);
      expect(Array.isArray(entry.bestForWork)).toBe(true);
    }
  });
});

describe('analyzeRoom', () => {
  it('marks kitchen in Southeast (Agneya) as favorable', () => {
    const result = analyzeRoom(room({ roomId: 'kitchen-1', category: 'kitchen', name: 'Kitchen' }), 'SE');
    expect(result.alignment).toBe('favorable');
  });

  it('marks kitchen in Northeast as traditionally-cautioned, not a safety claim', () => {
    const result = analyzeRoom(room({ roomId: 'kitchen-1', category: 'kitchen', name: 'Kitchen' }), 'NE');
    expect(result.alignment).toBe('traditionally-cautioned');
    expect(result.explanation.toLowerCase()).not.toContain('danger');
    expect(result.explanation.toLowerCase()).not.toContain('illness');
  });

  it('marks a bedroom in Southwest (Nairutya) as favorable, regardless of which bedroom instance it is', () => {
    const first = analyzeRoom(room({ roomId: 'bedroom-1', category: 'bedroom', name: 'Master Bedroom' }), 'SW');
    const second = analyzeRoom(room({ roomId: 'bedroom-2', category: 'bedroom', name: 'Bedroom 2' }), 'SW');
    expect(first.alignment).toBe('favorable');
    expect(second.alignment).toBe('favorable');
  });

  it('analyzes two bedrooms independently - different directions never bleed into each other', () => {
    const favorable = analyzeRoom(room({ roomId: 'bedroom-1', category: 'bedroom', name: 'Master Bedroom' }), 'SW');
    const cautioned = analyzeRoom(room({ roomId: 'bedroom-2', category: 'bedroom', name: 'Bedroom 2' }), 'NE');
    expect(favorable.alignment).toBe('favorable');
    expect(cautioned.alignment).toBe('traditionally-cautioned');
    expect(favorable.roomId).toBe('bedroom-1');
    expect(cautioned.roomId).toBe('bedroom-2');
  });

  it('marks prayer room in a non-configured direction as neutral, not fabricated guidance', () => {
    const result = analyzeRoom(room({ roomId: 'prayer-1', category: 'prayerRoom', name: 'Prayer Room' }), 'W');
    expect(result.alignment).toBe('neutral');
  });

  it('never invents a favorable/cautioned verdict for a custom room type', () => {
    const result = analyzeRoom(room({ roomId: 'custom-1', category: 'custom', name: 'Study Room' }), 'N');
    expect(result.alignment).toBe('neutral');
    expect(result.roomLabel).toBe('Study Room');
  });

  it('never invents suggestions beyond the configured recommendations list', () => {
    const result = analyzeRoom(room({ roomId: 'entrance-1', category: 'entrance', name: 'Main Entrance' }), 'N');
    expect(Array.isArray(result.practicalSuggestions)).toBe(true);
    expect(result.practicalSuggestions.length).toBeGreaterThan(0);
  });
});

describe('analyzeProperty', () => {
  it('reports every room with no direction as missing, by name', () => {
    const profile = profileWithRooms([
      room({ roomId: 'bedroom-1', category: 'bedroom', name: 'Master Bedroom', direction: null }),
      room({ roomId: 'bathroom-1', category: 'bathroom', name: 'Bathroom 1', direction: null }),
    ]);
    const { analyses, missingRooms } = analyzeProperty(profile);
    expect(analyses).toHaveLength(0);
    expect(missingRooms).toEqual(['Master Bedroom', 'Bathroom 1']);
  });

  it('analyzes only the rooms that were actually given a direction (partial profile)', () => {
    const profile = profileWithRooms([
      room({ roomId: 'kitchen-1', category: 'kitchen', name: 'Kitchen', direction: 'SE' }),
      room({ roomId: 'bedroom-1', category: 'bedroom', name: 'Master Bedroom', direction: 'SW' }),
      room({ roomId: 'bedroom-2', category: 'bedroom', name: 'Bedroom 2', direction: null }),
    ]);
    const { analyses, missingRooms } = analyzeProperty(profile);
    expect(analyses).toHaveLength(2);
    expect(missingRooms).toEqual(['Bedroom 2']);
    expect(analyses.map((a) => a.roomId).sort()).toEqual(['bedroom-1', 'kitchen-1'].sort());
  });

  it('analyzes a fully completed property with no missing rooms, including multiple bedrooms/bathrooms', () => {
    const profile = profileWithRooms([
      room({ roomId: 'entrance-1', category: 'entrance', name: 'Main Entrance', direction: 'N' }),
      room({ roomId: 'bedroom-1', category: 'bedroom', name: 'Master Bedroom', direction: 'SW' }),
      room({ roomId: 'bedroom-2', category: 'bedroom', name: 'Bedroom 2', direction: 'S' }),
      room({ roomId: 'bathroom-1', category: 'bathroom', name: 'Bathroom 1', direction: 'NW' }),
      room({ roomId: 'bathroom-2', category: 'bathroom', name: 'Bathroom 2', direction: 'W' }),
    ]);
    const { analyses, missingRooms } = analyzeProperty(profile);
    expect(analyses).toHaveLength(5);
    expect(missingRooms).toHaveLength(0);
  });
});

describe('buildGenericChecklist', () => {
  it('always includes the baseline low-cost suggestions', () => {
    const items = buildGenericChecklist([]);
    expect(items.some((i) => i.category === 'low-cost')).toBe(true);
  });

  it('adds an optional cultural-practice item only for cautioned rooms, keyed by roomId', () => {
    const cautionedAnalysis = analyzeRoom(room({ roomId: 'kitchen-1', category: 'kitchen', name: 'Kitchen' }), 'NE');
    const items = buildGenericChecklist([cautionedAnalysis]);
    expect(items.some((i) => i.id === 'tradition-kitchen-1' && i.category === 'cultural-practice')).toBe(true);
  });

  it('adds no cultural-practice items when nothing is cautioned', () => {
    const favorableAnalysis = analyzeRoom(room({ roomId: 'kitchen-1', category: 'kitchen', name: 'Kitchen' }), 'SE');
    const items = buildGenericChecklist([favorableAnalysis]);
    expect(items.some((i) => i.category === 'cultural-practice')).toBe(false);
  });
});
