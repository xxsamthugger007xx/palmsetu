import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { color } from '../theme/tokens';

const ICON = require('../../assets/icon.png');

type Props = {
  ready: boolean;
  onFinished: () => void;
  children: React.ReactNode;
};

/**
 * JS-level splash shown over the app until `ready` (fonts loaded, min
 * duration elapsed). Runs a loop of a soft pulse + scanning line on the
 * icon, then fades out into the real app underneath.
 */
export function AnimatedSplash({ ready, onFinished, children }: Props) {
  const [showOverlay, setShowOverlay] = useState(true);

  const iconScale = useRef(new Animated.Value(0.85)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const scanY = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 6,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scanY, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    scanLoop.start();

    return () => {
      pulseLoop.stop();
      scanLoop.stop();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 420,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowOverlay(false);
      onFinished();
    });
  }, [ready]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const pulseGlow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });
  const scanTranslate = scanY.interpolate({ inputRange: [0, 1], outputRange: [-70, 70] });

  return (
    <View style={{ flex: 1 }}>
      {children}
      {showOverlay && (
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, { opacity: overlayOpacity }]}
        >
          <Animated.View
            style={[
              styles.glow,
              { opacity: pulseGlow, transform: [{ scale: pulseScale }] },
            ]}
          />
          <Animated.View
            style={[
              styles.iconWrap,
              { opacity: iconOpacity, transform: [{ scale: iconScale }] },
            ]}
          >
            <Image source={ICON} accessible={false} style={styles.icon} resizeMode="contain" />
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateY: scanTranslate }] }]}
            />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const ICON_SIZE = 112;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: ICON_SIZE * 2.4,
    height: ICON_SIZE * 2.4,
    borderRadius: ICON_SIZE * 1.2,
    backgroundColor: color.accent,
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 28,
    overflow: 'hidden',
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
