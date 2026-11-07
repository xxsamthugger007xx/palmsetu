import rulesData from './rules.json';
import { NatalSummary, TropicalSign } from '../astrology/engine';
import {
  CaratGuidance, GemstoneDefinition, GemstonePlanet, GemstoneRecommendation,
} from '../types/gemstone';

export const RULE_ENGINE_VERSION: string = rulesData.ruleEngineVersion;

const gemstoneTable = rulesData.gemstones as Record<GemstonePlanet, Omit<GemstoneDefinition, 'planet' | 'alternativeIsEquivalent'>>;
const rashiLordTable = rulesData.rashiLord as Record<TropicalSign, GemstonePlanet>;

function buildGemstoneDefinition(planet: GemstonePlanet): GemstoneDefinition {
  const entry = gemstoneTable[planet];
  return { planet, alternativeIsEquivalent: false, ...entry };
}

/**
 * Deterministic, configurable recommendation engine. Every recommendation traces
 * back to a named rule in rules.json - this function never invents a gemstone
 * that isn't backed by a documented entry in that table.
 */
export function recommendPrimaryGemstone(natal: NatalSummary): GemstoneRecommendation {
  const rashi = natal.moonSignSidereal as TropicalSign;
  const rulingPlanet = rashiLordTable[rashi];

  if (!rulingPlanet) {
    return {
      strength: 'none',
      gemstone: null,
      ruleId: 'rashi-lord-v1',
      ruleExplanation: '',
      reasonUnavailable: `No configured rashi-lord rule exists for "${rashi}". This should not normally happen - please report it.`,
    };
  }

  const gemstone = buildGemstoneDefinition(rulingPlanet);

  return {
    strength: 'primary',
    gemstone,
    ruleId: 'rashi-lord-v1',
    ruleExplanation:
      `Your sidereal Moon sign (Janma Rashi) is ${rashi}, traditionally ruled by ${rulingPlanet}. ` +
      `Under the Rashi-lord strengthening convention, ${gemstone.nameEnglish} (${gemstone.nameHindi}) is the ` +
      `gemstone traditionally associated with ${rulingPlanet}.`,
  };
}

export function recommendAlternativeGemstone(primary: GemstoneRecommendation): GemstoneRecommendation {
  if (primary.strength !== 'primary' || !primary.gemstone) {
    return {
      strength: 'none',
      gemstone: null,
      ruleId: 'rashi-lord-alternative-v1',
      ruleExplanation: '',
      reasonUnavailable: 'No primary recommendation was available to derive an alternative from.',
    };
  }

  if (primary.gemstone.alternativeName === "Expert-reviewed alternative only") {
    return {
      strength: 'none',
      gemstone: null,
      ruleId: 'rashi-lord-alternative-v1',
      ruleExplanation: '',
      reasonUnavailable:
        `${primary.gemstone.planet} does not have a configured automatic alternative - traditional guidance ` +
        `recommends consulting an astrologer or gemologist before choosing a substitute stone.`,
    };
  }

  return {
    strength: 'alternative',
    gemstone: { ...primary.gemstone, nameEnglish: primary.gemstone.alternativeName },
    ruleId: 'rashi-lord-alternative-v1',
    ruleExplanation:
      `${primary.gemstone.alternativeName} is sometimes used as a more accessible alternative to ` +
      `${primary.gemstone.nameEnglish}. It is NOT considered astrologically identical in most traditions - ` +
      `treat it as a distinct, lower-confidence substitute rather than an equivalent.`,
  };
}

export function buildCaratGuidance(): CaratGuidance {
  const [min, max] = rulesData.carat.defaultRangeCarats as [number, number];
  return {
    available: true,
    suggestedRangeCarats: [min, max],
    method: rulesData.carat.method,
    disclaimer: rulesData.carat.disclaimer,
  };
}
