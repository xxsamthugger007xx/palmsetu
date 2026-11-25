import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True when the phone's "reduce motion" accessibility setting is on: decorative animations should then stay still. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => sub?.remove?.();
  }, []);
  return reduce;
}
