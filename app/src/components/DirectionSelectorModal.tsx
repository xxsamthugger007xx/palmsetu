import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { Text } from './Text';
import { IconButton } from './Button';
import { color, radius, spacing } from '../theme/tokens';
import { Direction, RoomCategory } from '../types/vastu';
import { roomCategoryColor, roomCategoryMutedBg } from '../theme/vastuTheme';

/**
 * Attractive 3x3 compass-style direction picker, shared by every room card
 * in VastuPropertyFormScreen - one modal instance, reused for whichever
 * room is currently being edited, rather than one modal per room.
 */

const GRID: Direction[][] = [
  ['NW', 'N', 'NE'],
  ['W', 'C', 'E'],
  ['SW', 'S', 'SE'],
];

const DIRECTION_LABELS: Record<Direction, string> = {
  N: 'North', NE: 'Northeast', E: 'East', SE: 'Southeast',
  S: 'South', SW: 'Southwest', W: 'West', NW: 'Northwest', C: 'Centre',
};

export { DIRECTION_LABELS };

export function DirectionSelectorModal({
  visible,
  roomName,
  category,
  current,
  onSelect,
  onSkip,
  onClose,
}: {
  visible: boolean;
  roomName: string;
  category: RoomCategory;
  current: Direction | null;
  onSelect: (direction: Direction) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const accent = roomCategoryColor[category];

  const handleSelect = (d: Direction) => {
    Haptics.selectionAsync().catch(() => {});
    onSelect(d);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="muted">DIRECTION</Text>
              <Text variant="subtitle" weight="semibold" numberOfLines={1}>{roomName}</Text>
            </View>
            <IconButton icon={X} onPress={onClose} />
          </View>

          <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.md }}>
            Choose the direction this room actually faces in your property - this is never guessed for you.
          </Text>

          <View style={styles.grid}>
            {GRID.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((d) => {
                  const selected = current === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => handleSelect(d)}
                      style={[
                        styles.cell,
                        { backgroundColor: roomCategoryMutedBg[category], borderColor: roomCategoryBorderColor(selected, accent) },
                        selected && { borderWidth: 2 },
                      ]}
                    >
                      {selected && (
                        <View style={[styles.checkBadge, { backgroundColor: accent }]}>
                          <Check size={10} color={color.bg} strokeWidth={3} />
                        </View>
                      )}
                      <Text variant="bodySm" weight={selected ? 'semibold' : 'regular'} style={{ color: selected ? accent : color.textPrimary }}>
                        {d === 'C' ? 'Centre' : d}
                      </Text>
                      <Text variant="caption" tone="muted" style={{ marginTop: 2, fontSize: 10 }}>
                        {DIRECTION_LABELS[d]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <Pressable onPress={onSkip} style={styles.skipRow}>
            <Text variant="bodySm" tone="secondary">I'm not sure, skip for now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function roomCategoryBorderColor(selected: boolean, accent: string): string {
  return selected ? accent : color.border;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: color.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  grid: {
    gap: spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
