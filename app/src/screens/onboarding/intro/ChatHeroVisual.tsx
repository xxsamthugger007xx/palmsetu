import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { color, radius, spacing } from '../../../theme/tokens';

/** Original vector composition: a minimal chat-bubble mockup over a soft glow,
 * representing the AI companion conversation rather than a literal phone photo. */
export function ChatHeroVisual({ size = 240 }: { size?: number }) {
  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <LinearGradient colors={[color.surfaceElevated, color.surface]} style={StyleSheet.absoluteFill} />
      <View style={styles.glow} />

      <View style={styles.bubbleColumn}>
        <View style={[styles.bubble, styles.assistantBubble]}>
          <Sparkles size={14} color={color.accent} strokeWidth={1.75} />
          <View style={styles.bubbleLine} />
        </View>
        <View style={[styles.bubble, styles.userBubble]}>
          <View style={[styles.bubbleLine, { width: 40 }]} />
        </View>
        <View style={[styles.bubble, styles.assistantBubble, { width: '70%' }]}>
          <Sparkles size={14} color={color.accent} strokeWidth={1.75} />
          <View style={[styles.bubbleLine, { width: 60 }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: 999,
    backgroundColor: color.accentMuted,
    opacity: 0.5,
  },
  bubbleColumn: {
    width: '70%',
    gap: spacing.sm,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: color.surface,
    borderColor: color.accentBorder,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: color.accentMuted,
    borderColor: color.accentBorder,
  },
  bubbleLine: {
    width: 70,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.border,
  },
});
