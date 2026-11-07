import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { color, radius, spacing } from '../../theme/tokens';

type Props = {
  icon: LucideIcon;
  label: string;
  description?: string;
  destructive?: boolean;
  onPress?: () => void;
};

export function SettingsRow({ icon: Icon, label, description, destructive, onPress }: Props) {
  return (
    <Card onPress={onPress} style={styles.row} padded={false}>
      <View style={styles.inner}>
        <View style={[styles.iconWrap, destructive && styles.iconWrapDanger]}>
          <Icon size={16} color={destructive ? color.danger : color.textSecondary} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text variant="bodySm" weight="medium" tone={destructive ? 'danger' : 'primary'}>{label}</Text>
          {description && <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{description}</Text>}
        </View>
        <ChevronRight size={16} color={color.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 1,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDanger: {
    backgroundColor: color.dangerMuted,
  },
});
