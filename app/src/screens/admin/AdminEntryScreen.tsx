import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ShieldAlert } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useAdminRole } from '../../context/AdminRoleContext';

/**
 * Hidden admin entry point. Not reachable from any visible tab or menu -
 * reached only via direct navigation (see ProfileScreen: long-press the
 * avatar). Entering a role name here is NOT a real login: it just sets the
 * x-admin-role header value the app sends on admin API calls, and the server
 * checks it against a hardcoded allowlist (super_admin / analyst / viewer).
 * This is a prototype-grade stand-in, not an auth system.
 */
export function AdminEntryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setAdminRole } = useAdminRole();
  const [roleInput, setRoleInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ROLES = ['super_admin', 'analyst', 'viewer'];

  async function handleEnter() {
    const trimmed = roleInput.trim();
    if (!ROLES.includes(trimmed)) {
      setError(`Role must be one of: ${ROLES.join(', ')}`);
      return;
    }
    setError(null);
    await setAdminRole(trimmed);
    navigation.navigate('AdminOverview');
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <View style={styles.iconWrap}>
        <ShieldAlert size={28} color={color.warning} strokeWidth={1.5} />
      </View>
      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>Admin panel</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
        Prototype-grade access check, not real admin authentication. Anyone who knows a valid
        role name can enter - do not rely on this for production security.
      </Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="label" tone="muted">Role name</Text>
        <TextInput
          value={roleInput}
          onChangeText={setRoleInput}
          placeholder="super_admin, analyst, or viewer"
          placeholderTextColor={color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        {error && (
          <Text variant="caption" tone="danger" style={{ marginTop: spacing.xs }}>{error}</Text>
        )}
        <Button label="Enter" onPress={handleEnter} fullWidth style={{ marginTop: spacing.md }} />
      </Card>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: color.warningMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: color.textPrimary,
    backgroundColor: color.surfaceElevated,
  },
});
