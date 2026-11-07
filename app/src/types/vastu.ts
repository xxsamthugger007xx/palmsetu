export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface VastuDirectionEntry {
  code: Direction;
  label: string;
  sanskritName: string | null;
  traditionalAssociation: string;
  recommendations: string[];
  limitations: string;
  sourceReference: string;
  bestForHome: string[];
  bestForWork: string[];
}

export type PropertyType = 'apartment' | 'independent-house' | 'office' | 'shop' | 'other';
export type RoomType = 'entrance' | 'livingRoom' | 'kitchen' | 'masterBedroom' | 'prayerRoom' | 'bathroom';

export interface RoomDirections {
  entrance: Direction | null;
  livingRoom: Direction | null;
  kitchen: Direction | null;
  masterBedroom: Direction | null;
  prayerRoom: Direction | null;
  bathroom: Direction | null;
}

export interface PropertyProfile {
  id: string;
  userId: string;
  propertyType: PropertyType;
  rooms: RoomDirections;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Alignment = 'favorable' | 'neutral' | 'traditionally-cautioned';

export interface RoomAnalysis {
  room: RoomType;
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
  missingRooms: RoomType[];
  completeness: 'full' | 'partial';
  roomAnalyses: RoomAnalysis[];
  checklist: ChecklistItem[];
  explanation: string;
  explanationSource: 'ai' | 'static-fallback';
  generationStatus: 'ready' | 'failed';
  saved: boolean;
}
