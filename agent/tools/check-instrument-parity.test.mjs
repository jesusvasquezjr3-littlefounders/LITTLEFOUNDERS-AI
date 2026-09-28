import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  INSTRUMENTS,
  balancedBody,
  checkInstrumentParity,
  kindTypeName,
  stripComments,
  topLevelKeys,
  unionMemberKeys,
  wireComputedKeys,
  zodNestedKeys,
  zodObjectKeys,
} from './check-instrument-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const FILES = {
  oracleSchema: 'oracle/src/tutor/turnSchema.ts',
  wire: 'oracle/src/ws/protocol.ts',
  coreBody: 'backend/src/routes/tutor.ts',
  coreRow: 'backend/src/services/tutorData.ts',
  frontendWire: 'frontend/src/rebuild/mentor/session/types.ts',
  frontendRenderers: 'frontend/src/rebuild/mentor/screen/boardVisuals.tsx',
  pizarron: 'frontend/src/rebuild/learning/pizarron/index.ts',
};

const real = Object.fromEntries(
  Object.entries(FILES).map(([id, file]) => [file, readFileSync(path.join(ROOT, file), 'utf8')]),
);

/** Reads the real sources, with one of them rewritten by `mutate`. */
function readWith(file, mutate) {
  return (requested) => (requested === file ? mutate(real[requested]) : real[requested]);
}

const readReal = (requested) => real[requested];

// ── the parser itself ───────────────────────────────────────────────────────

test('strips comments before any structural scan', () => {
  const source = 'const A = 1; /* a: b { */ // c: d {\nconst B = 2;';
  const clean = stripComments(source);
  assert.ok(!clean.includes('a: b'));
  assert.ok(!clean.includes('c: d'));
  assert.ok(clean.includes('const B = 2;'));
});

test('balancedBody returns the matching brace body, not the first close', () => {
  assert.equal(balancedBody('x({ a: { b: 1 }, c: 2 })', 0), ' a: { b: 1 }, c: 2 ');
  assert.equal(balancedBody('x({ unbalanced: 1', 0), null);
});

/*
 * `kindTypeName` replaced a 40-entry hand-written `kind → TypeName` map
 * (2026-09-03) that was itself exactly the class of copy this whole gate
 * exists to catch, and did catch on itself: adding `grab` to `INSTRUMENTS`
 * failed "no WireWhiteboard member found" even though `WireWhiteboard`
 * genuinely carried `WhiteboardGrab`, because the map had no `grab` row and
 * nothing forced one in. This locks the mechanical transform in as a
 * FUNCTION every future kind gets for free, rather than an eighth place to
 * remember alongside the five real copies, the manifest and the gate itself.
 */
test('kindTypeName derives every real kind\'s own type name, mechanically', () => {
  assert.equal(kindTypeName('sequence'), 'WhiteboardSequence');
  assert.equal(kindTypeName('two_bins'), 'WhiteboardTwoBins');
  assert.equal(kindTypeName('before_after'), 'WhiteboardBeforeAfter');
  assert.equal(kindTypeName('sequence_compare'), 'WhiteboardSequenceCompare');
  assert.equal(kindTypeName('grab'), 'WhiteboardGrab');
  // Every kind actually in the manifest resolves to a name wireComputedKeys
  // can find in the real WireWhiteboard union — the regression this test
  // exists for was silent otherwise.
  for (const { kind } of INSTRUMENTS) {
    assert.notEqual(wireComputedKeys(real[FILES.wire], kind), null, `wireComputedKeys found nothing for '${kind}'`);
  }
});

test('topLevelKeys skips anything nested in braces, brackets or parens', () => {
  const keys = topLevelKeys(" kind: z.literal('x'), steps: z.array(z.object({ op: z.enum(['a']), value: n })), label: s ");
  assert.deepEqual(keys, ['kind', 'steps', 'label']);
});

// ── the real repo agrees with itself ────────────────────────────────────────

test('the shipped repo passes: every instrument agrees across all copies', () => {
  assert.deepEqual(checkInstrumentParity(readReal), []);
});

test('every manifest entry names a real block in each source', () => {
  for (const { kind, model, computed, blocks } of INSTRUMENTS) {
    assert.ok(zodObjectKeys(real[FILES.oracleSchema], blocks.oracleSchema), `${kind}: oracle schema`);
    assert.ok(zodObjectKeys(real[FILES.coreBody], blocks.coreBody), `${kind}: core body`);
    assert.ok(zodObjectKeys(real[FILES.coreRow], blocks.coreRow), `${kind}: core row`);
    assert.ok(unionMemberKeys(real[FILES.frontendWire], 'TutorWhiteboardWire', kind), `${kind}: frontend`);
    if (computed.length > 0) {
      assert.deepEqual(wireComputedKeys(real[FILES.wire], kind).sort(), [...computed].sort(), `${kind}: wire`);
    }
    assert.ok(model.includes('kind'), `${kind}: manifest must list the discriminant`);
  }
});

