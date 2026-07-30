import duckdb from 'duckdb';
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
    db = new duckdb.Database(config.DUCKDB_PATH);
  }
  return db;
}

export function isReady(): boolean {
  return ready;
}

export async function initDb(): Promise<void> {
  const database = getDb();

  await new Promise<void>((resolve, reject) => {
    database.exec('SELECT 1', (err: Error | null) => {
      if (err) return reject(err);
      resolve();
    });
  });

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
