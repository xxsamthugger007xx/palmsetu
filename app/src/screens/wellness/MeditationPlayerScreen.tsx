import React from 'react';
import { View } from 'react-native';
import type { AVPlaybackStatus } from 'expo-av';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Play, Pause, Heart, Clock3, Moon, RefreshCw } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, MeditationContent, MeditationSession } from '../../services/wellnessApi';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MeditationPlayer'>;

/**
 * Real player shell built around expo-av's Audio.Sound API, structured so a
 * future asset-upload pass can wire in a real audioUrl without a UI rebuild.
 * Every piece of catalogue content in this app currently has audioUrl: null
 * and assetStatus: 'awaiting_upload' (confirmed server-side) - there is no
 * real audio anywhere in this repo. Rather than fake playback, the play
 * control honestly shows "audio coming soon" when there is no audioUrl,
 * while session-start/progress/completion tracking against the real backend
 * endpoints works today regardless of whether audio exists.
 */
export function MeditationPlayerScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [content, setContent] = React.useState<MeditationContent | null>(null);
  const [session, setSession] = React.useState<MeditationSession | null>(null);
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [positionSeconds, setPositionSeconds] = React.useState(0);
  const [sleepTimerMinutes, setSleepTimerMinutes] = React.useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const soundRef = React.useRef<any>(null);
  const progressTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const sleepTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    wellnessApi.getMeditationCatalogue()
      .then((res) => {
        const found = res.items.find((i) => i.id === params.contentId);
        if (!found) throw new Error('Content not found.');
        setContent(found);
      })
      .catch((err: any) => setError(err.message ?? 'Could not load this session.'))
      .finally(() => setLoading(false));
    // Note: the backend has no GET endpoint listing a user's favorited
    // meditation content ids (only favorite/unfavorite POST/DELETE), so this
    // screen's favorite toggle starts unset each visit rather than guessing.
  }, [params.contentId]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  React.useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, []);

  const saveProgress = React.useCallback((progressSeconds: number, completed?: boolean) => {
    if (!session) return;
    wellnessApi.updateMeditationSession(session.id, { progressSeconds, completed }).catch(() => {});
  }, [session]);

  const startSession = async () => {
    if (!content) return;
    setError(null);
    try {
      const res = await wellnessApi.startMeditationSession(content.id);
      setSession(res.session);
      wellnessApi.sendAnalyticsEvent('meditation_session_started', { contentId: content.id }).catch(() => {});

      if (res.audioUrl) {
        // Real expo-av wiring, exercised once an asset exists. Loaded lazily
        // (require, not a top-level import) so this native module is never
        // touched unless a real audioUrl is actually played - expo-av's
        // native module may not be present in every runtime this screen can
        // be reached from (e.g. Expo Go without a custom dev build), and
        // this screen is statically reachable from RootNavigator, so a
        // top-level import here would risk crashing the whole app on
        // launch for every user, not just the one playing this session.
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { Audio } = require('expo-av');
          const { sound } = await Audio.Sound.createAsync({ uri: res.audioUrl }, { shouldPlay: true });
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
            if (!status.isLoaded) return;
            setPositionSeconds(Math.floor(status.positionMillis / 1000));
            if (status.didJustFinish) {
              setIsPlaying(false);
              saveProgress(Math.floor((status.durationMillis ?? 0) / 1000), true);
            }
          });
          setIsPlaying(true);
        } catch {
          // Audio playback is not available in this runtime - the session
          // is still tracked server-side, same as the no-audio-yet case.
          setIsPlaying(false);
        }
      } else {
        // Honest state: no real audio asset exists yet for this content.
        setIsPlaying(false);
      }
    } catch (err: any) {
      setError(err?.status === 403 ? 'This session requires Solune Premium.' : (err?.message ?? 'Could not start this session.'));
      if (err?.status === 403) navigation.navigate('Paywall');
    }
  };

  const togglePlayPause = async () => {
    if (!session) { startSession(); return; }
    if (!soundRef.current) return; // no real audio loaded (awaiting_upload)
    if (isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      saveProgress(positionSeconds);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  const finishSession = () => {
    saveProgress(positionSeconds, true);
    soundRef.current?.stopAsync().catch(() => {});
    wellnessApi.sendAnalyticsEvent('meditation_session_completed', { contentId: content?.id ?? '' }).catch(() => {});
    setIsPlaying(false);
    navigation.goBack();
  };

  const toggleFavorite = async () => {
    if (!content) return;
    try {
      if (isFavorite) await wellnessApi.unfavoriteMeditation(content.id);
      else await wellnessApi.favoriteMeditation(content.id);
      setIsFavorite(!isFavorite);
    } catch {}
  };

  const setSleepTimer = (minutes: number | null) => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    setSleepTimerMinutes(minutes);
    if (minutes) {
      sleepTimerRef.current = setTimeout(() => {
        soundRef.current?.pauseAsync().catch(() => {});
        setIsPlaying(false);
        saveProgress(positionSeconds);
      }, minutes * 60 * 1000);
    }
  };

  if (loading) {
    return <PageContainer><Text variant="bodySm" tone="muted" style={{ marginTop: spacing.sm }}>Loading...</Text></PageContainer>;
  }

  if (error && !content) {
    return <PageContainer><EmptyState icon={RefreshCw} title="Something went wrong" description={error} actionLabel="Retry" onAction={load} /></PageContainer>;
  }

  if (!content) return null;

  const durationSeconds = content.durationMinutes * 60;
  const hasRealAudio = Boolean(session) && soundRef.current !== null;

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{content.title}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {content.description}
      </Text>

      {error && <Text variant="bodySm" tone="danger" style={{ marginBottom: spacing.sm }}>{error}</Text>}

      <Card elevated style={{ alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.lg }}>
        <Moon size={32} color={color.accent} strokeWidth={1.5} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
          <Clock3 size={13} color={color.textMuted} strokeWidth={1.75} />
          <Text variant="caption" tone="muted" style={{ marginLeft: 4 }}>
            {Math.floor(positionSeconds / 60)}:{String(positionSeconds % 60).padStart(2, '0')} / {content.durationMinutes}:00
          </Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: color.surfaceElevated, marginTop: spacing.sm, width: '80%', overflow: 'hidden' }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: color.accent, width: `${Math.min(100, Math.round((positionSeconds / durationSeconds) * 100))}%` }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg }}>
          <Button
            label={session ? (isPlaying ? 'Pause' : 'Resume') : 'Play'}
            icon={isPlaying ? Pause : Play}
            onPress={togglePlayPause}
            style={{ marginRight: spacing.sm }}
          />
          <Button
            label={isFavorite ? 'Favorited' : 'Favorite'}
            icon={Heart}
            variant="secondary"
            onPress={toggleFavorite}
          />
        </View>

        {!hasRealAudio && session && (
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.md, textAlign: 'center', maxWidth: 260 }}>
            This session's audio is coming soon. Your session is still being tracked, and you can mark it complete below.
          </Text>
        )}
      </Card>

      <Text variant="bodySm" weight="semibold" style={{ marginBottom: spacing.sm }}>Sleep timer</Text>
      <View style={{ flexDirection: 'row', marginBottom: spacing.lg, flexWrap: 'wrap' }}>
        {[null, 5, 10, 15, 30].map((m) => (
          <Button
            key={String(m)}
            label={m ? `${m} min` : 'Off'}
            size="sm"
            variant={sleepTimerMinutes === m ? 'primary' : 'secondary'}
            onPress={() => setSleepTimer(m)}
            style={{ marginRight: spacing.sm, marginBottom: spacing.sm }}
          />
        ))}
      </View>

      {session && (
        <Button label="Mark session complete" variant="secondary" fullWidth onPress={finishSession} />
      )}
    </PageContainer>
  );
}
