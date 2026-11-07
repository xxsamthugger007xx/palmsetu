import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Search, Check, Globe } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { LANGUAGES, SUPPORTED_TRANSLATION_CODES } from '../../data/languages';
import { useLanguage } from '../../context/LanguageContext';

/** Shown once, before onboarding, on the very first app launch. Picking a
 * language here doesn't lock anything in, it's just a sensible starting point;
 * the same picker is always reachable later from Profile > Language. */
export function LanguageSelectScreen() {
  const { t } = useTranslation();
  const { languageCode, setLanguageCode } = useLanguage();
  const [selected, setSelected] = useState(languageCode);
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
    );
  }, [query]);

  const handleContinue = async () => {
    setConfirming(true);
    await setLanguageCode(selected);
    setConfirming(false);
  };

  return (
    <PageContainer scroll={false}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Globe size={22} color={color.accent} strokeWidth={1.75} />
        </View>
        <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>Choose your language</Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
          You can change this anytime from your profile.
        </Text>
      </View>

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
        extraData={selected}
        keyExtractor={(l) => l.code}
        contentContainerStyle={{ paddingBottom: spacing.md }}
        renderItem={({ item }) => {
          const isSelected = item.code === selected;
          const translated = (SUPPORTED_TRANSLATION_CODES as readonly string[]).includes(item.code);
          return (
            <Card onPress={() => setSelected(item.code)} style={styles.row} padded={false}>
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
                {isSelected && <Check size={18} color={color.accent} strokeWidth={2} />}
              </View>
            </Card>
          );
        }}
      />

      <Button
        label={t('onboarding.continueButton')}
        fullWidth
        loading={confirming}
        style={{ marginTop: spacing.sm }}
        onPress={handleContinue}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    fontSize: 28,
  },
});
