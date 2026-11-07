import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { spacing } from '../theme/tokens';
import { color } from '../theme/tokens';
import { Text } from './Text';
import { IconButton } from './Button';
import { AIAvatar } from './AIAvatar';
import { Gender } from '../context/UserProfileContext';

type Props = {
  greeting: string;
  name: string;
  gender: Gender;
  onAvatarPress?: () => void;
  onNotificationsPress?: () => void;
  hasNotifications?: boolean;
};

export function AppHeader({ greeting, name, gender, onAvatarPress, onNotificationsPress, hasNotifications }: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onAvatarPress} style={styles.identity}>
        <AIAvatar name={name} gender={gender} size={48} />
        <View style={{ marginLeft: spacing.md }}>
          <Text variant="bodySm" tone="secondary">{greeting}</Text>
          <Text variant="display" weight="semibold">{name}</Text>
        </View>
      </Pressable>
      <View>
        <IconButton icon={Bell} onPress={onNotificationsPress} tone={color.textSecondary} />
        {hasNotifications && <View style={styles.dot} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: color.secondary,
    borderWidth: 1.5,
    borderColor: color.bg,
  },
});
