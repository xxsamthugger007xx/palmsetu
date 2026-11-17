import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft, Building2, Home, Store, Briefcase, HelpCircle, Plus, Minus, Pencil, X, Check,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { DirectionSelectorModal, DIRECTION_LABELS } from '../../components/DirectionSelectorModal';
import { color, radius, spacing } from '../../theme/tokens';
import { roomCategoryColor, roomCategoryMutedBg, roomCategoryBorder } from '../../theme/vastuTheme';
import { RootStackParamList } from '../../navigation/types';
import { vastuApi } from '../../services/vastuApi';
import { PropertyRoom, PropertyType, RoomCategory } from '../../types/vastu';

const propertyTypes: { id: PropertyType; label: string; icon: typeof Home }[] = [
  { id: 'apartment', label: 'Apartment', icon: Building2 },
  { id: 'independent-house', label: 'House', icon: Home },
  { id: 'office', label: 'Office', icon: Briefcase },
  { id: 'shop', label: 'Shop', icon: Store },
  { id: 'other', label: 'Other', icon: HelpCircle },
];

const COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6];

const COMMON_ROOMS: { category: RoomCategory; roomId: string; defaultName: string }[] = [
  { category: 'entrance', roomId: 'entrance-1', defaultName: 'Main Entrance' },
  { category: 'livingRoom', roomId: 'livingRoom-1', defaultName: 'Living Room' },
  { category: 'kitchen', roomId: 'kitchen-1', defaultName: 'Kitchen' },
  { category: 'prayerRoom', roomId: 'prayerRoom-1', defaultName: 'Prayer / Meditation Room' },
];

const CUSTOM_ROOM_SUGGESTIONS = [
  'Study Room', 'Balcony', 'Dining Room', 'Store Room', 'Pooja Room', 'Garage', 'Staircase', 'Garden', 'Office Room', 'Utility Room',
];

function defaultBedroomName(index: number): string {
  return index === 1 ? 'Master Bedroom' : `Bedroom ${index}`;
}
function defaultBathroomName(index: number): string {
  return `Bathroom ${index}`;
}

/** Rebuilds the bedroom/bathroom slice of `rooms` for a new count, keeping
 * every room that still fits (same roomId -> same direction/name preserved)
 * and only ever adding/removing from the end - never reassigning an
 * existing room's direction to a different index. */
function resizeCountedRooms(
  rooms: PropertyRoom[],
  category: 'bedroom' | 'bathroom',
  newCount: number,
  defaultName: (i: number) => string,
): PropertyRoom[] {
  const prefix = category;
  const others = rooms.filter((r) => r.category !== category);
  const existing = rooms.filter((r) => r.category === category);
  const next: PropertyRoom[] = [];
  for (let i = 1; i <= newCount; i++) {
    const roomId = `${prefix}-${i}`;
    const found = existing.find((r) => r.roomId === roomId);
    next.push(found ?? { roomId, category, name: defaultName(i), direction: null });
  }
  return [...others, ...next];
}

function countedRoomsLoseData(rooms: PropertyRoom[], category: 'bedroom' | 'bathroom', newCount: number): boolean {
  return rooms.some((r) => r.category === category && Number(r.roomId.split('-')[1]) > newCount && r.direction);
}

