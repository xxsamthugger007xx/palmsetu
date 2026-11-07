import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MessageCircle, Trash2 } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/Button';
import { color, spacing } from '../../theme/tokens';
import { assistantApi, AssistantConversationSummary } from '../../services/assistantApi';
import { formatChatTimestamp } from '../../utils/formatChatTimestamp';

export function AssistantHistoryScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<AssistantConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    assistantApi.listConversations()
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = useCallback((id: string) => {
    Alert.alert('Delete conversation?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await assistantApi.deleteConversation(id).catch(() => {});
        load();
      } },
    ]);
  }, [load]);

  if (!loading && items.length === 0) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginBottom: spacing.lg }}>Chat history</Text>
        <EmptyState
          icon={MessageCircle}
          title="No conversations yet"
          description="Start a conversation with your AI Astrologer to see it here."
          actionLabel="Start chatting"
          onAction={() => navigation.navigate('AssistantChat')}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginBottom: spacing.lg }}>Chat history</Text>
      {items.map((c) => (
        <Card key={c.id} onPress={() => navigation.navigate('AssistantChat', { conversationId: c.id })} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="bodySm" weight="semibold">{c.messageCount} messages</Text>
                <Text variant="caption" tone="accent">{formatChatTimestamp(c.updatedAt)}</Text>
              </View>
              {c.lastMessage && (
                <Text variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>{c.lastMessage}</Text>
              )}
            </View>
            <IconButton icon={Trash2} onPress={() => remove(c.id)} tone={color.danger} />
          </View>
        </Card>
      ))}
    </PageContainer>
  );
}
