import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Send, Sparkles, Copy, RotateCcw, Trash2, ChevronLeft, History, SquarePen } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { Card } from '../../components/Card';
import { IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { assistantApi, AssistantMessage, PremiumCard } from '../../services/assistantApi';
import { streamAssistantMessage, StreamHandle } from '../../services/assistantStream';
import { AIThinkingOverlay } from '../../components/AIThinkingOverlay';
import { formatChatTimestamp } from '../../utils/formatChatTimestamp';

type ChatItem = AssistantMessage & {
  pending?: boolean;
  failed?: boolean;
  /** Live stage label while the real pipeline runs, before the first answer
   * chunk arrives - drives AIThinkingOverlay. Cleared once streaming text
   * starts rendering. */
  stageLabel?: string;
};

function PremiumCardView({ card }: { card: PremiumCard }) {
  const navigation = useNavigation<any>();
  return (
    <Card elevated style={{ marginTop: spacing.sm, borderColor: color.accentBorder }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Sparkles size={16} color={color.accent} strokeWidth={1.75} />
        <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm }}>{card.title}</Text>
      </View>
      <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>{card.description}</Text>
      <Pressable
        onPress={() => navigation.navigate('Paywall')}
        style={{ marginTop: spacing.sm, alignSelf: 'flex-start', backgroundColor: color.accent, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 14 }}
      >
        <Text variant="caption" weight="semibold" style={{ color: color.bg }}>{card.ctaLabel}</Text>
      </Pressable>
    </Card>
  );
}

function Bubble({ item, onCopy, onRetry }: { item: ChatItem; onCopy: (t: string) => void; onRetry?: () => void }) {
  const isUser = item.role === 'user';
  return (
    <View style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%', marginBottom: spacing.sm }}>
      <View
        style={{
          backgroundColor: isUser ? color.accentMuted : color.surfaceElevated,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: isUser ? color.accentBorder : color.border,
        }}
      >
        {item.pending && !item.content ? (
          <AIThinkingOverlay label={item.stageLabel} />
        ) : (
          <RichAnswer text={item.content} />
        )}
      </View>
      {item.premiumCard && <PremiumCardView card={item.premiumCard} />}
      {!item.pending && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
          {!isUser && (
            <>
              <Pressable onPress={() => onCopy(item.content)} style={{ marginRight: spacing.sm }}>
                <Copy size={14} color={color.textMuted} />
              </Pressable>
              {item.failed && onRetry && (
                <Pressable onPress={onRetry} style={{ marginRight: spacing.sm }}>
                  <RotateCcw size={14} color={color.textMuted} />
                </Pressable>
              )}
            </>
          )}
          <Text variant="caption" tone="muted">{formatChatTimestamp(item.createdAt)}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Lightweight line-based renderer - no markdown library is pulled in since
 * none is already a dependency in app/package.json. Supports:
 *   - "## Heading" or a line that is only "**Heading**" -> bold heading text
 *   - "- item" -> bullet with a real glyph and indent
 *   - "**bold**" inline -> bold span
 *   - a line starting with "!! " -> a visually distinct "key insight"
 *     callout (documented marker syntax; the backend does not currently
 *     emit this, but the renderer supports it so a future prompt change can
 *     opt in without another client release)
 * Deliberately plain - no decorative emoji injection, per the "avoid
 * excessive emojis and unnecessary decorative cards" guidance.
 */
function renderInlineBold(line: string, baseKey: string) {
  const parts = line.split(/(\*\*.+?\*\*)/g).filter((p) => p.length > 0);
  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*\*(.+)\*\*$/);
    if (boldMatch) {
      return (
        <Text key={`${baseKey}-${i}`} variant="bodySm" weight="semibold">
          {boldMatch[1]}
        </Text>
      );
    }
    return <Text key={`${baseKey}-${i}`} variant="bodySm">{part}</Text>;
  });
}

