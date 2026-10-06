// Independent arithmetic proof for the authored recovery pilot; no network access.
// This does not evaluate prose, learning effectiveness, or release readiness.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(root, 'plans/fe-recovery-adult-03-protect-committed-money.json'), 'utf8'));
const proofs = [];
for (const segment of plan.segments.filter(s => s.type === 'visual.chart.v2' && s.grading === 'server')) {
  const [available, committed] = segment.payload.data.series[0].values;
  assert(available >= committed && committed >= 0);
  const remainder = available - committed;
  const keys = segment.rubric.acceptable_choice_ids;
  assert.equal(keys.length, 1);
  const correctIndex = segment.payload.question.options.findIndex(option => option.id === keys[0]);
  assert(correctIndex >= 0);
  for (const [locale, copy] of Object.entries(segment.copy)) {
    const options = copy.question.options.map(option => Number(option.label));
    assert(options.every(Number.isFinite));
    assert.equal(options.filter(value => value === remainder).length, 1, `${segment.id}/${locale}: unique correct remainder`);
    assert.equal(options[correctIndex], remainder, `${segment.id}/${locale}: key matches computed remainder`);
    assert.deepEqual((copy.prompt.match(/\d+/g) ?? []).map(Number), [available, committed], `${segment.id}/${locale}: visible inputs match chart`);
  }
  proofs.push({ segment: segment.id, available, committed, remainder, locales: 3 });
}
assert.equal(proofs.length, 2);
// These explicit scenario proofs are tied to the authored visible amounts.
for (const [id, available, committed, price, fits] of [
  ['guided-02', 80, 50, 40, false],
  ['practice-02', 200, 150, 50, true],
  ['transfer-01', 160, 115, 50, false],
]) {
  const segment = plan.segments.find(s => s.id === id);
  assert(segment);
  assert.equal(available - committed >= price, fits);
  for (const [locale, copy] of Object.entries(segment.copy)) {
    assert.deepEqual((copy.scene.match(/\d+/g) ?? []).map(Number), [available, committed], `${id}/${locale}: independently reviewed scenario inputs changed`);
    if (id !== 'practice-02') assert.deepEqual((copy.prompt.match(/\d+/g) ?? []).map(Number), [price]);
    else {
      const key = segment.rubric.acceptable_choice_ids[0];
      const index = segment.payload.options.findIndex(option => option.id === key);
      const offered = copy.options.map(option => Number(option.label.match(/\d+/)?.[0]));
      assert(offered.every(Number.isFinite));
      assert.equal(offered.filter(value => value <= available - committed).length, 1);
      assert.equal(offered[index], price);
    }
  }
  proofs.push({ segment: id, available, committed, price, remainder: available - committed, fits, locales: 3 });
}
for (const segment of plan.segments) for (const [locale, copy] of Object.entries(segment.copy)) {
  for (const match of JSON.stringify(copy).matchAll(/(\d+) − (\d+) = (\d+)/g)) {
    assert.equal(Number(match[1]) - Number(match[2]), Number(match[3]), `${segment.id}/${locale}: worked arithmetic`);
  }
}
console.log(JSON.stringify({ok: true, proofs, limitation: 'Scenario meaning and yes/no key interpretation need prose review; this proves the arithmetic and chart keys only.'}, null, 2));
