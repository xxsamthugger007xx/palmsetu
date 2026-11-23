import { devWarn } from '../../../utils/log';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Moon, Sun } from 'lucide-react-native';
import { PageContainer } from '../../../components/PageContainer';
import { Card } from '../../../components/Card';
import { Text } from '../../../components/Text';
import { Button } from '../../../components/Button';
import { color, spacing } from '../../../theme/tokens';
import { AstrologyOnboardingStackParamList } from '../../../navigation/AstrologyOnboardingStack';
import { astrologyApi } from '../../../services/astrologyApi';
import { AstrologySystem } from '../../../types/astrology';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../../services/apiRequest';
const OPTIONS: { id: AstrologySystem; title: string; subtitle: string; description: string; Icon: typeof Moon }[] = [
  {
    id: 'vedic',
    title: 'Vedic',
    subtitle: 'Sidereal, Lahiri ayanamsa',
    description: 'Rooted in Indian jyotish tradition. Uses the sidereal zodiac, nakshatras and dashas - the system most commonly used across India.',
    Icon: Moon,
  },
  {
    id: 'western',
    title: 'Western',
    subtitle: 'Tropical zodiac',
    description: 'The tropical zodiac used across most of the West. Sun signs, houses and transits calculated from the seasons rather than fixed stars.',
    Icon: Sun,
  },
];

export function OnboardingAstrologySystemScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AstrologyOnboardingStackParamList>>();
  // Vedic is shown pre-highlighted as the default choice, so selection
  // state must start matching that - otherwise Continue stays disabled
  // until the user taps a card that visually already looks selected.
  const [selected, setSelected] = useState<AstrologySystem | null>('vedic');
  const [saving, setSaving] = useState(false);
  // The Confirm screen (end of this stack) re-fetches the draft from the
  // backend and requires preferredSystem to be present there - so unlike a
  // pure "resume point" convenience, this save genuinely must succeed
  // before moving on. Previously a failed save was swallowed with only a
  // console.warn and no on-screen feedback, which is exactly the "tapping
  // Continue does nothing" bug: the button would spin, fail silently, and
  // reset with zero explanation. Now the error is shown so the user knows
  // to retry (e.g. after reconnecting) instead of wondering why nothing happened.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    astrologyApi.getOnboardingDraft()
      .then((d) => { if (d.preferredSystem) setSelected(d.preferredSystem); })
      .catch(() => {}); // no draft yet - keep the 'vedic' default
  }, []);

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await astrologyApi.saveOnboardingDraft({ preferredSystem: selected });
      navigation.navigate('OnboardingDob');
    } catch (__err) {
      const err = asApiError(__err);
      devWarn('[onboarding] failed to save astrology system:', err);
      setError(err?.isNetworkError ? t('ui.OnboardingAstrologySystemScreen.unableToConnectCheckYour') : (err?.message ?? t('ui.OnboardingAstrologySystemScreen.somethingWentWrongPleaseTry')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg }}>{t('ui.OnboardingAstrologySystemScreen.step1Of5')}</Text>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.xs }}>{t('ui.OnboardingAstrologySystemScreen.chooseYourAstrologySystem')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('ui.OnboardingAstrologySystemScreen.thisDecidesHowYourSign')}
      </Text>

      {OPTIONS.map(({ id, title, subtitle, description, Icon }) => {
        const active = selected === id;
        return (
          <Card
            key={id}
            elevated={active}
            onPress={() => setSelected(id)}
            style={[styles.option, active && styles.optionActive]}
          >
            <View style={styles.optionTop}>
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <Icon size={20} color={active ? color.bg : color.accent} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text variant="subtitle" weight="semibold">{title}</Text>
                <Text variant="caption" tone="muted">{subtitle}</Text>
              </View>
            </View>
            <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>{description}</Text>
          </Card>
        );
      })}

      {error && (
        <Text variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>{error}</Text>
      )}

      <Button
        label={t('ui.OnboardingAstrologySystemScreen.continue')}
        fullWidth
        disabled={!selected}
        loading={saving}
        style={{ marginTop: spacing.xl }}
        onPress={handleContinue}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  option: {
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  optionActive: {
    borderColor: color.accent,
  },
  optionTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: color.accent,
  },
});
