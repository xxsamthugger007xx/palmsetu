import React, { useState } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScanLine, FileText, ImageOff } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { palmApi } from '../../services/palmApi';
import { PalmReading } from '../../types/palm';

const PREVIEW_SECTION_ORDER = ['heartLine', 'headLine', 'lifeLine', 'fateLine'];

export function PalmHubScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profile, setProfile] = useState<PalmReading | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [confirmRescan, setConfirmRescan] = useState(false);

  const loadProfile = React.useCallback(async () => {
    await palmApi.getProfile()
      .then((p) => { setProfile(p); setImageFailed(false); })
      .catch(() => setProfile(null))
      .finally(() => setLoaded(true));
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  if (!loaded) {
    return <PageContainer onRefresh={loadProfile}><View /></PageContainer>;
  }

  // Returning user: shows the permanent saved profile every visit - never
  // auto-regenerates. "Scan Another Palm" is still available (with
  // confirmation), but it always replaces the active profile rather than
  // silently re-triggering AI generation on its own.
  if (profile) {
    const sections = [...profile.freeReading.sections].sort((a, b) => {
      const ai = PREVIEW_SECTION_ORDER.indexOf(a.sectionKey ?? '');
      const bi = PREVIEW_SECTION_ORDER.indexOf(b.sectionKey ?? '');
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return (
      <PageContainer onRefresh={loadProfile}>
        {/* Deliberately not placed in the top-right corner of this row - the
            globally-mounted UpgradeButton (see RootNavigator.tsx) is a fixed
            overlay pinned to that exact spot on every screen, so anything
            else rendered there collides with it. The History action lives
            on the "Analysis sections" header below instead. */}
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('palm.profileTitle')}</Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: 4, marginBottom: spacing.lg }}>
          {t('palm.profileSubtitle')}
        </Text>

        {profile.hasStoredImage && !imageFailed ? (
          <Image
            source={{ uri: palmApi.imageUrl(profile.id), headers: palmApi.imageHeaders() }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          // Either this reading predates photo storage (an older scan, saved
          // before the app persisted the original image), or the stored file
          // could not be loaded - never shown as a blank gap or a broken
          // image icon, always an honest explanation of why there's nothing
          // to display here.
          <View style={styles.heroImageFallback}>
            <ImageOff size={22} color={color.textMuted} strokeWidth={1.5} />
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
              {t('palm.photoUnavailable')}
            </Text>
          </View>
        )}

        <Card elevated style={{ marginTop: spacing.md }}>
          <View style={styles.metaRow}>
            <View>
              <Text variant="label" tone="muted">{t('palm.handLabel')}</Text>
              <Text variant="bodySm" weight="semibold" style={{ marginTop: 2 }}>
                {profile.analysis.hand === 'unknown' ? t('palm.handNotSpecified') : profile.analysis.hand === 'left' ? t('palm.handLeft') : t('palm.handRight')}
              </Text>
            </View>
            <View>
              <Text variant="label" tone="muted">{t('palm.scanDateLabel')}</Text>
              <Text variant="bodySm" weight="semibold" style={{ marginTop: 2 }}>
                {new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <View>
              <Text variant="label" tone="muted">{t('palm.statusLabel')}</Text>
              <View style={{ marginTop: 2 }}>
                <StatusBadge label={t('palm.statusSaved')} status="success" />
              </View>
            </View>
          </View>
        </Card>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title={t('palm.analysisSectionsTitle')}
            action={t('palm.viewHistory')}
            onActionPress={() => navigation.navigate('PalmHistory')}
          />
          {sections.length === 0 ? (
            <Text variant="bodySm" tone="muted">{t('palm.noSectionsMatched')}</Text>
          ) : (
            sections.map((s) => (
              <Card key={s.sectionKey ?? s.title} style={styles.sectionRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySm" weight="semibold">{s.title}</Text>
                  <Text variant="caption" tone="muted" style={{ marginTop: 2 }} numberOfLines={2}>{s.text}</Text>
                </View>
              </Card>
            ))
          )}
        </View>

        <Button
          label={t('palm.viewCompleteReport')}
          icon={FileText}
          fullWidth
          style={{ marginTop: spacing.lg }}
          onPress={() => navigation.navigate('PalmReport', { readingId: profile.id })}
        />

        <Button
          label={t('palm.scanAnother')}
          icon={ScanLine}
          variant="secondary"
          fullWidth
          style={{ marginTop: spacing.sm }}
          onPress={() => setConfirmRescan(true)}
        />

        <ConfirmationModal
          visible={confirmRescan}
          title={t('palm.scanAnotherConfirmTitle')}
          description={t('palm.scanAnotherConfirmDesc')}
          confirmLabel={t('palm.scanAnother')}
          destructive
          onConfirm={() => {
            setConfirmRescan(false);
            navigation.navigate('PalmIntro', { allowRescan: true });
          }}
          onCancel={() => setConfirmRescan(false)}
        />
      </PageContainer>
    );
  }

  // First-time user: no palm profile yet - this is the only point in the
  // app where a scan can be started without going through the Profile
  // screen's confirmed-rescan flow.
  return (
    <PageContainer onRefresh={loadProfile}>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('palm.scanTitle')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: 4, marginBottom: spacing.lg }}>
        {t('palm.scanSubtitle')}
      </Text>

      <Card elevated>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <ScanLine size={20} color={color.accent} strokeWidth={1.75} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text variant="bodySm" weight="semibold">{t('palm.newReadingTitle')}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {t('palm.newReadingDesc')}
            </Text>
          </View>
        </View>
        <Button label={t('palm.scanMyPalm')} icon={ScanLine} fullWidth style={{ marginTop: spacing.md }} onPress={() => navigation.navigate('PalmIntro')} />
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <EmptyState icon={FileText} title={t('palm.emptyTitle')} description={t('palm.emptyDesc')} />
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: 320,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    backgroundColor: color.surfaceElevated,
  },
  heroImageFallback: {
    width: '100%',
    height: 160,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionRow: {
    marginBottom: spacing.sm,
  },
});
