import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { color, radius, spacing } from '../theme/tokens';
import { Text } from './Text';
import { Button } from './Button';

type Props = {
  visible: boolean;
  title: string;
  description: string;
  onClose: () => void;
  closeLabel?: string;
};

/** Themed single-button info popup - the dark-UI equivalent of a native
 * Alert.alert, for simple "here's a result/error" messages that don't need
 * a confirm/cancel choice (see ConfirmationModal for that case). Keeps
 * every in-app message looking like part of the app instead of a jarring
 * system dialog. */
export function InfoModal({ visible, title, description, onClose, closeLabel = 'OK' }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text variant="subtitle" weight="semibold">{title}</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
            {description}
          </Text>
          <Button label={closeLabel} fullWidth onPress={onClose} />
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
});
