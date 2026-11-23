import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft, ChevronDown, ChevronUp, MessageCircle, Eye, Lightbulb, AlertTriangle, CheckCircle2, Crown, Sparkles, Lock,
  Heart, Brain, Activity, TrendingUp, Gem, Hand, Fingerprint, Sparkle, Shapes, Tag, CheckCircle, History, Check,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SignUpPromptCard } from '../../components/SignUpPromptCard';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { useTranslation } from 'react-i18next';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { palmApi } from '../../services/palmApi';
import { PalmReading, PalmSectionsResponse } from '../../types/palm';

const SECTION_ICONS: Record<string, typeof Heart> = {
  heartLine: Heart, headLine: Brain, lifeLine: Activity, fateLine: TrendingUp,
  minorLine: Tag, mount: Gem, finger: Hand, thumb: Hand, nail: Fingerprint,
  handShape: Shapes, marking: Sparkle,
};

function sectionIcon(key: string) {
  return SECTION_ICONS[key] ?? Tag;
}

export function PalmReportScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PalmReport'>>();
  const { readingId } = route.params;

  const [reading, setReading] = useState<PalmReading | null>(null);
  const [sectionsData, setSectionsData] = useState<PalmSectionsResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [unlockingSection, setUnlockingSection] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [generatingComplete, setGeneratingComplete] = useState(false);

  const load = async () => {
    setState('loading');
    try {
      const [r, s] = await Promise.all([
        palmApi.getReading(readingId),
        palmApi.getSections(readingId),
      ]);
      setReading(r);
      setSectionsData(s);
      setExpanded(s.sections.find((sec) => sec.unlocked)?.sectionKey ?? s.sections[0]?.sectionKey ?? null);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    load();
  }, [readingId]);

  const handleUnlockSection = async (sectionKey: string) => {
    setSectionError(null);
    setUnlockingSection(sectionKey);
    try {
      await palmApi.unlockSection(readingId, sectionKey);
      const refreshed = await palmApi.getSections(readingId);
      setSectionsData(refreshed);
      setExpanded(sectionKey);
    } catch (err: any) {
      if (err.code === 'LIMIT_REACHED' || err.code === 'PREMIUM_REQUIRED') {
        navigation.navigate('Paywall');
      } else {
        setSectionError(err.message ?? 'Could not unlock this section. Please try again.');
      }
    } finally {
      setUnlockingSection(null);
    }
  };

  const handleUnlockComplete = async () => {
    setSectionError(null);
    setGeneratingComplete(true);
    try {
      await palmApi.generatePremiumReport(readingId);
      const refreshed = await palmApi.getSections(readingId);
      setSectionsData(refreshed);
    } catch (err: any) {
      if (err.code === 'LIMIT_REACHED' || err.code === 'PREMIUM_REQUIRED') {
        navigation.navigate('Paywall');
      } else {
        setSectionError(err.message ?? 'Could not unlock your complete reading. Please try again.');
      }
    } finally {
      setGeneratingComplete(false);
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
  const sections = sectionsData?.sections ?? [];
  const completeUnlocked = sectionsData?.completeUnlocked ?? false;
  const unlockedCount = sections.filter((s) => s.unlocked).length;

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">Palm Reading</Text>
        <View style={styles.headerActions}>
          {state === 'ready' && (
            <Card style={styles.saveBadge} padded={false}>
              <Check size={13} color={color.success} strokeWidth={2.5} />
              <Text variant="caption" tone="success" weight="semibold" style={{ marginLeft: 4 }}>{t('palm.saveLabel')}</Text>
            </Card>
          )}
          <IconButton icon={History} onPress={() => navigation.navigate('PalmHistory')} />
        </View>
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>Palm Reading</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        {new Date(reading.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
      </Text>

      {reading.hasStoredImage && (
        <Image
          source={{ uri: palmApi.imageUrl(reading.id), headers: palmApi.imageHeaders() }}
          style={styles.scanImage}
          resizeMode="cover"
        />
      )}

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
          <OverviewStat label="Unlocked" value={`${unlockedCount}/${sections.length}`} highlight={unlockedCount > 0} />
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
        <View style={styles.sectionHeader}>
          <Text variant="subtitle" weight="semibold">Reading sections</Text>
          {sections.length > 0 && (
            <Text variant="caption" tone="muted">{unlockedCount}/{sections.length} unlocked</Text>
          )}
        </View>
        <Text variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
          Every line below includes one free, genuine observation from your scan. Unlock a line for its full breakdown.
        </Text>
        {sections.length === 0 ? (
          <Text variant="bodySm" tone="muted">No specific features could be confidently matched from this photo.</Text>
        ) : (
          sections.map((section) => {
            const Icon = sectionIcon(section.sectionKey);
            return (
              <View key={section.sectionKey} style={{ marginBottom: spacing.md }}>
                <Card elevated style={{ marginBottom: section.unlocked ? spacing.sm : 0 }}>
                  <View style={styles.sectionCardHeader}>
                    <View style={styles.iconWrap}>
                      <Icon size={16} color={color.accent} strokeWidth={1.75} />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text variant="bodySm" weight="semibold">{section.title}</Text>
                    </View>
                    <View style={styles.freeBadge}>
                      <CheckCircle size={11} color={color.success} strokeWidth={2} />
                      <Text variant="caption" tone="success" style={{ marginLeft: 3 }}>FREE</Text>
                    </View>
                  </View>
                  <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>{section.freeText}</Text>
                </Card>

                {section.unlocked ? (
                  section.detail && section.detail.length > 0 && (
                    <ReportSection
                      title={`Unlocked detail`}
                      text={section.detail.map((d) => d.text).join('\n\n')}
                      expanded={expanded === section.sectionKey}
                      onToggle={() => setExpanded(expanded === section.sectionKey ? null : section.sectionKey)}
                    />
                  )
                ) : (
                  <LinearGradient
                    colors={[color.accentMuted, color.surface]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.lockCard}
                  >
                    <View style={styles.labelRow}>
                      <View style={styles.lockIconWrap}>
                        <Lock size={13} color={color.accent} strokeWidth={2} />
                      </View>
                      <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm, flex: 1 }}>
                        Unlock your complete {section.title}
                      </Text>
                    </View>
                    <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
                      Full structure, additional detected characteristics and the complete traditional interpretation for this line.
                    </Text>
                    <Button
                      label={`Unlock ${section.title} Analysis`}
                      size="sm"
                      loading={unlockingSection === section.sectionKey}
                      disabled={unlockingSection !== null}
                      style={{ marginTop: spacing.sm }}
                      onPress={() => handleUnlockSection(section.sectionKey)}
                    />
                  </LinearGradient>
                )}
              </View>
            );
          })
        )}
        {sectionError && (
          <Text variant="caption" tone="danger" style={{ marginTop: spacing.xs }}>{sectionError}</Text>
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

      {!completeUnlocked && sections.length > 0 && (
        <LinearGradient
          colors={[color.accentMuted, color.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.lockCard, { marginTop: spacing.lg }]}
        >
          <View style={styles.labelRow}>
            <Crown size={16} color={color.accent} strokeWidth={1.75} />
            <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm }}>Your palm has more to reveal</Text>
          </View>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>
            Unlock your complete palm reading to explore every detected feature and its traditional interpretation,
            across every line and mount in this reading.
          </Text>
          <Button
            label="Unlock Complete Reading"
            fullWidth
            loading={generatingComplete}
            disabled={generatingComplete}
            style={{ marginTop: spacing.md }}
            onPress={handleUnlockComplete}
          />
        </LinearGradient>
      )}

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

      <View style={{ marginTop: spacing.lg }}>
        <SignUpPromptCard
          storageKey="palm-report"
          title="Your palm reading is ready!"
          description="Create your free account to save your palm profile and access your complete report anytime, on any device."
        />
      </View>

      <Card style={styles.doneCard}>
        <CheckCircle2 size={18} color={color.secondary} strokeWidth={1.75} />
        <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm, flex: 1 }}>
          Your reading has been saved. It's now visible from Home and in your Palm History.
        </Text>
      </Card>
      <Button label="Save and Continue" fullWidth style={{ marginTop: spacing.sm }} onPress={goHome} />

    </PageContainer>
  );
}

function OverviewStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.statItem}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="mono" weight="semibold" tone={highlight ? 'success' : 'primary'} style={{ marginTop: 2 }}>{value}</Text>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill ?? 999,
    backgroundColor: color.successMuted,
    marginRight: spacing.xs,
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
  lockCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.accentBorder,
    padding: spacing.md,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accentMuted,
    borderWidth: 1,
    borderColor: color.accentBorder,
  },
  lockIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.accentBorder,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: color.successMuted,
  },
  scanImage: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    backgroundColor: color.surfaceElevated,
  },
});
