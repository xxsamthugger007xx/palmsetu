import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { BarChart3 } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { useAdminRole } from '../../context/AdminRoleContext';
import { adminApi, AdminOverview } from '../../services/adminApi';
import { AdminTopNav } from './AdminTopNav';

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={styles.kpi}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="title" weight="semibold" style={{ marginTop: 4 }}>{value}</Text>
    </Card>
  );
}

export function AdminOverviewScreen() {
  const { adminRole } = useAdminRole();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminRole) return;
    adminApi.getOverview(adminRole)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [adminRole]);

  return (
    <PageContainer>
      <AdminTopNav active="AdminOverview" />
      <Text variant="title" weight="semibold" style={{ marginBottom: spacing.md }}>Overview</Text>

      {loading && <ActivityIndicator color={color.accent} />}
      {error && <EmptyState icon={BarChart3} title="Could not load overview" description={error} />}

      {data && (
        <>
          <View style={styles.grid}>
            <Kpi label="Total users" value={data.totalUsers} />
            <Kpi label="Premium" value={data.usersByTier.premium} />
            <Kpi label="Free" value={data.usersByTier.free} />
          </View>

          <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
            Readings by feature
          </Text>
          <Card>
            {Object.entries(data.readingsByFeature).map(([feature, count]) => (
              <View key={feature} style={styles.row}>
                <Text variant="bodySm" tone="secondary" style={{ textTransform: 'capitalize' }}>{feature}</Text>
                <Text variant="bodySm" weight="semibold">{count}</Text>
              </View>
            ))}
          </Card>

          <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
            Not yet instrumented
          </Text>
          <EmptyState
            icon={BarChart3}
            title="Revenue / MRR"
            description={data.revenue.reason}
          />
          <EmptyState
            icon={BarChart3}
            title="AI cost / token usage"
            description={data.aiCost.reason}
          />
        </>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpi: {
    flexGrow: 1,
    minWidth: 100,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
});
