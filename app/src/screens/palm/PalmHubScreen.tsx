import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScanLine, ChevronRight, FileText } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { palmApi } from '../../services/palmApi';
import { PalmReading } from '../../types/palm';

export function PalmHubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [readings, setReadings] = useState<PalmReading[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      palmApi.listReadings()
        .then((res) => { if (!cancelled) { setReadings(res.items.slice(0, 3)); setLoaded(true); } })
        .catch(() => { if (!cancelled) setLoaded(true); });
      return () => { cancelled = true; };
    }, [])
  );

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Palm Scan</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: 4, marginBottom: spacing.lg }}>
        Rooted in traditional palmistry. For reflection and entertainment, not medical or predictive advice.
      </Text>

      <Card elevated>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <ScanLine size={20} color={color.accent} strokeWidth={1.75} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text variant="bodySm" weight="semibold">New reading</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
              Capture a clear photo of your palm to get started
            </Text>
          </View>
        </View>
        <Button label="Scan my palm" icon={ScanLine} fullWidth style={{ marginTop: spacing.md }} onPress={() => navigation.navigate('PalmIntro')} />
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <View style={styles.sectionHeaderRow}>
          <SectionHeader title="Recent readings" />
          {readings.length > 0 && (
            <Text variant="caption" weight="semibold" tone="secondary" onPress={() => navigation.navigate('PalmHistory')}>
              View all
            </Text>
          )}
        </View>
        {!loaded ? null : readings.length === 0 ? (
          <EmptyState icon={FileText} title="No readings yet" description="Your palm readings will appear here." />
        ) : (
          readings.map((r) => (
            <Card key={r.id} style={styles.readingRow} onPress={() => navigation.navigate('PalmReport', { readingId: r.id })}>
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" weight="semibold">
                  {r.analysis.hand === 'unknown' ? 'Palm reading' : `${r.analysis.hand === 'left' ? 'Left' : 'Right'} hand reading`}
                </Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{new Date(r.createdAt).toLocaleDateString()}</Text>
              </View>
              <ChevronRight size={16} color={color.textMuted} />
            </Card>
          ))
        )}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
