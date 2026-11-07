import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChevronLeft, Calendar, Clock, MapPin, Search, X, Check } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { AstrologySystem } from '../../types/astrology';
import { BIRTHPLACES, BirthplaceOption } from '../../data/birthplaces';

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AstrologyProfileSetup'>>();
  const returnTo = route.params?.returnTo;

  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthTime, setBirthTime] = useState<Date | null>(null);
  const [birthplace, setBirthplace] = useState<BirthplaceOption | null>(null);
  const [system, setSystem] = useState<AstrologySystem>('western');
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
      })
      .catch(() => {}) // no saved profile yet - leave the form empty, this is the honest first-time state
      .finally(() => setLoadingExisting(false));
  }, []);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');

  const filteredPlaces = useMemo(() => {
    const q = placeQuery.trim().toLowerCase();
    if (!q) return BIRTHPLACES;
    return BIRTHPLACES.filter((p) => p.city.toLowerCase().includes(q) || p.country.toLowerCase().includes(q));
  }, [placeQuery]);

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
    } catch (err: any) {
      // err.isNetworkError (set by services/apiRequest.ts) distinguishes a
      // request that never reached the server (wrong/stale IP, server
      // down, no connectivity) from a reached-but-rejecting server (e.g.
      // a genuine validation message). Only the former gets the generic
      // friendly rewrite - a real backend error message should still
      // reach the user verbatim. Either way, the form fields entered
      // above are untouched: this catch never resets birthDate/birthTime/
      // birthplace/system state, so retrying does not require re-entry.
      setError(err?.isNetworkError ? err.message : (err.message ?? 'Something went wrong saving your profile.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>Your birth details</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Used only for traditional astrology calculations - reflective interpretation, not scientific
        prediction. Exact birth time and place meaningfully change your Moon sign, nakshatra and daily
        transits, so all three are required for an accurate reading.
      </Text>

      <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>ASTROLOGY SYSTEM</Text>
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
        Vedic (sidereal) and Western (tropical) use different conventions and will show different sign
        and transit results for the same birth details.
      </Text>

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>DATE OF BIRTH</Text>
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
          maximumDate={new Date()}
          onChange={handleDateChange}
        />
      )}

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>EXACT TIME OF BIRTH</Text>
      <Card onPress={() => setShowTimePicker(true)} style={styles.selectorCard}>
        <Clock size={16} color={color.accent} strokeWidth={1.75} />
        <Text variant="bodySm" tone={birthTime ? 'primary' : 'muted'} style={{ marginLeft: spacing.sm }}>
          {birthTime ? formatTime(birthTime) : 'Select time of birth'}
        </Text>
      </Card>
      <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
        Check your birth certificate or ask a parent if unsure - even a 30-minute difference can shift
        your Moon sign near a sign boundary.
      </Text>
      {showTimePicker && (
        <DateTimePicker
          value={birthTime ?? new Date(2000, 0, 1, 12, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>BIRTHPLACE</Text>
      <Card onPress={() => setShowPlacePicker(true)} style={styles.selectorCard}>
        <MapPin size={16} color={color.accent} strokeWidth={1.75} />
        <Text variant="bodySm" tone={birthplace ? 'primary' : 'muted'} style={{ marginLeft: spacing.sm }}>
          {birthplace ? `${birthplace.city}, ${birthplace.country}` : 'Select birthplace'}
        </Text>
      </Card>
      <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
        Choose the closest major city - this also sets your birth time zone for accurate calculation.
      </Text>

      {error && (
        <Card style={{ marginTop: spacing.md }}>
          <Text variant="caption" tone="danger">{error}</Text>
        </Card>
      )}

      <Button
        label="Save and continue"
        fullWidth
        disabled={!canContinue}
        loading={saving}
        style={{ marginTop: spacing.xl }}
        onPress={handleSave}
      />

      <Modal visible={showPlacePicker} animationType="slide" onRequestClose={() => setShowPlacePicker(false)}>
        <PageContainer scroll={false}>
          <View style={styles.header}>
            <Text variant="bodySm" weight="semibold">Select birthplace</Text>
            <IconButton icon={X} onPress={() => setShowPlacePicker(false)} />
          </View>

          <View style={styles.searchRow}>
            <Search size={16} color={color.textMuted} strokeWidth={1.75} />
            <TextInput
              value={placeQuery}
              onChangeText={setPlaceQuery}
              placeholder="Search city or country"
              placeholderTextColor={color.textMuted}
              style={styles.searchInput}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredPlaces}
            keyExtractor={(p) => `${p.city}-${p.country}`}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            renderItem={({ item }) => {
              const selected = birthplace?.city === item.city && birthplace?.country === item.country;
              return (
                <Card
                  onPress={() => {
                    setBirthplace(item);
                    setShowPlacePicker(false);
                    setPlaceQuery('');
                  }}
                  style={styles.placeRow}
                  padded={false}
                >
                  <View style={styles.placeRowInner}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodySm" weight="medium">{item.city}</Text>
                      <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{item.country} - {item.timezone}</Text>
                    </View>
                    {selected && <Check size={18} color={color.accent} strokeWidth={2} />}
                  </View>
                </Card>
              );
            }}
          />
        </PageContainer>
      </Modal>
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
    borderRadius: radius.md,
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
