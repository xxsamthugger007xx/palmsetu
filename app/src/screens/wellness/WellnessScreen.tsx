import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  NotebookPen, Wind, Target, Info, Sparkles, Trophy, Moon, Check, ChevronRight, TrendingUp,
} from 'lucide-react-native';
import { ErrorBanner } from '../../components/ErrorState';
import { isLoadFailure } from '../../utils/loadFailure';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { color, radius, spacing } from '../../theme/tokens';
import { useUserProfile } from '../../context/UserProfileContext';
import { RootStackParamList } from '../../navigation/types';
import {
  wellnessApi, Habit, InspirationContent, MoodEntry, WellnessGoal,
  ChallengeSummary, ChallengeProgress, ChallengeDefinition,
} from '../../services/wellnessApi';
import { DailyResetHero } from '../../components/wellness/DailyResetHero';
import { MoodPulseSelector, MoodMarkBadge, moodLabel } from '../../components/wellness/MoodPulse';
import { HabitJourneyRow } from '../../components/wellness/HabitJourneyRow';
import { computeDailyResetProgress } from '../../utils/wellnessCompute';
import { MoodLevel } from '../../services/wellnessApi';
import { appLocale } from '../../utils/locale';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function timeOfDayGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'common.greetingMorning';
  if (hour < 18) return 'common.greetingAfternoon';
  return 'common.greetingEvening';
}

type HabitStreak = { currentStreak: number };

const MOOD_COLOR: Record<MoodLevel, string> = {
  great: color.success,
  good: color.secondary,
  okay: color.warning,
  down: color.accent2,
  low: color.danger,
};

const RESET_TILES = [
  { id: 'breathing', icon: Wind, navigate: (nav: Nav) => nav.navigate('BreathingTechniques') },
  { id: 'meditation', icon: Moon, navigate: (nav: Nav) => nav.navigate('Meditation') },
  { id: 'journal', icon: NotebookPen, navigate: (nav: Nav) => nav.navigate('Journal') },
  { id: 'challenges', icon: Trophy, navigate: (nav: Nav) => nav.navigate('Challenges') },
];

