import directionsData from './directions.json';
import {
  Alignment, Direction, PropertyProfile, RoomAnalysis, RoomDirections, RoomType, VastuDirectionEntry,
} from '../types/vastu';

export const DATASET_VERSION: string = directionsData.datasetVersion;
export const RULE_ENGINE_VERSION: string = directionsData.ruleEngineVersion;

type CompatTable = Record<string, { favorable: Direction[]; cautioned: Direction[] }>;

const roomCompatibility = directionsData.roomCompatibility as CompatTable;
const workRoomCompatibility = directionsData.workRoomCompatibility as CompatTable;
const ROOM_LABELS = directionsData.homeRoomLabels as Record<RoomType, string>;
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

function alignmentFor(room: RoomType, direction: Direction): Alignment {
  const compat = roomCompatibility[room];
  if (!compat) return 'neutral';
  if (compat.favorable.includes(direction)) return 'favorable';
  if (compat.cautioned.includes(direction)) return 'traditionally-cautioned';
  return 'neutral';
}

/**
 * Deterministic room-by-room analysis. Every statement traces back to the
 * configured directions.json table - this never infers room dimensions, walls,
 * or layout from a direction alone, and never claims a direction causes harm.
 */
export function analyzeRoom(room: RoomType, direction: Direction): RoomAnalysis {
  const entry = getDirectionEntry(direction);
  const alignment = alignmentFor(room, direction);

  let explanation: string;
  if (alignment === 'favorable') {
    explanation = `${entry.label}${entry.sanskritName ? ` (${entry.sanskritName})` : ''} is traditionally considered a favorable placement for the ${ROOM_LABELS[room].toLowerCase()}, per the convention used here.`;
  } else if (alignment === 'traditionally-cautioned') {
    explanation = `Some traditional schools suggest reconsidering a ${ROOM_LABELS[room].toLowerCase()} in ${entry.label}${entry.sanskritName ? ` (${entry.sanskritName})` : ''}, though this varies by tradition and is not a structural or safety concern.`;
  } else {
    explanation = `${entry.label}${entry.sanskritName ? ` (${entry.sanskritName})` : ''} doesn't have a strong traditional association either way for a ${ROOM_LABELS[room].toLowerCase()} in the convention used here.`;
  }

  return {
    room,
    roomLabel: ROOM_LABELS[room],
    direction,
    alignment,
    guidance: entry.traditionalAssociation,
    explanation,
    practicalSuggestions: entry.recommendations,
  };
}

export function analyzeProperty(profile: PropertyProfile): { analyses: RoomAnalysis[]; missingRooms: RoomType[] } {
  const roomTypes = Object.keys(ROOM_LABELS) as RoomType[];
  const analyses: RoomAnalysis[] = [];
  const missingRooms: RoomType[] = [];

  for (const room of roomTypes) {
    const direction = profile.rooms[room as keyof RoomDirections];
    if (direction) {
      analyses.push(analyzeRoom(room, direction));
    } else {
      missingRooms.push(room);
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
      id: `tradition-${a.room}`,
      text: `Optional: explore traditional remedies for your ${a.roomLabel.toLowerCase()}'s placement, if this matters to you culturally.`,
      category: 'cultural-practice',
    });
  }

  return items;
}
