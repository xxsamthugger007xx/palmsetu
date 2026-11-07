import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { spacing } from '../theme/tokens';
import { Text } from './Text';

type Props = {
  title: string;
  action?: string;
  onActionPress?: () => void;
};

export function SectionHeader({ title, action, onActionPress }: Props) {
  return (
    <View style={styles.row}>
      <Text variant="subtitle" weight="semibold">{title}</Text>
      {action && (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text variant="bodySm" tone="accent">{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
});
