import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sun, Info } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { BirthProfile, DailyHoroscope } from '../../types/astrology';
import { useTranslation } from 'react-i18next';
import { ListSkeleton } from '../../components/ListSkeleton';

type LoadState = 'loading' | 'needsProfile' | 'ready' | 'error';

/**
 * Western-framed entry point into the same real astrology engine/flow that
 * AstrologyLandingScreen (Vedic Kundli) uses - BirthProfile.preferredSystem
 * already supports 'western', and astrologyApi.getDaily accepts an explicit
 * `system` override, so this requests the western reading without
 * duplicating the whole astrology screen.
 */
export function WesternAstrologyScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<LoadState>('loading');
  const [daily, setDaily] = useState<DailyHoroscope | null>(null);

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
      const localDate = astrologyApi.todayLocalDate();
      const dailyRes = await astrologyApi.getDaily(localDate, 'western').catch(() => null);
      setDaily(dailyRes);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (state === 'loading') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('ui.WesternAstrologyScreen.westernAstrology')}</Text>
        <ListSkeleton rows={3} />
      </PageContainer>
    );
  }

  if (state === 'needsProfile') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('ui.WesternAstrologyScreen.westernAstrology')}</Text>
        <EmptyState
          icon={Sun}
          title={t('ui.AstrologyLandingScreen.setUpYourBirthDetails')}
          description={t('ui.WesternAstrologyScreen.addYourBirthDateAnd')}
          actionLabel={t('ui.AstrologyLandingScreen.getStarted')}
          onAction={() => navigation.navigate('AstrologyProfileSetup')}
        />
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <EmptyState icon={Info} title={t('ui.AstrologyLandingScreen.couldnTLoadThisSection')} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer onRefresh={load}>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('ui.WesternAstrologyScreen.westernAstrology')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        {t('ui.WesternAstrologyScreen.tropicalSunMoonAndTransits')}
      </Text>

      <Card elevated>
        <Text variant="label" tone="accent">{t('ui.WesternAstrologyScreen.todaySReading')}</Text>
        {!daily ? (
          <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.sm }}>{t('ui.WesternAstrologyScreen.stillPreparingTodaySReading')}</Text>
        ) : (
          <>
            <Text variant="subtitle" weight="semibold" style={{ marginTop: spacing.sm }}>{daily.dailyTheme}</Text>
            <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }} numberOfLines={3}>{daily.summary}</Text>
            <Button
              label={t('ui.WesternAstrologyScreen.openFullReading')}
              size="sm"
              style={{ marginTop: spacing.md }}
              onPress={() => navigation.navigate('DailyHoroscope', { localDate: daily.localDate })}
            />
          </>
        )}
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <Text variant="caption" tone="muted">
          {t('ui.WesternAstrologyScreen.wantTheVedicSiderealView')}
        </Text>
      </View>
    </PageContainer>
  );
}
