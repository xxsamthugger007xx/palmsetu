import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { color, featureTint, typography } from '../theme/tokens';

export type ShareKind = keyof typeof featureTint;

type Props = {
  kind: ShareKind;
  /** Small caps line at the top, e.g. "MY CARD TODAY". */
  eyebrow: string;
  /** Big serif headline, e.g. the card or the Moon sign. */
  title: string;
  /** A line or two of the reading itself. */
  body?: string | null;
  /** The artwork in the middle (card faces, a moon symbol...). */
  children?: React.ReactNode;
  tagline: string;
  /** Ref to capture (a plain prop, because React Native's View is not a class any more). */
  viewRef?: React.Ref<any>;
};

export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 450; // 4:5, captured at 3x = 1080x1350

/**
 * A branded picture people can share: deep-indigo night sky with the feature's own glow, the result in the middle, and the
 * Palm Setu name at the bottom. Rendered off-screen and captured as an image (see services/shareCard.ts). It only ever
 * contains what the person chooses to share: never a photo, birth details or an email.
 */
export function ShareCard({ kind, eyebrow, title, body, children, tagline, viewRef }: Props) {
  const tint = featureTint[kind];
  return (
    <View ref={viewRef} collapsable={false} style={styles.card}>
      <LinearGradient colors={['#0E0B1F', '#1d1545', '#0E0B1F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, { backgroundColor: tint.solid }]} />
      <View style={[styles.border, { borderColor: tint.solid }]} />
      <Text variant="caption" style={[styles.eyebrow, { color: tint.solid }]}>{eyebrow}</Text>
      <View style={styles.art}>{children}</View>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      {!!body && <Text style={styles.body} numberOfLines={4}>{body}</Text>}
      <View style={styles.footer}>
        <Text style={styles.brand}>PALM SETU</Text>
        <Text style={styles.tagline}>{tagline}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, overflow: 'hidden', alignItems: 'center', paddingHorizontal: 28, paddingTop: 30, backgroundColor: color.bg },
  glow: { position: 'absolute', top: 70, width: 260, height: 260, borderRadius: 130, opacity: 0.16 },
  border: { position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, borderRadius: 22, borderWidth: 1, opacity: 0.45 },
  eyebrow: { letterSpacing: 3, fontSize: 11, fontFamily: typography.fontFamily.semibold },
  art: { height: 180, marginTop: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  title: { marginTop: 16, color: '#fff', fontSize: 25, lineHeight: 30, textAlign: 'center', fontFamily: typography.fontFamily.serif },
  body: { marginTop: 10, color: 'rgba(233,233,237,0.78)', fontSize: 13.5, lineHeight: 19, textAlign: 'center', fontFamily: typography.fontFamily.regular },
  footer: { position: 'absolute', bottom: 26, alignItems: 'center' },
  brand: { color: color.gold, letterSpacing: 4, fontSize: 12, fontFamily: typography.fontFamily.semibold },
  tagline: { marginTop: 3, color: 'rgba(233,233,237,0.55)', fontSize: 10.5, fontFamily: typography.fontFamily.regular },
});
