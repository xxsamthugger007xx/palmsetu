import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Layers } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { color, radius, spacing } from '../../theme/tokens';
import { useAdminRole } from '../../context/AdminRoleContext';
import { adminApi, AdminFeatureBreakdown } from '../../services/adminApi';
import { AdminTopNav } from './AdminTopNav';

const FEATURES = ['tarot', 'gemstone', 'vastu', 'astrology', 'palm'] as const;
type Feature = typeof FEATURES[number];

function BreakdownGroup({ title, counts }: { title: string; counts: Record<string, number> }) {
  return (
    <>
      <Text variant="label" tone="muted" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>{title}</Text>
      <Card>
        {Object.entries(counts).length === 0 && (
          <Text variant="caption" tone="muted">No records yet</Text>
        )}
        {Object.entries(counts).map(([key, count]) => (
          <View key={key} style={styles.row}>
            <Text variant="bodySm" tone="secondary" style={{ textTransform: 'capitalize' }}>{key}</Text>
            <Text variant="bodySm" weight="semibold">{count}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

export function AdminFeaturesScreen() {
  const { adminRole } = useAdminRole();
  const [active, setActive] = useState<Feature>('tarot');
  const [data, setData] = useState<AdminFeatureBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminRole) return;
    setLoading(true);
    setData(null);
    adminApi.getFeature(adminRole, active)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [adminRole, active]);

  const otherGroups = data
    ? Object.entries(data).filter(([key]) => key !== 'total' && key !== 'byTier')
    : [];

  return (
    <PageContainer>
      <AdminTopNav active="AdminFeatures" />
      <Text variant="title" weight="semibold" style={{ marginBottom: spacing.md }}>Feature breakdowns</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
        {FEATURES.map((f) => {
          const isActive = f === active;
          return (
            <Text
              key={f}
              variant="bodySm"
              weight="semibold"
              tone={isActive ? 'accent' : 'secondary'}
              onPress={() => setActive(f)}
              style={[styles.pill, isActive && styles.pillActive]}
            >
              {f}
            </Text>
          );
        })}
      </ScrollView>

      {loading && <ActivityIndicator color={color.accent} />}
      {error && <EmptyState icon={Layers} title="Could not load breakdown" description={error} />}

      {data && (
        <>
          <Card>
            <View style={styles.row}>
              <Text variant="bodySm" tone="secondary">Total</Text>
              <Text variant="bodySm" weight="semibold">{data.total}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodySm" tone="secondary">Premium users</Text>
              <Text variant="bodySm" weight="semibold">{data.byTier.premium}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodySm" tone="secondary">Free users</Text>
              <Text variant="bodySm" weight="semibold">{data.byTier.free}</Text>
            </View>
          </Card>

          {otherGroups.map(([key, value]) => (
            <BreakdownGroup key={key} title={key} counts={value as Record<string, number>} />
          ))}
        </>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.border,
    textTransform: 'capitalize',
  },
  pillActive: {
    borderColor: color.accentBorder,
    backgroundColor: color.accentMuted,
  },
});
