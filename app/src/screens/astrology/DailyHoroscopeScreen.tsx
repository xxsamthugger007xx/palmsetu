import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronDown, ChevronUp, Info } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FadeDivider } from '../../components/FadeDivider';
import { ZodiacWheel } from '../../components/ZodiacWheel';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { DailyHoroscope } from '../../types/astrology';

type LoadState = 'loading' | 'ready' | 'failed' | 'error';

export function DailyHoroscopeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DailyHoroscope'>>();
  const { localDate } = route.params;

  const [state, setState] = useState<LoadState>('loading');
  const [daily, setDaily] = useState<DailyHoroscope | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = async () => {
    setState('loading');
    try {
      const res = await astrologyApi.getDaily(localDate);
      setDaily(res);
      setState(res.generationStatus === 'failed' ? 'failed' : 'ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => { load(); }, [localDate]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await astrologyApi.retryDaily(localDate);
      setDaily(res);
      setState('ready');
    } catch {
      setState('error');
    } finally {
      setRetrying(false);
    }
  };

  const handleAsk = async () => {
    if (!daily || !question.trim()) return;
    setAsking(true);
    try {
      const res = await astrologyApi.askFollowup(daily.id, question.trim());
      setAnswers((prev) => [...prev, `Q: ${question.trim()}\n\n${res.answer}`]);
      setQuestion('');
    } catch (err: any) {
      setAnswers((prev) => [...prev, `Couldn't get a response: ${err.message ?? 'please try again.'}`]);
    } finally {
      setAsking(false);
    }
  };

  if (state === 'loading') {
    return <PageContainer><Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Loading...</Text></PageContainer>;
  }

  if (state === 'error' || !daily) {
    return (
      <PageContainer>
        <EmptyState icon={Info} title="Couldn't load this reading" actionLabel="Retry" onAction={load} />
      </PageContainer>
    );
  }

  if (state === 'failed') {
    return (
      <PageContainer>
        <EmptyState
          icon={Info}
          title="Generation didn't complete"
          description="We couldn't finish generating today's reading. You can retry."
          actionLabel="Retry generation"
          onAction={handleRetry}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="caption" tone="muted">{new Date(daily.localDate).toLocaleDateString()}</Text>
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{daily.dailyTheme}</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        {daily.astrologySystem === 'vedic' ? 'Vedic' : 'Western'} · {daily.dataCompleteness === 'partial' ? 'Based on birth date only' : 'Full birth data'}
      </Text>

      <Card elevated style={{ alignItems: 'center', marginBottom: spacing.sm }}>
        <ZodiacWheel
          size={200}
          points={daily.transitContext.planets.map((p) => ({ label: p.body, sign: p.sign }))}
        />
        <FadeDivider style={{ marginVertical: spacing.md }} />
        <View style={{ width: '100%' }}>
          {daily.transitContext.planets.map((p) => (
            <View key={p.body} style={styles.transitRow}>
              <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>{p.body}</Text>
              <Text variant="bodySm" weight="semibold" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{p.sign}</Text>
              <Text variant="bodySm" tone="muted" style={{ flex: 1, fontVariant: ['tabular-nums'], textAlign: 'right' }}>
                {p.longitude.toFixed(1)}° {p.retrograde ? 'R' : ''}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Section title="Your day at a glance"><Text variant="bodySm" tone="secondary">{daily.summary}</Text></Section>

      <Section title="Today's focus">
        <Text variant="bodySm" tone="secondary">{daily.focus.priority}</Text>
        <Text variant="bodySm" tone="accent" style={{ marginTop: spacing.xs }}>{daily.focus.action}</Text>
      </Section>

      <Section title="Career & productivity"><Text variant="bodySm" tone="secondary">{daily.careerGuidance}</Text></Section>
      <Section title="Love & relationships"><Text variant="bodySm" tone="secondary">{daily.relationshipGuidance}</Text></Section>
      <Section title="Mood & self-care"><Text variant="bodySm" tone="secondary">{daily.selfCarePrompt}</Text></Section>

      <Section title="What to do today">
        {daily.doSuggestions.map((s) => <Text key={s} variant="bodySm" tone="secondary" style={{ marginBottom: 4 }}>• {s}</Text>)}
      </Section>

      <Section title="What to be mindful of">
        {daily.mindfulOfSuggestions.map((s) => <Text key={s} variant="bodySm" tone="secondary" style={{ marginBottom: 4 }}>• {s}</Text>)}
      </Section>

      <Section title="A small daily challenge"><Text variant="bodySm" tone="secondary">{daily.dailyChallenge}</Text></Section>
      <Section title="Reflection question"><Text variant="bodySm" tone="accent">{daily.reflectionQuestion}</Text></Section>

      <Card style={{ marginBottom: spacing.sm }} onPress={() => setExplanationOpen((o) => !o)}>
        <View style={styles.sectionHeader}>
          <Text variant="bodySm" weight="semibold">Astrology behind this reading</Text>
          {explanationOpen ? <ChevronUp size={16} color={color.textMuted} /> : <ChevronDown size={16} color={color.textMuted} />}
        </View>
        {explanationOpen && (
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{daily.astrologicalExplanation}</Text>
        )}
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>Ask a follow-up question</Text>
        {answers.map((a, i) => (
          <Card key={i} style={{ marginBottom: spacing.sm }}><Text variant="bodySm" tone="secondary">{a}</Text></Card>
        ))}
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Ask about today's reading..."
          placeholderTextColor={color.textMuted}
          style={styles.input}
        />
        <Button label="Ask" loading={asking} style={{ marginTop: spacing.sm }} onPress={handleAsk} />
      </View>
    </PageContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <Text variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>{title.toUpperCase()}</Text>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  transitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: color.textPrimary,
  },
});
