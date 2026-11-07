import { AiProvider } from '../ai/types';
import { SOUL_ENERGY_SYSTEM_PROMPT } from '../ai/soulEnergySystemPrompt';
import { BirthProfile } from '../types/astrology';
import { SoulEnergyReading } from '../types/soulEnergy';
import { ENGINE_VERSION } from './engine';

const CONTENT_VERSION = 'solune-soul-energy-1.0';

function buildPrompt(profile: BirthProfile, ascendantSign: string | null): string {
  return (
    `Sun sign (tropical): ${profile.natal.sunSignTropical}.\n` +
    `Moon sign (sidereal): ${profile.natal.moonSignSidereal}, nakshatra ${profile.natal.moonNakshatra} pada ${profile.natal.moonNakshatraPada}.\n` +
    `Ascendant/Lagna: ${ascendantSign ?? 'unavailable (birth time and/or location not provided - do not fabricate one)'}.\n\n` +
    `Respond with ONLY a JSON object with exactly these fields: corePersonality (string), mindAndEmotions (string), ` +
    `careerStyle (string), loveAndRelationships (string), strengths (array of 3-5 short strings), ` +
    `challenges (array of 3-5 short strings), balanceTip (string).`
  );
}

function tryParseAiJson(text: string): Partial<SoulEnergyReading> | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const requiredStrings = ['corePersonality', 'mindAndEmotions', 'careerStyle', 'loveAndRelationships', 'balanceTip'];
    for (const key of requiredStrings) {
      if (typeof parsed[key] !== 'string' || parsed[key].trim().length < 3) return null;
    }
    if (!Array.isArray(parsed.strengths) || parsed.strengths.length === 0) return null;
    if (!Array.isArray(parsed.challenges) || parsed.challenges.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Generates the 7-section Soul Energy Reading via a real AI call, grounded in
 * the user's real natal facts (sun/moon sign, ascendant if available). There
 * is no static/deterministic fallback content for this feature (unlike the
 * daily horoscope) - if the AI call fails or returns an unparsable response,
 * this throws, and the route surfaces a genuine error rather than ever
 * showing fabricated-looking "computed" personality text.
 */
export async function generateSoulEnergyReading(
  profile: BirthProfile,
  ascendantSign: string | null,
  aiProvider: AiProvider
): Promise<Omit<SoulEnergyReading, 'id' | 'userId' | 'localDate' | 'createdAt'>> {
  const raw = await aiProvider.complete([
    { role: 'system', content: SOUL_ENERGY_SYSTEM_PROMPT },
    { role: 'user', content: buildPrompt(profile, ascendantSign) },
  ]);
  const parsed = tryParseAiJson(raw);
  if (!parsed) {
    throw new Error('Soul Energy Reading generation returned an unparsable response.');
  }
  return {
    calculationReference: `${ENGINE_VERSION} / sun+moon${ascendantSign ? '+ascendant' : ''}`,
    corePersonality: parsed.corePersonality!,
    mindAndEmotions: parsed.mindAndEmotions!,
    careerStyle: parsed.careerStyle!,
    loveAndRelationships: parsed.loveAndRelationships!,
    strengths: parsed.strengths as string[],
    challenges: parsed.challenges as string[],
    balanceTip: parsed.balanceTip!,
    dataCompleteness: ascendantSign ? 'full' : 'partial',
    contentVersion: CONTENT_VERSION,
  };
}
