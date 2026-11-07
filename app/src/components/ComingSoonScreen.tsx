import React from 'react';
import { View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { PageContainer } from './PageContainer';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';
import { Text } from './Text';
import { spacing } from '../theme/tokens';

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  note?: string;
};

/**
 * Shared "coming soon" landing pattern, used by every placeholder section so
 * they read as one consistent, intentional design rather than ad-hoc dead
 * ends. Wraps EmptyState with a header and a "Coming soon" badge.
 */
export function ComingSoonScreen({ icon, title, description, note }: Props) {
  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{title}</Text>
      <View style={{ marginTop: spacing.xs }}>
        <StatusBadge label="Coming soon" status="accent" />
      </View>
      <Text
        variant="bodySm"
        tone="secondary"
        style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
      >
        {description}
      </Text>
      <EmptyState
        icon={icon}
        title="Not available yet"
        description={note ?? 'This feature is planned but not built yet. Check back in a future update.'}
      />
    </PageContainer>
  );
}
