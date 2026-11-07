import React from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Heart, RefreshCw, Lock } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, MoodEntry, MoodLevel } from '../../services/wellnessApi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MOOD_COLOR: Record<MoodLevel, string> = {
  great: color.success,
  good: color.secondary,
  okay: color.warning,
  down: color.accent2,
  low: color.danger,
};

const MOOD_LABEL: Record<MoodLevel, string> = {
  great: 'Great', good: 'Good', okay: 'Okay', down: 'Down', low: 'Low',
};

type Trends = {
  hasData: boolean; windowDays: number; checkInCount: number;
  moodDistribution: Record<string, number>; emotionFrequency: Record<string, number>;
  averageEnergy: number | null; averageStress: number | null; averageSleepQuality: number | null; message?: string;
};

export function MoodHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [entries, setEntries] = React.useState<MoodEntry[]>([]);
  const [freeWindowDays, setFreeWindowDays] = React.useState<number | null>(null);
  const [totalStored, setTotalStored] = React.useState(0);
  const [trends, setTrends] = React.useState<Trends | null>(null);
  const [trendsWindow, setTrendsWindow] = React.useState<'week' | 'month'>('week');
  const today = wellnessApi.todayLocalDate();
  const [calendarMonth, setCalendarMonth] = React.useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m - 1 }; // month is 0-indexed for Date()
  });
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      wellnessApi.getMoodHistory(),
      wellnessApi.getMoodTrends(trendsWindow),
    ])
      .then(([history, trendsRes]) => {
        setEntries(history.entries);
        setFreeWindowDays(history.freeHistoryWindowDays);
        setTotalStored(history.totalEntriesStored);
        setTrends(trendsRes);
      })
      .catch((err: any) => setError(err.message ?? 'Could not load your mood history. Please try again.'))
      .finally(() => setLoading(false));
  }, [trendsWindow]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const last7 = React.useMemo(() => {
    const today = new Date();
    const days: { localDate: string; entry: MoodEntry | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ localDate, entry: entries.find((e) => e.localDate === localDate) ?? null });
    }
    return days;
  }, [entries]);

  const checkedInLast7 = last7.filter((d) => d.entry).length;

  const entryByDate = React.useMemo(() => {
    const map = new Map<string, MoodEntry>();
    entries.forEach((e) => map.set(e.localDate, e));
    return map;
  }, [entries]);

  const calendarWeeks = React.useMemo(() => {
    const { year, month } = calendarMonth;
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = firstOfMonth.getDay(); // 0 = Sunday

    type Cell = { localDate: string; day: number } | null;
    const cells: Cell[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const localDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ localDate, day });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [calendarMonth]);

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const canGoNextMonth = !(calendarMonth.year > Number(today.slice(0, 4)) || (calendarMonth.year === Number(today.slice(0, 4)) && calendarMonth.month >= Number(today.slice(5, 7)) - 1));

  const changeMonth = (delta: number) => {
    setSelectedDate(null);
    setCalendarMonth((prev) => {
      let month = prev.month + delta;
      let year = prev.year;
      if (month < 0) { month = 11; year -= 1; }
      if (month > 11) { month = 0; year += 1; }
      return { year, month };
    });
  };

  const selectedEntry = selectedDate ? entryByDate.get(selectedDate) ?? null : null;

  if (loading) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Mood History</Text>
        <Text variant="bodySm" tone="muted">Loading...</Text>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Mood History</Text>
        <EmptyState icon={RefreshCw} title="Something went wrong" description={error} actionLabel="Retry" onAction={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Mood History</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Trends and check-ins over time.
      </Text>

      {entries.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No mood check-ins yet"
          description="Log how you are feeling to start seeing your trends here."
          actionLabel="Check in now"
          onAction={() => navigation.navigate('MoodCheckIn')}
        />
      ) : (
        <>
          {freeWindowDays != null && (
            <Card style={{ marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'flex-start' }}>
              <Lock size={14} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
              <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>
                Free plan shows your last {freeWindowDays} days of check-ins. You have {totalStored} stored in
                total, upgrade to Premium to see your full history.
              </Text>
            </Card>
          )}

          <View style={{ marginBottom: spacing.lg }}>
            <SectionHeader title="Last 7 days" />
            <Text variant="bodySm" tone="secondary" style={{ marginBottom: spacing.sm }}>
              You checked in {checkedInLast7} of the last 7 days.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {last7.map((d) => (
                <View key={d.localDate} style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 32, height: 32, borderRadius: radius.md,
                      backgroundColor: d.entry ? MOOD_COLOR[d.entry.mood] : color.surfaceElevated,
                      borderWidth: 1, borderColor: d.entry ? MOOD_COLOR[d.entry.mood] : color.border,
                      opacity: d.entry ? 1 : 0.5,
                    }}
                  />
                  <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                    {new Date(`${d.localDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Pressable onPress={() => changeMonth(-1)} hitSlop={10}>
                <ChevronLeft size={18} color={color.textMuted} strokeWidth={1.75} />
              </Pressable>
              <Text variant="bodySm" weight="semibold">{monthLabel}</Text>
              <Pressable onPress={() => canGoNextMonth && changeMonth(1)} hitSlop={10} disabled={!canGoNextMonth}>
                <ChevronRight size={18} color={canGoNextMonth ? color.textMuted : color.border} strokeWidth={1.75} />
              </Pressable>
            </View>
            <Card>
              <View style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <Text key={i} variant="caption" tone="muted" style={{ flex: 1, textAlign: 'center' }}>{d}</Text>
                ))}
              </View>
              {calendarWeeks.map((week, wi) => (
                <View key={wi} style={{ flexDirection: 'row' }}>
                  {week.map((cell, ci) => {
                    if (!cell) return <View key={ci} style={{ flex: 1, aspectRatio: 1 }} />;
                    const entry = entryByDate.get(cell.localDate);
                    const isToday = cell.localDate === today;
                    const isSelected = cell.localDate === selectedDate;
                    return (
                      <Pressable
                        key={ci}
                        style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => setSelectedDate(isSelected ? null : cell.localDate)}
                      >
                        <View
                          style={{
                            width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: entry ? MOOD_COLOR[entry.mood] : 'transparent',
                            opacity: entry ? (isSelected ? 1 : 0.85) : 1,
                            borderWidth: isSelected ? 2 : isToday ? 1 : 0,
                            borderColor: isSelected ? color.textPrimary : color.accentBorder,
                          }}
                        >
                          <Text variant="caption" weight={isToday ? 'semibold' : 'regular'} tone={entry ? undefined : 'muted'} style={entry ? { color: '#0b0b0f' } : undefined}>
                            {cell.day}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </Card>

            {selectedDate && (
              <Card style={{ marginTop: spacing.sm }}>
                <Text variant="bodySm" weight="semibold">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
                {selectedEntry ? (
                  <>
                    <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>
                      Mood: {MOOD_LABEL[selectedEntry.mood]}
                      {selectedEntry.emotions.length > 0 ? ` - ${selectedEntry.emotions.join(', ')}` : ''}
                    </Text>
                    {selectedEntry.note && (
                      <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>{selectedEntry.note}</Text>
                    )}
                  </>
                ) : (
                  <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xs }}>No check-in on this date.</Text>
                )}
              </Card>
            )}
          </View>

          <View style={{ marginBottom: spacing.lg }}>
            <SectionHeader
              title="Trends"
              action={trendsWindow === 'week' ? 'View month' : 'View week'}
              onActionPress={() => setTrendsWindow(trendsWindow === 'week' ? 'month' : 'week')}
            />
            {!trends || !trends.hasData ? (
              <Card>
                <Text variant="bodySm" tone="muted">{trends?.message ?? 'Not enough data yet for this window.'}</Text>
              </Card>
            ) : (
              <Card>
                <Text variant="bodySm" weight="semibold" style={{ marginBottom: spacing.sm }}>
                  {trends.checkInCount} check-ins in the last {trends.windowDays} days
                </Text>
                {Object.entries(trends.moodDistribution).map(([mood, count]) => {
                  const total = Object.values(trends.moodDistribution).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <View key={mood} style={{ marginBottom: spacing.xs }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text variant="caption" tone="secondary">{MOOD_LABEL[mood as MoodLevel] ?? mood}</Text>
                        <Text variant="caption" tone="muted">{count}</Text>
                      </View>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: color.surfaceElevated, overflow: 'hidden' }}>
                        <View style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: MOOD_COLOR[mood as MoodLevel] ?? color.accent }} />
                      </View>
                    </View>
                  );
                })}

                {Object.keys(trends.emotionFrequency).length > 0 && (
                  <View style={{ marginTop: spacing.md }}>
                    <Text variant="caption" tone="muted" style={{ marginBottom: spacing.xs }}>Most frequent emotions</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {Object.entries(trends.emotionFrequency)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 6)
                        .map(([emotion, count]) => (
                          <View key={emotion} style={{ backgroundColor: color.surfaceElevated, borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: spacing.sm, marginRight: spacing.xs, marginBottom: spacing.xs }}>
                            <Text variant="caption" tone="secondary">{emotion} ({count})</Text>
                          </View>
                        ))}
                    </View>
                  </View>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
                  <View>
                    <Text variant="caption" tone="muted">Avg energy</Text>
                    <Text variant="bodySm" weight="semibold">{trends.averageEnergy != null ? trends.averageEnergy.toFixed(1) : '-'}</Text>
                  </View>
                  <View>
                    <Text variant="caption" tone="muted">Avg stress</Text>
                    <Text variant="bodySm" weight="semibold">{trends.averageStress != null ? trends.averageStress.toFixed(1) : '-'}</Text>
                  </View>
                  <View>
                    <Text variant="caption" tone="muted">Avg sleep</Text>
                    <Text variant="bodySm" weight="semibold">{trends.averageSleepQuality != null ? trends.averageSleepQuality.toFixed(1) : '-'}</Text>
                  </View>
                </View>
              </Card>
            )}
          </View>

          <View style={{ marginBottom: spacing.lg }}>
            <SectionHeader title="All check-ins" />
            {entries.slice().reverse().map((entry) => (
              <Card key={entry.id} style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: MOOD_COLOR[entry.mood] }} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text variant="bodySm" weight="semibold">{MOOD_LABEL[entry.mood]}</Text>
                  <Text variant="caption" tone="muted">{entry.localDate}{entry.note ? ` - ${entry.note}` : ''}</Text>
                </View>
              </Card>
            ))}
          </View>
        </>
      )}

      <Button label="New check-in" onPress={() => navigation.navigate('MoodCheckIn')} style={{ marginTop: spacing.sm }} />
    </PageContainer>
  );
}
