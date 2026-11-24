import { useEffect, useState } from 'react';
import { billingApi } from '../services/billingApi';
import { useAuth } from '../context/AuthContext';

/**
 * Whether the signed-in (or guest) account currently has Premium, so "Upgrade" prompts can be hidden for people who
 * already pay. `refreshKey` re-checks when it changes (pass the current route name, so buying Premium updates the UI as
 * soon as the person lands back on a screen). Defaults to false while loading or if the check fails, which just keeps the
 * prompt visible; the server enforces access regardless.
 */
export function useIsPremium(refreshKey?: string): boolean {
  const { account, isGuest } = useAuth();
  const userKey = isGuest ? 'guest' : account?.id ?? 'guest';
  const [premium, setPremium] = useState(false);

  useEffect(() => {
    let cancelled = false;
    billingApi.getStatus()
      .then((b) => { if (!cancelled) setPremium(b.tier === 'premium'); })
      .catch(() => { if (!cancelled) setPremium(false); });
    return () => { cancelled = true; };
  }, [userKey, refreshKey]);

  return premium;
}
