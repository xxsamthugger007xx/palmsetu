import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkles, X } from 'lucide-react-native';
import { Text } from './Text';
import { Button, IconButton } from './Button';
import { color, radius, spacing } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const DISMISS_PREFIX = 'solune.signupPromptDismissed.';

/**
 * Contextual, dismissible "create a free account to save this" card - not a
 * blocking modal, never interrupts the reading itself (it renders inline,
 * below the result, after the reading is already fully visible). Only
 * shown to guests, and only once per `storageKey` (a dismissal is
 * remembered locally and the card never reappears for that context again,
 * per the product requirement to not repeatedly nag after a dismissal).
 *
 * Each feature screen (Palm, Tarot, Kundli, ...) passes its own storageKey
 * and copy - see PalmReportScreen.tsx / TarotReportScreen.tsx for the
 * concrete examples this was designed around.
 */
export function SignUpPromptCard({ storageKey, title, description }: { storageKey: string; title: string; description: string }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isGuest } = useAuth();
  const [dismissed, setDismissed] = useState(true); // default hidden until the async check resolves, to avoid a flash

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_PREFIX + storageKey)
      .then((v) => setDismissed(v === '1'))
      .catch(() => setDismissed(false));
  }, [storageKey]);

  if (!isGuest || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISS_PREFIX + storageKey, '1').catch(() => {});
  };

  return (
    <LinearGradient
      colors={[color.accentMuted, color.surfaceElevated]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Sparkles size={16} color={color.accent} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text variant="bodySm" weight="semibold">{title}</Text>
        </View>
        <IconButton icon={X} size={16} onPress={dismiss} />
      </View>
      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>{description}</Text>
      <View style={styles.actionRow}>
        <Button
          label={t('ui.SignUpPromptCard.maybeLater')}
          variant="ghost"
          size="sm"
          style={{ flex: 1 }}
          onPress={dismiss}
        />
        <Button
          label={t('ui.SignUpPromptCard.createFreeAccount')}
          size="sm"
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('Auth', { mode: 'signup', intent: description })}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.accentBorder,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.accentBorder,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
