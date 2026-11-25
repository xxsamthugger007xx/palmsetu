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
import { formatLongDate } from '../../utils/formatDate';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
import { ListSkeleton } from '../../components/ListSkeleton';
type LoadState = 'loading' | 'ready' | 'failed' | 'error';

export function DailyHoroscopeScreen() {
  const { t } = useTranslation();
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
    } catch (__err) {
      const err = asApiError(__err);
      setAnswers((prev) => [...prev, `Couldn't get a response: ${err.message ?? 'please try again.'}`]);
    } finally {
      setAsking(false);
    }
  };

  if (state === 'loading') {
    return <PageContainer><ListSkeleton rows={3} /></PageContainer>;
  }

  if (state === 'error' || !daily) {
    return (
      <PageContainer>
        <EmptyState icon={Info} title={t('ui.DailyHoroscopeScreen.couldnTLoadThisReading')} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} />
      </PageContainer>
    );
  }

  if (state === 'failed') {
    return (
      <PageContainer>
        <EmptyState
          icon={Info}
          title={t('ui.DailyHoroscopeScreen.generationDidnTComplete')}
          description={t('ui.DailyHoroscopeScreen.weCouldnTFinishGenerating')}
          actionLabel={t('ui.DailyHoroscopeScreen.retryGeneration')}
          onAction={handleRetry}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="caption" tone="muted">{formatLongDate(daily.localDate)}</Text>
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{daily.dailyTheme}</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        {daily.astrologySystem === 'vedic' ? 'Vedic' : 'Western'} · {daily.dataCompleteness === 'partial' ? 'Based on birth date only' : 'Full birth data'}
      </Text>

      <Card elevated style={{ alignItems: 'center', marginBottom: spacing.sm }}>
        <ZodiacWheel
          size={200}
          points={daily.transitContext.planets.map((p) => ({
            label: p.body,
            sign: daily.astrologySystem === 'vedic' ? p.signSidereal : p.sign,
          }))}
        />
        <FadeDivider style={{ marginVertical: spacing.md }} />
        <View style={{ width: '100%' }}>
          {daily.transitContext.planets.map((p) => (
            <View key={p.body} style={styles.transitRow}>
              <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>{p.body}</Text>
              <Text variant="bodySm" weight="semibold" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
                {daily.astrologySystem === 'vedic' ? p.signSidereal : p.sign}
              </Text>
              <Text variant="bodySm" tone="muted" style={{ flex: 1, fontVariant: ['tabular-nums'], textAlign: 'right' }}>
                {(daily.astrologySystem === 'vedic' ? p.longitudeSidereal : p.longitude).toFixed(1)}° {p.retrograde ? 'R' : ''}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Section title={t('ui.DailyHoroscopeScreen.yourDayAtAGlance')}><Text variant="bodySm" tone="secondary">{daily.summary}</Text></Section>

      <Section title={t('ui.DailyHoroscopeScreen.todaySFocus')}>
        <Text variant="bodySm" tone="secondary">{daily.focus.priority}</Text>
        <Text variant="bodySm" tone="accent" style={{ marginTop: spacing.xs }}>{daily.focus.action}</Text>
      </Section>

      <Section title={t('ui.DailyHoroscopeScreen.careerProductivity')}><Text variant="bodySm" tone="secondary">{daily.careerGuidance}</Text></Section>
      <Section title={t('ui.DailyHoroscopeScreen.loveRelationships')}><Text variant="bodySm" tone="secondary">{daily.relationshipGuidance}</Text></Section>
      <Section title={t('ui.DailyHoroscopeScreen.moodSelfCare')}><Text variant="bodySm" tone="secondary">{daily.selfCarePrompt}</Text></Section>

      <Section title={t('ui.DailyHoroscopeScreen.whatToDoToday')}>
        {daily.doSuggestions.map((s) => <Text key={s} variant="bodySm" tone="secondary" style={{ marginBottom: 4 }}>• {s}</Text>)}
      </Section>

      <Section title={t('ui.DailyHoroscopeScreen.whatToBeMindfulOf')}>
        {daily.mindfulOfSuggestions.map((s) => <Text key={s} variant="bodySm" tone="secondary" style={{ marginBottom: 4 }}>• {s}</Text>)}
      </Section>

      <Section title={t('ui.DailyHoroscopeScreen.aSmallDailyChallenge')}><Text variant="bodySm" tone="secondary">{daily.dailyChallenge}</Text></Section>
      <Section title={t('ui.DailyHoroscopeScreen.reflectionQuestion')}><Text variant="bodySm" tone="accent">{daily.reflectionQuestion}</Text></Section>

      <Card style={{ marginBottom: spacing.sm }} onPress={() => setExplanationOpen((o) => !o)}>
        <View style={styles.sectionHeader}>
          <Text variant="bodySm" weight="semibold">{t('ui.DailyHoroscopeScreen.astrologyBehindThisReading')}</Text>
          {explanationOpen ? <ChevronUp size={16} color={color.textMuted} /> : <ChevronDown size={16} color={color.textMuted} />}
        </View>
        {explanationOpen && (
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{daily.astrologicalExplanation}</Text>
        )}
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>{t('ui.DailyHoroscopeScreen.askAFollowUpQuestion')}</Text>
        {answers.map((a, i) => (
          <Card key={i} style={{ marginBottom: spacing.sm }}><Text variant="bodySm" tone="secondary">{a}</Text></Card>
        ))}
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder={t('ui.DailyHoroscopeScreen.askAboutTodaySReading')} accessibilityLabel={t('ui.DailyHoroscopeScreen.askAboutTodaySReading')}
          placeholderTextColor={color.textMuted}
          style={styles.input}
        />
        <Button label={t('ui.DailyHoroscopeScreen.ask')} loading={asking} style={{ marginTop: spacing.sm }} onPress={handleAsk} />
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