function RichAnswer({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <View>
      {lines.map((line, idx) => {
        const key = `l-${idx}`;
        const trimmed = line.trim();
        if (!trimmed) return <View key={key} style={{ height: spacing.xs }} />;

        const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/) ?? trimmed.match(/^\*\*(.+)\*\*$/);
        if (headingMatch) {
          return (
            <Text key={key} variant="body" weight="semibold" style={{ marginTop: spacing.xs, marginBottom: 2 }}>
              {headingMatch[1]}
            </Text>
          );
        }

        if (trimmed.startsWith('!! ')) {
          return (
            <View
              key={key}
              style={{
                backgroundColor: color.accentMuted,
                borderLeftWidth: 2,
                borderLeftColor: color.accent,
                borderRadius: radius.md,
                padding: spacing.sm,
                marginVertical: spacing.xs,
              }}
            >
              <Text variant="bodySm" weight="medium">{trimmed.slice(3)}</Text>
            </View>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <View key={key} style={{ flexDirection: 'row', paddingLeft: spacing.xs, marginBottom: 2 }}>
              <Text variant="bodySm" style={{ marginRight: spacing.xs, color: color.textSecondary }}>{'•'}</Text>
              <Text variant="bodySm" style={{ flex: 1 }}>{renderInlineBold(trimmed.slice(2), key)}</Text>
            </View>
          );
        }

        return (
          <Text key={key} variant="bodySm" style={{ marginBottom: 2 }}>
            {renderInlineBold(trimmed, key)}
          </Text>
        );
      })}
    </View>
  );
}

const CONTEXT_LABELS: Record<string, string> = {
  tarot: 'Tarot',
  astrology: 'Kundli & Daily Cosmic Guidance',
  gemstone: 'Gemstone',
  vastu: 'Vastu',
  palm: 'Palmistry',
};

