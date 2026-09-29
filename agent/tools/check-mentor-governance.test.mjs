import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  canaryRegressionRate,
  changedSymbols,
  checkAppendOnly,
  checkCommits,
  checkCoverage,
  checkLedger,
  checkPipelines,
  checkPolicyStatements,
  checkProposals,
  checkRegistry,
  checkSymbols,
  checkTier2Parameters,
  componentHash,
  evaluateProposal,
  globToRegex,
  governedFiles,
  isAutomated,
  LEDGER,
  MODULE_SYMBOL,
  recordChanges,
  REGISTRY,
  ROOT,
  tierOf,
  topLevelSymbols,
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
const EXP = '55555555-5555-4555-8555-000000000001';
/** canaries.json: the running mentor.canary experiment that delivers the proposal's parameter change. */
const MANIFEST = {
  kind: 'mentor-canary-manifest',
  version: 1,
  target: 'mentor.canary',
  surface: 'tutor',
  maxShare: 0.1,
  canaries: [{ experimentId: EXP, proposalId: 'P-2026-10-01-latency', share: 0.05, status: 'running', overrides: { latencyZ: 1.7 } }],
};
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
    parameterChanges: { latencyZ: 1.7 },
    stage5: { experimentId: EXP },
    stage6: null,
    ...over,
  };
}

test('a Tier 2 automated proposal clears Stages 0–3 for canary; release needs the canary and the metric', () => {
  const reg = registry();
  assert.deepEqual(evaluateProposal(proposal(), reg, MANIFEST), { computedTier: 'tier_2', violations: [], missing: [], releaseReady: true });
  const released = evaluateProposal(proposal({ status: 'released' }), reg, MANIFEST);
  assert.ok(released.missing.some((m) => m.startsWith('stage5')));
  assert.ok(released.missing.some((m) => m.startsWith('stage6')));
  const full = evaluateProposal(proposal({ status: 'released', stage5: { experimentId: EXP, reader: 'Ana P.', date: '2026-10-05', transcriptsRead: 20, outcome: 'clear' }, stage6: { releasedAt: '2026-10-06', metrics: ['rubric.emotion_label'] } }), reg, MANIFEST);
  assert.equal(full.releaseReady, true);
  const tooFew = evaluateProposal(proposal({ status: 'released', stage5: { experimentId: EXP, reader: 'Ana P.', date: '2026-10-05', transcriptsRead: 5, outcome: 'clear' }, stage6: { releasedAt: '2026-10-06', metrics: ['x'] } }), reg, MANIFEST);
  assert.ok(tooFew.missing.some((m) => m.startsWith('stage5')));
});

test('an uncalibrated Stage 3 routes to Stage 4; a Stage 2 failure returns to Stage 1', () => {
  const reg = registry();
  const noJudge = evaluateProposal(proposal({ stage3: null }), reg, MANIFEST);
  assert.ok(noJudge.missing.some((m) => m.includes('stage4')));
  const reviewed = evaluateProposal(proposal({ stage3: null, stage4: { pedagogicalReviewer: 'Ana P.', safetyTrustLead: 'Luis S.', date: '2026-10-02', addresses: 'Checks the reactant-teen register does not become controlling at 1.7.' } }), reg, MANIFEST);
  assert.equal(reviewed.releaseReady, true);
  const failed = evaluateProposal(proposal({ stage2: { ...proposal().stage2, personas: { ...proposal().stage2.personas, masking: 'fail' }, failures: [] } }), reg, MANIFEST);
  assert.ok(failed.violations.some((v) => v.includes('itemized failure report')));
  assert.ok(failed.violations.some((v) => v.includes('returns to Stage 1')));
  const missingPersona = evaluateProposal(proposal({ stage2: { ...proposal().stage2, personas: { frustrated: 'pass' } } }), reg, MANIFEST);
  assert.ok(missingPersona.missing.some((m) => m.includes('masking')));
});

test('never automate: an automated proposal touching Tier 1 or the live axis is a violation; a weaker declared tier is refused', () => {
  const reg = registry();
  assert.ok(evaluateProposal(proposal({ paths: ['svc/safety/judge.ts'], declaredTier: 'tier_1', stage3: null }), reg, MANIFEST).violations.some((v) => v.includes('never automate')));
  assert.ok(evaluateProposal(proposal({ paths: ['svc/tutor/live.ts'], declaredTier: 'live_content_judging', stage3: null }), reg, MANIFEST).violations.some((v) => v.includes('never automate')));
  assert.ok(evaluateProposal(proposal({ origin: 'human', paths: ['svc/tutor/prompt.ts', 'svc/safety/judge.ts'] }), reg, MANIFEST).violations.some((v) => v.includes('declared tier_2, but the paths make it tier_1')));
});

