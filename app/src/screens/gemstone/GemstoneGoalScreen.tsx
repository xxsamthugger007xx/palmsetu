import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Briefcase, Heart, Smile, GraduationCap, DollarSign, Compass } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { gemstoneApi } from '../../services/gemstoneApi';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
const goalOptions = [
  { id: 'career', label: 'Career', icon: Briefcase },
  { id: 'relationships', label: 'Relationships', icon: Heart },
  { id: 'confidence', label: 'Confidence', icon: Smile },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'finances', label: 'Finances', icon: DollarSign },
  { id: 'general', label: 'General guidance', icon: Compass },
];

export function GemstoneGoalScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [goals, setGoals] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleGoal = (id: string) => {
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await gemstoneApi.createReport(goals, null);
      navigation.replace('GemstoneReport', { reportId: report.id });
    } catch (__err) {
      const err = asApiError(__err);
      if (err.code === 'LIMIT_REACHED') {
        navigation.navigate('Paywall');
      } else {
        setError(err.message ?? t('ui.GemstoneGoalScreen.somethingWentWrongGeneratingYour'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.GemstoneGoalScreen.whatSOnYourMind')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('ui.GemstoneGoalScreen.optionalSelectAsManyAs')}
      </Text>

      <View style={styles.grid}>
        {goalOptions.map((g) => {
          const isSelected = goals.includes(g.id);
          return (
            <Card
              key={g.id}
              elevated={isSelected}
              style={[styles.goalCard, isSelected && styles.goalCardSelected]}
              onPress={() => toggleGoal(g.id)}
            >
              <g.icon size={18} color={color.accent} strokeWidth={1.75} />
              <Text variant="bodySm" weight={isSelected ? 'semibold' : 'regular'} style={{ marginTop: spacing.xs }}>{g.label}</Text>
            </Card>
          );
        })}
      </View>

      {error && (
        <Card style={{ marginTop: spacing.md }}>
          <Text variant="caption" tone="danger">{error}</Text>
        </Card>
      )}

      <Button
        label={t('ui.GemstoneGoalScreen.generateMyGemstoneGuide')}
        fullWidth
        loading={loading}
        style={{ marginTop: spacing.xl }}
        onPress={handleGenerate}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  goalCard: { width: '31%', alignItems: 'center', paddingVertical: spacing.md },
  goalCardSelected: { borderColor: color.accentBorder },
});
