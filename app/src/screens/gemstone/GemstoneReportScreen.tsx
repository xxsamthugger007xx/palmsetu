import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft, Bookmark, Share2, Trash2, Info, ChevronDown, ChevronUp, Gem,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { gemstoneApi } from '../../services/gemstoneApi';
import { GemstoneReport } from '../../types/gemstone';
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

const buyingGuidePoints = [
  'Natural vs. lab-grown: lab-grown gemstones share the same chemical makeup but are grown in a controlled environment, usually at a fraction of the price. Ask the seller to state clearly which one you’re buying.',
  'Treatments: many gemstones are heat-treated, dyed, or filled to improve color/clarity. This is common and not inherently dishonest, but it must be disclosed to you before purchase.',
  'Certification: ask for an independent gemological lab report (e.g. GIA, IGI, or a reputable regional lab) rather than relying on the seller’s own certificate alone.',
  'Carat vs. dimensions: carat is a weight measurement, not a size one. Two stones of the same carat weight can look different sizes depending on the cut and the gemstone’s density.',
  'Questions to ask: Is this natural or treated? What treatments, if any? Can I see an independent lab certificate? What is your return policy if the certificate doesn’t match on independent verification?',
  'Return policy: prefer sellers offering a return window long enough to get independent verification, and keep all paperwork.',
];