test('a human Tier 1 proposal bypasses Stage 3 and needs two DISTINCT reviewers', () => {
  const reg = registry();
  const t1 = proposal({ origin: 'human', paths: ['svc/safety/judge.ts'], declaredTier: 'tier_1', parameterChanges: undefined, stage5: null });
  assert.ok(evaluateProposal(t1, reg, MANIFEST).violations.some((v) => v.includes('bypasses Stage 3')));
  const same = evaluateProposal({ ...t1, stage3: null, stage4: { pedagogicalReviewer: 'Ana P.', safetyTrustLead: 'ana p.', date: '2026-10-02', addresses: 'The refusal list keeps every harm category the audit covers.' } }, reg, MANIFEST);
  assert.ok(same.violations.some((v) => v.includes('two distinct reviewers')));
  const ok = evaluateProposal({ ...t1, stage3: null, stage4: { pedagogicalReviewer: 'Ana P.', safetyTrustLead: 'Luis S.', date: '2026-10-02', addresses: 'The refusal list keeps every harm category the audit covers.' } }, reg, MANIFEST);
  assert.deepEqual(ok.violations, []);
});

test('checkProposals refuses a status the stages do not support, and a file not named by its id', () => {
  const reg = registry();
  const bad = [{ file: 'docs/rebuild/mentor/governance/proposals/P-2026-10-01-other.json', record: proposal({ status: 'released' }) }];
  const problems = checkProposals(reg, bad, MANIFEST);
  assert.ok(problems.some((p) => p.includes('file name must be the proposal id')));
  assert.ok(problems.some((p) => p.includes('status released but missing stage5')));
});

test('GAP-FIX-R3 Stage 5 delivery: the experiment must be a mentor.canary canary that delivers exactly this proposal parameter changes', () => {
  const reg = registry();
  const cleared = evaluateProposal(proposal(), reg, MANIFEST);
  assert.deepEqual(cleared.violations, []);
  const red = (over, manifest, text) => {
    const r = evaluateProposal(proposal(over), reg, manifest);
    assert.ok(r.violations.some((v) => v.includes(text)), `${text}: ${JSON.stringify(r.violations)}`);
  };
  // An experiment the manifest does not list could not have delivered anything.
  red({ stage5: { experimentId: '66666666-6666-4666-8666-666666666666' } }, MANIFEST, 'no real session could have received this change');
  // The canary delivers other values, or another proposal.
  red({}, { ...MANIFEST, canaries: [{ ...MANIFEST.canaries[0], overrides: { latencyZ: 1.8 } }] }, "are not the proposal's parameterChanges");
  red({}, { ...MANIFEST, canaries: [{ ...MANIFEST.canaries[0], overrides: { latencyZ: 1.7, other: 2 } }] }, "are not the proposal's parameterChanges");
  red({}, { ...MANIFEST, canaries: [{ ...MANIFEST.canaries[0], proposalId: 'P-2026-10-02-other' }] }, 'delivers P-2026-10-02-other, not this proposal');
  // A change that is not a registered Tier 2 parameter has no delivery path.
  red({ parameterChanges: undefined }, MANIFEST, 'declares no parameterChanges');
  // A proposal still in canary needs its canary running.
  red({}, { ...MANIFEST, canaries: [{ ...MANIFEST.canaries[0], status: 'concluded' }] }, 'is concluded');
  // A manifest that is missing, or targets something else.
  red({}, null, 'is missing or malformed');
  red({}, { ...MANIFEST, target: 'mentor.dialogue-register' }, 'does not target mentor.canary');
  // No experiment at all: missing, not cleared.
  assert.ok(evaluateProposal(proposal({ stage5: null }), reg, MANIFEST).missing.some((m) => m.startsWith('stage5.experimentId')));
  // A released proposal keeps a CONCLUDED canary as its evidence.
  const released = evaluateProposal(proposal({
    status: 'released',
    stage5: { experimentId: EXP, reader: 'Ana P.', date: '2026-10-05', transcriptsRead: 20, outcome: 'clear' },
    stage6: { releasedAt: '2026-10-06', metrics: ['canary.arm_comparison'] },
  }), reg, { ...MANIFEST, canaries: [{ ...MANIFEST.canaries[0], status: 'concluded' }] });
  assert.equal(released.releaseReady, true);
  // A Tier 3 (reporting-only) change needs no canary.
  assert.deepEqual(evaluateProposal(proposal({ paths: ['svc/tutor/reportLoop.ts'], declaredTier: 'tier_3', parameterChanges: undefined, stage5: null }), reg, MANIFEST).missing, []);
});

