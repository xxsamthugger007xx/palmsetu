import { tr } from '../../utils/tr';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Share2, Sparkles, Heart, Info, Gift } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { soulmateApi } from '../../services/soulmateApi';
import { SoulmateSketch } from '../../types/soulmate';
import { SOULMATE_SKETCH_REGISTRY } from '../../data/soulmateSketchRegistry';
import { useTranslation } from 'react-i18next';

const STYLE_LABEL: Record<string, string> = {
  pencil: 'Realistic pencil sketch',
  charcoal: 'Charcoal portrait',
  'soft-portrait': 'Soft artistic portrait',
};
const GENDER_LABEL: Record<string, string> = { male: 'Male', female: 'Female', 'no-preference': 'No preference' };

function formatCountry(id: string): string {
  if (id === 'no-preference') return 'No preference';
  return id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

export function SoulmateResultScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SoulmateResult'>>();
  const { sketchId } = route.params;

  const [sketch, setSketch] = useState<SoulmateSketch | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sharing, setSharing] = useState(false);

  const load = async () => {
    setState('loading');
    try {
      const res = await soulmateApi.getSketch(sketchId);
      setSketch(res);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sketchId]);

  const handleShare = async () => {
    if (!sketch) return;
    setSharing(true);
    try {
      const localUri = `${FileSystem.cacheDirectory}soulmate-sketch-${sketch.id}.png`;
      await FileSystem.downloadAsync(soulmateApi.shareImageUrl(sketch.id), localUri);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri, { mimeType: 'image/png' });
      }
      soulmateApi.recordShare(sketch.id);
    } catch {
      // A cancelled/unavailable share sheet is not an app error.
    } finally {
      setSharing(false);
    }
  };

  const goHome = () => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }));
  };

  if (state === 'loading') {
    return (
      <PageContainer>
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>{t('ui.SoulmateResultScreen.loadingYourSketch')}</Text>
      </PageContainer>
    );
  }

  if (state === 'error' || !sketch) {
    return (
      <PageContainer>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xl, textAlign: 'center' }}>
          {t('ui.SoulmateResultScreen.couldnTLoadThisSketch')}
        </Text>
        <Button label={t('ui.AstrologyLandingScreen.retry')} fullWidth style={{ marginTop: spacing.md }} onPress={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer onRefresh={load}>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('ui.SoulmateResultScreen.yourSoulmateSketch')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: 4, marginBottom: spacing.lg }}>
        {new Date(sketch.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
      </Text>

      {sketch.imageFilename && SOULMATE_SKETCH_REGISTRY[sketch.imageFilename] && (
        <Image source={SOULMATE_SKETCH_REGISTRY[sketch.imageFilename]} accessibilityLabel={tr('a11y.soulmatePortrait')} style={styles.portrait} resizeMode="cover" />
      )}

      <Card elevated style={{ marginTop: spacing.md }}>
        <Text variant="label" tone="muted">{t('ui.SoulmateResultScreen.preferences')}</Text>
        <View style={styles.prefRow}>
          <Text variant="caption" tone="muted">{t('ui.SoulmatePaymentScreen.gender')}</Text>
          <Text variant="bodySm" weight="semibold">{GENDER_LABEL[sketch.preferredGender] ?? sketch.preferredGender}</Text>
        </View>
        <View style={styles.prefRow}>
          <Text variant="caption" tone="muted">{t('ui.SoulmatePaymentScreen.ageRange')}</Text>
          <Text variant="bodySm" weight="semibold">{sketch.preferredAgeRange}</Text>
        </View>
        <View style={styles.prefRow}>
          <Text variant="caption" tone="muted">{t('ui.SoulmateResultScreen.background')}</Text>
          <Text variant="bodySm" weight="semibold">{formatCountry(sketch.preferredCountry)}</Text>
        </View>
        <View style={[styles.prefRow, { borderBottomWidth: 0 }]}>
          <Text variant="caption" tone="muted">{t('ui.SoulmatePaymentScreen.style')}</Text>
          <Text variant="bodySm" weight="semibold">{STYLE_LABEL[sketch.style] ?? sketch.style}</Text>
        </View>
      </Card>

      {sketch.personalityDescription && (
        <Card elevated style={{ marginTop: spacing.lg }}>
          <View style={styles.labelRow}>
            <Sparkles size={14} color={color.accent} strokeWidth={1.75} />
            <Text variant="label" tone="accent" style={{ marginLeft: 6 }}>{t('ui.SoulmateResultScreen.personalityReflection')}</Text>
          </View>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>{sketch.personalityDescription}</Text>
        </Card>
      )}

      {sketch.compatibilityInsights && sketch.compatibilityInsights.length > 0 && (
        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.labelRow}>
            <Heart size={14} color={color.textMuted} strokeWidth={1.75} />
            <Text variant="label" tone="muted" style={{ marginLeft: 6 }}>{t('ui.SoulmateResultScreen.compatibilityTraits')}</Text>
          </View>
          {sketch.compatibilityInsights.map((trait, i) => (
            <Text key={i} variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>- {trait}</Text>
          ))}
        </Card>
      )}

      <Card style={styles.disclaimerCard}>
        <Info size={14} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>
          {t('ui.SoulmateResultScreen.thisPortraitAndReflectionAre')}
        </Text>
      </Card>

      <Button
        label={t('ui.SoulmateResultScreen.share')}
        icon={Share2}
        variant="secondary"
        fullWidth
        loading={sharing}
        disabled={sharing}
        style={{ marginTop: spacing.lg }}
        onPress={handleShare}
      />

      <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
        {t('ui.SoulmateResultScreen.savedToMyReportsShared')}
      </Text>

      {sketch.isFreeTrial && (
        <Card elevated style={styles.upsellCard}>
          <View style={styles.labelRow}>
            <Gift size={16} color={color.accent} strokeWidth={1.75} />
            <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm }}>{t('ui.SoulmateResultScreen.lovedYourFreeSketch')}</Text>
          </View>
          <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
            {t('ui.SoulmateResultScreen.exploreMorePortraitsAndStyles')}
          </Text>
          <Button
            label={t('ui.SoulmateResultScreen.explorePremiumSketches')}
            variant="secondary"
            fullWidth
            style={{ marginTop: spacing.md }}
            onPress={() => navigation.navigate('SoulmateQuestionnaire', { intent: 'paid' })}
          />
        </Card>
      )}

      <Button label={t('ui.SoulmateResultScreen.done')} fullWidth style={{ marginTop: spacing.md }} onPress={goHome} />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  portrait: {
    width: '100%',
    height: 360,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceElevated,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.borderSubtle,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
  upsellCard: {
    marginTop: spacing.lg,
  },
});
