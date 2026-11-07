import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Heart, Briefcase, Compass as CompassIcon, MessageCircleQuestion } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { ReadingCategory } from '../../types/tarot';

const MIN_QUESTION_LENGTH = 3;
const MAX_QUESTION_LENGTH = 500;

const categories: { id: ReadingCategory; title: string; description: string; icon: typeof Heart }[] = [
  { id: 'general', title: 'General reflection', description: 'Open-ended guidance on where you are right now', icon: CompassIcon },
  { id: 'love', title: 'Love & relationships', description: 'Reflect on connection and how you relate to others', icon: Heart },
  { id: 'career', title: 'Career & personal development', description: 'Reflect on direction, work and growth', icon: Briefcase },
  { id: 'question', title: 'A personal question', description: 'Ask about something specific on your mind', icon: MessageCircleQuestion },
];

export function TarotCategoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TarotCategory'>>();
  const [category, setCategory] = useState<ReadingCategory>(route.params?.presetCategory ?? 'general');
  const [question, setQuestion] = useState('');

  const needsQuestion = category === 'question';
  const questionValid = !needsQuestion || question.trim().length >= MIN_QUESTION_LENGTH;

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>What would you like to explore?</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Tarot here is a traditional, interpretive practice for reflection - not a scientifically validated
        way to predict future events.
      </Text>

      {categories.map((c) => {
        const selected = category === c.id;
        return (
          <Card
            key={c.id}
            elevated={selected}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => setCategory(c.id)}
          >
            <View style={styles.optionRow}>
              <View style={styles.optionIcon}>
                <c.icon size={18} color={color.accent} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text variant="bodySm" weight="semibold">{c.title}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{c.description}</Text>
              </View>
            </View>
          </Card>
        );
      })}

      {needsQuestion && (
        <View style={{ marginTop: spacing.md }}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="What's on your mind? (kept private unless you choose to share it)"
            placeholderTextColor={color.textMuted}
            style={styles.input}
            multiline
            maxLength={MAX_QUESTION_LENGTH}
          />
          <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
            {question.length}/{MAX_QUESTION_LENGTH}
          </Text>
        </View>
      )}

      <Button
        label="Choose a spread"
        fullWidth
        disabled={!questionValid}
        style={{ marginTop: spacing.lg }}
        onPress={() =>
          navigation.navigate('TarotSpread', {
            category,
            question: needsQuestion ? question.trim() : null,
          })
        }
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  option: { marginBottom: spacing.sm },
  optionSelected: { borderColor: color.accentBorder },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: color.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
