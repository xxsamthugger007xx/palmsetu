import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';
import { buildWellnessRouter } from './wellness';
import { CountingFakeAiProvider } from '../palmistry/testFixtures';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { wellnessAnalyticsEvents } from '../data/store';

function buildApp(provider = new CountingFakeAiProvider()) {
  const app = express();
  app.use(express.json());
  app.use('/wellness', buildWellnessRouter(provider));
  return { app, provider };
}

function userHeader(userId: string) {
  return { 'x-demo-user': userId };
}

describe('routes/wellness - mood tracker', () => {
  it('is idempotent per local day: a second check-in the same day updates in place, not a new record', async () => {
    const { app } = buildApp();
    const userId = `test-${uuid()}`;
    const payload = { localDate: '2026-11-03', mood: 'good', emotions: ['calm'], energy: 3, stress: 2, sleepQuality: 4 };

    const first = await request(app).post('/wellness/mood').set(userHeader(userId)).send(payload);
    expect(first.status).toBe(200);
    expect(first.body.wasUpdate).toBe(false);
    const firstId = first.body.entry.id;

    const second = await request(app).post('/wellness/mood').set(userHeader(userId)).send({ ...payload, mood: 'great', note: 'edited' });
    expect(second.status).toBe(200);
    expect(second.body.wasUpdate).toBe(true);
    expect(second.body.entry.id).toBe(firstId); // same record, updated in place
    expect(second.body.entry.mood).toBe('great');

    const fetched = await request(app).get('/wellness/mood/2026-11-03').set(userHeader(userId));
    expect(fetched.body.entry.mood).toBe('great');
    expect(fetched.body.entry.note).toBe('edited');
  });

  it('computes trends from real stored data and distinguishes no-data from zero-value', async () => {
    const { app } = buildApp();
    const userIdEmpty = `test-${uuid()}`;
    const emptyTrends = await request(app).get('/wellness/mood/trends').set(userHeader(userIdEmpty));
    expect(emptyTrends.body.hasData).toBe(false);
    expect(emptyTrends.body.averageEnergy).toBeNull();

    const userId = `test-${uuid()}`;
    await request(app).post('/wellness/mood').set(userHeader(userId)).send({
      localDate: '2026-11-01', mood: 'low', emotions: ['sad', 'tired'], energy: 1, stress: 1, sleepQuality: 1,
    });
    await request(app).post('/wellness/mood').set(userHeader(userId)).send({
      localDate: '2026-11-02', mood: 'low', emotions: ['sad'], energy: 1, stress: 1, sleepQuality: 1,
    });

    const trends = await request(app).get('/wellness/mood/trends').set(userHeader(userId));
    expect(trends.body.hasData).toBe(true);
    expect(trends.body.checkInCount).toBe(2);
    expect(trends.body.averageEnergy).toBe(1); // real low-value stat, not absent
    expect(trends.body.moodDistribution.low).toBe(2);
    expect(trends.body.emotionFrequency.sad).toBe(2);
  });
});

