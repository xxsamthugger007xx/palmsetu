export type AstrologySystem = 'vedic' | 'western';
export type GenerationStatus = 'pending' | 'ready' | 'failed';
export type Gender = 'woman' | 'man' | 'non-binary' | 'prefer-not-to-say';
/** What someone wants guidance on (picked in onboarding, up to 3). */
export const FOCUS_AREAS = ['love', 'career', 'money', 'health', 'family', 'growth'] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

/** Backend-persisted identity (name, gender) - see UserIdentity in
 * server/src/types/astrology.ts for why this is kept separate from
 * BirthProfile instead of merged into it. */
export interface UserIdentity {
  userId: string;
  name: string;
  gender: Gender | null;
  focus?: FocusArea[];
  /** Which illustrated avatar to show, within the array for this gender -
   * see theme/avatars.ts. Assigned once server-side, never re-randomized. */
  avatarIndex?: number | null;
  /** An explicit user choice overriding avatarIndex - a stable key like
   * 'male1'/'female3' (see theme/avatars.ts's AVATAR_CHOICES), picked from
   * the full set regardless of the account's own gender. */
  avatarKey?: string | null;
  updatedAt: string;
}

export interface NatalSummary {
  birthDateUtc: string;
  birthTimeKnown: boolean;
  sunSignTropical: string;
  moonSignTropical: string;
  moonSignSidereal: string;
  moonNakshatra: string;
  moonNakshatraPada: number;
  risingSignAvailable: false;
  engineVersion: string;
  confidenceNote: string;
}

/** Mirrors server/src/types/astrology.ts OnboardingDraft - see there for why
 * this exists (honest, backend-persisted, incrementally-saved onboarding
 * state, never a parallel progress flag). */
export interface OnboardingDraft {
  userId: string;
  preferredSystem: AstrologySystem | null;
  birthDate: string | null;
  birthTime: string | null;
  birthTimeSkipped: boolean;
  birthPlace: string | null;
  birthLatitude: number | null;
  birthLongitude: number | null;
  timezone: string | null;
  updatedAt: string;
}

export interface BirthProfile {
  userId: string;
  birthDate: string;
  birthTime: string | null;
  birthPlace: string | null;
  birthLatitude: number | null;
  birthLongitude: number | null;
  preferredSystem: AstrologySystem;
  timezone: string;
  natal: NatalSummary;
  updatedAt: string;
}

export interface PlanetTransit {
  body: string;
  sign: string; // tropical (Western)
  signSidereal: string; // sidereal (Vedic, Lahiri)
  longitude: number;
  longitudeSidereal: number;
  retrograde: boolean;
}

export interface TransitContext {
  date: string;
  engineVersion: string;
  sunSign: string; // tropical
  sunSignSidereal: string;
  sunLongitude: number;
  moonSignTropical: string;
  moonTropicalLongitude: number;
  moonSignSidereal: string;
  moonSiderealLongitude: number;
  moonNakshatra: string;
  moonNakshatraPada: number;
  moonPhase: string;
  nextMoonPhase: string;
  daysUntilNextMoonPhase: number;
  planets: PlanetTransit[];
}

export interface DailyHoroscope {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  astrologySystem: AstrologySystem;
  calculationReference: string;
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
  dataCompleteness: 'full' | 'partial';
  contentVersion: string;
  generationStatus: GenerationStatus;
  createdAt: string;
  updatedAt: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
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
  preferredLocalTime: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  previewMode: 'discreet' | 'detailed';
  updatedAt: string;
}
