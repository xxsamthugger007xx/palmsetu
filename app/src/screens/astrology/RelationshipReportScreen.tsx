import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronDown, ChevronUp, Share2, Info } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { RelationshipDailyReport } from '../../types/astrology';
import { parseLocalDateString } from '../../utils/formatDate';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
import { ListSkeleton } from '../../components/ListSkeleton';
export function RelationshipReportScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RelationshipReport'>>();
  const { relationshipId, localDate } = route.params;

  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'blocked'>('loading');
  const [report, setReport] = useState<RelationshipDailyReport | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async () => {
    setState('loading');
    try {
      const res = await astrologyApi.getSharedDaily(relationshipId, localDate);
      setReport(res);
      setState('ready');
    } catch (__err) {
      const err = asApiError(__err);
      setErrorMessage(err.message);
      setState(err.status === 403 ? 'blocked' : 'error');
    }
  };

  useEffect(() => { load(); }, [relationshipId, localDate]);

  const handleShare = async () => {
    if (!report) return;
    await Share.share({ message: `${report.summary}\n\n - shared via Palm Setu (reflection, not prediction)` });
  };

  if (state === 'loading') {
    return <PageContainer><ListSkeleton rows={3} /></PageContainer>;
  }
  if (state === 'blocked') {
    return <PageContainer><EmptyState icon={Info} title={t('ui.RelationshipReportScreen.sharedReadingsAreOff')} description={errorMessage ?? undefined} actionLabel={t('ui.KundliResultScreen.back')} onAction={() => navigation.goBack()} /></PageContainer>;
  }
  if (state === 'error' || !report) {
    return <PageContainer><EmptyState icon={Info} title={t('ui.DailyHoroscopeScreen.couldnTLoadThisReading')} description={errorMessage ?? undefined} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} /></PageContainer>;
  }

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <IconButton icon={Share2} onPress={handleShare} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{report.connectionTheme}</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        {parseLocalDateString(report.localDate).toLocaleDateString()} · {report.sharedAstrologyMode === 'cross-system' ? 'Cross-system reflection' : report.sharedAstrologyMode}
      </Text>

      <Section title={t('ui.RelationshipReportScreen.ourDayAtAGlance')}><Text variant="bodySm" tone="secondary">{report.summary}</Text></Section>

      <Section title={t('ui.RelationshipReportScreen.whatMayHelpToday')}>
        {report.helpfulActions.map((a) => <Text key={a} variant="bodySm" tone="secondary" style={{ marginBottom: 4 }}>• {a}</Text>)}
      </Section>

      <Section title={t('ui.DailyHoroscopeScreen.whatToBeMindfulOf')}>
        {report.potentialFrictionAreas.map((a) => <Text key={a} variant="bodySm" tone="secondary" style={{ marginBottom: 4 }}>• {a}</Text>)}
      </Section>

      <Section title={t('ui.RelationshipReportScreen.communicationGuidance')}><Text variant="bodySm" tone="secondary">{report.communicationPrompt}</Text></Section>
      <Section title={t('ui.RelationshipReportScreen.qualityTimeSuggestion')}><Text variant="bodySm" tone="secondary">{report.sharedActivity}</Text></Section>
      <Section title={t('ui.RelationshipReportScreen.aQuestionToAskEach')}><Text variant="bodySm" tone="accent">{report.sharedQuestion}</Text></Section>

      <Section title={t('ui.RelationshipReportScreen.individualSupport')}>
        <Text variant="bodySm" tone="secondary" style={{ marginBottom: spacing.xs }}>{report.individualSupportA}</Text>
        <Text variant="bodySm" tone="secondary">{report.individualSupportB}</Text>
      </Section>

      <Card style={{ marginBottom: spacing.sm }} onPress={() => setExplanationOpen((o) => !o)}>
        <View style={styles.sectionHeader}>
          <Text variant="bodySm" weight="semibold">{t('ui.DailyHoroscopeScreen.astrologyBehindThisReading')}</Text>
          {explanationOpen ? <ChevronUp size={16} color={color.textMuted} /> : <ChevronDown size={16} color={color.textMuted} />}
        </View>
        {explanationOpen && (
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{report.astrologicalExplanation}</Text>
        )}
      </Card>

      <Card>
        <Text variant="caption" tone="muted">
          {t('ui.RelationshipReportScreen.thisReadingIsForReflection')}
        </Text>
      </Card>
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
