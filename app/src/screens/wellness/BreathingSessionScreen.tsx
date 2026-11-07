import React from 'react';
import { Animated, Easing, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pause, Play, Square, Check } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi } from '../../services/wellnessApi';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'BreathingSession'>;

export function BreathingSessionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { technique } = route.params;
  const phases = technique.phases;

  const [phaseIndex, setPhaseIndex] = React.useState(0);
  const [cycle, setCycle] = React.useState(1);
  const [secondsLeft, setSecondsLeft] = React.useState(phases[0]?.seconds ?? 0);
  const [running, setRunning] = React.useState(true);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [done, setDone] = React.useState<{ completed: boolean } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const plannedDurationSeconds = React.useMemo(
    () => phases.reduce((sum, p) => sum + p.seconds, 0) * technique.defaultCycles,
    [phases, technique.defaultCycles],
  );

  const scale = React.useRef(new Animated.Value(0.6)).current;

  const currentPhase = phases[phaseIndex];

  // Drive the circle animation from the real phase durations returned by the
  // backend catalogue - never a hardcoded 4-4-4-4, per the technique actually
  // selected.
  React.useEffect(() => {
    if (!currentPhase) return;
    const isInhale = currentPhase.label.toLowerCase().includes('in');
    const isExhale = currentPhase.label.toLowerCase().includes('out');
    if (running) {
      Animated.timing(scale, {
        toValue: isInhale ? 1 : isExhale ? 0.6 : 0.8,
        duration: currentPhase.seconds * 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      scale.stopAnimation();
    }
  }, [phaseIndex, running, currentPhase]);

  // Countdown ticker, advances phases/cycles from the real catalogue data.
  // Kept as a single interval per running-state (not re-created every
  // second) with all mutable state read via refs, so no stale-closure bugs.
  const phaseIndexRef = React.useRef(phaseIndex);
  const cycleRef = React.useRef(cycle);
  phaseIndexRef.current = phaseIndex;
  cycleRef.current = cycle;

  React.useEffect(() => {
    if (!running || done) return;
    const interval = setInterval(() => {
      setElapsedSeconds((e) => e + 1);
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;

        const nextIndex = phaseIndexRef.current + 1 >= phases.length ? 0 : phaseIndexRef.current + 1;
        if (nextIndex === 0) {
          const nextCycle = cycleRef.current + 1;
          if (nextCycle > technique.defaultCycles) {
            setTimeout(() => finish(true), 0);
            return 0;
          }
          setCycle(nextCycle);
        }
        setPhaseIndex(nextIndex);
        return phases[nextIndex]?.seconds ?? phases[0].seconds;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, done, phases, technique.defaultCycles]);

  const finish = async (completedNaturally: boolean) => {
    if (done) return;
    setRunning(false);
    setDone({ completed: completedNaturally });
    setSaving(true);
    try {
      await wellnessApi.saveBreathingSession({
        technique: technique.id,
        plannedDurationSeconds,
        actualDurationSeconds: elapsedSeconds,
        completed: completedNaturally,
      });
    } catch {
      // Honest failure: the completion screen still shows, but the session
      // may not have been recorded server-side. No fabricated success state.
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <PageContainer>
        <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36, backgroundColor: done.completed ? color.successMuted : color.warningMuted,
            alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
          }}>
            <Check size={28} color={done.completed ? color.success : color.warning} strokeWidth={2} />
          </View>
          <Text variant="title" weight="semibold">{done.completed ? 'Session complete' : 'Session ended early'}</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
            {done.completed
              ? `You completed ${technique.defaultCycles} cycles of ${technique.name}.`
              : `You practiced for ${elapsedSeconds} seconds before stopping. This was recorded as incomplete.`}
          </Text>
          {saving && <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>Saving...</Text>}
          <Button label="Done" onPress={() => navigation.goBack()} style={{ marginTop: spacing.xl, minWidth: 160 }} />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer scroll={false}>
      <Text variant="title" weight="semibold" style={{ marginTop: spacing.sm, textAlign: 'center' }}>{technique.name}</Text>
      <Text variant="caption" tone="muted" style={{ textAlign: 'center', marginBottom: spacing.lg }}>
        Cycle {Math.min(cycle, technique.defaultCycles)} of {technique.defaultCycles}
      </Text>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={{
            width: 180, height: 180, borderRadius: 90,
            backgroundColor: color.accentMuted,
            borderWidth: 2, borderColor: color.accentBorder,
            alignItems: 'center', justifyContent: 'center',
            transform: [{ scale }],
          }}
        >
          <Text variant="title" weight="semibold">{currentPhase?.label}</Text>
          <Text variant="display" weight="semibold" tone="accent">{secondsLeft}</Text>
        </Animated.View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.xl }}>
        <Button
          label={running ? 'Pause' : 'Resume'}
          icon={running ? Pause : Play}
          variant="secondary"
          onPress={() => setRunning((r) => !r)}
          style={{ marginRight: spacing.md, minWidth: 120 }}
        />
        <Button
          label="Stop"
          icon={Square}
          variant="danger"
          onPress={() => finish(false)}
          style={{ minWidth: 120 }}
        />
      </View>
    </PageContainer>
  );
}
