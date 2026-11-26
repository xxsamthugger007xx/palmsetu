import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MessageCircle, Trash2 } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner, ErrorState } from '../../components/ErrorState';
import { ListSkeleton } from '../../components/ListSkeleton';
import { ConfirmationModal } from '../../components/ConfirmationModal';
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    assistantApi.listConversations()
      .then((r) => setItems(r.items))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmRemove = useCallback(async () => {
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (!id) return;
    setDeleteError(null);
    try {
      await assistantApi.deleteConversation(id);
    } catch {
      setDeleteError(t('ui.AssistantHistoryScreen.couldnTDeleteThatConversation'));
    }
    load();
  }, [load, pendingDeleteId]);

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
            <IconButton icon={Trash2} onPress={() => setPendingDeleteId(c.id)} tone={color.danger} />
          </View>
        </Card>
      ))}

      <ConfirmationModal
        visible={!!pendingDeleteId}
        title={t('ui.AssistantHistoryScreen.deleteConversation')}
        description={t('ui.AssistantHistoryScreen.thisCannotBeUndone')}
        confirmLabel={t('ui.AssistantHistoryScreen.delete')}
        destructive
        onConfirm={confirmRemove}
        onCancel={() => setPendingDeleteId(null)}
      />
    </PageContainer>
  );
}
