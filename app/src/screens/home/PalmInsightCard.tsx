import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { PalmReading } from '../../types/palm';

/** Home card with the latest palm reading summary. `undefined` = still loading, `null` = no reading yet. */
export function PalmInsightCard({ latestPalmReading }: { latestPalmReading: PalmReading | null | undefined }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
  <Card
          elevated
          style={{ marginBottom: spacing.sm }}
          onPress={() => navigation.navigate(latestPalmReading ? 'PalmHistory' : 'PalmIntro')}
        >
          <View style={styles.cardHeaderRow}>
            <Text variant="label" tone="accent">{t('home.palmInsightTitle')}</Text>
            <ChevronRight size={16} color={color.textMuted} />
          </View>
          {latestPalmReading === undefined ? (
            <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.sm }}>{t('common.loading')}</Text>
          ) : latestPalmReading ? (
            <>
              <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>
                {latestPalmReading.freeReading.summary}
                {latestPalmReading.freeReading.summaryTruncated ? '…' : ''}
              </Text>
              <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
                {t('home.palmInsightScanned', {
                  date: new Date(latestPalmReading.createdAt).toLocaleDateString(),
                  count: latestPalmReading.freeReading.sections.length,
                })}
              </Text>
            </>
          ) : (
            <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.sm }}>
              {t('home.palmInsightEmpty')}
            </Text>
          )}
        </Card>
  );
}

const styles = StyleSheet.create({
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
