import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { color, radius, spacing } from '../../theme/tokens';
import { tarotColor } from '../../theme/tarotTheme';
import { BillingPeriod, SubscriptionPlan } from '../../types/billing';
import { formatRupees, periodSuffix } from './paywallData';

type Props = {
  plans: SubscriptionPlan[];
  selected: BillingPeriod;
  onSelect: (planId: BillingPeriod) => void;
};

/** The selectable plan cards (monthly / quarterly / annual). */
export function PlanCards({ plans, selected, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <>
      {plans.map((plan) => {
        const isSelected = plan.id === selected;
        const best = plan.badge === 'BEST_VALUE';
        return (
          <Pressable
            key={plan.id}
            accessibilityRole="radio"
            accessibilityLabel={`${plan.label}, ${formatRupees(plan.priceCents)} ${periodSuffix(plan.billingPeriod, t)}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(plan.id)}
            style={({ pressed }) => [pressed && { opacity: 0.9 }]}
          >
            <View style={[styles.planCard, isSelected && styles.planCardSelected]}>
              {plan.badge && (
                <View style={[styles.planBadge, best ? styles.badgeGold : styles.badgeLavender]}>
                  <Text variant="caption" weight="semibold" style={{ color: tarotColor.midnight, fontSize: 10 }}>
                    {best ? t('paywall.badge.bestValue') : t('paywall.badge.popular')}
                  </Text>
                </View>
              )}
              <View style={styles.planRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySm" weight="semibold">{plan.label}</Text>
                  <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                    {t('paywall.perMonthEquivalent', { price: formatRupees(plan.effectiveMonthlyCents) })}
                  </Text>
                  {plan.savingsPercentVsMonthly > 0 && (
                    <Text variant="caption" style={{ color: color.success, marginTop: 2 }} weight="semibold">
                      {t('paywall.save', { percent: plan.savingsPercentVsMonthly })}
                    </Text>
                  )}
                </View>
                <View style={styles.planRight}>
                  <Text variant="subtitle" weight="semibold">{formatRupees(plan.priceCents)}</Text>
                  <Text variant="caption" tone="muted">{periodSuffix(plan.billingPeriod, t)}</Text>
                </View>
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <Check size={12} color={tarotColor.midnight} strokeWidth={3} />}
                </View>
              </View>
            </View>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    padding: spacing.md,
    position: 'relative',
    overflow: 'visible',
  },
  planCardSelected: {
    borderColor: tarotColor.gold,
    backgroundColor: 'rgba(217, 184, 114, 0.08)',
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    left: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeGold: { backgroundColor: tarotColor.gold },
  badgeLavender: { backgroundColor: tarotColor.lavender },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planRight: {
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: tarotColor.gold,
    borderColor: tarotColor.gold,
  },
});
