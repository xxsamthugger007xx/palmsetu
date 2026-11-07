import { describe, expect, it } from 'vitest';
import { recommendPrimaryGemstone, recommendAlternativeGemstone, buildCaratGuidance, RULE_ENGINE_VERSION } from './recommendationEngine';
import { NatalSummary, TropicalSign } from '../astrology/engine';

function fakeNatal(moonSignSidereal: TropicalSign, birthTimeKnown = true): NatalSummary {
  return {
    birthDateUtc: '2000-01-01T12:00:00.000Z',
    birthTimeKnown,
    sunSignTropical: 'Capricorn',
    moonSignTropical: moonSignSidereal,
    moonSignSidereal,
    moonNakshatra: 'Ashwini',
    moonNakshatraPada: 1,
    risingSignAvailable: false,
    engineVersion: 'test',
    confidenceNote: '',
  };
}

describe('recommendPrimaryGemstone', () => {
  it('recommends Ruby for a Leo moon sign (ruled by Sun)', () => {
    const rec = recommendPrimaryGemstone(fakeNatal('Leo'));
    expect(rec.strength).toBe('primary');
    expect(rec.gemstone?.nameEnglish).toBe('Ruby');
    expect(rec.gemstone?.planet).toBe('Sun');
    expect(rec.ruleId).toBe('rashi-lord-v1');
  });

  it('recommends Natural Pearl for a Cancer moon sign (ruled by Moon)', () => {
    const rec = recommendPrimaryGemstone(fakeNatal('Cancer'));
    expect(rec.gemstone?.nameEnglish).toBe('Natural Pearl');
    expect(rec.gemstone?.planet).toBe('Moon');
  });

  it('recommends Blue Sapphire for both Capricorn and Aquarius (both ruled by Saturn)', () => {
    expect(recommendPrimaryGemstone(fakeNatal('Capricorn')).gemstone?.nameEnglish).toBe('Blue Sapphire');
    expect(recommendPrimaryGemstone(fakeNatal('Aquarius')).gemstone?.nameEnglish).toBe('Blue Sapphire');
  });

  it('covers all 12 signs with a valid rashi-lord mapping (no silent gaps)', () => {
    const signs: TropicalSign[] = [
      'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
    ];
    for (const sign of signs) {
      const rec = recommendPrimaryGemstone(fakeNatal(sign));
      expect(rec.strength).toBe('primary');
      expect(rec.gemstone).not.toBeNull();
    }
  });

  it('still produces a recommendation when birth time is unknown (Moon sign date-only is usable)', () => {
    const rec = recommendPrimaryGemstone(fakeNatal('Leo', false));
    expect(rec.strength).toBe('primary');
  });
});

describe('recommendAlternativeGemstone', () => {
  it('returns a clearly non-equivalent alternative for Sun (Red Spinel)', () => {
    const primary = recommendPrimaryGemstone(fakeNatal('Leo'));
    const alt = recommendAlternativeGemstone(primary);
    expect(alt.strength).toBe('alternative');
    expect(alt.gemstone?.nameEnglish).toBe('Red Spinel');
    expect(alt.gemstone?.alternativeIsEquivalent).toBe(false);
  });

  it('returns "none" with a reason for Mars, which has no configured automatic alternative', () => {
    const primary = recommendPrimaryGemstone(fakeNatal('Aries')); // Aries -> Mars -> Red Coral
    expect(primary.gemstone?.planet).toBe('Mars');
    const alt = recommendAlternativeGemstone(primary);
    expect(alt.strength).toBe('none');
    expect(alt.reasonUnavailable).toBeTruthy();
    expect(alt.gemstone).toBeNull();
  });

  it('returns "none" when there was no primary recommendation to begin with', () => {
    const noPrimary = { strength: 'none' as const, gemstone: null, ruleId: 'x', ruleExplanation: '' };
    const alt = recommendAlternativeGemstone(noPrimary);
    expect(alt.strength).toBe('none');
    expect(alt.reasonUnavailable).toBeTruthy();
  });
});

describe('buildCaratGuidance', () => {
  it('always returns a documented, non-fabricated range with method and disclaimer', () => {
    const guidance = buildCaratGuidance();
    expect(guidance.available).toBe(true);
    expect(guidance.suggestedRangeCarats).toEqual([3, 6]);
    expect(guidance.method).toBeTruthy();
    expect(guidance.disclaimer.toLowerCase()).toContain('traditional');
  });
});

describe('RULE_ENGINE_VERSION', () => {
  it('is exposed for report provenance tracking', () => {
    expect(RULE_ENGINE_VERSION).toBe('gemstone-rules-1.0');
  });
});
