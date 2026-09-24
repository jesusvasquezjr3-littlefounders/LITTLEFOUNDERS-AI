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

console.log('check-v2-lesson-capability-parity OK — parity and deliberate drift are covered');
