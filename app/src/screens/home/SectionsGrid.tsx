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
import { sections, orderSectionsForFocus } from './homeSections';
import { useUserProfile } from '../../context/UserProfileContext';

/** The "Explore" grid of feature tiles. */
const GROUPS: { key: string; ids: string[] }[] = [
  { key: 'readings', ids: ['palm', 'tarot', 'astrology', 'western'] },
  { key: 'daily', ids: ['dailyreport', 'moonsign'] },
  { key: 'connection', ids: ['lovetest', 'soulmate'] },
  { key: 'tools', ids: ['aichat', 'myreports'] },
];

/** The "Explore" tiles, grouped under small headings. Groups (and tiles inside them) lead with what the person said they care about. */
export function SectionsGrid() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useUserProfile();
  const ordered = orderSectionsForFocus(sections, profile?.focus);
  const rank = (ids: string[]) => Math.min(...ids.map((id) => ordered.findIndex((s) => s.id === id)).filter((i) => i >= 0), 999);
  const groups = [...GROUPS].sort((x, y) => rank(x.ids) - rank(y.ids));
  return (
    <View>
      {groups.map((g) => {
        const tiles = ordered.filter((s) => g.ids.includes(s.id));
        if (tiles.length === 0) return null;
        return (
          <View key={g.key} style={{ marginBottom: spacing.md }}>
            <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>{t(`home.groups.${g.key}`)}</Text>
            <View style={styles.grid}>
              {tiles.map((s) => (
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
          </View>
        );
      })}
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
