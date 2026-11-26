import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { buildAssistantRouter } from './assistant';
import { attachAuthContext } from '../auth/middleware';
import { signGuestToken } from '../auth/tokens';
import { createGuestSession } from '../data/store';
import { MockProvider } from '../ai/mockProvider';
import { addSpend } from '../ai/budget';

function app() {
  const a = express();
  a.use(express.json());
  a.use(attachAuthContext);
  a.use('/assistant', buildAssistantRouter(new MockProvider()));
  return a;
}
function guest() {
  const id = `guest-${uuid()}`;
  createGuestSession(id);
  return { id, auth: `Bearer ${signGuestToken(id)}` };
}
const send = (a: express.Express, auth: string, message: string) =>
  request(a).post('/assistant/message').set('Authorization', auth).send({ conversationId: null, message });

describe('free-plan AI chat limits', () => {
  beforeEach(() => { process.env.AI_FREE_CHAT_MONTHLY_MESSAGES = '5'; });

  it('by default free accounts get no AI at all in chat (answers are built without Claude)', async () => {
    delete process.env.AI_FREE_CHAT_MONTHLY_MESSAGES;
    const a = app(); const g = guest();
    const r = await send(a, g.auth, 'I have a meeting at 4pm, how will it go?');
    expect(r.status).toBe(200);
    expect(r.body.reply.length).toBeGreaterThan(20);
    expect(r.body.freeRemaining ?? null).toBeNull();
  });

  afterEach(() => {
    delete process.env.AI_FREE_CHAT_DAILY_PER_IP;
    delete process.env.AI_FREE_CHAT_MONTHLY_MESSAGES;
  });

  it('stops giving AI answers after the monthly limit and says why', async () => {
    process.env.AI_FREE_CHAT_MONTHLY_MESSAGES = '1';
    const a = app(); const g = guest();
    const first = await send(a, g.auth, 'I have a meeting at 4pm, how will it go?');
    expect(first.body.freeRemaining).toBe(0);
    const second = await send(a, g.auth, 'what about tomorrow?');
    expect(second.body.reply).toContain("used this month's 1 free AI messages");
  });

  it('limits one network address across many throwaway guest accounts', async () => {
    process.env.AI_FREE_CHAT_DAILY_PER_IP = '2';
    const a = app();
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await send(a, guest().auth, 'tell me something nice')).body.reply as string);
    const limited = results.filter((r) => r.includes('free AI messages')).length;
    expect(limited).toBeGreaterThanOrEqual(1);
  });

  it('falls back to non-AI answers once a free account passes the monthly spend ceiling', async () => {
    const a = app(); const g = guest();
    addSpend(g.id, 50);
    const r = await send(a, g.auth, 'tell me something nice');
    expect(r.body.reply).toContain('free AI chat limit');
  });
});
