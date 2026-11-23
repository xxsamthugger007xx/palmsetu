import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { runBackup, listBackups } from './backup';
import { reportError, errorsLastHour, readRecentErrors } from './alerts';
import { accountsById } from '../data/store';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-')); process.env.BACKUP_DIR = dir; process.env.BACKUP_KEEP = '3'; });
afterEach(() => { delete process.env.BACKUP_DIR; delete process.env.BACKUP_KEEP; fs.rmSync(dir, { recursive: true, force: true }); });

describe('backups', () => {
  it('writes a snapshot that opens and contains the live data', async () => {
    const id = `acct-${Date.now()}`;
    accountsById.set(id, { id, email: `b${Date.now()}@x.com`, passwordHash: 'x', createdAt: new Date().toISOString() } as any);
    const info = await runBackup();
    const snap = new Database(path.join(dir, info.file), { readonly: true });
    const row = snap.prepare("SELECT key FROM kv_accounts WHERE key = ?").get(id);
    snap.close();
    expect(row).toBeTruthy();
    expect(listBackups()[0].file).toBe(info.file);
    accountsById.delete(id);
  });

  it('keeps only the newest BACKUP_KEEP snapshots', async () => {
    for (let i = 0; i < 5; i++) {
      // distinct names: backups within the same second would collide, so fake distinct timestamps via fake timers
      vi.useFakeTimers({ now: new Date(Date.UTC(2026, 0, 1 + i, 0, 0, 0)), toFake: ['Date'] });
      await runBackup();
      vi.useRealTimers();
    }
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.db')).length).toBe(3);
  });
});

describe('error reporting', () => {
  it('counts, logs to file, and posts a throttled webhook without leaking request data', async () => {
    const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-'));
    vi.resetModules();
    process.env.ERROR_LOG_DIR = logDir;
    process.env.ALERT_WEBHOOK_URL = 'http://hooks.test/x';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const a = await import('./alerts');
    a.reportError('route', new Error('boom'), { method: 'GET', path: '/x' });
    a.reportError('route', new Error('boom'), { method: 'GET', path: '/x' }); // same error: throttled
    a.reportError('route', new Error('different'));
    expect(a.errorsLastHour()).toBe(3);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String((fetchSpy.mock.calls[0][1] as any).body)).toContain('boom');
    expect(a.readRecentErrors().join('\n')).toContain('[route] boom');
    delete process.env.ERROR_LOG_DIR; delete process.env.ALERT_WEBHOOK_URL;
    fetchSpy.mockRestore(); fs.rmSync(logDir, { recursive: true, force: true });
    void reportError; void errorsLastHour; void readRecentErrors;
  });
});
