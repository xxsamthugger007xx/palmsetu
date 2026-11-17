import directionsData from './directions.json';
import {
  Alignment, Direction, PropertyProfile, PropertyRoom, RoomAnalysis, RoomCategory, VastuDirectionEntry,
} from '../types/vastu';

export const DATASET_VERSION: string = directionsData.datasetVersion;
export const RULE_ENGINE_VERSION: string = directionsData.ruleEngineVersion;

type CompatTable = Record<string, { favorable: Direction[]; cautioned: Direction[] }>;

const roomCompatibility = directionsData.roomCompatibility as CompatTable;
const workRoomCompatibility = directionsData.workRoomCompatibility as CompatTable;
const ROOM_LABELS = directionsData.homeRoomLabels as Record<string, string>;
const WORK_ROOM_LABELS = directionsData.workRoomLabels as Record<string, string>;

/** Reverse-looks-up which rooms/roles a direction is favorable for, by label,
 * from a compatibility table - this is how the "best for" lists are derived,
 * rather than being separately hand-maintained (and risking drifting out of
 * sync with the room-by-room analysis rules). */
function bestUsesFor(direction: Direction, compat: CompatTable, labels: Record<string, string>): string[] {
  return Object.entries(compat)
    .filter(([, rule]) => rule.favorable.includes(direction))
    .map(([key]) => labels[key])
    .filter(Boolean);
}

const directionsByCode = new Map<Direction, VastuDirectionEntry>(
  (directionsData.directions as Omit<VastuDirectionEntry, 'bestForHome' | 'bestForWork'>[]).map((d) => [
    d.code,
    {
      ...d,
      bestForHome: bestUsesFor(d.code, roomCompatibility, ROOM_LABELS),
      bestForWork: bestUsesFor(d.code, workRoomCompatibility, WORK_ROOM_LABELS),
    },
  ])
);

export function getDirectionEntry(code: Direction): VastuDirectionEntry {
  const entry = directionsByCode.get(code);
  if (!entry) throw new Error(`Unknown direction code: ${code}`);
  return entry;
}

export function listDirections(): VastuDirectionEntry[] {
  return [...directionsByCode.values()];
}

/** 'custom' rooms have no sourced favorable/cautioned table - there is no
 * honest traditional basis for one, since the user could name it anything.
 * Every other category looks up roomCompatibility directly by its key. */
function alignmentFor(category: RoomCategory, direction: Direction): Alignment {
  if (category === 'custom') return 'neutral';
  const compat = roomCompatibility[category];
  if (!compat) return 'neutral';
  if (compat.favorable.includes(direction)) return 'favorable';
  if (compat.cautioned.includes(direction)) return 'traditionally-cautioned';
  return 'neutral';
}

function categoryLabel(category: RoomCategory, roomName: string): string {
  if (category === 'custom') return roomName;
  return ROOM_LABELS[category] ?? roomName;
}

/**
 * Deterministic analysis for one room INSTANCE. Two bedrooms with different
 * directions always produce independent results - nothing here ever
 * aggregates or copies one room's direction onto another, since each call
 * only ever sees the single room passed in.
 */
export function analyzeRoom(room: Pick<PropertyRoom, 'roomId' | 'category' | 'name'>, direction: Direction): RoomAnalysis {
  const entry = getDirectionEntry(direction);
  const alignment = alignmentFor(room.category, direction);
  const label = categoryLabel(room.category, room.name);
  const genericNoun = room.category === 'custom' ? room.name.toLowerCase() : label.toLowerCase();

  let explanation: string;
  if (alignment === 'favorable') {
    explanation = `${entry.label}${entry.sanskritName ? ` (${entry.sanskritName})` : ''} is traditionally considered a favorable placement for a ${genericNoun}, per the convention used here.`;
  } else if (alignment === 'traditionally-cautioned') {
    explanation = `Some traditional schools suggest reconsidering a ${genericNoun} in ${entry.label}${entry.sanskritName ? ` (${entry.sanskritName})` : ''}, though this varies by tradition and is not a structural or safety concern.`;
  } else if (room.category === 'custom') {
    explanation = `There's no specific traditional guidance in this convention for a custom room like "${room.name}" - general placement principles for ${entry.label.toLowerCase()} still apply.`;
  } else {
    explanation = `${entry.label}${entry.sanskritName ? ` (${entry.sanskritName})` : ''} doesn't have a strong traditional association either way for a ${genericNoun} in the convention used here.`;
  }

  return {
    roomId: room.roomId,
    category: room.category,
    roomLabel: room.name || label,
    direction,
    alignment,
    guidance: entry.traditionalAssociation,
    explanation,
    practicalSuggestions: entry.recommendations,
  };
}

export function analyzeProperty(profile: PropertyProfile): { analyses: RoomAnalysis[]; missingRooms: string[] } {
  const analyses: RoomAnalysis[] = [];
  const missingRooms: string[] = [];

  for (const room of profile.rooms) {
    if (room.direction) {
      analyses.push(analyzeRoom(room, room.direction));
    } else {
      missingRooms.push(room.name);
    }
  }

  return { analyses, missingRooms };
}

export function buildGenericChecklist(analyses: RoomAnalysis[]) {
  const items: { id: string; text: string; category: 'low-cost' | 'cultural-practice' }[] = [
    { id: 'declutter', text: 'Declutter entryways and walkways to improve circulation.', category: 'low-cost' },
    { id: 'light', text: 'Improve natural light and ventilation where possible (open curtains, clean windows).', category: 'low-cost' },
    { id: 'workspace', text: 'Organize your workspace or study area for clarity and focus.', category: 'low-cost' },
  ];

  const cautioned = analyses.filter((a) => a.alignment === 'traditionally-cautioned');
  for (const a of cautioned) {
    items.push({
      id: `tradition-${a.roomId}`,
      text: `Optional: explore traditional remedies for your ${a.roomLabel.toLowerCase()}'s placement, if this matters to you culturally.`,
      category: 'cultural-practice',
    });
  }

  return items;
}
