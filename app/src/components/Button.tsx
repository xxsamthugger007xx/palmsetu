import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { color, radius, spacing } from '../theme/tokens';
import { Text } from './Text';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { isRtlLayout } from '../utils/rtl';

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
// Spoken name for icon-only buttons, by the lucide icon's name. Screens can always override with accessibilityLabel.
const ICON_LABEL_KEYS: Record<string, string> = {
  ChevronLeft: 'a11y.back', ChevronRight: 'a11y.back', X: 'a11y.close', Trash2: 'a11y.delete', History: 'a11y.history',
  Share2: 'a11y.share', Bookmark: 'a11y.bookmark', Pencil: 'a11y.edit', SquarePen: 'a11y.newConversation',
  Send: 'a11y.send', RotateCcw: 'a11y.retry', Info: 'a11y.info', Heart: 'a11y.favorite', Bell: 'a11y.notifications',
  Search: 'a11y.search',
};

export function IconButton({
  icon,
  onPress,
  size = 20,
  tone = color.textPrimary,
  accessibilityLabel,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  size?: number;
  tone?: string;
  accessibilityLabel?: string;
}) {
  const { t } = useTranslation();
  // In a right-to-left layout "back" points right, so swap the chevron instead of leaving it pointing the wrong way.
  const Icon: LucideIcon = isRtlLayout() ? (icon === ChevronLeft ? ChevronRight : icon === ChevronRight ? ChevronLeft : icon) : icon;
  const name = (icon as unknown as { displayName?: string }).displayName ?? '';
  const label = accessibilityLabel ?? t(ICON_LABEL_KEYS[name] ?? 'a11y.button');
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [iconStyles.base, pressed && iconStyles.pressed]}
    >
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
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
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
    // Soft glow so the main action stands out against the dark background.
    shadowColor: color.accent,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
