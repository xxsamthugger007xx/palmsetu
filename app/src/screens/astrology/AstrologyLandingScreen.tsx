import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkles, Info, Compass, Orbit } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { BirthProfile } from '../../types/astrology';

type LoadState = 'loading' | 'needsProfile' | 'ready' | 'error';

export function AstrologyLandingScreen() {
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
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Astrology</Text>
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.lg }}>Loading...</Text>
      </PageContainer>
    );
  }

  if (state === 'needsProfile') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Astrology</Text>
        <EmptyState
          icon={Sparkles}
          title="Set up your birth details"
          description="Add your birth date (and time, if known) to get personalized daily readings."
          actionLabel="Get started"
          onAction={() => navigation.navigate('AstrologyProfileSetup')}
        />
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <EmptyState icon={Info} title="Couldn't load this section" actionLabel="Retry" onAction={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <Text variant="display" weight="semibold">Astrology</Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>
          {profile?.preferredSystem === 'vedic' ? 'Vedic' : 'Western'} astrology
        </Text>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Card onPress={() => navigation.navigate('SelectAstrologyProfile', { path: 'vedic' })}>
          <View style={styles.row}>
            <Compass size={18} color={color.accent} strokeWidth={1.75} />
            <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm }}>Vedic Astrology</Text>
          </View>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>Generate your kundli: North India, South India, or Western chart styles</Text>
        </Card>
        <Card onPress={() => navigation.navigate('SelectAstrologyProfile', { path: 'soulEnergy' })} style={{ marginTop: spacing.sm }}>
          <View style={styles.row}>
            <Orbit size={18} color={color.accent} strokeWidth={1.75} />
            <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm }}>Soul Energy Reading</Text>
          </View>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>An AI-generated personality reading grounded in your real chart</Text>
        </Card>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
