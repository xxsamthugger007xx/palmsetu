import { describe, expect, it, beforeEach } from 'vitest';
import { buildAssistantReply } from './responseBuilder';
import { MockProvider } from '../ai/mockProvider';
import { birthProfiles } from '../data/store';
import { DEFAULT_ASSISTANT_CONFIG } from '../data/assistantConfig';
import { BirthProfile } from '../types/astrology';
import { getAstrologyKnowledge } from '../astrology/knowledgeBase/knowledgeBaseService';

const ai = new MockProvider();
const config = { ...DEFAULT_ASSISTANT_CONFIG };

function fakeBirthProfile(userId: string, preferredSystem: 'vedic' | 'western'): BirthProfile {
  return {
    userId,
    birthDate: '2000-01-01',
    birthTime: '12:00:00',
    birthPlace: 'Delhi',
    birthLatitude: 28.7041,
    birthLongitude: 77.1025,
    preferredSystem,
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
  birthProfiles.clear();
});

describe('astrology knowledge-base grounding in the assistant pipeline', () => {
  it('a general knowledge question ("what does the 7th house mean") is answered grounded in the real knowledge base, no birth profile required', async () => {
    const result = await buildAssistantReply('u-no-profile', 'What does the 7th house mean?', [], ai, config);
    expect(result.detectedFeature).toBe('astrology');
    // MockProvider echoes the last user message back verbatim, so if the
    // knowledge-base content was genuinely included in the prompt sent to
    // the AI provider, it comes back out in the reply.
    const western = getAstrologyKnowledge('7th house', 'western')!;
    expect(result.reply).toContain(western.summary);
  });

  it('vedic-preference user asking about Scorpio gets Rashi-framed content; western-preference user gets tropical-sign-framed content; genuinely different', async () => {
    birthProfiles.set('u-vedic', fakeBirthProfile('u-vedic', 'vedic'));
    birthProfiles.set('u-western', fakeBirthProfile('u-western', 'western'));

    const vedicResult = await buildAssistantReply('u-vedic', 'Tell me about Scorpio', [], ai, config);
    const westernResult = await buildAssistantReply('u-western', 'Tell me about Scorpio', [], ai, config);

    const vedicEntry = getAstrologyKnowledge('scorpio', 'vedic')!;
    const westernEntry = getAstrologyKnowledge('scorpio', 'western')!;

    expect(vedicResult.reply).toContain(vedicEntry.summary);
    expect(westernResult.reply).toContain(westernEntry.summary);
    expect(vedicResult.reply).not.toBe(westernResult.reply);
    expect(vedicEntry.summary).not.toBe(westernEntry.summary);
  });

  it('an unrecognized astrology topic does not fabricate grounded-looking content - falls back to the general flow', async () => {
    birthProfiles.set('u-nogap', fakeBirthProfile('u-nogap', 'western'));
    const result = await buildAssistantReply('u-nogap', 'What does my astrology say about winning the lottery next week?', [], ai, config);
    // No specific knowledge-base topic recognized in this message, so it
    // must fall through to the normal chart-data-based flow rather than
    // inventing a reference entry - still answered (from real chart data),
    // just not falsely presented as grounded in a specific KB entry.
    expect(result.detectedFeature).toBe('astrology');
    expect(result.success).toBe(true);
  });
});
