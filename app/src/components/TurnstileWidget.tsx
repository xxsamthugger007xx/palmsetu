import React, { useRef, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Text } from './Text';
import { color, radius, spacing } from '../theme/tokens';

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile has no native RN SDK - it is a browser widget, so
 * this renders it inside a WebView loading a minimal local HTML page and
 * listens for the resulting token via window.ReactNativeWebView.postMessage.
 * If EXPO_PUBLIC_TURNSTILE_SITE_KEY is not configured, this renders nothing
 * and reports a null token immediately - the signup/login screen still
 * works (the server skips verification in that case too, see
 * server/src/auth/turnstile.ts), it just has no bot-check in local dev.
 */
function buildHtml(siteKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; display: flex; align-items: center; justify-content: center; }
</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
<body>
<div class="cf-turnstile"
  data-sitekey="${siteKey}"
  data-theme="dark"
  data-callback="onTurnstileSuccess"
  data-error-callback="onTurnstileError"
  data-expired-callback="onTurnstileExpired"
></div>
<script>
  function onTurnstileSuccess(token) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', token }));
  }
  function onTurnstileError() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error' }));
  }
  function onTurnstileExpired() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'expired' }));
  }
</script>
</body>
</html>`;
}

export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!SITE_KEY) return null;

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'success') onToken(msg.token);
      else if (msg.type === 'error') { setFailed(true); onToken(null); }
      else if (msg.type === 'expired') onToken(null);
    } catch {
      // Ignore unparseable messages rather than crashing the form.
    }
  };

  return (
    <View style={styles.wrap}>
      {!loaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={color.accent} />
        </View>
      )}
      {failed ? (
        <Text variant="caption" tone="danger" style={{ padding: spacing.sm }}>
          Verification widget failed to load. Please check your connection and try again.
        </Text>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html: buildHtml(SITE_KEY) }}
          onMessage={handleMessage}
          onLoadEnd={() => setLoaded(true)}
          style={styles.webview}
          scrollEnabled={false}
          javaScriptEnabled
          backgroundColor="transparent"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surfaceElevated,
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
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
