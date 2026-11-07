import { AiProvider } from '../ai/types';
import { ASTROLOGY_SYSTEM_PROMPT } from '../ai/astrologySystemPrompt';
import { AstrologySystem, BirthProfile, DailyHoroscope } from '../types/astrology';
import { computeTransitContext, ENGINE_VERSION, TransitContext } from './engine';
import { SIGN_THEMES, NAKSHATRA_TRAITS } from './signContent';

const CONTENT_VERSION = 'solune-astrology-1.0';
const STATIC_MODEL_VERSION = 'static-fallback-v1';

function subjectSignAndTrait(profile: BirthProfile, transit: TransitContext, system: AstrologySystem) {
  if (system === 'vedic') {
    const sign = profile.natal.moonSignSidereal;
    const trait = NAKSHATRA_TRAITS[profile.natal.moonNakshatra] ?? SIGN_THEMES[sign].trait;
    return { sign, theme: SIGN_THEMES[sign], traitLabel: trait, headline: `${profile.natal.moonNakshatra} Moon` };
  }
  const sign = profile.natal.sunSignTropical;
  return { sign, theme: SIGN_THEMES[sign], traitLabel: SIGN_THEMES[sign].trait, headline: `${sign} Sun` };
}

function retrogradeNote(transit: TransitContext): string | null {
  const retro = transit.planets.filter((p) => p.retrograde);
  if (retro.length === 0) return null;
  return `${retro.map((p) => p.body).join(' and ')} ${retro.length > 1 ? 'are' : 'is'} retrograde today - a traditional cue to double-check details and avoid rushing communication.`;
}

/** Deterministic, calculation-grounded static content. Never fails, never invents
 * a transit - every fact here traces back to the TransitContext/NatalSummary. */
function buildStaticHoroscope(
  profile: BirthProfile,
  transit: TransitContext,
  system: AstrologySystem
): Omit<DailyHoroscope, 'id' | 'userId' | 'localDate' | 'timezone' | 'createdAt' | 'updatedAt' | 'generationStatus'> {
  const { sign, theme, traitLabel, headline } = subjectSignAndTrait(profile, transit, system);
  const retro = retrogradeNote(transit);
  const moonLine =
    system === 'vedic'
      ? `The Moon is in ${transit.moonNakshatra} nakshatra today (${transit.moonPhase}).`
      : `The Moon is in ${transit.moonSignTropical} today (${transit.moonPhase}).`;

  return {
    astrologySystem: system,
    calculationReference: `${ENGINE_VERSION} / transit ${transit.date}`,
    transitContext: transit,
    summary: `With your ${headline}, today leans into ${traitLabel}. ${moonLine}`,
    dailyTheme: theme.trait.charAt(0).toUpperCase() + theme.trait.slice(1),
    focus: { priority: theme.careerFocus, action: `Spend focused time on ${theme.careerFocus.toLowerCase()}.` },
    careerGuidance: `At work, this is a day that favors ${theme.careerFocus}. ${retro ? retro : 'Keep plans realistic rather than ambitious.'}`,
    relationshipGuidance: `In relationships, consider ${theme.loveFocus}. Reflection, not certainty - people and moods vary day to day.`,
    selfCarePrompt: `Notice when you're leaning into ${traitLabel} versus forcing it - what would gentler version of today look like?`,
    doSuggestions: [
      `Make time for ${theme.careerFocus.toLowerCase()}.`,
      `Try ${theme.loveFocus.toLowerCase()} with someone today.`,
      'Take one small break that’s actually restful, not just a scroll.',
    ],
    mindfulOfSuggestions: [
      `Watch for ${theme.caution.toLowerCase()}.`,
      retro ?? 'Notice if you’re reacting faster than the situation calls for.',
    ],
    dailyChallenge: `Today, practice ${theme.loveFocus.toLowerCase()} with one specific person.`,
    reflectionQuestion: `Where today did ${traitLabel} show up, and did you lean into it or away from it?`,
    astrologicalExplanation:
      system === 'vedic'
        ? `Vedic (sidereal, Lahiri ayanamsa approx.) - Moon in ${transit.moonNakshatra} nakshatra, pada ${transit.moonNakshatraPada}, sidereal sign ${transit.moonSignTropical ? sign : sign}. Natal Moon: ${profile.natal.moonNakshatra}.`
        : `Western (tropical) - Sun in ${transit.sunSign}, Moon in ${transit.moonSignTropical} (${transit.moonPhase}). Natal Sun: ${profile.natal.sunSignTropical}.${retro ? ' ' + retro : ''}`,
    dataCompleteness: profile.natal.birthTimeKnown ? 'full' : 'partial',
    contentVersion: CONTENT_VERSION,
  };
}

