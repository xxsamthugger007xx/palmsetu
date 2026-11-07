import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Building2, Home, Store, Briefcase, HelpCircle } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { vastuApi } from '../../services/vastuApi';
import { Direction, PropertyType, RoomDirections, RoomType } from '../../types/vastu';
import { DIRECTION_ORDER, DIRECTION_LABELS } from '../../utils/compass';

const propertyTypes: { id: PropertyType; label: string; icon: typeof Home }[] = [
  { id: 'apartment', label: 'Apartment', icon: Building2 },
  { id: 'independent-house', label: 'House', icon: Home },
  { id: 'office', label: 'Office', icon: Briefcase },
  { id: 'shop', label: 'Shop', icon: Store },
  { id: 'other', label: 'Other', icon: HelpCircle },
];

const roomFields: { id: RoomType; label: string }[] = [
  { id: 'entrance', label: 'Main Entrance' },
  { id: 'livingRoom', label: 'Living Room' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'masterBedroom', label: 'Master Bedroom' },
  { id: 'prayerRoom', label: 'Prayer / Meditation Room' },
  { id: 'bathroom', label: 'Bathroom' },
];

export function VastuPropertyFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [rooms, setRooms] = useState<RoomDirections>({
    entrance: null, livingRoom: null, kitchen: null, masterBedroom: null, prayerRoom: null, bathroom: null,
  });
  const [notes, setNotes] = useState('');
  const [openRoom, setOpenRoom] = useState<RoomType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledCount = Object.values(rooms).filter(Boolean).length;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const property = await vastuApi.createProperty(propertyType, rooms, notes.trim() || null);
      const report = await vastuApi.generateReport(property.id);
      navigation.replace('VastuReport', { reportId: report.id });
    } catch (err: any) {
      if (err.code === 'LIMIT_REACHED') {
        navigation.navigate('Paywall');
      } else {
        setError(err.message ?? 'Something went wrong generating your report.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>Analyze your property</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Add as many room directions as you know - you can skip any you're unsure of. The compass gives you a
        heading; it doesn't know your walls or layout, so please confirm each room yourself.
      </Text>

      <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>PROPERTY TYPE</Text>
      <View style={styles.typeGrid}>
        {propertyTypes.map((t) => {
          const isSelected = propertyType === t.id;
          return (
            <Card
              key={t.id}
              elevated={isSelected}
              style={[styles.typeCard, isSelected && styles.typeCardSelected]}
              onPress={() => setPropertyType(t.id)}
            >
              <t.icon size={16} color={color.accent} strokeWidth={1.75} />
              <Text variant="caption" weight={isSelected ? 'semibold' : 'regular'} style={{ marginTop: 4 }}>{t.label}</Text>
            </Card>
          );
        })}
      </View>

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
        ROOM DIRECTIONS ({filledCount} of {roomFields.length})
      </Text>
      {roomFields.map((room) => {
        const value = rooms[room.id];
        const isOpen = openRoom === room.id;
        return (
          <View key={room.id} style={{ marginBottom: spacing.sm }}>
            <Card onPress={() => setOpenRoom(isOpen ? null : room.id)} style={styles.roomRow}>
              <Text variant="bodySm" weight="medium" style={{ flex: 1 }}>{room.label}</Text>
              <Text variant="bodySm" tone={value ? 'accent' : 'muted'}>{value ? DIRECTION_LABELS[value] : 'Skip'}</Text>
            </Card>
            {isOpen && (
              <View style={styles.directionGrid}>
                {DIRECTION_ORDER.map((d) => {
                  const selected = value === d;
                  return (
                    <Card
                      key={d}
                      elevated={selected}
                      style={[styles.directionButton, selected && styles.directionButtonSelected]}
                      onPress={() => {
                        setRooms((prev) => ({ ...prev, [room.id]: selected ? null : d }));
                        setOpenRoom(null);
                      }}
                    >
                      <Text variant="caption" weight="semibold" tone={selected ? 'accent' : 'primary'}>{d}</Text>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      <Text variant="label" tone="muted" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>NOTES (OPTIONAL)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything else about your layout..."
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
        disabled={filledCount === 0}
        style={{ marginTop: spacing.xl }}
        onPress={handleGenerate}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: { width: '30%', alignItems: 'center', paddingVertical: spacing.sm },
  typeCardSelected: { borderColor: color.accentBorder },
  roomRow: { flexDirection: 'row', alignItems: 'center' },
  directionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  directionButton: { width: 56, alignItems: 'center', paddingVertical: spacing.sm },
  directionButtonSelected: { borderColor: color.accentBorder },
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
