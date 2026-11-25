import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TarotCardFace } from './TarotCardFace';
import { TarotCard, Orientation } from '../types/tarot';

type Props = {
  card?: TarotCard;
  orientation?: Orientation;
  revealed: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /** Fired on touch-down, before any tap completes - lets the parent fan
   * push neighboring tiles apart so there's more room to land the tap
   * precisely, without waiting for a full press-and-release. */
  onPressIn?: () => void;
  onPressOut?: () => void;
  width?: number;
  height?: number;
  reduceMotion?: boolean;
};

/** A single deck tile that flips from face-down to face-up with a smooth
 * rotateY animation when tapped (the identity it reveals was already fixed
 * server-side at draw time - tapping only decides reveal order, never which
 * card it turns out to be). */
export function FlippableTarotTile({
  card, orientation = 'upright', revealed, disabled, onPress, onPressIn, onPressOut, width = 84, height = 128, reduceMotion,
}: Props) {
  const flip = useRef(new Animated.Value(revealed ? 1 : 0)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const wasRevealed = useRef(revealed);

  useEffect(() => {
    if (reduceMotion) {
      flip.setValue(revealed ? 1 : 0);
      return;
    }
    // A gold light sweeps across the face right after it turns over (only when it was just revealed, not on first paint).
    if (revealed && !wasRevealed.current) {
      sheen.setValue(0);
      Animated.sequence([
        Animated.delay(360),
        Animated.timing(sheen, { toValue: 1, duration: 720, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
    wasRevealed.current = revealed;
    Animated.timing(flip, {
      toValue: revealed ? 1 : 0,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [revealed]);

  const frontRotate = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '90deg'] });
  const backRotate = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-90deg', '-90deg', '0deg'] });
  const frontOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = flip.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [0, 0, 1, 1] });

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={revealed ? `${card?.name ?? 'Card'}, ${orientation}` : 'Face-down tarot card, tap to select'}
      style={{ width, height }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width, height,
          opacity: frontOpacity,
          transform: [{ perspective: 800 }, { rotateY: frontRotate }],
          backfaceVisibility: 'hidden',
        }}
      >
        <TarotCardFace faceDown width={width} height={height} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          width, height,
          opacity: backOpacity,
          transform: [{ perspective: 800 }, { rotateY: backRotate }],
          backfaceVisibility: 'hidden',
        }}
      >
        <TarotCardFace card={card} orientation={orientation} width={width} height={height} />
        {!reduceMotion && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 14 }]}>
            <Animated.View
              style={{
                position: 'absolute', top: -height * 0.2, bottom: -height * 0.2, width: width * 0.55,
                opacity: sheen.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.7, width * 1.2] }) },
                  { rotate: '18deg' },
                ],
              }}
            >
              <LinearGradient
                colors={['rgba(232,184,92,0)', 'rgba(255,236,190,0.55)', 'rgba(232,184,92,0)']}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