describe('routes/wellness - journal', () => {
  it('supports create, edit, search/filter, favorite, and delete', async () => {
    const { app } = buildApp();
    const userId = `test-${uuid()}`;

    const created = await request(app).post('/wellness/journal').set(userHeader(userId))
      .send({ type: 'gratitude', content: 'Grateful for sunshine today.' });
    expect(created.status).toBe(201);
    const id = created.body.entry.id;

    const edited = await request(app).put(`/wellness/journal/${id}`).set(userHeader(userId)).send({ favorite: true });
    expect(edited.body.entry.favorite).toBe(true);

    const search = await request(app).get('/wellness/journal').set(userHeader(userId)).query({ q: 'sunshine' });
    expect(search.body.entries.length).toBe(1);

    const del = await request(app).delete(`/wellness/journal/${id}`).set(userHeader(userId));
    expect(del.status).toBe(200);
    const afterDelete = await request(app).get('/wellness/journal').set(userHeader(userId));
    expect(afterDelete.body.entries.length).toBe(0);
  });

  it('CRITICAL: refuses the AI insight call without explicit consent, and the AI provider sees zero calls', async () => {
    const { app, provider } = buildApp();
    const userId = `test-${uuid()}`;

    const created = await request(app).post('/wellness/journal').set(userHeader(userId))
      .send({ type: 'free-writing', content: 'Private thoughts that must never reach the AI without consent.' });
    const id = created.body.entry.id;

    const withoutConsent = await request(app).post('/wellness/journal/ai-insight').set(userHeader(userId))
      .send({ entryId: id, insightType: 'summary' }); // consent omitted
    expect(withoutConsent.status).toBe(403);
    expect(provider.callCount).toBe(0);

    const withFalseConsent = await request(app).post('/wellness/journal/ai-insight').set(userHeader(userId))
      .send({ entryId: id, insightType: 'summary', consent: false });
    expect(withFalseConsent.status).toBe(403);
    expect(provider.callCount).toBe(0);

    const withConsent = await request(app).post('/wellness/journal/ai-insight').set(userHeader(userId))
      .send({ entryId: id, insightType: 'summary', consent: true });
    expect(withConsent.status).toBe(200);
    expect(provider.callCount).toBe(1);
  });
});

describe('routes/wellness - breathing', () => {
  it('honestly records an abandoned session as incomplete, not discarded or faked as completed', async () => {
    const { app } = buildApp();
    const userId = `test-${uuid()}`;

    await request(app).post('/wellness/breathing/sessions').set(userHeader(userId)).send({
      technique: 'box', plannedDurationSeconds: 120, actualDurationSeconds: 35, completed: false,
    });
    await request(app).post('/wellness/breathing/sessions').set(userHeader(userId)).send({
      technique: 'box', plannedDurationSeconds: 120, actualDurationSeconds: 120, completed: true,
    });

    const stats = await request(app).get('/wellness/breathing/stats').set(userHeader(userId));
    expect(stats.body.totalSessions).toBe(2);
    expect(stats.body.completedSessions).toBe(1);
    expect(stats.body.abandonedSessions).toBe(1);
  });

  it('blocks a premium-only technique for free-tier users', async () => {
    const { app } = buildApp();
    const userId = `test-${uuid()}`;
    const res = await request(app).post('/wellness/breathing/sessions').set(userHeader(userId)).send({
      technique: '4-7-8', plannedDurationSeconds: 60, actualDurationSeconds: 60, completed: true,
    });
    expect(res.status).toBe(403);
  });
});

describe('routes/wellness - habits', () => {
  it('enforces the free-tier cap of 3 active habits', async () => {
    const { app } = buildApp();
    const userId = `test-${uuid()}`;
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).post('/wellness/habits').set(userHeader(userId)).send({ name: `Habit ${i}`, frequency: 'daily' });
      expect(res.status).toBe(201);
    }
    const fourth = await request(app).post('/wellness/habits').set(userHeader(userId)).send({ name: 'Habit 4', frequency: 'daily' });
    expect(fourth.status).toBe(403);
  });

  it('calculates streaks forgivingly: a missed day resets the current streak but never lowers the longest streak', async () => {
    const { app } = buildApp();
    const userId = `test-${uuid()}`;
    const created = await request(app).post('/wellness/habits').set(userHeader(userId)).send({ name: 'Walk', frequency: 'daily' });
    const habitId = created.body.habit.id;

    // Three consecutive days, then a gap, then one more day.
    await request(app).post(`/wellness/habits/${habitId}/complete`).set(userHeader(userId)).send({ localDate: '2026-10-01' });
    await request(app).post(`/wellness/habits/${habitId}/complete`).set(userHeader(userId)).send({ localDate: '2026-10-02' });
    await request(app).post(`/wellness/habits/${habitId}/complete`).set(userHeader(userId)).send({ localDate: '2026-10-03' });
    // missed 2026-10-04
    await request(app).post(`/wellness/habits/${habitId}/complete`).set(userHeader(userId)).send({ localDate: '2026-10-05' });

    const streak = await request(app).get(`/wellness/habits/${habitId}/streak`).set(userHeader(userId));
    expect(streak.body.longestStreak).toBe(3); // the historical 3-day run, never retroactively lowered
    expect(streak.body.currentStreak).not.toBe(3); // the gap means "today/yesterday" anchored streak differs
  });
});

