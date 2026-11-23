import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import { PageContainer } from '../../../components/PageContainer';
import { Card } from '../../../components/Card';
import { Text } from '../../../components/Text';
import { Button, IconButton } from '../../../components/Button';
import { color, spacing } from '../../../theme/tokens';
import { AstrologyOnboardingStackParamList } from '../../../navigation/AstrologyOnboardingStack';
import { astrologyApi } from '../../../services/astrologyApi';
import { BirthplaceOption } from '../../../data/birthplaces';
import { BirthplacePickerModal } from './BirthplacePickerModal';

export function OnboardingPlaceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AstrologyOnboardingStackParamList>>();
  const [place, setPlace] = useState<BirthplaceOption | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    astrologyApi.getOnboardingDraft()
      .then((d) => {
        if (d.birthPlace && d.birthLatitude != null && d.birthLongitude != null && d.timezone) {
          const [cityPart, countryPart] = d.birthPlace.split(',').map((s) => s.trim());
          setPlace({ city: cityPart ?? d.birthPlace, country: countryPart ?? '', timezone: d.timezone, latitude: d.birthLatitude, longitude: d.birthLongitude });
        }
      })
      .catch(() => {});
  }, []);

  const handleContinue = async () => {
    if (!place) return;
    setSaving(true);
    setError(null);
    try {
      await astrologyApi.saveOnboardingDraft({
        birthPlace: `${place.city}, ${place.country}`,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone,
      });
      navigation.navigate('OnboardingConfirm');
    } catch (err: any) {
      console.warn('[onboarding] failed to save birthplace:', err);
      setError(err?.isNetworkError ? 'Unable to connect. Check your connection and try again.' : (err?.message ?? 'Something went wrong. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        )}
      </View>
      <Text variant="label" tone="muted" style={{ marginTop: spacing.md }}>STEP 4 OF 5</Text>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.xs }}>Where were you born?</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Choose the closest major city - this also sets your birth time zone for accurate calculation.
      </Text>

      <Card onPress={() => setShowPicker(true)} style={styles.selectorCard}>
        <MapPin size={16} color={color.accent} strokeWidth={1.75} />
        <Text variant="bodySm" tone={place ? 'primary' : 'muted'} style={{ marginLeft: spacing.sm }}>
          {place ? `${place.city}, ${place.country}` : 'Select birthplace'}
        </Text>
      </Card>

      {error && (
        <Text variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>{error}</Text>
      )}

      <Button
        label="Continue"
        fullWidth
        disabled={!place}
        loading={saving}
        style={{ marginTop: spacing.xl }}
        onPress={handleContinue}
      />

      <BirthplacePickerModal
        visible={showPicker}
        selected={place}
        onClose={() => setShowPicker(false)}
        onSelect={(p) => { setPlace(p); setShowPicker(false); }}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  selectorCard: { flexDirection: 'row', alignItems: 'center' },
});
