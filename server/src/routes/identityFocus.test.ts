import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { describe, it, expect } from 'vitest';
import { buildAstrologyRouter } from './astrology';
import { buildAssistantRouter } from './assistant';
import { attachAuthContext } from '../auth/middleware';
import { signGuestToken } from '../auth/tokens';
import { createGuestSession } from '../data/store';
import { MockProvider } from '../ai/mockProvider';

function app() {
  const a = express();
  a.use(express.json());
  a.use(attachAuthContext);
  a.use('/astrology', buildAstrologyRouter(new MockProvider()));
  a.use('/assistant', buildAssistantRouter(new MockProvider()));
  return a;
}
function guest() {
  const id = `guest-${uuid()}`;
  createGuestSession(id);
  return `Bearer ${signGuestToken(id)}`;
}

describe('focus areas on the identity', () => {
  it('saves any number of focus areas, keeps them when only the name changes, and feeds suggested questions', async () => {
    const a = app(); const auth = guest();
    const saved = await request(a).put('/astrology/identity').set('Authorization', auth).send({ name: 'Asha', gender: 'woman', focus: ['love', 'career'] });
    expect(saved.body.focus).toEqual(['love', 'career']);

    const renamed = await request(a).put('/astrology/identity').set('Authorization', auth).send({ name: 'Asha K', gender: 'woman' });
    expect(renamed.body.focus).toEqual(['love', 'career']);

    const q = await request(a).get('/assistant/suggested-questions').set('Authorization', auth);
    expect(q.body.questions[0]).toContain('love');

    const cleared = await request(a).put('/astrology/identity').set('Authorization', auth).send({ name: 'Asha K', focus: [] });
    expect(cleared.body.focus).toEqual([]);
  });

  it('accepts every area, ignores repeats, and rejects unknown areas', async () => {
    const a = app(); const auth = guest();
    expect((await request(a).put('/astrology/identity').set('Authorization', auth).send({ name: 'A', focus: ['nonsense'] })).status).toBe(400);
    const all = await request(a).put('/astrology/identity').set('Authorization', auth).send({ name: 'A', focus: ['love', 'career', 'money', 'health', 'family', 'growth'] });
    expect(all.body.focus).toHaveLength(6);
    const dup = await request(a).put('/astrology/identity').set('Authorization', auth).send({ name: 'A', focus: ['love', 'love'] });
    expect(dup.body.focus).toEqual(['love']);
  });
});