test('GAP-FIX-R3 parameterChanges: registered Tier 2 parameters only, inside their bounds, in a file the proposal names', () => {
  const reg = registry({ tier2Parameters: [{ id: 'latencyZ', file: 'svc/tutor/prompt.ts', object: 'DEFAULTS', field: 'latencyZ', bounds: [1, 2.5], integer: false }, { id: 'checks', file: 'svc/tutor/prompt.ts', object: 'DEFAULTS', field: 'checks', bounds: [1, 3], integer: true }] });
  const red = (changes, text) => {
    const r = evaluateProposal(proposal({ status: 'draft', parameterChanges: changes }), reg, MANIFEST);
    assert.ok(r.violations.some((v) => v.includes(text)), `${text}: ${JSON.stringify(r.violations)}`);
  };
  red({ windowSize: 5 }, 'not a registered Tier 2 parameter');
  red({ latencyZ: 3 }, 'outside its approved bounds');
  red({ checks: 2.5 }, 'must be an integer');
  red({ latencyZ: '1.7' }, 'must be a number');
  red({}, 'must name at least one Tier 2 parameter');
  const elsewhere = evaluateProposal(proposal({ status: 'draft', paths: ['svc/tutor/reportLoop.ts'], declaredTier: 'tier_3' }), reg, MANIFEST);
  assert.ok(elsewhere.violations.some((v) => v.includes('which the proposal does not name in paths')));
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
  assert.ok(checkCommits([bot], reg, [], MANIFEST).some((p) => p.includes('never automated')));
  const trailer = { sha: 'c'.repeat(40), name: 'mentor-loop', email: 'loop@example.com', body: 'Tune\n\nMentor-Change-Origin: automated', files: ['svc/tutor/prompt.ts'] };
  assert.ok(checkCommits([trailer], reg, [], MANIFEST).some((p) => p.includes('without a Mentor-Proposal record')));
  const cited = { ...trailer, body: `${trailer.body}\nMentor-Proposal: P-2026-10-01-latency` };
  const records = [{ file: 'x', record: proposal() }];
  assert.deepEqual(checkCommits([cited], reg, records, MANIFEST), []);
  const outside = { ...cited, files: ['svc/tutor/prompt.ts', 'svc/tutor/reportLoop.ts'] };
  assert.ok(checkCommits([outside], reg, records, MANIFEST).some((p) => p.includes('does not name')));
  const draft = [{ file: 'x', record: proposal({ status: 'draft' }) }];
  assert.ok(checkCommits([cited], reg, draft, MANIFEST).some((p) => p.includes('has not cleared its stages')));
  // A human commit, and an automated commit outside the governed roots, are not fenced.
  assert.deepEqual(checkCommits([{ ...bot, name: 'Ana', email: 'ana@example.com' }], reg, [], MANIFEST), []);
  assert.deepEqual(checkCommits([{ ...bot, files: ['pulse/Dockerfile'] }], reg, [], MANIFEST), []);
});

// ── finer boundaries: Tier 1 at declaration level (OD-28, owner review M-19) ─

