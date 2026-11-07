import React from 'react';
import { StyleSheet, View } from 'react-native';
import { color, radius, spacing } from '../theme/tokens';
import { Text } from './Text';

type Status = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

const config: Record<Status, { bg: string; fg: string }> = {
  success: { bg: color.successMuted, fg: color.success },
  warning: { bg: color.warningMuted, fg: color.warning },
  danger: { bg: color.dangerMuted, fg: color.danger },
  neutral: { bg: color.surfaceElevated, fg: color.textSecondary },
  accent: { bg: color.accentMuted, fg: color.accent },
};

export function StatusBadge({ label, status = 'neutral' }: { label: string; status?: Status }) {
  const c = config[status];
  return (
    <View style={[styles.base, { backgroundColor: c.bg }]}>
      <Text variant="label" style={{ color: c.fg }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
});
