import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { User, Crown, ChevronRight } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'SelectAstrologyProfile'>;

/**
 * "Select Profile" step shown between the Astrology hub and the chart/reading
 * flow: "My Astrology" (free, subject to the usual free-tier quota) vs.
 * "Other Person's Astrology" (always premium - a genuinely separate feature,
 * not the same free slot).
 */
export function SelectAstrologyProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { path } = route.params;

  const goSelf = () => {
    if (path === 'vedic') navigation.navigate('KundliStyle', { subject: 'self' });
    else navigation.navigate('SoulEnergyReading');
  };

  const goOther = () => {
    if (path === 'vedic') navigation.navigate('KundliStyle', { subject: 'other' });
    else navigation.navigate('Paywall'); // other-person soul energy reading is not built; always a premium upsell
  };

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Select Profile</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {path === 'vedic'
          ? 'Whose birth chart should we generate?'
          : 'Whose personality reading should we generate?'}
      </Text>

      <Card onPress={goSelf}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <User size={18} color={color.accent} strokeWidth={1.75} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text variant="bodySm" weight="semibold">My Astrology</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>Free</Text>
          </View>
          <ChevronRight size={18} color={color.textMuted} strokeWidth={1.75} />
        </View>
      </Card>

      <Card onPress={goOther} style={{ marginTop: spacing.sm }}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Crown size={18} color={color.warning} strokeWidth={1.75} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text variant="bodySm" weight="semibold">Other Person's Astrology</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>Premium</Text>
          </View>
          <ChevronRight size={18} color={color.textMuted} strokeWidth={1.75} />
        </View>
      </Card>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: color.surfaceElevated, borderWidth: 1, borderColor: color.border,
    alignItems: 'center', justifyContent: 'center',
  },
});
