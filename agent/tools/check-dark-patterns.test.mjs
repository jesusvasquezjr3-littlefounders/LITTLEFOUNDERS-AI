// Tests for check-dark-patterns.mjs (B.25, B.26, B.27; S05.3f): red-team
// samples for every automated rule, the audit-record validation and the
// release sign-off rule, and the checklist/doc parity.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AUDIT_RECORD, CHECKLIST, CHECKLIST_VERSION, RELEASE_AUDIT_MAX_AGE_DAYS,
  auditScore, run, scanText, stringLiterals, structuralFindings, validateAuditRecord,
} from './check-dark-patterns.mjs';

const repo = fileURLToPath(new URL('../..', import.meta.url));

test('the repository passes today, and the checklist is the one the procedure documents', () => {
  const { findings, auditProblems } = run();
  assert.deepEqual(findings, []);
  assert.deepEqual(auditProblems, []);
  const doc = readFileSync(`${repo}docs/rebuild/DARK-PATTERN-AUDIT.md`, 'utf8');
  for (const item of CHECKLIST) assert.match(doc, new RegExp(`\\| ${item.id} \\|`), `${item.id} is missing from DARK-PATTERN-AUDIT.md`);
  assert.equal(new Set(CHECKLIST.map((item) => item.id)).size, CHECKLIST.length);
});

test('copy red team: each manipulation, shame and family-finance sample maps to its checklist item', () => {
  const cases = [
    ['Hurry, only 2 left!', 'DP-01'],
    ['Dina is sad when you leave.', 'DP-02'],
    ['Upgrade to premium', 'DP-04'],
    ['Everyone else is ahead.', 'DP-05'],
    ['Te quedan 3 vidas.', 'DP-07'],
    ["You're not a saver.", 'SH-01'],
    ['Você é muito esperta!', 'SH-01'],
    ['Tus papás malgastan todo.', 'FF-01'],
  ];
  for (const [text, item] of cases) {
    assert.ok(scanText(text, 'sample').some((finding) => finding.item === item), `${text} should be ${item}`);
  }
  for (const clean of ['Try again: count by 5s.', 'The link expires in 30 days.', 'Keep going', 'Some families save in coins.']) {
    assert.deepEqual(scanText(clean, 'sample'), [], clean);
  }
});

test('string literals: comments are not copy, template expressions are blanked', () => {
  const literals = stringLiterals("// 'You failed' in a comment\nconst a = 'Keep going';\nconst b = `Hi ${name}, ready?`;");
  assert.deepEqual(literals, ['Keep going', 'Hi  , ready?']);
});

test('structure red team: timers, autoplay, timed navigation, unclosable dialogs, leaderboards, lives, sad states, red misses', () => {
  const tsx = (code) => structuralFindings('frontend/src/rebuild/x/Sample.tsx', code).map((finding) => finding.item);
  assert.deepEqual(tsx('<div role="timer">{secondsLeft}</div>'), ['DP-01']);
  assert.deepEqual(tsx('<video autoPlay />'), ['DP-03']);
  assert.deepEqual(tsx('useEffect(() => { setTimeout(() => navigate("/learn/next"), 3000); }, []);'), ['DP-03']);
  assert.deepEqual(tsx('setTimeout(sequence.onAdvance, 650);'), []);
  assert.deepEqual(tsx('<section role="dialog" aria-modal="true"><p>Stay</p></section>'), ['DP-03']);
  assert.deepEqual(tsx('<section role="dialog" onKeyDown={(e) => e.key === "Escape" && onClose()}></section>'), []);
  // A design-system overlay hands its close handler to the shared layer stack, which owns Escape (S03.2).
  assert.deepEqual(tsx('const host = useModal(open, "scrim", onClose, panel);\nreturn <section role="dialog" aria-modal="true" />;'), []);
  assert.deepEqual(tsx('const host = useModal(open, "scrim", undefined, panel);\nreturn <section role="dialog" aria-modal="true" />;'), ['DP-03']);
  assert.deepEqual(tsx('<Leaderboard />'), ['DP-05']);
  // The whiteboard's ordering instrument is exempt by its literal kind only; any other ranking still fails.
  assert.deepEqual(tsx("type Board = { kind: 'ranking'; order: number[] };"), []);
  assert.deepEqual(tsx("type Board = { kind: 'ranking' }; const ranking = peers.sort();"), ['DP-05']);
  assert.deepEqual(tsx('<span>{state.hearts}</span>'), ['DP-07']);
  assert.deepEqual(tsx('<Stage emotion="sad" />'), ['SH-02']);
  const css = (code) => structuralFindings('frontend/src/rebuild/x/sample.css', code).map((finding) => finding.item);
  assert.deepEqual(css('.lf-answer--wrong { background: var(--error-soft); }'), ['SH-02']);
  assert.deepEqual(css('.lf-field input[aria-invalid="true"] { box-shadow: inset 0 0 0 3px var(--error-strong); }'), []);
  assert.deepEqual(css('.lf-learning-feedback--review { background: var(--surface); }'), []);
});

