import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, Emotion, EMOTION_OPTIONS, MoodLevel } from '../../services/wellnessApi';

const MOOD_LEVELS: { value: MoodLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'down', label: 'Down' },
  { value: 'okay', label: 'Okay' },
  { value: 'good', label: 'Good' },
  { value: 'great', label: 'Great' },
];

const SCALE = [1, 2, 3, 4, 5];

function SegmentedScale({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text variant="bodySm" tone="secondary" style={{ marginBottom: spacing.xs }}>{label}</Text>
      <View style={{ flexDirection: 'row' }}>
        {SCALE.map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={[styles.scaleItem, selected && styles.scaleItemSelected]}
            >
              <Text variant="bodySm" tone={selected ? 'accent' : 'muted'} weight={selected ? 'semibold' : 'regular'}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MoodCheckInScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const today = wellnessApi.todayLocalDate();

  const [mood, setMood] = React.useState<MoodLevel | null>(null);
  const [emotions, setEmotions] = React.useState<Emotion[]>([]);
  const [energy, setEnergy] = React.useState(3);
  const [stress, setStress] = React.useState(3);
  const [sleepQuality, setSleepQuality] = React.useState(3);
  const [note, setNote] = React.useState('');
  const [wasExisting, setWasExisting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    wellnessApi.getMoodForDate(today)
      .then((res) => {
        const e = res.entry;
        setMood(e.mood);
        setEmotions(e.emotions);
        setEnergy(e.energy);
        setStress(e.stress);
        setSleepQuality(e.sleepQuality);
        setNote(e.note ?? '');
        setWasExisting(true);
      })
      .catch(() => { /* no entry yet today - honest blank form */ })
      .finally(() => setLoading(false));
  }, [today]);

  const toggleEmotion = (e: Emotion) => {
    setEmotions((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : prev.length >= 15 ? prev : [...prev, e]));
  };

  const save = async () => {
    if (!mood) return;
    setSaving(true);
    setError(null);
    try {
      await wellnessApi.saveMood({ localDate: today, mood, emotions, energy, stress, sleepQuality, note: note.trim() || undefined });
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save your check-in.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <Text variant="body" tone="muted" style={{ marginTop: spacing.xl }}>Loading...</Text>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>
        {wasExisting ? 'Edit check-in' : 'How are you feeling?'}
      </Text>
      <Text variant="caption" tone="muted" style={{ marginBottom: 2 }}>
        {new Date(`${today}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </Text>
      <Text variant="body" tone="secondary" style={{ marginBottom: spacing.lg }}>
        {wasExisting ? 'You already checked in today - update it below.' : 'Today\'s quick mood check-in. One check-in per day - come back tomorrow for a new one.'}
      </Text>

      <Card elevated style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {MOOD_LEVELS.map((m) => {
            const selected = mood === m.value;
            return (
              <Pressable key={m.value} onPress={() => setMood(m.value)} style={styles.moodItem}>
                <View style={[styles.moodDot, selected && styles.moodDotSelected]} />
                <Text variant="caption" tone={selected ? 'accent' : 'muted'} style={{ marginTop: spacing.xs }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={{ marginBottom: spacing.lg }}>
        <SectionHeader title="What are you feeling? (optional)" />
        <View style={styles.chipRow}>
          {EMOTION_OPTIONS.map((e) => {
            const selected = emotions.includes(e);
            return (
              <Pressable key={e} onPress={() => toggleEmotion(e)} style={[styles.chip, selected && styles.chipSelected]}>
                <Text variant="caption" tone={selected ? 'accent' : 'secondary'}>{e}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Card style={{ marginBottom: spacing.lg }}>
        <SegmentedScale label="Energy" value={energy} onChange={setEnergy} />
        <SegmentedScale label="Stress" value={stress} onChange={setStress} />
        <SegmentedScale label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
      </Card>

      <View style={{ marginBottom: spacing.lg }}>
        <SectionHeader title="Note (optional)" />
        <Card>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Anything you want to remember about today..."
            placeholderTextColor={color.textMuted}
            multiline
            style={{ minHeight: 60, color: color.textPrimary, fontSize: 14 }}
            maxLength={2000}
          />
        </Card>
      </View>

      {error && <Text variant="bodySm" tone="danger" style={{ marginBottom: spacing.md }}>{error}</Text>}

      <Button label={wasExisting ? 'Update check-in' : 'Save check-in'} onPress={save} disabled={!mood || saving} loading={saving} fullWidth />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  moodItem: { alignItems: 'center' },
  moodDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: color.surfaceElevated, borderWidth: 1, borderColor: color.border,
  },
  moodDotSelected: { backgroundColor: color.accentMuted, borderColor: color.accentBorder },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.pill ?? 999, borderWidth: 1, borderColor: color.border,
    backgroundColor: color.surface, marginRight: spacing.xs, marginBottom: spacing.xs,
  },
  chipSelected: { backgroundColor: color.accentMuted, borderColor: color.accentBorder },
  scaleItem: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm, marginRight: spacing.xs,
    borderRadius: radius.sm, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface,
  },
  scaleItemSelected: { backgroundColor: color.accentMuted, borderColor: color.accentBorder },
});
