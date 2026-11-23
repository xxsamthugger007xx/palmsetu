import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CloudOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { color, radius, spacing } from '../theme/tokens';
import { Text } from './Text';
import { Button } from './Button';

type Props = {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/** Full-block "couldn't load" state with a retry button, for screens whose main content failed to load. */
export function ErrorState({ message, onRetry, retryLabel }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.root} accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <CloudOff size={22} color={color.textMuted} strokeWidth={1.5} />
      </View>
      <Text variant="bodySm" tone="secondary" style={styles.message}>{message ?? t('errors.loadFailed')}</Text>
      {onRetry && <Button label={retryLabel ?? t('errors.tryAgain')} variant="secondary" size="sm" onPress={onRetry} style={{ marginTop: spacing.md }} />}
    </View>
  );
}

/** Slim inline banner for dashboards where only some sections failed; the rest of the screen stays usable. */
export function ErrorBanner({ message = "Some content couldn't be loaded.", onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <CloudOff size={16} color={color.warning} strokeWidth={1.75} />
      <Text variant="caption" style={{ color: color.warning, flex: 1, marginLeft: spacing.sm }}>{message}</Text>
      {onRetry && <Text variant="caption" tone="accent" weight="semibold" onPress={onRetry} accessibilityRole="button">{t('ui.AstrologyLandingScreen.retry')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: color.surfaceElevated,
    borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center',
  },
  message: { marginTop: spacing.md, textAlign: 'center', maxWidth: 280 },
  banner: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.sm, marginBottom: spacing.md,
    borderRadius: radius.sm, backgroundColor: color.warningMuted,
  },
});