const item = (result = 'pass') => ({ result, evidence: 'evidence recorded here' });
const audit = (overrides = {}) => ({
  id: 'a1', date: '2026-09-20', kind: 'release-audit', scope: 'release candidate 1.2.3',
  signed_off_by: 'A. Reviewer', items: Object.fromEntries(CHECKLIST.map((entry) => [entry.id, item()])), ...overrides,
});
const record = (audits) => ({ checklist_version: CHECKLIST_VERSION, audits });
const NOW = new Date('2026-09-25T00:00:00Z');

test('the audit record needs every item, a known result and evidence', () => {
  assert.deepEqual(validateAuditRecord(record([audit()]), { now: NOW }), []);
  const missing = audit();
  delete missing.items['DP-04'];
  assert.match(validateAuditRecord(record([missing]), { now: NOW }).join('\n'), /DP-04 has no result/);
  assert.match(validateAuditRecord(record([audit({ items: { ...audit().items, 'DP-01': { result: 'maybe', evidence: 'evidence recorded' } } })]), { now: NOW }).join('\n'), /DP-01 result/);
  assert.match(validateAuditRecord(record([audit({ items: { ...audit().items, 'XX-99': item() } })]), { now: NOW }).join('\n'), /XX-99 is not a checklist item/);
  assert.match(validateAuditRecord({ checklist_version: 'old', audits: [audit()] }, { now: NOW }).join('\n'), /checklist_version/);
  assert.deepEqual(validateAuditRecord(null), ['the audit record has no audits']);
});

test('a release needs a fresh, signed release audit with nothing failing or open', () => {
  assert.deepEqual(validateAuditRecord(record([audit()]), { release: true, now: NOW }), []);
  const engineering = audit({ kind: 'engineering-pre-audit', signed_off_by: null });
  assert.match(validateAuditRecord(record([engineering]), { release: true, now: NOW }).join('\n'), /no release audit/);
  assert.match(validateAuditRecord(record([audit({ signed_off_by: null })]), { release: true, now: NOW }).join('\n'), /no human sign-off/);
  assert.match(validateAuditRecord(record([audit({ date: '2026-07-01' })]), { release: true, now: NOW }).join('\n'), new RegExp(`older than ${RELEASE_AUDIT_MAX_AGE_DAYS}`));
  const open = audit({ items: { ...audit().items, 'MN-02': item('open'), 'DP-07': item('fail') } });
  assert.match(validateAuditRecord(record([open]), { release: true, now: NOW }).join('\n'), /DP-07, MN-02/);
  assert.deepEqual(auditScore(open), { pass: CHECKLIST.length - 2, fail: 1, open: 1, notApplicable: 0 });
});

test('the recorded pre-audit is not a release audit (the release gate refuses today)', () => {
  const current = JSON.parse(readFileSync(`${repo}${AUDIT_RECORD}`, 'utf8'));
  assert.deepEqual(validateAuditRecord(current, { release: false }), []);
  assert.ok(validateAuditRecord(current, { release: true }).length > 0);
});
