import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import duckdb from 'duckdb';
import { afterAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..');
const SCHEMA_PATH = join(SRC, 'db', 'schema.sql');

/*
 * Staff exclusion is the difference between this console reporting the product
 * and reporting the two people who build it. Measured against production on
 * 2026-08-13: 3,502 of 3,869 events (90.5%) were superadmin, from 2 accounts,
 * and 24 of 24 lesson_segment_attempts were staff-owned.
 *
 * The mechanism is structural — the plain table names are staff-free VIEWS over
 * `*_raw` physical tables — precisely so that no future query has to remember a
 * filter. These tests defend both halves: that the views actually filter, and
 * that nothing analytical reaches around them.
 */

const tempDirs: string[] = [];
function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dataintel-staff-'));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function open(dir: string): duckdb.Database {
  return new duckdb.Database(join(dir, 'staff.db'));
}
function exec(db: duckdb.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => db.exec(sql, (err) => (err ? reject(err) : resolve())));
}
function all(db: duckdb.Database, sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows as Record<string, unknown>[]))));
}

const schemaSql = readFileSync(SCHEMA_PATH, 'utf-8');

const STAFF = '11111111-1111-4111-8111-111111111111';
const LEARNER = '22222222-2222-4222-8222-222222222222';

/** A superadmin who is ALSO a parent: their events stamp `parent`, not `superadmin`. */
const DUAL_ROLE_STAFF = '33333333-3333-4333-8333-333333333333';

async function seed(db: duckdb.Database): Promise<void> {
  await exec(
    db,
    `INSERT INTO dim_users_raw (user_id, role, is_staff, created_at, locale, xp_points, lessons_completed, streak_days, longest_streak) VALUES
       ('${STAFF}', 'superadmin', TRUE, '2026-01-01', 'en-US', 0, 0, 0, 0),
       ('${DUAL_ROLE_STAFF}', 'parent', TRUE, '2026-01-01', 'es-MX', 0, 0, 0, 0),
       ('${LEARNER}', 'universal', FALSE, '2026-01-01', 'es-MX', 10, 1, 1, 1)`,
  );
  await exec(
    db,
    `INSERT INTO fact_events_raw (event_id, occurred_at, user_id, anon_id, session_id, event_type, role, created_at) VALUES
       (1, '2026-08-01', '${STAFF}', NULL, NULL, 'page_view', 'superadmin', '2026-08-01'),
       (2, '2026-08-01', '${DUAL_ROLE_STAFF}', NULL, NULL, 'page_view', 'parent', '2026-08-01'),
       (3, '2026-08-01', '${LEARNER}', NULL, NULL, 'page_view', 'universal', '2026-08-01'),
       (4, '2026-08-01', NULL, '44444444-4444-4444-8444-444444444444', NULL, 'page_view', 'anon', '2026-08-01')`,
  );
  await exec(
    db,
    `INSERT INTO fact_segment_attempts_raw (attempt_id, user_id, lesson_id, segment_id, attempt_number, score, hints_used, created_at) VALUES
       ('55555555-5555-4555-8555-555555555555', '${STAFF}', '66666666-6666-4666-8666-666666666666', 's1', 1, 100, 0, '2026-08-01'),
       ('77777777-7777-4777-8777-777777777777', '${LEARNER}', '66666666-6666-4666-8666-666666666666', 's1', 1, 80, 1, '2026-08-01')`,
  );
}

describe('staff-free views', () => {
  it('keeps learners and anonymous traffic, drops staff', async () => {
    const db = open(scratch());
    await exec(db, schemaSql);
    await seed(db);

    const events = await all(db, 'SELECT event_id FROM fact_events ORDER BY event_id');
    // 3 = the learner, 4 = anonymous acquisition (cannot be staff-attributed).
    expect(events.map((r) => Number(r.event_id))).toEqual([3, 4]);

    const raw = await all(db, 'SELECT COUNT(*) AS n FROM fact_events_raw');
    expect(Number(raw[0]?.n)).toBe(4); // nothing is deleted, only hidden
  });

  it('catches a staff member whose events stamp a non-staff role', async () => {
    const db = open(scratch());
    await exec(db, schemaSql);
    await seed(db);
    // Event 2 stamps `parent` because Core stamps the highest-priority role.
    // Filtering the stamp alone would file this superadmin under parents.
    const rows = await all(db, `SELECT event_id FROM fact_events WHERE user_id = '${DUAL_ROLE_STAFF}'`);
    expect(rows).toHaveLength(0);
  });

  it('excludes staff from segment attempts, the pedagogical evidence base', async () => {
    const db = open(scratch());
    await exec(db, schemaSql);
    await seed(db);
    const rows = await all(db, 'SELECT user_id FROM fact_segment_attempts');
    expect(rows).toHaveLength(1);
    expect(String(rows[0]?.user_id)).toBe(LEARNER);
  });

  it('excludes staff from the user dimension', async () => {
    const db = open(scratch());
    await exec(db, schemaSql);
    await seed(db);
    const rows = await all(db, 'SELECT user_id FROM dim_users');
    expect(rows.map((r) => String(r.user_id))).toEqual([LEARNER]);
  });
});

