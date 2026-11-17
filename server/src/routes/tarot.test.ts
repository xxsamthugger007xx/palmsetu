import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildTarotRouter } from './tarot';
import { attachAuthContext } from '../auth/middleware';
import { aiUsageEvents, userPlans, tarotFollowupEvents } from '../data/store';
import { MockProvider } from '../ai/mockProvider';
import { UsageTrackingProvider } from '../ai/usageTracking';
import { SanitizingProvider } from '../ai/sanitizingProvider';
import { AiProvider, ChatMessage } from '../ai/types';

class ScriptedProvider implements AiProvider {
  constructor(private response: string) {}
  async complete(_messages: ChatMessage[]): Promise<string> {
    return this.response;
  }
}

function buildApp(aiProvider: AiProvider) {
  const app = express();
  app.use(express.json());
  app.use(attachAuthContext);
  app.use('/tarot', buildTarotRouter(aiProvider));
  return app;
}

describe('routes/tarot - second-person name on compatibility readings', () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp(new MockProvider());
  });

  it('persists secondPersonName only for relationship-compatibility, and reflects it back on the reading', async () => {
    const user = `user-${uuid()}`;
    userPlans.set(user, { userId: user, tier: 'premium' }); // relationship-compatibility is a premium spread
    const res = await request(app).post('/tarot/readings').set('x-demo-user', user).send({
      readingType: 'love',
      spreadType: 'relationship-compatibility',
      secondPersonName: 'Alex',
    });
    expect(res.status).toBe(200);
    expect(res.body.secondPersonName).toBe('Alex');
  });

  it('strips secondPersonName for any other spread type, even if the client sends one', async () => {
    const user = `user-${uuid()}`;
    const res = await request(app).post('/tarot/readings').set('x-demo-user', user).send({
      readingType: 'general',
      spreadType: 'one-card',
      secondPersonName: 'Alex',
    });
    expect(res.status).toBe(200);
    expect(res.body.secondPersonName).toBeNull();
  });

  it('is null (not an empty string) when omitted on a compatibility reading', async () => {
    const user = `user-${uuid()}`;
    userPlans.set(user, { userId: user, tier: 'premium' });
    const res = await request(app).post('/tarot/readings').set('x-demo-user', user).send({
      readingType: 'love',
      spreadType: 'relationship-compatibility',
    });
    expect(res.status).toBe(200);
    expect(res.body.secondPersonName).toBeNull();
  });
});

describe('routes/tarot - history full-text search', () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp(new MockProvider());
  });

  it('matches by question text, case-insensitively', async () => {
    const user = `user-${uuid()}`;
    userPlans.set(user, { userId: user, tier: 'premium' });
    const a = await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'question', spreadType: 'one-card', question: 'Should I take the new job offer?' });
    await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'general', spreadType: 'one-card' });

    const res = await request(app).get('/tarot/readings?q=JOB OFFER').set('x-demo-user', user);
    expect(res.body.items.map((r: any) => r.id)).toEqual([a.body.id]);
  });

  it('matches by spread title/category even without a question', async () => {
    const user = `user-${uuid()}`;
    userPlans.set(user, { userId: user, tier: 'premium' });
    const a = await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'love', spreadType: 'love-relationship' });
    await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'career', spreadType: 'career-finance' });

    const res = await request(app).get('/tarot/readings?q=love').set('x-demo-user', user);
    expect(res.body.items.map((r: any) => r.id)).toEqual([a.body.id]);
  });

  it('matches by the actual drawn card name once a free interpretation exists', async () => {
    const user = `user-${uuid()}`;
    const create = await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'general', spreadType: 'one-card' });
    const interpreted = await request(app).post(`/tarot/readings/${create.body.id}/interpret`).set('x-demo-user', user);
    const drawnCardName: string = interpreted.body.interpretation.cardInterpretations[0].text.split(' (')[0].split(': ')[1];

    const res = await request(app).get(`/tarot/readings?q=${encodeURIComponent(drawnCardName.toLowerCase())}`).set('x-demo-user', user);
    expect(res.body.items.map((r: any) => r.id)).toContain(create.body.id);
  });

  it('returns an empty list, not an error, when nothing matches', async () => {
    const user = `user-${uuid()}`;
    await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'general', spreadType: 'one-card' });
    const res = await request(app).get('/tarot/readings?q=xyznonexistentsearchterm').set('x-demo-user', user);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe('routes/tarot - history filters', () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp(new MockProvider());
  });

  it('filters history by saved=true and by category, server-side', async () => {
    const user = `user-${uuid()}`;
    userPlans.set(user, { userId: user, tier: 'premium' }); // avoid the free-tier 1-reading-per-day limit for this 2-reading test
    const a = await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'general', spreadType: 'one-card' });
    const b = await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'love', spreadType: 'one-card' });
    await request(app).patch(`/tarot/readings/${a.body.id}`).set('x-demo-user', user).send({ saved: true });

    const savedOnly = await request(app).get('/tarot/readings?saved=true').set('x-demo-user', user);
    expect(savedOnly.body.items.map((r: any) => r.id)).toEqual([a.body.id]);

    const loveOnly = await request(app).get('/tarot/readings?category=love').set('x-demo-user', user);
    expect(loveOnly.body.items.map((r: any) => r.id)).toEqual([b.body.id]);
  });
});

