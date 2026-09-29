#!/usr/bin/env node
/**
 * C.2 / C.3 / C.4 — FRACTURE-CLOSURE VERIFICATION (Appendix F 1.3, a
 * per-release binary audit; Part 2.1 criterion 3 "Measured").
 *
 * Appendix F asks, every release, for proof that each of C.2's, C.3's and
 * C.4's safeguards keys off the account-level minor indicator or a guardian
 * link, never the kid role alone. The fracture this closes: a minor who does
 * not carry the legacy `kid` role (an independent teen, a child whose account
 * a parent never created, an unverified adult claim) silently misses a
 * safeguard that only checks the role.
 *
 * WHAT IT CHECKS (statically, in the code that makes the decisions):
 *
 *   resolvers        The three resolvers keep their non-role evidence:
 *                    requiresMinorMentorSafeguards (fail closed unless a
 *                    service-owned ID verification proves 18+),
 *                    resolveMentorSafety (the under-13 origin and verified
 *                    guardian links), classifyMemoryReview (verified guardian
 *                    links and the stored age declaration).
 *   kid-role-tests   Every `kid` role test in the Mentor decision code
 *                    (backend/src/routes/tutor.ts, the two resolvers, Oracle's
 *                    session admission) is either inside a resolver, combined
 *                    with non-role evidence, or pinned by an ALLOWLIST entry
 *                    citing an owner decision (OD-n in the owner decision
 *                    log). A test used as the SOLE condition of a safeguard
 *                    fails unless its entry says so and cites an OD. A stale
 *                    entry fails too.
 *   minor-indicator  C.2/C.3: every `isMinor` / `originRestricted` in Core's
 *                    tutor routes is bound from resolveMentorSafety (or
 *                    requiresMinorMentorSafeguards), never computed locally,
 *                    and the internal session context sends that binding.
 *   voice            C.3: every microphone decision (microphoneBlockedBy,
 *                    preflight, the voice-consent read) takes the resolved
 *                    indicator, or asks about a guardian's own child.
 *   memory-review    C.4: every memory-review decision compares a value bound
 *                    from classifyMemoryReview.
 *   oracle-admission C.2/C.3: Oracle's moderation mode, microphone and resume
 *                    posture read only the context's `isMinor`; no role, age
 *                    band or birth date reaches Oracle's admission code.
 *
 *   node agent/tools/check-mentor-minor-safeguards.mjs                 check (spec:check, repo-gates)
 *   node agent/tools/check-mentor-minor-safeguards.mjs --report=<file> also write the pass/fail JSON
 *                                                                      (release-readiness; the dashboard's
 *                                                                      safety.fracture_closure signal)
 *
 * This file is Tier 1 (component safety.judge in the governance registry).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FILES = {
  tutor: 'backend/src/routes/tutor.ts',
  safety: 'backend/src/services/mentorSafety.ts',
  oracleServer: 'oracle/src/ws/server.ts',
  oracleClient: 'oracle/src/core/client.ts',
  oracleOrchestrator: 'oracle/src/tutor/orchestrator.ts',
  decisions: 'docs/littlefounders-spec/product/13-OWNER-DECISION-LOG.md',
};

/** The resolvers, where a role test is part of the evidence (never the only part). */
export const RESOLVERS = [
  { file: FILES.safety, fn: 'requiresMinorMentorSafeguards', requires: ["!roles.includes('parent')", 'hasVerifiedAdultEvidence(', 'parent_verifications'] },
  { file: FILES.safety, fn: 'resolveMentorSafety', requires: ['requiresMinorMentorSafeguards(', 'readUnder13Origin(', 'guardian_links', "verification_status=eq.verified"] },
  { file: FILES.tutor, fn: 'classifyMemoryReview', requires: ['getVerifiedGuardiansOfKid(', 'guardians.length > 0', 'readAgeScreen(', "age.ageBand === '13_to_17'"] },
];

