import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { deviceLocalDate } from '../services/apiRequest';
import { streakApi, StreakSummary } from '../services/streakApi';
import { applyEngagementReminders, loadEngagementPrefs } from '../services/notificationScheduler';
import { useAuth } from '../context/AuthContext';

// Remembers which user + day has already been checked in during this launch, so focusing screens doesn't re-post.
let checkedIn: string | null = null;

/**
 * Records today's visit (once per user per day) and returns the daily streak. Each real check-in also refreshes the
 * local reminders, so "keep your streak" is always scheduled for tomorrow and a person who opens the app daily never
 * receives it. Errors are swallowed into `failed`: a streak is a nicety and must never break the screen showing it.
 */
export function useDailyStreak() {
  const { account, isGuest } = useAuth();
  const userKey = isGuest ? 'guest' : account?.id ?? 'guest';
  const [streak, setStreak] = useState<StreakSummary | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const marker = `${userKey}:${deviceLocalDate()}`;
    try {
      const res = checkedIn === marker ? await streakApi.get() : await streakApi.checkin();
      const firstToday = checkedIn !== marker;
      checkedIn = marker;
      setStreak(res);
      setFailed(false);
      if (firstToday) applyEngagementReminders(await loadEngagementPrefs(), res.current).catch(() => {});
    } catch {
      setFailed(true);
    }
  }, [userKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  return { streak, failed, reload: load };
}
