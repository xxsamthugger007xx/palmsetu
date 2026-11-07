import { describe, expect, it } from 'vitest';
import { AiProvider, ChatMessage } from '../ai/types';
import { spreadDefinitions, listAvailableSpreads } from './spreads';
import { drawSpread } from './drawService';
import { buildStaticInterpretation, generateInterpretation, generateDetailedReport } from './interpretationService';
import { findMatchingCombinations } from './combinations';
import { computeYesNoTendency } from './yesNo';
import { personalizeDailyInterpretation } from './dailyPersonalization';
import { getCardOrThrow } from './catalogue';
import { validateDeck } from './validateDeck';
import { tarotCatalogue } from './catalogue';
import { TarotDraw } from '../types/tarot';
import { BirthProfile } from '../types/astrology';

/** Scripted fake AI provider so tests exercise the real prompt/parse pipeline
 * without a live network call - same pattern as palmistry/testFixtures.ts's
 * CountingFakeAiProvider. */
class ScriptedFakeAiProvider implements AiProvider {
  public lastPrompt = '';
  constructor(private response: string) {}
  async complete(messages: ChatMessage[]): Promise<string> {
    this.lastPrompt = messages.map((m) => m.content).join('\n');
    return this.response;
  }
}

function aiResponseFor(draws: TarotDraw[]): string {
  const cardLines = draws.map((d) => `CARD ${d.positionIndex}: A real interpretation for this position.`).join('\n');
  return `${cardLines}\nOVERALL: A real synthesized overall reading that relates the cards to each other.\nQUESTIONS: What stands out? | What would you change? | What feels true?`;
}

function detailedResponseFor(draws: TarotDraw[]): string {
  const cardLines = draws.map((d) => `CARD ${d.positionIndex}: A real detailed interpretation for this position, with symbolism woven in.`).join('\n');
  return `${cardLines}\nOVERALL: A real coherent multi-sentence synthesis covering the full spread as one flowing reading.\nSUGGESTIONS: Take one step | Reflect on this | Talk to someone\nQUESTIONS: What stands out? | What would you change? | What feels true?`;
}

