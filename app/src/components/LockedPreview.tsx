import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock } from 'lucide-react-native';
import { color, radius, spacing } from '../theme/tokens';

const BARS = [0.96, 0.9, 0.94, 0.62, 0.88, 0.7];

/**
 * A frosted "there is more here" preview of locked text. The locked paragraph itself never leaves the server, so this
 * is deliberately placeholder bars (not the real words): it shows how much is waiting, and fades into a lock.
 */
export function LockedPreview({ lines = 4 }: { lines?: number }) {
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {BARS.slice(0, lines).map((w, i) => (
        <View key={i} style={[styles.bar, { width: `${w * 100}%`, opacity: 1 - i * 0.12 }]} />
      ))}
      <LinearGradient colors={['rgba(14,11,31,0)', color.bg]} style={styles.fade} pointerEvents="none" />
      <View style={styles.lock}><Lock size={16} color={color.gold} strokeWidth={2} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm, paddingVertical: spacing.xs, overflow: 'hidden', borderRadius: radius.md },
  bar: { height: 9, borderRadius: 5, backgroundColor: 'rgba(233,233,237,0.16)', marginVertical: 5 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '30%' },
  lock: {
    position: 'absolute', alignSelf: 'center', bottom: 6, width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color.goldMuted, borderWidth: 1, borderColor: color.goldBorder,
  },
});
