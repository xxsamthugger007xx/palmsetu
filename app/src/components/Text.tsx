import React from 'react';
import { Text as RNText, TextProps, TextStyle } from 'react-native';
import { color, typography } from '../theme/tokens';

type Variant = 'display' | 'title' | 'subtitle' | 'body' | 'bodySm' | 'caption' | 'label' | 'mono';
type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'danger' | 'inverted';

type Props = TextProps & {
  variant?: Variant;
  tone?: Tone;
  weight?: keyof typeof typography.weight;
};

const variantStyle: Record<Variant, TextStyle> = {
  display: { fontSize: typography.size.display, lineHeight: typography.lineHeight.display, fontWeight: typography.weight.semibold, letterSpacing: -0.4 },
  title: { fontSize: typography.size.xl, lineHeight: typography.lineHeight.xl, fontWeight: typography.weight.semibold, letterSpacing: -0.2 },
  subtitle: { fontSize: typography.size.lg, lineHeight: typography.lineHeight.lg, fontWeight: typography.weight.medium },
  body: { fontSize: typography.size.md, lineHeight: typography.lineHeight.md, fontWeight: typography.weight.regular },
  bodySm: { fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.regular },
  caption: { fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs, fontWeight: typography.weight.regular },
  label: { fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs, fontWeight: typography.weight.semibold, letterSpacing: 0.5, textTransform: 'uppercase' },
  mono: { fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm, fontWeight: typography.weight.medium, fontVariant: ['tabular-nums'] },
};

const toneColor: Record<Tone, string> = {
  primary: color.textPrimary,
  secondary: color.textSecondary,
  muted: color.textMuted,
  accent: color.accent,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
  inverted: color.bg,
};

const fontFamilyForWeight = (w: TextStyle['fontWeight']): string => {
  if (w === typography.weight.semibold || w === typography.weight.bold) return typography.fontFamily.semibold;
  if (w === typography.weight.medium) return typography.fontFamily.medium;
  return typography.fontFamily.regular;
};

export function Text({ variant = 'body', tone = 'primary', weight, style, ...rest }: Props) {
  const base = variantStyle[variant];
  const resolvedWeight = weight ? typography.weight[weight] : base.fontWeight;
  return (
    <RNText
      style={[
        base,
        { color: toneColor[tone], fontFamily: fontFamilyForWeight(resolvedWeight) },
        weight && { fontWeight: typography.weight[weight] },
        style,
      ]}
      {...rest}
    />
  );
}
