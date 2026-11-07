import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Cpu } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { useAdminRole } from '../../context/AdminRoleContext';
import { adminApi, AdminSystem } from '../../services/adminApi';
import { AdminTopNav } from './AdminTopNav';

export function AdminSystemScreen() {
  const { adminRole } = useAdminRole();
  const [data, setData] = useState<AdminSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminRole) return;
    adminApi.getSystem(adminRole)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [adminRole]);

  return (
    <PageContainer>
      <AdminTopNav active="AdminSystem" />
      <Text variant="title" weight="semibold" style={{ marginBottom: spacing.md }}>System health</Text>

      {loading && <ActivityIndicator color={color.accent} />}
      {error && <EmptyState icon={Cpu} title="Could not load system info" description={error} />}

      {data && (
        <>
          <Card>
            <View style={styles.row}>
              <Text variant="bodySm" tone="secondary">Uptime</Text>
              <Text variant="bodySm" weight="semibold">{Math.floor(data.uptimeSeconds / 60)}m {Math.round(data.uptimeSeconds % 60)}s</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodySm" tone="secondary">Node version</Text>
              <Text variant="bodySm" weight="semibold">{data.nodeVersion}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodySm" tone="secondary">AI provider</Text>
              <Text variant="bodySm" weight="semibold" style={{ textTransform: 'capitalize' }}>{data.aiProvider}</Text>
            </View>
          </Card>

          <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
            In-memory record counts (proxy for memory usage)
          </Text>
          <Card>
            {Object.entries(data.recordCountsByStore).map(([store, count]) => (
              <View key={store} style={styles.row}>
                <Text variant="bodySm" tone="secondary">{store}</Text>
                <Text variant="bodySm" weight="semibold">{count}</Text>
              </View>
            ))}
          </Card>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{data.note}</Text>

          <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
            Not yet instrumented
          </Text>
          <EmptyState icon={Cpu} title="Error monitoring / APM" description={data.errorMonitoring.reason} />
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
});
