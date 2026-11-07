import React, { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { TarotCardFace } from './TarotCardFace';
import { TarotCard, Orientation } from '../types/tarot';

type Props = {
  card?: TarotCard;
  orientation?: Orientation;
  revealed: boolean;
  disabled?: boolean;
  onPress?: () => void;
  width?: number;
  height?: number;
  reduceMotion?: boolean;
};

/** A single deck tile that flips from face-down to face-up with a smooth
 * rotateY animation when tapped (the identity it reveals was already fixed
 * server-side at draw time - tapping only decides reveal order, never which
 * card it turns out to be). */
export function FlippableTarotTile({
  card, orientation = 'upright', revealed, disabled, onPress, width = 84, height = 128, reduceMotion,
}: Props) {
  const flip = useRef(new Animated.Value(revealed ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      flip.setValue(revealed ? 1 : 0);
      return;
    }
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
      </Animated.View>
    </Pressable>
  );
}
