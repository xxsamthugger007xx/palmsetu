import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { color, radius, spacing } from '../../theme/tokens';
import { tarotColor } from '../../theme/tarotTheme';
import { BENEFIT_CATEGORIES } from './paywallData';

/** The expandable "Everything included in Premium" cards. Owns its own expanded state. */
export function BenefitsList() {
  const { t } = useTranslation();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const toggle = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      {BENEFIT_CATEGORIES.map((cat) => {
        const isExpanded = expandedKey === cat.key;
        const Icon = cat.icon;
        const title = t(`paywall.benefits.${cat.key}.title`);
        return (
          <Pressable
            key={cat.key}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ expanded: isExpanded }}
            onPress={() => toggle(cat.key)}
            style={styles.benefitCard}
          >
            <View style={styles.benefitHeaderRow}>
              <View style={styles.benefitIconWrap}>
                <Icon size={18} color={tarotColor.gold} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="bodySm" weight="semibold">{title}</Text>
                <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>{t(`paywall.benefits.${cat.key}.tagline`)}</Text>
              </View>
              <ChevronDown
                size={16}
                color={color.textSecondary}
                style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
              />
            </View>
            {isExpanded && (
              <View style={styles.benefitPoints}>
                {Array.from({ length: cat.pointCount }, (_, i) => (
                  <View key={i} style={styles.benefitPointRow}>
                    <Check size={13} color={tarotColor.lavender} strokeWidth={2.5} style={{ marginTop: 2 }} />
                    <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.xs, flex: 1 }}>{t(`paywall.benefits.${cat.key}.p${i + 1}`)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  benefitCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: tarotColor.goldMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  benefitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(217, 184, 114, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitPoints: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  benefitPointRow: {
    flexDirection: 'row',
  },
});
