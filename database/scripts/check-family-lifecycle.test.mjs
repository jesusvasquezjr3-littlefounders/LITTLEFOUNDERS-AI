// The OD-21 lifecycle gate, run against known-bad inputs: a checker nobody has
// seen fail is not a control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLifecycle, vocabulary } from './check-family-lifecycle.mjs';

const create = `CREATE TABLE IF NOT EXISTS public.redemptions (
    id uuid PRIMARY KEY,
    status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved')),
    created_at timestamptz
);`;
const registry = {
  'redemptions.status': {
    requested: { producer: [{ file: 'a.ts', text: 'insertRedemption(' }], consumer: [{ file: 'b.sql', text: "<> 'requested'" }] },
    approved: { producer: [{ file: 'b.sql', text: "SET status = 'approved'" }], consumer: [{ file: 'c.tsx', text: 'copy.approved' }] },
  },
};
const sources = { 'a.ts': 'insertRedemption({', 'b.sql': "x <> 'requested'; SET status = 'approved'", 'c.tsx': 'copy.approved' };
const read = (overrides = {}) => (file) => ({ ...sources, ...overrides })[file] ?? null;

test('reads the vocabulary from CREATE TABLE and lets a later constraint win', () => {
  assert.deepEqual(vocabulary([{ sql: create }], 'redemptions', 'status'), ['approved', 'requested']);
  const widened = "alter table public.redemptions add constraint redemptions_status_check check (status in ('requested', 'approved', 'fulfilled'));";
  assert.deepEqual(vocabulary([{ sql: create }, { sql: widened }], 'redemptions', 'status'), ['approved', 'fulfilled', 'requested']);
});

test('a complete registry passes', () => {
  assert.deepEqual(checkLifecycle({ migrations: [{ sql: create }], readSource: read(), registry }), []);
});

test('THE CENTRAL CASE: a new declared state with no flow is refused', () => {
  const widened = "alter table public.redemptions add constraint redemptions_status_check check (status in ('requested', 'approved', 'fulfilled'));";
  const failures = checkLifecycle({ migrations: [{ sql: create }, { sql: widened }], readSource: read(), registry });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /'fulfilled' is declared but has no registered producing\/consuming flow/);
});

test('a state whose producing flow was deleted is refused', () => {
  const failures = checkLifecycle({ migrations: [{ sql: create }], readSource: read({ 'a.ts': 'nothing here' }), registry });
  assert.deepEqual(failures, ["redemptions.status.requested: no producer evidence found (a.ts)"]);
});

test('a state whose only consumer is missing is refused', () => {
  const failures = checkLifecycle({ migrations: [{ sql: create }], readSource: read({ 'c.tsx': null }), registry });
  assert.deepEqual(failures, ["redemptions.status.approved: no consumer evidence found (c.tsx)"]);
});

test('a registry entry the schema no longer declares is refused', () => {
  const failures = checkLifecycle({ migrations: [{ sql: create.replace(", 'approved'", '') }], readSource: read(), registry });
  assert.deepEqual(failures, ["redemptions.status: registry names 'approved', which the schema does not declare"]);
});

test('a missing vocabulary is refused rather than passing vacuously', () => {
  assert.deepEqual(checkLifecycle({ migrations: [], readSource: read(), registry }), ['redemptions.status: no CHECK vocabulary found in the migrations']);
});
