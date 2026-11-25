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
import { useTranslation } from 'react-i18next';
import { ListSkeleton } from '../../components/ListSkeleton';

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
  const { t } = useTranslation();
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
    return <PageContainer><ListSkeleton rows={3} /></PageContainer>;
  }
  if (state === 'error') {
    return <PageContainer><EmptyState icon={Info} title={t('ui.RelationshipsScreen.couldnTLoadRelationships')} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} /></PageContainer>;
  }

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>{t('ui.RelationshipsScreen.ourCosmicConnection')}</Text>

      {!relationship ? (
        <EmptyState
          icon={Heart}
          title={t('ui.RelationshipsScreen.noPartnerConnectedYet')}
          description={t('ui.RelationshipsScreen.connectWithAPartnerTo')}
          actionLabel={t('ui.ConnectPartnerScreen.connectWithPartner')}
          onAction={() => navigation.navigate('ConnectPartner')}
        />
      ) : (
        <>
          <Card elevated>
            <View style={styles.row}>
              <Heart size={18} color={color.accent} strokeWidth={1.75} />
              <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm }}>{t('ui.RelationshipsScreen.connected')}</Text>
            </View>
            <Button
              label={t('ui.RelationshipsScreen.viewTodaySSharedReading')}
              size="sm"
              style={{ marginTop: spacing.md }}
              onPress={() => navigation.navigate('RelationshipReport', { relationshipId: relationship.id, localDate: astrologyApi.todayLocalDate() })}
            />
            <Button
              label={t('ui.RelationshipsScreen.readingHistory')}
              variant="secondary"
              size="sm"
              style={{ marginTop: spacing.sm }}
              onPress={() => navigation.navigate('AstrologyHistory')}
            />
          </Card>

          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title={t('ui.RelationshipsScreen.privacySharing')} />
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
              {t('ui.RelationshipsScreen.yourPersonalDailyReadingStays')}
            </Text>
          </Card>

          <Button
            label={t('ui.RelationshipsScreen.disconnect')}
            variant="danger"
            fullWidth
            style={{ marginTop: spacing.lg }}
            onPress={() => setConfirmDisconnect(true)}
          />
        </>
      )}

      <ConfirmationModal
        visible={confirmDisconnect}
        title={t('ui.RelationshipsScreen.disconnectFromYourPartner')}
        description={t('ui.RelationshipsScreen.thisStopsFutureSharedReadings')}
        confirmLabel={t('ui.RelationshipsScreen.disconnect')}
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
