import React, { useState } from 'react';
import { Modal, StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { Text } from './Text';
import { IconButton } from './Button';
import { color, spacing } from '../theme/tokens';
import { useTranslation } from 'react-i18next';

export interface RazorpaySuccessResult {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/**
 * Razorpay has no SDK that works inside Expo Go (its React Native SDK is a
 * native module requiring a custom dev client build) - this app is tested
 * entirely through Expo Go, so real checkout runs through Razorpay's
 * hosted web Checkout.js instead, the same WebView-bridge pattern already
 * used for Cloudflare Turnstile (see TurnstileWidget.tsx). The HTML page
 * loads Razorpay's own script and opens its real checkout UI; the result
 * is posted back to React Native exactly as Razorpay's client-side success
 * handler receives it - this is still only a CLIENT-reported result, which
 * is why routes/soulmate.ts's verify-payment endpoint independently
 * re-verifies the signature server-side before trusting any of it.
 */
function buildHtml(params: { keyId: string; orderId: string; amountCents: number; currency: string; name: string }): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>html, body { margin: 0; padding: 0; background: #161826; }</style>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
<script>
  function post(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  var options = {
    key: "${params.keyId}",
    amount: "${params.amountCents}",
    currency: "${params.currency}",
    order_id: "${params.orderId}",
    name: "Palm Setu",
    description: "${params.name}",
    theme: { color: "#9184d9" },
    handler: function (response) {
      post({
        type: 'success',
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      });
    },
    modal: {
      ondismiss: function () { post({ type: 'dismissed' }); },
    },
  };
  try {
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      post({ type: 'failed', reason: resp.error && resp.error.description });
    });
    rzp.open();
  } catch (e) {
    post({ type: 'error', reason: String(e) });
  }
</script>
</body>
</html>`;
}

export function RazorpayCheckoutModal({
  visible,
  keyId,
  orderId,
  amountCents,
  currency,
  onSuccess,
  onDismiss,
  onFailed,
}: {
  visible: boolean;
  keyId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  onSuccess: (result: RazorpaySuccessResult) => void;
  onDismiss: () => void;
  onFailed: (reason: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'success') {
        onSuccess({ razorpayOrderId: msg.razorpayOrderId, razorpayPaymentId: msg.razorpayPaymentId, razorpaySignature: msg.razorpaySignature });
      } else if (msg.type === 'dismissed') {
        onDismiss();
      } else if (msg.type === 'failed' || msg.type === 'error') {
        onFailed(msg.reason);
      }
    } catch {
      // Ignore unparseable messages rather than crashing the checkout flow.
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.header}>
        <Text variant="bodySm" weight="semibold">{t('ui.RazorpayCheckoutModal.secureCheckout')}</Text>
        <IconButton icon={X} onPress={onDismiss} />
      </View>
      <View style={styles.webviewWrap}>
        {!loaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={color.accent} />
          </View>
        )}
        <WebView
          originWhitelist={['*']}
          source={{ html: buildHtml({ keyId, orderId, amountCents, currency, name: 'Soulmate Sketch' }) }}
          onMessage={handleMessage}
          onLoadEnd={() => setLoaded(true)}
          javaScriptEnabled
          style={styles.webview}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.sm,
    backgroundColor: color.bg,
  },
  webviewWrap: {
    flex: 1,
    backgroundColor: color.bg,
  },
  webview: {
    flex: 1,
    backgroundColor: color.bg,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
