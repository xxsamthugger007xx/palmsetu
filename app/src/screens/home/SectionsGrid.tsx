import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { StatusBadge } from '../../components/StatusBadge';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { sections } from './homeSections';

/** The "Explore" grid of feature tiles. */
export function SectionsGrid() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={styles.grid}>
      {sections.map((s) => (
        <Card key={s.id} style={styles.tile} onPress={() => s.navigate(navigation)}>
          <View style={styles.tileTop}>
            <View style={styles.tileIcon}>
              <s.icon size={18} color={color.accent} strokeWidth={1.75} />
            </View>
            {s.comingSoon && <StatusBadge label={t('common.comingSoon')} status="neutral" />}
          </View>
          <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.sm }}>{t(`home.sections.${s.id}.title`)}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t(`home.sections.${s.id}.description`)}</Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '47%',
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
