import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { Button } from './Button';
import { color, radius, spacing } from '../theme/tokens';
import { StreakSummary } from '../services/streakApi';

type Props = {
  visible: boolean;
  streak: StreakSummary;
  onClose: () => void;
  onRemindersPress?: () => void;
};

/** Full-contrast themed popup for the streak flame in the header - a solid,
 * opaque sheet (not a translucent card floating over dimmed content) so it
 * reads clearly regardless of what's behind it. */
export function StreakDetailModal({ visible, streak, onClose, onRemindersPress }: Props) {
  const { t } = useTranslation();
  const alive = streak.current > 0;
  const message = streak.milestone
    ? t('streak.milestone', { n: streak.milestone })
    : streak.atRisk
      ? t('streak.atRisk')
      : alive
        ? t('streak.checkedIn')
        : t('streak.start');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.iconWrap}>
            <View style={styles.iconGlow} />
            <Flame size={36} color={alive ? color.gold : color.textMuted} strokeWidth={1.75} fill={alive ? color.gold : 'transparent'} />
          </View>

          <Text variant="display" weight="semibold" style={styles.bigNumber}>
            {streak.current} {t('streak.dayStreak')}
          </Text>
          <Text variant="bodySm" tone="secondary" style={styles.longest}>
            {t('streak.longest', { n: streak.longest })}
          </Text>

          <View style={styles.dots}>
            {streak.week.map((d, i) => (
              <View key={d.date} style={[styles.dot, d.done && styles.dotDone, i === streak.week.length - 1 && styles.dotToday]} />
            ))}
          </View>

          <Text variant="bodySm" style={[styles.message, streak.atRisk && { color: color.warning }]}>
            {message}
          </Text>

          {onRemindersPress && (
            <Text variant="bodySm" tone="accent" weight="semibold" accessibilityRole="button" onPress={onRemindersPress} style={styles.remindersLink}>
              {t('streak.turnOnReminders')}
            </Text>
          )}

          <Button label={t('common.ok', { defaultValue: 'Got it' })} onPress={onClose} fullWidth style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 4, 12, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: color.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.goldBorder,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconGlow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: color.goldMuted,
  },
  bigNumber: {
    textAlign: 'center',
    color: color.textPrimary,
  },
  longest: {
    textAlign: 'center',
    marginTop: 2,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.lg,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: color.border,
  },
  dotDone: {
    backgroundColor: color.gold,
  },
  dotToday: {
    borderWidth: 1.5,
    borderColor: color.textPrimary,
  },
  message: {
    textAlign: 'center',
    color: color.textPrimary,
    marginTop: spacing.lg,
    lineHeight: 20,
  },
  remindersLink: {
    marginTop: spacing.sm,
  },
});
