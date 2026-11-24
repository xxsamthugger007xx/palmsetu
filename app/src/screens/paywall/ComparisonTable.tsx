import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { radius, spacing } from '../../theme/tokens';
import { tarotColor } from '../../theme/tarotTheme';
import { COMPARISON_ROW_KEYS } from './paywallData';

/** The "Free vs Premium" table. */
export function ComparisonTable() {
  const { t } = useTranslation();
  return (
    <View style={styles.comparisonCard}>
      <View style={styles.comparisonHeaderRow}>
        <Text variant="caption" tone="muted" style={{ flex: 1.6 }}> </Text>
        <Text variant="caption" tone="secondary" weight="semibold" style={styles.comparisonCol}>{t('paywall.compare.freeHeader')}</Text>
        <Text variant="caption" style={[styles.comparisonCol, { color: tarotColor.gold }]} weight="semibold">{t('paywall.compare.premiumHeader')}</Text>
      </View>
      {COMPARISON_ROW_KEYS.map((key) => (
        <View key={key} style={styles.comparisonRow}>
          <Text variant="caption" tone="secondary" style={{ flex: 1.6 }}>{t(`paywall.compare.${key}.label`)}</Text>
          <Text variant="caption" tone="secondary" style={styles.comparisonCol}>{t(`paywall.compare.${key}.free`)}</Text>
          <Text variant="caption" weight="semibold" style={[styles.comparisonCol, { color: tarotColor.gold }]}>{t(`paywall.compare.${key}.premium`)}</Text>
        </View>
      ))}
      <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{t('paywall.compare.fairUse')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  comparisonCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  comparisonHeaderRow: {
    flexDirection: 'row',
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  comparisonCol: {
    flex: 1,
    textAlign: 'right',
  },
});
