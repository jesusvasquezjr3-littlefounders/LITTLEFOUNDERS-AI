import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  canaryRegressionRate,
  checkAppendOnly,
  checkCommits,
  checkCoverage,
  checkLedger,
  checkPipelines,
  checkPolicyStatements,
  checkProposals,
  checkRegistry,
  checkTier2Parameters,
  componentHash,
  evaluateProposal,
  globToRegex,
  governedFiles,
  isAutomated,
  LEDGER,
  recordChanges,
  REGISTRY,
  ROOT,
  tierOf,
} from './check-mentor-governance.mjs';

/*
 * C.22 — the governance gate. A synthetic repository (a file list and file
 * contents) proves each rule turns red on the change it exists to catch; the
 * real registry and change record prove the shipped tree is green.
 */

const FILES = {
  'svc/safety/judge.ts': 'export const refuse = true;',
  'svc/tutor/prompt.ts': 'export const DEFAULTS = {\n  latencyZ: 1.5,\n};',
  'svc/tutor/reportLoop.ts': 'export const loop = 1;',
  'svc/tutor/live.ts': 'export const judge = 1;',
  'docs/policy.md': 'Tier statement (C.22): Tier 3 running, Tier 1 rubric.',
  'docs/registry.json': '{}',
  '.github/workflows/ci.yml': 'permissions:\n  contents: read\n',
  '.github/workflows/bot.yml': 'permissions:\n  contents: write\n',
};
const fsList = Object.keys(FILES);

function world(patch = {}) {
  const files = { ...FILES, ...patch };
  const read = (f) => (f in files ? files[f] : null);
  return { files, read, fsList: Object.keys(files) };
}

function registry(over = {}) {
  return {
    kind: 'mentor-governance-registry',
    governedRoots: ['svc/'],
    ignore: ['**/*.test.ts'],
    components: [
      { id: 'safety.judge', tier: 'tier_1', owner: 'safety_trust_lead', policy: 'docs/policy.md', paths: ['svc/safety/**'], examples: ['x'], tierHistory: [{ tier: 'tier_1', decision: 'D-2026-09-25-adoption' }] },
      { id: 'live', tier: 'live_content_judging', owner: 'safety_trust_lead', policy: 'docs/policy.md', paths: ['svc/tutor/live.ts'], examples: ['x'], tierHistory: [{ tier: 'live_content_judging', decision: 'D-2026-09-25-adoption' }] },
      { id: 'dialogue', tier: 'tier_2', owner: 'pedagogical_lead', policy: 'docs/policy.md', paths: ['svc/tutor/prompt.ts'], examples: ['x'], tierHistory: [{ tier: 'tier_2', decision: 'D-2026-09-25-adoption' }] },
      { id: 'reporting', tier: 'tier_3', owner: 'engineering_lead', policy: 'docs/policy.md', paths: ['svc/tutor/reportLoop.ts'], examples: ['x'], tierHistory: [{ tier: 'tier_3', decision: 'D-2026-09-25-adoption' }] },
    ],
    tier2Parameters: [{ id: 'latencyZ', file: 'svc/tutor/prompt.ts', object: 'DEFAULTS', field: 'latencyZ', bounds: [1, 2.5] }],
    automationPolicyDocs: { 'C.5': 'docs/policy.md', 'C.21': 'docs/policy.md', 'C.23': 'docs/policy.md', 'C.24': 'docs/policy.md' },
    automatedPipelines: [{ workflow: '.github/workflows/bot.yml', purpose: 'deps', scope: ['pulse/**'], maxTier: 'tier_3' }],
    automatedProposalGenerators: [],
    stage2Personas: ['frustrated', 'disengaging', 'gaming', 'reactant_teen', 'masking'],
    canaryMinTranscriptsRead: 20,
    decisions: [{ id: 'D-2026-09-25-adoption', date: '2026-09-25', kind: 'adoption', components: ['*'], summary: 'Adopts the tiered model for every component.', pedagogicalReviewer: 'pending', safetyTrustLead: 'pending' }],
    ...over,
  };
}