describe('warehouse migration from a pre-filter deployment', () => {
  it('renames the populated tables and preserves every row', async () => {
    const dir = scratch();
    const db = open(dir);

    // A warehouse as it exists in production today: plain names, real data.
    await exec(
      db,
      `CREATE TABLE fact_events (
         event_id BIGINT PRIMARY KEY, client_event_id UUID, event_version SMALLINT, occurred_at TIMESTAMP,
         user_id UUID, anon_id UUID, session_id UUID, lesson_id UUID, course_id UUID, segment_id VARCHAR,
         experiment_id UUID, experiment_variant VARCHAR, event_type VARCHAR NOT NULL, role VARCHAR,
         route_class VARCHAR, device VARCHAR, locale VARCHAR, referrer_class VARCHAR, ordinal INTEGER,
         value DOUBLE, created_at TIMESTAMP NOT NULL, ingested_at TIMESTAMP);
       INSERT INTO fact_events (event_id, event_type, role, user_id, created_at)
         VALUES (1, 'page_view', 'superadmin', '${STAFF}', '2026-08-01'), (2, 'page_view', 'universal', '${LEARNER}', '2026-08-01');`,
    );

    const tables = await all(db, 'SELECT table_name FROM duckdb_tables()');
    const existing = new Set(tables.map((t) => String(t.table_name)));
    for (const name of ['fact_events', 'fact_segment_attempts', 'dim_sessions', 'dim_users']) {
      if (existing.has(name) && !existing.has(`${name}_raw`)) {
        await exec(db, `ALTER TABLE ${name} RENAME TO ${name}_raw`);
      }
    }
    await exec(db, schemaSql);

    // Both rows survived the rename; the view hides the staff one.
    expect(Number((await all(db, 'SELECT COUNT(*) AS n FROM fact_events_raw'))[0]?.n)).toBe(2);
    const visible = await all(db, 'SELECT event_id FROM fact_events');
    expect(visible.map((r) => Number(r.event_id))).toEqual([2]);
  });
});

describe('no analytical query reaches around the views', () => {
  /*
   * Files allowed to touch the physical tables: the writer, the migration, and
   * the one deliberate staff-inspection service that exists so the console can
   * DISCLOSE how much it filtered (services/staffAudit.ts). Anything else
   * reading a *_raw table is a metric quietly counting the platform team.
   */
  const ALLOWED = new Set(['db/sync.ts', 'db/duckdb.ts', 'services/staffAudit.ts']);

  function sourceFiles(dir: string, prefix = ''): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        return entry === '__tests__' ? [] : sourceFiles(full, rel);
      }
      return entry.endsWith('.ts') && !entry.endsWith('.test.ts') ? [rel] : [];
    });
  }

  it('fails the build if a service or query file selects from a *_raw table', () => {
    const offenders: string[] = [];
    for (const rel of sourceFiles(SRC)) {
      if (ALLOWED.has(rel)) continue;
      const text = readFileSync(join(SRC, rel), 'utf-8');
      // Deliberate staff inspection must go through the documented diagnostic
      // endpoint, which lives in the allowed writer/migration files above.
      if (/\b(fact_events_raw|fact_segment_attempts_raw|dim_sessions_raw|dim_users_raw)\b/.test(text)) {
        offenders.push(rel);
      }
    }
    expect(offenders, `these files bypass the staff-free views: ${offenders.join(', ')}`).toEqual([]);
  });

  it('keeps the views defined in the schema', () => {
    for (const view of ['fact_events', 'fact_segment_attempts', 'dim_sessions', 'dim_users']) {
      expect(schemaSql).toContain(`CREATE OR REPLACE VIEW ${view} AS`);
    }
  });
});
