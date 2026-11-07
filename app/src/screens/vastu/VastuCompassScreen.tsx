import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Compass as CompassIcon, Info, AlertTriangle, Home, Briefcase } from 'lucide-react-native';
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

export function VastuCompassScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { availability, heading, lowAccuracy } = useCompassHeading();
  const [manualDirection, setManualDirection] = useState<Direction | null>(null);
  const [directions, setDirections] = useState<VastuDirectionEntry[]>([]);

  useEffect(() => {
    vastuApi.getDirections().then((res) => setDirections(res.directions)).catch(() => {});
  }, []);

  const sensorUnavailable = availability === 'unavailable' || availability === 'permission-denied';
  const useManual = sensorUnavailable || manualDirection !== null;
  const liveDirection = heading !== null ? headingToDirection(heading) : null;
  const activeDirection = useManual ? manualDirection : liveDirection;
  const activeEntry = activeDirection ? directions.find((d) => d.code === activeDirection) : null;

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md, textAlign: 'center' }}>Vastu Compass</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: 4, marginBottom: spacing.lg, textAlign: 'center' }}>
        Hold your phone flat, away from metal and electronics, for the most reliable reading.
      </Text>

      {availability === 'checking' && (
        <Text variant="bodySm" tone="muted" style={{ textAlign: 'center', marginVertical: spacing.xl }}>Checking sensor availability...</Text>
      )}

      {availability === 'permission-denied' && !manualDirection && (
        <Card style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg }}>
          <AlertTriangle size={16} color={color.warning} strokeWidth={1.75} style={{ marginTop: 2 }} />
          <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
            Location permission is needed to read the compass heading (we never read or store your GPS
            coordinates, only the heading). Select your facing direction manually below, or enable permission
            in your device settings to use the live compass.
          </Text>
        </Card>
      )}

      {availability === 'unavailable' && !manualDirection && (
        <Card style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg }}>
          <AlertTriangle size={16} color={color.warning} strokeWidth={1.75} style={{ marginTop: 2 }} />
          <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
            A compass sensor isn't available on this device or browser. Select your facing direction manually below.
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
              Low accuracy detected - move away from metal objects or electronics and try moving your phone in a figure-8 to calibrate.
            </Text>
          )}
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.lg }}>
            Approximate reading, not a calibrated surveying instrument.
          </Text>
          <Button
            label="Select manually instead"
            variant="ghost"
            size="sm"
            style={{ marginTop: spacing.sm }}
            onPress={() => setManualDirection(liveDirection)}
          />
        </View>
      )}

      {useManual && (
        <View>
          <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm, textAlign: 'center' }}>SELECT YOUR DIRECTION</Text>
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
            <Button label="Use live sensor instead" variant="ghost" size="sm" style={{ marginTop: spacing.sm, alignSelf: 'center' }} onPress={() => setManualDirection(null)} />
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
                <Text variant="label" tone="muted" style={{ marginLeft: spacing.xs }}>BEST FOR HOME</Text>
              </View>
              {activeEntry.bestForHome.length > 0 ? (
                activeEntry.bestForHome.map((item) => (
                  <Text key={item} variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>• {item}</Text>
                ))
              ) : (
                <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>No strong traditional association</Text>
              )}
            </Card>

            <Card style={styles.bestForCard}>
              <View style={styles.bestForHeader}>
                <Briefcase size={14} color={color.secondary} strokeWidth={1.75} />
                <Text variant="label" tone="muted" style={{ marginLeft: spacing.xs }}>BEST FOR WORK</Text>
              </View>
              {activeEntry.bestForWork.length > 0 ? (
                activeEntry.bestForWork.map((item) => (
                  <Text key={item} variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>• {item}</Text>
                ))
              ) : (
                <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>No strong traditional association</Text>
              )}
            </Card>
          </View>
        </>
      )}

      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="caption" tone="muted">
          This shows a direction, not a full property assessment. For personalized room-by-room guidance,
          use the property analysis instead.
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
