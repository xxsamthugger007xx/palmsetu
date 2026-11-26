import React from 'react';
import { StyleSheet, View, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Mail } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';

const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@palmsetu.com';

const FAQS = [
  {
    q: 'How accurate are the palm, tarot, and astrology readings?',
    a: 'Solune blends real astronomical/astrological calculations with AI-assisted interpretation for entertainment and self-reflection. Readings are not scientific predictions and shouldn\'t replace professional advice.',
  },
  {
    q: 'Why was I charged, or why can\'t I access a premium feature?',
    a: 'Check Profile > Current Plan to see your active plan. If a purchase didn\'t unlock a feature, try Profile > Restore Purchases, which re-checks your purchase history with the app store.',
  },
  {
    q: 'How do I change my birth details?',
    a: 'Go to Profile > Birth Details to update your date, time, and place of birth. This updates your astrology charts and readings going forward.',
  },
  {
    q: 'Can I delete my account and data?',
    a: 'Yes - Profile > Account Management > Delete Account permanently removes your account and all associated data.',
  },
  {
    q: 'How do I switch app language?',
    a: 'Go to Profile > Language to choose from the supported languages.',
  },
];

export function HelpScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">{t('profile.help')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>FREQUENTLY ASKED</Text>
      {FAQS.map((item) => (
        <Card key={item.q} style={{ marginBottom: spacing.sm }}>
          <Text variant="bodySm" weight="semibold">{item.q}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, lineHeight: 18 }}>{item.a}</Text>
        </Card>
      ))}

      <Card elevated style={[styles.contactCard, { marginTop: spacing.md }]}>
        <View style={styles.iconWrap}>
          <Mail size={18} color={color.accent} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text variant="bodySm" weight="semibold">Still need help?</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>Email our support team directly.</Text>
        </View>
      </Card>
      <Button
        label={`Email ${SUPPORT_EMAIL}`}
        fullWidth
        style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Solune support request')}`)}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contactCard: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: color.surfaceElevated, borderWidth: 1, borderColor: color.border,
    alignItems: 'center', justifyContent: 'center',
  },
});
