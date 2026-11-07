import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Users as UsersIcon, ChevronRight } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, radius, spacing } from '../../theme/tokens';
import { useAdminRole } from '../../context/AdminRoleContext';
import { adminApi, AdminUsersResponse } from '../../services/adminApi';
import { AdminTopNav } from './AdminTopNav';
import { RootStackParamList } from '../../navigation/types';

const PAGE_SIZE = 20;

export function AdminUsersScreen() {
  const { adminRole } = useAdminRole();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminRole) return;
    setLoading(true);
    adminApi.getUsers(adminRole, { page, pageSize: PAGE_SIZE, search: search || undefined })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [adminRole, page, search]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <PageContainer>
      <AdminTopNav active="AdminUsers" />
      <Text variant="title" weight="semibold" style={{ marginBottom: spacing.md }}>Users</Text>

      <TextInput
        value={search}
        onChangeText={(v) => { setSearch(v); setPage(1); }}
        placeholder="Search by userId..."
        placeholderTextColor={color.textMuted}
        autoCapitalize="none"
        style={styles.input}
      />

      {loading && <ActivityIndicator color={color.accent} style={{ marginTop: spacing.lg }} />}
      {error && <EmptyState icon={UsersIcon} title="Could not load users" description={error} />}
      {data && data.users.length === 0 && !loading && (
        <EmptyState icon={UsersIcon} title="No users found" description="No activity recorded for any userId yet - remember this app has no real auth, every record is tagged with the x-demo-user header value sent by the client." />
      )}

      {data?.users.map((u) => (
        <Card key={u.userId} onPress={() => navigation.navigate('AdminUserDetail', { userId: u.userId })} style={styles.userRow}>
          <View style={{ flex: 1 }}>
            <Text variant="bodySm" weight="semibold">{u.userId}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2, textTransform: 'capitalize' }}>{u.tier}</Text>
          </View>
          <ChevronRight size={18} color={color.textMuted} />
        </Card>
      ))}

      {data && data.total > PAGE_SIZE && (
        <View style={styles.pager}>
          <Button label="Prev" variant="secondary" size="sm" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
          <Text variant="caption" tone="muted">Page {page} of {totalPages}</Text>
          <Button label="Next" variant="secondary" size="sm" disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)} />
        </View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: color.textPrimary,
    backgroundColor: color.surfaceElevated,
    marginBottom: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
});
