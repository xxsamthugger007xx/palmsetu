import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, ViewProps } from 'react-native';
import { color, radius, spacing } from '../theme/tokens';

type Props = ViewProps & {
  elevated?: boolean;
  padded?: boolean;
  onPress?: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({ elevated = false, padded = true, style, children, onPress, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const press = (to: number) => Animated.spring(scale, { toValue: to, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { setPressed(true); press(0.97); }}
        onPressOut={() => { setPressed(false); press(1); }}
        accessibilityRole="button"
        style={[
          styles.base,
          elevated ? styles.elevated : styles.flat,
          padded && styles.padded,
          pressed && styles.pressed,
          style as any,
          { transform: [{ scale }] },
        ]}
        {...(rest as any)}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View
      style={[styles.base, elevated ? styles.elevated : styles.flat, padded && styles.padded, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  flat: {
    backgroundColor: color.surface,
    borderColor: color.border,
  },
  elevated: {
    backgroundColor: color.surfaceElevated,
    borderColor: color.border,
  },
  padded: {
    padding: spacing.md,
  },
  pressed: {
    backgroundColor: color.surfaceHover,
  },
});
