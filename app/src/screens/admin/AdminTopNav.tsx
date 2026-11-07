import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../components/Text';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';

const TABS: { label: string; route: keyof RootStackParamList }[] = [
  { label: 'Overview', route: 'AdminOverview' },
  { label: 'Users', route: 'AdminUsers' },
  { label: 'Features', route: 'AdminFeatures' },
  { label: 'System', route: 'AdminSystem' },
];

export function AdminTopNav({ active }: { active: keyof RootStackParamList }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
      {TABS.map((tab) => {
        const isActive = tab.route === active;
        return (
          <Text
            key={tab.route}
            variant="bodySm"
            weight="semibold"
            tone={isActive ? 'accent' : 'secondary'}
            onPress={() => navigation.navigate(tab.route as any)}
            style={[styles.tab, isActive && styles.tabActive]}
          >
            {tab.label}
          </Text>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.border,
  },
  tabActive: {
    borderColor: color.accentBorder,
    backgroundColor: color.accentMuted,
  },
});
