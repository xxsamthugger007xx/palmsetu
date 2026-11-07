import React from 'react';
import { StyleSheet, View } from 'react-native';
import { color } from '../theme/tokens';

type Props = {
  size?: number;
  length?: number;
};

/**
 * Four corner bracket framing marks (instrument-viewfinder look), overlaid
 * on capture/analysis frames in the Observatory redesign to suggest an
 * active scanning instrument rather than a plain photo frame.
 */
export function CornerBrackets({ size = 24, length = 20 }: Props) {
  const thickness = 2;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: thickness, borderLeftWidth: thickness, width: size, height: size }]} />
      <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: thickness, borderRightWidth: thickness, width: size, height: size }]} />
      <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: thickness, borderLeftWidth: thickness, width: size, height: size }]} />
      <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: thickness, borderRightWidth: thickness, width: size, height: size }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    borderColor: color.accent,
  },
});
