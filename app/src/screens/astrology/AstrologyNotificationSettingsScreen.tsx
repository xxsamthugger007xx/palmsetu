import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Info } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { DailyDeliveryPreference } from '../../types/astrology';

function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Card style={styles.toggleRow} onPress={onToggle}>
      <Text variant="bodySm" style={{ flex: 1 }}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleDot, value && styles.toggleDotOn]} />
      </View>
    </Card>
  );
}

export function AstrologyNotificationSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [prefs, setPrefs] = useState<DailyDeliveryPreference | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    astrologyApi.getPreferences().then(setPrefs);
  }, []);

  const save = async (next: Partial<DailyDeliveryPreference>) => {
    if (!prefs) return;
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    setSaving(true);
    try {
      await astrologyApi.savePreferences(merged);
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) {
    return <PageContainer><Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Loading...</Text></PageContainer>;
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">Notification Preferences</Text>
        <View style={{ width: 36 }} />
      </View>

      <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'flex-start' }}>
        <Info size={14} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>
          Push delivery isn't wired up to a real device-token/scheduler yet in this build - these
          preferences are saved and will take effect once that infrastructure is connected.
        </Text>
      </Card>

      <ToggleRow label="Personal daily message" value={prefs.dailyHoroscopeEnabled} onToggle={() => save({ dailyHoroscopeEnabled: !prefs.dailyHoroscopeEnabled })} />
      <ToggleRow label="Shared relationship message" value={prefs.relationshipMessageEnabled} onToggle={() => save({ relationshipMessageEnabled: !prefs.relationshipMessageEnabled })} />
      <ToggleRow
        label="Detailed lock-screen preview"
        value={prefs.previewMode === 'detailed'}
        onToggle={() => save({ previewMode: prefs.previewMode === 'detailed' ? 'discreet' : 'detailed' })}
      />

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>PREFERRED TIME</Text>
      <View style={styles.timeRow}>
        {['07:00', '08:00', '09:00', '19:00', '21:00'].map((t) => (
          <Button
            key={t}
            label={t}
            size="sm"
            variant={prefs.preferredLocalTime === t ? 'primary' : 'secondary'}
            onPress={() => save({ preferredLocalTime: t })}
          />
        ))}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  toggle: {
    width: 40, height: 24, borderRadius: 12, backgroundColor: color.surfaceElevated,
    borderWidth: 1, borderColor: color.border, padding: 2, justifyContent: 'center',
  },
  toggleOn: { backgroundColor: color.accentMuted, borderColor: color.accentBorder },
  toggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: color.textMuted, alignSelf: 'flex-start' },
  toggleDotOn: { backgroundColor: color.accent, alignSelf: 'flex-end' },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
