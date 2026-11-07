import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { HeadingSmoother } from '../utils/compass';

export type CompassAvailability = 'checking' | 'available' | 'unavailable' | 'permission-denied';

/**
 * Reads live device heading via expo-location's watchHeadingAsync, which uses
 * the OS's own sensor-fusion (accelerometer + magnetometer + gyroscope where
 * available) rather than a hand-rolled raw-magnetometer formula - this is what
 * actually gives a correct, stable heading instead of an approximate, easily
 * wrong one. It requires foreground location permission as a platform
 * technicality to access the heading sensor, but this app never reads, stores,
 * or transmits GPS coordinates - only the compass heading itself is used.
 *
 * A light 2-sample smoothing window is used (not more) specifically to avoid
 * the laggy feel of over-smoothing - the OS heading is already fused/filtered,
 * so heavy additional smoothing here only adds perceptible delay.
 */
export function useCompassHeading() {
  const [availability, setAvailability] = useState<CompassAvailability>('checking');
  const [heading, setHeading] = useState<number | null>(null);
  const [lowAccuracy, setLowAccuracy] = useState(false);
  const smoother = useRef(new HeadingSmoother(2));

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    if (Platform.OS === 'web') {
      setAvailability('unavailable');
      return;
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setAvailability('permission-denied');
          return;
        }

        subscription = await Location.watchHeadingAsync((data) => {
          const raw = data.trueHeading >= 0 ? data.trueHeading : data.magHeading;
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            const smoothed = smoother.current.push(raw);
            if (smoothed !== null) setHeading(smoothed);
          }
          if (Platform.OS === 'ios') {
            setLowAccuracy(data.accuracy < 0 || data.accuracy > 15);
          } else {
            setLowAccuracy(data.accuracy >= 0 && data.accuracy <= 1);
          }
        });
        setAvailability('available');
      } catch {
        if (!cancelled) setAvailability('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return { availability, heading, lowAccuracy };
}
