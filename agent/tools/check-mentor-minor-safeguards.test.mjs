import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ALLOWLIST, auditMinorSafeguards, conditionAt, FILES, isSole, stripComments } from './check-mentor-minor-safeguards.mjs';

/*
 * GAP-FIX-R3 (C.2 / C.3 / C.4, Appendix F 1.3 Fracture-Closure Verification):
 * the real tree passes, and each way a safeguard could come to key off the
 * kid role alone — or stop reading the minor indicator — turns the gate red.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const real = Object.fromEntries(Object.values(FILES).map((f) => [f, readFileSync(path.join(ROOT, f), 'utf8')]));
const patched = (file, from, to) => (f) => {
  if (f !== file) return real[f];
  assert.ok(real[f].includes(from), `fixture drifted: ${from} not in ${f}`);
  return real[f].replace(from, to);
};
const failing = (read, id, text, options) => {
  const { checks } = auditMinorSafeguards(read, options);
  const c = checks.find((x) => x.id === id);
  assert.equal(c?.result, 'fail', `${id} should fail`);
  assert.ok(c.findings.some((f) => f.includes(text)), `${text}: ${JSON.stringify(c.findings)}`);
};

test('the shipped tree passes every check, and the one remaining role test is pinned by OD-18', () => {
  const { checks, tests } = auditMinorSafeguards((f) => real[f]);
  assert.deepEqual(checks.filter((c) => c.result !== 'pass'), []);
  assert.deepEqual(checks.map((c) => c.id), ['resolvers', 'kid-role-tests', 'minor-indicator', 'voice', 'memory-review', 'oracle-admission']);
  // Non-vacuous: the scanner finds the two role tests the code has.
  const memory = tests.find((t) => t.fn === 'classifyMemoryReview');
  assert.deepEqual({ sole: memory.sole, allowlisted: memory.allowlisted }, { sole: false, allowlisted: true });
  assert.ok(tests.some((t) => t.fn === 'requiresMinorMentorSafeguards' && !t.sole));
  assert.equal(ALLOWLIST[0].decision, 'OD-18');
});

test('RED when the memory review keys off the kid role alone (the guardian link dropped)', () => {
  const read = patched(FILES.tutor, "if (roles.includes('kid') || guardians.length > 0) return 'guardian-review';", "if (roles.includes('kid')) return 'guardian-review';");
  failing(read, 'kid-role-tests', 'SOLE condition of a safeguard');
  failing(read, 'resolvers', 'classifyMemoryReview no longer reads guardians.length > 0');
});

test('RED when a new role test decides a safeguard outside the resolvers, pinned by nothing', () => {
  const read = patched(
    FILES.tutor,
    "const consent = isMinor && !originRestricted ? await getActiveVoiceConsent(session.user_id) : null;",
    "const consent = isMinor && !originRestricted ? await getActiveVoiceConsent(session.user_id) : null;\n    const kidOnly = roles.includes('kid') && isMinor ? 1 : 0;",
  );
  failing(read, 'kid-role-tests', 'pinned by no ALLOWLIST entry');
});

test('RED when isMinor is computed from the role instead of resolved', () => {
  const read = patched(FILES.tutor, 'const { isMinor, originRestricted } = await resolveMentorSafety(session.user_id, roles);', "const isMinor = roles.includes('kid');\n    const originRestricted = false;");
  failing(read, 'minor-indicator', 'not from resolveMentorSafety');
  failing(read, 'minor-indicator', 'the internal session context no longer resolves isMinor');
  failing(read, 'kid-role-tests', 'SOLE condition');
});

test('RED when a microphone decision stops taking the resolved indicator (C.3)', () => {
  failing(patched(FILES.tutor, 'microphoneBlockedBy(isMinor, consent !== null, runtime, originRestricted)', 'microphoneBlockedBy(false, consent !== null, runtime, originRestricted)'), 'voice', 'must take isMinor first');
  failing(patched(FILES.tutor, 'const runtime = await preflight(isMinor, true);', 'const runtime = await preflight(false, true);'), 'voice', 'must take the resolved isMinor');
  failing(
    patched(FILES.tutor, 'const consent = originRestricted ? null : await getActiveVoiceConsent(userId.data);', 'const consent = await getActiveVoiceConsent(userId.data);'),
    'voice',
    'not gated by the resolved indicator',
  );
});

test('RED when a memory-review decision compares something classifyMemoryReview did not return (C.4)', () => {
  const read = patched(FILES.tutor, "if (reviewer === 'guardian-review')", "if (roleClass === 'guardian-review')");
  failing(read, 'memory-review', 'roleClass, which is not bound from classifyMemoryReview');
});

test('RED when a resolver loses its non-role evidence', () => {
  failing(patched(FILES.safety, 'return !Array.isArray(rows) || rows.length !== 1 || !hasVerifiedAdultEvidence(rows[0]);', 'return !Array.isArray(rows) || rows.length !== 1;'), 'resolvers', 'no longer reads hasVerifiedAdultEvidence(');
  failing(patched(FILES.safety, "if (roles.includes('kid') || !roles.includes('parent')) return true;", "if (roles.includes('kid')) return true;"), 'kid-role-tests', 'SOLE condition');
});

test("RED when Oracle's admission reads anything but the context's isMinor", () => {
  failing(patched(FILES.oracleServer, 'moderationReadiness(session.isMinor)', 'moderationReadiness(false)'), 'oracle-admission', 'must read session.isMinor');
  failing(patched(FILES.oracleServer, 'if (resumed) resumed.orchestrator.refreshIsMinor(session.isMinor);', 'if (resumed) resumed.orchestrator.refreshIsMinor(false);'), 'oracle-admission', 'no longer re-pins');
  const roles = patched(FILES.oracleServer, 'const readiness = moderationReadiness(session.isMinor);', "const roles = ['kid'];\n  const readiness = moderationReadiness(session.isMinor);");
  failing(roles, 'oracle-admission', 'names roles');
  failing(patched(FILES.oracleServer, 'const readiness = moderationReadiness(session.isMinor);', "const readiness = moderationReadiness(session.character === 'kid');"), 'kid-role-tests', 'Oracle tests the kid role');
});

test('RED on an allowlist entry without a recorded owner decision, or a stale one', () => {
  const read = (f) => real[f];
  failing(read, 'kid-role-tests', 'must cite an owner decision', { allowlist: [{ ...ALLOWLIST[0], decision: 'OD-99' }] });
  failing(read, 'kid-role-tests', 'must cite an owner decision', { allowlist: [{ ...ALLOWLIST[0], decision: 'the product team' }] });
  failing(read, 'kid-role-tests', 'must say why', { allowlist: [{ ...ALLOWLIST[0], reason: 'legacy' }] });
  failing(read, 'kid-role-tests', 'stale entry', { allowlist: [...ALLOWLIST, { ...ALLOWLIST[0], fn: 'someOtherHandler' }] });
  // Without the entry, the OD-18 hold is unpinned.
  failing(read, 'kid-role-tests', 'pinned by no ALLOWLIST entry', { allowlist: [] });
});

test('the parsers: comments never count, the condition is the if around the test, sole means no other operand', () => {
  assert.equal(stripComments("a // roles.includes('kid')\nb").includes('kid'), false);
  assert.equal(stripComments("/* roles.includes('kid') */ x").includes('kid'), false);
  const src = "  if (roles.includes('kid') || guardians.length > 0) return 'x';";
  assert.equal(conditionAt(src, src.indexOf('.includes')), "roles.includes('kid') || guardians.length > 0");
  assert.equal(isSole("roles.includes('kid')"), true);
  assert.equal(isSole("!roles.includes('kid')"), true);
  assert.equal(isSole("roles.includes('kid') || guardians.length > 0"), false);
});

