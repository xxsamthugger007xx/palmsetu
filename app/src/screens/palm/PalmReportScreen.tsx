import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft, ChevronDown, ChevronUp, MessageCircle, Eye, Lightbulb, AlertTriangle, CheckCircle2, Crown, Sparkles,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { palmApi } from '../../services/palmApi';
import { PalmReading } from '../../types/palm';

export function PalmReportScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PalmReport'>>();
  const { readingId, justCompleted } = route.params;

  const [reading, setReading] = useState<PalmReading | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [premiumExpanded, setPremiumExpanded] = useState<string | null>(null);
  const [generatingPremium, setGeneratingPremium] = useState(false);
  const [premiumError, setPremiumError] = useState<string | null>(null);

  const load = async () => {
    setState('loading');
    try {
      const r = await palmApi.getReading(readingId);
      setReading(r);
      setExpanded(r.freeReading.sections[0]?.title ?? null);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    load();
  }, [readingId]);

  const handleGeneratePremium = async () => {
    setPremiumError(null);
    setGeneratingPremium(true);
    try {
      const updated = await palmApi.generatePremiumReport(readingId);
      setReading(updated);
      setPremiumExpanded(updated.premiumReport?.sections[0]?.title ?? null);
    } catch (err: any) {
      if (err.code === 'LIMIT_REACHED' || err.code === 'PREMIUM_REQUIRED') {
        navigation.navigate('Paywall');
      } else {
        setPremiumError(err.message ?? 'Could not generate your premium report. Please try again.');
      }
    } finally {
      setGeneratingPremium(false);
    }
  };

  const goHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      })
    );
  };

  if (state === 'loading') {
    return (
      <PageContainer>
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Loading your reading...</Text>
      </PageContainer>
    );
  }

  if (state === 'error' || !reading) {
    return (
      <PageContainer>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
          <Text variant="bodySm" weight="semibold">Palm Reading</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xl, textAlign: 'center' }}>
          Couldn't load this reading. Please try again.
        </Text>
        <Button label="Retry" fullWidth style={{ marginTop: spacing.md }} onPress={load} />
      </PageContainer>
    );
  }

  const { analysis, freeReading } = reading;

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">Palm Reading</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>Palm Reading</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        {new Date(reading.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
      </Text>

      {freeReading.limitedVisibility && (
        <Card style={styles.limitedCard}>
          <AlertTriangle size={16} color={color.warning} strokeWidth={1.75} />
          <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
            Limited visibility: only part of your palm was clearly in frame, so this reading covers fewer features than a full scan would.
          </Text>
        </Card>
      )}

      <Card elevated>
        <Text variant="label" tone="muted">ANALYSIS OVERVIEW</Text>
        <View style={styles.overviewGrid}>
          <OverviewStat label="Sections matched" value={`${freeReading.sections.length}`} />
          <OverviewStat label="Image quality" value={analysis.imageQuality.ok ? 'Good' : 'Needs retake'} />
        </View>
        {analysis.uncertainFeatures.length > 0 && (
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            {analysis.uncertainFeatures.length} feature{analysis.uncertainFeatures.length === 1 ? '' : 's'} not clearly visible - left out rather than guessed.
          </Text>
        )}
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
          This analysis reports qualitative observations with a confidence score, not precise pixel coordinates - so we do not draw line-path overlays on your photo, to avoid showing anything that is not genuinely your real palm-line geometry.
        </Text>
      </Card>

      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.lg }}>{freeReading.summary}</Text>

      <View style={{ marginTop: spacing.lg }}>
        <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>Reading sections</Text>
        {freeReading.sections.length === 0 ? (
          <Text variant="bodySm" tone="muted">No specific features could be confidently matched from this photo.</Text>
        ) : (
          freeReading.sections.map((section) => (
            <ReportSection
              key={section.title}
              title={section.title}
              text={section.text}
              expanded={expanded === section.title}
              onToggle={() => setExpanded(expanded === section.title ? null : section.title)}
            />
          ))
        )}
      </View>

      {freeReading.combinedInterpretations.length > 0 && (
        <Card style={{ marginTop: spacing.lg }}>
          <Text variant="subtitle" weight="semibold">Combined patterns</Text>
          {freeReading.combinedInterpretations.map((c) => (
            <View key={c.ruleId} style={{ marginTop: spacing.sm }}>
              <Text variant="bodySm" weight="semibold">{c.title}</Text>
              <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>{c.text}</Text>
            </View>
          ))}
        </Card>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <View style={styles.sectionHeader}>
          <Text variant="subtitle" weight="semibold">Premium report</Text>
          <Crown size={16} color={color.accent} strokeWidth={1.75} />
        </View>

        {reading.premiumReport ? (
          reading.premiumReport.sections.map((section) => (
            <ReportSection
              key={section.title}
              title={section.title}
              text={section.text}
              expanded={premiumExpanded === section.title}
              onToggle={() => setPremiumExpanded(premiumExpanded === section.title ? null : section.title)}
            />
          ))
        ) : (
          <Card style={{ marginTop: spacing.sm }}>
            <View style={styles.labelRow}>
              <Sparkles size={16} color={color.accent} strokeWidth={1.75} />
              <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm }}>Unlock your full premium report</Text>
            </View>
            <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>
              A deeper reading covering every confidently matched feature, organized by personality, relationships,
              career and more - built from the same traditional palmistry knowledge base as your free reading, just
              more complete.
            </Text>
            {premiumError && (
              <Text variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>{premiumError}</Text>
            )}
            <Button
              label="Generate premium report"
              fullWidth
              loading={generatingPremium}
              disabled={generatingPremium}
              style={{ marginTop: spacing.md }}
              onPress={handleGeneratePremium}
            />
          </Card>
        )}
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="subtitle" weight="semibold">Reflective questions</Text>
        {freeReading.reflectiveQuestions.map((q) => (
          <View key={q} style={styles.questionRow}>
            <Lightbulb size={14} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
            <Text variant="bodySm" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>{q}</Text>
          </View>
        ))}
      </Card>

      <Button
        label="Ask about this reading"
        icon={MessageCircle}
        variant="secondary"
        fullWidth
        style={{ marginTop: spacing.lg }}
        onPress={() => navigation.navigate('Companion', { readingId: reading.id })}
      />

      {justCompleted && (
        <Card style={styles.doneCard}>
          <CheckCircle2 size={18} color={color.secondary} strokeWidth={1.75} />
          <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm, flex: 1 }}>
            Your reading has been saved.
          </Text>
        </Card>
      )}
      {justCompleted && (
        <Button label="Done" fullWidth style={{ marginTop: spacing.sm }} onPress={goHome} />
      )}
    </PageContainer>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="mono" weight="semibold" style={{ marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function ReportSection({
  title,
  text,
  expanded,
  onToggle,
}: {
  title: string;
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card style={{ marginBottom: spacing.sm }} onPress={onToggle}>
      <View style={styles.sectionHeader}>
        <Text variant="bodySm" weight="semibold">{title}</Text>
        {expanded ? (
          <ChevronUp size={16} color={color.textMuted} />
        ) : (
          <ChevronDown size={16} color={color.textMuted} />
        )}
      </View>
      {expanded && (
        <View style={{ marginTop: spacing.sm }}>
          <View style={styles.labelRow}>
            <Eye size={13} color={color.textMuted} strokeWidth={1.75} />
            <Text variant="label" tone="muted" style={{ marginLeft: 6 }}>TRADITIONAL INTERPRETATION</Text>
          </View>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 4 }}>{text}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overviewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  statItem: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  limitedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
});
