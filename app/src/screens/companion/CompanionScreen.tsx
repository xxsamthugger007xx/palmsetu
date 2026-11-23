import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Send, RotateCcw } from 'lucide-react-native';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { request } from '../../services/apiRequest';
import { useTranslation } from 'react-i18next';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

type Message = { id: string; role: 'user' | 'assistant'; text: string; failed?: boolean };

const CRISIS_KEYWORDS = ['suicide', 'kill myself', 'end my life', 'hurt myself', 'self-harm'];

const initialMessages: Message[] = [
  { id: '1', role: 'assistant', text: "Hi, I'm here to help you reflect on your reading or anything on your mind. What would you like to talk about?" },
];

const suggestedPrompts = [
  'Explain my heart line',
  'What does this feature traditionally represent?',
  'Help me reflect on my strengths',
  'Suggest questions for personal growth',
];

function containsCrisisLanguage(text: string) {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((k) => lower.includes(k));
}

export function CompanionScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const send = (text: string) => {
    if (!text.trim() || sending) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };

    if (containsCrisisLanguage(text)) {
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: Date.now().toString() + '-r',
          role: 'assistant',
          text:
            "I'm really glad you told me. I'm an AI and can't provide emergency care, but you deserve immediate support. " +
            'If you are in danger right now, please contact local emergency services. In the US you can call or text ' +
            '988 (Suicide & Crisis Lifeline). Would it help to talk about what’s going on, or find a professional near you?',
        },
      ]);
      setInput('');
      return;
    }

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    request<{ conversationId: string; reply: string }>(BASE_URL, '/companion/message', {
      method: 'POST',
      body: JSON.stringify({ conversationId, message: text, mode: 'palmistry' }),
    })
      .then((res) => {
        setConversationId(res.conversationId);
        setMessages((prev) => [...prev, { id: Date.now().toString() + '-r', role: 'assistant', text: res.reply }]);
      })
      .catch((err: Error) => {
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString() + '-e', role: 'assistant', failed: true, text: err.message || 'Something went wrong. Please try again.' },
        ]);
      })
      .finally(() => setSending(false));
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">{t('ui.CompanionScreen.aiCompanion')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
            <Text variant="bodySm" tone={item.role === 'user' ? 'primary' : 'secondary'}>{item.text}</Text>
          </View>
        )}
      />

      {messages.length <= 1 && (
        <View style={styles.promptRow}>
          {suggestedPrompts.map((p) => (
            <View key={p} style={styles.promptChip}>
              <Text variant="caption" tone="secondary" onPress={() => send(p)}>{p}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t('ui.CompanionScreen.shareWhatSOnYour')} accessibilityLabel={t('ui.CompanionScreen.shareWhatSOnYour')}
          placeholderTextColor={color.textMuted}
          style={styles.input}
          multiline
        />
        <IconButton icon={sending ? RotateCcw : Send} onPress={() => send(input)} tone={color.accent} />
      </View>
      <Text variant="caption" tone="muted" style={[styles.disclaimer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {t('ui.CompanionScreen.yourCompanionIsAnAi')}
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: color.accentMuted,
    borderWidth: 1,
    borderColor: color.accentBorder,
  },
  promptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  promptChip: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: spacing.md,
    color: color.textPrimary,
    maxHeight: 100,
  },
  disclaimer: { textAlign: 'center', paddingBottom: spacing.md, paddingHorizontal: spacing.lg },
});
