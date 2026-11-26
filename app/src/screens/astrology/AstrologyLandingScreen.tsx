import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkles, Info, Compass, Orbit, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FadeInUp } from '../../components/FadeInUp';
import { color, featureTint, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { BirthProfile } from '../../types/astrology';
import { useTranslation } from 'react-i18next';
import { ListSkeleton } from '../../components/ListSkeleton';

type LoadState = 'loading' | 'needsProfile' | 'ready' | 'error';

export function AstrologyLandingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<LoadState>('loading');
  const [profile, setProfile] = useState<BirthProfile | null>(null);

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
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (state === 'loading') {
    return (
      <PageContainer>
        <View style={styles.header2}>
          {navigation.canGoBack() && <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />}
        </View>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('ui.AstrologyLandingScreen.astrology')}</Text>
        <ListSkeleton rows={3} />
      </PageContainer>
    );
  }

  if (state === 'needsProfile') {
    return (
      <PageContainer>
        <View style={styles.header2}>
          {navigation.canGoBack() && <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />}
        </View>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('ui.AstrologyLandingScreen.astrology')}</Text>
        <EmptyState
          icon={Sparkles}
          title={t('ui.AstrologyLandingScreen.setUpYourBirthDetails')}
          description={t('ui.AstrologyLandingScreen.addYourBirthDateAnd')}
          actionLabel={t('ui.AstrologyLandingScreen.getStarted')}
          onAction={() => navigation.navigate('AstrologyProfileSetup')}
        />
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <View style={styles.header2}>
          {navigation.canGoBack() && <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />}
        </View>
        <EmptyState icon={Info} title={t('ui.AstrologyLandingScreen.couldnTLoadThisSection')} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header2}>
        {navigation.canGoBack() && <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />}
      </View>
      <FadeInUp>
        <View style={styles.heroWrap}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCircle}>
            <Image source={require('../../../assets/astrology/zodiac-wheel.png')} style={styles.heroImage} resizeMode="contain" />
          </View>
        </View>
        <View style={styles.header}>
          <Text variant="display" weight="semibold">{t('ui.AstrologyLandingScreen.astrology')}</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>
            {profile?.preferredSystem === 'vedic' ? 'Vedic' : 'Western'} astrology
          </Text>
        </View>
      </FadeInUp>

      <FadeInUp delay={120}>
      <View style={{ marginTop: spacing.lg }}>
        <Card elevated onPress={() => navigation.navigate('SelectAstrologyProfile', { path: 'vedic' })} style={{ borderColor: featureTint.astrology.soft }}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: featureTint.astrology.soft }]}>
              <Compass size={18} color={featureTint.astrology.solid} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="bodySm" weight="semibold">{t('ui.AstrologyLandingScreen.vedicAstrology')}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t('ui.AstrologyLandingScreen.generateYourKundliNorthIndia')}</Text>
            </View>
            <ChevronRight size={16} color={color.textMuted} />
          </View>
        </Card>
        <Card elevated onPress={() => navigation.navigate('SelectAstrologyProfile', { path: 'soulEnergy' })} style={{ marginTop: spacing.sm, borderColor: featureTint.astrology.soft }}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: featureTint.astrology.soft }]}>
              <Orbit size={18} color={featureTint.astrology.solid} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="bodySm" weight="semibold">{t('ui.AstrologyLandingScreen.soulEnergyReading')}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t('ui.AstrologyLandingScreen.anAiGeneratedPersonalityReading')}</Text>
            </View>
            <ChevronRight size={16} color={color.textMuted} />
          </View>
        </Card>
      </View>
      </FadeInUp>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start' },
  header2: { flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'center' },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  heroGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: featureTint.astrology.soft,
  },
  heroCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: featureTint.astrology.soft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImage: {
    width: 52,
    height: 52,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
