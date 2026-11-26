import React from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { color, radius, spacing } from '../theme/tokens';
import { Text } from './Text';
import { Button } from './Button';
import { AVATAR_CHOICES } from '../theme/avatars';

type Props = {
  visible: boolean;
  /** The currently-active choice, if any (so it can be highlighted). */
  selectedKey?: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
};

/** Lets the user pick any of the 10 illustrated avatars, regardless of
 * their own gender - distinct from the automatic default assignment (see
 * AIAvatar.tsx), which only picks from the user's own gender's set. */
export function AvatarPickerModal({ visible, selectedKey, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text variant="subtitle" weight="semibold">Choose your avatar</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
            Pick any of these - no need to match your own gender.
          </Text>
          <View style={styles.grid}>
            {AVATAR_CHOICES.map((choice) => {
              const active = choice.key === selectedKey;
              return (
                <Pressable
                  key={choice.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Avatar ${choice.key}`}
                  onPress={() => onSelect(choice.key)}
                  style={[styles.thumbWrap, active && styles.thumbWrapActive]}
                >
                  <Image source={choice.source} style={styles.thumb} accessibilityIgnoresInvertColors />
                  {active && (
                    <View style={styles.checkBadge}>
                      <Check size={12} color={color.bg} strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          <Button label="Done" fullWidth onPress={onClose} style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    </Modal>
  );
}

const THUMB_SIZE = 64;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: color.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: color.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbWrapActive: {
    borderColor: color.accent,
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: THUMB_SIZE / 2,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.surfaceElevated,
  },
});
