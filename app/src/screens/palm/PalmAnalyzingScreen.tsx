import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle2, Circle, LoaderCircle, AlertTriangle } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { CornerBrackets } from '../../components/CornerBrackets';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { palmApi } from '../../services/palmApi';

const STAGES = ['Uploading image', 'Detecting palm features', 'Preparing interpretation'];

type Stage = 'uploading' | 'detecting' | 'interpreting' | 'done';
type Phase = 'running' | 'rejected' | 'error';

export function PalmAnalyzingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PalmAnalyzing'>>();
  const [stage, setStage] = useState<Stage>('uploading');
  const [phase, setPhase] = useState<Phase>('running');
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const scanY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanY, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    scanLoop.start();

    let cancelled = false;

    async function run() {
      try {
        setStage('uploading');
        const base64 = await FileSystem.readAsStringAsync(route.params.imageUri, { encoding: 'base64' });
        if (cancelled) return;

        // We cannot observe the server's internal stages from here (there is
        // no streaming/progress channel for this request), so "detecting"
        // is shown for the duration of the one real request the moment the
        // upload itself completes - it reflects "the request is now in
        // flight server-side", not a fabricated timer.
        setStage('detecting');
        const reading = await palmApi.submitReading(base64);
        if (cancelled) return;

        setStage('interpreting');
        setStage('done');
        navigation.replace('PalmReport', { readingId: reading.id, justCompleted: true, selectedHand: route.params.hand });
      } catch (err: any) {
        if (cancelled) return;
        if (err?.code === 'IMAGE_REJECTED') {
          setRejectionMessage(err.message ?? 'This photo could not be used for a palm reading.');
          setPhase('rejected');
        } else {
          setPhase('error');
        }
      }
    }
    run();

    return () => {
      cancelled = true;
      scanLoop.stop();
    };
  }, []);

  const translateY = scanY.interpolate({ inputRange: [0, 1], outputRange: [0, 280] });
  const stageIndex = stage === 'uploading' ? 0 : stage === 'detecting' ? 1 : 2;

  if (phase === 'rejected' || phase === 'error') {
    return (
      <PageContainer scroll={false}>
        <View style={styles.center}>
          <View style={styles.frame}>
            {route.params?.imageUri ? (
              <Image source={{ uri: route.params.imageUri }} style={[styles.image, styles.dimmed]} />
            ) : (
              <View style={[styles.image, styles.imageFallback]} />
            )}
          </View>

          <AlertTriangle size={28} color={color.danger} strokeWidth={1.75} style={{ marginTop: spacing.xl }} />
          <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
            {phase === 'rejected' ? "We couldn't use this photo" : 'Something went wrong'}
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.lg }}>
            {phase === 'rejected'
              ? rejectionMessage
              : 'We could not reach the server to analyze your photo. Please check your connection and try again.'}
          </Text>

          <Button
            label="Retake photo"
            fullWidth
            style={{ marginTop: spacing.xl, width: '100%' }}
            onPress={() => navigation.replace('PalmCapture')}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer scroll={false}>
      <View style={styles.center}>
        <View style={styles.frame}>
          {route.params?.imageUri ? (
            <Image source={{ uri: route.params.imageUri }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imageFallback]} />
          )}
          <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
          <CornerBrackets />
        </View>

        <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.xl }}>
          Analyzing your palm
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}>
          Step {stageIndex + 1} of {STAGES.length}
        </Text>

        <View style={{ marginTop: spacing.lg, width: '100%' }}>
          {STAGES.map((label, i) => {
            const done = i < stageIndex;
            const active = i === stageIndex;
            return (
              <View key={label} style={styles.stageRow}>
                {done ? (
                  <CheckCircle2 size={16} color={color.secondary} strokeWidth={1.75} />
                ) : active ? (
                  <LoaderCircle size={16} color={color.accent} strokeWidth={1.75} />
                ) : (
                  <Circle size={16} color={color.textMuted} strokeWidth={1.75} />
                )}
                <Text
                  variant="caption"
                  tone={done ? 'secondary' : active ? 'primary' : 'muted'}
                  style={{ marginLeft: spacing.sm }}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 220,
    height: 280,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
    backgroundColor: color.surfaceElevated,
  },
  image: { width: '100%', height: '100%' },
  imageFallback: { backgroundColor: color.surfaceElevated },
  dimmed: { opacity: 0.5 },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: color.accent,
    shadowColor: color.accent,
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
});
