import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { radius, spacing } from '../theme/tokens';
import { tarotColor } from '../theme/tarotTheme';

const FADED_BARS = [0.95, 0.88, 0.93, 0.6];

/**
 * "This is what Premium adds": a clearly labelled EXAMPLE report. The first lines are readable, the rest fades into a lock
 * so people can see how much more there is. It is sample wording, never anyone's real reading.
 */
export function ReportSampleCard() {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.tag}>
        <Crown size={11} color={tarotColor.midnight} strokeWidth={2.2} />
        <Text variant="caption" weight="semibold" style={{ color: tarotColor.midnight, marginLeft: 4, fontSize: 10 }}>{t('paywall.sample.tag')}</Text>
      </View>
      <Text variant="title" weight="semibold" style={{ marginTop: spacing.sm }}>{t('paywall.sample.title')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>{t('paywall.sample.opening')}</Text>
      <View style={{ marginTop: spacing.sm }}>
        {FADED_BARS.map((w, i) => <View key={i} style={[styles.bar, { width: `${w * 100}%`, opacity: 1 - i * 0.14 }]} />)}
        <LinearGradient colors={['rgba(42,34,80,0)', tarotColor.indigo]} style={styles.fade} pointerEvents="none" />
        <View style={styles.lock}><Lock size={16} color={tarotColor.gold} strokeWidth={2} /></View>
      </View>
      <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{t('paywall.sample.note')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(217,184,114,0.3)',
    overflow: 'hidden',
  },
  tag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: tarotColor.gold, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  bar: { height: 9, borderRadius: 5, backgroundColor: 'rgba(233,233,237,0.2)', marginVertical: 5 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '25%' },
  lock: { position: 'absolute', alignSelf: 'center', bottom: 2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(217,184,114,0.18)', borderWidth: 1, borderColor: 'rgba(217,184,114,0.45)' },
});
