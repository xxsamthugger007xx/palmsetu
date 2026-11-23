import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { RazorpayCheckoutModal, RazorpaySuccessResult } from '../../components/RazorpayCheckoutModal';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { soulmateApi } from '../../services/soulmateApi';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
const GENDER_LABEL: Record<string, string> = { male: 'Male', female: 'Female', 'no-preference': 'No preference' };

function formatCountry(id: string): string {
  if (id === 'no-preference') return 'No preference';
  return id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

const STYLE_LABEL: Record<string, string> = {
  pencil: 'Realistic pencil sketch',
  charcoal: 'Charcoal portrait',
  'soft-portrait': 'Soft artistic portrait',
};

export function SoulmatePaymentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SoulmatePayment'>>();
  const answers = route.params;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{ sketchId: string; keyId: string; orderId: string; amountCents: number; currency: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handlePay = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await soulmateApi.createSketch(answers);
      if (!res.razorpayKeyId || !res.orderId) {
        setError(t('ui.SoulmatePaymentScreen.paymentsAreNotYetAvailable'));
        return;
      }
      setCheckout({ sketchId: res.sketch.id, keyId: res.razorpayKeyId, orderId: res.orderId, amountCents: res.amountCents, currency: res.currency });
    } catch (__err) {
      const err = asApiError(__err);
      if (err.code === 'PAYMENT_NOT_CONFIGURED') {
        setError(t('ui.SoulmatePaymentScreen.paymentsAreNotYetAvailable'));
      } else {
        setError(err.message ?? t('ui.SoulmatePaymentScreen.couldNotStartCheckoutPlease'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutSuccess = async (result: RazorpaySuccessResult) => {
    if (!checkout) return;
    setVerifying(true);
    try {
      await soulmateApi.verifyPayment(checkout.sketchId, result);
      setCheckout(null);
      navigation.replace('SoulmateGenerating', { sketchId: checkout.sketchId });
    } catch (__err) {
      const err = asApiError(__err);
      setCheckout(null);
      setError(err.message ?? t('ui.SoulmatePaymentScreen.paymentVerificationFailedIfAn'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">{t('ui.SoulmatePaymentScreen.reviewPay')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.SoulmatePaymentScreen.yourPreferences')}</Text>
      <Card elevated style={{ marginTop: spacing.md }}>
        <PreviewRow label={t('ui.SoulmatePaymentScreen.gender')} value={GENDER_LABEL[answers.preferredGender] ?? answers.preferredGender} />
        <PreviewRow label={t('ui.SoulmatePaymentScreen.ageRange')} value={answers.preferredAgeRange} />
        <PreviewRow label={t('ui.SoulmatePaymentScreen.countryBackground')} value={formatCountry(answers.preferredCountry)} />
        <PreviewRow label={t('ui.SoulmatePaymentScreen.style')} value={STYLE_LABEL[answers.style] ?? answers.style} last />
      </Card>

      <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'flex-start' }}>
        <ShieldCheck size={16} color={color.secondary} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
          {t('ui.SoulmatePaymentScreen.yourPaymentIsProcessedSecurely')}
        </Text>
      </Card>

      {error && (
        <Text variant="caption" tone="danger" style={{ marginTop: spacing.md }}>{error}</Text>
      )}

      <Button
        label={t('ui.SoulmatePaymentScreen.payAndGenerateMySketch')}
        fullWidth
        loading={submitting}
        disabled={submitting}
        style={{ marginTop: spacing.lg }}
        onPress={handlePay}
      />

      {checkout && (
        <RazorpayCheckoutModal
          visible={!!checkout}
          keyId={checkout.keyId}
          orderId={checkout.orderId}
          amountCents={checkout.amountCents}
          currency={checkout.currency}
          onSuccess={handleCheckoutSuccess}
          onDismiss={() => setCheckout(null)}
          onFailed={(reason) => {
            setCheckout(null);
            setError(reason ?? t('ui.SoulmatePaymentScreen.paymentDidNotCompletePlease'));
          }}
        />
      )}

      {verifying && (
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          {t('ui.SoulmatePaymentScreen.verifyingYourPayment')}
        </Text>
      )}
    </PageContainer>
  );
}

function PreviewRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.previewRow, !last && styles.previewRowDivider]}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="bodySm" weight="semibold">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  previewRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: color.borderSubtle,
  },
});
