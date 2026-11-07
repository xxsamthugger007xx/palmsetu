import React from 'react';
import { Pressable, StyleSheet, View, ViewProps } from 'react-native';
import { color, radius, spacing } from '../theme/tokens';

type Props = ViewProps & {
  elevated?: boolean;
  padded?: boolean;
  onPress?: () => void;
};

export function Card({ elevated = false, padded = true, style, children, onPress, ...rest }: Props) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.base,
          elevated ? styles.elevated : styles.flat,
          padded && styles.padded,
          pressed && styles.pressed,
          style as any,
        ]}
        {...(rest as any)}
      >
        {children}
      </Pressable>
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