export function VastuPropertyFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [bedroomCount, setBedroomCount] = useState(1);
  const [bathroomCount, setBathroomCount] = useState(1);
  const [rooms, setRooms] = useState<PropertyRoom[]>([
    { roomId: 'bedroom-1', category: 'bedroom', name: 'Master Bedroom', direction: null },
    { roomId: 'bathroom-1', category: 'bathroom', name: 'Bathroom 1', direction: null },
    ...COMMON_ROOMS.map((r) => ({ roomId: r.roomId, category: r.category, name: r.defaultName, direction: null as null })),
  ]);
  const [notes, setNotes] = useState('');
  const [activeDirectionRoomId, setActiveDirectionRoomId] = useState<string | null>(null);
  const [renamingRoomId, setRenamingRoomId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [addingCustomRoom, setAddingCustomRoom] = useState(false);
  const [customRoomName, setCustomRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completedCount = rooms.filter((r) => r.direction).length;

  const applyCountChange = (category: 'bedroom' | 'bathroom', newCount: number) => {
    const defaultName = category === 'bedroom' ? defaultBedroomName : defaultBathroomName;
    const doResize = () => {
      Haptics.selectionAsync().catch(() => {});
      setRooms((prev) => resizeCountedRooms(prev, category, newCount, defaultName));
      if (category === 'bedroom') setBedroomCount(newCount);
      else setBathroomCount(newCount);
    };

    if (countedRoomsLoseData(rooms, category, newCount)) {
      Alert.alert(
        'Remove room direction?',
        `Reducing the number of ${category}s will remove the direction you already set for one of them. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doResize },
        ],
      );
    } else {
      doResize();
    }
  };

  const toggleCommonRoom = (def: typeof COMMON_ROOMS[number]) => {
    Haptics.selectionAsync().catch(() => {});
    setRooms((prev) => {
      const exists = prev.some((r) => r.roomId === def.roomId);
      if (exists) return prev.filter((r) => r.roomId !== def.roomId);
      return [...prev, { roomId: def.roomId, category: def.category, name: def.defaultName, direction: null }];
    });
  };

  const addCustomRoom = () => {
    const name = customRoomName.trim();
    if (!name) return;
    const alreadyExists = rooms.some((r) => r.category === 'custom' && r.name.toLowerCase() === name.toLowerCase());
    if (alreadyExists) {
      Alert.alert('Already added', `You already have a room named "${name}".`);
      return;
    }
    const roomId = `custom-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    setRooms((prev) => [...prev, { roomId, category: 'custom', name, direction: null }]);
    setCustomRoomName('');
    setAddingCustomRoom(false);
  };

  const removeRoom = (roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.roomId !== roomId));
  };

  const activeRoom = rooms.find((r) => r.roomId === activeDirectionRoomId) ?? null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const property = await vastuApi.createProperty(propertyType, bedroomCount, bathroomCount, rooms, notes.trim() || null);
      const report = await vastuApi.generateReport(property.id);
      navigation.replace('VastuReport', { reportId: report.id });
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong generating your report.');
    } finally {
      setLoading(false);
    }
  };

  const renderCountStepper = (label: string, count: number, category: 'bedroom' | 'bathroom') => (
    <View style={{ marginBottom: spacing.md }}>
      <Text variant="bodySm" weight="medium" style={{ marginBottom: spacing.xs }}>{label}</Text>
      <View style={styles.stepperRow}>
        {COUNT_OPTIONS.map((n) => {
          const selected = count === n;
          const accent = roomCategoryColor[category];
          return (
            <Pressable
              key={n}
              onPress={() => applyCountChange(category, n)}
              style={[
                styles.stepperPill,
                { borderColor: selected ? accent : color.border, backgroundColor: selected ? roomCategoryMutedBg[category] : 'transparent' },
              ]}
            >
              <Text variant="bodySm" weight={selected ? 'semibold' : 'regular'} style={{ color: selected ? accent : color.textSecondary }}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderRoomCard = (room: PropertyRoom, onRemove?: () => void) => {
    const accent = roomCategoryColor[room.category];
    const isRenaming = renamingRoomId === room.roomId;
    return (
      <View
        key={room.roomId}
        style={[styles.roomCard, { backgroundColor: roomCategoryMutedBg[room.category], borderColor: roomCategoryBorder[room.category] }]}
      >
        <View style={{ flex: 1 }}>
          {isRenaming ? (
            <View style={styles.renameRow}>
              <TextInput
                value={renameDraft}
                onChangeText={setRenameDraft}
                autoFocus
                style={[styles.renameInput, { color: color.textPrimary }]}
                placeholderTextColor={color.textMuted}
              />
              <Pressable
                onPress={() => {
                  const name = renameDraft.trim();
                  if (name) setRooms((prev) => prev.map((r) => (r.roomId === room.roomId ? { ...r, name } : r)));
                  setRenamingRoomId(null);
                }}
                hitSlop={8}
              >
                <Check size={16} color={accent} strokeWidth={2.5} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setRenamingRoomId(room.roomId);
                setRenameDraft(room.name);
              }}
              style={styles.nameRow}
            >
              <Text variant="bodySm" weight="semibold">{room.name}</Text>
              <Pencil size={11} color={color.textMuted} strokeWidth={1.75} style={{ marginLeft: 6 }} />
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => setActiveDirectionRoomId(room.roomId)} style={[styles.directionChip, { borderColor: accent }]}>
          <Text variant="caption" weight="semibold" style={{ color: room.direction ? accent : color.textMuted }}>
            {room.direction ? DIRECTION_LABELS[room.direction] : 'Set direction'}
          </Text>
        </Pressable>

        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={8} style={{ marginLeft: spacing.xs }}>
            <X size={14} color={color.textMuted} strokeWidth={1.75} />
          </Pressable>
        )}
      </View>
    );
  };

  const bedroomRooms = rooms.filter((r) => r.category === 'bedroom');
  const bathroomRooms = rooms.filter((r) => r.category === 'bathroom');
  const customRooms = rooms.filter((r) => r.category === 'custom');

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>Analyze your property</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Configure exactly the rooms your property has, then set each one's real direction - you can skip any
        you're unsure of.
      </Text>

      {/* A. Property type */}
      <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>PROPERTY TYPE</Text>
      <View style={styles.typeGrid}>
        {propertyTypes.map((t) => {
          const isSelected = propertyType === t.id;
          return (
            <Card
              key={t.id}
              elevated={isSelected}
              style={[styles.typeCard, isSelected && styles.typeCardSelected]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPropertyType(t.id);
              }}
            >
              <t.icon size={16} color={color.accent} strokeWidth={1.75} />
              <Text variant="caption" weight={isSelected ? 'semibold' : 'regular'} style={{ marginTop: 4 }}>{t.label}</Text>
            </Card>
          );
        })}
      </View>

      {/* B. Room configuration */}
      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>ROOM CONFIGURATION</Text>
      <Card>
        {renderCountStepper('How many bedrooms does your property have?', bedroomCount, 'bedroom')}
        {renderCountStepper('How many bathrooms does your property have?', bathroomCount, 'bathroom')}
      </Card>

      {bedroomRooms.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          {bedroomRooms.map((r) => renderRoomCard(r))}
        </View>
      )}
      {bathroomRooms.length > 0 && (
        <View style={{ marginTop: spacing.sm }}>
          {bathroomRooms.map((r) => renderRoomCard(r))}
        </View>
      )}

      {/* C. Common rooms */}
      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>COMMON ROOMS</Text>
      <Card padded={false}>
        {COMMON_ROOMS.map((def, i) => {
          const included = rooms.some((r) => r.roomId === def.roomId);
          return (
            <Pressable
              key={def.roomId}
              onPress={() => toggleCommonRoom(def)}
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

      {rooms.filter((r) => COMMON_ROOMS.some((d) => d.roomId === r.roomId)).length > 0 && (
        <View style={{ marginTop: spacing.sm }}>
          {rooms.filter((r) => COMMON_ROOMS.some((d) => d.roomId === r.roomId)).map((r) => renderRoomCard(r))}
        </View>
      )}

      {/* Custom rooms */}
      {customRooms.length > 0 && (
        <View style={{ marginTop: spacing.sm }}>
          {customRooms.map((r) => renderRoomCard(r, () => removeRoom(r.roomId)))}
        </View>
      )}

      {addingCustomRoom ? (
        <Card style={{ marginTop: spacing.sm }}>
          <TextInput
            value={customRoomName}
            onChangeText={setCustomRoomName}
            placeholder="Room name (e.g. Study Room)"
            placeholderTextColor={color.textMuted}
            style={styles.customInput}
            autoFocus
          />
          <View style={styles.suggestionWrap}>
            {CUSTOM_ROOM_SUGGESTIONS.map((s) => (
              <Pressable key={s} onPress={() => setCustomRoomName(s)} style={styles.suggestionChip}>
                <Text variant="caption" tone="secondary">{s}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button label="Cancel" variant="ghost" onPress={() => { setAddingCustomRoom(false); setCustomRoomName(''); }} style={{ flex: 1 }} />
            <Button label="Add room" onPress={addCustomRoom} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <Pressable onPress={() => setAddingCustomRoom(true)} style={styles.addRoomRow}>
          <Plus size={15} color={color.accent} strokeWidth={2} />
          <Text variant="bodySm" tone="accent" style={{ marginLeft: spacing.xs }}>Add Another Room</Text>
        </Pressable>
      )}

      {/* D. Progress */}
      <Card style={{ marginTop: spacing.lg }}>
        <Text variant="bodySm" weight="medium">Room directions: {completedCount} of {rooms.length} completed</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${rooms.length ? (completedCount / rooms.length) * 100 : 0}%` }]} />
        </View>
      </Card>

      {/* E. Notes */}
      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>ADDITIONAL DETAILS (OPTIONAL)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Tell us anything else about your property layout..."
        placeholderTextColor={color.textMuted}
        style={styles.input}
        multiline
      />

      {error && (
        <Card style={{ marginTop: spacing.md }}>
          <Text variant="caption" tone="danger">{error}</Text>
        </Card>
      )}

      <Button
        label="Generate my report"
        fullWidth
        loading={loading}
        disabled={completedCount === 0}
        style={{ marginTop: spacing.xl }}
        onPress={handleGenerate}
      />

      {activeRoom && (
        <DirectionSelectorModal
          visible={!!activeRoom}
          roomName={activeRoom.name}
          category={activeRoom.category}
          current={activeRoom.direction}
          onSelect={(d) => {
            setRooms((prev) => prev.map((r) => (r.roomId === activeRoom.roomId ? { ...r, direction: d } : r)));
            setActiveDirectionRoomId(null);
          }}
          onSkip={() => {
            setRooms((prev) => prev.map((r) => (r.roomId === activeRoom.roomId ? { ...r, direction: null } : r)));
            setActiveDirectionRoomId(null);
          }}
          onClose={() => setActiveDirectionRoomId(null)}
        />
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: { width: '30%', alignItems: 'center', paddingVertical: spacing.sm },
  typeCardSelected: { borderColor: color.accentBorder },
  stepperRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  stepperPill: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  renameInput: {
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingVertical: 2,
    minWidth: 100,
    fontSize: 14,
  },
  directionChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
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
  addRoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: color.accentBorder,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
  },
  customInput: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: color.textPrimary,
  },
  suggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceElevated,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: color.accent,
    borderRadius: radius.pill,
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: color.textPrimary,
    minHeight: 60,
  },
});
