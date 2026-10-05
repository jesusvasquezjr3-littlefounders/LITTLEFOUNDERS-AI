import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { renderActivationSql, validateActivationManifest } from './render-od22-kc-activation.mjs';

const manifest = JSON.parse(readFileSync(new URL('../../database/seeds/kc_activation.od22.json', import.meta.url), 'utf8'));

test('the OD-22 manifest activates only unique financial-education bridges', () => {
  const valid = validateActivationManifest(manifest);
  assert.equal(valid.activations.length, 25);
  assert.equal(new Set(valid.activations.map((item) => item.key)).size, 25);
  assert.ok(valid.activations.every((item) => item.skill_key.startsWith('financial-education/')));
});

test('the activation SQL is atomic, live-content-gated and idempotent', () => {
  const sql = renderActivationSql(manifest);
  assert.match(sql, /^-- OD-22:[^]*BEGIN;/);
  assert.match(sql, /LOCK TABLE public\.kc,[^]*topic_knowledge_components IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(sql, /financial-education' AND status = 'published'/);
  assert.match(sql, /l\.status = 'published'/);
  assert.match(sql, /tkc\.role = 'teaches'/);
  assert.match(sql, /IS DISTINCT FROM \('active', x\.skill_key\)/);
  assert.match(sql, /IF v_changed > 0 THEN[^]*content\.kc_od22_activated/);
  assert.match(sql, /COMMIT;\s*$/);
});

test('the manifest refuses unrelated course bridges', () => {
  const changed = structuredClone(manifest);
  changed.activations[0].skill_key = 'investing/not-eligible';
  assert.throws(() => validateActivationManifest(changed), /does not map to a financial-education topic/);
});
