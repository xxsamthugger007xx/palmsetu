import React from 'react';
import { View } from 'react-native';
import { Card } from './Card';
import { LoadingSkeleton } from './LoadingSkeleton';
import { spacing } from '../theme/tokens';
import { useTranslation } from 'react-i18next';

/** Placeholder cards shown while a list screen loads, so it never flashes blank or "empty". */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <View accessibilityLabel={t('ui.ListSkeleton.loading')} accessibilityRole="progressbar">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} style={{ marginBottom: spacing.sm }}>
          <LoadingSkeleton width="55%" height={14} />
          <LoadingSkeleton width="90%" height={12} style={{ marginTop: spacing.sm }} />
        </Card>
      ))}
    </View>
  );
}