function ledgerFor(reg, w, signed = false) {
  const ledger = { kind: 'mentor-tier1-change-record', version: 1, entries: [] };
  recordChanges(reg, ledger, { change: 'Baseline at adoption', date: '2026-09-25', read: w.read, fsList: w.fsList });
  if (signed) for (const e of ledger.entries) Object.assign(e, { pedagogicalReviewer: 'Ana P.', safetyTrustLead: 'Luis S.' });
  return ledger;
}

// ── the real tree ────────────────────────────────────────────────────────────

test('the shipped registry and change record are green (static checks)', () => {
  const read = (f) => {
    try {
      return readFileSync(path.join(ROOT, f), 'utf8');
    } catch {
      return null;
    }
  };
  const reg = JSON.parse(read(REGISTRY));
  const ledger = JSON.parse(read(LEDGER));
  assert.deepEqual(checkRegistry(reg), []);
  assert.deepEqual(checkCoverage(reg), []);
  assert.deepEqual(checkLedger(reg, ledger), []);
  assert.deepEqual(checkTier2Parameters(reg), []);
  assert.deepEqual(checkPolicyStatements(reg), []);
  assert.deepEqual(checkPipelines(reg), []);
  // Non-vacuous: the real roots hold dozens of files, and the moderation judge is Tier 1.
  assert.ok(governedFiles(reg).length > 60);
  assert.equal(tierOf(['oracle/src/safety/moderation.ts'], reg).tier, 'tier_1');
  assert.equal(tierOf(['oracle/src/tutor/prompt.ts'], reg).tier, 'tier_2');
  assert.equal(tierOf(['oracle/src/content/generate.ts'], reg).tier, 'live_content_judging');
  // The release audit is red until both leads sign (the designed starting state).
  assert.ok(checkLedger(reg, ledger, { release: true }).length > 0);
});

test('globs: ** spans directories, * stays inside one', () => {
  assert.ok(globToRegex('oracle/src/tutor/*Gym.ts').test('oracle/src/tutor/pedagogyGym.ts'));
  assert.ok(!globToRegex('oracle/src/tutor/*Gym.ts').test('oracle/src/tutor/x/pedagogyGym.ts'));
  assert.ok(globToRegex('oracle/src/safety/biasAudit/**').test('oracle/src/safety/biasAudit/audit-log.json'));
  assert.ok(globToRegex('**/*.test.ts').test('a/b/c.test.ts'));
});

// ── Stage 0 ──────────────────────────────────────────────────────────────────

test('RED on an unclassified Mentor file, a doubly claimed file and a stale component', () => {
  const w = world({ 'svc/tutor/newThing.ts': 'x', 'svc/tutor/prompt.test.ts': 'ignored' });
  const cov = checkCoverage(registry(), w.fsList);
  assert.ok(cov.some((p) => p.includes('svc/tutor/newThing.ts: unclassified')), cov.join('\n'));
  assert.ok(!cov.some((p) => p.includes('prompt.test.ts')));
  const twice = registry();
  twice.components[2].paths.push('svc/tutor/live.ts');
  assert.ok(checkCoverage(twice, fsList).some((p) => p.includes('claimed by')));
  const stale = registry();
  stale.components[3].paths = ['svc/tutor/gone.ts'];
  assert.ok(checkRegistry(stale, { fsList, read: world().read }).some((p) => p.includes('stale')));
});

test('RED when a component lacks examples, a policy, or its tier does not end its history', () => {
  const reg = registry();
  reg.components[0].examples = [];
  reg.components[1].policy = 'docs/missing.md';
  reg.components[2].tier = 'tier_3';
  const problems = checkRegistry(reg, { fsList, read: world().read });
  assert.ok(problems.some((p) => p.includes('example')));
  assert.ok(problems.some((p) => p.includes('does not exist')));
  assert.ok(problems.some((p) => p.includes('not the last entry')));
});

// ── Tier 1 change record ─────────────────────────────────────────────────────

