import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { persistentArray } from '../data/sqliteCollections';

/**
 * Real request-level API monitoring - every request is timed and logged
 * here (method, normalized route pattern, status, duration), backing the
 * admin panel's API Monitoring tab (p50/p95/p99 latency, error rate per
 * endpoint). Kept as a capped in-memory + SQLite-backed log
 * (persistentArray, same pattern as transactions/adminAuditLog) rather
 * than a real APM/tracing service, which this app has none of.
 */
export interface ApiRequestLogEntry {
  id: string;
  method: string;
  routePath: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
  createdAt: string;
}

export const apiRequestLog: ApiRequestLogEntry[] = persistentArray<ApiRequestLogEntry>('apiRequests', { maxInMemory: 20000 });

/** Prefers the matched Express route pattern (e.g. "/users/:userId") over the literal path, so requests to
 * different ids for the same route aggregate together instead of fragmenting into one row per id. */
function routePatternFor(req: Request): string {
  const mountPath = req.baseUrl || '';
  const routePath = (req.route && req.route.path) || req.path.replace(mountPath, '') || req.path;
  return `${mountPath}${routePath}`.replace(/\/{2,}/g, '/') || req.path;
}

export function recordApiTiming(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  res.on('finish', () => {
    try {
      apiRequestLog.push({
        id: randomUUID(),
        method: req.method,
        routePath: routePatternFor(req),
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        userId: req.auth?.userId,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* monitoring itself must never break a real request */
    }
  });
  next();
}

export interface ApiEndpointStats {
  routePath: string;
  method: string;
  count: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number; // 5xx / count
  clientErrorRate: number; // 4xx / count
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export interface ApiMonitoringOverview {
  totalRequests: number;
  overallErrorRate: number;
  overallP95Ms: number;
  byEndpoint: ApiEndpointStats[];
}

export function getApiMonitoringOverview(since?: Date, until?: Date): ApiMonitoringOverview {
  const rows = apiRequestLog.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    if (since && t < since.getTime()) return false;
    if (until && t > until.getTime()) return false;
    return true;
  });

  const byKey = new Map<string, ApiRequestLogEntry[]>();
  for (const r of rows) {
    const key = `${r.method} ${r.routePath}`;
    const arr = byKey.get(key) ?? [];
    arr.push(r);
    byKey.set(key, arr);
  }

  const byEndpoint: ApiEndpointStats[] = [...byKey.entries()].map(([key, entries]) => {
    const [method, ...routeParts] = key.split(' ');
    const durations = entries.map((e) => e.durationMs).sort((a, b) => a - b);
    const errors5xx = entries.filter((e) => e.statusCode >= 500).length;
    const errors4xx = entries.filter((e) => e.statusCode >= 400 && e.statusCode < 500).length;
    return {
      routePath: routeParts.join(' '),
      method,
      count: entries.length,
      p50Ms: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      p99Ms: percentile(durations, 99),
      errorRate: entries.length ? errors5xx / entries.length : 0,
      clientErrorRate: entries.length ? errors4xx / entries.length : 0,
    };
  }).sort((a, b) => b.count - a.count);

  const allDurations = rows.map((r) => r.durationMs).sort((a, b) => a - b);
  const all5xx = rows.filter((r) => r.statusCode >= 500).length;

  return {
    totalRequests: rows.length,
    overallErrorRate: rows.length ? all5xx / rows.length : 0,
    overallP95Ms: percentile(allDurations, 95),
    byEndpoint,
  };
}
