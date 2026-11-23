import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Compass as CompassIcon, Info, AlertTriangle, Home, Briefcase } from 'lucide-react-native';
import { ErrorBanner } from '../../components/ErrorState';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { CompassDial } from '../../components/CompassDial';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useCompassHeading } from '../../hooks/useCompassHeading';
import { headingToDirection, DIRECTION_LABELS, Direction } from '../../utils/compass';
import { vastuApi } from '../../services/vastuApi';
import { VastuDirectionEntry } from '../../types/vastu';
import { useTranslation } from 'react-i18next';

export function VastuCompassScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { availability, heading, lowAccuracy } = useCompassHeading();
  const [manualDirection, setManualDirection] = useState<Direction | null>(null);
  const [directions, setDirections] = useState<VastuDirectionEntry[]>([]);
  const [directionsFailed, setDirectionsFailed] = useState(false);

  const load = React.useCallback(async () => {
    setDirectionsFailed(false);
    await vastuApi.getDirections().then((res) => setDirections(res.directions)).catch(() => setDirectionsFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sensorUnavailable = availability === 'unavailable' || availability === 'permission-denied';
  const useManual = sensorUnavailable || manualDirection !== null;
  const liveDirection = heading !== null ? headingToDirection(heading) : null;
  const activeDirection = useManual ? manualDirection : liveDirection;
  const activeEntry = activeDirection ? directions.find((d) => d.code === activeDirection) : null;

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      {directionsFailed && <ErrorBanner message={t('ui.VastuCompassScreen.directionDetailsCouldnTBe')} onRetry={load} />}

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md, textAlign: 'center' }}>{t('ui.VastuCompassScreen.vastuCompass')}</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: 4, marginBottom: spacing.lg, textAlign: 'center' }}>
        {t('ui.VastuCompassScreen.holdYourPhoneFlatAway')}
      </Text>

      {availability === 'checking' && (
        <Text variant="bodySm" tone="muted" style={{ textAlign: 'center', marginVertical: spacing.xl }}>{t('ui.VastuCompassScreen.checkingSensorAvailability')}</Text>
      )}

      {availability === 'permission-denied' && !manualDirection && (
        <Card style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg }}>
          <AlertTriangle size={16} color={color.warning} strokeWidth={1.75} style={{ marginTop: 2 }} />
          <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
            {t('ui.VastuCompassScreen.locationPermissionIsNeededTo')}
          </Text>
        </Card>
      )}

      {availability === 'unavailable' && !manualDirection && (
        <Card style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg }}>
          <AlertTriangle size={16} color={color.warning} strokeWidth={1.75} style={{ marginTop: 2 }} />
          <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
            {t('ui.VastuCompassScreen.aCompassSensorIsnT')}
          </Text>
        </Card>
      )}

      {!useManual && liveDirection && (
        <View style={{ alignItems: 'center' }}>
          <CompassDial heading={heading ?? 0} />
          <Text variant="display" weight="semibold" style={{ marginTop: spacing.md }}>{Math.round(heading ?? 0)}°</Text>
          <Text variant="subtitle" tone="accent" style={{ marginTop: 2 }}>{DIRECTION_LABELS[liveDirection]}</Text>
          {lowAccuracy && (
            <Text variant="caption" tone="warning" style={{ marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.lg }}>
              {t('ui.VastuCompassScreen.lowAccuracyDetectedMoveAway')}
            </Text>
          )}
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.lg }}>
            {t('ui.VastuCompassScreen.approximateReadingNotACalibrated')}
          </Text>
          <Button
            label={t('ui.VastuCompassScreen.selectManuallyInstead')}
            variant="ghost"
            size="sm"
            style={{ marginTop: spacing.sm }}
            onPress={() => setManualDirection(liveDirection)}
          />
        </View>
      )}

      {useManual && (
        <View>
          <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm, textAlign: 'center' }}>{t('ui.VastuCompassScreen.selectYourDirection')}</Text>
          <View style={styles.manualGrid}>
            {(Object.keys(DIRECTION_LABELS) as Direction[]).map((d) => {
              const isSelected = activeDirection === d;
              return (
                <Card
                  key={d}
                  elevated={isSelected}
                  style={[styles.manualButton, isSelected && styles.manualButtonSelected]}
                  onPress={() => setManualDirection(d)}
                >
                  <Text variant="subtitle" weight="semibold" tone={isSelected ? 'accent' : 'primary'}>{d}</Text>
                  <Text variant="caption" tone="muted">{DIRECTION_LABELS[d]}</Text>
                </Card>
              );
            })}
          </View>
          {availability === 'available' && (
            <Button label={t('ui.VastuCompassScreen.useLiveSensorInstead')} variant="ghost" size="sm" style={{ marginTop: spacing.sm, alignSelf: 'center' }} onPress={() => setManualDirection(null)} />
          )}
        </View>
      )}

      {activeEntry && (
        <>
          <Card elevated style={{ marginTop: spacing.xl }}>
            <View style={styles.legendHeader}>
              <CompassIcon size={16} color={color.accent} strokeWidth={1.75} />
              <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm }}>
                {activeEntry.label}{activeEntry.sanskritName ? ` (${activeEntry.sanskritName})` : ''}
              </Text>
            </View>
            <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>{activeEntry.traditionalAssociation}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.md }}>
              <Info size={13} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
              <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>{activeEntry.limitations}</Text>
            </View>
          </Card>

          <View style={styles.bestForRow}>
            <Card style={styles.bestForCard}>
              <View style={styles.bestForHeader}>
                <Home size={14} color={color.secondary} strokeWidth={1.75} />
                <Text variant="label" tone="muted" style={{ marginLeft: spacing.xs }}>{t('ui.VastuCompassScreen.bestForHome')}</Text>
              </View>
              {activeEntry.bestForHome.length > 0 ? (
                activeEntry.bestForHome.map((item) => (
                  <Text key={item} variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>• {item}</Text>
                ))
              ) : (
                <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>{t('ui.VastuCompassScreen.noStrongTraditionalAssociation')}</Text>
              )}
            </Card>

            <Card style={styles.bestForCard}>
              <View style={styles.bestForHeader}>
                <Briefcase size={14} color={color.secondary} strokeWidth={1.75} />
                <Text variant="label" tone="muted" style={{ marginLeft: spacing.xs }}>{t('ui.VastuCompassScreen.bestForWork')}</Text>
              </View>
              {activeEntry.bestForWork.length > 0 ? (
                activeEntry.bestForWork.map((item) => (
                  <Text key={item} variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>• {item}</Text>
                ))
              ) : (
                <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>{t('ui.VastuCompassScreen.noStrongTraditionalAssociation')}</Text>
              )}
            </Card>
          </View>
        </>
      )}

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="caption" tone="muted">
          {t('ui.VastuCompassScreen.thisShowsADirectionNot')}
        </Text>
      </Card>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  manualGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  manualButton: { width: '30%', alignItems: 'center', paddingVertical: spacing.md },
  manualButtonSelected: { borderColor: color.accentBorder },
  legendHeader: { flexDirection: 'row', alignItems: 'center' },
  bestForRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  bestForCard: { flex: 1 },
  bestForHeader: { flexDirection: 'row', alignItems: 'center' },
});