describe('tarot deck validation still holds after this pass', () => {
  it('validates all 78 cards with no errors', () => {
    const result = validateDeck(tarotCatalogue);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('new spread definitions', () => {
  it('love-relationship has 5 cards and 5 positions', () => {
    const spread = spreadDefinitions['love-relationship'];
    expect(spread.cardCount).toBe(5);
    expect(spread.positions).toHaveLength(5);
    expect(spread.available).toBe(true);
  });

  it('career-finance has 3 cards and 3 positions', () => {
    const spread = spreadDefinitions['career-finance'];
    expect(spread.cardCount).toBe(3);
    expect(spread.positions).toHaveLength(3);
    expect(spread.available).toBe(true);
  });

  it('yes-no has exactly 1 card and 1 position, and is free', () => {
    const spread = spreadDefinitions['yes-no'];
    expect(spread.cardCount).toBe(1);
    expect(spread.positions).toHaveLength(1);
    expect(spread.premium).toBe(false);
    expect(spread.available).toBe(true);
  });

  it('relationship-compatibility has 4 cards and 4 positions', () => {
    const spread = spreadDefinitions['relationship-compatibility'];
    expect(spread.cardCount).toBe(4);
    expect(spread.positions).toHaveLength(4);
    expect(spread.available).toBe(true);
  });

  it('celtic-cross is now enabled (available: true) with 10 positions', () => {
    const spread = spreadDefinitions['celtic-cross'];
    expect(spread.available).toBe(true);
    expect(spread.cardCount).toBe(10);
    expect(spread.positions).toHaveLength(10);
  });

  it('every spread position index range matches its card count, and listAvailableSpreads includes all new types', () => {
    for (const spread of Object.values(spreadDefinitions)) {
      expect(spread.positions.map((p) => p.index)).toEqual(Array.from({ length: spread.cardCount }, (_, i) => i));
    }
    const ids = listAvailableSpreads().map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([
      'love-relationship', 'career-finance', 'yes-no', 'relationship-compatibility', 'celtic-cross',
    ]));
  });

  it('drawSpread produces no duplicate cards for every new spread type', () => {
    for (const id of ['love-relationship', 'career-finance', 'yes-no', 'relationship-compatibility', 'celtic-cross'] as const) {
      const draws = drawSpread(id);
      const ids = draws.map((d) => d.cardId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(draws).toHaveLength(spreadDefinitions[id].cardCount);
    }
  });
});

describe('Yes/No distinct response shape', () => {
  it('buildStaticInterpretation attaches a yesNo result with tendency/basis/context/advice for the yes-no spread', () => {
    const draws = drawSpread('yes-no');
    const interpretation = buildStaticInterpretation(draws, 'question', 'yes-no');
    expect(interpretation.yesNo).toBeDefined();
    expect(['yes', 'no', 'uncertain']).toContain(interpretation.yesNo!.tendency);
    expect(interpretation.yesNo!.traditionalBasis.length).toBeGreaterThan(0);
    expect(interpretation.yesNo!.context.length).toBeGreaterThan(0);
    expect(interpretation.yesNo!.advice.length).toBeGreaterThan(0);
  });

  it('does not attach yesNo for a non yes-no spread', () => {
    const draws = drawSpread('one-card');
    const interpretation = buildStaticInterpretation(draws, 'general', 'one-card');
    expect(interpretation.yesNo).toBeUndefined();
  });

  it('computeYesNoTendency flips a clear lean on reversal but keeps uncertain cards uncertain', () => {
    // The Sun is a clear traditional "yes" upright.
    expect(computeYesNoTendency('major-19-the-sun', 'upright', null)).toBe('yes');
    expect(computeYesNoTendency('major-19-the-sun', 'reversed', null)).toBe('no');
    // The High Priestess is traditionally uncertain regardless of orientation.
    expect(computeYesNoTendency('major-02-the-high-priestess', 'upright', null)).toBe('uncertain');
    expect(computeYesNoTendency('major-02-the-high-priestess', 'reversed', null)).toBe('uncertain');
  });

  it('generateInterpretation attaches the deterministic yesNo even when the AI path is used (AI never invents the tendency)', async () => {
    const draws = drawSpread('yes-no');
    const provider = new ScriptedFakeAiProvider(aiResponseFor(draws));
    const result = await generateInterpretation(draws, 'question', 'Will this work out?', provider, 'yes-no');
    expect(result.yesNo).toBeDefined();
    expect(result.yesNo!.tendency).toBe(computeYesNoTendency(draws[0].cardId, draws[0].orientation, getCardOrThrow(draws[0].cardId).rank));
  });
});

describe('Card combination knowledge base', () => {
  it('has at least 20 curated entries, all labeled traditional', () => {
    // Re-derive the count via a reading that matches everything, by importing the raw list indirectly:
    // findMatchingCombinations against an empty draw returns [], so instead assert count through a full-deck probe.
    const allCardIds = tarotCatalogue.map((c) => c.id);
    const fakeDraws: TarotDraw[] = allCardIds.map((cardId, i) => ({
      cardId, positionIndex: i, positionName: `pos-${i}`, orientation: 'upright',
    }));
    const matches = findMatchingCombinations(fakeDraws);
    expect(matches.length).toBeGreaterThanOrEqual(20);
    for (const m of matches) {
      expect(m.source).toBe('traditional');
      expect(m.interpretation.length).toBeGreaterThan(0);
    }
  });

  it('finds a known curated combination (The Lovers + Two of Cups) when both are drawn, order-independently', () => {
    const draws: TarotDraw[] = [
      { cardId: 'minor-cups-two', positionIndex: 0, positionName: 'A', orientation: 'upright' },
      { cardId: 'major-06-the-lovers', positionIndex: 1, positionName: 'B', orientation: 'upright' },
    ];
    const matches = findMatchingCombinations(draws);
    expect(matches.some((m) => m.cardIds.includes('major-06-the-lovers') && m.cardIds.includes('minor-cups-two'))).toBe(true);
  });

  it('finds Tower + Star traditional combination', () => {
    const draws: TarotDraw[] = [
      { cardId: 'major-16-the-tower', positionIndex: 0, positionName: 'A', orientation: 'upright' },
      { cardId: 'major-17-the-star', positionIndex: 1, positionName: 'B', orientation: 'reversed' },
    ];
    const matches = findMatchingCombinations(draws);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('returns no matches when drawn cards do not form any curated combination', () => {
    const draws: TarotDraw[] = [
      { cardId: 'minor-wands-four', positionIndex: 0, positionName: 'A', orientation: 'upright' },
    ];
    expect(findMatchingCombinations(draws)).toEqual([]);
  });

  it('a matched combination is included in the AI grounding prompt for both interpret and detailed-report paths', async () => {
    const draws: TarotDraw[] = [
      { cardId: 'minor-cups-two', positionIndex: 0, positionName: 'You', orientation: 'upright' },
      { cardId: 'major-06-the-lovers', positionIndex: 1, positionName: 'Them', orientation: 'upright' },
      { cardId: 'major-19-the-sun', positionIndex: 2, positionName: 'Potential', orientation: 'upright' },
    ];

    const provider = new ScriptedFakeAiProvider(aiResponseFor(draws));
    await generateInterpretation(draws, 'love', null, provider, 'love-relationship');
    expect(provider.lastPrompt).toContain('Established combination (traditional/established)');
    expect(provider.lastPrompt).toContain('Lovers');

    const detailedProvider = new ScriptedFakeAiProvider(detailedResponseFor(draws));
    await generateDetailedReport(draws, 'love', null, detailedProvider, 'love-relationship');
    expect(detailedProvider.lastPrompt).toContain('Established combination (traditional/established)');
  });

  it('when nothing matches, the prompt explicitly tells the AI it is synthesizing, not quoting an established combination', async () => {
    const draws: TarotDraw[] = [
      { cardId: 'minor-wands-four', positionIndex: 0, positionName: 'A', orientation: 'upright' },
    ];
    const provider = new ScriptedFakeAiProvider(aiResponseFor(draws));
    await generateInterpretation(draws, 'general', null, provider, 'one-card');
    expect(provider.lastPrompt).toContain('your own synthesis, not a fixed, traditionally-established combination');
  });
});

describe('Relational synthesis instruction scales with spread size', () => {
  it('adds no special relational instruction for a single card', async () => {
    const draws = drawSpread('one-card');
    const provider = new ScriptedFakeAiProvider(aiResponseFor(draws));
    await generateInterpretation(draws, 'general', null, provider, 'one-card');
    expect(provider.lastPrompt).not.toContain('OVERALL synthesis must explicitly address');
  });

  it('requires relational synthesis language for 3+ card spreads', async () => {
    const draws = drawSpread('three-card-ppf');
    const provider = new ScriptedFakeAiProvider(aiResponseFor(draws));
    await generateInterpretation(draws, 'general', null, provider, 'three-card-ppf');
    expect(provider.lastPrompt).toContain('OVERALL synthesis must explicitly address');
  });

  it('calls out the Present/Challenge crossing-card pair and Hopes&Fears/Outcome pair specifically for Celtic Cross', async () => {
    const draws = drawSpread('celtic-cross');
    const provider = new ScriptedFakeAiProvider(aiResponseFor(draws));
    await generateInterpretation(draws, 'general', null, provider, 'celtic-cross');
    expect(provider.lastPrompt).toContain('Celtic Cross specifically');
    expect(provider.lastPrompt).toContain('Hopes & Fears');
  });
});

describe('Daily card personalization - honest fallback, draw never biased', () => {
  const fakeProfile: BirthProfile = {
    userId: 'u1',
    birthDate: '1990-01-01',
    birthTime: null,
    birthPlace: 'Mumbai, India',
    birthLatitude: 19.07,
    birthLongitude: 72.87,
    preferredSystem: 'western',
    timezone: 'Asia/Kolkata',
    natal: {
      birthDateUtc: '1990-01-01T12:00:00Z',
      birthTimeKnown: false,
      sunSignTropical: 'Capricorn',
      moonSignTropical: 'Gemini',
      moonSignSidereal: 'Taurus',
      moonNakshatra: 'Mrigashira',
      moonNakshatraPada: 2,
      risingSignAvailable: false,
      engineVersion: 'test-engine-1.0',
      confidenceNote: 'test',
    },
    updatedAt: new Date().toISOString(),
  };

  it('personalizes using the real saved profile sun/moon sign when a profile exists', () => {
    const draws = drawSpread('one-card');
    const card = getCardOrThrow(draws[0].cardId);
    const base = buildStaticInterpretation(draws, 'general', 'one-card');
    const personalized = personalizeDailyInterpretation(base, card, draws[0].orientation, fakeProfile);
    expect(personalized.personalized).toBe(true);
    expect(personalized.personalizedNote).toContain('Capricorn');
    expect(personalized.personalizedNote).toContain('Gemini');
  });

  it('falls back to an honest, clearly-labeled non-personalized note when no profile exists, without changing the card', () => {
    const draws = drawSpread('one-card');
    const card = getCardOrThrow(draws[0].cardId);
    const base = buildStaticInterpretation(draws, 'general', 'one-card');
    const fallback = personalizeDailyInterpretation(base, card, draws[0].orientation, null);
    expect(fallback.personalized).toBe(false);
    expect(fallback.personalizedNote).toMatch(/non-personalized/i);
    // The card id/draw itself is untouched by personalization.
    expect(draws[0].cardId).toBe(card.id);
  });
});
