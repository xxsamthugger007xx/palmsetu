import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { color, radius, spacing } from '../theme/tokens';
import { Text } from './Text';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  fullWidth?: boolean;
  style?: ViewStyle;
};

const toneForVariant = {
  primary: 'inverted',
  secondary: 'primary',
  ghost: 'primary',
  danger: 'danger',
} as const;

export function PrimaryButton(props: Omit<Props, 'variant'>) {
  return <Button {...props} variant="primary" />;
}
export function SecondaryButton(props: Omit<Props, 'variant'>) {
  return <Button {...props} variant="secondary" />;
}
export function IconButton({
  icon: Icon,
  onPress,
  size = 20,
  tone = color.textPrimary,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  size?: number;
  tone?: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => [iconStyles.base, pressed && iconStyles.pressed]}>
      <Icon size={size} color={tone} strokeWidth={1.75} />
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon: Icon,
  fullWidth,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? color.bg : color.accent} size="small" />
      ) : (
        <>
          {Icon && <Icon size={16} color={toneColorFor(variant)} strokeWidth={1.75} />}
          <Text variant="bodySm" weight="semibold" tone={toneForVariant[variant]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function toneColorFor(variant: Props['variant']) {
  switch (variant) {
    case 'primary':
      return color.bg;
    case 'danger':
      return color.danger;
    default:
      return color.textPrimary;
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: color.accent,
  },
  secondary: {
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: color.dangerMuted,
    borderWidth: 1,
    borderColor: 'rgba(217, 112, 106, 0.3)',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
});

const iconStyles = StyleSheet.create({
  base: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: color.surfaceHover,
  },
});
