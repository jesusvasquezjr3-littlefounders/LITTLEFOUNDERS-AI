import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import duckdb from 'duckdb';
import { afterAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(here, '..', 'db', 'schema.sql');

/**
 * Production incident 2026-08-09. The warehouse lives on a Railway volume that
 * survives every deploy, and every CREATE TABLE in schema.sql is
 * `IF NOT EXISTS` — so a column added to one of those definitions is silently
 * NOT created on an existing warehouse: the whole CREATE is skipped. The break
 * then surfaces far from its cause, as a Binder Error on the first statement
 * touching the missing column, which `initDb` swallows as "non-fatal" — leaving
 * the service answering /health with duckdb down and sync permanently dead.
 *
 * This test reproduces exactly that: a pre-existing table missing the newer
 * columns, then schema.sql applied over it. It fails if the ALTER block stops
 * covering a column some later statement needs.
 */
function open(dir: string): duckdb.Database {
  return new duckdb.Database(join(dir, 'evolve.db'));
}

function exec(db: duckdb.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

function all(db: duckdb.Database, sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows as Record<string, unknown>[])));
  });
}

const tempDirs: string[] = [];
function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dataintel-schema-'));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe('schema.sql evolution', () => {
  const schemaSql = readFileSync(SCHEMA_PATH, 'utf-8');

  it('applies cleanly to a fresh warehouse', async () => {
    const db = open(scratch());
    await expect(exec(db, schemaSql)).resolves.toBeUndefined();
  });

  it('adds new columns to a warehouse whose tables predate them', async () => {
    const db = open(scratch());
    // The shape a deployed warehouse had before the learning-intelligence
    // columns landed — only the columns the ALTER block must fill in are absent.
    await exec(
      db,
      `CREATE TABLE fact_events (
         event_id BIGINT PRIMARY KEY,
         user_id UUID,
         session_id UUID,
         ordinal INTEGER,
         event_type VARCHAR,
         route_class VARCHAR,
         role VARCHAR,
         device VARCHAR,
         locale VARCHAR,
         created_at TIMESTAMP NOT NULL
       );
       CREATE TABLE dim_lessons (
         lesson_id UUID PRIMARY KEY,
         slug VARCHAR,
         course_id UUID,
         segment_count INTEGER
       );`,
    );

    await expect(exec(db, schemaSql)).resolves.toBeUndefined();

    const eventCols = (await all(
      db,
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'fact_events'`,
    )).map((r) => String(r.column_name));
    expect(eventCols).toEqual(
      expect.arrayContaining([
        'client_event_id',
        'event_version',
        'occurred_at',
        'course_id',
        'experiment_id',
        'experiment_variant',
      ]),
    );

    const lessonCols = (await all(
      db,
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'dim_lessons'`,
    )).map((r) => String(r.column_name));
    expect(lessonCols).toEqual(
      expect.arrayContaining(['course_slug', 'course_title_en', 'course_title_es', 'course_title_pt']),
    );
  });

  it('is idempotent — re-applying over an up-to-date warehouse is a no-op', async () => {
    const db = open(scratch());
    await exec(db, schemaSql);
    await expect(exec(db, schemaSql)).resolves.toBeUndefined();
  });
});
