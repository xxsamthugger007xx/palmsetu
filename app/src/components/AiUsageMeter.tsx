import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Card } from './Card';
import { Text } from './Text';
import { color, radius, spacing } from '../theme/tokens';
import { billingApi } from '../services/billingApi';
import { AiBudgetStatus } from '../types/billing';

function formatInr(n: number) {
  return `₹${n.toFixed(n >= 10 ? 0 : 2)}`;
}

function formatResetDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(i18n.language || undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Monthly AI allowance meter for Premium users. Renders nothing for free users
 * (they are limited per feature instead) and nothing if the status can't be loaded.
 */
export function AiUsageMeter({ style }: { style?: object }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AiBudgetStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      billingApi.getAiBudget().then((s) => active && setStatus(s)).catch(() => active && setStatus(null));
      return () => { active = false; };
    }, [])
  );

  if (!status?.capped || status.limitInr == null) return null;

  const pct = Math.min(1, status.usedInr / status.limitInr);
  const exhausted = pct >= 1;
  const low = pct >= 0.8;
  const barColor = exhausted ? color.danger : low ? color.warning : color.accent;

  return (
    <Card elevated style={style}>
      <View style={styles.row}>
        <Text variant="bodySm" weight="semibold">{t('ui.AiUsageMeter.monthlyAiUsage')}</Text>
        <Text variant="caption" tone="muted">{t('aiMeter.used', { used: formatInr(status.usedInr), limit: formatInr(status.limitInr) })}</Text>
      </View>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('ui.AiUsageMeter.monthlyAiUsage')}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      >
        <View style={[styles.fill, { width: `${Math.max(pct * 100, pct > 0 ? 2 : 0)}%`, backgroundColor: barColor }]} />
      </View>
      <Text
        variant="caption"
        style={{ marginTop: spacing.xs, color: exhausted ? color.danger : low ? color.warning : color.textMuted }}
      >
        {exhausted
          ? t('aiMeter.exhausted', { date: formatResetDate(status.resetsOn) })
          : low
            ? t('aiMeter.low', { left: formatInr(status.remainingInr ?? 0), date: formatResetDate(status.resetsOn) })
            : t('aiMeter.left', { left: formatInr(status.remainingInr ?? 0), date: formatResetDate(status.resetsOn) })}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.border,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
