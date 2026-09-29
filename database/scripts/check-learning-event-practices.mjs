// check-learning-event-practices.mjs — OD-9 section 4.2 as a gate, not a promise.
//
// OD-9 4.2 / S10.3a: every analytics event class the rebuild introduced
// applies to a migrated child only with its specific, live consent. On
// learning_events that is enforced by one BEFORE INSERT trigger,
// public.enforce_learning_event_practice(), which maps an event to a data
// practice and skips the row when the practice does not apply. An event with
// no mapping is inserted unconditionally.
//
// That is how 0246 shipped three events (approach_choice, enrichment_offer,
// enrichment_open) that its header called "consent-gated like path_choice"
// while the trigger never gated them (fixed in the autonomy_events_practice_gate
// migration, GAP-FIX-R6). Nothing compared the CHECK list with the mapping.
// This does:
//
//   1. every learning_events value the rebuild added (the latest CHECK minus
//      the last pre-rebuild CHECK, before 0131) has a practice in the latest
//      enforce_learning_event_practice(), unless EXEMPT names why not;
//   2. every event the function maps is still a declared value (a stale
//      mapping hides a rename);
//   3. every practice it maps to is a registered data_practices key.
//
// The last definition of each wins, exactly as PostgreSQL applies them.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The first rebuild-era migration that widened the learning_events CHECK. */
export const REBUILD_FROM = 131;

/** Rebuild-era values deliberately outside the gate, each with its reason. */
export const EXEMPT = {
  parent_signup_completed: 'adult-only parent event (0224); a Tutor account is never a migrated child',
  parent_first_value: 'adult-only parent event (0224); a Tutor account is never a migrated child',
};

const quoted = (text) => [...text.matchAll(/'([^']+)'/g)].map((m) => m[1]);

/** The value list of a learning_events_event_check CHECK in one file, or null. */
export function checkValues(sql) {
  const re = /ADD\s+CONSTRAINT\s+learning_events_event_check\s+CHECK\s*\(\s*event\s+IN\s*\(([\s\S]*?)\)\s*\)/gi;
  let last = null;
  for (const m of sql.matchAll(re)) last = quoted(m[1]);
  return last;
}

/** event -> practice from the last enforce_learning_event_practice() body in one file, or null. */
export function practiceMap(sql) {
  const re = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_learning_event_practice\(\)[\s\S]*?AS\s+\$\$([\s\S]*?)\$\$/gi;
  let body = null;
  for (const m of sql.matchAll(re)) body = m[1];
  if (body === null) return null;
  const map = {};
  for (const m of body.matchAll(/WHEN\s+NEW\.event\s+(?:IN\s*\(([\s\S]*?)\)|=\s*'([^']+)')\s*THEN\s*'([^']+)'/gi)) {
    const events = m[1] !== undefined ? quoted(m[1]) : [m[2]];
    for (const event of events) map[event] = m[3];
  }
  return map;
}

/** Keys inserted into public.data_practices anywhere in the migrations. */
export function registeredPractices(migrations) {
  const keys = new Set();
  for (const { sql } of migrations) {
    for (const stmt of sql.matchAll(/INSERT\s+INTO\s+public\.data_practices\b[\s\S]*?;/gi)) {
      for (const m of stmt[0].matchAll(/\(\s*'([a-z_]+\.[a-z_]+)'\s*,/g)) keys.add(m[1]);
    }
  }
  return keys;
}

const number = (name) => Number.parseInt(name, 10);

/** Returns failure messages; an empty list passes. `migrations` is [{ name, sql }] in apply order. */
export function checkLearningEventPractices(migrations) {
  let latest = null;
  let baseline = null;
  let map = null;
  for (const { name, sql } of migrations) {
    const values = checkValues(sql);
    if (values) {
      latest = values;
      if (number(name) < REBUILD_FROM) baseline = values;
    }
    const mapped = practiceMap(sql);
    if (mapped) map = mapped;
  }
  const failures = [];
  if (!latest) return ['no learning_events_event_check CHECK found in the migrations'];
  if (!map) return ['no public.enforce_learning_event_practice() definition found in the migrations'];
  const before = new Set(baseline ?? []);
  const declared = new Set(latest);
  const registry = registeredPractices(migrations);

  for (const event of latest) {
    if (before.has(event) || event in EXEMPT) continue;
    if (!(event in map)) {
      failures.push(`learning_events '${event}' is a rebuild-era event class with no data practice in enforce_learning_event_practice() (OD-9 4.2: it would be recorded for a migrated child without specific consent)`);
    }
  }
  for (const [event, practice] of Object.entries(map)) {
    if (!declared.has(event)) failures.push(`enforce_learning_event_practice() maps '${event}', which is not a declared learning_events value`);
    if (!registry.has(practice)) failures.push(`enforce_learning_event_practice() maps '${event}' to '${practice}', which is not a registered data_practices key`);
  }
  for (const event of Object.keys(EXEMPT)) {
    if (event in map) failures.push(`'${event}' is exempt but also mapped; remove it from EXEMPT`);
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('../migrations', import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const migrations = files.map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
  const failures = checkLearningEventPractices(migrations);
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exitCode = 1;
  } else {
    const map = migrations.reduce((acc, { sql }) => practiceMap(sql) ?? acc, {});
    console.log(`learning-event-practices OK — every rebuild-era learning_events class is gated (${Object.keys(map).length} events mapped to registered data practices, ${Object.keys(EXEMPT).length} adult-only exempt)`);
  }
}
