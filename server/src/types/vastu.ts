export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'C';

export interface VastuDirectionEntry {
  code: Direction;
  label: string;
  sanskritName: string | null;
  traditionalAssociation: string;
  recommendations: string[];
  limitations: string;
  sourceReference: string;
  /** Home rooms (e.g. "Bed / Master Bedroom", "Home Temple / Prayer Room")
   * this direction is traditionally considered favorable for. */
  bestForHome: string[];
  /** Work/office roles (e.g. "Cash Counter / Safe", "Work Desk / Study")
   * this direction is traditionally considered favorable for. */
  bestForWork: string[];
}

export type PropertyType = 'apartment' | 'independent-house' | 'office' | 'shop' | 'other';

/**
 * Room CATEGORY (what compatibility rules apply) is now separate from a
 * specific room INSTANCE (PropertyRoom below) - a property can have several
 * instances of 'bedroom' or 'bathroom', each independently directed, which
 * a single fixed RoomType per property could never represent. 'custom' is
 * for anything the user names themselves (Study, Balcony, Garage, etc.) -
 * it intentionally has no favorable/cautioned table (see knowledgeEngine.ts),
 * since there is no honest traditional sourcing for an arbitrary room type.
 */
export type RoomCategory = 'entrance' | 'livingRoom' | 'kitchen' | 'bedroom' | 'prayerRoom' | 'bathroom' | 'custom';

export interface PropertyRoom {
  /** Stable, unique within the property - e.g. "bedroom-1", "bathroom-2",
   * "custom-<uuid>". Never reused/renumbered once a room is removed (see
   * routes/vastu.ts's property-update handling), so a report generated
   * before a room was removed still refers to a meaningful id. */
  roomId: string;
  category: RoomCategory;
  /** User-visible, user-editable name - defaults to e.g. "Bedroom 2" but
   * can be renamed to "Guest Bedroom" etc. For category 'custom' this is
   * also the only record of what kind of room it actually is. */
  name: string;
  /** null = not yet assigned / explicitly skipped - never auto-filled. */
  direction: Direction | null;
}

export interface PropertyProfile {
  id: string;
  userId: string;
  propertyType: PropertyType;
  /** Denormalized from rooms (kept in sync server-side) purely so the
   * mobile stepper UI has an immediate source of truth without counting
   * array entries - rooms is still what's actually analyzed. */
  bedroomCount: number;
  bathroomCount: number;
  rooms: PropertyRoom[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Alignment = 'favorable' | 'neutral' | 'traditionally-cautioned';

export interface RoomAnalysis {
  roomId: string;
  category: RoomCategory;
  roomLabel: string;
  direction: Direction;
  alignment: Alignment;
  guidance: string;
  explanation: string;
  practicalSuggestions: string[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  category: 'low-cost' | 'cultural-practice';
  completed: boolean;
}

export type GenerationStatus = 'ready' | 'failed';

export interface VastuReport {
  id: string;
  userId: string;
  propertyId: string;
  createdAt: string;
  updatedAt: string;
  datasetVersion: string;
  ruleEngineVersion: string;
  propertyType: PropertyType;
  confirmedRoomCount: number;
  /** Display names (e.g. "Bedroom 2") of rooms that exist on the property
   * but have no direction assigned yet - never raw ids/category codes, so
   * this is directly presentable. */
  missingRooms: string[];
  completeness: 'full' | 'partial';
  roomAnalyses: RoomAnalysis[];
  checklist: ChecklistItem[];
  explanation: string;
  explanationSource: 'ai' | 'static-fallback';
  generationStatus: GenerationStatus;
  saved: boolean;
}