test('topLevelSymbols: names each top-level declaration with its own doc comment, and is not fooled by nesting, strings, templates or regexes', () => {
  const src = [
    "import { x } from './x';",
    '',
    '/* A header comment about the module. */',
    '',
    '/** Doc for A. */',
    'export const A = { nested: { deep: 1 } };',
    '',
    'const TEMPLATE = `',
    'const NOT_A_DECLARATION = 1;',
    '${A.nested.deep > 0 ? `inner ${"}"}` : "{"}',
    'function alsoNot() {}',
    '`;',
    '',
    "const RE = /[{(]const x/g; // a regex with braces",
    '',
    'export function f(a: number): number;',
    'export function f(a: number) {',
    '  const inner = 2;',
    "  return a + inner + '}'.length;",
    '}',
    '',
    'export class K {',
    '  m() {',
    '    return 1;',
    '  }',
    '}',
    'export type T = { a: number };',
    'export interface I {',
    '  b: string;',
    '}',
    'if (A) console.log(A);',
  ].join('\n');
  const s = topLevelSymbols(src);
  assert.deepEqual([...s.keys()].sort(), [MODULE_SYMBOL, 'A', 'I', 'K', 'RE', 'T', 'TEMPLATE', 'f'].sort());
  assert.match(s.get('A'), /^\/\*\* Doc for A\. \*\/\nexport const A/);
  assert.match(s.get(MODULE_SYMBOL), /header comment/);
  assert.match(s.get(MODULE_SYMBOL), /import \{ x \}/);
  assert.match(s.get(MODULE_SYMBOL), /if \(A\)/);
  assert.match(s.get('TEMPLATE'), /NOT_A_DECLARATION[\s\S]*alsoNot/);
  assert.match(s.get('f'), /: number;\nexport function f[\s\S]*inner/);
  assert.match(s.get('K'), /m\(\)/);
  // Re-spacing or moving a declaration changes no declaration's text; editing one changes only it.
  assert.deepEqual(changedSymbols(src, src.replace('\n\nexport class K', '\n\n\n\nexport class K')), []);
  assert.deepEqual(changedSymbols(src, src.replace('return 1;', 'return 2;')), ['K']);
  assert.deepEqual(changedSymbols(src, `${src}\nexport const NEW = 1;`), ['NEW']);
});

test('topLevelSymbols loses nothing on the real mixed files', () => {
  for (const f of ['oracle/src/tutor/controller.ts', 'oracle/src/tutor/orchestrator.ts', 'backend/src/services/pedagogy/behavioralTelemetry.ts', 'backend/src/services/pedagogy/mentorQuality.ts']) {
    const src = readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
    const symbols = topLevelSymbols(src);
    const nonBlank = (t) => t.split('\n').filter((l) => l.trim() !== '').length;
    const covered = [...symbols.values()].reduce((n, t) => n + nonBlank(t), 0);
    assert.equal(covered, nonBlank(src), `${f}: every non-blank line belongs to exactly one declaration or the module`);
    assert.ok(symbols.size > 10, f);
  }
});

const SPLIT_SRC = [
  "import { helper } from './helper';",
  '',
  '/** The non-negotiable. */',
  'export function neverRevealOnFirstAsk(asks: number) {',
  '  return asks >= 2 && PACE_MS > 0;',
  '}',
  '',
  'export const PACE_MS = 1_500;',
  '',
  'export function summarize(rows: number[]) {',
  '  return rows.length;',
  '}',
].join('\n');

function splitWorld(patch = {}) {
  return world({ 'svc/tutor/mixed.ts': SPLIT_SRC, ...patch });
}

function splitRegistry({ signed = false, over = {} } = {}) {
  const reg = registry(over);
  reg.components[0].symbols = [{ file: 'svc/tutor/mixed.ts', names: ['*'] }];
  reg.components[2].symbols = [{ file: 'svc/tutor/mixed.ts', names: ['PACE_MS'], decision: 'D-2026-09-27-finer' }];
  reg.components[3].symbols = [{ file: 'svc/tutor/mixed.ts', names: ['summarize'], decision: 'D-2026-09-27-finer' }];
  reg.decisions.push({ id: 'D-2026-09-27-finer', date: '2026-09-27', kind: 'classification', components: ['safety.judge'], summary: 'Finer boundaries for the mixed file.', pedagogicalReviewer: signed ? 'Ana P.' : 'pending', safetyTrustLead: signed ? 'Luis S.' : 'pending' });
  return reg;
}

test('a split file is classified per declaration: green as shipped, and the shipped registry splits the named mixed files', () => {
  const w = splitWorld();
  assert.deepEqual(checkCoverage(splitRegistry(), w.fsList, w.read), []);
  assert.deepEqual(checkRegistry(splitRegistry(), { fsList: w.fsList, read: w.read }), []);
  const real = JSON.parse(readFileSync(path.join(ROOT, REGISTRY), 'utf8'));
  for (const f of ['oracle/src/tutor/controller.ts', 'oracle/src/tutor/orchestrator.ts', 'backend/src/services/pedagogy/behavioralTelemetry.ts', 'backend/src/services/pedagogy/alliance.ts']) {
    assert.equal(tierOf([f], real).tier, 'tier_1', `${f} named whole is Tier 1`);
    assert.equal(tierOf([`${f}#${MODULE_SYMBOL}`], real).tier, 'tier_1', `${f}'s imports stay Tier 1`);
    assert.equal(tierOf([`${f}#aDeclarationAddedTomorrow`], real).tier, 'tier_1', `a new declaration in ${f} defaults to Tier 1`);
  }
  assert.deepEqual(checkSymbols(real), []);
});

