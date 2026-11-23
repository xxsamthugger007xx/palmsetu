import { db } from './db';

/**
 * Drop-in replacement for `new Map<K, V>()` backed by a SQLite kv_<table>.
 * Keeps the exact Map call surface (get/set/has/delete/clear/size/keys/
 * values/entries/forEach/Symbol.iterator) that the existing route files
 * already use, so call sites across the ~10 route files need no changes.
 * Reads and writes go straight to SQLite (better-sqlite3 is synchronous),
 * with no separate in-memory cache, so there is exactly one source of
 * truth and no risk of drift between a cache and the DB file on disk.
 *
 * `userId`/`createdAt` extractors are optional hooks used only to
 * denormalize those two columns for indexed queries elsewhere; the full
 * value is always the JSON-serialized V.
 */
export class SqliteMap<K extends string, V> {
  private table: string;
  private getUserId: (v: V) => string | null;
  private getCreatedAt: (v: V) => string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hasUserIndex: boolean;
  private stmts: Record<'get' | 'set' | 'del' | 'clear' | 'all' | 'count' | 'byUser', any>;

  constructor(
    table: string,
    opts?: { userId?: (v: V) => string | null | undefined; createdAt?: (v: V) => string | null | undefined },
  ) {
    this.table = `kv_${table}`;
    this.getUserId = (v) => opts?.userId?.(v) ?? null;
    this.getCreatedAt = (v) => opts?.createdAt?.(v) ?? null;
    this.hasUserIndex = !!opts?.userId;
    this.stmts = {
      get: db.prepare(`SELECT value FROM ${this.table} WHERE key = ?`),
      set: db.prepare(
        `INSERT INTO ${this.table} (key, value, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, userId = excluded.userId, createdAt = excluded.createdAt, updatedAt = excluded.updatedAt`,
      ),
      del: db.prepare(`DELETE FROM ${this.table} WHERE key = ?`),
      clear: db.prepare(`DELETE FROM ${this.table}`),
      all: db.prepare(`SELECT key, value FROM ${this.table}`),
      count: db.prepare(`SELECT COUNT(*) as c FROM ${this.table}`),
      byUser: db.prepare(`SELECT value FROM ${this.table} WHERE userId = ?`),
    };
    if (this.hasUserIndex) this.backfillUserIds();
  }

  /** Rows written before this map had a userId extractor have a NULL userId column and would be invisible to
   * valuesForUser(); fill them in once at startup using the same extractor that set() uses. */
  private backfillUserIds(): void {
    const nulls = db.prepare(`SELECT key, value FROM ${this.table} WHERE userId IS NULL`).all() as { key: string; value: string }[];
    if (nulls.length === 0) return;
    const upd = db.prepare(`UPDATE ${this.table} SET userId = ? WHERE key = ?`);
    db.transaction(() => {
      for (const r of nulls) {
        const uid = this.getUserId(JSON.parse(r.value) as V);
        if (uid) upd.run(uid, r.key);
      }
    })();
  }

