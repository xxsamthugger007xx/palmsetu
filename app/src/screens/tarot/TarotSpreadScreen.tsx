import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Lock, Info, UserPlus } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, radius, spacing } from '../../theme/tokens';
import { tarotColor } from '../../theme/tarotTheme';
import { RootStackParamList } from '../../navigation/types';
import { tarotApi } from '../../services/tarotApi';
import { SpreadDefinition } from '../../types/tarot';
import { useTranslation } from 'react-i18next';
import { ListSkeleton } from '../../components/ListSkeleton';

type LoadState = 'loading' | 'ready' | 'error';

export function TarotSpreadScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TarotSpread'>>();
  const { category, question: presetQuestion, spreadIds, questionMode = 'none' } = route.params;
  const [question, setQuestion] = useState(presetQuestion ?? '');

  const [state, setState] = useState<LoadState>('loading');
  const [spreads, setSpreads] = useState<SpreadDefinition[]>([]);
  const [selected, setSelected] = useState<SpreadDefinition | null>(null);
  const [tier, setTier] = useState<'free' | 'premium'>('free');
  const [secondPersonName, setSecondPersonName] = useState('');
  const MAX_SECOND_PERSON_NAME_LENGTH = 60;

  const load = React.useCallback(async () => {
    setState('loading');
    try {
      const [spreadsRes, limitsRes] = await Promise.all([tarotApi.getSpreads(), tarotApi.getLimits()]);
      setSpreads(spreadsRes.spreads);
      const shown = spreadsRes.spreads.filter((sp) => sp.available && (!spreadIds || spreadIds.includes(sp.id)));
      if (shown.length === 1) setSelected(shown[0]);
      setTier(limitsRes.tier);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'loading') {
    return (
      <PageContainer>
        <ListSkeleton rows={3} />
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <EmptyState icon={Info} title={t('ui.TarotSpreadScreen.couldnTLoadSpreads')} description={t('ui.TarotReportScreen.checkYourConnectionAndTry')} actionLabel={t('ui.KundliResultScreen.back')} onAction={() => navigation.goBack()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.TarotCategoryScreen.chooseASpread')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('ui.TarotSpreadScreen.eachPositionHasItsOwn')}
      </Text>

      {spreads.filter((s) => s.available && (!spreadIds || spreadIds.includes(s.id))).map((spread) => {
        const locked = spread.premium && tier !== 'premium';
        const isSelected = selected?.id === spread.id;
        return (
          <Card
            key={spread.id}
            elevated={isSelected}
            style={[styles.spreadCard, isSelected && styles.spreadCardSelected]}
            onPress={() => setSelected(spread)}
          >
            <View style={styles.spreadTop}>
              <Text variant="bodySm" weight="semibold">{spread.title}</Text>
              {locked && (
                <View style={styles.lockBadge}>
                  <Lock size={11} color={tarotColor.gold} strokeWidth={2} />
                  <Text variant="caption" style={{ color: tarotColor.gold, marginLeft: 4 }}>{t('ui.SelectAstrologyProfileScreen.premium')}</Text>
                </View>
              )}
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{spread.description}</Text>

            {isSelected && (
              <View style={{ marginTop: spacing.sm }}>
                {spread.positions.map((p) => (
                  <View key={p.index} style={styles.positionRow}>
                    <Text variant="caption" weight="semibold" style={{ width: 90, color: tarotColor.lavender }}>{p.name}</Text>
                    <Text variant="caption" tone="muted" style={{ flex: 1 }}>{p.description}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}

      {questionMode !== 'none' && (
        <Card style={{ marginTop: spacing.sm }}>
          <Text variant="label" tone="muted">{questionMode === 'required' ? t('tarot.questionRequired') : t('tarot.questionOptional')}</Text>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder={t('tarot.questionPlaceholder')}
            accessibilityLabel={t('tarot.questionPlaceholder')}
            placeholderTextColor={color.textMuted}
            style={[styles.nameInput, { marginTop: spacing.sm, minHeight: 64, textAlignVertical: 'top' }]}
            multiline
            maxLength={500}
          />
        </Card>
      )}

      {selected?.id === 'relationship-compatibility' && (
        <Card style={{ marginTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <UserPlus size={14} color={tarotColor.gold} strokeWidth={1.75} />
            <Text variant="label" style={{ color: tarotColor.gold, marginLeft: spacing.xs }}>{t('ui.TarotSpreadScreen.secondPersonOptional')}</Text>
          </View>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
            {t('ui.TarotSpreadScreen.addAFirstNameOr')}
          </Text>
          <TextInput
            value={secondPersonName}
            onChangeText={setSecondPersonName}
            placeholder={t('ui.TarotSpreadScreen.eGAlexOptional')} accessibilityLabel={t('ui.TarotSpreadScreen.eGAlexOptional')}
            placeholderTextColor={color.textMuted}
            style={styles.nameInput}
            maxLength={MAX_SECOND_PERSON_NAME_LENGTH}
          />
        </Card>
      )}

      <Button
        label={selected?.premium && tier !== 'premium' ? 'Upgrade to use this spread' : 'Shuffle and draw'}
        fullWidth
        disabled={!selected || (questionMode === 'required' && question.trim().length < 3 && !(selected.premium && tier !== 'premium'))}
        style={{ marginTop: spacing.lg }}
        onPress={() => {
          if (!selected) return;
          if (selected.premium && tier !== 'premium') {
            navigation.navigate('Paywall');
            return;
          }
          navigation.navigate('TarotDraw', {
            category,
            question: question.trim() ? question.trim() : null,
            spreadType: selected.id,
            secondPersonName: selected.id === 'relationship-compatibility' ? secondPersonName.trim() || undefined : undefined,
          });
        }}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  spreadCard: { marginBottom: spacing.sm },
  spreadCardSelected: { borderColor: tarotColor.goldMuted },
  spreadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lockBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: color.surfaceElevated, paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radius.sm },
  positionRow: { flexDirection: 'row', paddingVertical: 4 },
  nameInput: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: color.textPrimary,
  },
});
