import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, Check, ScanLine, MessageCircle, Users, Sparkles } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';

const BILLING_CONFIGURED = false; // TODO: wire to RevenueCat / StoreKit / Play Billing

const features = [
  { icon: ScanLine, label: 'Expanded palm reports with all detected lines' },
  { icon: MessageCircle, label: 'Unlimited AI follow-up questions' },
  { icon: Users, label: 'Advanced compatibility reports' },
  { icon: Sparkles, label: 'Full self-discovery and astrology library' },
];

const plans = [
  { id: 'annual', label: 'Annual', price: '$49.99/yr', note: 'Save 37% · 7-day free trial' },
  { id: 'monthly', label: 'Monthly', price: '$6.99/mo', note: 'Billed monthly' },
];

export function PaywallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selected, setSelected] = useState('annual');

  return (
    <PageContainer>
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <IconButton icon={X} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="display" weight="semibold" style={{ marginTop: spacing.md }}>Solune Premium</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Get the full depth of your readings, conversations, and self-discovery tools.
      </Text>

      <Card>
        {features.map((f) => (
          <View key={f.label} style={styles.featureRow}>
            <f.icon size={16} color={color.accent} strokeWidth={1.75} />
            <Text variant="bodySm" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>{f.label}</Text>
          </View>
        ))}
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <Card
              key={plan.id}
              elevated={isSelected}
              onPress={() => setSelected(plan.id)}
              style={[styles.planCard, isSelected && styles.planCardSelected]}
            >
              <View style={styles.planRow}>
                <View>
                  <Text variant="bodySm" weight="semibold">{plan.label}</Text>
                  <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{plan.note}</Text>
                </View>
                <View style={styles.planRight}>
                  <Text variant="mono" weight="semibold">{plan.price}</Text>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <Check size={12} color={color.bg} strokeWidth={3} />}
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      {!BILLING_CONFIGURED && (
        <Card style={styles.configNotice}>
          <Text variant="caption" style={{ color: color.warning }}>
            Billing is not yet configured. Connect RevenueCat or native StoreKit/Play Billing to enable
            real purchases - this screen will not charge you.
          </Text>
        </Card>
      )}

      <Button
        label={BILLING_CONFIGURED ? 'Continue' : 'Continue (test mode)'}
        fullWidth
        style={{ marginTop: spacing.lg }}
        onPress={() => navigation.goBack()}
      />
      <Button label="Restore purchases" variant="ghost" fullWidth style={{ marginTop: spacing.sm }} onPress={() => {}} />

      <Text variant="caption" tone="muted" style={styles.legal}>
        Subscriptions renew automatically unless cancelled at least 24 hours before the end of the
        current period. Manage or cancel anytime in your App Store or Play Store account settings.{' '}
        <Text variant="caption" tone="accent">Terms</Text> · <Text variant="caption" tone="accent">Privacy</Text>
      </Text>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  planCard: {
    marginBottom: spacing.sm,
  },
  planCardSelected: {
    borderColor: color.accentBorder,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  configNotice: {
    marginTop: spacing.md,
  },
  legal: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
