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
        setError('Payments are not yet available on this server. Please try again later.');
        return;
      }
      setCheckout({ sketchId: res.sketch.id, keyId: res.razorpayKeyId, orderId: res.orderId, amountCents: res.amountCents, currency: res.currency });
    } catch (err: any) {
      if (err.code === 'PAYMENT_NOT_CONFIGURED') {
        setError('Payments are not yet available on this server. Please try again later.');
      } else {
        setError(err.message ?? 'Could not start checkout. Please try again.');
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
    } catch (err: any) {
      setCheckout(null);
      setError(err.message ?? 'Payment verification failed. If an amount was deducted, it will be refunded.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">Review & pay</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>Your preferences</Text>
      <Card elevated style={{ marginTop: spacing.md }}>
        <PreviewRow label="Gender" value={GENDER_LABEL[answers.preferredGender] ?? answers.preferredGender} />
        <PreviewRow label="Age range" value={answers.preferredAgeRange} />
        <PreviewRow label="Country / background" value={formatCountry(answers.preferredCountry)} />
        <PreviewRow label="Style" value={STYLE_LABEL[answers.style] ?? answers.style} last />
      </Card>

      <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'flex-start' }}>
        <ShieldCheck size={16} color={color.secondary} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
          Your payment is processed securely. Generation only begins after your payment is verified - you are
          never charged again if generation needs to be retried.
        </Text>
      </Card>

      {error && (
        <Text variant="caption" tone="danger" style={{ marginTop: spacing.md }}>{error}</Text>
      )}

      <Button
        label="Pay and generate my sketch"
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
            setError(reason ?? 'Payment did not complete. Please try again.');
          }}
        />
      )}

      {verifying && (
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          Verifying your payment...
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
