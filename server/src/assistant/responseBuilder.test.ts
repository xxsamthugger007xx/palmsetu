import { describe, expect, it, beforeEach } from 'vitest';
import { buildAssistantReply } from './responseBuilder';
import { MockProvider } from '../ai/mockProvider';
import {
  tarotReadingsById, gemstoneReportsById, userPlans, birthProfiles,
} from '../data/store';
import { DEFAULT_ASSISTANT_CONFIG } from '../data/assistantConfig';
import { TarotReading } from '../types/tarot';
import { GemstoneReport } from '../types/gemstone';
import { BirthProfile } from '../types/astrology';

const ai = new MockProvider();
const config = { ...DEFAULT_ASSISTANT_CONFIG };

function fakeTarotReading(userId: string, detailedReportStatus: 'none' | 'ready' = 'none'): TarotReading {
  return {
    id: `t-${userId}`,
    userId,
    readingType: 'general',
    spreadType: 'one-card',
    question: null,
    status: 'interpreted',
    draws: [{ cardId: 'major-00-the-fool', positionIndex: 0, positionName: 'Present', orientation: 'upright' }],
    interpretation: { overallInterpretation: 'A fresh start.', cards: [] } as any,
    detailedReport: detailedReportStatus === 'ready' ? ({ text: 'deep report' } as any) : null,
    detailedReportStatus,
    saved: false,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    datasetVersion: 'test',
  };
}

function fakeGemstoneReport(userId: string): GemstoneReport {
  return {
    id: `g-${userId}`,
    userId,
    createdAt: new Date().toISOString(),
    datasetVersion: 'test',
    ruleEngineVersion: 'test',
    calculationReference: 'test',
    dataCompleteness: 'full',
    goal: null,
    budget: null,
    primary: { strength: 'primary', gemstone: { planet: 'Sun', nameEnglish: 'Ruby', nameHindi: 'Manik', alternativeName: 'Red Spinel', alternativeIsEquivalent: false, traditionalDay: 'Sunday', traditionalFinger: 'ring', traditionalMetal: 'gold', customaryPractice: 'wear after prayer' }, ruleId: 'rashi-lord-v1', ruleExplanation: 'Leo moon, ruled by Sun' },
    alternative: { strength: 'none', gemstone: null, ruleId: 'n/a', ruleExplanation: '' },
    caratGuidance: { available: false, suggestedRangeCarats: null, method: '', disclaimer: '' },
    explanation: 'static',
    explanationSource: 'static-fallback',
    saved: false,
  };
}

function fakeBirthProfile(userId: string): BirthProfile {
  return {
    userId,
    birthDate: '2000-01-01',
    birthTime: '12:00:00',
    birthPlace: 'Delhi',
    birthLatitude: 28.7041,
    birthLongitude: 77.1025,
    preferredSystem: 'vedic',
    timezone: 'Asia/Kolkata',
    natal: {
      birthDateUtc: '2000-01-01T12:00:00.000Z', birthTimeKnown: true, sunSignTropical: 'Capricorn',
      moonSignTropical: 'Leo', moonSignSidereal: 'Leo', moonNakshatra: 'Ashwini', moonNakshatraPada: 1,
      risingSignAvailable: false, engineVersion: 'test', confidenceNote: '',
    } as any,
    updatedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  tarotReadingsById.clear();
  gemstoneReportsById.clear();
  userPlans.clear();
  birthProfiles.clear();
});

describe('buildAssistantReply', () => {
  it('free user asking fully-free astrology question: answers from data, no premium card (no astrology gate exists)', async () => {
    const userId = 'u-free-astro';
    birthProfiles.set(userId, fakeBirthProfile(userId));
    const result = await buildAssistantReply(userId, 'What is my moon sign in astrology?', [], ai, config);
    expect(result.detectedFeature).toBe('astrology');
    expect(result.premiumCard).toBeNull();
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it('free user asking about tarot with no detailed report yet: gets free content + premium card', async () => {
    const userId = 'u-free-tarot';
    tarotReadingsById.set(`t-${userId}`, fakeTarotReading(userId, 'none'));
    const result = await buildAssistantReply(userId, 'What does my tarot card mean?', [], ai, config);
    expect(result.detectedFeature).toBe('tarot');
    expect(result.premiumCard).not.toBeNull();
    expect(result.premiumCard?.feature).toBe('tarot');
    expect(result.premiumCard?.navigateTo).toBe('Paywall');
  });

  it('premium user asking the same tarot question: no premium card, since they already have detailed-report access', async () => {
    const userId = 'u-premium-tarot';
    userPlans.set(userId, { userId, tier: 'premium' });
    tarotReadingsById.set(`t-${userId}`, fakeTarotReading(userId, 'none'));
    const result = await buildAssistantReply(userId, 'What does my tarot card mean?', [], ai, config);
    expect(result.detectedFeature).toBe('tarot');
    expect(result.premiumCard).toBeNull();
  });

  it('premium user with an already-ready detailed report: no premium card even though free tier would differ', async () => {
    const userId = 'u-premium-tarot-ready';
    userPlans.set(userId, { userId, tier: 'premium' });
    tarotReadingsById.set(`t-${userId}`, fakeTarotReading(userId, 'ready'));
    const result = await buildAssistantReply(userId, 'Tell me about my tarot cards', [], ai, config);
    expect(result.premiumCard).toBeNull();
  });

  it('question about a feature with no user data yet: says so, does not fabricate, no premium card', async () => {
    const userId = 'u-no-data';
    const result = await buildAssistantReply(userId, 'What does my gemstone recommendation say?', [], ai, config);
    expect(result.detectedFeature).toBe('gemstone');
    expect(result.premiumCard).toBeNull();
    expect(result.reply.toLowerCase()).toContain("don't have");
  });

  it('question about a feature that does not exist in this app (numerology): says not implemented, never calls it premium', async () => {
    const userId = 'u-numerology';
    const result = await buildAssistantReply(userId, 'What is my moolaank number in numerology?', [], ai, config);
    expect(result.premiumCard).toBeNull();
    expect(result.reply.toLowerCase()).toContain("isn't a premium limitation");
    expect(result.reply.toLowerCase()).toContain("doesn't have a");
  });

  it('gemstone report that exists for a free user: gets free explanation + premium card for additional reports', async () => {
    const userId = 'u-free-gem';
    gemstoneReportsById.set(`g-${userId}`, fakeGemstoneReport(userId));
    const result = await buildAssistantReply(userId, 'Why was this gemstone recommended to me?', [], ai, config);
    expect(result.detectedFeature).toBe('gemstone');
    expect(result.premiumCard).not.toBeNull();
  });

  it('ambiguous/unclear message: detects unknown feature, degrades gracefully instead of crashing', async () => {
    const userId = 'u-unclear';
    const result = await buildAssistantReply(userId, 'hello there', [], ai, config);
    expect(result.detectedFeature).toBeNull();
    expect(result.reply.length).toBeGreaterThan(0);
  });
});
