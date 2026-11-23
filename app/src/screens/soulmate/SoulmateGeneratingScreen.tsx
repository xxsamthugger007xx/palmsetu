import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkles, AlertTriangle } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { soulmateApi } from '../../services/soulmateApi';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
const MESSAGES = [
  'Connecting the stars...',
  'Imagining your soulmate...',
  'Creating your portrait...',
  'Adding the final artistic details...',
];
const MESSAGE_INTERVAL_MS = 3200;

export function SoulmateGeneratingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SoulmateGenerating'>>();
  const { sketchId } = route.params;

  const [phase, setPhase] = useState<'generating' | 'failed'>('generating');
  const [messageIndex, setMessageIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  useEffect(() => {
    if (phase !== 'generating') return;
    const interval = setInterval(() => setMessageIndex((i) => (i + 1) % MESSAGES.length), MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase]);

  const runGenerate = async () => {
    setPhase('generating');
    setErrorMessage(null);
    try {
      const res = await soulmateApi.generate(sketchId);
      if (res.sketch.generationStatus === 'completed') {
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [{ name: 'MainTabs' }, { name: 'SoulmateResult', params: { sketchId } }],
          })
        );
      } else {
        setPhase('failed');
        setErrorMessage(t('ui.SoulmateGeneratingScreen.couldNotFinishYourSketch'));
      }
    } catch (__err) {
      const err = asApiError(__err);
      setPhase('failed');
      setErrorMessage(err.message ?? t('ui.SoulmateGeneratingScreen.couldNotGenerateYourSketch'));
    }
  };

  useEffect(() => {
    runGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sketchId]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  if (phase === 'failed') {
    return (
      <PageContainer>
        <View style={styles.center}>
          <View style={styles.failedIcon}>
            <AlertTriangle size={24} color={color.warning} strokeWidth={1.75} />
          </View>
          <Text variant="title" weight="semibold" style={{ marginTop: spacing.md, textAlign: 'center' }}>
            {t('ui.SoulmateGeneratingScreen.somethingWentWrong')}
          </Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
            {errorMessage}
          </Text>
          <Button label={t('ui.AstrologyLandingScreen.retry')} fullWidth style={{ marginTop: spacing.lg }} onPress={runGenerate} />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer scroll={false}>
      <View style={styles.center}>
        <LinearGradient
          colors={[color.accentMuted, color.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glowRing}
        >
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Sparkles size={32} color={color.accent} strokeWidth={1.5} />
          </Animated.View>
        </LinearGradient>
        <Text variant="title" weight="semibold" style={{ marginTop: spacing.xl, textAlign: 'center' }}>
          {MESSAGES[messageIndex]}
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          {t('ui.SoulmateGeneratingScreen.thisUsuallyTakesUnderA')}
        </Text>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  glowRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.accentBorder,
  },
  failedIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.warningMuted,
  },
});
