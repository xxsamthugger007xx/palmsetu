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
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
type RouteType = RouteProp<RootStackParamList, 'JournalEditor'>;

const INSIGHT_TYPES: { value: 'summary' | 'reflective-questions' | 'theme-identification' | 'writing-suggestions'; label: string }[] = [
  { value: 'summary', label: 'Summarize' },
  { value: 'reflective-questions', label: 'Reflective questions' },
  { value: 'theme-identification', label: 'Identify themes' },
  { value: 'writing-suggestions', label: 'What to write next' },
];

export function JournalEditorScreen() {
  const { t } = useTranslation();
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
    } catch (__err) {
      const err = asApiError(__err);
      setError(err?.message ?? t('ui.JournalEditorScreen.couldNotSaveThisEntry'));
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
    } catch (__err) {
      const err = asApiError(__err);
      setAiError(err?.message ?? t('ui.JournalEditorScreen.couldNotGetAnAi'));
    } finally {
      setAiLoading(false);
    }
  };

  const confirmDelete = () => {
    if (!entry) return;
    Alert.alert(t('ui.JournalEditorScreen.deleteEntry'), t('ui.AssistantHistoryScreen.thisCannotBeUndone'), [
      { text: t('ui.AssistantHistoryScreen.cancel'), style: 'cancel' },
      { text: t('ui.AssistantHistoryScreen.delete'), style: 'destructive', onPress: async () => {
        await wellnessApi.deleteJournalEntry(entry.id).catch(() => {});
        navigation.goBack();
      } },
    ]);
  };

  return (
    <PageContainer
      // Only re-fetches the reflective prompts list on pull, never the
      // entry's own title/content/tags/favorite - those are actively being
      // edited in this form, and silently overwriting unsaved text on a
      // pull gesture would be a real data-loss bug, not a refresh.
      onRefresh={async () => { await wellnessApi.getJournalPrompts().then((res) => setPrompts(res.prompts)).catch(() => {}); }}
    >
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        {entry ? 'Edit entry' : 'New entry'}
      </Text>

      <View style={{ marginBottom: spacing.lg }}>
        <SectionHeader title={t('ui.JournalEditorScreen.type')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {JOURNAL_ENTRY_TYPES.map((t) => {
            const selected = type === t;
            return (
              <Pressable accessibilityRole="button" key={t} onPress={() => setType(t)} style={{
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
          <SectionHeader title={t('ui.JournalEditorScreen.needAPrompt')} />
          <Card>
            {prompts.filter((p) => p.type === type).slice(0, 2).map((p, i) => (
              <Pressable accessibilityRole="button" key={i} onPress={() => setContent((c) => (c ? `${c}\n\n${p.text}\n` : `${p.text}\n`))}>
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
          placeholder={t('ui.JournalEditorScreen.titleOptional')} accessibilityLabel={t('ui.JournalEditorScreen.titleOptional')}
          placeholderTextColor={color.textMuted}
          style={{ color: color.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: spacing.sm }}
          maxLength={200}
        />
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder={t('ui.JournalEditorScreen.writeFreely')} accessibilityLabel={t('ui.JournalEditorScreen.writeFreely')}
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
          placeholder={t('ui.JournalEditorScreen.tagsCommaSeparated')} accessibilityLabel={t('ui.JournalEditorScreen.tagsCommaSeparated')}
          placeholderTextColor={color.textMuted}
          style={{ flex: 1, color: color.textPrimary }}
        />
        <Pressable accessibilityRole="button" onPress={() => setFavorite((v) => !v)} hitSlop={8}>
          <Star size={18} color={favorite ? color.accent : color.textMuted} fill={favorite ? color.accent : 'transparent'} strokeWidth={1.75} />
        </Pressable>
      </Card>

      {error && <Text variant="bodySm" tone="danger" style={{ marginBottom: spacing.md }}>{error}</Text>}

      <Button label={entry ? 'Save changes' : 'Save entry'} onPress={save} disabled={!content.trim() || saving} loading={saving} fullWidth />

      {entry && (
        <>
          <View style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}>
            <SectionHeader title={t('ui.JournalEditorScreen.aiInsight')} />
            <Card elevated>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm }}>
                <Sparkles size={15} color={color.accent} strokeWidth={1.75} style={{ marginTop: 2 }} />
                <Text variant="bodySm" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
                  {t('ui.JournalEditorScreen.thisEntrySTextWould')}
                </Text>
              </View>

              <Pressable accessibilityRole="button"
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
                  {t('ui.JournalEditorScreen.iConsentToShareThis')}
                </Text>
              </Pressable>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
                {INSIGHT_TYPES.map((it) => {
                  const selected = aiInsightType === it.value;
                  return (
                    <Pressable accessibilityRole="button" key={it.value} onPress={() => setAiInsightType(it.value)} style={{
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
                label={t('ui.JournalEditorScreen.getAiInsight')}
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

          <Button label={t('ui.JournalEditorScreen.deleteEntry')} variant="danger" onPress={confirmDelete} fullWidth />
        </>
      )}
    </PageContainer>
  );
}
