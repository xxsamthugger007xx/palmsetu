import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Moon, Info, Share2 } from 'lucide-react-native';
import { IconButton } from '../../components/Button';
import { ShareCard } from '../../components/ShareCard';
import { shareCardImage } from '../../services/shareCard';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { FadeDivider } from '../../components/FadeDivider';
import { ZodiacWheel } from '../../components/ZodiacWheel';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { degreeReadout } from '../../utils/astrology';
import { BirthProfile, DailyHoroscope } from '../../types/astrology';
import { useTranslation } from 'react-i18next';
import { signName } from '../../utils/signName';
import { ListSkeleton } from '../../components/ListSkeleton';

type LoadState = 'loading' | 'needsProfile' | 'ready' | 'error';

/**
 * Focused moon-sign surface. Reuses the real birth profile the astrology
 * engine already computes (natal.moonSignTropical / moonSignSidereal /
 * moonNakshatra) plus, when available, today's real transit data
 * (transitContext from the daily horoscope already computed server-side) -
 * no new backend calculation beyond the engine's existing fields, just a
 * dedicated frontend presentation.
 */
export function MoonSignScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<LoadState>('loading');
  const [profile, setProfile] = useState<BirthProfile | null>(null);
  const [dailyHoroscope, setDailyHoroscope] = useState<DailyHoroscope | null>(null);
  const shareRef = useRef<any>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const profileRes = await astrologyApi.getProfile().catch((err) => {
        if (err.status === 404) return null;
        throw err;
      });
      if (!profileRes) {
        setState('needsProfile');
        return;
      }
      setProfile(profileRes);
      // Today's real transit (current Moon sign/phase/degree) is honest,
      // already-computed data on the daily horoscope - never fabricated
      // here. Never block the main ready state on this call failing.
      astrologyApi.getDaily(astrologyApi.todayLocalDate())
        .then((res) => setDailyHoroscope(res.generationStatus === 'ready' ? res : null))
        .catch(() => setDailyHoroscope(null));
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (state === 'loading') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('ui.MoonSignScreen.moonSign')}</Text>
        <ListSkeleton rows={3} />
      </PageContainer>
    );
  }

  if (state === 'needsProfile') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('ui.MoonSignScreen.moonSign')}</Text>
        <EmptyState
          icon={Moon}
          title={t('ui.AstrologyLandingScreen.setUpYourBirthDetails')}
          description={t('ui.MoonSignScreen.addYourBirthDateAnd')}
          actionLabel={t('ui.AstrologyLandingScreen.getStarted')}
          onAction={() => navigation.navigate('AstrologyProfileSetup')}
        />
      </PageContainer>
    );
  }

  if (state === 'error' || !profile) {
    return (
      <PageContainer>
        <EmptyState icon={Info} title={t('ui.AstrologyLandingScreen.couldnTLoadThisSection')} />
      </PageContainer>
    );
  }

  const { natal } = profile;
  const shareSign = profile.preferredSystem === 'vedic' ? natal.moonSignSidereal : natal.moonSignTropical;
  const shareTitle = t('home.moonInSign', { sign: signName(t, shareSign) });
  const shareBody = dailyHoroscope?.dailyTheme ?? null;

  return (
    <PageContainer onRefresh={load}>
      <View pointerEvents="none" style={{ position: 'absolute', left: -2000, top: 0 }}>
        <ShareCard viewRef={shareRef} kind="astrology" eyebrow={t('share.moonEyebrow')} title={shareTitle} body={shareBody} tagline={t('share.tagline')}>
          <Moon size={120} color="#E8B85C" strokeWidth={1.2} />
        </ShareCard>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('ui.MoonSignScreen.moonSign')}</Text>
        <IconButton icon={Share2} onPress={() => shareCardImage(shareRef, `${shareTitle}${shareBody ? ' - ' + shareBody : ''} (via Palm Setu)`)} />
      </View>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        Based on your birth details, {natal.birthTimeKnown ? 'including birth time' : 'birth date only'}
      </Text>

      <Card elevated style={{ alignItems: 'center' }}>
        <ZodiacWheel
          size={200}
          points={[
            { label: 'Moon (sidereal)', sign: natal.moonSignSidereal },
            { label: 'Moon (tropical)', sign: natal.moonSignTropical },
          ]}
        />
      </Card>

      <Card elevated style={{ marginTop: spacing.md }}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Moon size={20} color={color.accent} strokeWidth={1.75} />
          </View>
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text variant="label" tone="accent">{t('ui.MoonSignScreen.siderealVedic')}</Text>
            <Text variant="title" weight="semibold" style={{ marginTop: 2 }}>{natal.moonSignSidereal}</Text>
          </View>
        </View>
        <FadeDivider style={{ marginVertical: spacing.md }} />
        <View style={styles.dataRow}>
          <Text variant="bodySm" tone="secondary">{t('ui.MoonSignScreen.nakshatra')}</Text>
          <Text variant="bodySm" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
            {natal.moonNakshatra} · Pada {natal.moonNakshatraPada}
          </Text>
        </View>
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title={t('ui.MoonSignScreen.westernTropical')} />
        <Card>
          <View style={styles.dataRow}>
            <Text variant="bodySm" tone="secondary">{t('ui.MoonSignScreen.tropicalMoonSign')}</Text>
            <Text variant="bodySm" weight="semibold">{natal.moonSignTropical}</Text>
          </View>
        </Card>
      </View>

      {dailyHoroscope && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title={t('ui.MoonSignScreen.todaySMoon')} />
          <Card elevated>
            <View style={styles.dataRow}>
              <Text variant="bodySm" tone="secondary">{t('ui.MoonSignScreen.currentPosition')}</Text>
              <Text variant="bodySm" weight="semibold">
                {dailyHoroscope.astrologySystem === 'vedic'
                  ? dailyHoroscope.transitContext.moonSignSidereal
                  : dailyHoroscope.transitContext.moonSignTropical}{' '}
                {degreeReadout(
                  dailyHoroscope.astrologySystem === 'vedic'
                    ? dailyHoroscope.transitContext.moonSiderealLongitude
                    : dailyHoroscope.transitContext.moonTropicalLongitude
                )}
              </Text>
            </View>
            <FadeDivider style={{ marginVertical: spacing.sm }} />
            <View style={styles.dataRow}>
              <Text variant="bodySm" tone="secondary">{t('ui.MoonSignScreen.lunarPhase')}</Text>
              <Text variant="bodySm" weight="semibold">{dailyHoroscope.transitContext.moonPhase}</Text>
            </View>
            <View style={[styles.dataRow, { marginTop: spacing.xs }]}>
              <Text variant="bodySm" tone="secondary">{t('ui.MoonSignScreen.nextPhase')}</Text>
              <Text variant="bodySm" weight="semibold">
                {dailyHoroscope.transitContext.nextMoonPhase} in ~{dailyHoroscope.transitContext.daysUntilNextMoonPhase}d
              </Text>
            </View>
            <FadeDivider style={{ marginVertical: spacing.sm }} />
            <Text variant="bodySm" tone="secondary">{dailyHoroscope.selfCarePrompt}</Text>
          </Card>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            {t('ui.MoonSignScreen.thisAppSEngineDoesn')}
          </Text>
        </View>
      )}

      {!natal.birthTimeKnown && (
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.lg }}>
          {natal.confidenceNote}
        </Text>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
