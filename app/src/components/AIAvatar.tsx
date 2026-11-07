import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { color } from '../theme/tokens';
import { Text } from './Text';
import { Gender } from '../context/UserProfileContext';

const palette: Record<Gender, { bg: string; border: string; fg: string }> = {
  woman: { bg: 'rgba(215, 199, 255, 0.14)', border: 'rgba(215, 199, 255, 0.4)', fg: color.highlight },
  man: { bg: color.secondaryMuted, border: 'rgba(102, 217, 195, 0.4)', fg: color.secondary },
  'non-binary': { bg: color.accentMuted, border: color.accentBorder, fg: color.accent },
  'prefer-not-to-say': { bg: color.surfaceElevated, border: color.border, fg: color.textSecondary },
};

type Props = {
  name: string;
  gender: Gender;
  size?: number;
  showBadge?: boolean;
};

/** A restrained, generated "AI avatar": initials on a tinted field, with a small
 * sparkle badge signaling it's AI-personalized rather than a real photo. */
export function AIAvatar({ name, gender, size = 72, showBadge = true }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const tones = palette[gender];
  const badgeSize = Math.max(18, size * 0.3);

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: tones.bg,
            borderColor: tones.border,
          },
        ]}
      >
        <Text style={{ fontSize: size * 0.38, color: tones.fg, fontWeight: '600' }}>{initial}</Text>
      </View>
      {showBadge && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
            },
          ]}
        >
          <Sparkles size={badgeSize * 0.55} color={color.bg} strokeWidth={2} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.bg,
  },
});
