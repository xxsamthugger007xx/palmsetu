import React from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { color, spacing } from '../../theme/tokens';
import { PropertyType } from '../../types/vastu';
import { propertyTypes } from './vastuRooms';

/** Step A of the Vastu property form: pick apartment / house / office / shop / other. */
export function PropertyTypePicker({ value, onSelect }: { value: PropertyType; onSelect: (type: PropertyType) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>{t('ui.VastuPropertyFormScreen.propertyType')}</Text>
      <View style={styles.typeGrid}>
        {propertyTypes.map((t) => {
          const isSelected = value === t.id;
          return (
            <Card
              key={t.id}
              elevated={isSelected}
              style={[styles.typeCard, isSelected && styles.typeCardSelected]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onSelect(t.id);
              }}
            >
              <t.icon size={16} color={color.accent} strokeWidth={1.75} />
              <Text variant="caption" weight={isSelected ? 'semibold' : 'regular'} style={{ marginTop: 4 }}>{t.label}</Text>
            </Card>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: { width: '30%', alignItems: 'center', paddingVertical: spacing.sm },
  typeCardSelected: { borderColor: color.accentBorder },
});