/**
 * Kid-role tests outside the resolvers' own evidence, each pinned with the
 * owner decision that makes it right. `sole: true` would admit a test that is
 * the only condition of a safeguard; none is allowed today.
 */
export const ALLOWLIST = [
  {
    file: FILES.tutor,
    fn: 'classifyMemoryReview',
    expression: "roles.includes('kid') || guardians.length > 0",
    decision: 'OD-18',
    sole: false,
    reason:
      'C.4 memory-note review: a verified guardian link routes the note to the guardian; the legacy kid role is an ADDITIONAL hold ' +
      '(OD-18: "existing kid-role records keep their guardian-review hold"). Never the only route to guardian review.',
  },
];

const KID_TEST = /\.includes\(\s*['"]kid['"]\s*\)|[!=]==?\s*['"]kid['"]|['"]kid['"]\s*[!=]==?/g;

/** Comments blanked to spaces (line numbers and offsets kept). */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[\s;{}(),])\/\/[^\n]*/g, (m, lead) => lead + ' '.repeat(m.length - lead.length));
}

/** The body of a top-level `function name(...)` (to the first line that is only a closing brace), or null. */
export function functionBody(source, name) {
  const m = new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*[(<]`, 'm').exec(source);
  if (!m) return null;
  const close = /\n\}(?=\n|$)/g;
  close.lastIndex = m.index;
  const end = close.exec(source);
  return end === null ? null : { start: m.index, end: end.index + 2, text: source.slice(m.index, end.index + 2) };
}

/** The nearest enclosing top-level function or inline route handler for an offset. */
export function enclosing(source, offset) {
  const before = source.slice(0, offset);
  const candidates = [
    ...before.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm),
    ...before.matchAll(/router\.(?:get|post|put|patch|delete)\(\s*'([^']+)'/g),
  ].sort((a, b) => a.index - b.index);
  const last = candidates.at(-1);
  if (!last) return '<module>';
  return last[0].includes('router.') ? `route ${last[1]}` : last[1];
}

/** The condition a match sits in: the `if (...)` it is in, or else the statement around it. */
export function conditionAt(source, offset) {
  const lineStart = source.lastIndexOf('\n', offset) + 1;
  const lineEnd = source.indexOf('\n', offset);
  const line = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const at = offset - lineStart;
  const ifAt = line.lastIndexOf('if (', at);
  if (ifAt !== -1) {
    let depth = 0;
    for (let i = ifAt + 3; i < line.length; i += 1) {
      if (line[i] === '(') depth += 1;
      else if (line[i] === ')' && --depth === 0) return line.slice(ifAt + 4, i).trim();
    }
  }
  return line.trim();
}

/** Sole: the kid test is the whole condition, give or take a negation. */
export const isSole = (condition) => !/\|\||&&|\?/.test(condition);

export function kidRoleTests(read) {
  const found = [];
  const scan = (file, source, within = null) => {
    const code = stripComments(source);
    for (const m of code.matchAll(KID_TEST)) {
      if (within && !within.some((b) => m.index >= b.start && m.index < b.end)) continue;
      const condition = conditionAt(code, m.index);
      found.push({
        file,
        line: code.slice(0, m.index).split('\n').length,
        fn: enclosing(code, m.index),
        condition,
        sole: isSole(condition),
      });
    }
  };
  const tutor = read(FILES.tutor);
  if (tutor !== null) scan(FILES.tutor, tutor);
  const safety = read(FILES.safety);
  if (safety !== null) {
    const code = stripComments(safety);
    const bodies = ['requiresMinorMentorSafeguards', 'resolveMentorSafety'].map((n) => functionBody(code, n)).filter(Boolean);
    scan(FILES.safety, safety, bodies);
  }
  for (const f of [FILES.oracleServer, FILES.oracleClient, FILES.oracleOrchestrator]) {
    const text = read(f);
    if (text !== null) scan(f, text);
  }
  return found;
}

const check = (id, requirement, title, findings) => ({ id, requirement, title, result: findings.length === 0 ? 'pass' : 'fail', findings });

export function auditMinorSafeguards(read, { allowlist = ALLOWLIST } = {}) {
  const checks = [];
  const missing = Object.values(FILES).filter((f) => read(f) === null);
  if (missing.length > 0) return { checks: [check('files', 'C.2', 'The audited files exist', missing.map((f) => `${f} is missing`))], tests: [] };
  const tutor = stripComments(read(FILES.tutor));
  const safety = stripComments(read(FILES.safety));
  const decisions = read(FILES.decisions);

  // 1. The resolvers keep their non-role evidence.
  const resolverFindings = [];
  for (const r of RESOLVERS) {
    const body = functionBody(r.file === FILES.safety ? safety : tutor, r.fn);
    if (!body) {
      resolverFindings.push(`${r.file}: ${r.fn} is gone — every C.2/C.3/C.4 decision must come from it`);
      continue;
    }
    for (const needle of r.requires) if (!body.text.includes(needle)) resolverFindings.push(`${r.file}: ${r.fn} no longer reads ${needle}`);
  }
  checks.push(check('resolvers', 'C.2', 'The three resolvers keep their non-role evidence (verified adulthood, origin, guardian links, age declaration)', resolverFindings));

  // 2. Every kid-role test is a resolver's extra evidence or pinned by an owner decision.
  const tests = kidRoleTests(read);
  const roleFindings = [];
  const used = new Set();
  for (const t of tests) {
    const inResolver = t.file === FILES.safety && (t.fn === 'requiresMinorMentorSafeguards' || t.fn === 'resolveMentorSafety');
    const entry = allowlist.find((a) => a.file === t.file && a.fn === t.fn && t.condition.includes(a.expression));
    if (entry) used.add(entry);
    t.allowlisted = Boolean(entry);
    if (t.file.startsWith('oracle/')) {
      roleFindings.push(`${t.file}:${t.line}: Oracle tests the kid role (${t.condition}); Oracle may only read the context's isMinor`);
      continue;
    }
    if (t.sole && !(entry && entry.sole === true)) {
      roleFindings.push(`${t.file}:${t.line} (${t.fn}): the kid role is the SOLE condition of a safeguard (${t.condition}) — key it off the minor indicator or a guardian link`);
      continue;
    }
    if (!inResolver && !entry) {
      roleFindings.push(`${t.file}:${t.line} (${t.fn}): a kid-role test (${t.condition}) outside the resolvers, pinned by no ALLOWLIST entry citing an owner decision`);
    }
  }
  for (const a of allowlist) {
    if (!/^OD-\d+$/.test(a.decision ?? '') || !(decisions ?? '').includes(`| ${a.decision} |`)) {
      roleFindings.push(`ALLOWLIST ${a.file}#${a.fn}: must cite an owner decision recorded in ${FILES.decisions} (got ${a.decision ?? 'none'})`);
    }
    if (typeof a.reason !== 'string' || a.reason.trim().length < 40) roleFindings.push(`ALLOWLIST ${a.file}#${a.fn}: must say why (40+ characters)`);
    if (!used.has(a)) roleFindings.push(`ALLOWLIST ${a.file}#${a.fn}: matches no kid-role test any more (stale entry: remove it)`);
  }
  checks.push(check('kid-role-tests', 'C.2', 'No safeguard keys off the kid role alone; every remaining role test is pinned by an owner decision', roleFindings));

  // 3. isMinor / originRestricted come from the resolvers only.
  const bindingFindings = [];
  for (const m of tutor.matchAll(/\b(?:const|let|var)\s+(\{[^}]*\}|\w+)\s*=\s*([^;\n]+)/g)) {
    const names = m[1];
    if (!/\b(isMinor|originRestricted)\b/.test(names)) continue;
    if (!/^await\s+(resolveMentorSafety|requiresMinorMentorSafeguards)\(/.test(m[2].trim())) {
      bindingFindings.push(`${FILES.tutor}:${tutor.slice(0, m.index).split('\n').length}: ${names.trim()} is bound from \`${m[2].trim().slice(0, 60)}\`, not from resolveMentorSafety`);
    }
  }
  // A reassignment statement (a parameter default ends with a comma and is not one).
  for (const m of tutor.matchAll(/(?<![.\w])(isMinor|originRestricted)\s*=(?!=)[^;,\n]*;/g)) {
    const lineStart = tutor.lastIndexOf('\n', m.index) + 1;
    if (!/\b(const|let|var)\b/.test(tutor.slice(lineStart, m.index)) && !/\{[^}]*$/.test(tutor.slice(lineStart, m.index))) {
      bindingFindings.push(`${FILES.tutor}:${tutor.slice(0, m.index).split('\n').length}: ${m[1]} is reassigned after it was resolved`);
    }
  }
  const context = /router\.get\(\s*'\/sessions\/:id'[\s\S]*?\n {2}\}\);/.exec(tutor)?.[0] ?? '';
  if (!/await resolveMentorSafety\(session\.user_id, roles\)/.test(context)) bindingFindings.push(`${FILES.tutor}: the internal session context no longer resolves isMinor with resolveMentorSafety`);
  if (!/\n\s+isMinor,\n/.test(context)) bindingFindings.push(`${FILES.tutor}: the internal session context no longer sends the resolved isMinor`);
  checks.push(check('minor-indicator', 'C.2', 'isMinor and originRestricted are always the resolved account-level indicator', bindingFindings));

  // 4. C.3 voice decisions take the resolved indicator.
  const voiceFindings = [];
  for (const m of tutor.matchAll(/\bmicrophoneBlockedBy\(([^)]*)\)/g)) {
    if (/^\s*isMinor: boolean/.test(m[1])) continue; // the declaration
    const args = m[1].split(',').map((a) => a.trim());
    if (args[0] !== 'isMinor' || args.at(-1) !== 'originRestricted') voiceFindings.push(`${FILES.tutor}:${tutor.slice(0, m.index).split('\n').length}: microphoneBlockedBy(${m[1]}) must take isMinor first and originRestricted last`);
  }
  for (const m of tutor.matchAll(/\bpreflight\(([^)]*)\)/g)) {
    const first = m[1].split(',')[0]?.trim();
    if (first === 'isMinor: boolean') continue;
    if (first !== 'isMinor' && first !== 'true') voiceFindings.push(`${FILES.tutor}:${tutor.slice(0, m.index).split('\n').length}: preflight(${m[1]}) must take the resolved isMinor (or true for a guardian's child)`);
  }
  for (const m of tutor.matchAll(/\bgetActiveVoiceConsent\(([^)]*)\)/g)) {
    const lineStart = tutor.lastIndexOf('\n', m.index) + 1;
    const line = tutor.slice(lineStart, tutor.indexOf('\n', m.index));
    if (/^\s*getActiveVoiceConsent,?\s*$/.test(line)) continue; // the import
    const guarded = /isMinor && !originRestricted \?|originRestricted \? null :/.test(line) || /kidUserId/.test(m[1]);
    if (!guarded) voiceFindings.push(`${FILES.tutor}:${tutor.slice(0, m.index).split('\n').length}: a voice-consent read not gated by the resolved indicator (${line.trim().slice(0, 80)})`);
  }
  checks.push(check('voice', 'C.3', 'Every microphone decision takes the resolved minor indicator', voiceFindings));

  // 5. C.4 memory-review decisions compare a value bound from classifyMemoryReview.
  const reviewFindings = [];
  const bound = new Set([...tutor.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*await\s+classifyMemoryReview\(/g)].map((m) => m[1]));
  if (bound.size === 0) reviewFindings.push(`${FILES.tutor}: no memory-review decision reads classifyMemoryReview`);
  const classifier = functionBody(tutor, 'classifyMemoryReview');
  for (const m of tutor.matchAll(/(\w+)\s*[!=]==\s*'(guardian-review|self-review|adult-direct|hold)'/g)) {
    if (classifier && m.index >= classifier.start && m.index < classifier.end) continue;
    if (!bound.has(m[1])) reviewFindings.push(`${FILES.tutor}:${tutor.slice(0, m.index).split('\n').length}: a memory-review decision on ${m[1]}, which is not bound from classifyMemoryReview`);
  }
  checks.push(check('memory-review', 'C.4', 'Every memory-review decision comes from classifyMemoryReview', reviewFindings));

  // 6. Oracle's admission reads only the context's isMinor.
  const oracleFindings = [];
  const server = stripComments(read(FILES.oracleServer));
  const client = stripComments(read(FILES.oracleClient));
  const orchestrator = stripComments(read(FILES.oracleOrchestrator));
  for (const m of server.matchAll(/\bmoderationReadiness\(([^)]*)\)/g)) if (m[1].trim() !== 'session.isMinor') oracleFindings.push(`${FILES.oracleServer}: moderationReadiness(${m[1]}) must read session.isMinor`);
  if (!/moderationReadiness\(session\.isMinor\)/.test(server)) oracleFindings.push(`${FILES.oracleServer}: the moderation mode no longer reads session.isMinor`);
  if (!/const microphone = [^;\n]*session\.isMinor/.test(server)) oracleFindings.push(`${FILES.oracleServer}: the microphone decision no longer reads session.isMinor`);
  if (!/refreshIsMinor\(session\.isMinor\)/.test(server)) oracleFindings.push(`${FILES.oracleServer}: a resume no longer re-pins the moderation posture to the fresh isMinor`);
  if (!/this\.minorPosture = session\.isMinor/.test(orchestrator)) oracleFindings.push(`${FILES.oracleOrchestrator}: the moderation posture is no longer the context's isMinor`);
  for (const [file, code] of [[FILES.oracleServer, server], [FILES.oracleClient, client]]) {
    for (const m of code.matchAll(/\b(roles|birthDate|birth_date|ageBand|age_band)\b/g)) {
      oracleFindings.push(`${file}:${code.slice(0, m.index).split('\n').length}: Oracle's admission names ${m[1]}; only the derived isMinor may reach it`);
    }
  }
  if (!/isMinor: z\.boolean\(\)/.test(client)) oracleFindings.push(`${FILES.oracleClient}: the session context no longer carries isMinor as a boolean`);
  checks.push(check('oracle-admission', 'C.2', "Oracle's moderation mode, microphone and resume posture read only the context's isMinor", oracleFindings));

  return { checks, tests };
}

