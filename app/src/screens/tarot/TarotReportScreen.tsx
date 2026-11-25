import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ShareCard } from '../../components/ShareCard';
import { shareCardImage } from '../../services/shareCard';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft, ChevronDown, ChevronUp, Bookmark, Share2, NotebookPen, Info, Trash2, Sparkles, Lock,
  CheckCircle2, XCircle, HelpCircle, Sparkle, Moon, MessageCircle, Send,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SignUpPromptCard } from '../../components/SignUpPromptCard';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { TarotCardFace } from '../../components/TarotCardFace';
import { TarotCardInfoModal } from '../../components/TarotCardInfoModal';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { color, radius, spacing } from '../../theme/tokens';
import { tarotColor } from '../../theme/tarotTheme';
import { RootStackParamList } from '../../navigation/types';
import { tarotApi } from '../../services/tarotApi';
import { TarotCard, TarotReading, formatSpreadLabel } from '../../types/tarot';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
type LoadState = 'loading' | 'interpreting' | 'ready' | 'error';

export function TarotReportScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TarotReport'>>();
  const { readingId } = route.params;

  const [state, setState] = useState<LoadState>('loading');
  const [reading, setReading] = useState<TarotReading | null>(null);
  const [cardsById, setCardsById] = useState<Record<string, TarotCard>>({});
  const [expanded, setExpanded] = useState<number | null>(0);
  const [followupQuestion, setFollowupQuestion] = useState('');
  const [askingFollowup, setAskingFollowup] = useState(false);
  const [followupError, setFollowupError] = useState<string | null>(null);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const [tier, setTier] = useState<'free' | 'premium'>('free');
  const [journalText, setJournalText] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [infoDraw, setInfoDraw] = useState<{ cardId: string; orientation: 'upright' | 'reversed' } | null>(null);

  // Pure display substitution, never mutates stored data - see
  // TarotDrawScreen's identical helper for why.
  const displayPositionName = (name: string) => (name === 'Them' && reading?.secondPersonName ? reading.secondPersonName : name);

  const load = async () => {
    setState('loading');
    try {
      const [readingRes, catalogueRes, limitsRes] = await Promise.all([
        tarotApi.getReading(readingId),
        tarotApi.getCatalogue(),
        tarotApi.getLimits(),
      ]);
      setCardsById(Object.fromEntries(catalogueRes.cards.map((c) => [c.id, c])));
      setTier(limitsRes.tier);

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
    const question = followupQuestion.trim();
    if (!question || !reading) return;
    setFollowupError(null);
    setAskingFollowup(true);
    // Optimistic bubble so the conversation feels immediate - replaced by
    // the real persisted message once the server responds, or removed on
    // error (never left showing a fabricated answer).
    const optimistic = { question, answer: '', createdAt: new Date().toISOString() };
    setReading({ ...reading, followupMessages: [...reading.followupMessages, optimistic] });
    setFollowupQuestion('');
    try {
      const res = await tarotApi.askFollowup(readingId, question);
      setReading((prev) => prev ? {
        ...prev,
        followupMessages: [...prev.followupMessages.slice(0, -1), { question, answer: res.answer, createdAt: new Date().toISOString() }],
      } : prev);
      if (typeof res.remainingToday === 'number') setRemainingToday(res.remainingToday);
    } catch (__err) {
      const err = asApiError(__err);
      setReading((prev) => prev ? { ...prev, followupMessages: prev.followupMessages.slice(0, -1) } : prev);
      if (err.code === 'PREMIUM_REQUIRED') {
        navigation.navigate('Paywall');
      } else {
        setFollowupError(err.message ?? t('ui.TarotReportScreen.couldNotGetAResponse'));
      }
    } finally {
      setAskingFollowup(false);
    }
  };

  const SUGGESTED_FOLLOWUPS = ['What should I focus on first?', 'How do these cards connect?', 'What should I be mindful of?'];

  const handleSave = async () => {
    if (!reading) return;
    const updated = await tarotApi.saveReading(reading.id, !reading.saved);
    setReading(updated);
  };

  const shareRef = React.useRef<any>(null);
  const handleShare = async () => {
    if (!reading) return;
    const summary = reading.interpretation?.overallInterpretation ?? 'My tarot reading from Palm Setu.';
    await shareCardImage(shareRef, `${summary}\n\n - via Palm Setu (readings are for reflection, not prediction)`);
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
    } catch (__err) {
      const err = asApiError(__err);
      if (err.code === 'PREMIUM_REQUIRED') {
        navigation.navigate('Paywall');
      } else {
        setUnlockError(err.message ?? t('ui.TarotReportScreen.somethingWentWrongGeneratingYour'));
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
        <EmptyState icon={Info} title={t('ui.DailyHoroscopeScreen.couldnTLoadThisReading')} description={t('ui.TarotReportScreen.checkYourConnectionAndTry')} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} />
      </PageContainer>
    );
  }

  const shareDraws = reading.draws.slice(0, 3);
  const firstCard = cardsById[reading.draws[0]?.cardId];
  const shareTitle = reading.draws.length === 1 && firstCard ? `${firstCard.name}${reading.draws[0].orientation === 'reversed' ? ' (reversed)' : ''}` : formatSpreadLabel(reading.spreadType);
  const shareBody = reading.interpretation?.cardInterpretations?.[0]?.text?.split(' - ').slice(1).join(' - ') ?? reading.interpretation?.overallInterpretation ?? null;

  return (
    <PageContainer onRefresh={load}>
      {/* Off-screen picture used by the Share button; never visible. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -2000, top: 0 }}>
        <ShareCard viewRef={shareRef} kind="tarot" eyebrow={t('share.tarotEyebrow')} title={shareTitle} body={shareBody} tagline={t('share.tagline')}>
          {shareDraws.map((d) => (
            <TarotCardFace key={d.positionIndex} card={cardsById[d.cardId]} orientation={d.orientation} width={shareDraws.length === 1 ? 120 : 84} height={shareDraws.length === 1 ? 184 : 130} />
          ))}
        </ShareCard>
      </View>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <IconButton icon={Bookmark} tone={reading.saved ? color.accent : color.textSecondary} onPress={handleSave} />
          <IconButton icon={Share2} onPress={handleShare} />
          <IconButton icon={Trash2} tone={color.danger} onPress={() => setConfirmDelete(true)} />
        </View>
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>
        {formatSpreadLabel(reading.spreadType)}
      </Text>
      <Text variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        {new Date(reading.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
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
          <Text variant="label" tone="muted" style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>{t('ui.TarotReportScreen.context')}</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 2, textAlign: 'left', alignSelf: 'stretch' }}>
            {reading.interpretation.yesNo.context}
          </Text>
          <Text variant="label" tone="muted" style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>{t('ui.TarotReportScreen.advice')}</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 2, textAlign: 'left', alignSelf: 'stretch' }}>
            {reading.interpretation.yesNo.advice}
          </Text>
        </Card>
      )}

      <View style={styles.cardsRow}>
        {reading.draws.map((d) => (
          <View key={d.positionIndex} style={styles.cardSlot}>
            <Pressable onPress={() => setInfoDraw({ cardId: d.cardId, orientation: d.orientation })} accessibilityRole="button" accessibilityLabel={`Card info for ${cardsById[d.cardId]?.name ?? 'card'}`}>
              <TarotCardFace card={cardsById[d.cardId]} orientation={d.orientation} width={90} height={138} />
            </Pressable>
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, textAlign: 'center' }}>{displayPositionName(d.positionName)}</Text>
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
                <Text variant="bodySm" weight="semibold">{displayPositionName(d.positionName)} - {card?.name} ({d.orientation})</Text>
                {isExpanded ? <ChevronUp size={16} color={color.textMuted} /> : <ChevronDown size={16} color={color.textMuted} />}
              </View>
              {isExpanded && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text variant="bodySm" tone="secondary">{interp?.text}</Text>
                  {card && (
                    <>
                      <Text variant="label" tone="muted" style={{ marginTop: spacing.sm }}>{t('ui.TarotReportScreen.symbolism')}</Text>
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
          <Text variant="label" tone="accent">{t('ui.TarotReportScreen.overallReflection')}</Text>
          <Text variant="bodySm" style={{ marginTop: spacing.sm }}>{reading.interpretation?.overallInterpretation}</Text>
          {reading.interpretation?.reflectionPrompts.map((q) => (
            <Text key={q} variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>• {q}</Text>
          ))}
        </Card>
      )}

      {reading.detailedReportStatus === 'ready' && reading.detailedReport ? (
        <Card elevated style={{ marginTop: spacing.lg, borderColor: tarotColor.goldMuted }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Sparkles size={16} color={tarotColor.gold} strokeWidth={1.75} />
            <Text variant="label" style={{ color: tarotColor.gold, marginLeft: spacing.xs }}>{t('ui.TarotReportScreen.detailedAiReading')}</Text>
          </View>
          <Text variant="bodySm" style={{ marginTop: spacing.sm }}>{reading.detailedReport.overallInterpretation}</Text>

          {reading.detailedReport.cardInterpretations.map((c) => {
            const draw = reading.draws.find((d) => d.positionIndex === c.positionIndex);
            return (
              <View key={c.positionIndex} style={{ marginTop: spacing.md }}>
                <Text variant="caption" tone="muted">{displayPositionName(draw?.positionName ?? '').toUpperCase()}</Text>
                <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>{c.text}</Text>
              </View>
            );
          })}

          {reading.detailedReport.practicalSuggestions && reading.detailedReport.practicalSuggestions.length > 0 && (
            <>
              <Text variant="label" tone="muted" style={{ marginTop: spacing.md }}>{t('ui.TarotReportScreen.practicalSuggestions')}</Text>
              {reading.detailedReport.practicalSuggestions.map((s) => (
                <Text key={s} variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>• {s}</Text>
              ))}
            </>
          )}

          <Text variant="label" tone="muted" style={{ marginTop: spacing.md }}>{t('ui.TarotReportScreen.reflectionQuestions')}</Text>
          {reading.detailedReport.reflectionPrompts.map((q) => (
            <Text key={q} variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>• {q}</Text>
          ))}

          {reading.detailedReport.birthChartPerspective && (
            <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: color.borderSubtle }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Moon size={14} color={color.accent} strokeWidth={1.75} />
                <Text variant="label" tone="accent" style={{ marginLeft: spacing.xs }}>{t('ui.TarotReportScreen.yourBirthChartPerspective')}</Text>
              </View>
              <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>
                {reading.detailedReport.birthChartPerspective}
              </Text>
            </View>
          )}
        </Card>
      ) : (
        <Card elevated style={{ marginTop: spacing.lg, alignItems: 'center', borderColor: tarotColor.goldMuted }}>
          <Lock size={20} color={tarotColor.gold} strokeWidth={1.75} />
          <Text variant="subtitle" weight="semibold" style={{ marginTop: spacing.sm }}>{t('ui.TarotReportScreen.goDeeperWithAi')}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, marginBottom: spacing.md, textAlign: 'center' }}>
            {t('ui.TarotReportScreen.exploreTheSymbolismOfYour')}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MessageCircle size={16} color={tarotColor.gold} strokeWidth={1.75} />
            <Text variant="subtitle" weight="semibold" style={{ marginLeft: spacing.xs }}>{t('ui.PalmReportScreen.askAboutThisReading')}</Text>
          </View>
          {tier === 'premium' && remainingToday !== null && (
            <Text variant="caption" tone="muted">{remainingToday} left today</Text>
          )}
        </View>

        {tier !== 'premium' ? (
          <Card elevated style={{ marginTop: spacing.sm, alignItems: 'center', borderColor: tarotColor.goldMuted }}>
            <Lock size={18} color={tarotColor.gold} strokeWidth={1.75} />
            <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.sm }}>{t('ui.TarotReportScreen.followUpQuestionsAreA')}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, marginBottom: spacing.md, textAlign: 'center' }}>
              {t('ui.TarotReportScreen.askAnythingAboutThisSpecific')}
            </Text>
            <Button label={t('ui.TarotReportScreen.upgradeToPremium')} icon={Sparkles} onPress={() => navigation.navigate('Paywall')} />
          </Card>
        ) : (
          <>
            {reading.followupMessages.length === 0 && !askingFollowup ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text variant="caption" tone="muted">{t('ui.TarotReportScreen.tryAsking')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                  {SUGGESTED_FOLLOWUPS.map((q) => (
                    <Card key={q} style={styles.suggestionChip} onPress={() => setFollowupQuestion(q)}>
                      <Text variant="caption" style={{ color: tarotColor.lavender }}>{q}</Text>
                    </Card>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                {reading.followupMessages.map((m, i) => (
                  <View key={i} style={{ marginBottom: spacing.md }}>
                    <View style={[styles.bubble, styles.bubbleUser]}>
                      <Text variant="bodySm" tone="primary">{m.question}</Text>
                    </View>
                    <Text variant="caption" tone="muted" style={styles.bubbleTimestamp}>
                      {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                    {m.answer ? (
                      <View style={[styles.bubble, styles.bubbleAnswer]}>
                        <Text variant="bodySm" tone="secondary">{m.answer}</Text>
                      </View>
                    ) : (
                      <View style={[styles.bubble, styles.bubbleAnswer, { flexDirection: 'row', alignItems: 'center' }]}>
                        <Text variant="bodySm" tone="muted">{t('ui.TarotReportScreen.thinking')}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {followupError && (
              <Text variant="caption" tone="danger" style={{ marginTop: spacing.xs }}>{followupError}</Text>
            )}

            <View style={styles.composerRow}>
              <TextInput
                value={followupQuestion}
                onChangeText={setFollowupQuestion}
                placeholder={t('ui.TarotReportScreen.askAboutThisReading')} accessibilityLabel={t('ui.TarotReportScreen.askAboutThisReading')}
                placeholderTextColor={color.textMuted}
                style={[styles.input, { flex: 1, marginTop: 0 }]}
                editable={!askingFollowup}
              />
              <IconButton icon={Send} onPress={handleAskFollowup} tone={followupQuestion.trim() ? tarotColor.gold : color.textMuted} />
            </View>
          </>
        )}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <NotebookPen size={16} color={color.textPrimary} strokeWidth={1.75} />
          <Text variant="subtitle" weight="semibold" style={{ marginLeft: spacing.xs }}>{t('ui.TarotReportScreen.journalThisReading')}</Text>
        </View>
        <TextInput
          value={journalText}
          onChangeText={setJournalText}
          placeholder={t('ui.TarotReportScreen.privateNotesNeverSharedUnless')} accessibilityLabel={t('ui.TarotReportScreen.privateNotesNeverSharedUnless')}
          placeholderTextColor={color.textMuted}
          style={styles.input}
          multiline
        />
        <Button label={t('ui.TarotReportScreen.saveNote')} variant="secondary" loading={savingJournal} style={{ marginTop: spacing.sm }} onPress={handleSaveJournal} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SignUpPromptCard
          storageKey="tarot-report"
          title={t('ui.TarotReportScreen.saveThisReading')}
          description={t('ui.TarotReportScreen.createAFreeAccountTo')}
        />
      </View>

      <ConfirmationModal
        visible={confirmDelete}
        title={t('ui.TarotReportScreen.deleteThisReading')}
        description={t('ui.TarotReportScreen.thisPermanentlyDeletesTheReading')}
        confirmLabel={t('ui.AssistantHistoryScreen.delete')}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <TarotCardInfoModal
        visible={!!infoDraw}
        card={infoDraw ? cardsById[infoDraw.cardId] ?? null : null}
        orientation={infoDraw?.orientation ?? 'upright'}
        onClose={() => setInfoDraw(null)}
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
  suggestionChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderColor: tarotColor.goldMuted,
  },
  bubble: {
    borderRadius: radius.md,
    padding: spacing.sm,
    maxWidth: '88%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: tarotColor.violet,
  },
  bubbleAnswer: {
    alignSelf: 'flex-start',
    backgroundColor: color.surfaceElevated,
    marginTop: spacing.xs,
  },
  bubbleTimestamp: {
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
});