test('a Tier 1 change without a change-record row is RED; recording it turns the gate green; release needs both sign-offs', () => {
  const reg = registry();
  const w = world();
  const ledger = ledgerFor(reg, w);
  assert.equal(ledger.entries.length, 2); // tier_1 + live axis only
  assert.deepEqual(checkLedger(reg, ledger, { read: w.read, fsList: w.fsList }), []);
  const changed = world({ 'svc/safety/judge.ts': 'export const refuse = false;' });
  const red = checkLedger(reg, ledger, { read: changed.read, fsList: changed.fsList });
  assert.ok(red.some((p) => p.includes('safety.judge (tier_1) changed without a change-record row')), red.join('\n'));
  // A Tier 2 edit needs no row.
  const t2 = world({ 'svc/tutor/prompt.ts': 'export const DEFAULTS = {\n  latencyZ: 1.7,\n};' });
  assert.deepEqual(checkLedger(reg, ledger, { read: t2.read, fsList: t2.fsList }), []);
  const added = recordChanges(reg, ledger, { change: 'Refuse less (reviewed)', date: '2026-09-26', read: changed.read, fsList: changed.fsList });
  assert.equal(added.length, 1);
  assert.deepEqual(checkLedger(reg, ledger, { read: changed.read, fsList: changed.fsList }), []);
  assert.ok(checkLedger(reg, ledger, { read: changed.read, fsList: changed.fsList, release: true }).some((p) => p.includes('not signed off')));
  const signed = ledgerFor(reg, w, true);
  assert.deepEqual(checkLedger(reg, signed, { read: w.read, fsList: w.fsList, release: true }), []);
});

test('RED on an automated-origin change-record row, and hashing ignores line endings and excluded files', () => {
  const reg = registry();
  const w = world();
  const ledger = ledgerFor(reg, w);
  ledger.entries[0].origin = 'automated';
  assert.ok(checkLedger(reg, ledger, { read: w.read, fsList: w.fsList }).some((p) => p.includes('never automated')));
  const crlf = world({ 'svc/safety/judge.ts': 'export const refuse = true;'.replace(/;/g, ';\r\n') });
  const lf = world({ 'svc/safety/judge.ts': 'export const refuse = true;'.replace(/;/g, ';\n') });
  assert.equal(componentHash(reg.components[0], reg, crlf.read, crlf.fsList).hash, componentHash(reg.components[0], reg, lf.read, lf.fsList).hash);
  const withLog = world({ 'svc/safety/audit-log.json': '{"runs":[1]}' });
  const excl = { ...reg.components[0], hashExclude: ['svc/safety/audit-log.json'] };
  const before = componentHash(excl, reg, withLog.read, withLog.fsList).hash;
  const after = componentHash(excl, reg, world({ 'svc/safety/audit-log.json': '{"runs":[1,2]}' }).read, withLog.fsList).hash;
  assert.equal(before, after);
});

test('the record and the decisions are append-only against the base', () => {
  const reg = registry();
  const w = world();
  const base = ledgerFor(reg, w);
  const head = structuredClone(base);
  assert.deepEqual(checkAppendOnly(base, head, reg, reg), []);
  head.entries[0].pedagogicalReviewer = 'Ana P.'; // pending → a name: allowed
  assert.deepEqual(checkAppendOnly(base, head, reg, reg), []);
  const signedBase = structuredClone(head);
  const rewritten = structuredClone(head);
  rewritten.entries[0].pedagogicalReviewer = 'Someone else';
  assert.ok(checkAppendOnly(signedBase, rewritten, reg, reg).some((p) => p.includes('changed after it was given')));
  const hashEdit = structuredClone(head);
  hashEdit.entries[0].hash = 'f'.repeat(64);
  assert.ok(checkAppendOnly(head, hashEdit, reg, reg).some((p) => p.includes('rewritten')));
  assert.ok(checkAppendOnly(head, { ...head, entries: head.entries.slice(1) }, reg, reg).some((p) => p.includes('removed')));
  const noDecision = registry({ decisions: [] });
  assert.ok(checkAppendOnly(base, base, reg, noDecision).some((p) => p.includes('decision D-2026-09-25-adoption was removed')));
  const gone = registry();
  gone.components = gone.components.slice(1);
  assert.ok(checkAppendOnly(base, base, reg, gone).some((p) => p.includes('removed without a new decision')));
});

// ── promotions ───────────────────────────────────────────────────────────────

