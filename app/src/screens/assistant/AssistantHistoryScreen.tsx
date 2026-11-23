import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MessageCircle, Trash2 } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner, ErrorState } from '../../components/ErrorState';
import { ListSkeleton } from '../../components/ListSkeleton';
import { IconButton } from '../../components/Button';
import { color, spacing } from '../../theme/tokens';
import { assistantApi, AssistantConversationSummary } from '../../services/assistantApi';
import { formatChatTimestamp } from '../../utils/formatChatTimestamp';
import { useTranslation } from 'react-i18next';

export function AssistantHistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<AssistantConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    assistantApi.listConversations()
      .then((r) => setItems(r.items))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = useCallback((id: string) => {
    Alert.alert(t('ui.AssistantHistoryScreen.deleteConversation'), t('ui.AssistantHistoryScreen.thisCannotBeUndone'), [
      { text: t('ui.AssistantHistoryScreen.cancel'), style: 'cancel' },
      { text: t('ui.AssistantHistoryScreen.delete'), style: 'destructive', onPress: async () => {
        setDeleteError(null);
        try {
          await assistantApi.deleteConversation(id);
        } catch {
          setDeleteError(t('ui.AssistantHistoryScreen.couldnTDeleteThatConversation'));
        }
        load();
      } },
    ]);
  }, [load]);

  if (loading && items.length === 0) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginBottom: spacing.lg }}>{t('ui.AssistantHistoryScreen.chatHistory')}</Text>
        <ListSkeleton />
      </PageContainer>
    );
  }

  if (loadError && items.length === 0) {
    return (
      <PageContainer onRefresh={load}>
        <Text variant="display" weight="semibold" style={{ marginBottom: spacing.lg }}>{t('ui.AssistantHistoryScreen.chatHistory')}</Text>
        <ErrorState onRetry={load} />
      </PageContainer>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <PageContainer onRefresh={load}>
        <Text variant="display" weight="semibold" style={{ marginBottom: spacing.lg }}>{t('ui.AssistantHistoryScreen.chatHistory')}</Text>
        <EmptyState
          icon={MessageCircle}
          title={t('ui.AssistantHistoryScreen.noConversationsYet')}
          description={t('ui.AssistantHistoryScreen.startAConversationWithYour')}
          actionLabel={t('ui.AssistantHistoryScreen.startChatting')}
          onAction={() => navigation.navigate('AssistantChat')}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer onRefresh={load}>
      <Text variant="display" weight="semibold" style={{ marginBottom: spacing.lg }}>{t('ui.AssistantHistoryScreen.chatHistory')}</Text>
      {deleteError && <ErrorBanner message={deleteError} />}
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
