import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { Gender, useUserProfile } from '../../context/UserProfileContext';

/**
 * Edit Profile: the name/gender identity fields, separate from birth
 * details (date/time/place, which AstrologyProfileSetupScreen already
 * handles). Reachable from ProfileScreen's "Personal info" row, which
 * previously had no destination (onPress={() => {}}).
 */
export function EditProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile, setProfile } = useUserProfile();

  const [name, setName] = useState(profile?.name ?? '');
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const genderOptions: { id: Gender; label: string }[] = [
    { id: 'woman', label: t('onboarding.genderWoman') },
    { id: 'man', label: t('onboarding.genderMan') },
    { id: 'non-binary', label: t('onboarding.genderNonBinary') },
    { id: 'prefer-not-to-say', label: t('onboarding.genderPreferNotToSay') },
  ];

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await setProfile({ name: name.trim(), gender: gender ?? 'prefer-not-to-say' });
      navigation.goBack();
    } catch (err: any) {
      // Same network-vs-backend distinction as AstrologyProfileSetupScreen:
      // err.isNetworkError means the request never reached the server, so
      // the generic friendly message is already in err.message (see
      // services/apiRequest.ts). Entered name/gender stay in the form
      // either way - nothing above is cleared on failure.
      setError(err?.message ?? 'Something went wrong saving your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>Personal info</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Your name and how you'd like to be addressed. Birth date, time and place are edited separately
        under Daily Cosmic Guidance.
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

      {error && (
        <Card style={{ marginTop: spacing.md }}>
          <Text variant="caption" tone="danger">{error}</Text>
        </Card>
      )}

      <Button
        label="Save changes"
        fullWidth
        disabled={!canSave}
        loading={saving}
        style={{ marginTop: spacing.xl }}
        onPress={handleSave}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
