import React, { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, TextInput, View } from 'react-native';
import { Search, X, Check } from 'lucide-react-native';
import { PageContainer } from '../../../components/PageContainer';
import { Card } from '../../../components/Card';
import { Text } from '../../../components/Text';
import { IconButton } from '../../../components/Button';
import { color, radius, spacing } from '../../../theme/tokens';
import { BIRTHPLACES, BirthplaceOption } from '../../../data/birthplaces';
import { useTranslation } from 'react-i18next';

/**
 * Shared birthplace search/pick UI, extracted out of
 * AstrologyProfileSetupScreen so both the profile-editing flow and the new
 * onboarding PlaceStep screen use the exact same real BIRTHPLACES picker
 * logic instead of two copy-pasted versions.
 */
export function BirthplacePickerModal({
  visible,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selected: BirthplaceOption | null;
  onClose: () => void;
  onSelect: (place: BirthplaceOption) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BIRTHPLACES;
    return BIRTHPLACES.filter((p) => p.city.toLowerCase().includes(q) || p.country.toLowerCase().includes(q));
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <PageContainer scroll={false}>
        <View style={styles.header}>
          <Text variant="bodySm" weight="semibold">{t('ui.KundliStyleScreen.selectBirthplace')}</Text>
          <IconButton icon={X} onPress={onClose} />
        </View>

        <View style={styles.searchRow}>
          <Search size={16} color={color.textMuted} strokeWidth={1.75} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('ui.KundliStyleScreen.searchCityOrCountry')} accessibilityLabel={t('ui.KundliStyleScreen.searchCityOrCountry')}
            placeholderTextColor={color.textMuted}
            style={styles.searchInput}
            autoFocus
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(p) => `${p.city}-${p.country}`}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          renderItem={({ item }) => {
            const isSelected = selected?.city === item.city && selected?.country === item.country;
            return (
              <Card
                onPress={() => {
                  onSelect(item);
                  setQuery('');
                }}
                style={styles.placeRow}
                padded={false}
              >
                <View style={styles.placeRowInner}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySm" weight="medium">{item.city}</Text>
                    <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{item.country} - {item.timezone}</Text>
                  </View>
                  {isSelected && <Check size={18} color={color.accent} strokeWidth={2} />}
                </View>
              </Card>
            );
          }}
        />
      </PageContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    padding: spacing.md,
    paddingLeft: spacing.sm,
    color: color.textPrimary,
  },
  placeRow: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  placeRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
