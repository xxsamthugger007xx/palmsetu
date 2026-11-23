import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { computeStreak } from './streak';
import { buildStreakRouter } from '../routes/streak';
import { attachAuthContext } from '../auth/middleware';
import { signGuestToken } from '../auth/tokens';
import { migrateGuestDataToAccount } from '../auth/guestMigration';
import { dailyActivityByKey } from '../data/store';

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    const s = computeStreak(['2026-11-22', '2026-11-23', '2026-11-24'], '2026-11-24');
    expect(s).toMatchObject({ current: 3, longest: 3, totalDays: 3, checkedInToday: true, atRisk: false, milestone: 3 });
    expect(s.week.map((d) => d.done)).toEqual([false, false, false, false, true, true, true]);
  });
  it('keeps the streak alive (but at risk) until the day actually passes', () => {
    const s = computeStreak(['2026-11-22', '2026-11-23'], '2026-11-24');
    expect(s).toMatchObject({ current: 2, checkedInToday: false, atRisk: true, milestone: null });
  });
  it('resets after a missed day but remembers the longest run', () => {
    const s = computeStreak(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-23'], '2026-11-24');
    expect(s).toMatchObject({ current: 1, longest: 4, atRisk: true });
    expect(computeStreak(['2026-11-10', '2026-11-11'], '2026-11-24')).toMatchObject({ current: 0, atRisk: false });
  });
  it('handles month and year boundaries and ignores duplicates', () => {
    expect(computeStreak(['2025-12-31', '2026-01-01', '2026-01-01'], '2026-01-01')).toMatchObject({ current: 2, totalDays: 2 });
    expect(computeStreak([], '2026-11-24')).toMatchObject({ current: 0, longest: 0, atRisk: false, milestone: null });
  });
});

const app = express();
app.use(express.json()); app.use(attachAuthContext); app.use('/streak', buildStreakRouter());
const auth = (id: string) => ({ Authorization: `Bearer ${signGuestToken(id)}` });
const today = () => new Date().toISOString().slice(0, 10);

describe('POST /streak/checkin', () => {
  it('is idempotent within a day and uses the caller\'s own day', async () => {
    const id = `guest-${uuid()}`;
    const first = await request(app).post('/streak/checkin').set(auth(id)).send({});
    expect(first.body).toMatchObject({ current: 1, newlyCheckedIn: true, checkedInToday: true });
    const again = await request(app).post('/streak/checkin').set(auth(id)).send({});
    expect(again.body).toMatchObject({ current: 1, newlyCheckedIn: false, totalDays: 1 });
    const get = await request(app).get('/streak').set(auth(id));
    expect(get.body.current).toBe(1);
    // a user in a timezone ahead of UTC records their own (later) date
    const tomorrow = new Date(Date.parse(`${today()}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const ahead = await request(app).post('/streak/checkin').set(auth(id)).set('X-Local-Date', tomorrow).send({});
    expect(ahead.body).toMatchObject({ current: 2, newlyCheckedIn: true });
  });
  it('a guest keeps their streak days when they sign up', () => {
    const guest = `guest-${uuid()}`, acct = `user-${uuid()}`;
    dailyActivityByKey.set(`${guest}:2026-11-23`, { userId: guest, localDate: '2026-11-23', createdAt: 'x' });
    dailyActivityByKey.set(`${acct}:2026-11-24`, { userId: acct, localDate: '2026-11-24', createdAt: 'x' });
    migrateGuestDataToAccount(guest, acct);
    expect(dailyActivityByKey.valuesForUser(acct).map((a) => a.localDate).sort()).toEqual(['2026-11-23', '2026-11-24']);
    expect(dailyActivityByKey.valuesForUser(guest)).toEqual([]);
  });
});
