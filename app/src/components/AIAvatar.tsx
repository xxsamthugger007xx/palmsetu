import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { color } from '../theme/tokens';
import { Text } from './Text';
import { Gender } from '../context/UserProfileContext';
import { MALE_AVATARS, FEMALE_AVATARS, avatarSourceForKey } from '../theme/avatars';

const palette: Record<Gender, { bg: string; border: string; fg: string }> = {
  woman: { bg: 'rgba(215, 199, 255, 0.14)', border: 'rgba(215, 199, 255, 0.4)', fg: color.highlight },
  man: { bg: color.secondaryMuted, border: 'rgba(102, 217, 195, 0.4)', fg: color.secondary },
  'non-binary': { bg: color.accentMuted, border: color.accentBorder, fg: color.accent },
  'prefer-not-to-say': { bg: color.surfaceElevated, border: color.border, fg: color.textSecondary },
};

type Props = {
  name: string;
  gender: Gender;
  /** Picks the actual illustrated avatar within this gender's array (see
   * theme/avatars.ts) via `avatarIndex % array.length`. Undefined/null, or
   * a gender with no image set (non-binary/prefer-not-to-say), falls back
   * to the initials circle below. */
  avatarIndex?: number | null;
  /** An explicit user choice (see theme/avatars.ts's AVATAR_CHOICES),
   * picked from the full set regardless of gender - takes priority over
   * avatarIndex when set, since it reflects a deliberate pick the user
   * made in the Profile "change avatar" picker. */
  avatarKey?: string | null;
  size?: number;
  showBadge?: boolean;
};

/** A restrained "AI avatar": a static illustrated image (either explicitly
 * chosen by the user, or picked once automatically from their gender's
 * set), or initials on a tinted field as a fallback - either way with a
 * small sparkle badge signaling it's AI-personalized rather than a real
 * photo. */
export function AIAvatar({ name, gender, avatarIndex, avatarKey, size = 72, showBadge = true }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const tones = palette[gender];
  const badgeSize = Math.max(18, size * 0.3);

  const images = gender === 'man' ? MALE_AVATARS : gender === 'woman' ? FEMALE_AVATARS : [];
  const image = avatarSourceForKey(avatarKey) ?? (avatarIndex != null && images.length > 0 ? images[avatarIndex % images.length] : null);

  return (
    <View style={{ width: size, height: size }}>
      {image ? (
        <Image
          source={image}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
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
      )}
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
