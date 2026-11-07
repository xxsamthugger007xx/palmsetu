import React from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkles, Heart, Share2, RefreshCw } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, InspirationContent } from '../../services/wellnessApi';
import { shareText } from '../../utils/shareContent';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AffirmationDetail'>;

const TYPE_LABELS: Record<string, string> = {
  affirmation: 'Affirmation',
  'gratitude-prompt': 'Gratitude Prompt',
  'motivational-thought': 'Motivational Thought',
  'reflection-question': 'Reflection Question',
  'positive-reminder': 'Positive Reminder',
  'confidence-prompt': 'Confidence Prompt',
  'growth-message': 'Growth Message',
};

const REFLECTIONS: Record<string, string> = {
  affirmation: 'Affirmations work best when said slowly, as if you mean it - try reading this one twice before moving on.',
  'gratitude-prompt': 'Sit with this for a moment before writing anything down. Let an honest answer surface first.',
  'motivational-thought': 'Notice if this lands as true for you right now, or just true in general - both are worth sitting with.',
  'reflection-question': 'There is no required answer here - this is just a prompt to notice something about today.',
  'positive-reminder': 'A reminder is only useful if it reaches the part of you that forgot. Reread it once more.',
  'confidence-prompt': 'Confidence is often built retroactively, from evidence you already have. See what comes to mind.',
  'growth-message': 'Growth rarely feels like growth while it is happening - this is a nudge to notice it anyway.',
};

/**
 * Standalone affirmation detail view. Today's content is passed through
 * navigation params (from WellnessScreen's existing /inspiration/today call)
 * since there is no GET-by-id endpoint on the backend - this screen never
 * refetches by id, it only renders what was already fetched, consistent
 * with the real data the app has.
 */
export function AffirmationDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [content, setContent] = React.useState<InspirationContent | null>(params?.content ?? null);
  const [loading, setLoading] = React.useState(!params?.content);
  const [error, setError] = React.useState<string | null>(null);
  const [favorited, setFavorited] = React.useState(false);

  const load = React.useCallback(() => {
    if (params?.content) return;
    setLoading(true);
    wellnessApi.getTodayInspiration()
      .then((res) => setContent(res.content))
      .catch((err: any) => setError(err.message ?? 'Could not load today\'s affirmation.'))
      .finally(() => setLoading(false));
  }, [params?.content]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const toggleFavorite = async () => {
    if (!content) return;
    try {
      await wellnessApi.favoriteInspiration(content.id);
      setFavorited(true);
    } catch {}
  };

  const share = () => {
    if (!content) return;
    shareText(content.text);
  };

  if (loading) {
    return <PageContainer><Text variant="bodySm" tone="muted" style={{ marginTop: spacing.sm }}>Loading...</Text></PageContainer>;
  }

  if (error || !content) {
    return <PageContainer><EmptyState icon={RefreshCw} title="Something went wrong" description={error ?? 'No content available.'} actionLabel="Retry" onAction={load} /></PageContainer>;
  }

  return (
    <PageContainer>
      <Text variant="label" tone="accent" style={{ marginTop: spacing.sm }}>{TYPE_LABELS[content.type] ?? content.type}</Text>

      <Card elevated style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
        <Sparkles size={20} color={color.accent} strokeWidth={1.75} />
        <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{content.text}</Text>
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text variant="bodySm" weight="semibold" style={{ marginBottom: spacing.xs }}>A moment to reflect</Text>
        <Text variant="bodySm" tone="secondary">{REFLECTIONS[content.type] ?? 'Take a moment with this before moving on.'}</Text>
      </Card>

      {content.astrologyFlavored && (
        <Text variant="caption" tone="muted" style={{ marginBottom: spacing.lg }}>
          This piece is from the optional astrology-flavored subset of the library.
        </Text>
      )}

      <View style={{ flexDirection: 'row' }}>
        <Button label={favorited ? 'Favorited' : 'Favorite'} icon={Heart} variant={favorited ? 'primary' : 'secondary'} onPress={toggleFavorite} />
        <Button label="Share" icon={Share2} variant="secondary" onPress={share} style={{ marginLeft: spacing.sm }} />
      </View>
    </PageContainer>
  );
}
