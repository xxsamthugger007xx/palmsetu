import { randomUUID } from 'crypto';
import { errorsLastHour } from './alerts';
import { listEvents } from '../events/eventTracker';
import { getConfig, setConfig } from '../data/runtimeConfig';
import { SqliteMap } from '../data/sqliteCollections';

/**
 * Real, live-evaluated health checks (no fabricated numbers) plus a
 * durable, admin-managed incident log. This is intentionally NOT a
 * scheduled background job with its own notification pipeline (the
 * existing ALERT_WEBHOOK_URL path in ops/alerts.ts already pages on
 * server errors) - each check here is computed fresh every time the
 * admin panel's Alerts tab is opened, from real underlying data.
 */

export interface AlertThresholds {
  errorsPerHour: number;
  paymentFailureRatePercent: number;
  soulmateGenerationFailureRatePercent: number;
}

const THRESHOLDS_CONFIG_KEY = 'alertThresholds';

const DEFAULT_THRESHOLDS: AlertThresholds = {
  errorsPerHour: 20,
  paymentFailureRatePercent: 25,
  soulmateGenerationFailureRatePercent: 30,
};

export function getAlertThresholds(): AlertThresholds {
  return getConfig(THRESHOLDS_CONFIG_KEY, DEFAULT_THRESHOLDS);
}

export function setAlertThresholds(overrides: Partial<AlertThresholds>): AlertThresholds {
  const merged = { ...getAlertThresholds(), ...overrides };
  return setConfig(THRESHOLDS_CONFIG_KEY, merged);
}

export interface AlertCheck {
  key: string;
  label: string;
  firing: boolean;
  value: number;
  threshold: number;
  unit: string;
  detail: string;
}

/** Evaluates every known check against the last 24h of real event data (except the hourly error rate, which
 * is a true rolling hour - see ops/alerts.ts). Returns both firing and healthy checks, so the tab can show the
 * full picture, not just problems. */
export function evaluateAlerts(): AlertCheck[] {
  const thresholds = getAlertThresholds();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const paymentEvents = listEvents({ feature: 'subscription', since }, 1, 10_000).entries
    .concat(listEvents({ feature: 'soulmate', since }, 1, 10_000).entries)
    .filter((e) => e.eventType === 'PURCHASE_SUCCESS' || e.eventType === 'PAYMENT_FAILED');
  const paymentFailures = paymentEvents.filter((e) => e.eventType === 'PAYMENT_FAILED').length;
  const paymentFailureRate = paymentEvents.length ? (paymentFailures / paymentEvents.length) * 100 : 0;

  const soulmateGenEvents = listEvents({ feature: 'soulmate', since }, 1, 10_000).entries
    .filter((e) => e.eventType === 'generation_completed' || e.eventType === 'generation_failed');
  const soulmateFailures = soulmateGenEvents.filter((e) => e.eventType === 'generation_failed').length;
  const soulmateFailureRate = soulmateGenEvents.length ? (soulmateFailures / soulmateGenEvents.length) * 100 : 0;

  const errHour = errorsLastHour();

  return [
    {
      key: 'errorsPerHour',
      label: 'Server errors (last hour)',
      firing: errHour > thresholds.errorsPerHour,
      value: errHour,
      threshold: thresholds.errorsPerHour,
      unit: 'errors/hr',
      detail: `${errHour} server error(s) logged in the last rolling hour.`,
    },
    {
      key: 'paymentFailureRate',
      label: 'Payment failure rate (24h)',
      firing: paymentEvents.length >= 3 && paymentFailureRate > thresholds.paymentFailureRatePercent,
      value: Math.round(paymentFailureRate * 10) / 10,
      threshold: thresholds.paymentFailureRatePercent,
      unit: '%',
      detail: `${paymentFailures} of ${paymentEvents.length} payment attempt(s) in the last 24h failed.`,
    },
    {
      key: 'soulmateGenerationFailureRate',
      label: 'Soulmate generation failure rate (24h)',
      firing: soulmateGenEvents.length >= 3 && soulmateFailureRate > thresholds.soulmateGenerationFailureRatePercent,
      value: Math.round(soulmateFailureRate * 10) / 10,
      threshold: thresholds.soulmateGenerationFailureRatePercent,
      unit: '%',
      detail: `${soulmateFailures} of ${soulmateGenEvents.length} sketch generation(s) in the last 24h failed.`,
    },
  ];
}

// --- Incidents (durable, manually opened/resolved by an admin) --------------

export interface Incident {
  id: string;
  alertKey: string;
  label: string;
  openedAt: string;
  openedBy: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  note: string;
}

const incidents = new SqliteMap<string, Incident>('incidents');

export function listIncidents(): Incident[] {
  return incidents.values().sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export function openIncident(alertKey: string, label: string, openedBy: string, note: string): Incident {
  const incident: Incident = {
    id: randomUUID(),
    alertKey,
    label,
    openedAt: new Date().toISOString(),
    openedBy,
    resolvedAt: null,
    resolvedBy: null,
    note,
  };
  incidents.set(incident.id, incident);
  return incident;
}

export function resolveIncident(id: string, resolvedBy: string, note?: string): Incident | null {
  const incident = incidents.get(id);
  if (!incident) return null;
  const updated: Incident = {
    ...incident,
    resolvedAt: new Date().toISOString(),
    resolvedBy,
    note: note ? `${incident.note}\n---\nResolution: ${note}` : incident.note,
  };
  incidents.set(id, updated);
  return updated;
}
