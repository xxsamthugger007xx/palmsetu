import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Moon, Info } from 'lucide-react-native';
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
import { BirthProfile } from '../../types/astrology';

type LoadState = 'loading' | 'needsProfile' | 'ready' | 'error';

/**
 * Focused moon-sign surface. Reuses the real birth profile the astrology
 * engine already computes (natal.moonSignTropical / moonSignSidereal /
 * moonNakshatra) - no new backend calculation, just a dedicated frontend
 * presentation of data that already exists on BirthProfile.
 */
export function MoonSignScreen() {
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
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Moon Sign</Text>
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.lg }}>Loading...</Text>
      </PageContainer>
    );
  }

  if (state === 'needsProfile') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Moon Sign</Text>
        <EmptyState
          icon={Moon}
          title="Set up your birth details"
          description="Add your birth date (and time, if known) to see your real moon sign and nakshatra."
          actionLabel="Get started"
          onAction={() => navigation.navigate('AstrologyProfileSetup')}
        />
      </PageContainer>
    );
  }

  if (state === 'error' || !profile) {
    return (
      <PageContainer>
        <EmptyState icon={Info} title="Couldn't load this section" />
      </PageContainer>
    );
  }

  const { natal } = profile;

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Moon Sign</Text>
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
            <Text variant="label" tone="accent">SIDEREAL (VEDIC)</Text>
            <Text variant="title" weight="semibold" style={{ marginTop: 2 }}>{natal.moonSignSidereal}</Text>
          </View>
        </View>
        <FadeDivider style={{ marginVertical: spacing.md }} />
        <View style={styles.dataRow}>
          <Text variant="bodySm" tone="secondary">Nakshatra</Text>
          <Text variant="bodySm" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
            {natal.moonNakshatra} · Pada {natal.moonNakshatraPada}
          </Text>
        </View>
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Western (tropical)" />
        <Card>
          <View style={styles.dataRow}>
            <Text variant="bodySm" tone="secondary">Tropical moon sign</Text>
            <Text variant="bodySm" weight="semibold">{natal.moonSignTropical}</Text>
          </View>
        </Card>
      </View>

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