test('a move to a more autonomous tier needs a decision signed by both leads', () => {
  const unsigned = registry({
    decisions: [...registry().decisions, { id: 'D-2026-10-01-promote', date: '2026-10-01', kind: 'promotion', components: ['dialogue'], summary: 'Move dialogue to tier 3 for faster iteration.', pedagogicalReviewer: 'Ana P.', safetyTrustLead: 'pending' }],
  });
  unsigned.components[2].tier = 'tier_3';
  unsigned.components[2].tierHistory.push({ tier: 'tier_3', decision: 'D-2026-10-01-promote' });
  assert.ok(checkRegistry(unsigned, { fsList, read: world().read }).some((p) => p.includes('without a decision signed by both leads')));
  unsigned.decisions[1].safetyTrustLead = 'Luis S.';
  assert.deepEqual(checkRegistry(unsigned, { fsList, read: world().read }), []);
  // Leaving the live-content axis is a move that needs the same.
  const live = registry({ decisions: [...registry().decisions, { id: 'D-2026-10-02-axis', date: '2026-10-02', kind: 'move', components: ['live'], summary: 'Move the live judge rules to tier 1 only.', pedagogicalReviewer: 'pending', safetyTrustLead: 'pending' }] });
  live.components[1].tier = 'tier_1';
  live.components[1].tierHistory.push({ tier: 'tier_1', decision: 'D-2026-10-02-axis' });
  assert.ok(checkRegistry(live, { fsList, read: world().read }).some((p) => p.includes('live_content_judging to tier_1')));
  // History rewritten against the base is red.
  const base = registry();
  const head = registry();
  head.components[2].tierHistory = [{ tier: 'tier_3', decision: 'D-2026-09-25-adoption' }];
  head.components[2].tier = 'tier_3';
  assert.ok(checkAppendOnly(null, null, base, head).some((p) => p.includes('tier history was rewritten')));
});

// ── Tier 2 bounds, policy statements, pipelines ─────────────────────────────

test('RED when a Tier 2 parameter leaves its approved bounds, or is registered in a non-Tier-2 file', () => {
  const reg = registry();
  assert.deepEqual(checkTier2Parameters(reg, world().read), []);
  const out = world({ 'svc/tutor/prompt.ts': 'export const DEFAULTS = {\n  latencyZ: 0.5,\n};' });
  assert.ok(checkTier2Parameters(reg, out.read).some((p) => p.includes('outside its approved bounds')));
  const wrong = registry({ tier2Parameters: [{ id: 'x', file: 'svc/safety/judge.ts', object: 'DEFAULTS', field: 'latencyZ', bounds: [0, 9] }] });
  assert.ok(checkTier2Parameters(wrong, world().read).some((p) => p.includes('not in a Tier 2 component')));
});

test('RED when an automation requirement\'s policy stops stating its tier (C.22 DoD c)', () => {
  const w = world({ 'docs/policy.md': 'No governance statement here.' });
  assert.ok(checkPolicyStatements(registry(), w.read).some((p) => p.includes('does not state which C.22 tier')));
  assert.ok(checkPolicyStatements(registry({ automationPolicyDocs: {} }), world().read).some((p) => p.includes('C.23 touches automation')));
});

test('RED on an undeclared repo-writing workflow, and on a declared one whose scope reaches Tier 1', () => {
  const reg = registry();
  const w = world({ '.github/workflows/sneaky.yml': 'steps:\n  - run: git push origin HEAD\n' });
  const files = ['.github/workflows/ci.yml', '.github/workflows/bot.yml', '.github/workflows/sneaky.yml'];
  assert.ok(checkPipelines(reg, { read: w.read, fsList: w.fsList, workflowFiles: files }).some((p) => p.includes('sneaky.yml can write')));
  const wide = registry({ automatedPipelines: [{ workflow: '.github/workflows/bot.yml', purpose: 'x', scope: ['svc/**'], maxTier: 'tier_3' }] });
  assert.ok(checkPipelines(wide, { read: world().read, fsList, workflowFiles: ['.github/workflows/bot.yml'] }).some((p) => p.includes('reaches Tier 1')));
  const t1 = registry({ automatedPipelines: [{ workflow: '.github/workflows/bot.yml', purpose: 'x', scope: ['pulse/**'], maxTier: 'tier_1' }] });
  assert.ok(checkPipelines(t1, { read: world().read, fsList, workflowFiles: ['.github/workflows/bot.yml'] }).some((p) => p.includes('may never be allowed')));
  // A comment that mentions git commit is not a capability.
  const comment = world({ '.github/workflows/ci.yml': '# none of them are a git commit\npermissions:\n  contents: read\n' });
  assert.deepEqual(checkPipelines(reg, { read: comment.read, fsList, workflowFiles: ['.github/workflows/ci.yml', '.github/workflows/bot.yml'] }), []);
});