function main() {
  const read = (f) => {
    try {
      return readFileSync(path.join(ROOT, f), 'utf8');
    } catch {
      return null;
    }
  };
  const { checks, tests } = auditMinorSafeguards(read);
  const failed = checks.filter((c) => c.result === 'fail');
  const report = {
    kind: 'mentor-fracture-closure-audit',
    requirements: ['C.2', 'C.3', 'C.4'],
    metric: 'safety.fracture_closure',
    generatedAt: new Date().toISOString(),
    checks,
    kidRoleTests: tests,
    allowlist: ALLOWLIST.map(({ file, fn, expression, decision, sole }) => ({ file, fn, expression, decision, sole })),
    result: failed.length === 0 ? 'pass' : 'fail',
  };
  const out = process.argv.find((a) => a.startsWith('--report='))?.slice('--report='.length);
  if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  if (failed.length > 0) {
    console.error(`minor-safeguards:check FAILED (Fracture-Closure Verification) — ${failed.length} of ${checks.length} checks:`);
    for (const c of failed) for (const f of c.findings) console.error(`  [${c.id}] ${f}`);
    return 1;
  }
  console.log(
    `minor-safeguards:check OK — ${checks.length} checks pass; ${tests.length} kid-role test(s) found, none the sole condition of a C.2/C.3/C.4 safeguard, ${tests.filter((t) => t.allowlisted).length} pinned by an owner decision`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