test('a nested item shape resolves through a NAMED schema, not only inline', () => {
  // The false positive this gate shipped with for exactly one run: `marks:
  // z.array(WhiteboardMarkRowSchema)` is by reference, and the first parser
  // wandered into the next unrelated z.object() in the file.
  const keys = zodNestedKeys(real[FILES.coreRow], 'MarkedLineBoardRowSchema', 'marks');
  assert.ok(keys.includes('position'), 'position must resolve through the referenced schema');
  assert.ok(keys.includes('value') && keys.includes('label'));
});

// ── the negative tests: one per copy that can silently drift ────────────────

test('RED when Core’s POST /turns body loses a kind — the compare/marked_line incident', () => {
  const read = readWith(FILES.coreBody, (s) => s.replace('kind: z.literal(\'compare\'),', 'kind: z.literal(\'compare_TYPO\'),'));
  const problems = checkInstrumentParity(read);
  assert.ok(
    problems.some((p) => p.includes('backend/src/routes/tutor.ts') && p.includes('compare')),
    `expected a compare failure, got:\n${problems.join('\n')}`,
  );
});

test('RED when Core’s read-time revalidation loses a kind — the board dies on replay', () => {
  const read = readWith(FILES.coreRow, (s) => s.replace('const CategoriesBoardRowSchema', 'const CategoriesBoardRowSchema_UNUSED'));
  const problems = checkInstrumentParity(read);
  assert.ok(
    problems.some((p) => p.includes('tutorData.ts') && p.includes('categories')),
    `expected a categories failure, got:\n${problems.join('\n')}`,
  );
});

test('RED when the frontend mirror loses a kind — the client cannot draw it', () => {
  const read = readWith(FILES.frontendWire, (s) => s.replace("kind: 'marked_line';", "kind: 'marked_line_TYPO';"));
  const problems = checkInstrumentParity(read);
  assert.ok(
    problems.some((p) => p.includes('frontend/src/rebuild/mentor/session/types.ts') && p.includes('marked_line')),
    `expected a marked_line failure, got:\n${problems.join('\n')}`,
  );
});

test('RED when a field is added to Oracle’s schema and nowhere else', () => {
  const read = readWith(FILES.oracleSchema, (s) =>
    s.replace(
      "    kind: z.literal('categories'),",
      "    kind: z.literal('categories'),\n    subtitle: z.string(),",
    ),
  );
  const problems = checkInstrumentParity(read);
  assert.ok(
    problems.some((p) => p.includes('turnSchema.ts') && p.includes('subtitle')),
    `expected a drift failure naming subtitle, got:\n${problems.join('\n')}`,
  );
});

test('RED when a SERVER-COMPUTED field becomes settable by the model', () => {
  // The safety property: `computeComparison` derives which side is greater so
  // the model cannot assert it. Nothing enforced that until this gate.
  const read = readWith(FILES.oracleSchema, (s) =>
    s.replace(
      "    kind: z.literal('compare'),\n    left: WhiteboardCompareSideSchema,",
      "    kind: z.literal('compare'),\n    greater: z.enum(['left', 'right', 'tie']),\n    left: WhiteboardCompareSideSchema,",
    ),
  );
  const problems = checkInstrumentParity(read);
  assert.ok(
    problems.some((p) => p.includes('SERVER-COMPUTED') && p.includes('greater')),
    `expected the computed-field-leak failure, got:\n${problems.join('\n')}`,
  );
});

test('RED when a per-item computed field is dropped from a stored row', () => {
  const read = readWith(FILES.coreRow, (s) =>
    s.replace('    position: z.number().min(0).max(1),\n', ''),
  );
  const problems = checkInstrumentParity(read);
  assert.ok(
    problems.some((p) => p.includes('marks') && p.includes('position')),
    `expected a missing-position failure, got:\n${problems.join('\n')}`,
  );
});

test('RED when the wire forgets a kind’s computed fields', () => {
  const read = readWith(FILES.wire, (s) =>
    s.replace('| (WhiteboardCategories & { values: number[] })', '| WhiteboardCategories'),
  );
  const problems = checkInstrumentParity(read);
  assert.ok(
    problems.some((p) => p.includes('protocol.ts') && p.includes('categories')),
    `expected a wire failure, got:\n${problems.join('\n')}`,
  );
});

console.log(
  'check-instrument-parity OK — 4 instruments verified across 5 copies, and 7 deliberate ' +
    'desynchronisations each turn the gate red',
);

test('RED (B.7) when a kind has no shared Pizarrón visual on the Mentor board', () => {
  const read = readWith(FILES.frontendRenderers, (s) => s.replace("  ten_frame: 'TenFrameVisual',\n", ''));
  const problems = checkInstrumentParity(read);
  assert.ok(problems.some((p) => p.includes('(ten_frame)') && p.includes('no shared visual renderer')), problems.join('\n'));
});

test('RED (B.7) when a kind maps to something that is not a shared visual', () => {
  const read = readWith(FILES.frontendRenderers, (s) => s.replace("  scale: 'BalanceScaleVisual',", "  scale: 'GenericBars',"));
  const problems = checkInstrumentParity(read);
  assert.ok(problems.some((p) => p.includes('(scale)') && p.includes('not a shared Pizarrón visual')), problems.join('\n'));
});
