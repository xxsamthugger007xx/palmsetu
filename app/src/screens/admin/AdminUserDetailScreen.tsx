import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, User } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { useAdminRole } from '../../context/AdminRoleContext';
import { adminApi, AdminUserRow } from '../../services/adminApi';
import { RootStackParamList } from '../../navigation/types';

export function AdminUserDetailScreen() {
  const { adminRole } = useAdminRole();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AdminUserDetail'>>();
  const { userId } = route.params;

  const [data, setData] = useState<AdminUserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminRole) return;
    adminApi.getUserDetail(adminRole, userId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [adminRole, userId]);

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold">{userId}</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
        Counts and timestamps only. No reading content, questions, birth details, or AI
        interpretations are exposed here, by design.
      </Text>

      {loading && <ActivityIndicator color={color.accent} style={{ marginTop: spacing.lg }} />}
      {error && <EmptyState icon={User} title="Could not load user" description={error} />}

      {data && (
        <>
          <Card style={{ marginTop: spacing.lg }}>
            <View style={styles.row}>
              <Text variant="bodySm" tone="secondary">Tier</Text>
              <Text variant="bodySm" weight="semibold" style={{ textTransform: 'capitalize' }}>{data.tier}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodySm" tone="secondary">First seen</Text>
              <Text variant="bodySm" weight="semibold">{data.firstSeen ?? '-'}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="bodySm" tone="secondary">Last seen</Text>
              <Text variant="bodySm" weight="semibold">{data.lastSeen ?? '-'}</Text>
            </View>
          </Card>

          <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
            Reading counts by feature
          </Text>
          <Card>
            {Object.entries(data.readingCounts).map(([feature, count]) => (
              <View key={feature} style={styles.row}>
                <Text variant="bodySm" tone="secondary" style={{ textTransform: 'capitalize' }}>{feature}</Text>
                <Text variant="bodySm" weight="semibold">{count}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
});
