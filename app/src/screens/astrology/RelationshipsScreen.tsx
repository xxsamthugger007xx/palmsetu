import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Heart, Info, Shield } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { ConsentType, Relationship, RelationshipConsent } from '../../types/astrology';

type LoadState = 'loading' | 'ready' | 'error';

const CONSENT_LABELS: Record<ConsentType, string> = {
  shareCompatibility: 'Share compatibility results',
  receiveSharedReadings: 'Receive shared daily readings',
  showChartDetails: 'Show my chart details to partner',
  receiveNotifications: 'Relationship notifications',
  shareJournal: 'Share journal entries',
  shareDailyReadings: 'Share my individual daily readings',
};

export function RelationshipsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<LoadState>('loading');
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [consents, setConsents] = useState<RelationshipConsent[]>([]);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await astrologyApi.getMyRelationship();
      setRelationship(res.relationship);
      setConsents(res.myConsents);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleConsent = async (type: ConsentType, current: boolean) => {
    if (!relationship) return;
    const updated = await astrologyApi.updateConsent(relationship.id, type, !current);
    setConsents((prev) => prev.map((c) => (c.consentType === type ? updated : c)));
  };

  const handleDisconnect = async () => {
    if (!relationship) return;
    await astrologyApi.disconnect(relationship.id);
    setConfirmDisconnect(false);
    load();
  };

  if (state === 'loading') {
    return <PageContainer><Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Loading...</Text></PageContainer>;
  }
  if (state === 'error') {
    return <PageContainer><EmptyState icon={Info} title="Couldn't load relationships" actionLabel="Retry" onAction={load} /></PageContainer>;
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>Our Cosmic Connection</Text>

      {!relationship ? (
        <EmptyState
          icon={Heart}
          title="No partner connected yet"
          description="Connect with a partner to unlock a shared daily reading, built with full consent and privacy control."
          actionLabel="Connect with partner"
          onAction={() => navigation.navigate('ConnectPartner')}
        />
      ) : (
        <>
          <Card elevated>
            <View style={styles.row}>
              <Heart size={18} color={color.accent} strokeWidth={1.75} />
              <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm }}>Connected</Text>
            </View>
            <Button
              label="View today's shared reading"
              size="sm"
              style={{ marginTop: spacing.md }}
              onPress={() => navigation.navigate('RelationshipReport', { relationshipId: relationship.id, localDate: astrologyApi.todayLocalDate() })}
            />
            <Button
              label="Reading history"
              variant="secondary"
              size="sm"
              style={{ marginTop: spacing.sm }}
              onPress={() => navigation.navigate('AstrologyHistory')}
            />
          </Card>

          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Privacy & sharing" />
            {consents.map((c) => (
              <Card key={c.consentType} style={styles.consentRow} onPress={() => toggleConsent(c.consentType, c.enabled)}>
                <Text variant="bodySm" style={{ flex: 1 }}>{CONSENT_LABELS[c.consentType]}</Text>
                <View style={[styles.toggle, c.enabled && styles.toggleOn]}>
                  <View style={[styles.toggleDot, c.enabled && styles.toggleDotOn]} />
                </View>
              </Card>
            ))}
          </View>

          <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'flex-start' }}>
            <Shield size={14} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
            <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>
              Your personal daily reading stays private by default. The shared reading only uses what's
              needed for a joint reflection - never your journal or private AI conversations.
            </Text>
          </Card>

          <Button
            label="Disconnect"
            variant="danger"
            fullWidth
            style={{ marginTop: spacing.lg }}
            onPress={() => setConfirmDisconnect(true)}
          />
        </>
      )}

      <ConfirmationModal
        visible={confirmDisconnect}
        title="Disconnect from your partner"
        description="This stops future shared readings and notifications for both of you. You can reconnect with a new invitation later."
        confirmLabel="Disconnect"
        destructive
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'center' },
  consentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  toggle: {
    width: 40, height: 24, borderRadius: 12, backgroundColor: color.surfaceElevated,
    borderWidth: 1, borderColor: color.border, padding: 2, justifyContent: 'center',
  },
  toggleOn: { backgroundColor: color.accentMuted, borderColor: color.accentBorder },
  toggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: color.textMuted, alignSelf: 'flex-start' },
  toggleDotOn: { backgroundColor: color.accent, alignSelf: 'flex-end' },
});
