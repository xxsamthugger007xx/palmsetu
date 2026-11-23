import { Router, Request } from 'express';
import { dailyActivityByKey } from '../data/store';
import { requestLocalDate } from '../util/localDate';
import { computeStreak } from '../streak/streak';

/**
 * Daily app streak: a day counts when the user opens the app (the app calls POST /streak/checkin once per launch).
 * "Day" is the user's own calendar day (X-Local-Date), not UTC. Guests get streaks too; they follow the account when
 * a guest signs up (the rows are keyed by user id and migrate with the rest of the guest data).
 */
export function buildStreakRouter() {
  const router = Router();
  const uid = (req: Request) => req.auth?.userId ?? 'demo-user';
  const daysFor = (userId: string) => dailyActivityByKey.valuesForUser(userId).map((a) => a.localDate);

  router.get('/', (req, res) => {
    res.json(computeStreak(daysFor(uid(req)), requestLocalDate(req)));
  });

  // Idempotent: calling it again the same day changes nothing.
  router.post('/checkin', (req, res) => {
    const userId = uid(req);
    const today = requestLocalDate(req);
    const key = `${userId}:${today}`;
    const already = dailyActivityByKey.has(key);
    if (!already) dailyActivityByKey.set(key, { userId, localDate: today, createdAt: new Date().toISOString() });
    res.json({ ...computeStreak(daysFor(userId), today), newlyCheckedIn: !already });
  });

  return router;
}
