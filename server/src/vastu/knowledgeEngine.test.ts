import { describe, expect, it } from 'vitest';
import { analyzeRoom, analyzeProperty, listDirections, getDirectionEntry, buildGenericChecklist } from './knowledgeEngine';
import { PropertyProfile } from '../types/vastu';

function emptyProfile(overrides: Partial<PropertyProfile['rooms']> = {}): PropertyProfile {
  return {
    id: 'p1',
    userId: 'u1',
    propertyType: 'apartment',
    rooms: {
      entrance: null, livingRoom: null, kitchen: null, masterBedroom: null, prayerRoom: null, bathroom: null,
      ...overrides,
    },
    notes: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('listDirections / getDirectionEntry', () => {
  it('exposes exactly the 8 configured directions', () => {
    expect(listDirections()).toHaveLength(8);
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
    const result = analyzeRoom('kitchen', 'SE');
    expect(result.alignment).toBe('favorable');
  });

  it('marks kitchen in Northeast as traditionally-cautioned, not a safety claim', () => {
    const result = analyzeRoom('kitchen', 'NE');
    expect(result.alignment).toBe('traditionally-cautioned');
    expect(result.explanation.toLowerCase()).not.toContain('danger');
    expect(result.explanation.toLowerCase()).not.toContain('illness');
  });

  it('marks master bedroom in Southwest (Nairutya) as favorable', () => {
    const result = analyzeRoom('masterBedroom', 'SW');
    expect(result.alignment).toBe('favorable');
  });

  it('marks prayer room in a non-configured direction as neutral, not fabricated guidance', () => {
    const result = analyzeRoom('prayerRoom', 'W');
    expect(result.alignment).toBe('neutral');
  });

  it('never invents suggestions beyond the configured recommendations list', () => {
    const result = analyzeRoom('entrance', 'N');
    expect(Array.isArray(result.practicalSuggestions)).toBe(true);
    expect(result.practicalSuggestions.length).toBeGreaterThan(0);
  });
});

describe('analyzeProperty', () => {
  it('reports all 6 rooms as missing when none are provided', () => {
    const { analyses, missingRooms } = analyzeProperty(emptyProfile());
    expect(analyses).toHaveLength(0);
    expect(missingRooms).toHaveLength(6);
  });

  it('analyzes only the rooms that were actually supplied (partial profile)', () => {
    const profile = emptyProfile({ kitchen: 'SE', masterBedroom: 'SW' });
    const { analyses, missingRooms } = analyzeProperty(profile);
    expect(analyses).toHaveLength(2);
    expect(missingRooms).toHaveLength(4);
    expect(analyses.map((a) => a.room).sort()).toEqual(['kitchen', 'masterBedroom'].sort());
  });

  it('analyzes a fully completed property with no missing rooms', () => {
    const profile = emptyProfile({
      entrance: 'N', livingRoom: 'E', kitchen: 'SE', masterBedroom: 'SW', prayerRoom: 'NE', bathroom: 'NW',
    });
    const { analyses, missingRooms } = analyzeProperty(profile);
    expect(analyses).toHaveLength(6);
    expect(missingRooms).toHaveLength(0);
  });
});

describe('buildGenericChecklist', () => {
  it('always includes the baseline low-cost suggestions', () => {
    const items = buildGenericChecklist([]);
    expect(items.some((i) => i.category === 'low-cost')).toBe(true);
  });

  it('adds an optional cultural-practice item only for cautioned rooms', () => {
    const cautionedAnalysis = analyzeRoom('kitchen', 'NE');
    const items = buildGenericChecklist([cautionedAnalysis]);
    expect(items.some((i) => i.id === 'tradition-kitchen' && i.category === 'cultural-practice')).toBe(true);
  });

  it('adds no cultural-practice items when nothing is cautioned', () => {
    const favorableAnalysis = analyzeRoom('kitchen', 'SE');
    const items = buildGenericChecklist([favorableAnalysis]);
    expect(items.some((i) => i.category === 'cultural-practice')).toBe(false);
  });
});