function buildAiPrompt(profile: BirthProfile, transit: TransitContext, system: AstrologySystem): string {
  return (
    `Astrology system: ${system}.\n` +
    `Natal: Sun ${profile.natal.sunSignTropical} (tropical), Moon ${profile.natal.moonSignTropical} (tropical) / ` +
    `${profile.natal.moonSignSidereal} (sidereal), nakshatra ${profile.natal.moonNakshatra} pada ${profile.natal.moonNakshatraPada}. ` +
    `Birth time known: ${profile.natal.birthTimeKnown}.\n` +
    `Today's transits: Sun ${transit.sunSign}, Moon ${transit.moonSignTropical} nakshatra ${transit.moonNakshatra} (${transit.moonPhase}). ` +
    `Planets: ${transit.planets.map((p) => `${p.body} in ${p.sign}${p.retrograde ? ' (retrograde)' : ''}`).join(', ')}.\n\n` +
    `Write a JSON object with exactly these string/array fields: summary, dailyTheme, focusPriority, focusAction, ` +
    `careerGuidance, relationshipGuidance, selfCarePrompt, doSuggestions (array of 3), mindfulOfSuggestions (array of 2), ` +
    `dailyChallenge, reflectionQuestion, astrologicalExplanation. Respond with ONLY the JSON object, no prose outside it.`
  );
}

function tryParseAiJson(text: string): Record<string, any> | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const requiredStrings = ['summary', 'dailyTheme', 'focusPriority', 'focusAction', 'careerGuidance', 'relationshipGuidance', 'selfCarePrompt', 'dailyChallenge', 'reflectionQuestion', 'astrologicalExplanation'];
    for (const key of requiredStrings) {
      if (typeof parsed[key] !== 'string' || parsed[key].trim().length < 3 || parsed[key].includes('<')) return null;
    }
    if (!Array.isArray(parsed.doSuggestions) || parsed.doSuggestions.length === 0) return null;
    if (!Array.isArray(parsed.mindfulOfSuggestions) || parsed.mindfulOfSuggestions.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function generateDailyHoroscope(
  profile: BirthProfile,
  localDate: string,
  system: AstrologySystem,
  aiProvider: AiProvider
): Promise<Omit<DailyHoroscope, 'id' | 'userId' | 'localDate' | 'timezone' | 'createdAt' | 'updatedAt' | 'generationStatus'>> {
  const transit = computeTransitContext(localDate);
  const staticContent = buildStaticHoroscope(profile, transit, system);

  try {
    const raw = await aiProvider.complete([
      { role: 'system', content: ASTROLOGY_SYSTEM_PROMPT },
      { role: 'user', content: buildAiPrompt(profile, transit, system) },
    ]);
    const parsed = tryParseAiJson(raw);
    if (parsed) {
      return {
        ...staticContent,
        summary: parsed.summary,
        dailyTheme: parsed.dailyTheme,
        focus: { priority: parsed.focusPriority, action: parsed.focusAction },
        careerGuidance: parsed.careerGuidance,
        relationshipGuidance: parsed.relationshipGuidance,
        selfCarePrompt: parsed.selfCarePrompt,
        doSuggestions: parsed.doSuggestions,
        mindfulOfSuggestions: parsed.mindfulOfSuggestions,
        dailyChallenge: parsed.dailyChallenge,
        reflectionQuestion: parsed.reflectionQuestion,
        astrologicalExplanation: parsed.astrologicalExplanation,
      };
    }
  } catch (err) {
    console.warn('[astrology] AI generation failed, using static content:', err);
  }

  return staticContent; // modelVersion tracked at the call site via generationStatus/calculationReference
}

export { STATIC_MODEL_VERSION };
