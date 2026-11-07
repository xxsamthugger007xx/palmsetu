import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { color, radius, spacing } from '../theme/tokens';
import { Text } from './Text';
import { Button } from './Button';

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Icon size={22} color={color.textMuted} strokeWidth={1.5} />
      </View>
      <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.md }}>{title}</Text>
      {description && (
        <Text variant="caption" tone="muted" style={{ marginTop: 4, textAlign: 'center', maxWidth: 260 }}>
          {description}
        </Text>
      )}
      {actionLabel && (
        <Button label={actionLabel} variant="secondary" size="sm" onPress={onAction} style={{ marginTop: spacing.md }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