// ── proposals ────────────────────────────────────────────────────────────────

const SHA = 'a'.repeat(64);
function proposal(over = {}) {
  return {
    kind: 'mentor-change-proposal',
    id: 'P-2026-10-01-latency',
    title: 'Latency z 1.7',
    origin: 'automated',
    paths: ['svc/tutor/prompt.ts'],
    declaredTier: 'tier_2',
    status: 'canary',
    stage0: { pedagogicalLead: 'Ana P.', safetyTrustLead: 'Luis S.', date: '2026-10-01' },
    stage2: { date: '2026-10-01', reportSha256: SHA, personas: { frustrated: 'pass', disengaging: 'pass', gaming: 'pass', reactant_teen: 'pass', masking: 'pass' }, failures: [] },
    stage3: { judgeId: 'transcript_judge', calibrationId: 'cal-1', judgeModel: 'qwen3-max', judgePromptHash: SHA, scoredAt: '2026-10-02T10:00:00Z', criteria: ['emotion_label'], verdict: 'pass', verifiedWith: 'npm --prefix backend run tutor:judge-calibration -- --verify-proposal=x' },
    stage4: null,
    stage5: null,
    stage6: null,
    ...over,
  };
}

test('a Tier 2 automated proposal clears Stages 0–3 for canary; release needs the canary and the metric', () => {
  const reg = registry();
  assert.deepEqual(evaluateProposal(proposal(), reg), { computedTier: 'tier_2', violations: [], missing: [], releaseReady: true });
  const released = evaluateProposal(proposal({ status: 'released' }), reg);
  assert.ok(released.missing.some((m) => m.startsWith('stage5')));
  assert.ok(released.missing.some((m) => m.startsWith('stage6')));
  const full = evaluateProposal(proposal({ status: 'released', stage5: { experimentId: 'exp-1', reader: 'Ana P.', date: '2026-10-05', transcriptsRead: 20, outcome: 'clear' }, stage6: { releasedAt: '2026-10-06', metrics: ['rubric.emotion_label'] } }), reg);
  assert.equal(full.releaseReady, true);
  const tooFew = evaluateProposal(proposal({ status: 'released', stage5: { experimentId: 'exp-1', reader: 'Ana P.', date: '2026-10-05', transcriptsRead: 5, outcome: 'clear' }, stage6: { releasedAt: '2026-10-06', metrics: ['x'] } }), reg);
  assert.ok(tooFew.missing.some((m) => m.startsWith('stage5')));
});

test('an uncalibrated Stage 3 routes to Stage 4; a Stage 2 failure returns to Stage 1', () => {
  const reg = registry();
  const noJudge = evaluateProposal(proposal({ stage3: null }), reg);
  assert.ok(noJudge.missing.some((m) => m.includes('stage4')));
  const reviewed = evaluateProposal(proposal({ stage3: null, stage4: { pedagogicalReviewer: 'Ana P.', safetyTrustLead: 'Luis S.', date: '2026-10-02', addresses: 'Checks the reactant-teen register does not become controlling at 1.7.' } }), reg);
  assert.equal(reviewed.releaseReady, true);
  const failed = evaluateProposal(proposal({ stage2: { ...proposal().stage2, personas: { ...proposal().stage2.personas, masking: 'fail' }, failures: [] } }), reg);
  assert.ok(failed.violations.some((v) => v.includes('itemized failure report')));
  assert.ok(failed.violations.some((v) => v.includes('returns to Stage 1')));
  const missingPersona = evaluateProposal(proposal({ stage2: { ...proposal().stage2, personas: { frustrated: 'pass' } } }), reg);
  assert.ok(missingPersona.missing.some((m) => m.includes('masking')));
});

test('never automate: an automated proposal touching Tier 1 or the live axis is a violation; a weaker declared tier is refused', () => {
  const reg = registry();
  assert.ok(evaluateProposal(proposal({ paths: ['svc/safety/judge.ts'], declaredTier: 'tier_1', stage3: null }), reg).violations.some((v) => v.includes('never automate')));
  assert.ok(evaluateProposal(proposal({ paths: ['svc/tutor/live.ts'], declaredTier: 'live_content_judging', stage3: null }), reg).violations.some((v) => v.includes('never automate')));
  assert.ok(evaluateProposal(proposal({ origin: 'human', paths: ['svc/tutor/prompt.ts', 'svc/safety/judge.ts'] }), reg).violations.some((v) => v.includes('declared tier_2, but the paths make it tier_1')));
});

