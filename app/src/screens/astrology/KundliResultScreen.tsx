import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Info } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { FadeDivider } from '../../components/FadeDivider';
import { EmptyState } from '../../components/EmptyState';
import { KundliChartSvg } from '../../components/kundli/KundliChartSvg';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { kundliApi } from '../../services/kundliApi';
import { KundliChart } from '../../types/kundli';
import { degreeReadout } from '../../utils/astrology';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'KundliResult'>;

const STYLE_TITLE: Record<string, string> = {
  northIndia: 'North India', southIndia: 'South India', western: 'Western',
};

export function KundliResultScreen() {
  const route = useRoute<RouteT>();
  const navigation = useNavigation<Nav>();
  const { chartId } = route.params;

  const [chart, setChart] = useState<KundliChart | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    kundliApi.getById(chartId).then(setChart).catch(() => setError(true));
  }, [chartId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) {
    return (
      <PageContainer>
        <EmptyState icon={Info} title="Couldn't load this chart" actionLabel="Back" onAction={() => navigation.goBack()} />
      </PageContainer>
    );
  }

  if (!chart) {
    return <PageContainer><Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Loading...</Text></PageContainer>;
  }

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{STYLE_TITLE[chart.style]}</Text>
      {chart.subject === 'other' && chart.subjectName && (
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>{chart.subjectName}'s chart</Text>
      )}

      <Card elevated style={{ marginTop: spacing.lg, alignItems: 'center' }}>
        <KundliChartSvg style={chart.style} data={chart.chart} size={260} />
      </Card>

      <View style={styles.pillWrap}>
        <Text variant="bodySm" weight="semibold" tone="accent">Current Dasha: {chart.chart.currentDasha.lord}</Text>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>Planetary Details</Text>
        <Card>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text variant="caption" tone="muted" style={styles.colName}>PLANET</Text>
            <Text variant="caption" tone="muted" style={styles.colDeg}>DEGREE</Text>
            <Text variant="caption" tone="muted" style={styles.colSign}>SIGN</Text>
          </View>
          <FadeDivider />
          {chart.chart.placements.map((p, i) => (
            <View key={p.planet}>
              <View style={styles.tableRow}>
                <Text variant="bodySm" weight="semibold" style={styles.colName}>{p.planet}</Text>
                <Text variant="mono" style={styles.colDeg}>{degreeReadout(p.siderealLongitude)}</Text>
                <Text variant="bodySm" tone="secondary" style={styles.colSign}>{p.sign}</Text>
              </View>
              {i < chart.chart.placements.length - 1 && <FadeDivider />}
            </View>
          ))}
        </Card>
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
          Whole-sign houses, Lahiri-approximation ayanamsa. Mahadasha level only (no antardasha sub-periods).
        </Text>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  pillWrap: {
    marginTop: spacing.md, alignSelf: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, backgroundColor: color.accentMuted,
    borderWidth: 1, borderColor: color.accentBorder,
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  tableHeader: { paddingVertical: spacing.xs },
  colName: { flex: 1.1 },
  colDeg: { flex: 0.9 },
  colSign: { flex: 1 },
});
