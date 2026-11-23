import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { X, Sparkles, Layers, Heart } from 'lucide-react-native';
import { color, radius, spacing } from '../theme/tokens';
import { tarotColor } from '../theme/tarotTheme';
import { Text } from './Text';
import { IconButton } from './Button';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const POINTS = [
  {
    icon: Layers,
    title: 'What a reading is',
    body: 'A spread of one or more cards drawn at random, each placed in a position with its own meaning (e.g. "Past", "Challenge", "Guidance"). The card and position together shape what it reflects on.',
  },
  {
    icon: Sparkles,
    title: 'Upright vs. reversed',
    body: 'Every card can appear upright or reversed. Reversed does not mean "bad" - it traditionally points to a more internal, blocked, or delayed version of the same theme.',
  },
  {
    icon: Heart,
    title: 'What it is not',
    body: 'Tarot here is a traditional, interpretive practice for reflection and entertainment - not a scientifically validated way to predict real events, and never a substitute for medical, legal, or financial advice.',
  },
];

/** "How Tarot works" explainer - fixes the previously non-functional header
 * Info button (was a literal no-op onPress). Uses the same Modal pattern as
 * ConfirmationModal.tsx for consistency with the rest of the app. */
export function TarotInfoModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text variant="subtitle" weight="semibold">{t('ui.TarotInfoModal.howTarotWorks')}</Text>
            <IconButton icon={X} onPress={onClose} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {POINTS.map((p) => (
              <View key={p.title} style={styles.row}>
                <View style={styles.iconWrap}>
                  <p.icon size={16} color={tarotColor.gold} strokeWidth={1.75} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text variant="bodySm" weight="semibold">{p.title}</Text>
                  <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{p.body}</Text>
                </View>
              </View>
            ))}
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
  row: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: tarotColor.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