  /** First value whose JSON field equals `value` (SQL-side filter, case-insensitive for strings), using an
   * expression index created on first use - avoids parsing every row in JS (e.g. account lookup by email). */
  findOneByField(field: string, value: string): V | undefined {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) throw new Error('invalid field name');
    const expr = `lower(json_extract(value, '$.${field}'))`;
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${this.table}_${field} ON ${this.table}(${expr})`);
    const row = db.prepare(`SELECT value FROM ${this.table} WHERE ${expr} = lower(?) LIMIT 1`).get(value) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as V) : undefined;
  }

  /** All values belonging to one user, via the indexed userId column (no full-table scan). Falls back to a
   * filtered scan for maps constructed without a userId extractor. */
  valuesForUser(userId: string): V[] {
    if (!this.hasUserIndex) return this.values().filter((v) => (v as any)?.userId === userId);
    return (this.stmts.byUser.all(userId) as { value: string }[]).map((r) => JSON.parse(r.value) as V);
  }

  /**
   * Returns the stored value wrapped in a Proxy whose `set`/`deleteProperty`
   * traps write the whole object straight back to SQLite. This matters
   * because the old in-memory Maps stored object *references*, so a lot of
   * existing route code does `const reading = readingsById.get(id); reading.status
   * = 'done';` and relies on that mutation being visible on the next `.get()`
   * without ever calling `.set()` again. A plain JSON.parse() per `.get()`
   * would silently break every one of those call sites (the mutation would
   * be lost). The Proxy keeps that exact call pattern working unchanged.
   * Known limitation: this only traps top-level property writes, not
   * mutations nested inside an array/object field (e.g. `reading.draws.push(x)`
   * without also reassigning `reading.draws`) - none of the existing call
   * sites do that (verified by inspection), but new code should prefer an
   * explicit `.set()` after any nested mutation to be safe.
   */
  get(key: K): V | undefined {
    const row = this.stmts.get.get(key) as { value: string } | undefined;
    if (!row) return undefined;
    const value = JSON.parse(row.value) as V;
    const persist = () => this.set(key, value);
    return new Proxy(value as object, {
      set(target, prop, val) {
        (target as any)[prop] = val;
        persist();
        return true;
      },
      deleteProperty(target, prop) {
        delete (target as any)[prop];
        persist();
        return true;
      },
    }) as V;
  }

  set(key: K, value: V): this {
    this.stmts.set.run(key, JSON.stringify(value), this.getUserId(value), this.getCreatedAt(value));
    return this;
  }

  has(key: K): boolean {
    return this.stmts.get.get(key) !== undefined;
  }

  delete(key: K): boolean {
    const res = this.stmts.del.run(key);
    return res.changes > 0;
  }

  clear(): void {
    this.stmts.clear.run();
  }

  get size(): number {
    return (this.stmts.count.get() as { c: number }).c;
  }

  private rows(): { key: string; value: string }[] {
    return this.stmts.all.all() as { key: string; value: string }[];
  }

  keys(): K[] {
    return this.rows().map((r) => r.key as K);
  }

  values(): V[] {
    return this.rows().map((r) => JSON.parse(r.value) as V);
  }

  entries(): [K, V][] {
    return this.rows().map((r) => [r.key as K, JSON.parse(r.value) as V]);
  }

  forEach(fn: (value: V, key: K) => void): void {
    for (const [k, v] of this.entries()) fn(v, k);
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries()[Symbol.iterator]();
  }
}

/**
 * Drop-in-ish replacement for a plain append-only array (transactions,
 * assistantUsageLog, adminAuditLog, moodCheckIns): a real in-process array,
 * preloaded from SQLite on startup, whose `.push` is overridden to also
 * persist each row to a log_<table> table. All read-only Array methods
 * (.filter/.slice/.sort/spread/length/...) keep working unmodified because
 * this genuinely is an Array instance, not a lookalike.
 */
export function persistentArray<T extends { id: string; userId?: string; createdAt: string }>(
  table: string,
  opts?: { maxInMemory?: number },
): T[] {
  const logTable = `log_${table}`;
  const max = opts?.maxInMemory;
  // High-volume logs only keep the newest `maxInMemory` rows in the process (every row stays in SQLite), so
  // memory and startup time stay flat as the log grows. Without a cap the whole table is loaded.
  const rows = (max
    ? db.prepare(`SELECT value FROM (SELECT value, createdAt FROM ${logTable} ORDER BY createdAt DESC LIMIT ?) ORDER BY createdAt ASC`).all(max)
    : db.prepare(`SELECT value FROM ${logTable} ORDER BY createdAt ASC`).all()) as { value: string }[];
  const arr: T[] = rows.map((r) => JSON.parse(r.value) as T);
  const insert = db.prepare(`INSERT OR REPLACE INTO ${logTable} (id, value, userId, createdAt) VALUES (?, ?, ?, ?)`);

  const originalPush = Array.prototype.push.bind(arr);
  arr.push = (...items: T[]) => {
    for (const item of items) {
      insert.run(item.id, JSON.stringify(item), item.userId ?? null, item.createdAt);
    }
    const len = originalPush(...items);
    if (max && arr.length > max * 1.25) arr.splice(0, arr.length - max); // trim in batches, not on every push
    return len;
  };
  return arr;
}
