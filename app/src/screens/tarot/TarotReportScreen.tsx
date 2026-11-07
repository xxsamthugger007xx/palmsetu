import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft, ChevronDown, ChevronUp, Bookmark, Share2, NotebookPen, Info, Trash2, Sparkles, Lock,
  CheckCircle2, XCircle, HelpCircle, Sparkle,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { TarotCardFace } from '../../components/TarotCardFace';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { tarotApi } from '../../services/tarotApi';
import { TarotCard, TarotReading } from '../../types/tarot';

type LoadState = 'loading' | 'interpreting' | 'ready' | 'error';

export function TarotReportScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TarotReport'>>();
  const { readingId } = route.params;

  const [state, setState] = useState<LoadState>('loading');
  const [reading, setReading] = useState<TarotReading | null>(null);
  const [cardsById, setCardsById] = useState<Record<string, TarotCard>>({});
  const [expanded, setExpanded] = useState<number | null>(0);
  const [followupQuestion, setFollowupQuestion] = useState('');
  const [followupAnswers, setFollowupAnswers] = useState<string[]>([]);
  const [askingFollowup, setAskingFollowup] = useState(false);
  const [journalText, setJournalText] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const load = async () => {
    setState('loading');
    try {
      const [readingRes, catalogueRes] = await Promise.all([
        tarotApi.getReading(readingId),
        tarotApi.getCatalogue(),
      ]);
      setCardsById(Object.fromEntries(catalogueRes.cards.map((c) => [c.id, c])));

      if (readingRes.status === 'drawn') {
        setState('interpreting');
        const interpreted = await tarotApi.interpretReading(readingId);
        setReading(interpreted);
      } else {
        setReading(readingRes);
      }
      setState('ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    load();
  }, [readingId]);

  const handleAskFollowup = async () => {
    if (!followupQuestion.trim()) return;
    setAskingFollowup(true);
    try {
      const res = await tarotApi.askFollowup(readingId, followupQuestion.trim());
      setFollowupAnswers((prev) => [...prev, `Q: ${followupQuestion.trim()}\n\n${res.answer}`]);
      setFollowupQuestion('');
    } catch (err: any) {
      setFollowupAnswers((prev) => [...prev, `Couldn't get a response: ${err.message ?? 'please try again.'}`]);
    } finally {
      setAskingFollowup(false);
    }
  };

  const handleSave = async () => {
    if (!reading) return;
    const updated = await tarotApi.saveReading(reading.id, !reading.saved);
    setReading(updated);
  };

  const handleShare = async () => {
    if (!reading) return;
    const summary = reading.interpretation?.overallInterpretation ?? 'My tarot reading from Solune.';
    await Share.share({ message: `${summary}\n\n - via Solune (readings are for reflection, not prediction)` });
  };

  const handleSaveJournal = async () => {
    if (!journalText.trim()) return;
    setSavingJournal(true);
    try {
      await tarotApi.addJournalEntry(readingId, journalText.trim());
      setJournalText('');
    } finally {
      setSavingJournal(false);
    }
  };

  const handleUnlockDetailed = async () => {
    if (!reading) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const updated = await tarotApi.getDetailedReport(reading.id);
      setReading(updated);
    } catch (err: any) {
      if (err.code === 'PREMIUM_REQUIRED') {
        navigation.navigate('Paywall');
      } else {
        setUnlockError(err.message ?? 'Something went wrong generating your detailed reading.');
      }
    } finally {
      setUnlocking(false);
    }
  };

  const handleDelete = async () => {
    await tarotApi.deleteReading(readingId);
    setConfirmDelete(false);
    navigation.navigate('TarotLanding');
  };

  if (state === 'loading' || state === 'interpreting') {
    return (
      <PageContainer>
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>
          {state === 'interpreting' ? 'Interpreting your reading...' : 'Loading...'}
        </Text>
      </PageContainer>
    );
  }

  if (state === 'error' || !reading) {
    return (
      <PageContainer>
        <EmptyState icon={Info} title="Couldn't load this reading" description="Check your connection and try again." actionLabel="Retry" onAction={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <IconButton icon={Bookmark} tone={reading.saved ? color.accent : color.textSecondary} onPress={handleSave} />
          <IconButton icon={Share2} onPress={handleShare} />
          <IconButton icon={Trash2} tone={color.danger} onPress={() => setConfirmDelete(true)} />
        </View>
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>
        {reading.spreadType.replace(/-/g, ' ')}
      </Text>
      <Text variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        {new Date(reading.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        {reading.interpretation?.modelVersion === 'static-fallback-v1' && ' · Static interpretation (AI unavailable)'}
      </Text>

      {reading.interpretation?.personalizedNote && (
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Sparkle size={14} color={reading.interpretation.personalized ? color.accent : color.textMuted} strokeWidth={1.75} />
            <Text variant="label" tone={reading.interpretation.personalized ? 'accent' : 'muted'} style={{ marginLeft: spacing.xs }}>
              {reading.interpretation.personalized ? 'PERSONALIZED FOR YOUR CHART' : 'NOT PERSONALIZED'}
            </Text>
          </View>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>{reading.interpretation.personalizedNote}</Text>
        </Card>
      )}

      {reading.interpretation?.yesNo && (
        <Card elevated style={{ marginBottom: spacing.md, alignItems: 'center' }}>
          {reading.interpretation.yesNo.tendency === 'yes' && <CheckCircle2 size={28} color={color.accent} strokeWidth={1.75} />}
          {reading.interpretation.yesNo.tendency === 'no' && <XCircle size={28} color={color.danger} strokeWidth={1.75} />}
          {reading.interpretation.yesNo.tendency === 'uncertain' && <HelpCircle size={28} color={color.textMuted} strokeWidth={1.75} />}
          <Text variant="title" weight="semibold" style={{ marginTop: spacing.sm, textTransform: 'capitalize' }}>
            {reading.interpretation.yesNo.tendency}
          </Text>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
            {reading.interpretation.yesNo.traditionalBasis}
          </Text>
          <Text variant="label" tone="muted" style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>CONTEXT</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 2, textAlign: 'left', alignSelf: 'stretch' }}>
            {reading.interpretation.yesNo.context}
          </Text>
          <Text variant="label" tone="muted" style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>ADVICE</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 2, textAlign: 'left', alignSelf: 'stretch' }}>
            {reading.interpretation.yesNo.advice}
          </Text>
        </Card>
      )}

      <View style={styles.cardsRow}>
        {reading.draws.map((d) => (
          <View key={d.positionIndex} style={styles.cardSlot}>
            <TarotCardFace card={cardsById[d.cardId]} orientation={d.orientation} width={90} height={138} />
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, textAlign: 'center' }}>{d.positionName}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        {reading.draws.map((d, i) => {
          const card = cardsById[d.cardId];
          const interp = reading.interpretation?.cardInterpretations.find((c) => c.positionIndex === d.positionIndex);
          const isExpanded = expanded === i;
          return (
            <Card key={d.positionIndex} style={{ marginBottom: spacing.sm }} onPress={() => setExpanded(isExpanded ? null : i)}>
              <View style={styles.sectionHeader}>
                <Text variant="bodySm" weight="semibold">{d.positionName} - {card?.name} ({d.orientation})</Text>
                {isExpanded ? <ChevronUp size={16} color={color.textMuted} /> : <ChevronDown size={16} color={color.textMuted} />}
              </View>
              {isExpanded && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text variant="bodySm" tone="secondary">{interp?.text}</Text>
                  {card && (
                    <>
                      <Text variant="label" tone="muted" style={{ marginTop: spacing.sm }}>SYMBOLISM</Text>
                      <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{card.symbolism}</Text>
                    </>
                  )}
                </View>
              )}
            </Card>
          );
        })}
      </View>

      {!reading.interpretation?.yesNo && (
        <Card elevated style={{ marginTop: spacing.sm }}>
          <Text variant="label" tone="accent">OVERALL REFLECTION</Text>
          <Text variant="bodySm" style={{ marginTop: spacing.sm }}>{reading.interpretation?.overallInterpretation}</Text>
          {reading.interpretation?.reflectionPrompts.map((q) => (
            <Text key={q} variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>• {q}</Text>
          ))}
        </Card>
      )}

      {reading.detailedReportStatus === 'ready' && reading.detailedReport ? (
        <Card elevated style={{ marginTop: spacing.lg, borderColor: color.accentBorder }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Sparkles size={16} color={color.accent} strokeWidth={1.75} />
            <Text variant="label" tone="accent" style={{ marginLeft: spacing.xs }}>DETAILED AI READING</Text>
          </View>
          <Text variant="bodySm" style={{ marginTop: spacing.sm }}>{reading.detailedReport.overallInterpretation}</Text>

          {reading.detailedReport.cardInterpretations.map((c) => {
            const draw = reading.draws.find((d) => d.positionIndex === c.positionIndex);
            return (
              <View key={c.positionIndex} style={{ marginTop: spacing.md }}>
                <Text variant="caption" tone="muted">{draw?.positionName.toUpperCase()}</Text>
                <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>{c.text}</Text>
              </View>
            );
          })}

          {reading.detailedReport.practicalSuggestions && reading.detailedReport.practicalSuggestions.length > 0 && (
            <>
              <Text variant="label" tone="muted" style={{ marginTop: spacing.md }}>PRACTICAL SUGGESTIONS</Text>
              {reading.detailedReport.practicalSuggestions.map((s) => (
                <Text key={s} variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>• {s}</Text>
              ))}
            </>
          )}

          <Text variant="label" tone="muted" style={{ marginTop: spacing.md }}>REFLECTION QUESTIONS</Text>
          {reading.detailedReport.reflectionPrompts.map((q) => (
            <Text key={q} variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>• {q}</Text>
          ))}
        </Card>
      ) : (
        <Card elevated style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <Lock size={20} color={color.accent} strokeWidth={1.75} />
          <Text variant="subtitle" weight="semibold" style={{ marginTop: spacing.sm }}>Go Deeper With AI</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, marginBottom: spacing.md, textAlign: 'center' }}>
            Explore the symbolism of your selected cards, how they connect, and the themes you may want to
            reflect on.
          </Text>
          {unlockError && (
            <Text variant="caption" tone="danger" style={{ marginBottom: spacing.sm, textAlign: 'center' }}>{unlockError}</Text>
          )}
          <Button
            label={reading.detailedReportStatus === 'failed' ? 'Try again' : 'Unlock Detailed Reading'}
            icon={Sparkles}
            loading={unlocking}
            onPress={handleUnlockDetailed}
          />
        </Card>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>Ask a follow-up question</Text>
        {followupAnswers.map((a, i) => (
          <Card key={i} style={{ marginBottom: spacing.sm }}>
            <Text variant="bodySm" tone="secondary">{a}</Text>
          </Card>
        ))}
        <TextInput
          value={followupQuestion}
          onChangeText={setFollowupQuestion}
          placeholder="Ask about this reading..."
          placeholderTextColor={color.textMuted}
          style={styles.input}
        />
        <Button label="Ask" loading={askingFollowup} style={{ marginTop: spacing.sm }} onPress={handleAskFollowup} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <NotebookPen size={16} color={color.textPrimary} strokeWidth={1.75} />
          <Text variant="subtitle" weight="semibold" style={{ marginLeft: spacing.xs }}>Journal this reading</Text>
        </View>
        <TextInput
          value={journalText}
          onChangeText={setJournalText}
          placeholder="Private notes - never shared unless you choose to"
          placeholderTextColor={color.textMuted}
          style={styles.input}
          multiline
        />
        <Button label="Save note" variant="secondary" loading={savingJournal} style={{ marginTop: spacing.sm }} onPress={handleSaveJournal} />
      </View>

      <ConfirmationModal
        visible={confirmDelete}
        title="Delete this reading"
        description="This permanently deletes the reading and any journal notes tied to it."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  cardSlot: { alignItems: 'center', width: 100 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: color.textPrimary,
    minHeight: 44,
  },
});
