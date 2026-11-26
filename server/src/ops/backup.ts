import fs from 'fs';
import path from 'path';
import { db } from '../data/db';
import { reportError } from './alerts';

/**
 * Automatic backups of the whole app state:
 * - the SQLite database, via SQLite's online backup API (safe while the server is writing, unlike copying the
 *   .db file, which can capture a half-written WAL state), and
 * - stored palm photos (data/palmImages), copied incrementally (only files not already in the backup).
 * Runs at startup if the newest backup is older than the interval, then on a timer. Keeps the newest
 * BACKUP_KEEP database snapshots. Failures are reported through ops/alerts (console + log + webhook).
 *
 * NOTE: backups on the same disk protect against corruption/mistakes, not disk loss. Point BACKUP_DIR at a
 * different volume or a synced folder (S3/Drive mount) for real disaster recovery.
 *
 * Restore: stop the server, copy a snapshot over data/solune.db (delete solune.db-wal/-shm), start the server.
 */
import { DATA_DIR } from '../config/dataDir';
const backupDir = () => process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups');
const keep = () => Math.max(1, Number(process.env.BACKUP_KEEP) || 14);
const intervalMs = () => Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS) || 24) * 3_600_000;
const SNAP = /^solune-(\d{8}-\d{6})\.db$/;

export interface BackupInfo { file: string; bytes: number; createdAt: string }

export function listBackups(): BackupInfo[] {
  try {
    return fs.readdirSync(backupDir())
      .filter((f) => SNAP.test(f))
      .map((f) => {
        const st = fs.statSync(path.join(backupDir(), f));
        return { file: f, bytes: st.size, createdAt: st.mtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function copyNewFiles(src: string, dest: string): number {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let copied = 0;
  for (const f of fs.readdirSync(src)) {
    const to = path.join(dest, f);
    if (!fs.existsSync(to) && fs.statSync(path.join(src, f)).isFile()) { fs.copyFileSync(path.join(src, f), to); copied++; }
  }
  return copied;
}

export async function runBackup(): Promise<BackupInfo> {
  fs.mkdirSync(backupDir(), { recursive: true });
  const file = `solune-${stamp()}.db`;
  const dest = path.join(backupDir(), file);
  await db.backup(dest);
  // Sanity-check the snapshot actually opens and has the schema before trusting it (and before pruning older ones).
  const Database = (await import('better-sqlite3')).default;
  const check = new Database(dest, { readonly: true });
  try {
    const tables = (check.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table'").get() as { c: number }).c;
    if (tables === 0) throw new Error('backup contains no tables');
  } finally {
    check.close();
    // Opening a WAL-mode snapshot can leave empty -wal/-shm sidecars next to it; the .db alone is the backup.
    for (const ext of ['-wal', '-shm']) fs.rmSync(dest + ext, { force: true });
  }
  copyNewFiles(path.join(DATA_DIR, 'palmImages'), path.join(backupDir(), 'palmImages'));
  for (const old of listBackups().slice(keep())) {
    for (const ext of ['', '-wal', '-shm']) fs.rmSync(path.join(backupDir(), old.file + ext), { force: true });
  }
  const st = fs.statSync(dest);
  console.log(`[solune] backup written: ${file} (${Math.round(st.size / 1024)} KB)`);
  return { file, bytes: st.size, createdAt: st.mtime.toISOString() };
}

async function safeRun(): Promise<void> {
  try { await runBackup(); } catch (err) { reportError('backup', err); }
}

export function startBackupScheduler(): void {
  if (process.env.NODE_ENV === 'test' || process.env.BACKUP_ENABLED === 'false') return;
  const newest = listBackups()[0];
  if (!newest || Date.now() - new Date(newest.createdAt).getTime() > intervalMs()) void safeRun();
  const timer = setInterval(() => {
    const n = listBackups()[0];
    if (!n || Date.now() - new Date(n.createdAt).getTime() > intervalMs() - 60_000) void safeRun();
  }, Math.min(intervalMs(), 3_600_000));
  timer.unref();
}
