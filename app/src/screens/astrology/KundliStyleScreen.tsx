import React, { useCallback, useState } from 'react';
import { FlatList, Modal, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Diamond, Grid3x3, CircleDot, Crown, MapPin, Search, X, Check, UserCog } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { kundliApi } from '../../services/kundliApi';
import { astrologyApi } from '../../services/astrologyApi';
import { KundliChartStyle, KundliLimits } from '../../types/kundli';
import { BIRTHPLACES, BirthplaceOption } from '../../data/birthplaces';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'KundliStyle'>;

const STYLES: { key: KundliChartStyle; title: string; description: string; icon: typeof Diamond }[] = [
  { key: 'northIndia', title: 'North India', description: 'Diamond chart: fixed house wedges from your ascendant', icon: Diamond },
  { key: 'southIndia', title: 'South India', description: 'Box chart: fixed 4x4 grid, signs in fixed positions', icon: Grid3x3 },
  { key: 'western', title: 'Western', description: 'Circular wheel chart with sidereal planet placements', icon: CircleDot },
];

export function KundliStyleScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { subject } = route.params;

  const [limits, setLimits] = useState<KundliLimits | null>(null);
  const [profileReady, setProfileReady] = useState<'loading' | 'incomplete' | 'ready' | null>(
    subject === 'self' ? 'loading' : 'ready',
  );
  const [selected, setSelected] = useState<KundliChartStyle>('northIndia');
  const [subjectName, setSubjectName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthplace, setBirthplace] = useState<BirthplaceOption | null>(null);
  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredPlaces = React.useMemo(() => {
    const q = placeQuery.trim().toLowerCase();
    if (!q) return BIRTHPLACES;
    return BIRTHPLACES.filter((p) => p.city.toLowerCase().includes(q) || p.country.toLowerCase().includes(q));
  }, [placeQuery]);

  useFocusEffect(useCallback(() => {
    kundliApi.getLimits().then(setLimits).catch(() => setLimits(null));
    if (subject === 'self') {
      setProfileReady('loading');
      astrologyApi.getProfile()
        .then((p) => {
          const complete = Boolean(p.birthDate && p.birthTime && p.birthLatitude != null && p.birthLongitude != null);
          setProfileReady(complete ? 'ready' : 'incomplete');
        })
        .catch(() => setProfileReady('incomplete'));
    }
  }, [subject]));

  const gated = subject === 'other'
    ? limits && !limits.canGenerateOther
    : limits && !limits.canGenerateSelf;

  const costBadge = (key: KundliChartStyle) => {
    if (!limits) return null;
    if (subject === 'other') return limits.canGenerateOther ? 'Premium' : 'Premium';
    return limits.canGenerateSelf ? 'Free' : 'Premium';
  };

  const canSubmit = subject === 'self' || Boolean(subjectName && birthDate && birthTime && birthplace);

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const chart = await kundliApi.create({
        style: selected,
        subject,
        ...(subject === 'other' && birthplace
          ? { subjectName, birthDate, birthTime, latitude: birthplace.latitude, longitude: birthplace.longitude }
          : {}),
      });
      navigation.navigate('KundliResult', { chartId: chart.id });
    } catch (err: any) {
      if (err.code === 'LIMIT_REACHED' || err.code === 'PREMIUM_REQUIRED') {
        navigation.navigate('Paywall');
      } else {
        setError(err.message ?? 'Could not generate your chart. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  if (profileReady === 'loading') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Style Chart</Text>
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.lg }}>Loading...</Text>
      </PageContainer>
    );
  }

  if (profileReady === 'incomplete') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Style Chart</Text>
        <EmptyState
          icon={UserCog}
          title="Complete your birth details"
          description="Your name, birth date and time, and birthplace are needed to calculate your ascendant and houses."
          actionLabel="Add birth details"
          onAction={() => navigation.navigate('AstrologyProfileSetup')}
        />
      </PageContainer>
    );
  }

  if (gated) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Style Chart</Text>
        <EmptyState
          icon={Crown}
          title={subject === 'other' ? "Other person's astrology is premium" : 'Free kundli generation used'}
          description={subject === 'other'
            ? 'Generating another person\'s chart requires Premium.'
            : 'Your free kundli generation has been used. Upgrade for additional charts.'}
          actionLabel="Upgrade"
          onAction={() => navigation.navigate('Paywall')}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Style Chart</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Choose a chart style and confirm the birth details to generate.
      </Text>

      {STYLES.map(({ key, title, description, icon: Icon }) => {
        const active = selected === key;
        return (
          <Card
            key={key}
            onPress={() => setSelected(key)}
            style={[styles.styleCard, active && styles.styleCardActive] as any}
          >
            <View style={styles.row}>
              <View style={[styles.iconWrap, active && { borderColor: color.accentBorder, backgroundColor: color.accentMuted }]}>
                <Icon size={18} color={active ? color.accent : color.textMuted} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="bodySm" weight="semibold">{title}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{description}</Text>
              </View>
              <View style={styles.badge}>
                <Text variant="caption" tone={costBadge(key) === 'Free' ? 'success' : 'warning'}>{costBadge(key)}</Text>
              </View>
            </View>
          </Card>
        );
      })}

      {subject === 'other' && (
        <View style={{ marginTop: spacing.lg }}>
          <Text variant="label" tone="muted">THEIR DETAILS</Text>
          <TextInput value={subjectName} onChangeText={setSubjectName} placeholder="Name" placeholderTextColor={color.textMuted} style={styles.input} />
          <TextInput value={birthDate} onChangeText={setBirthDate} placeholder="Birth date (YYYY-MM-DD)" placeholderTextColor={color.textMuted} style={styles.input} />
          <TextInput value={birthTime} onChangeText={setBirthTime} placeholder="Birth time (HH:MM, 24h)" placeholderTextColor={color.textMuted} style={styles.input} />
          <Card onPress={() => setShowPlacePicker(true)} style={[styles.input, styles.placeSelector] as any}>
            <MapPin size={16} color={color.accent} strokeWidth={1.75} />
            <Text variant="bodySm" tone={birthplace ? 'primary' : 'muted'} style={{ marginLeft: spacing.sm }}>
              {birthplace ? `${birthplace.city}, ${birthplace.country}` : 'Select birthplace'}
            </Text>
          </Card>
        </View>
      )}

      {error && <Text variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>{error}</Text>}

      <Button
        label="Generate"
        onPress={handleGenerate}
        loading={generating}
        disabled={!canSubmit || generating}
        fullWidth
        style={{ marginTop: spacing.lg }}
      />

      <Modal visible={showPlacePicker} animationType="slide" onRequestClose={() => setShowPlacePicker(false)}>
        <PageContainer scroll={false}>
          <View style={styles.modalHeader}>
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
              const selectedPlace = birthplace?.city === item.city && birthplace?.country === item.country;
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
                    {selectedPlace && <Check size={18} color={color.accent} strokeWidth={2} />}
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
  row: { flexDirection: 'row', alignItems: 'center' },
  styleCard: { marginBottom: spacing.sm },
  styleCardActive: { borderColor: color.accentBorder },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: color.surfaceElevated, borderWidth: 1, borderColor: color.border,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.sm, backgroundColor: color.surfaceElevated,
  },
  input: {
    marginTop: spacing.sm,
    borderWidth: 1, borderColor: color.border, borderRadius: radius.md,
    padding: spacing.md, color: color.textPrimary, backgroundColor: color.surface,
  },
  placeSelector: { flexDirection: 'row', alignItems: 'center' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: color.border, backgroundColor: color.surface,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    marginTop: spacing.md, marginBottom: spacing.md,
  },
  searchInput: { flex: 1, padding: spacing.md, paddingLeft: spacing.sm, color: color.textPrimary },
  placeRow: { borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: color.border },
  placeRowInner: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
});
