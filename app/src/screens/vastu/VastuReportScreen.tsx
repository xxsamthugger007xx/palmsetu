import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Bookmark, Share2, Trash2, Info, Check, Square } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { vastuApi } from '../../services/vastuApi';
import { VastuReport } from '../../types/vastu';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
import { ListSkeleton } from '../../components/ListSkeleton';
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <Text variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>{title.toUpperCase()}</Text>
      {children}
    </Card>
  );
}

export function VastuReportScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'VastuReport'>>();
  const { reportId } = route.params;

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [report, setReport] = useState<VastuReport | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);

  const load = async () => {
    setState('loading');
    try {
      const res = await vastuApi.getReport(reportId);
      setReport(res);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => { load(); }, [reportId]);

  const handleSave = async () => {
    if (!report) return;
    const updated = await vastuApi.saveReport(report.id, !report.saved);
    setReport(updated);
  };

  const handleToggleChecklist = async (itemId: string, completed: boolean) => {
    if (!report) return;
    const updated = await vastuApi.toggleChecklistItem(report.id, itemId, !completed);
    setReport(updated);
  };

  const handleShare = async () => {
    if (!report) return;
    await Share.share({ message: `My Vastu property reflection (via Palm Setu): ${report.explanation}` });
  };

  const handleDelete = async () => {
    if (!report) return;
    await vastuApi.deleteReport(report.id);
    setConfirmDelete(false);
    navigation.navigate('VastuLanding');
  };

  const handleAsk = async () => {
    if (!report || !question.trim()) return;
    setAsking(true);
    try {
      const res = await vastuApi.askFollowup(report.id, question.trim());
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
  if (state === 'error' || !report) {
    return <PageContainer><EmptyState icon={Info} title={t('ui.GemstoneReportScreen.couldnTLoadThisReport')} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} /></PageContainer>;
  }

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <IconButton icon={Bookmark} tone={report.saved ? color.accent : color.textSecondary} onPress={handleSave} />
          <IconButton icon={Share2} onPress={handleShare} />
          <IconButton icon={Trash2} tone={color.danger} onPress={() => setConfirmDelete(true)} />
        </View>
      </View>

      {/* A. Property overview */}
      <Card elevated style={{ marginTop: spacing.md }}>
        <Text variant="label" tone="accent">{t('ui.VastuReportScreen.propertyOverview')}</Text>
        <Text variant="subtitle" weight="semibold" style={{ marginTop: spacing.sm, textTransform: 'capitalize' }}>
          {report.propertyType.replace('-', ' ')}
        </Text>
        <View style={styles.badgeRow}>
          <StatusBadge
            label={report.completeness === 'full' ? 'Complete' : 'Partial'}
            status={report.completeness === 'full' ? 'success' : 'warning'}
          />
          <StatusBadge label={`${report.confirmedRoomCount} rooms confirmed`} status="neutral" />
        </View>
        {report.missingRooms.length > 0 && (
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            Not yet provided: {report.missingRooms.join(', ')}
          </Text>
        )}
        <Text variant="bodySm" style={{ marginTop: spacing.md }}>{report.explanation}</Text>
      </Card>

      {/* B. Direction analysis */}
      <View style={{ marginTop: spacing.lg }}>
        <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>{t('ui.VastuReportScreen.directionAnalysis')}</Text>
        {report.roomAnalyses.map((a) => (
          <Section key={a.roomId} title={a.roomLabel}>
            <View style={styles.badgeRow}>
              <StatusBadge label={a.direction} status="accent" />
              <StatusBadge
                label={a.alignment === 'favorable' ? 'Favorable' : a.alignment === 'traditionally-cautioned' ? 'Worth reconsidering' : 'Neutral'}
                status={a.alignment === 'favorable' ? 'success' : a.alignment === 'traditionally-cautioned' ? 'warning' : 'neutral'}
              />
            </View>
            <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>{a.explanation}</Text>
            {a.practicalSuggestions.map((s) => (
              <Text key={s} variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>• {s}</Text>
            ))}
          </Section>
        ))}
      </View>

      {/* D. Priority checklist */}
      <View style={{ marginTop: spacing.lg }}>
        <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>{t('ui.VastuReportScreen.suggestionsChecklist')}</Text>
        {report.checklist.map((item) => (
          <Card key={item.id} style={styles.checklistRow} onPress={() => handleToggleChecklist(item.id, item.completed)}>
            {item.completed ? (
              <Check size={18} color={color.success} strokeWidth={2} />
            ) : (
              <Square size={18} color={color.textMuted} strokeWidth={1.75} />
            )}
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="bodySm" tone={item.completed ? 'muted' : 'primary'} style={item.completed ? { textDecorationLine: 'line-through' } : undefined}>
                {item.text}
              </Text>
              {item.category === 'cultural-practice' && (
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t('ui.VastuReportScreen.optionalCulturalPractice')}</Text>
              )}
            </View>
          </Card>
        ))}
      </View>

      {/* E. Disclaimer */}
      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="caption" tone="muted">
          {t('ui.VastuReportScreen.vastuIsATraditionalArchitectural')}
        </Text>
      </Card>

      {/* Ask AI */}
      <View style={{ marginTop: spacing.lg }}>
        <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>{t('ui.DailyHoroscopeScreen.askAFollowUpQuestion')}</Text>
        {answers.map((a, i) => (
          <Card key={i} style={{ marginBottom: spacing.sm }}><Text variant="bodySm" tone="secondary">{a}</Text></Card>
        ))}
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder={t('ui.VastuReportScreen.askAboutThisReport')} accessibilityLabel={t('ui.VastuReportScreen.askAboutThisReport')}
          placeholderTextColor={color.textMuted}
          style={styles.input}
        />
        <Button label={t('ui.DailyHoroscopeScreen.ask')} loading={asking} style={{ marginTop: spacing.sm }} onPress={handleAsk} />
      </View>

      <ConfirmationModal
        visible={confirmDelete}
        title={t('ui.GemstoneReportScreen.deleteThisReport')}
        description={t('ui.VastuReportScreen.thisPermanentlyDeletesTheVastu')}
        confirmLabel={t('ui.AssistantHistoryScreen.delete')}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  checklistRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: color.textPrimary,
  },
});
