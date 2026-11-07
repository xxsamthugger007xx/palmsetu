import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Layers, Sparkles, Gem, Compass, ScanLine, ChevronRight,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';

/**
 * Navigation hub only - links out to the real, already-existing per-feature
 * history screens. Does not fetch or aggregate data itself (that would
 * duplicate what each history screen already does).
 */
export function MyReportsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const links: { id: string; title: string; description: string; icon: typeof Layers; onPress: () => void }[] = [
    { id: 'tarot', title: 'Tarot History', description: 'Your past tarot readings', icon: Layers, onPress: () => navigation.navigate('TarotHistory') },
    { id: 'astrology', title: 'Astrology History', description: 'Your past daily and chart readings', icon: Sparkles, onPress: () => navigation.navigate('AstrologyHistory') },
    { id: 'gemstone', title: 'Gemstone History', description: 'Your past gemstone reports', icon: Gem, onPress: () => navigation.navigate('GemstoneHistory') },
    { id: 'vastu', title: 'Vastu History', description: 'Your past vastu reports', icon: Compass, onPress: () => navigation.navigate('VastuHistory') },
    { id: 'palm', title: 'Palm Readings', description: 'Your past palm scans', icon: ScanLine, onPress: () => navigation.navigate('PalmHistory') },
  ];

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>My Reports</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        All your previous readings and reports, in one place
      </Text>

      {links.map((link) => (
        <Card key={link.id} style={styles.row} onPress={link.onPress}>
          <View style={styles.iconWrap}>
            <link.icon size={18} color={color.accent} strokeWidth={1.75} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text variant="bodySm" weight="semibold">{link.title}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{link.description}</Text>
          </View>
          <ChevronRight size={16} color={color.textMuted} />
        </Card>
      ))}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
