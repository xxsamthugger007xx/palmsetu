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
/** What a person wants guidance on, picked during onboarding (up to 3). Drives Home ordering and the assistant's context. */
export const FOCUS_AREAS = ['love', 'career', 'money', 'health', 'family', 'growth'] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

export interface UserIdentity {
  userId: string;
  name: string;
  gender: Gender | null;
  focus?: FocusArea[];
  /** Which illustrated avatar image to show for this user, within the set
   * for their gender (see app/src/theme/avatars.ts for the actual image
   * list). Assigned once, randomly, the first time gender becomes known -
   * never re-randomized afterward, so a user's avatar stays stable across
   * sessions/devices. Null until gender is set (no avatar set to pick
   * from), or for genders with no dedicated avatar set. */
  avatarIndex?: number | null;
  /** An explicit user choice overriding the automatic avatarIndex above -
   * a stable key like 'male1'..'male5'/'female1'..'female5' (see
   * app/src/theme/avatars.ts's AVATAR_CHOICES) identifying one specific
   * image out of the full set, regardless of the account's own gender.
   * Null/unset = no manual choice made, fall back to avatarIndex. */
  avatarKey?: string | null;
  updatedAt: string;
}

/**
 * Real, backend-persisted scratch record for step-by-step astrology
 * onboarding. Every field is optional because a user may have picked their
 * astrology system but not yet entered a birth date, etc. - this record IS
 * the honest "how far has onboarding gotten" state (derived by checking
 * which fields are present), not a parallel progress flag that could drift
 * from what's actually saved. Once birthDate + birthPlace/coords + system
 * are all present, the client sends the equivalent full payload to
 * PUT /astrology/profile, which creates the real BirthProfile (computing
 * natal placements for real, same as before this record existed) and this
 * draft becomes irrelevant history - it is never read by any astrology
 * calculation or AI grounding path, only by onboarding-resume logic. */
export interface OnboardingDraft {
  userId: string;
  preferredSystem: AstrologySystem | null;
  birthDate: string | null;
  birthTime: string | null; // null also used for the explicit "I don't know" skip
  birthTimeSkipped: boolean; // distinguishes "not yet answered" from "explicitly skipped"
  birthPlace: string | null;
  birthLatitude: number | null;
  birthLongitude: number | null;
  timezone: string | null;
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
