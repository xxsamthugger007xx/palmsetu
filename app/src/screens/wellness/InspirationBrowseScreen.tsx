import React from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkles, Heart, Share2, RefreshCw } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/Button';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, InspirationContent, InspirationType } from '../../services/wellnessApi';
import { shareText } from '../../utils/shareContent';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPE_LABELS: Record<InspirationType, string> = {
  affirmation: 'Affirmations',
  'gratitude-prompt': 'Gratitude Prompts',
  'motivational-thought': 'Motivational Thoughts',
  'reflection-question': 'Reflection Questions',
  'positive-reminder': 'Positive Reminders',
  'confidence-prompt': 'Confidence Prompts',
  'growth-message': 'Growth Messages',
};

/**
 * Browses the real curated library via GET /wellness/inspiration/library
 * (added this pass - the backend previously only exposed today's single
 * pick, a favorites list, and an astrology-flavored subset, with no way to
 * browse the full catalogue). Organized by the library's real types, not an
 * assumed category list.
 */
export function InspirationBrowseScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<InspirationContent[]>([]);
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([wellnessApi.getInspirationLibrary(), wellnessApi.getFavoriteInspiration()])
      .then(([lib, favs]) => {
        setItems(lib.items);
        setFavoriteIds(new Set(favs.items.map((i) => i.id)));
      })
      .catch((err: any) => setError(err.message ?? 'Could not load the inspiration library.'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const toggleFavorite = async (item: InspirationContent) => {
    try {
      await wellnessApi.favoriteInspiration(item.id);
      setFavoriteIds((prev) => new Set(prev).add(item.id));
    } catch {}
  };

  const byType = React.useMemo(() => {
    const map = new Map<InspirationType, InspirationContent[]>();
    const source = showFavoritesOnly ? items.filter((i) => favoriteIds.has(i.id)) : items;
    source.forEach((item) => {
      const list = map.get(item.type) ?? [];
      list.push(item);
      map.set(item.type, list);
    });
    return map;
  }, [items, favoriteIds, showFavoritesOnly]);

  if (loading) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Inspiration</Text>
        <Text variant="bodySm" tone="muted">Loading...</Text>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Inspiration</Text>
        <EmptyState icon={RefreshCw} title="Something went wrong" description={error} actionLabel="Retry" onAction={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Inspiration</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
        Browse the full library, organized by type.
      </Text>

      <View style={{ flexDirection: 'row', marginBottom: spacing.lg }}>
        <Card onPress={() => setShowFavoritesOnly(false)} padded={false} style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.md, marginRight: spacing.sm, backgroundColor: !showFavoritesOnly ? color.accentMuted : color.surface, borderColor: !showFavoritesOnly ? color.accentBorder : color.border }}>
          <Text variant="bodySm" tone={!showFavoritesOnly ? 'accent' : 'secondary'}>All</Text>
        </Card>
        <Card onPress={() => setShowFavoritesOnly(true)} padded={false} style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: showFavoritesOnly ? color.accentMuted : color.surface, borderColor: showFavoritesOnly ? color.accentBorder : color.border }}>
          <Text variant="bodySm" tone={showFavoritesOnly ? 'accent' : 'secondary'}>Favorites</Text>
        </Card>
      </View>

      {byType.size === 0 ? (
        <EmptyState icon={Sparkles} title={showFavoritesOnly ? 'No favorites yet' : 'No content available'} description={showFavoritesOnly ? 'Favorite a piece of inspiration to see it here.' : undefined} />
      ) : (
        Array.from(byType.entries()).map(([type, typeItems]) => (
          <View key={type} style={{ marginBottom: spacing.lg }}>
            <SectionHeader title={TYPE_LABELS[type]} />
            {typeItems.map((item) => {
              const isFav = favoriteIds.has(item.id);
              return (
                <Card
                  key={item.id}
                  onPress={() => navigation.navigate('AffirmationDetail', { content: item })}
                  style={{ marginBottom: spacing.sm }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Sparkles size={15} color={color.accent} strokeWidth={1.75} style={{ marginTop: 2 }} />
                    <Text variant="bodySm" style={{ marginLeft: spacing.sm, flex: 1 }}>{item.text}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm }}>
                    <IconButton icon={Heart} size={15} tone={isFav ? color.accent : color.textMuted} onPress={() => toggleFavorite(item)} />
                    <IconButton icon={Share2} size={15} tone={color.textMuted} onPress={() => shareText(item.text)} />
                  </View>
                </Card>
              );
            })}
          </View>
        ))
      )}
    </PageContainer>
  );
}