test('RED on every broken declaration-level claim', () => {
  const w = splitWorld();
  const cases = [
    ['a stale name', (r) => r.components[2].symbols[0].names.push('GONE'), 'not a top-level declaration'],
    ['a name claimed twice', (r) => r.components[3].symbols[0].names.push('PACE_MS'), 'exactly one tier'],
    ['no "*"', (r) => { r.components[0].symbols[0].names = ['neverRevealOnFirstAsk']; }, 'exactly one component must claim "*"'],
    ['two "*"', (r) => { r.components[2].symbols[0].names = ['*']; }, 'exactly one component must claim "*"'],
    ['"*" held by a less strict tier', (r) => {
      r.components[0].symbols = [{ file: 'svc/tutor/mixed.ts', names: ['neverRevealOnFirstAsk'] }];
      r.components[2].symbols = [{ file: 'svc/tutor/mixed.ts', names: ['*'] }];
    }, 'must be the strictest tier'],
    ['a carve-out without a decision', (r) => { delete r.components[2].symbols[0].decision; }, 'must cite a recorded decision'],
    ['the module carved out', (r) => r.components[2].symbols[0].names.push(MODULE_SYMBOL), 'stays with the strictest claimant'],
    ['a split file also claimed whole', (r) => r.components[1].paths.push('svc/tutor/mixed.ts'), 'also claimed whole'],
    ['a split file that does not exist', (r) => r.components[0].symbols.push({ file: 'svc/tutor/gone.ts', names: ['*'] }), 'does not exist'],
  ];
  for (const [label, mutate, message] of cases) {
    const reg = splitRegistry();
    mutate(reg);
    const problems = checkSymbols(reg, { read: w.read, fsList: w.fsList });
    assert.ok(problems.some((p) => p.includes(message)), `${label}: ${problems.join(' | ') || 'no problem reported'}`);
  }
});

test('RED when a Tier 3 carve-out feeds a stricter declaration, in its file or by import', () => {
  const inFile = splitWorld({ 'svc/tutor/mixed.ts': SPLIT_SRC.replace('return asks >= 2 && PACE_MS > 0;', 'return asks >= 2 && summarize([asks]) > 0;') });
  assert.ok(checkSymbols(splitRegistry(), { read: inFile.read, fsList: inFile.fsList }).some((p) => p.includes('used by neverRevealOnFirstAsk (tier_1)')));
  const imported = splitWorld({ 'svc/safety/judge.ts': "import { summarize } from '../tutor/mixed.js';\nexport const refuse = summarize([1]) > 0;" });
  assert.ok(checkSymbols(splitRegistry(), { read: imported.read, fsList: imported.fsList }).some((p) => p.includes('imported by svc/safety/judge.ts (tier_1)')));
  // A Tier 2 parameter consumed by Tier 1 wiring is the normal shape and stays green.
  const w = splitWorld();
  assert.deepEqual(checkSymbols(splitRegistry(), { read: w.read, fsList: w.fsList }), []);
});

test('a carve-out waits for both signatures: until then the strict hash covers the whole file', () => {
  const w = splitWorld();
  const pending = splitRegistry();
  const ledger = ledgerFor(pending, w);
  // Editing the carved-out Tier 2 constant still needs a Tier 1 row while the decision is unsigned.
  const paced = splitWorld({ 'svc/tutor/mixed.ts': SPLIT_SRC.replace('1_500', '1_800') });
  assert.ok(checkLedger(pending, ledger, { read: paced.read, fsList: paced.fsList }).some((p) => p.includes('safety.judge (tier_1) changed')));
  assert.equal(tierOf(['svc/tutor/mixed.ts#PACE_MS'], pending).tier, 'tier_1');
  // Adopting a boundary changes no hash until a carve-out takes effect.
  const plain = registry();
  plain.components[0].paths.push('svc/tutor/mixed.ts');
  assert.equal(componentHash(pending.components[0], pending, w.read, w.fsList).hash, componentHash(plain.components[0], plain, w.read, w.fsList).hash);
});