describe('routes/tarot - follow-up never leaks an unconfigured-provider placeholder as a real answer', () => {
  it('falls back to an honest error message when the provider returns its own mock text', async () => {
    const app = buildApp(new MockProvider());
    const user = `user-${uuid()}`;
    userPlans.set(user, { userId: user, tier: 'premium' }); // follow-up is premium-only
    const create = await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'general', spreadType: 'one-card' });
    await request(app).post(`/tarot/readings/${create.body.id}/interpret`).set('x-demo-user', user);

    const ask = await request(app).post(`/tarot/readings/${create.body.id}/ask`).set('x-demo-user', user).send({ question: 'What should I focus on?' });
    expect(ask.status).toBe(200);
    expect(ask.body.answer).not.toContain('[mock reply]');
    expect(ask.body.answer).toMatch(/unable to generate/i);
  });

  it('returns the real answer when the provider gives a genuine response', async () => {
    const app = buildApp(new ScriptedProvider('A genuinely real, long-enough answer about your reading.'));
    const user = `user-${uuid()}`;
    userPlans.set(user, { userId: user, tier: 'premium' });
    const create = await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'general', spreadType: 'one-card' });
    await request(app).post(`/tarot/readings/${create.body.id}/interpret`).set('x-demo-user', user);

    const ask = await request(app).post(`/tarot/readings/${create.body.id}/ask`).set('x-demo-user', user).send({ question: 'What should I focus on?' });
    expect(ask.status).toBe(200);
    expect(ask.body.answer).toBe('A genuinely real, long-enough answer about your reading.');
  });
});

describe('routes/tarot - follow-up questions are premium-only, persisted, and capped per day', () => {
  it('rejects a free-tier user outright, regardless of how many they have asked', async () => {
    const app = buildApp(new ScriptedProvider('A real answer of reasonable length.'));
    const user = `user-${uuid()}`;
    const create = await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'general', spreadType: 'one-card' });
    await request(app).post(`/tarot/readings/${create.body.id}/interpret`).set('x-demo-user', user);

    const ask = await request(app).post(`/tarot/readings/${create.body.id}/ask`).set('x-demo-user', user).send({ question: 'What should I focus on?' });
    expect(ask.status).toBe(403);
    expect(ask.body.code).toBe('PREMIUM_REQUIRED');
  });

  it('persists the Q&A on the reading so it survives a reload (logout/login equivalent)', async () => {
    const app = buildApp(new ScriptedProvider('A real persisted answer of reasonable length.'));
    const user = `user-${uuid()}`;
    userPlans.set(user, { userId: user, tier: 'premium' });
    const create = await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'general', spreadType: 'one-card' });
    await request(app).post(`/tarot/readings/${create.body.id}/interpret`).set('x-demo-user', user);
    await request(app).post(`/tarot/readings/${create.body.id}/ask`).set('x-demo-user', user).send({ question: 'What should I focus on?' });

    const reopened = await request(app).get(`/tarot/readings/${create.body.id}`).set('x-demo-user', user);
    expect(reopened.body.followupMessages.length).toBe(1);
    expect(reopened.body.followupMessages[0].question).toBe('What should I focus on?');
    expect(reopened.body.followupMessages[0].answer).toBe('A real persisted answer of reasonable length.');
  });

  it('enforces a daily cap across readings for the same premium user', async () => {
    const app = buildApp(new ScriptedProvider('A real answer of reasonable length.'));
    const user = `user-${uuid()}`;
    userPlans.set(user, { userId: user, tier: 'premium' });
    const create = await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'general', spreadType: 'one-card' });
    await request(app).post(`/tarot/readings/${create.body.id}/interpret`).set('x-demo-user', user);

    // Pre-seed today's event log right up to the limit, then confirm the
    // next ask is rejected without needing to actually fire 20 requests.
    const todayIso = new Date().toISOString();
    for (let i = 0; i < 20; i++) {
      tarotFollowupEvents.push({ id: uuid(), userId: user, readingId: create.body.id, createdAt: todayIso });
    }

    const ask = await request(app).post(`/tarot/readings/${create.body.id}/ask`).set('x-demo-user', user).send({ question: 'One more?' });
    expect(ask.status).toBe(403);
    expect(ask.body.code).toBe('DAILY_LIMIT_REACHED');
  });
});

