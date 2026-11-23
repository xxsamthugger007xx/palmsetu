import fs from 'fs';
import path from 'path';

/**
 * Minimal error reporting with no extra dependency: every reported error goes to the console, to a size-capped
 * log file (server/data/logs/errors.log), and - if ALERT_WEBHOOK_URL is set (Slack/Discord/any JSON webhook that
 * accepts {"text": "..."} / {"content": "..."}) - to that webhook, throttled so an error storm sends one
 * message per distinct error per minute. Only the message, a short stack and caller-supplied context are sent:
 * never request bodies, tokens or user content.
 */
const LOG_DIR = process.env.ERROR_LOG_DIR || path.join(__dirname, '..', '..', 'data', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'errors.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const THROTTLE_MS = 60_000;

const lastSent = new Map<string, number>();
let recentCount = 0;
let windowStart = Date.now();

function appendLog(line: string): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    /* never let logging break the app */
  }
}

async function postWebhook(text: string): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(5000) });
  } catch {
    /* alert delivery is best-effort */
  }
}

export function reportError(source: string, err: unknown, context?: Record<string, string | number | undefined>): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const ctx = context ? ' ' + JSON.stringify(context) : '';
  const stack = (e.stack ?? '').split('\n').slice(0, 4).join(' | ');
  const line = `${new Date().toISOString()} [${source}] ${e.message}${ctx} :: ${stack}`;
  console.error(`[solune] ${source}: ${e.message}${ctx}`);
  appendLog(line);

  if (Date.now() - windowStart > 3_600_000) { windowStart = Date.now(); recentCount = 0; }
  recentCount += 1;

  const key = `${source}:${e.message}`;
  const now = Date.now();
  if ((lastSent.get(key) ?? 0) + THROTTLE_MS < now) {
    lastSent.set(key, now);
    if (lastSent.size > 500) lastSent.clear();
    void postWebhook(`Palm Setu server error [${source}] ${e.message}${ctx}`);
  }
}

/** Errors reported since the process started the current hour-window (for the admin ops status). */
export function errorsLastHour(): number {
  return Date.now() - windowStart > 3_600_000 ? 0 : recentCount;
}

export function readRecentErrors(maxLines = 20): string[] {
  try {
    return fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').slice(-maxLines);
  } catch {
    return [];
  }
}
