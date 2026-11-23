import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChevronLeft, Calendar, Clock, MapPin } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { AstrologySystem } from '../../types/astrology';
import { BirthplaceOption } from '../../data/birthplaces';
import { BirthplacePickerModal } from './onboarding/BirthplacePickerModal';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function toTimeString(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}:00`;
}

export function AstrologyProfileSetupScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AstrologyProfileSetup'>>();
  const returnTo = route.params?.returnTo;

  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthTime, setBirthTime] = useState<Date | null>(null);
  const [birthplace, setBirthplace] = useState<BirthplaceOption | null>(null);
  const [system, setSystem] = useState<AstrologySystem>('western');
  // Tracks the system this screen was opened with, so changing it can show
  // an explicit confirmation (charts/interpretations will change) before
  // saving - only relevant when editing an existing profile from Profile,
  // not on a brand-new save where there's nothing to warn about changing.
  const [originalSystem, setOriginalSystem] = useState<AstrologySystem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Populate the form with the saved profile when one already exists, so
  // editing birth details shows current values instead of a blank form.
  useEffect(() => {
    astrologyApi.getProfile()
      .then((p) => {
        setBirthDate(new Date(`${p.birthDate}T00:00:00`));
        if (p.birthTime) {
          const [h, m] = p.birthTime.split(':').map(Number);
          const t = new Date();
          t.setHours(h, m, 0, 0);
          setBirthTime(t);
        }
        if (p.birthPlace && p.birthLatitude != null && p.birthLongitude != null) {
          const [cityPart, countryPart] = p.birthPlace.split(',').map((s) => s.trim());
          setBirthplace({
            city: cityPart ?? p.birthPlace,
            country: countryPart ?? '',
            timezone: p.timezone,
            latitude: p.birthLatitude,
            longitude: p.birthLongitude,
          });
        }
        setSystem(p.preferredSystem);
        setOriginalSystem(p.preferredSystem);
      })
      .catch(() => {}) // no saved profile yet - leave the form empty, this is the honest first-time state
      .finally(() => setLoadingExisting(false));
  }, []);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPlacePicker, setShowPlacePicker] = useState(false);

  const canContinue = birthDate !== null && birthTime !== null && birthplace !== null;

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (event.type !== 'dismissed' && selected) setBirthDate(selected);
    if (Platform.OS === 'android') setShowDatePicker(false);
  };

  const handleTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (event.type !== 'dismissed' && selected) setBirthTime(selected);
    if (Platform.OS === 'android') setShowTimePicker(false);
  };

  const handleSave = async () => {
    if (!canContinue || !birthDate || !birthTime || !birthplace) return;
    // Changing the astrology system specifically (not just birth details)
    // meaningfully changes chart/interpretation results - confirm before
    // saving, matching the existing destructive-confirmation pattern (e.g.
    // PalmHistoryScreen's delete confirmation).
    if (returnTo === 'profile' && originalSystem && originalSystem !== system) {
      Alert.alert(
        t('ui.AstrologyProfileSetupScreen.changeAstrologySystem'),
        t('ui.AstrologyProfileSetupScreen.switchingBetweenVedicAndWestern'),
        [
          { text: t('ui.AssistantHistoryScreen.cancel'), style: 'cancel' },
          { text: t('ui.AstrologyProfileSetupScreen.changeSystem'), style: 'destructive', onPress: () => void doSave() },
        ],
      );
      return;
    }
    await doSave();
  };

  const doSave = async () => {
    if (!birthDate || !birthTime || !birthplace) return;
    setSaving(true);
    setError(null);
    try {
      await astrologyApi.saveProfile({
        birthDate: toDateString(birthDate),
        birthTime: toTimeString(birthTime),
        birthPlace: `${birthplace.city}, ${birthplace.country}`,
        latitude: birthplace.latitude,
        longitude: birthplace.longitude,
        preferredSystem: system,
        timezone: birthplace.timezone,
      });
      // Birth details are profile data, not step 1 of an astrology flow -
      // when opened from Profile, saving returns straight to Profile, never
      // into the astrology section. Every other entry point (empty-state
      // prompts inside astrology-adjacent screens) keeps its existing
      // continue-into-the-feature behavior.
      if (returnTo === 'profile') {
        navigation.goBack();
      } else {
        navigation.replace('AstrologyLanding');
      }
    } catch (__err) {
      const err = asApiError(__err);
      // err.isNetworkError (set by services/apiRequest.ts) distinguishes a
      // request that never reached the server (wrong/stale IP, server
      // down, no connectivity) from a reached-but-rejecting server (e.g.
      // a genuine validation message). Only the former gets the generic
      // friendly rewrite - a real backend error message should still
      // reach the user verbatim. Either way, the form fields entered
      // above are untouched: this catch never resets birthDate/birthTime/
      // birthplace/system state, so retrying does not require re-entry.
      setError(err?.isNetworkError ? err.message : (err.message ?? t('ui.AstrologyProfileSetupScreen.somethingWentWrongSavingYour')));
    } finally {
      setSaving(false);
    }
  };

  return (
    // No real re-fetch wired here deliberately: this form pre-fills the
    // saved birth profile once on mount and the fields are actively edited
    // in place - re-fetching on pull would silently discard an in-progress,
    // unsaved edit. The gesture still responds, it just has nothing safe to
    // reload without risking the user's current input.
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.AstrologyProfileSetupScreen.yourBirthDetails')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('ui.AstrologyProfileSetupScreen.usedOnlyForTraditionalAstrology')}
      </Text>

      <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>{t('ui.AstrologyProfileSetupScreen.astrologySystem')}</Text>
      <View style={styles.systemRow}>
        {(['western', 'vedic'] as AstrologySystem[]).map((s) => (
          <Button
            key={s}
            label={s === 'western' ? 'Western' : 'Vedic'}
            variant={system === s ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setSystem(s)}
            style={{ flex: 1 }}
          />
        ))}
      </View>
      <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
        {t('ui.AstrologyProfileSetupScreen.vedicSiderealAndWesternTropical')}
      </Text>

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('ui.AstrologyProfileSetupScreen.dateOfBirth')}</Text>
      <Card onPress={() => setShowDatePicker(true)} style={styles.selectorCard}>
        <Calendar size={16} color={color.accent} strokeWidth={1.75} />
        <Text variant="bodySm" tone={birthDate ? 'primary' : 'muted'} style={{ marginLeft: spacing.sm }}>
          {birthDate ? formatDate(birthDate) : 'Select date of birth'}
        </Text>
      </Card>
      {showDatePicker && (
        <DateTimePicker
          value={birthDate ?? new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          themeVariant="dark"
          maximumDate={new Date()}
          onChange={handleDateChange}
        />
      )}

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('ui.AstrologyProfileSetupScreen.exactTimeOfBirth')}</Text>
      <Card onPress={() => setShowTimePicker(true)} style={styles.selectorCard}>
        <Clock size={16} color={color.accent} strokeWidth={1.75} />
        <Text variant="bodySm" tone={birthTime ? 'primary' : 'muted'} style={{ marginLeft: spacing.sm }}>
          {birthTime ? formatTime(birthTime) : 'Select time of birth'}
        </Text>
      </Card>
      <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
        {t('ui.AstrologyProfileSetupScreen.checkYourBirthCertificateOr')}
      </Text>
      {showTimePicker && (
        <DateTimePicker
          value={birthTime ?? new Date(2000, 0, 1, 12, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          themeVariant="dark"
          onChange={handleTimeChange}
        />
      )}

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('ui.AstrologyProfileSetupScreen.birthplace')}</Text>
      <Card onPress={() => setShowPlacePicker(true)} style={styles.selectorCard}>
        <MapPin size={16} color={color.accent} strokeWidth={1.75} />
        <Text variant="bodySm" tone={birthplace ? 'primary' : 'muted'} style={{ marginLeft: spacing.sm }}>
          {birthplace ? `${birthplace.city}, ${birthplace.country}` : 'Select birthplace'}
        </Text>
      </Card>
      <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
        {t('ui.AstrologyProfileSetupScreen.chooseTheClosestMajorCity')}
      </Text>

      {error && (
        <Card style={{ marginTop: spacing.md }}>
          <Text variant="caption" tone="danger">{error}</Text>
        </Card>
      )}

      <Button
        label={t('ui.AstrologyProfileSetupScreen.saveAndContinue')}
        fullWidth
        disabled={!canContinue}
        loading={saving}
        style={{ marginTop: spacing.xl }}
        onPress={handleSave}
      />

      <BirthplacePickerModal
        visible={showPlacePicker}
        selected={birthplace}
        onClose={() => setShowPlacePicker(false)}
        onSelect={(place) => {
          setBirthplace(place);
          setShowPlacePicker(false);
        }}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  systemRow: { flexDirection: 'row', gap: spacing.sm },
  selectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    padding: spacing.md,
    paddingLeft: spacing.sm,
    color: color.textPrimary,
  },
  placeRow: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  placeRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
