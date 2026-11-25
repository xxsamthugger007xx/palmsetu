import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { color } from '../theme/tokens';

/** The assistant's face: the little robot in the crystal ball, in a thin gold ring. */
export function AssistantAvatar({ size = 36 }: { size?: number }) {
  return (
    <View style={[styles.ring, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}>
      <Image source={require('../../assets/assistant/avatar.webp')} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 1.5, borderColor: color.goldBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
});
