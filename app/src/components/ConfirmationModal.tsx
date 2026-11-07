import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { color, radius, spacing } from '../theme/tokens';
import { Text } from './Text';
import { Button } from './Button';

type Props = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationModal({
  visible,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text variant="subtitle" weight="semibold">{title}</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
            {description}
          </Text>
          <View style={styles.row}>
            <Button label="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
    maxWidth: 360,
    backgroundColor: color.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
