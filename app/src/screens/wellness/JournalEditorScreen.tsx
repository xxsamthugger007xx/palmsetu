import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Star, Sparkles } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, JournalEntry, JOURNAL_ENTRY_TYPES, JournalEntryType } from '../../services/wellnessApi';

type RouteType = RouteProp<RootStackParamList, 'JournalEditor'>;

const INSIGHT_TYPES: { value: 'summary' | 'reflective-questions' | 'theme-identification' | 'writing-suggestions'; label: string }[] = [
  { value: 'summary', label: 'Summarize' },
  { value: 'reflective-questions', label: 'Reflective questions' },
  { value: 'theme-identification', label: 'Identify themes' },
  { value: 'writing-suggestions', label: 'What to write next' },
];

export function JournalEditorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteType>();
  const entryId = route.params?.entryId;

  const [entry, setEntry] = React.useState<JournalEntry | null>(null);
  const [type, setType] = React.useState<JournalEntryType>('daily');
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [favorite, setFavorite] = React.useState(false);
  const [tagsText, setTagsText] = React.useState('');
  const [prompts, setPrompts] = React.useState<{ type: JournalEntryType; text: string }[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // AI insight: consent is never pre-checked, never defaulted true, and must
  // be explicitly re-confirmed per request - this local toggle is only a UI
  // gate, the real enforcement is the server requiring consent:true on the
  // request body itself.
  const [aiConsentGiven, setAiConsentGiven] = React.useState(false);
  const [aiInsightType, setAiInsightType] = React.useState<typeof INSIGHT_TYPES[number]['value']>('summary');
  const [aiInsight, setAiInsight] = React.useState<string | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);

  React.useEffect(() => {
    wellnessApi.getJournalPrompts().then((res) => setPrompts(res.prompts)).catch(() => setPrompts([]));
    if (entryId) {
      wellnessApi.listJournalEntries().then((res) => {
        const found = res.entries.find((e) => e.id === entryId);
        if (found) {
          setEntry(found);
          setType(found.type);
          setTitle(found.title ?? '');
          setContent(found.content);
          setFavorite(found.favorite);
          setTagsText((found.tags ?? []).join(', '));
        }
      }).catch(() => {});
    }
  }, [entryId]);

  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      if (entry) {
        await wellnessApi.updateJournalEntry(entry.id, { type, title: title.trim() || undefined, content, tags, favorite, isDraft: false });
      } else {
        await wellnessApi.createJournalEntry({ type, title: title.trim() || undefined, content, tags, isDraft: false });
      }
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save this entry.');
    } finally {
      setSaving(false);
    }
  };

  const requestAiInsight = async () => {
    if (!entry || !aiConsentGiven) return;
    setAiLoading(true);
    setAiError(null);
    setAiInsight(null);
    try {
      const res = await wellnessApi.getJournalAiInsight({ entryId: entry.id, consent: true, insightType: aiInsightType });
      setAiInsight(res.insight);
    } catch (err: any) {
      setAiError(err?.message ?? 'Could not get an AI insight right now.');
    } finally {
      setAiLoading(false);
    }
  };

  const confirmDelete = () => {
    if (!entry) return;
    Alert.alert('Delete entry', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await wellnessApi.deleteJournalEntry(entry.id).catch(() => {});
        navigation.goBack();
      } },
    ]);
  };

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        {entry ? 'Edit entry' : 'New entry'}
      </Text>

      <View style={{ marginBottom: spacing.lg }}>
        <SectionHeader title="Type" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {JOURNAL_ENTRY_TYPES.map((t) => {
            const selected = type === t;
            return (
              <Pressable key={t} onPress={() => setType(t)} style={{
                paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill,
                borderWidth: 1, borderColor: selected ? color.accentBorder : color.border,
                backgroundColor: selected ? color.accentMuted : color.surface, marginBottom: spacing.xs,
              }}>
                <Text variant="caption" tone={selected ? 'accent' : 'secondary'}>{t.replace(/-/g, ' ')}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {!entry && prompts.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <SectionHeader title="Need a prompt?" />
          <Card>
            {prompts.filter((p) => p.type === type).slice(0, 2).map((p, i) => (
              <Pressable key={i} onPress={() => setContent((c) => (c ? `${c}\n\n${p.text}\n` : `${p.text}\n`))}>
                <Text variant="bodySm" tone="secondary" style={{ marginBottom: spacing.xs }}>{p.text}</Text>
              </Pressable>
            ))}
          </Card>
        </View>
      )}

      <Card style={{ marginBottom: spacing.md }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title (optional)"
          placeholderTextColor={color.textMuted}
          style={{ color: color.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: spacing.sm }}
          maxLength={200}
        />
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Write freely..."
          placeholderTextColor={color.textMuted}
          multiline
          style={{ minHeight: 160, color: color.textPrimary, fontSize: 14 }}
          maxLength={20000}
        />
      </Card>

      <Card style={{ marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          value={tagsText}
          onChangeText={setTagsText}
          placeholder="Tags, comma separated"
          placeholderTextColor={color.textMuted}
          style={{ flex: 1, color: color.textPrimary }}
        />
        <Pressable onPress={() => setFavorite((v) => !v)} hitSlop={8}>
          <Star size={18} color={favorite ? color.accent : color.textMuted} fill={favorite ? color.accent : 'transparent'} strokeWidth={1.75} />
        </Pressable>
      </Card>

      {error && <Text variant="bodySm" tone="danger" style={{ marginBottom: spacing.md }}>{error}</Text>}

      <Button label={entry ? 'Save changes' : 'Save entry'} onPress={save} disabled={!content.trim() || saving} loading={saving} fullWidth />

      {entry && (
        <>
          <View style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}>
            <SectionHeader title="AI insight" />
            <Card elevated>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm }}>
                <Sparkles size={15} color={color.accent} strokeWidth={1.75} style={{ marginTop: 2 }} />
                <Text variant="bodySm" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
                  This entry's text would be sent to Solune's AI to generate an insight. It is never sent
                  without your explicit permission below, and each request requires this to be checked again.
                </Text>
              </View>

              <Pressable
                onPress={() => setAiConsentGiven((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
                  borderColor: aiConsentGiven ? color.accent : color.border,
                  backgroundColor: aiConsentGiven ? color.accentMuted : 'transparent',
                  alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
                }} />
                <Text variant="bodySm" weight="semibold">
                  I consent to share this entry's text with the AI for this one request
                </Text>
              </Pressable>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
                {INSIGHT_TYPES.map((it) => {
                  const selected = aiInsightType === it.value;
                  return (
                    <Pressable key={it.value} onPress={() => setAiInsightType(it.value)} style={{
                      paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill,
                      borderWidth: 1, borderColor: selected ? color.accentBorder : color.border,
                      backgroundColor: selected ? color.accentMuted : color.surface,
                    }}>
                      <Text variant="caption" tone={selected ? 'accent' : 'secondary'}>{it.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Button
                label="Get AI insight"
                variant="secondary"
                size="sm"
                disabled={!aiConsentGiven || aiLoading}
                loading={aiLoading}
                onPress={requestAiInsight}
              />

              {aiError && <Text variant="bodySm" tone="danger" style={{ marginTop: spacing.sm }}>{aiError}</Text>}
              {aiInsight && (
                <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.md }}>{aiInsight}</Text>
              )}
            </Card>
          </View>

          <Button label="Delete entry" variant="danger" onPress={confirmDelete} fullWidth />
        </>
      )}
    </PageContainer>
  );
}