describe('routes/wellness - challenges', () => {
  it('join/restart never silently wipes progress - restart requires explicit confirm', async () => {
    const { app } = buildApp();
    const userId = `test-${uuid()}`;

    const joined = await request(app).post('/wellness/challenges/7-day-gratitude/join').set(userHeader(userId)).send({});
    expect(joined.status).toBe(201);

    await request(app).post('/wellness/challenges/7-day-gratitude/complete-day').set(userHeader(userId)).send({ day: 1 });
    await request(app).post('/wellness/challenges/7-day-gratitude/complete-day').set(userHeader(userId)).send({ day: 2 });

    const progressBefore = await request(app).get('/wellness/challenges/progress/mine').set(userHeader(userId));
    expect(progressBefore.body.progress[0].completedDays).toEqual([1, 2]);

    const restartNoConfirm = await request(app).post('/wellness/challenges/7-day-gratitude/restart').set(userHeader(userId)).send({});
    expect(restartNoConfirm.status).toBe(400);
    const stillThere = await request(app).get('/wellness/challenges/progress/mine').set(userHeader(userId));
    expect(stillThere.body.progress[0].completedDays).toEqual([1, 2]); // untouched

    const restartConfirmed = await request(app).post('/wellness/challenges/7-day-gratitude/restart').set(userHeader(userId)).send({ confirm: true });
    expect(restartConfirmed.status).toBe(200);
    expect(restartConfirmed.body.progress.completedDays).toEqual([]); // explicitly wiped only now
  });

  it('blocks joining a premium-only challenge on the free tier', async () => {
    const { app } = buildApp();
    const userId = `test-${uuid()}`;
    const res = await request(app).post('/wellness/challenges/21-day-meditation/join').set(userHeader(userId)).send({});
    expect(res.status).toBe(403);
  });
});

describe('routes/wellness - AI companion crisis handling', () => {
  it('reuses containsCrisisLanguage/CRISIS_RESPONSE and never calls the AI provider on a crisis message', async () => {
    const { app, provider } = buildApp();
    const userId = `test-${uuid()}`;
    const crisisMessage = 'I want to kill myself';
    expect(containsCrisisLanguage(crisisMessage)).toBe(true);

    const res = await request(app).post('/wellness/ai-companion/message').set(userHeader(userId))
      .send({ conversationId: null, message: crisisMessage });
    expect(res.status).toBe(200);
    expect(res.body.crisisFlag).toBe(true);
    expect(res.body.reply).toBe(CRISIS_RESPONSE);
    expect(provider.callCount).toBe(0);
  });

  it('calls the AI provider for an ordinary message', async () => {
    const { app, provider } = buildApp();
    const userId = `test-${uuid()}`;
    const res = await request(app).post('/wellness/ai-companion/message').set(userHeader(userId))
      .send({ conversationId: null, message: 'How can I build a better evening routine?' });
    expect(res.status).toBe(200);
    expect(provider.callCount).toBe(1);
  });
});

describe('routes/wellness - analytics events never contain sensitive content', () => {
  it('records journal_entry_created with metadata only, never the entry text', async () => {
    const { app } = buildApp();
    const userId = `test-${uuid()}`;
    const secretText = 'this exact secret sentence must never appear in any analytics event';
    await request(app).post('/wellness/journal').set(userHeader(userId)).send({ type: 'daily', content: secretText });

    const events = wellnessAnalyticsEvents.filter((e) => e.userId === userId && e.type === 'journal_entry_created');
    expect(events.length).toBe(1);
    // Runtime assertion that no field on the event record contains the free-text content.
    const serialized = JSON.stringify(events[0]);
    expect(serialized.includes(secretText)).toBe(false);
    expect(Object.keys(events[0].data)).toEqual(['type']);
  });
});