test('a human Tier 1 proposal bypasses Stage 3 and needs two DISTINCT reviewers', () => {
  const reg = registry();
  const t1 = proposal({ origin: 'human', paths: ['svc/safety/judge.ts'], declaredTier: 'tier_1' });
  assert.ok(evaluateProposal(t1, reg).violations.some((v) => v.includes('bypasses Stage 3')));
  const same = evaluateProposal({ ...t1, stage3: null, stage4: { pedagogicalReviewer: 'Ana P.', safetyTrustLead: 'ana p.', date: '2026-10-02', addresses: 'The refusal list keeps every harm category the audit covers.' } }, reg);
  assert.ok(same.violations.some((v) => v.includes('two distinct reviewers')));
  const ok = evaluateProposal({ ...t1, stage3: null, stage4: { pedagogicalReviewer: 'Ana P.', safetyTrustLead: 'Luis S.', date: '2026-10-02', addresses: 'The refusal list keeps every harm category the audit covers.' } }, reg);
  assert.deepEqual(ok.violations, []);
});

test('checkProposals refuses a status the stages do not support, and a file not named by its id', () => {
  const reg = registry();
  const bad = [{ file: 'docs/rebuild/mentor/governance/proposals/P-2026-10-01-other.json', record: proposal({ status: 'released' }) }];
  const problems = checkProposals(reg, bad);
  assert.ok(problems.some((p) => p.includes('file name must be the proposal id')));
  assert.ok(problems.some((p) => p.includes('status released but missing stage5')));
});

test('Canary Regression Rate comes from the Stage 5 outcomes', () => {
  const rows = [
    { record: proposal({ stage5: { outcome: 'clear' } }) },
    { record: proposal({ stage5: { outcome: 'rolled_back' } }) },
    { record: proposal() },
  ];
  assert.deepEqual(canaryRegressionRate(rows), { canaried: 2, rolledBack: 1, rate: 0.5 });
  assert.deepEqual(canaryRegressionRate([]), { canaried: 0, rolledBack: 0, rate: null });
});

// ── the automated-origin fence over commits ─────────────────────────────────

test('RED when an automated commit touches Tier 1, or governed files without a cleared proposal', () => {
  const reg = registry();
  const bot = { sha: 'b'.repeat(40), name: 'dependabot[bot]', email: '49699333+dependabot[bot]@users.noreply.github.com', body: 'bump', files: ['svc/safety/judge.ts'] };
  assert.ok(isAutomated(bot));
  assert.ok(checkCommits([bot], reg, []).some((p) => p.includes('never automated')));
  const trailer = { sha: 'c'.repeat(40), name: 'mentor-loop', email: 'loop@example.com', body: 'Tune\n\nMentor-Change-Origin: automated', files: ['svc/tutor/prompt.ts'] };
  assert.ok(checkCommits([trailer], reg, []).some((p) => p.includes('without a Mentor-Proposal record')));
  const cited = { ...trailer, body: `${trailer.body}\nMentor-Proposal: P-2026-10-01-latency` };
  const records = [{ file: 'x', record: proposal() }];
  assert.deepEqual(checkCommits([cited], reg, records), []);
  const outside = { ...cited, files: ['svc/tutor/prompt.ts', 'svc/tutor/reportLoop.ts'] };
  assert.ok(checkCommits([outside], reg, records).some((p) => p.includes('does not name')));
  const draft = [{ file: 'x', record: proposal({ status: 'draft' }) }];
  assert.ok(checkCommits([cited], reg, draft).some((p) => p.includes('has not cleared its stages')));
  // A human commit, and an automated commit outside the governed roots, are not fenced.
  assert.deepEqual(checkCommits([{ ...bot, name: 'Ana', email: 'ana@example.com' }], reg, []), []);
  assert.deepEqual(checkCommits([{ ...bot, files: ['pulse/Dockerfile'] }], reg, []), []);
});
