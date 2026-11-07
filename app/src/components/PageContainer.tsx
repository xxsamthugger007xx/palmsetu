import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, spacing } from '../theme/tokens';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
};

/** Standard screen wrapper: solid background, safe-area-aware top inset, consistent
 * side gutters, safe scrolling. Every screen should render inside this instead of
 * padding itself, so top content never draws under the status bar / notch. */
export function PageContainer({ children, scroll = true, style }: Props) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingHorizontal: spacing.lg,
    paddingTop: insets.top + spacing.sm,
    paddingBottom: insets.bottom + spacing.xxl,
  };

  if (!scroll) {
    return <View style={[styles.root, padding, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[padding, style]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
});
