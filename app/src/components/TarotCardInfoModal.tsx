import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { color, radius, spacing } from '../theme/tokens';
import { tarotColor } from '../theme/tarotTheme';
import { Text } from './Text';
import { IconButton } from './Button';
import { TarotCardFace } from './TarotCardFace';
import { TarotCard, Orientation } from '../types/tarot';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  card: TarotCard | null;
  orientation: Orientation;
  onClose: () => void;
};

/** Basic, zero-AI info about a single card - name, arcana/suit, orientation,
 * meaning and symbolism, all read directly from the static 78-card
 * knowledge base (types/tarot.ts's TarotCard) already fetched by the
 * catalogue - no network/AI call happens here. */
export function TarotCardInfoModal({ visible, card, orientation, onClose }: Props) {
  const { t } = useTranslation();
  if (!card) return null;
  const meaning = orientation === 'reversed' ? card.reversedGeneral : card.general;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text variant="subtitle" weight="semibold">{card.name}</Text>
            <IconButton icon={X} onPress={onClose} />
          </View>

          <View style={styles.previewRow}>
            <TarotCardFace card={card} orientation={orientation} width={64} height={98} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="caption" style={{ color: tarotColor.gold }}>
                {card.arcana === 'major' ? 'Major Arcana' : `Minor Arcana - ${card.suit}`}
              </Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2, textTransform: 'capitalize' }}>{orientation}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: spacing.md }}>
            <Text variant="label" tone="muted">{t('ui.TarotCardInfoModal.meaning')}</Text>
            <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>{meaning}</Text>

            <Text variant="label" tone="muted">{t('ui.TarotReportScreen.symbolism')}</Text>
            <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>{card.symbolism}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: color.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: tarotColor.goldMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
