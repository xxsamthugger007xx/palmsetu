import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { color } from '../theme/tokens';

type Props = {
  style?: StyleProp<ViewStyle>;
};

/**
 * Nocturne signature divider: a hairline rule that fades to transparent at
 * both ends instead of stopping with a hard edge, used in place of a flat
 * 1px separator line throughout the Observatory redesign.
 */
export function FadeDivider({ style }: Props) {
  return (
    <LinearGradient
      colors={[color.dividerFadeEdge, color.dividerFadeCenter, color.dividerFadeEdge]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[{ height: 1, width: '100%' }, style]}
    />
  );
}