describe('ai/usageTracking - shared, feature-agnostic AI usage instrumentation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('records a real usage event, tagged by feature/operation, on a successful call', async () => {
    const before = aiUsageEvents.length;
    const provider = new UsageTrackingProvider(new SanitizingProvider(new ScriptedProvider('a real synthesized response of reasonable length')));
    await provider.complete(
      [{ role: 'system', content: 'sys' }, { role: 'user', content: 'a prompt of some length' }],
      { feature: 'tarot', operation: 'detailed_report' },
    );
    expect(aiUsageEvents.length).toBe(before + 1);
    const event = aiUsageEvents[aiUsageEvents.length - 1];
    expect(event.feature).toBe('tarot');
    expect(event.operation).toBe('detailed_report');
    expect(event.success).toBe(true);
    expect(event.estimatedInputTokens).toBeGreaterThan(0);
    expect(event.estimatedOutputTokens).toBeGreaterThan(0);
  });

  it('records a failed event (not a thrown-and-lost one) when the inner provider rejects', async () => {
    const before = aiUsageEvents.length;
    const failingProvider: AiProvider = { complete: async () => { throw new Error('boom'); } };
    const provider = new UsageTrackingProvider(failingProvider);
    await expect(
      provider.complete([{ role: 'user', content: 'x' }], { feature: 'tarot', operation: 'detailed_report' })
    ).rejects.toThrow('boom');
    expect(aiUsageEvents.length).toBe(before + 1);
    expect(aiUsageEvents[aiUsageEvents.length - 1].success).toBe(false);
  });

  it('defaults feature/operation to "unspecified" when a caller passes no tags, rather than throwing', async () => {
    const provider = new UsageTrackingProvider(new ScriptedProvider('ok'));
    await provider.complete([{ role: 'user', content: 'x' }]);
    const event = aiUsageEvents[aiUsageEvents.length - 1];
    expect(event.feature).toBe('unspecified');
    expect(event.operation).toBe('unspecified');
  });
});

describe('routes/tarot - detailed report cannot be double-generated by a concurrent request', () => {
  it('rejects a second concurrent request with 409 while the first is still mid-flight, and never issues a second AI call', async () => {
    let aiCallCount = 0;
    const provider: AiProvider = {
      complete: async () => {
        aiCallCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 60));
        return 'CARD 0: A real interpretation of reasonable length for this card.\nOVERALL: A real coherent multi-sentence synthesis of the full spread.\nSUGGESTIONS: Take one small step | Reflect on this fully | Talk to someone close\nQUESTIONS: What stands out here | What would you change | What feels true now';
      },
    };
    const app = buildApp(provider);
    const user = `user-${uuid()}`;
    userPlans.set(user, { userId: user, tier: 'premium' });
    const create = await request(app).post('/tarot/readings').set('x-demo-user', user).send({ readingType: 'general', spreadType: 'one-card' });

    const [first, second] = await Promise.all([
      request(app).post(`/tarot/readings/${create.body.id}/detailed-report`).set('x-demo-user', user),
      request(app).post(`/tarot/readings/${create.body.id}/detailed-report`).set('x-demo-user', user),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(aiCallCount).toBe(1);
  });
});

describe('routes/tarot - daily card is stable per user per local date, even under concurrent requests', () => {
  it('never creates two different daily cards for the same user+date, even when requested concurrently', async () => {
    const app = buildApp(new MockProvider());
    const user = `user-${uuid()}`;
    const localDate = '2026-11-15';

    const [first, second] = await Promise.all([
      request(app).get(`/tarot/daily?localDate=${localDate}`).set('x-demo-user', user),
      request(app).get(`/tarot/daily?localDate=${localDate}`).set('x-demo-user', user),
    ]);

    expect(first.body.daily.cardId).toBe(second.body.daily.cardId);
    expect(first.body.daily.orientation).toBe(second.body.daily.orientation);
    expect(first.body.daily.readingId).toBe(second.body.daily.readingId);
  });

  it('returns the exact same card on a later request the same day, and a request for a different date is independent', async () => {
    const app = buildApp(new MockProvider());
    const user = `user-${uuid()}`;

    const day1First = await request(app).get('/tarot/daily?localDate=2026-11-15').set('x-demo-user', user);
    const day1Second = await request(app).get('/tarot/daily?localDate=2026-11-15').set('x-demo-user', user);
    expect(day1Second.body.daily.cardId).toBe(day1First.body.daily.cardId);

    const day2 = await request(app).get('/tarot/daily?localDate=2026-11-16').set('x-demo-user', user);
    expect(day2.body.daily.readingId).not.toBe(day1First.body.daily.readingId);
  });
});
