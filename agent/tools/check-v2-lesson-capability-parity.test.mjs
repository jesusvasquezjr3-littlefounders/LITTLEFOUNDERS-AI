import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkHorizonteCapabilityParity, checkV2LessonCapabilityParity, extractCapabilityMap, packCapabilityName, readHorizontePackSources } from './check-v2-lesson-capability-parity.mjs';

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

const packSource = (name, body) => `export const ${name} = {
${body}} as const;
`;
const entry = `  'math.ten-frame.v2': ['visual.ten-frame.v1', 'operation.tap-cells.v1'],\n`;

test('names a pack literal from its id', () => {
  assert.equal(packCapabilityName('golden'), 'GOLDEN_CAPABILITIES');
  assert.equal(packCapabilityName('num-a'), 'NUM_A_CAPABILITIES');
});

test('accepts empty pack maps and an agreeing pack across the three layers', () => {
  const empty = { golden: packSource('GOLDEN_CAPABILITIES', ''), 'num-a': packSource('NUM_A_CAPABILITIES', '') };
  assert.deepEqual(checkHorizonteCapabilityParity(empty, empty, empty), []);
  const filled = { golden: packSource('GOLDEN_CAPABILITIES', entry) };
  assert.deepEqual(checkHorizonteCapabilityParity(filled, filled, filled), []);
});

test('reports a pack capability that drifts, a pack missing from a layer and a type claimed by two packs', () => {
  const filled = { golden: packSource('GOLDEN_CAPABILITIES', entry) };
  const drifted = { golden: packSource('GOLDEN_CAPABILITIES', entry.replace(", 'operation.tap-cells.v1'", '')) };
  assert.ok(checkHorizonteCapabilityParity(filled, drifted, filled).some((problem) => /^pack golden: math.ten-frame.v2: Core .* differs from browser/.test(problem)));
  assert.ok(checkHorizonteCapabilityParity(filled, filled, drifted).some((problem) => /differs from Forge/.test(problem)));
  assert.ok(checkHorizonteCapabilityParity(filled, filled, {}).some((problem) => problem === 'pack golden: missing from Forge'));
  const twice = { golden: filled.golden, 'num-a': packSource('NUM_A_CAPABILITIES', entry) };
  assert.ok(checkHorizonteCapabilityParity(twice, twice, twice).some((problem) => problem.startsWith('math.ten-frame.v2: declared by packs')));
});

test('the shipped pack capability literals agree across Core, browser and Forge', () => {
  const packs = readHorizontePackSources(fileURLToPath(new URL('../../', import.meta.url)));
  assert.ok(Object.keys(packs.core).length >= 18);
  assert.deepEqual(checkHorizonteCapabilityParity(packs.core, packs.browser, packs.forge), []);
});

console.log('check-v2-lesson-capability-parity OK — parity and deliberate drift are covered');