export function AssistantChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AssistantChat'>>();
  const screenContext = route.params?.screenContext ?? null;
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(route.params?.conversationId ?? null);
  const [input, setInput] = useState('');
  const [suggested, setSuggested] = useState<string[]>([]);
  const [welcome, setWelcome] = useState('Hi, I can help with your readings.');
  const listRef = useRef<FlatList>(null);
  const activeStreamRef = useRef<StreamHandle | null>(null);

  useEffect(() => {
    // Abort any in-flight stream on unmount so it never writes into a
    // screen that is no longer mounted.
    return () => activeStreamRef.current?.abort();
  }, []);

  useEffect(() => {
    assistantApi.getConfig().then((c) => setWelcome(c.welcomeMessage)).catch(() => {});
    assistantApi.getSuggestedQuestions().then((r) => setSuggested(r.questions)).catch(() => {});
  }, []);

  // Reopening an existing conversation (from history, or from a prior
  // floating-button session) loads its real history instead of starting
  // blank. If no specific conversationId was passed in (the common case -
  // the floating button and nav entry point don't pass one), auto-resume
  // the user's most recently updated conversation instead of silently
  // starting a new, empty one each time - the chat should stay where you
  // left it, not reset on every open. A brand new user with no saved
  // conversations yet still starts blank, which is correct.
  useEffect(() => {
    const existingId = route.params?.conversationId;
    if (existingId) {
      assistantApi.getConversation(existingId).then((c) => {
        setConversationId(c.id);
        setMessages(c.messages);
      }).catch(() => {});
      return;
    }
    assistantApi.listConversations().then((r) => {
      const mostRecent = r.items[0];
      if (!mostRecent) return; // no prior conversation - stay on the blank welcome state
      assistantApi.getConversation(mostRecent.id).then((c) => {
        setConversationId(c.id);
        setMessages(c.messages);
      }).catch(() => {});
    }).catch(() => {});
    // Intentionally runs once on mount only - resuming is a one-time thing
    // when the screen opens, not something that should re-fire and clobber
    // an in-progress chat on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNewConversation = useCallback(() => {
    activeStreamRef.current?.abort();
    setConversationId(null);
    setMessages([]);
  }, []);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Only one in-flight request at a time - a new send aborts whatever was
    // still streaming rather than letting two responses race into the list.
    activeStreamRef.current?.abort();

    setInput('');
    const userMsg: ChatItem = { role: 'user', content: trimmed, createdAt: new Date().toISOString() };
    const pendingMsg: ChatItem = { role: 'assistant', content: '', createdAt: new Date().toISOString(), pending: true };
    setMessages((prev) => [...prev, userMsg, pendingMsg]);

    const updateLast = (patch: Partial<ChatItem>) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last) next[next.length - 1] = { ...last, ...patch };
        return next;
      });
    };

    let accumulated = '';
    activeStreamRef.current = streamAssistantMessage(conversationId, trimmed, screenContext, {
      onStage: (stage) => updateLast({ stageLabel: stage.label }),
      onChunk: (chunk) => {
        accumulated += chunk;
        // First real content chunk: the thinking overlay disappears the
        // instant this fires, since RichAnswer only renders once content
        // is non-empty (see Bubble above).
        updateLast({ content: accumulated, pending: true });
      },
      onDone: (res) => {
        activeStreamRef.current = null;
        setConversationId(res.conversationId);
        setSuggested(res.suggestedFollowUps);
        updateLast({
          content: accumulated || res.reply,
          detectedFeature: res.detectedFeature,
          premiumCard: res.premiumCard,
          pending: false,
          stageLabel: undefined,
        });
      },
      onError: () => {
        activeStreamRef.current = null;
        updateLast({
          content: 'Something went wrong. Tap to retry.',
          pending: false,
          failed: true,
          stageLabel: undefined,
        });
      },
    });
  }, [conversationId, screenContext]);

  const copyToClipboard = useCallback((_text: string) => {
    // Clipboard API varies by RN setup in this repo; no-op placeholder kept
    // intentionally simple rather than adding a new native dependency.
  }, []);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageContainer scroll={false} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
          <View style={{ flexDirection: 'row' }}>
            <IconButton icon={SquarePen} onPress={startNewConversation} />
            <IconButton icon={History} onPress={() => navigation.navigate('AssistantHistory')} />
          </View>
        </View>
        <Text variant="display" weight="semibold" style={{ marginBottom: 4 }}>AI Astrologer</Text>
        {screenContext && CONTEXT_LABELS[screenContext] && (
          <Text variant="caption" tone="accent" style={{ marginBottom: spacing.sm }}>
            Asking about: {CONTEXT_LABELS[screenContext]}
          </Text>
        )}

        {messages.length === 0 && (
          <Card style={{ marginBottom: spacing.md }}>
            <Text variant="bodySm" tone="secondary">{welcome}</Text>
          </Card>
        )}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <Bubble item={item} onCopy={copyToClipboard} onRetry={() => send(messages[index - 1]?.content ?? '')} />
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          style={{ flex: 1 }}
        />

        {suggested.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
            {suggested.map((q) => (
              <Pressable
                key={q}
                onPress={() => send(q)}
                style={{ borderWidth: 1, borderColor: color.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12, marginRight: spacing.sm, marginBottom: spacing.sm }}
              >
                <Text variant="caption" tone="secondary">{q}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your reading..."
            placeholderTextColor={color.textMuted}
            style={{
              flex: 1, backgroundColor: color.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md,
              paddingVertical: 10, color: color.textPrimary, borderWidth: 1, borderColor: color.border,
            }}
            onSubmitEditing={() => send(input)}
          />
          <Pressable onPress={() => send(input)} style={{ marginLeft: spacing.sm, padding: 10 }}>
            <Send size={20} color={color.accent} />
          </Pressable>
        </View>
      </PageContainer>
    </KeyboardAvoidingView>
  );
}