export function WellnessScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { profile } = useUserProfile();

  const [todayMood, setTodayMood] = React.useState<MoodEntry | null>(null);
  const [moodChecked, setMoodChecked] = React.useState(false);
  const [quickMood, setQuickMood] = React.useState<MoodLevel | null>(null);
  const [savingMood, setSavingMood] = React.useState(false);

  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [completedToday, setCompletedToday] = React.useState<Set<string>>(new Set());
  const [habitStreaks, setHabitStreaks] = React.useState<Record<string, HabitStreak>>({});

  const [inspiration, setInspiration] = React.useState<InspirationContent | null>(null);
  const [journalToday, setJournalToday] = React.useState(false);
  const [goals, setGoals] = React.useState<WellnessGoal[]>([]);

  const [challengeSummaries, setChallengeSummaries] = React.useState<ChallengeSummary[]>([]);
  const [challengeProgressList, setChallengeProgressList] = React.useState<ChallengeProgress[]>([]);
  const [activeChallengeDef, setActiveChallengeDef] = React.useState<ChallengeDefinition | null>(null);
  const [completingChallenge, setCompletingChallenge] = React.useState(false);

  const [breathingCount, setBreathingCount] = React.useState<number | null>(null);
  const [meditationCount, setMeditationCount] = React.useState<number | null>(null);

  const [moodTrend, setMoodTrend] = React.useState<{ hasData: boolean; checkInCount: number; averageEnergy: number | null; moodDistribution: Record<string, number> } | null>(null);
  const [weeklyActivityCount, setWeeklyActivityCount] = React.useState(0);
  const [weekMoodEntries, setWeekMoodEntries] = React.useState<MoodEntry[]>([]);

  const activeChallengeProgress = challengeProgressList.find((p) => p.status === 'active') ?? null;
  const activeChallengeSummary = activeChallengeProgress
    ? challengeSummaries.find((c) => c.id === activeChallengeProgress.challengeId) ?? null
    : null;
  const challengeCompletedToday = !!activeChallengeProgress?.completedDays.includes(activeChallengeProgress.currentDay);

  const [loadFailed, setLoadFailed] = React.useState(false);

  const loadWellnessData = React.useCallback(async () => {
      const today = wellnessApi.todayLocalDate();
      setLoadFailed(false);
      const noteFailure = (err: unknown) => { if (isLoadFailure(err)) setLoadFailed(true); };

      wellnessApi.getMoodForDate(today)
        .then((res) => { setTodayMood(res.entry); setMoodChecked(true); })
        .catch((err) => { setTodayMood(null); setMoodChecked(true); noteFailure(err); });

      wellnessApi.getHabits(today).then((res) => {
        setHabits(res.habits);
        // Real "done today" state from the server, so checked habits stay checked after leaving/reopening.
        setCompletedToday(new Set(res.completedHabitIds ?? []));
        res.habits.forEach((h) => {
          wellnessApi.getHabitStreak(h.id)
            .then((s) => setHabitStreaks((prev) => ({ ...prev, [h.id]: { currentStreak: s.currentStreak } })))
            .catch(() => {});
        });
      }).catch((err) => { setHabits([]); noteFailure(err); });

      wellnessApi.getTodayInspiration().then((res) => setInspiration(res.content)).catch(() => setInspiration(null));

      wellnessApi.listJournalEntries({ from: today })
        .then((res) => setJournalToday(res.entries.length > 0))
        .catch(() => setJournalToday(false));

      wellnessApi.getGoals('active').then((res) => setGoals(res.goals)).catch((err) => { setGoals([]); noteFailure(err); });

      Promise.all([wellnessApi.getChallenges(), wellnessApi.getMyChallengeProgress()])
        .then(([c, p]) => {
          setChallengeSummaries(c.challenges);
          setChallengeProgressList(p.progress);
          const active = p.progress.find((x) => x.status === 'active');
          if (active) {
            wellnessApi.getChallenge(active.challengeId).then((d) => setActiveChallengeDef(d.challenge)).catch(() => {});
          } else {
            setActiveChallengeDef(null);
          }
        })
        .catch((err) => { setChallengeSummaries([]); setChallengeProgressList([]); noteFailure(err); });

      wellnessApi.getBreathingTechniques().then((res) => setBreathingCount(res.techniques.length)).catch(() => setBreathingCount(null));
      wellnessApi.getMeditationCatalogue().then((res) => setMeditationCount(res.items.length)).catch(() => setMeditationCount(null));

      wellnessApi.getMoodTrends('week').then((res) => setMoodTrend(res)).catch(() => setMoodTrend(null));

      // Real per-day check-in history for the dashboard strip below - a
      // count alone ("2 check-ins this week") hides which specific days
      // were logged, so this pulls the actual dated entries instead.
      wellnessApi.getMoodHistory().then((res) => setWeekMoodEntries(res.entries)).catch(() => setWeekMoodEntries([]));

      // "This week's activity count" - a real, modest count of logged
      // wellness actions this week, from data already fetched above rather
      // than a separate invented metric: mood check-ins in the trend window.
      wellnessApi.getMoodTrends('week').then((res) => setWeeklyActivityCount(res.checkInCount)).catch(() => setWeeklyActivityCount(0));
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadWellnessData();
    }, [loadWellnessData])
  );

  const toggleHabit = async (habit: Habit) => {
    const today = wellnessApi.todayLocalDate();
    const already = completedToday.has(habit.id);
    try {
      if (already) {
        await wellnessApi.uncompleteHabit(habit.id, today);
        setCompletedToday((prev) => { const next = new Set(prev); next.delete(habit.id); return next; });
      } else {
        await wellnessApi.completeHabit(habit.id, today);
        setCompletedToday((prev) => new Set(prev).add(habit.id));
        wellnessApi.sendAnalyticsEvent('habit_completed', { habitId: habit.id }).catch(() => {});
      }
      wellnessApi.getHabitStreak(habit.id)
        .then((s) => setHabitStreaks((prev) => ({ ...prev, [habit.id]: { currentStreak: s.currentStreak } })))
        .catch(() => {});
    } catch {
      // Honest failure: no optimistic state is kept if the request failed.
    }
  };

  const quickSaveMood = async (mood: MoodLevel) => {
    setQuickMood(mood);
    setSavingMood(true);
    try {
      const today = wellnessApi.todayLocalDate();
      const res = await wellnessApi.saveMood({ localDate: today, mood, energy: 3, stress: 3, sleepQuality: 3 });
      setTodayMood(res.entry);
    } catch {
      setQuickMood(null);
    } finally {
      setSavingMood(false);
    }
  };

  const completeChallengeToday = async () => {
    if (!activeChallengeProgress || completingChallenge || challengeCompletedToday) return;
    setCompletingChallenge(true);
    try {
      const res = await wellnessApi.completeChallengeDay(activeChallengeProgress.challengeId, activeChallengeProgress.currentDay);
      setChallengeProgressList((prev) => prev.map((p) => (p.challengeId === res.progress.challengeId ? res.progress : p)));
    } catch {
      // Honest failure: no optimistic completion kept.
    } finally {
      setCompletingChallenge(false);
    }
  };

  const habitsDoneCount = habits.filter((h) => completedToday.has(h.id)).length;

  const last7Days = React.useMemo(() => {
    const today = new Date();
    const days: { localDate: string; entry: MoodEntry | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ localDate, entry: weekMoodEntries.find((e) => e.localDate === localDate) ?? null });
    }
    return days;
  }, [weekMoodEntries]);

  const dailyReset = computeDailyResetProgress({
    moodLoggedToday: !!todayMood,
    activeHabitCount: habits.length,
    habitsCompletedToday: habitsDoneCount,
    hasActiveChallenge: !!activeChallengeProgress,
    challengeCompletedToday,
    journalWrittenToday: journalToday,
  });

  const todaysTask = activeChallengeDef?.tasks.find((t) => t.day === activeChallengeProgress?.currentDay) ?? null;

  const subtitle = inspiration?.text
    ? inspiration.text
    : todaysTask?.title
      ? t('wellness.todaySubtitle', { title: todaysTask.title })
      : t('wellness.defaultSubtitle');

  return (
    <PageContainer style={{ paddingBottom: spacing.xxl + 96 }} onRefresh={loadWellnessData}>
      {loadFailed && <ErrorBanner message={t('ui.WellnessScreen.someOfYourWellnessData')} onRetry={loadWellnessData} />}
      {/* A. Header */}
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: 2 }}>
        {t(timeOfDayGreetingKey())}{profile?.name ? `, ${profile.name}` : ''}
      </Text>
      <Text variant="caption" tone="muted" style={{ marginBottom: 4 }}>
        {new Date().toLocaleDateString(appLocale(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </Text>
      <Text variant="bodySm" tone="secondary" numberOfLines={2} style={{ marginBottom: spacing.lg }}>
        {subtitle}
      </Text>

      {/* B. Daily Reset hero */}
      <DailyResetHero progress={dailyReset} name={profile?.name} />

      {/* C. Mood check-in */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title={t('wellness.moodSectionTitle')} action={t('wellness.historyAction')} onActionPress={() => navigation.navigate('MoodHistory')} />
        <Card elevated>
          {todayMood ? (
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('MoodCheckIn')} style={styles.moodDoneRow}>
              <MoodMarkBadge mood={todayMood.mood} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="bodySm" weight="semibold">{t('common.feelingToday', { mood: moodLabel(todayMood.mood).toLowerCase() })}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t('common.tapToEditCheckIn')}</Text>
              </View>
              <ChevronRight size={16} color={color.textMuted} />
            </Pressable>
          ) : (
            <>
              <Text variant="bodySm" weight="semibold" style={{ marginBottom: spacing.sm }}>{t('wellness.feelingNowPrompt')}</Text>
              <MoodPulseSelector value={quickMood} onSelect={quickSaveMood} />
              {savingMood && <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{t('common.saving')}</Text>}
            </>
          )}
        </Card>
      </View>

      {/* D. Daily affirmation */}
      {inspiration && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title={t('wellness.affirmationSectionTitle')} />
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('AffirmationDetail', { content: inspiration })}>
            <LinearGradient
              colors={[color.accentMuted, color.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.affirmationCard}
            >
              <Sparkles size={18} color={color.accent} strokeWidth={1.75} />
              <Text variant="subtitle" style={{ marginTop: spacing.sm, fontStyle: 'italic' }}>
                "{inspiration.text}"
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {/* E. Daily challenge */}
      {activeChallengeProgress && activeChallengeSummary && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title={t('wellness.challengeSectionTitle')} action={t('wellness.challengeView')} onActionPress={() => navigation.navigate('ChallengeDetail', { id: activeChallengeProgress.challengeId })} />
          <Card elevated style={{ borderColor: challengeCompletedToday ? color.success : color.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Trophy size={18} color={challengeCompletedToday ? color.success : color.accent} strokeWidth={1.75} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="bodySm" weight="semibold">{activeChallengeSummary.title}</Text>
                {todaysTask && (
                  <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>
                    {t('wellness.challengeDayLabel', { day: activeChallengeProgress.currentDay, title: todaysTask.title })}
                  </Text>
                )}
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {t('wellness.challengeDuration', { days: activeChallengeSummary.durationDays })}
                </Text>
              </View>
            </View>
            <Pressable accessibilityRole="button"
              onPress={completeChallengeToday}
              disabled={challengeCompletedToday || completingChallenge}
              style={[styles.challengeButton, challengeCompletedToday && styles.challengeButtonDone]}
            >
              {challengeCompletedToday && <Check size={14} color={color.success} strokeWidth={2.5} style={{ marginRight: 6 }} />}
              <Text variant="bodySm" weight="semibold" tone={challengeCompletedToday ? 'success' : 'accent'}>
                {challengeCompletedToday ? t('wellness.challengeCompletedToday') : completingChallenge ? t('common.saving') : t('wellness.challengeMarkComplete')}
              </Text>
            </Pressable>
          </Card>
        </View>
      )}

      {/* F. Habit journey */}
      {habits.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title={t('wellness.habitJourneyTitle')} action={t('common.viewAll')} onActionPress={() => navigation.navigate('Habits')} />
          <Card>
            {habits.slice(0, 5).map((habit, i) => (
              <React.Fragment key={habit.id}>
                {i > 0 && <View style={styles.habitDivider} />}
                <HabitJourneyRow
                  name={habit.name}
                  completedToday={completedToday.has(habit.id)}
                  currentStreak={habitStreaks[habit.id]?.currentStreak ?? 0}
                  onToggle={() => toggleHabit(habit)}
                />
              </React.Fragment>
            ))}
          </Card>
        </View>
      )}

      {/* G. Quick reset activities */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title={t('wellness.quickResetsTitle')} />
        <View style={styles.tileGrid}>
          {RESET_TILES.map((tile) => (
            <Pressable accessibilityRole="button" key={tile.id} onPress={() => tile.navigate(navigation)} style={styles.tile}>
              <tile.icon size={20} color={color.accent} strokeWidth={1.75} />
              <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.sm }}>{t(`wellness.tiles.${tile.id}`)}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                {tile.id === 'breathing' && breathingCount != null ? t('wellness.breathingCount', { count: breathingCount }) : null}
                {tile.id === 'meditation' && meditationCount != null ? t('wellness.meditationCount', { count: meditationCount }) : null}
                {tile.id === 'journal' ? (journalToday ? t('wellness.journalWrittenToday') : t('wellness.journalReflectPrivately')) : null}
                {tile.id === 'challenges' ? (activeChallengeProgress ? t('wellness.challengesInProgress') : t('wellness.challengesBrowsePrograms')) : null}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* H. Personal progress */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title={t('wellness.thisWeekTitle')} />
        {moodTrend?.hasData ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TrendingUp size={16} color={color.secondary} strokeWidth={1.75} />
              <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm }}>
                {t('wellness.checkInsThisWeek', { count: weeklyActivityCount })}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
              {last7Days.map((d) => (
                <View key={d.localDate} style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: d.entry ? MOOD_COLOR[d.entry.mood] : color.surfaceElevated,
                      borderWidth: 1, borderColor: d.entry ? MOOD_COLOR[d.entry.mood] : color.border,
                      opacity: d.entry ? 1 : 0.5,
                    }}
                  />
                  <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                    {new Date(`${d.localDate}T00:00:00`).getDate()}
                  </Text>
                </View>
              ))}
            </View>

            {moodTrend.averageEnergy != null && (
              <Text variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
                {t('wellness.averageEnergy', { value: moodTrend.averageEnergy.toFixed(1) })}
              </Text>
            )}
            {habits.length > 0 && (
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                {t('wellness.habitsDoneToday', { done: habitsDoneCount, total: habits.length })}
              </Text>
            )}
          </Card>
        ) : (
          <Card>
            <Text variant="bodySm" tone="secondary">
              {t('wellness.noTrendYet')}
            </Text>
          </Card>
        )}
      </View>

      {/* I. Goals snippet */}
      {goals.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title={t('wellness.activeGoalsTitle')} action={t('common.viewAll')} onActionPress={() => navigation.navigate('Goals')} />
          <Card>
            {goals.slice(0, 3).map((g, i) => (
              <Pressable accessibilityRole="button"
                key={g.id}
                onPress={() => navigation.navigate('GoalDetail', { id: g.id })}
                style={[styles.goalRow, i > 0 && styles.habitDivider]}
              >
                <Target size={14} color={color.accent} strokeWidth={1.75} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text variant="bodySm" weight="semibold">{g.title}</Text>
                  <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                    {t('wellness.checkInsLogged', { count: g.progress.length })}
                  </Text>
                </View>
                <ChevronRight size={14} color={color.textMuted} />
              </Pressable>
            ))}
          </Card>
        </View>
      )}

      <View style={{ marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="accent" onPress={() => navigation.navigate('InspirationBrowse')}>
          {t('wellness.inspirationLibrary')}
        </Text>
        <Text variant="caption" tone="accent" onPress={() => navigation.navigate('NotificationSettings')}>
          {t('wellness.reminders')}
        </Text>
      </View>

      <Card style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'flex-start' }}>
        <Info size={14} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>
          {t('wellness.disclaimer')}
        </Text>
      </Card>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  moodDoneRow: { flexDirection: 'row', alignItems: 'center' },
  affirmationCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.accentBorder,
    padding: spacing.md,
  },
  challengeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.accentBorder,
    backgroundColor: color.accentMuted,
  },
  challengeButtonDone: {
    borderColor: color.success,
    backgroundColor: color.successMuted,
  },
  habitDivider: {
    height: 1,
    backgroundColor: color.borderSubtle,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
