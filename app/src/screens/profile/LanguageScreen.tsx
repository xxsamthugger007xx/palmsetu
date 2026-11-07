import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search, Check, Info } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { LANGUAGES, SUPPORTED_TRANSLATION_CODES } from '../../data/languages';
import { useLanguage } from '../../context/LanguageContext';

export function LanguageScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { languageCode, setLanguageCode } = useLanguage();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <PageContainer scroll={false}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">{t('language.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.md, marginBottom: spacing.md }}>
        <Info size={14} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>
          {t('language.notice')}
        </Text>
      </Card>

      <View style={styles.searchRow}>
        <Search size={16} color={color.textMuted} strokeWidth={1.75} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('language.searchPlaceholder')}
          placeholderTextColor={color.textMuted}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={filtered}
        extraData={languageCode}
        keyExtractor={(l) => l.code}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        renderItem={({ item }) => {
          const selected = item.code === languageCode;
          const translated = (SUPPORTED_TRANSLATION_CODES as readonly string[]).includes(item.code);
          return (
            <Card onPress={() => setLanguageCode(item.code)} style={styles.row} padded={false}>
              <View style={styles.rowInner}>
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text variant="bodySm" weight="medium">{item.name}</Text>
                    {!translated && (
                      <Text variant="caption" tone="muted" style={{ marginLeft: spacing.xs }}>(English UI)</Text>
                    )}
                  </View>
                  <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{item.nativeName}</Text>
                </View>
                {selected && <Check size={18} color={color.accent} strokeWidth={2} />}
              </View>
            </Card>
          );
        }}
      />
    </PageContainer>
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
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    padding: spacing.md,
    paddingLeft: spacing.sm,
    color: color.textPrimary,
  },
  row: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  flag: {
    fontSize: 24,
  },
});