export function GemstoneReportScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GemstoneReport'>>();
  const { reportId } = route.params;

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [report, setReport] = useState<GemstoneReport | null>(null);
  const [buyingGuideOpen, setBuyingGuideOpen] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);

  const load = async () => {
    setState('loading');
    try {
      const res = await gemstoneApi.getReport(reportId);
      setReport(res);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => { load(); }, [reportId]);

  const handleSave = async () => {
    if (!report) return;
    const updated = await gemstoneApi.saveReport(report.id, !report.saved);
    setReport(updated);
  };

  const handleShare = async () => {
    if (!report?.primary.gemstone) return;
    await Share.share({
      message: `My recommended gemstone (traditional Vedic guidance, via Palm Setu): ${report.primary.gemstone.nameEnglish} (${report.primary.gemstone.nameHindi})\n\n${report.primary.ruleExplanation}`,
    });
  };

  const handleDelete = async () => {
    if (!report) return;
    await gemstoneApi.deleteReport(report.id);
    setConfirmDelete(false);
    navigation.navigate('GemstoneLanding');
  };

  const handleAsk = async () => {
    if (!report || !question.trim()) return;
    setAsking(true);
    try {
      const res = await gemstoneApi.askFollowup(report.id, question.trim());
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

  const { primary, alternative, caratGuidance } = report;
  const hasPrimary = primary.strength === 'primary' && primary.gemstone;

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

      {!hasPrimary ? (
        <EmptyState
          icon={Gem}
          title={t('ui.GemstoneReportScreen.noRecommendationAvailable')}
          description={primary.reasonUnavailable}
        />
      ) : (
        <>
          {/* A. Recommended gemstone */}
          <Card elevated style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <View style={styles.gemIconWrap}>
              <Gem size={32} color={color.accent} strokeWidth={1.25} />
            </View>
            <Text variant="title" weight="semibold" style={{ marginTop: spacing.md, textAlign: 'center' }}>
              {primary.gemstone!.nameEnglish}
            </Text>
            <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>{primary.gemstone!.nameHindi} - {primary.gemstone!.planet}</Text>

            <View style={styles.badgeRow}>
              <StatusBadge
                label={report.dataCompleteness === 'full' ? 'Full chart data' : 'Partial chart data'}
                status={report.dataCompleteness === 'full' ? 'success' : 'warning'}
              />
              {report.saved && <StatusBadge label={t('ui.GemstoneReportScreen.saved')} status="accent" />}
            </View>

            {caratGuidance.available && caratGuidance.suggestedRangeCarats && (
              <View style={styles.caratRow}>
                <Text variant="mono" weight="semibold" tone="accent">
                  {caratGuidance.suggestedRangeCarats[0]}-{caratGuidance.suggestedRangeCarats[1]} carats
                </Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2, textAlign: 'center' }}>{caratGuidance.disclaimer}</Text>
              </View>
            )}

            <Text variant="bodySm" style={{ marginTop: spacing.md, textAlign: 'center' }}>{report.explanation}</Text>
          </Card>

          {/* B. Why this gemstone */}
          <Card style={{ marginTop: spacing.sm }} onPress={() => setExplanationOpen((o) => !o)}>
            <View style={styles.sectionHeader}>
              <Text variant="bodySm" weight="semibold">{t('ui.GemstoneReportScreen.whyThisGemstoneWasRecommended')}</Text>
              {explanationOpen ? <ChevronUp size={16} color={color.textMuted} /> : <ChevronDown size={16} color={color.textMuted} />}
            </View>
            {explanationOpen && (
              <>
                <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>{primary.ruleExplanation}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                  Method: {report.calculationReference} (rule engine {report.ruleEngineVersion})
                </Text>
              </>
            )}
          </Card>

          {/* C. Wearing guidance */}
          <Section title={t('ui.GemstoneReportScreen.wearingGuidanceCustomaryPractice')}>
            <GuidanceRow label={t('ui.GemstoneReportScreen.traditionalDay')} value={primary.gemstone!.traditionalDay} />
            <GuidanceRow label={t('ui.GemstoneReportScreen.traditionalFinger')} value={primary.gemstone!.traditionalFinger} />
            <GuidanceRow label={t('ui.GemstoneReportScreen.traditionalMetal')} value={primary.gemstone!.traditionalMetal} />
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{primary.gemstone!.customaryPractice}</Text>
          </Section>

          {/* D. Alternatives */}
          <Section title={t('ui.GemstoneReportScreen.alternativeOption')}>
            {alternative.strength === 'alternative' && alternative.gemstone ? (
              <>
                <Text variant="bodySm" weight="semibold">{alternative.gemstone.nameEnglish}</Text>
                <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>{alternative.ruleExplanation}</Text>
              </>
            ) : (
              <Text variant="bodySm" tone="muted">{alternative.reasonUnavailable}</Text>
            )}
          </Section>

          {/* E. Buying guide */}
          <Card style={{ marginBottom: spacing.sm }} onPress={() => setBuyingGuideOpen((o) => !o)}>
            <View style={styles.sectionHeader}>
              <Text variant="bodySm" weight="semibold">{t('ui.GemstoneReportScreen.gemstoneBuyingGuide')}</Text>
              {buyingGuideOpen ? <ChevronUp size={16} color={color.textMuted} /> : <ChevronDown size={16} color={color.textMuted} />}
            </View>
            {buyingGuideOpen && (
              <View style={{ marginTop: spacing.sm }}>
                {buyingGuidePoints.map((p) => (
                  <Text key={p} variant="caption" tone="secondary" style={{ marginBottom: spacing.sm }}>• {p}</Text>
                ))}
                <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
                  {t('ui.GemstoneReportScreen.thisAppDoesNotSell')}
                </Text>
              </View>
            )}
          </Card>

          {/* F. Ask AI */}
          <View style={{ marginTop: spacing.lg }}>
            <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>{t('ui.DailyHoroscopeScreen.askAFollowUpQuestion')}</Text>
            {answers.map((a, i) => (
              <Card key={i} style={{ marginBottom: spacing.sm }}><Text variant="bodySm" tone="secondary">{a}</Text></Card>
            ))}
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder={t('ui.GemstoneReportScreen.askAboutThisRecommendation')} accessibilityLabel={t('ui.GemstoneReportScreen.askAboutThisRecommendation')}
              placeholderTextColor={color.textMuted}
              style={styles.input}
            />
            <Button label={t('ui.DailyHoroscopeScreen.ask')} loading={asking} style={{ marginTop: spacing.sm }} onPress={handleAsk} />
          </View>
        </>
      )}

      <ConfirmationModal
        visible={confirmDelete}
        title={t('ui.GemstoneReportScreen.deleteThisReport')}
        description={t('ui.GemstoneReportScreen.thisPermanentlyDeletesTheGemstone')}
        confirmLabel={t('ui.AssistantHistoryScreen.delete')}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </PageContainer>
  );
}

function GuidanceRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.guidanceRow}>
      <Text variant="caption" tone="muted" style={{ width: 120 }}>{label}</Text>
      <Text variant="bodySm" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gemIconWrap: {
    width: 64, height: 64, borderRadius: radius.pill,
    backgroundColor: color.accentMuted, alignItems: 'center', justifyContent: 'center',
  },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  caratRow: { marginTop: spacing.md, alignItems: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guidanceRow: { flexDirection: 'row', paddingVertical: 4 },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: color.textPrimary,
  },
});
