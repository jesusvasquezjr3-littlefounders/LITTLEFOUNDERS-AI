// The OD-9 learning-event practice gate, run against known-bad inputs: a
// checker nobody has seen fail is not a control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLearningEventPractices, checkValues, practiceMap } from './check-learning-event-practices.mjs';

const check = (values) => `ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_event_check CHECK (event IN (
    ${values.map((v) => `'${v}'`).join(', ')}
  ));`;
const fn = (lines) => `CREATE OR REPLACE FUNCTION public.enforce_learning_event_practice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_practice text := CASE
        ${lines.join('\n        ')}
    END;
BEGIN
    RETURN NEW;
END;
$$;`;
const registry = `INSERT INTO public.data_practices (key, kind, summary) VALUES
    ('analytics.motivation_events', 'analytics_event_class', 'x'),
    ('analytics.engagement_heartbeats', 'analytics_event_class', 'y');`;

const base = [
  { name: '0072_old.sql', sql: check(['session_start', 'session_heartbeat']) },
  { name: '0186_registry.sql', sql: registry },
];
const gated = fn([
  "WHEN NEW.event IN ('path_choice', 'approach_choice') THEN 'analytics.motivation_events'",
  "WHEN NEW.event = 'session_heartbeat' THEN 'analytics.engagement_heartbeats'",
]);

test('reads the CHECK list and the CASE mapping', () => {
  assert.deepEqual(checkValues(check(['a', 'b'])), ['a', 'b']);
  assert.deepEqual(practiceMap(gated), {
    path_choice: 'analytics.motivation_events',
    approach_choice: 'analytics.motivation_events',
    session_heartbeat: 'analytics.engagement_heartbeats',
  });
});

test('every rebuild-era event mapped passes', () => {
  const migrations = [...base,
    { name: '0246_levers.sql', sql: check(['session_start', 'session_heartbeat', 'path_choice', 'approach_choice', 'parent_first_value']) },
    { name: '0247_gate.sql', sql: gated }];
  assert.deepEqual(checkLearningEventPractices(migrations), []);
});

test('THE CENTRAL CASE: a new event class with no practice is refused (the 0246 defect)', () => {
  const migrations = [...base,
    { name: '0218_gate.sql', sql: fn(["WHEN NEW.event IN ('path_choice') THEN 'analytics.motivation_events'"]) },
    { name: '0246_levers.sql', sql: check(['session_start', 'session_heartbeat', 'path_choice', 'enrichment_open']) }];
  const failures = checkLearningEventPractices(migrations);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /'enrichment_open' is a rebuild-era event class with no data practice/);
});

test('a mapping to an unregistered practice, or of an undeclared event, is refused', () => {
  const migrations = [...base,
    { name: '0246_levers.sql', sql: check(['session_start', 'session_heartbeat', 'path_choice']) },
    { name: '0247_gate.sql', sql: fn([
      "WHEN NEW.event IN ('path_choice', 'renamed_event') THEN 'analytics.motivation_events'",
      "WHEN NEW.event = 'session_heartbeat' THEN 'analytics.not_registered'",
    ]) }];
  const failures = checkLearningEventPractices(migrations);
  assert.ok(failures.some((f) => /maps 'renamed_event', which is not a declared learning_events value/.test(f)));
  assert.ok(failures.some((f) => /'analytics.not_registered', which is not a registered data_practices key/.test(f)));
});

test('the real migrations pass, and approach_choice, enrichment_offer and enrichment_open are gated by analytics.motivation_events', () => {
  const dir = fileURLToPath(new URL('../migrations', import.meta.url));
  const migrations = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
  assert.deepEqual(checkLearningEventPractices(migrations), []);
  const map = migrations.reduce((acc, { sql }) => practiceMap(sql) ?? acc, {});
  for (const event of ['approach_choice', 'enrichment_offer', 'enrichment_open', 'path_choice']) {
    assert.equal(map[event], 'analytics.motivation_events', event);
  }
});