test('RED when deleting a stored note stops reading classifyMemoryReview or the guardian link (GAP-FIX-R5, C.4 / OD-18)', () => {
  failing(
    patched(FILES.tutor, "const reviewer = await classifyMemoryReview(user.id);\n    if (reviewer === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'Could not resolve memory review eligibility');\n    if (reviewer === 'guardian-review') return fail(res, 403, 'GUARDIAN_MANAGED', 'A verified Tutor manages these notes');",
      "const reviewer = 'self-review' as string;"),
    'memory-review',
    'DELETE /memory/:store no longer reads classifyMemoryReview',
  );
  failing(
    patched(FILES.tutor, "if (reviewer === 'hold') return fail(res, 403, 'AGE_EVIDENCE_REQUIRED', 'Complete the age check first');\n    const refused", 'const refused'),
    'memory-review',
    'no longer refuses the hold population',
  );
  failing(
    patched(FILES.tutor, "router.delete('/memory/:store'", "router.delete('/memory-note/:store'"),
    'memory-review',
    "DELETE /memory/:store route is gone",
  );
  failing(
    patched(FILES.tutor, "    if (!guardian) return fail(res, 403, 'FORBIDDEN', 'Not your dependant');\n    const refused = await clearNote(", '    const refused = await clearNote('),
    'memory-review',
    'no longer re-checks the verified guardian link',
  );
});
