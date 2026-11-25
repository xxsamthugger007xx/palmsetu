import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';

/** Fades its children in while sliding up a few pixels. Use `delay` (ms) to stagger a list of cards. */
export function FadeInUp({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const still = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [still]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
