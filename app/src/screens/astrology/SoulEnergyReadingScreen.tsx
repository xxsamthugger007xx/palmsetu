import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronDown, ChevronUp, Info } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { kundliApi } from '../../services/kundliApi';
import { SoulEnergyReading } from '../../types/kundli';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type LoadState = 'loading' | 'needsProfile' | 'ready' | 'error';

type Section = { key: string; title: string; render: (r: SoulEnergyReading) => React.ReactNode };

const SECTIONS: Section[] = [
  { key: 'corePersonality', title: 'Core Personality', render: (r) => <Text variant="bodySm" tone="secondary">{r.corePersonality}</Text> },
  { key: 'mindAndEmotions', title: 'Mind & Emotions', render: (r) => <Text variant="bodySm" tone="secondary">{r.mindAndEmotions}</Text> },
  { key: 'careerStyle', title: 'Career Style', render: (r) => <Text variant="bodySm" tone="secondary">{r.careerStyle}</Text> },
  { key: 'loveAndRelationships', title: 'Love & Relationships', render: (r) => <Text variant="bodySm" tone="secondary">{r.loveAndRelationships}</Text> },
  {
    key: 'strengths', title: 'Strengths',
    render: (r) => (
      <View>
        {r.strengths.map((s, i) => (
          <Text key={i} variant="bodySm" tone="secondary" style={{ marginTop: i === 0 ? 0 : 4 }}>{'•'} {s}</Text>
        ))}
      </View>
    ),
  },
  {
    key: 'challenges', title: 'Challenges',
    render: (r) => (
      <View>
        {r.challenges.map((s, i) => (
          <Text key={i} variant="bodySm" tone="secondary" style={{ marginTop: i === 0 ? 0 : 4 }}>{'•'} {s}</Text>
        ))}
      </View>
    ),
  },
  { key: 'balanceTip', title: 'Balance Tip', render: (r) => <Text variant="bodySm" tone="secondary">{r.balanceTip}</Text> },
];

export function SoulEnergyReadingScreen() {
  const navigation = useNavigation<Nav>();
  const [state, setState] = useState<LoadState>('loading');
  const [reading, setReading] = useState<SoulEnergyReading | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['corePersonality']));

  const load = useCallback(async () => {
    setState('loading');
    try {
      await astrologyApi.getProfile();
      const r = await kundliApi.getSoulEnergy(kundliApi.todayLocalDate());
      setReading(r);
      setState('ready');
    } catch (err: any) {
      setState(err.status === 404 ? 'needsProfile' : 'error');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (state === 'loading') {
    return <PageContainer><Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Generating your reading...</Text></PageContainer>;
  }

  if (state === 'needsProfile') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Soul Energy Reading</Text>
        <EmptyState
          icon={Info}
          title="Set up your birth details first"
          description="Your Soul Energy Reading is grounded in the same birth chart as Daily Cosmic Guidance."
          actionLabel="Set up birth details"
          onAction={() => navigation.navigate('AstrologyProfileSetup')}
        />
      </PageContainer>
    );
  }

  if (state === 'error' || !reading) {
    return <PageContainer><EmptyState icon={Info} title="Couldn't generate this reading" actionLabel="Retry" onAction={load} /></PageContainer>;
  }

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Soul Energy Reading</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        AI-generated, grounded in your real Sun/Moon chart.
      </Text>
      {reading.dataCompleteness === 'partial' && (
        <Text variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>
          Based on Sun and Moon sign only - your ascendant isn't available (requires exact birth coordinates).
        </Text>
      )}

      {SECTIONS.map(({ key, title, render }) => {
        const isOpen = expanded.has(key);
        return (
          <Card key={key} onPress={() => toggle(key)} style={{ marginBottom: spacing.sm }}>
            <View style={styles.row}>
              <Text variant="bodySm" weight="semibold" style={{ flex: 1 }}>{title}</Text>
              {isOpen ? <ChevronUp size={18} color={color.textMuted} strokeWidth={1.75} /> : <ChevronDown size={18} color={color.textMuted} strokeWidth={1.75} />}
            </View>
            {isOpen && <View style={{ marginTop: spacing.sm }}>{render(reading)}</View>}
          </Card>
        );
      })}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
