import assert from 'node:assert/strict';
import test from 'node:test';
import { checkV2LessonCapabilityParity, extractCapabilityMap } from './check-v2-lesson-capability-parity.mjs';

const core = `const capabilities = {
  'visual.growth-comparison.v2': ['visual.multi-line.v1', 'operation.parameter-slider.v1'],
  'money.allocation.v2': ['visual.stacked-bar.v1', 'operation.reallocate.v1'],
} as const;`;
const browser = `const REQUIRED_SEGMENT_CAPABILITIES = {
  'money.allocation.v2': ['operation.reallocate.v1', 'visual.stacked-bar.v1'],
  'visual.growth-comparison.v2': ['operation.parameter-slider.v1', 'visual.multi-line.v1'],
} as const;`;

test('normalizes capability and segment order before comparing independent contracts', () => {
  assert.deepEqual(extractCapabilityMap(core, 'capabilities'), {
    'money.allocation.v2': ['operation.reallocate.v1', 'visual.stacked-bar.v1'],
    'visual.growth-comparison.v2': ['operation.parameter-slider.v1', 'visual.multi-line.v1'],
  });
  assert.deepEqual(checkV2LessonCapabilityParity(core, browser), []);
});

test('reports a missing capability and a segment present in only one layer', () => {
  const changed = browser.replace("'operation.parameter-slider.v1', ", '').replace("  'money.allocation.v2': ['operation.reallocate.v1', 'visual.stacked-bar.v1'],\n", '');
  const problems = checkV2LessonCapabilityParity(core, changed);
  assert.ok(problems.some((problem) => problem.startsWith('money.allocation.v2:')));
  assert.ok(problems.some((problem) => problem.startsWith('visual.growth-comparison.v2:')));
});

test('reports a Forge emitter copy that drifts from Core (S05.4c)', () => {
  const forge = core.replace('const capabilities = {', 'export const V2_SEGMENT_CAPABILITIES = {');
  assert.deepEqual(checkV2LessonCapabilityParity(core, browser, forge), []);
  const drifted = forge.replace(", 'operation.parameter-slider.v1'", '');
  const problems = checkV2LessonCapabilityParity(core, browser, drifted);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^visual\.growth-comparison\.v2: Core .* differs from Forge/);
});

test('the shipped Core, browser and Forge capability maps agree', async () => {
  const { readFileSync } = await import('node:fs');
  const root = new URL('../../', import.meta.url);
  const read = (file) => readFileSync(new URL(file, root), 'utf8');
  assert.deepEqual(
    checkV2LessonCapabilityParity(read('backend/src/services/v2LessonDocument.ts'), read('frontend/src/rebuild/learning/lessonDocument.ts'), read('coursegen/src/v2/contract.ts')),
    [],
  );
});

console.log('check-v2-lesson-capability-parity OK — parity and deliberate drift are covered');
