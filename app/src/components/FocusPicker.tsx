import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Heart, Briefcase, Coins, Leaf, Users, Sprout, LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { Card } from './Card';
import { color, spacing } from '../theme/tokens';
import { FOCUS_AREAS, FocusArea } from '../types/astrology';

const ICONS: Record<FocusArea, LucideIcon> = { love: Heart, career: Briefcase, money: Coins, health: Leaf, family: Users, growth: Sprout };
export const MAX_FOCUS = 3;

/** "What do you want guidance on?" - pick up to three areas. Controlled: the parent owns the selection. */
export function FocusPicker({ value, onChange }: { value: FocusArea[]; onChange: (next: FocusArea[]) => void }) {
  const { t } = useTranslation();
  const toggle = (f: FocusArea) => {
    if (value.includes(f)) onChange(value.filter((x) => x !== f));
    else if (value.length < MAX_FOCUS) onChange([...value, f]);
  };
  return (
    <View>
      <Text variant="label" tone="muted">{t('focus.title')}</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.sm }}>{t('focus.hint', { n: MAX_FOCUS })}</Text>
      <View style={styles.grid}>
        {FOCUS_AREAS.map((f) => {
          const on = value.includes(f);
          const Icon = ICONS[f];
          return (
            <Card
              key={f}
              onPress={() => toggle(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(`focus.areas.${f}`)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Icon size={16} color={on ? color.accent : color.textMuted} strokeWidth={1.75} />
              <Text variant="bodySm" weight={on ? 'semibold' : 'regular'} tone={on ? 'primary' : 'secondary'} style={{ marginLeft: spacing.xs }}>
                {t(`focus.areas.${f}`)}
              </Text>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: color.border },
  chipOn: { borderColor: color.accent, backgroundColor: color.accentMuted },
});
