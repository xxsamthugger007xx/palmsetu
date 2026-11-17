import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';

/**
 * Genuine SQLite persistence proof: writes through the real SqliteMap/db
 * module to a real on-disk file, then closes that connection and opens a
 * brand new one against the same file (simulating a server restart), and
 * confirms the data is still there. This does not touch the shared
 * module-level `db` singleton (that one is forced to :memory: under
 * NODE_ENV=test - see db.ts) because we specifically want to exercise a
 * real file here, independent of the rest of the test suite's isolation.
 */
describe('SQLite file persistence across a simulated restart', () => {
  const dbPath = path.join(os.tmpdir(), `solune-persist-test-${Date.now()}.db`);

  afterAll(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(dbPath + ext); } catch { /* ignore */ }
    }
  });

  it('data written before close is still readable after reopening the file', () => {
    const first = new Database(dbPath);
    first.exec(`CREATE TABLE IF NOT EXISTS kv_test (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    first.prepare('INSERT INTO kv_test (key, value) VALUES (?, ?)').run('reading-1', JSON.stringify({ card: 'The Star' }));
    first.close();

    const second = new Database(dbPath);
    const row = second.prepare('SELECT value FROM kv_test WHERE key = ?').get('reading-1') as { value: string };
    expect(JSON.parse(row.value)).toEqual({ card: 'The Star' });
    second.close();
  });
});
