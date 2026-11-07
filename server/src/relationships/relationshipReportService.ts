import { AiProvider } from '../ai/types';
import { RELATIONSHIP_ASTROLOGY_SYSTEM_PROMPT } from '../ai/astrologySystemPrompt';
import { BirthProfile, RelationshipDailyReport, SharedAstrologyMode } from '../types/astrology';
import { computeTransitContext } from '../astrology/engine';
import { SIGN_THEMES } from '../astrology/signContent';

const CONTENT_VERSION = 'solune-relationship-astrology-1.0';

function resolveSharedMode(a: BirthProfile, b: BirthProfile): SharedAstrologyMode {
  if (a.preferredSystem === b.preferredSystem) return a.preferredSystem;
  return 'cross-system'; // never silently force one partner's system onto the other
}

/** Deterministic, calculation-grounded shared report. Combines both charts'
 * elemental themes into a genuinely joint reflection rather than concatenating
 * two personal horoscopes. */
function buildStaticSharedReport(
  profileA: BirthProfile,
  profileB: BirthProfile,
  localDate: string,
  mode: SharedAstrologyMode
): Omit<RelationshipDailyReport, 'id' | 'relationshipId' | 'localDate' | 'createdAt' | 'generationStatus'> {
  const transit = computeTransitContext(localDate);

  // Each partner's sign is read in THEIR OWN preferred system - cross-system mode
  // means "don't force one system onto both," not "fall back to a third default."
  const signA = profileA.preferredSystem === 'vedic' ? profileA.natal.moonSignSidereal : profileA.natal.sunSignTropical;
  const signB = profileB.preferredSystem === 'vedic' ? profileB.natal.moonSignSidereal : profileB.natal.sunSignTropical;
  const themeA = SIGN_THEMES[signA];
  const themeB = SIGN_THEMES[signB];

  const connectionTheme =
    themeA.loveFocus === themeB.loveFocus
      ? `Shared focus: ${themeA.loveFocus}`
      : `Blending ${themeA.loveFocus} with ${themeB.loveFocus}`;

  return {
    sharedAstrologyMode: mode,
    summary: `Today's sky (${transit.moonPhase}, Sun in ${transit.sunSign}) favors a day of noticing each other's pace - one of you may lean into ${themeA.trait}, the other into ${themeB.trait}.`,
    connectionTheme,
    helpfulActions: [
      `Make space for ${themeA.loveFocus.toLowerCase()} from one side and ${themeB.loveFocus.toLowerCase()} from the other.`,
      'Check in with a simple, low-pressure question rather than assuming how the other feels.',
    ],
    potentialFrictionAreas: [
      `One of you may lean toward ${themeA.caution.toLowerCase()}, the other toward ${themeB.caution.toLowerCase()} - worth noticing, not assuming.`,
    ],
    communicationPrompt: 'Try asking one clarifying question before offering a solution, especially if a topic feels sensitive.',
    sharedActivity: 'Spend ten minutes together without phones - a walk or a shared meal both work.',
    sharedQuestion: 'What would make today feel a little easier for you?',
    individualSupportA: `For you: today leans into ${themeA.trait} - ${themeA.careerFocus} may come more naturally than usual.`,
    individualSupportB: `For your partner: today leans into ${themeB.trait} - ${themeB.careerFocus} may come more naturally than usual.`,
    astrologicalExplanation:
      mode === 'cross-system'
        ? `Partner A uses ${profileA.preferredSystem} (${signA}), Partner B uses ${profileB.preferredSystem} (${signB}) - shown as a cross-system reflection rather than a single blended method.`
        : `Both partners' ${mode} charts: ${signA} and ${signB}, read against today's transits (Sun ${transit.sunSign}, Moon ${transit.moonSignTropical}/${transit.moonNakshatra}).`,
    contentVersion: CONTENT_VERSION,
  };
}

function buildAiPrompt(profileA: BirthProfile, profileB: BirthProfile, mode: SharedAstrologyMode, localDate: string): string {
  const transit = computeTransitContext(localDate);
  return (
    `Shared astrology mode: ${mode}.\n` +
    `Partner A (${profileA.preferredSystem}): Sun ${profileA.natal.sunSignTropical}, sidereal Moon ${profileA.natal.moonSignSidereal}, nakshatra ${profileA.natal.moonNakshatra}.\n` +
    `Partner B (${profileB.preferredSystem}): Sun ${profileB.natal.sunSignTropical}, sidereal Moon ${profileB.natal.moonSignSidereal}, nakshatra ${profileB.natal.moonNakshatra}.\n` +
    `Today's transits: Sun ${transit.sunSign}, Moon ${transit.moonSignTropical}/${transit.moonNakshatra} (${transit.moonPhase}).\n\n` +
    `Write a JSON object with exactly these fields: summary, connectionTheme, helpfulActions (array of 2-3), ` +
    `potentialFrictionAreas (array of 1-2, framed as gentle possibilities, never accusations), communicationPrompt, ` +
    `sharedActivity, sharedQuestion, individualSupportA, individualSupportB, astrologicalExplanation. ` +
    `Respond with ONLY the JSON object.`
  );
}

function tryParseAiJson(text: string): Record<string, any> | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const required = ['summary', 'connectionTheme', 'communicationPrompt', 'sharedActivity', 'sharedQuestion', 'individualSupportA', 'individualSupportB', 'astrologicalExplanation'];
    for (const key of required) {
      if (typeof parsed[key] !== 'string' || parsed[key].trim().length < 3 || parsed[key].includes('<')) return null;
    }
    if (!Array.isArray(parsed.helpfulActions) || parsed.helpfulActions.length === 0) return null;
    if (!Array.isArray(parsed.potentialFrictionAreas) || parsed.potentialFrictionAreas.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function generateSharedReport(
  profileA: BirthProfile,
  profileB: BirthProfile,
  localDate: string,
  aiProvider: AiProvider
): Promise<Omit<RelationshipDailyReport, 'id' | 'relationshipId' | 'localDate' | 'createdAt' | 'generationStatus'>> {
  const mode = resolveSharedMode(profileA, profileB);
  const staticContent = buildStaticSharedReport(profileA, profileB, localDate, mode);

  try {
    const raw = await aiProvider.complete([
      { role: 'system', content: RELATIONSHIP_ASTROLOGY_SYSTEM_PROMPT },
      { role: 'user', content: buildAiPrompt(profileA, profileB, mode, localDate) },
    ]);
    const parsed = tryParseAiJson(raw);
    if (parsed) {
      return { ...staticContent, ...parsed, sharedAstrologyMode: mode, contentVersion: CONTENT_VERSION };
    }
  } catch (err) {
    console.warn('[relationship-astrology] AI generation failed, using static content:', err);
  }

  return staticContent;
}
