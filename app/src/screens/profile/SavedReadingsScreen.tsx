import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ScanLine, Sparkles, Compass, Heart, Gem, Home } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { SettingsRow } from './SettingsRow';
import { featureTint, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';

export function SavedReadingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">{t('profile.savedReadings')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text variant="caption" tone="muted" style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
        All of your past readings and reports, grouped by feature.
      </Text>

      <Card padded={false}>
        <SettingsRow icon={ScanLine} label="Palm readings" tint={featureTint.palm} onPress={() => navigation.navigate('PalmHistory')} />
        <SettingsRow icon={Sparkles} label="Tarot readings" tint={featureTint.tarot} onPress={() => navigation.navigate('TarotHistory')} />
        <SettingsRow icon={Compass} label="Astrology charts & readings" tint={featureTint.astrology} onPress={() => navigation.navigate('AstrologyHistory')} />
        <SettingsRow icon={Heart} label="Soulmate sketches" tint={featureTint.soulmate} onPress={() => navigation.navigate('SoulmateHistory')} />
        <SettingsRow icon={Gem} label="Gemstone reports" tint={featureTint.palm} onPress={() => navigation.navigate('GemstoneHistory')} />
        <SettingsRow icon={Home} label="Vastu reports" tint={featureTint.wellness} onPress={() => navigation.navigate('VastuHistory')} />
      </Card>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
