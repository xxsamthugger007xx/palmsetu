import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { color, radius, spacing } from '../../theme/tokens';
import { roomCategoryColor } from '../../theme/vastuTheme';
import { PropertyRoom } from '../../types/vastu';
import { COMMON_ROOMS } from './vastuRooms';

/** Step C: tick which of the common rooms (entrance, living room, kitchen, prayer room) the property has. */
export function CommonRoomsCard({ rooms, onToggle }: { rooms: PropertyRoom[]; onToggle: (def: (typeof COMMON_ROOMS)[number]) => void }) {
  return (
        <Card padded={false}>
          {COMMON_ROOMS.map((def, i) => {
            const included = rooms.some((r) => r.roomId === def.roomId);
            return (
              <Pressable accessibilityRole="button"
                key={def.roomId}
                onPress={() => onToggle(def)}
                style={[styles.commonRoomRow, i < COMMON_ROOMS.length - 1 && styles.commonRoomDivider]}
              >
                <View style={[styles.categoryDot, { backgroundColor: roomCategoryColor[def.category] }]} />
                <Text variant="bodySm" style={{ flex: 1, marginLeft: spacing.sm }}>{def.defaultName}</Text>
                <View style={[styles.toggle, included && { backgroundColor: roomCategoryColor[def.category] }]}>
                  {included && <Check size={11} color={color.bg} strokeWidth={3} />}
                </View>
              </Pressable>
            );
          })}
        </Card>
  );
}

const styles = StyleSheet.create({
  commonRoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  commonRoomDivider: {
    borderBottomWidth: 1,
    borderBottomColor: color.borderSubtle,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  toggle: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
