import React, { useState } from 'react';
import { StyleSheet, View, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Moon, Check, Vibrate } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { isHapticsEnabled, setHapticsEnabled, tick } from '../../services/haptics';

export function AppearanceScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [hapticsOn, setHapticsOn] = useState(isHapticsEnabled());

  const toggleHaptics = (value: boolean) => {
    setHapticsOn(value);
    setHapticsEnabled(value);
    if (value) tick();
  };

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">{t('profile.appearance')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>THEME</Text>
      <Card elevated style={styles.themeRow}>
        <View style={styles.iconWrap}>
          <Moon size={18} color={color.accent} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text variant="bodySm" weight="semibold">Midnight (Dark)</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            Solune is designed as a dark, starlit experience - a light theme isn't offered yet.
          </Text>
        </View>
        <Check size={18} color={color.accent} strokeWidth={2} />
      </Card>

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>FEEDBACK</Text>
      <Card elevated style={styles.themeRow}>
        <View style={styles.iconWrap}>
          <Vibrate size={18} color={color.accent} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text variant="bodySm" weight="semibold">Haptic feedback</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            Gentle vibrations on taps, selections, and completions
          </Text>
        </View>
        <Switch
          value={hapticsOn}
          onValueChange={toggleHaptics}
          trackColor={{ false: color.border, true: color.accent }}
          thumbColor={color.textPrimary}
        />
      </Card>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  themeRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: color.surfaceElevated, borderWidth: 1, borderColor: color.border,
    alignItems: 'center', justifyContent: 'center',
  },
});
