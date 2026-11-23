import { tr } from '../../utils/tr';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Plus, Pencil, X, Check } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { DirectionSelectorModal, DIRECTION_LABELS } from '../../components/DirectionSelectorModal';
import { color, radius, spacing } from '../../theme/tokens';
import { roomCategoryColor, roomCategoryMutedBg, roomCategoryBorder } from '../../theme/vastuTheme';
import { RootStackParamList } from '../../navigation/types';
import { vastuApi } from '../../services/vastuApi';
import { PropertyRoom, PropertyType } from '../../types/vastu';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
import { PropertyTypePicker } from './PropertyTypePicker';
import { CommonRoomsCard } from './CommonRoomsCard';
import { COUNT_OPTIONS, COMMON_ROOMS, CUSTOM_ROOM_SUGGESTIONS, defaultBedroomName, defaultBathroomName, resizeCountedRooms, countedRoomsLoseData } from './vastuRooms';
export function VastuPropertyFormScreen() {
  const { t } = useTranslation();
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
        t('ui.VastuPropertyFormScreen.removeRoomDirection'),
        `Reducing the number of ${category}s will remove the direction you already set for one of them. Continue?`,
        [
          { text: t('ui.AssistantHistoryScreen.cancel'), style: 'cancel' },
          { text: t('ui.VastuPropertyFormScreen.remove'), style: 'destructive', onPress: doResize },
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
      Alert.alert(t('ui.VastuPropertyFormScreen.alreadyAdded'), `You already have a room named "${name}".`);
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
    } catch (__err) {
      const err = asApiError(__err);
      setError(err.message ?? t('ui.GemstoneGoalScreen.somethingWentWrongGeneratingYour'));
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
            <Pressable accessibilityRole="button"
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
                accessibilityLabel={tr('a11y.renameField')}
                onChangeText={setRenameDraft}
                autoFocus
                style={[styles.renameInput, { color: color.textPrimary }]}
                placeholderTextColor={color.textMuted}
              />
              <Pressable accessibilityRole="button"
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
            <Pressable accessibilityRole="button"
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

        <Pressable accessibilityRole="button" onPress={() => setActiveDirectionRoomId(room.roomId)} style={[styles.directionChip, { borderColor: accent }]}>
          <Text variant="caption" weight="semibold" style={{ color: room.direction ? accent : color.textMuted }}>
            {room.direction ? DIRECTION_LABELS[room.direction] : 'Set direction'}
          </Text>
        </Pressable>

        {onRemove && (
          <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={8} style={{ marginLeft: spacing.xs }}>
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

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.VastuPropertyFormScreen.analyzeYourProperty')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('ui.VastuPropertyFormScreen.configureExactlyTheRoomsYour')}
      </Text>

      {/* A. Property type */}
      <PropertyTypePicker value={propertyType} onSelect={setPropertyType} />

      {/* B. Room configuration */}
      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('ui.VastuPropertyFormScreen.roomConfiguration')}</Text>
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
      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('ui.VastuPropertyFormScreen.commonRooms')}</Text>
      <CommonRoomsCard rooms={rooms} onToggle={toggleCommonRoom} />

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
            placeholder={t('ui.VastuPropertyFormScreen.roomNameEGStudy')} accessibilityLabel={t('ui.VastuPropertyFormScreen.roomNameEGStudy')}
            placeholderTextColor={color.textMuted}
            style={styles.customInput}
            autoFocus
          />
          <View style={styles.suggestionWrap}>
            {CUSTOM_ROOM_SUGGESTIONS.map((s) => (
              <Pressable accessibilityRole="button" key={s} onPress={() => setCustomRoomName(s)} style={styles.suggestionChip}>
                <Text variant="caption" tone="secondary">{s}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button label={t('ui.AssistantHistoryScreen.cancel')} variant="ghost" onPress={() => { setAddingCustomRoom(false); setCustomRoomName(''); }} style={{ flex: 1 }} />
            <Button label={t('ui.VastuPropertyFormScreen.addRoom')} onPress={addCustomRoom} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setAddingCustomRoom(true)} style={styles.addRoomRow}>
          <Plus size={15} color={color.accent} strokeWidth={2} />
          <Text variant="bodySm" tone="accent" style={{ marginLeft: spacing.xs }}>{t('ui.VastuPropertyFormScreen.addAnotherRoom')}</Text>
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
      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('ui.VastuPropertyFormScreen.additionalDetailsOptional')}</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={t('ui.VastuPropertyFormScreen.tellUsAnythingElseAbout')} accessibilityLabel={t('ui.VastuPropertyFormScreen.tellUsAnythingElseAbout')}
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
        label={t('ui.VastuPropertyFormScreen.generateMyReport')}
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
