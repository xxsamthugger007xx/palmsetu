import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { AIAvatar } from '../../components/AIAvatar';
import { color, radius, spacing } from '../../theme/tokens';
import { Gender, useUserProfile } from '../../context/UserProfileContext';

export function OnboardingScreen() {
  const { t } = useTranslation();
  const { setProfile } = useUserProfile();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const genderOptions: { id: Gender; label: string }[] = [
    { id: 'woman', label: t('onboarding.genderWoman') },
    { id: 'man', label: t('onboarding.genderMan') },
    { id: 'non-binary', label: t('onboarding.genderNonBinary') },
    { id: 'prefer-not-to-say', label: t('onboarding.genderPreferNotToSay') },
  ];

  const canContinue = name.trim().length > 0 && gender !== null;

  const handleContinue = async () => {
    if (!canContinue || !gender) return;
    setSubmitting(true);
    try {
      // setProfile updates local state optimistically before the backend
      // call resolves, so the app navigates past onboarding immediately -
      // this screen will already be unmounted by the time a slow/failed
      // backend save settles. If the save genuinely fails (offline, server
      // unreachable), the name/gender the user entered is not lost: it's
      // already cached in AsyncStorage and will be retried the next time
      // the identity is saved (e.g. from the edit-profile screen).
      await setProfile({ name: name.trim(), gender });
    } catch (err) {
      console.warn('[onboarding] identity save to backend failed (will retry on next save):', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer>
      <View style={styles.avatarWrap}>
        <AIAvatar name={name || '?'} gender={gender ?? 'prefer-not-to-say'} size={88} />
      </View>

      <Text variant="display" weight="semibold" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
        {t('onboarding.title')}
      </Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.xl, textAlign: 'center' }}>
        {t('onboarding.subtitle')}
      </Text>

      <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>{t('onboarding.nameLabel')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('onboarding.namePlaceholder')}
        placeholderTextColor={color.textMuted}
        style={styles.input}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
      />

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
        {t('onboarding.genderLabel')}
      </Text>
      <View style={styles.genderGrid}>
        {genderOptions.map((opt) => {
          const selected = gender === opt.id;
          return (
            <Button
              key={opt.id}
              label={opt.label}
              variant={selected ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setGender(opt.id)}
              style={styles.genderButton}
            />
          );
        })}
      </View>

      <Button
        label={t('onboarding.continueButton')}
        icon={ArrowRight}
        fullWidth
        disabled={!canContinue}
        loading={submitting}
        style={{ marginTop: spacing.xl }}
        onPress={handleContinue}
      />

      <Text variant="caption" tone="muted" style={{ marginTop: spacing.md, textAlign: 'center' }}>
        {t('onboarding.footer')}
      </Text>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: color.textPrimary,
    fontSize: 16,
  },
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  genderButton: {
    flexGrow: 1,
  },
});
