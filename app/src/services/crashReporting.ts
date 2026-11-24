import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** True when a Sentry project is configured for this build. Without a DSN everything here is a no-op. */
export const crashReportingEnabled = Boolean(DSN);

/**
 * Starts crash reporting. Privacy by design: no personal data is attached (`sendDefaultPii` off), screenshots and
 * view hierarchy are not captured, and request bodies/headers (which can hold birth details or tokens) are stripped
 * before anything leaves the phone.
 */
export function initCrashReporting() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
    enabled: !__DEV__,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0.05,
    beforeSend(event) {
      if (event.request) { delete event.request.data; delete event.request.headers; delete event.request.cookies; }
      if (event.user) event.user = { id: event.user.id }; // keep at most an anonymous id
      return event;
    },
  });
}

/** Ties crashes to an anonymous account id (never an email) so one person's repeated crash is easy to spot. */
export function setCrashUser(id: string | null) {
  if (!DSN) return;
  Sentry.setUser(id ? { id } : null);
}

/** Report a handled error (for example a failed save the user was told about). */
export function reportHandledError(err: unknown) {
  if (DSN) Sentry.captureException(err);
}

export const wrapWithCrashReporting = <T extends React.ComponentType<any>>(Component: T): T =>
  (DSN ? (Sentry.wrap(Component) as unknown as T) : Component);
