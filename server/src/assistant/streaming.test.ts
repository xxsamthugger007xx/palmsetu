import { describe, expect, it, beforeEach } from 'vitest';
import { buildAssistantReply, StageEvent } from './responseBuilder';
import { SanitizingProvider } from '../ai/sanitizingProvider';
import { AiProvider, ChatMessage } from '../ai/types';
import { MockProvider } from '../ai/mockProvider';
import { tarotReadingsById, birthProfiles } from '../data/store';
import { DEFAULT_ASSISTANT_CONFIG } from '../data/assistantConfig';
import { TarotReading } from '../types/tarot';
import { BirthProfile } from '../types/astrology';

const config = { ...DEFAULT_ASSISTANT_CONFIG };

function fakeTarotReading(userId: string): TarotReading {
  return {
    id: `t-${userId}`,
    userId,
    readingType: 'general',
    spreadType: 'one-card',
    question: null,
    status: 'interpreted',
    draws: [{ cardId: 'major-00-the-fool', positionIndex: 0, positionName: 'Present', orientation: 'upright' }],
    interpretation: { overallInterpretation: 'A fresh start.', cards: [] } as any,
    detailedReport: null,
    detailedReportStatus: 'none',
    saved: false,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    datasetVersion: 'test',
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

/** A fake streaming-capable provider so these tests never hit the real
 * Gemini API - it emits chunks containing a literal em dash to prove the
 * sanitizing layer strips it from the streaming path specifically, not just
 * from a final concatenated string. */
class FakeStreamingProvider implements AiProvider {
  constructor(private chunks: string[], private shouldThrow = false) {}

  async complete(_messages: ChatMessage[]): Promise<string> {
    return this.chunks.join('');
  }

  async streamComplete(_messages: ChatMessage[], onChunk: (text: string) => void): Promise<string> {
    if (this.shouldThrow) throw new Error('simulated provider failure');
    let full = '';
    for (const c of this.chunks) {
      onChunk(c);
      full += c;
    }
    return full;
  }
}

beforeEach(() => {
  tarotReadingsById.clear();
  birthProfiles.clear();
});

describe('staged pipeline events', () => {
  it('only emits the feature-specific data stage after real data has actually been retrieved for a known feature', async () => {
    const userId = 'u-stage-astro';
    birthProfiles.set(userId, fakeBirthProfile(userId));
    const events: StageEvent[] = [];
    const ai = new MockProvider();

    await buildAssistantReply(userId, 'What is my moon sign in astrology?', [], ai, config, undefined, (e) => events.push(e));

    const keys = events.map((e) => e.key);
    expect(keys).toContain('data');
    // The feature-specific stage must come after retrieval, never before it.
    expect(keys.indexOf('retrieval')).toBeLessThan(keys.indexOf('data'));
    const dataEvent = events.find((e) => e.key === 'data');
    expect(dataEvent?.label).toContain('Kundli');
  });

  it('never emits a feature-specific data stage when no real data exists for the detected feature', async () => {
    const userId = 'u-stage-no-data';
    const events: StageEvent[] = [];
    const ai = new MockProvider();

    await buildAssistantReply(userId, 'What does my gemstone recommendation say?', [], ai, config, undefined, (e) => events.push(e));

    expect(events.map((e) => e.key)).not.toContain('data');
  });

  it('emits intent, retrieval and generation stages for an unknown/ambiguous message, never crashing', async () => {
    // Unknown-feature messages (including plain conversational replies like
    // "okay"/"thanks") now get a real, varied AI-generated reply instead of
    // one hardcoded sentence repeated verbatim - see responseBuilder.ts for
    // why. A 'generation' stage now genuinely fires for this path too.
    const userId = 'u-stage-unknown';
    const events: StageEvent[] = [];
    const ai = new MockProvider();

    const result = await buildAssistantReply(userId, 'hello there', [], ai, config, undefined, (e) => events.push(e));

    expect(events.map((e) => e.key)).toEqual(['intent', 'retrieval', 'generation']);
    expect(result.detectedFeature).toBeNull();
    expect(result.reply.length).toBeGreaterThan(0);
  });
});

describe('streaming sanitization', () => {
  it('strips em dashes from each streamed chunk individually, not just from the final text', async () => {
    const userId = 'u-sanitize-stream';
    birthProfiles.set(userId, fakeBirthProfile(userId));
    const inner = new FakeStreamingProvider(['Your sign is bold', ' — truly bold', ' and clear.']);
    const provider = new SanitizingProvider(inner);

    const seenChunks: string[] = [];
    const result = await buildAssistantReply(
      userId, 'What is my moon sign in astrology?', [], provider, config, undefined,
      undefined, (chunk) => seenChunks.push(chunk),
    );

    expect(seenChunks.join('')).not.toContain('—');
    expect(result.reply).not.toContain('—');
    expect(seenChunks.length).toBeGreaterThan(0);
  });

  it('falls back to a single full-text chunk when the provider cannot stream', async () => {
    const userId = 'u-no-stream-provider';
    birthProfiles.set(userId, fakeBirthProfile(userId));
    const ai = new MockProvider(); // MockProvider deliberately has no streamComplete
    const seenChunks: string[] = [];

    await buildAssistantReply(
      userId, 'What is my moon sign in astrology?', [], ai, config, undefined,
      undefined, (chunk) => seenChunks.push(chunk),
    );

    expect(seenChunks.length).toBe(1);
    expect(seenChunks[0].length).toBeGreaterThan(0);
  });
});

describe('graceful failure on provider error', () => {
  it('returns an honest failure reply instead of throwing when streamComplete rejects', async () => {
    const userId = 'u-provider-fail';
    birthProfiles.set(userId, fakeBirthProfile(userId));
    const inner = new FakeStreamingProvider([], true);
    const provider = new SanitizingProvider(inner);

    const result = await buildAssistantReply(
      userId, 'What is my moon sign in astrology?', [], provider, config, undefined,
      undefined, () => {},
    );

    expect(result.success).toBe(false);
    expect(result.reply.length).toBeGreaterThan(0);
  });
});

describe('token/cost estimation on the streaming path', () => {
  it('still records non-zero estimated input/output tokens when the reply was produced via streaming', async () => {
    const userId = 'u-tokens-stream';
    tarotReadingsById.set(`t-${userId}`, fakeTarotReading(userId));
    const inner = new FakeStreamingProvider(['The Fool', ' suggests a fresh start.']);
    const provider = new SanitizingProvider(inner);

    const result = await buildAssistantReply(
      userId, 'What does my tarot card mean?', [], provider, config, undefined,
      undefined, () => {},
    );

    expect(result.estimatedInputTokens).toBeGreaterThan(0);
    expect(result.estimatedOutputTokens).toBeGreaterThan(0);
    expect(result.timings.totalMs).toBeGreaterThanOrEqual(0);
  });
});
