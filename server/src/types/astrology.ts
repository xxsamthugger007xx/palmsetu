import { NatalSummary, TransitContext } from '../astrology/engine';

export type AstrologySystem = 'vedic' | 'western';
export type GenerationStatus = 'pending' | 'ready' | 'failed';
export type Gender = 'woman' | 'man' | 'non-binary' | 'prefer-not-to-say';

/** Backend-persisted identity fields (name, gender) that used to live only
 * in the app's local-only UserProfileContext/AsyncStorage and were never
 * saved server-side. Stored separately from BirthProfile (see userIdentities
 * in data/store.ts) rather than merged into it, because a user picks
 * name/gender during onboarding, before any birth date/time/place is known -
 * BirthProfile.birthDate is required and must not be a fabricated
 * placeholder, so identity has to be settable independently of birth data. */
export interface UserIdentity {
  userId: string;
  name: string;
  gender: Gender | null;
  updatedAt: string;
}

export interface BirthProfile {
  userId: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string | null; // HH:MM:SS, null if unknown
  birthPlace: string | null; // city label, e.g. "Mumbai, India"
  birthLatitude: number | null; // real city-center coordinates from the client's city picker, null if not yet set
  birthLongitude: number | null;
  preferredSystem: AstrologySystem;
  timezone: string; // IANA tz, e.g. "Asia/Kolkata"
  natal: NatalSummary;
  updatedAt: string;
}

export interface DailyHoroscope {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  astrologySystem: AstrologySystem;
  calculationReference: string; // engine version + transit date used
  transitContext: TransitContext;
  summary: string;
  dailyTheme: string;
  focus: { priority: string; action: string };
  careerGuidance: string;
  relationshipGuidance: string;
  selfCarePrompt: string;
  doSuggestions: string[];
  mindfulOfSuggestions: string[];
  dailyChallenge: string;
  reflectionQuestion: string;
  astrologicalExplanation: string;
  dataCompleteness: 'full' | 'partial'; // partial = unknown birth time
  contentVersion: string;
  generationStatus: GenerationStatus;
  createdAt: string;
  updatedAt: string;
}

// --- Relationship system ---------------------------------------------------

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface PartnerInvitation {
  id: string;
  inviterUserId: string;
  codeHash: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  revokedAt: string | null;
  status: InvitationStatus;
  attemptCount: number;
  createdAt: string;
}

export type RelationshipStatus = 'active' | 'disconnected';

export interface Relationship {
  id: string;
  userAId: string;
  userBId: string;
  status: RelationshipStatus;
  createdAt: string;
  disconnectedAt: string | null;
  consentVersion: string;
}

export type ConsentType =
  | 'shareCompatibility'
  | 'receiveSharedReadings'
  | 'showChartDetails'
  | 'receiveNotifications'
  | 'shareJournal'
  | 'shareDailyReadings';

export interface RelationshipConsent {
  relationshipId: string;
  userId: string;
  consentType: ConsentType;
  enabled: boolean;
  consentVersion: string;
  updatedAt: string;
}

export const DEFAULT_CONSENT: Record<ConsentType, boolean> = {
  shareCompatibility: true,
  receiveSharedReadings: true,
  showChartDetails: false,
  receiveNotifications: true,
  shareJournal: false,
  shareDailyReadings: false,
};

export type SharedAstrologyMode = 'vedic' | 'western' | 'cross-system';

export interface RelationshipDailyReport {
  id: string;
  relationshipId: string;
  localDate: string;
  sharedAstrologyMode: SharedAstrologyMode;
  summary: string;
  connectionTheme: string;
  helpfulActions: string[];
  potentialFrictionAreas: string[];
  communicationPrompt: string;
  sharedActivity: string;
  sharedQuestion: string;
  individualSupportA: string;
  individualSupportB: string;
  astrologicalExplanation: string;
  contentVersion: string;
  generationStatus: GenerationStatus;
  createdAt: string;
}

export interface DailyDeliveryPreference {
  userId: string;
  dailyHoroscopeEnabled: boolean;
  relationshipMessageEnabled: boolean;
  preferredLocalTime: string; // HH:MM
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  previewMode: 'discreet' | 'detailed';
  updatedAt: string;
}
