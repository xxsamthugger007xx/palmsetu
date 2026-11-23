import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { degreeReadout } from '../../utils/astrology';
import { NotableTransit } from './homeSections';

/** "Today's transits" table with a detail sheet for the tapped planet. Renders nothing when there are none. */
export function TransitsCard({ transits }: { transits: NotableTransit[] }) {
  const { t } = useTranslation();
  const [selectedTransit, setSelectedTransit] = React.useState<NotableTransit | null>(null);
  if (transits.length === 0) return null;
  return (
    <>
    <Card style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
              <Text variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>{t('home.todaysTransits')}</Text>
              <View style={styles.transitHeaderRow}>
                <Text variant="caption" tone="muted" style={{ flex: 1 }}>{t('home.transitBody')}</Text>
                <Text variant="caption" tone="muted" style={{ flex: 1 }}>{t('home.transitSign')}</Text>
                <Text variant="caption" tone="muted" style={{ flex: 1, textAlign: 'right' }}>{t('home.transitDegree')}</Text>
              </View>
              {transits.map((p) => (
                <Pressable accessibilityRole="button" key={p.body} style={styles.transitRow} onPress={() => setSelectedTransit(p)}>
                  <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>{p.body}</Text>
                  <Text variant="bodySm" weight="semibold" style={{ flex: 1 }}>{p.sign}</Text>
                  <Text
                    variant="bodySm"
                    tone="muted"
                    style={{ flex: 1, fontVariant: ['tabular-nums'], textAlign: 'right' }}
                  >
                    {degreeReadout(p.longitude)} {p.retrograde ? 'R' : ''}
                  </Text>
                  <ChevronRight size={14} color={color.textMuted} style={{ marginLeft: 4 }} />
                </Pressable>
              ))}
            </Card>

          <Modal
            visible={!!selectedTransit}
            transparent
            animationType="fade"
            onRequestClose={() => setSelectedTransit(null)}
          >
            <Pressable accessibilityRole="button" style={styles.modalBackdrop} onPress={() => setSelectedTransit(null)}>
              <Pressable accessibilityRole="button" style={styles.modalSheet} onPress={() => {}}>
                {selectedTransit && (
                  <>
                    <Text variant="label" tone="accent">{selectedTransit.body.toUpperCase()}</Text>
                    <Text variant="title" weight="semibold" style={{ marginTop: 4 }}>
                      {selectedTransit.sign} {degreeReadout(selectedTransit.longitude)}
                    </Text>
                    <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>
                      {selectedTransit.retrograde
                        ? t('home.transitRetrograde', { body: selectedTransit.body })
                        : t('home.transitDirect', { body: selectedTransit.body })}
                    </Text>
                    <Text variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
                      {t('home.transitNote')}
                    </Text>
                    <Button
                      label={t('common.close')}
                      variant="secondary"
                      onPress={() => setSelectedTransit(null)}
                      style={{ marginTop: spacing.lg }}
                    />
                  </>
                )}
              </Pressable>
            </Pressable>
          </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  transitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: color.borderSubtle,
    marginBottom: 4,
  },
  transitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: color.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: color.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
  },
});
