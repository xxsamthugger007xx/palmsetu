import { describe, expect, it } from 'vitest';
import { buildAssistantReply } from './responseBuilder';
import { DEFAULT_ASSISTANT_CONFIG } from '../data/assistantConfig';
import { tarotReadingsById } from '../data/store';
import type { AiProvider } from '../ai/types';

const explodingAi = {
  complete: async () => { throw new Error('AI must not be called for free users'); },
  streamComplete: async () => { throw new Error('AI must not be called for free users'); },
} as unknown as AiProvider;
const config = { ...DEFAULT_ASSISTANT_CONFIG };
const free = { aiEnabled: false };

describe('assistant without AI (free plan)', () => {
  it('answers a tarot card question from reference content', async () => {
    const r = await buildAssistantReply('free-1', 'What is the Fool card?', [], explodingAi, config, undefined, undefined, undefined, free);
    expect(r.success).toBe(true);
    expect(r.reply.length).toBeGreaterThan(20);
  });

  it('answers from the user\'s own stored reading', async () => {
    tarotReadingsById.set('t-free-2', {
      id: 't-free-2', userId: 'free-2', readingType: 'general', spreadType: 'one-card', question: null, secondPersonName: null,
      followupMessages: [], status: 'interpreted',
      draws: [{ cardId: 'major-00-the-fool', positionIndex: 0, positionName: 'Present', orientation: 'upright' }],
      interpretation: { overallInterpretation: 'A fresh start.', cards: [] } as any, detailedReport: null,
      detailedReportStatus: 'none', saved: false, createdAt: new Date().toISOString(), completedAt: new Date().toISOString(), datasetVersion: 't',
    } as any);
    const chunks: string[] = [];
    const r = await buildAssistantReply('free-2', 'What does my tarot card mean?', [], explodingAi, config, undefined, undefined, (c) => chunks.push(c), free);
    expect(r.success).toBe(true);
    expect(r.reply).toContain('The Fool');
    expect(r.reply).toContain('A fresh start.');
    expect(r.reply).toContain('Upgrade to Premium');
    expect(chunks.join('')).toBe(r.reply);
  });

  it('gives a helpful menu for open-ended questions instead of failing', async () => {
    const r = await buildAssistantReply('free-3', 'tell me a joke about cats', [], explodingAi, config, undefined, undefined, undefined, free);
    expect(r.success).toBe(true);
    expect(r.reply.length).toBeGreaterThan(30);
  });
});