test('once both leads sign, the Tier 1 hash, the fence and the bounds follow each declaration', () => {
  const w = splitWorld();
  const signed = splitRegistry({ signed: true });
  const ledger = ledgerFor(signed, w);
  const read = (patch) => splitWorld({ 'svc/tutor/mixed.ts': patch });
  // Tier 2 and Tier 3 edits need no Tier 1 row…
  for (const edited of [SPLIT_SRC.replace('1_500', '1_800'), SPLIT_SRC.replace('return rows.length;', 'return rows.length * 2;')]) {
    const e = read(edited);
    assert.deepEqual(checkLedger(signed, ledger, { read: e.read, fsList: e.fsList }), [], edited);
  }
  // …but an edit to the Tier 1 declaration, its doc comment, the imports, or a NEW declaration does.
  for (const edited of [
    SPLIT_SRC.replace('asks >= 2', 'asks >= 1'),
    SPLIT_SRC.replace('The non-negotiable.', 'The negotiable.'),
    SPLIT_SRC.replace("from './helper'", "from './otherHelper'"),
    `${SPLIT_SRC}\nexport function sneakyReveal() {\n  return true;\n}`,
  ]) {
    const e = read(edited);
    assert.ok(checkLedger(signed, ledger, { read: e.read, fsList: e.fsList }).some((p) => p.includes('safety.judge (tier_1) changed')), edited);
  }
  assert.equal(tierOf(['svc/tutor/mixed.ts#PACE_MS'], signed).tier, 'tier_2');
  assert.equal(tierOf(['svc/tutor/mixed.ts#summarize'], signed).tier, 'tier_3');
  assert.equal(tierOf(['svc/tutor/mixed.ts'], signed).tier, 'tier_1');
  // A Tier 2 parameter must sit in a Tier 2 declaration, not merely in a file that has one.
  const bounded = { ...signed, tier2Parameters: [{ id: 'pace', file: 'svc/tutor/mixed.ts', object: 'PACE_MS', field: 'x', bounds: [0, 1] }] };
  assert.ok(!checkTier2Parameters(bounded, w.read).some((p) => p.includes('not in a Tier 2 component')));
  const wrong = { ...signed, tier2Parameters: [{ id: 'reveal', file: 'svc/tutor/mixed.ts', object: 'neverRevealOnFirstAsk', field: 'x', bounds: [0, 1] }] };
  assert.ok(checkTier2Parameters(wrong, w.read).some((p) => p.includes('mixed.ts#neverRevealOnFirstAsk is not in a Tier 2 component')));
});

test('the automated-origin fence reads the declarations a commit changed', () => {
  const signed = splitRegistry({ signed: true });
  const bot = { sha: 'd'.repeat(40), name: 'mentor-loop', email: 'loop@example.com', body: 'Tune pace\n\nMentor-Change-Origin: automated\nMentor-Proposal: P-2026-10-01-latency', files: ['svc/tutor/mixed.ts'] };
  const records = [{ file: 'x', record: proposal({ paths: ['svc/tutor/mixed.ts#PACE_MS', 'svc/tutor/prompt.ts'] }) }];
  // Only the Tier 2 declaration changed, under a cleared proposal naming it: allowed.
  assert.deepEqual(checkCommits([{ ...bot, symbolChanges: { 'svc/tutor/mixed.ts': ['PACE_MS'] } }], signed, records, MANIFEST), []);
  // The same commit also touching the Tier 1 declaration, or the imports: never automated.
  for (const changed of [['PACE_MS', 'neverRevealOnFirstAsk'], [MODULE_SYMBOL]]) {
    const problems = checkCommits([{ ...bot, symbolChanges: { 'svc/tutor/mixed.ts': changed } }], signed, records, MANIFEST);
    assert.ok(problems.some((p) => p.includes('never automated')), changed.join());
  }
  // Unknown declaration-level changes fall back to the file, whose strictest claimant is Tier 1.
  assert.ok(checkCommits([bot], signed, records, MANIFEST).some((p) => p.includes('never automated')));
  // While the carve-out is unsigned, even the Tier 2 declaration is Tier 1.
  assert.ok(checkCommits([{ ...bot, symbolChanges: { 'svc/tutor/mixed.ts': ['PACE_MS'] } }], splitRegistry(), records, MANIFEST).some((p) => p.includes('never automated')));
});
