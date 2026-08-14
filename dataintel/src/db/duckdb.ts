import duckdb from 'duckdb';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: duckdb.Database | null = null;
let ready = false;

export function getDb(): duckdb.Database {
  if (!db) {
    const config = getConfig();
    // The native driver does not create its parent directory and fails with
    // an opaque internal assertion ("dereference unique_ptr that is NULL")
    // rather than a clear ENOENT — hits every fresh checkout/environment
    // that hasn't manually created this folder yet, :memory: excepted.
    if (config.DUCKDB_PATH !== ':memory:') {
      mkdirSync(dirname(config.DUCKDB_PATH), { recursive: true });
    }
    db = new duckdb.Database(config.DUCKDB_PATH);
  }
  return db;
}

export function isReady(): boolean {
  return ready;
}

/**
 * Physical tables that schema.sql now defines with a `_raw` suffix, because
 * their plain names became staff-free views.
 */
const RENAMED_TABLES = ['fact_events', 'fact_segment_attempts', 'dim_sessions', 'dim_users'] as const;

/**
 * One-way rename of the pre-staff-filter warehouse, run BEFORE schema.sql.
 *
 * The warehouse lives on a Railway volume that survives every deploy, so an
 * existing deployment still holds `fact_events` as a TABLE full of data. It has
 * to become `fact_events_raw` before schema.sql can claim that name for a view
 * — and it has to happen without losing a row.
 *
 * Idempotent and order-safe:
 *  - renames only while the old name is still a TABLE and the `_raw` name is
 *    free, so a second run is a no-op,
 *  - does nothing at all on a fresh warehouse,
 *  - never drops anything.
 *
 * If the rename cannot happen, schema.sql's CREATE OR REPLACE VIEW hits a table
 * of the same name and FAILS LOUDLY. That is the intended outcome: silently
 * skipping it would leave the console serving staff-inflated numbers that look
 * exactly like clean ones.
 */
export async function migrateWarehouse(): Promise<string[]> {
  const database = getDb();
  const all = <T>(sql: string): Promise<T[]> =>
    new Promise((resolve, reject) => {
      database.all(sql, (err: Error | null, rows: unknown) => (err ? reject(err) : resolve(rows as T[])));
    });
  const run = (sql: string): Promise<void> =>
    new Promise((resolve, reject) => {
      database.exec(sql, (err: Error | null) => (err ? reject(err) : resolve()));
    });

  const tables = await all<{ table_name: string }>('SELECT table_name FROM duckdb_tables()');
  const existing = new Set(tables.map((t) => t.table_name));
  const renamed: string[] = [];

  for (const name of RENAMED_TABLES) {
    if (!existing.has(name) || existing.has(`${name}_raw`)) continue;

    /*
     * Indexes must go FIRST. DuckDB refuses to rename a table that anything
     * depends on ("Cannot alter entry ... because there are entries that
     * depend on it"), and a deployed warehouse has every idx_fact_events_*
     * from schema.sql attached to it. Dropping them is safe and cheap:
     * schema.sql recreates each one against the _raw table immediately
     * afterwards, in the same startup.
     *
     * This is what a real warehouse does and a freshly CREATE'd fixture does
     * not — the first attempt at this migration was tested against a table
     * with no indexes, passed, and then failed on the production volume.
     */
    const indexes = await all<{ index_name: string }>(
      `SELECT index_name FROM duckdb_indexes() WHERE table_name = '${name}'`,
    );
    for (const index of indexes) {
      await run(`DROP INDEX IF EXISTS ${index.index_name}`);
    }

    await run(`ALTER TABLE ${name} RENAME TO ${name}_raw`);
    renamed.push(name);
  }
  return renamed;
}

export async function initDb(): Promise<void> {
  const database = getDb();

  await new Promise<void>((resolve, reject) => {
    database.exec('SELECT 1', (err: Error | null) => {
      if (err) return reject(err);
      resolve();
    });
  });

  // Before the schema: a pre-staff-filter warehouse still owns the plain
  // table names that schema.sql now defines as views.
  const renamed = await migrateWarehouse();
  if (renamed.length > 0) {
    console.log(`[dataintel] warehouse migrated to staff-free views (renamed: ${renamed.join(', ')})`);
  }

  const schemaPath = join(__dirname, 'schema.sql');
  const schemaSql = await readFile(schemaPath, 'utf-8');

  const statements = schemaSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await new Promise<void>((resolve, reject) => {
      database.exec(stmt, (err: Error | null) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  ready = true;
}

export async function closeDb(): Promise<void> {
  if (!db) return;
  const database = db;
  db = null;
  ready = false;
  return new Promise<void>((resolve) => {
    database.close(() => {
      resolve();
    });
  });
}

export function query<T = Record<string, unknown>>(
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.all(sql, ...params, (err: Error | null, rows: unknown) => {
      if (err) return reject(err);
      resolve(rows as T[]);
    });
  });
}

export function execute(
  sql: string,
  ...params: unknown[]
): Promise<void> {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(sql, ...params, (err: Error | null) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function exec(sql: string): Promise<void> {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.exec(sql, (err: Error | null) => {
      if (err) return reject(err);
      resolve();
    });
  });
}
