/*
 * `npm run equity-audit` — C.18 / C.20 / Appendix D §3.7: THE EQUITY-DRIFT
 * AUDIT of the Mentor's praise and feedback against learner identity cues.
 *
 * A thin CLI over `src/safety/equityAudit/` (vitest suite:
 * `src/__tests__/equityAudit.test.ts`). Policy:
 * docs/rebuild/mentor/EQUITY-AUDIT-POLICY.md.
 *
 *   (no flag)       the zero-spend DRY RUN: every scripted session replayed
 *                   through the real orchestrator for every identity cue,
 *                   answered by the cue-blind scripted model; print the
 *                   report; exit 1 on any failure
 *   --json          the same report as JSON
 *   --check [--require-live]
 *                   also fail on a material change since the last recorded
 *                   run, an overdue cadence or an open live drift finding;
 *                   warn (fail with --require-live) while live evidence is
 *                   pending or stale (the scheduled mentor-equity-audit.yml
 *                   runs --check)
 *   --record [--trigger initial|cadence|material_change|model_change] [--notes "..."]
 *                   run and append the entry to
 *                   `src/safety/equityAudit/audit-log.json` (commit it); a
 *                   dry run is recorded only when it passes
 *   --live-plan     print what the live run would send and how many model
 *                   calls it would make; sends nothing
 *   --live [--repeats N] [--record]
 *                   OWNER-RUN ONLY (paid model calls; OD-23 forbids spend
 *                   without approval). Refuses unless
 *                   EQUITY_AUDIT_LIVE=approved and a model key is configured.
 *
 * Nothing but the model call ever leaves the process: Core, Depot and the
 * moderation judge are refused offline inside the harness.
 */

import process from 'node:process';

// The dry run needs a parseable configuration and nothing real. Placeholders
// (the `test-` prefix the secrets gate exempts) fill only what is unset; the
// model key is never used by the dry run, whose fetch never leaves the process.
const DRY_RUN_ENV: Record<string, string> = {
  INTERNAL_API_KEY: 'test-equity-internal-key-0123456789',
  TUTOR_SESSION_SECRET: 'test-equity-session-secret-0123456789abcd',
  CORE_URL: 'http://localhost:4000',
  CORE_INTERNAL_KEY: 'test-equity-core-key-0123456789',
  REDIS_URL: 'redis://localhost:6379',
  VOICE_PROVIDER: 'none',
};
const live = process.argv.includes('--live');
for (const [key, value] of Object.entries(DRY_RUN_ENV)) process.env[key] ??= value;
if (!live) process.env.MODEL_API_KEY = 'test-equity-dry-run-model-key';

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function main(): Promise<number> {
  const { runEquityAudit, livePlan, DEFAULT_REPEATS, EQUITY_MIN_SAMPLE } = await import('../src/safety/equityAudit/audit.js');
  const { liveResponder, stubResponder } = await import('../src/safety/equityAudit/harness.js');
  const log = await import('../src/safety/equityAudit/auditLog.js');
  const { getConfig } = await import('../src/env.js');
  type Report = Awaited<ReturnType<typeof runEquityAudit>>;

  const printHuman = (report: Report): void => {
    console.log(`== Equity-drift audit (${report.mode === 'stub' ? 'DRY RUN, scripted cue-blind model, zero spend' : `LIVE, ${report.model}`}) ==`);
    console.log(
      `  ${report.cues} identity cues, ${report.sessions} sessions (${report.repeats} repeat(s)), ${report.modelCalls} model calls; minimum ${EQUITY_MIN_SAMPLE} per compared group`,
    );
    console.log(
      `  controlled variation: ${report.controlled.ok ? 'ok' : 'FAILED'} (${report.controlled.compared} cue replays compared with their locale's reference)`,
    );
    for (const v of report.controlled.violations.slice(0, 10)) {
      console.log(`    ↳ ${v.scriptId} #${v.repeat} ${v.cue} vs ${v.reference}: ${v.reason}${v.request === null ? '' : ` at request ${v.request}`}`);
    }
    console.log(`  false affirmations delivered: ${report.falseAffirmationsDelivered} (must be 0)`);
    console.log('');
    for (const cell of report.cells) {
      const mark = cell.verdict === 'ok' ? 'ok   ' : cell.verdict === 'drift' ? 'DRIFT' : 'n<min';
      const groups = cell.groups.map((g) => `${g.group} ${g.rate === null ? '-' : g.rate.toFixed(3)} (n=${g.n})`).join('  ');
      const spread = cell.drift === null ? '' : ` spread ${cell.drift.toFixed(3)} / tol ${cell.tolerance}`;
      console.log(`  ${mark} ${cell.scope} ${cell.dimension} ${cell.metric}${spread}`);
      console.log(`        ${groups}`);
    }
    console.log('');
    console.log(
      `equity-audit ${report.ok ? 'OK' : 'FAILED'} — ${report.totals.judged} cells judged, ${report.totals.drifting} drifting, ${report.totals.insufficient} below the minimum sample.`,
    );
  };

  if (process.argv.includes('--live-plan')) {
    const dry = await runEquityAudit({ repeats: 1 });
    const repeats = Number(argValue('--repeats') ?? DEFAULT_REPEATS.live);
    const plan = livePlan(dry, repeats);
    console.log('== Live equity-drift audit plan (nothing is sent) ==');
    console.log(`  model: ${getConfig().MODEL_NAME} at ${getConfig().MODEL_API_BASE}`);
    console.log(`  ${dry.cues} identity cues x their locale's scripts x ${repeats} repeats = ${plan.sessions} sessions`);
    console.log(`  about ${plan.estimatedCalls} model calls (the dry run's count; a live model's repairs can add some)`);
    console.log('Owner-run: EQUITY_AUDIT_LIVE=approved npm run equity-audit -- --live --record --trigger initial');
    return 0;
  }

  let responder = stubResponder;
  if (live) {
    if (process.env.EQUITY_AUDIT_LIVE !== 'approved') {
      console.error('Refusing: --live makes paid model calls for every replayed turn (OD-23).');
      console.error('The owner approves the spend and runs it with EQUITY_AUDIT_LIVE=approved.');
      return 2;
    }
    if (!getConfig().MODEL_API_KEY) {
      console.error('Refusing: no MODEL_API_KEY is configured for the live run.');
      return 2;
    }
    responder = liveResponder(globalThis.fetch);
  }
  const repeatsArg = argValue('--repeats');
  const report = await runEquityAudit({ responder, repeats: repeatsArg === null ? undefined : Number(repeatsArg) });
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);

  const now = new Date();
  if (process.argv.includes('--record')) {
    const trigger = (argValue('--trigger') ?? 'material_change') as Parameters<typeof log.entryFor>[2];
    let entry;
    try {
      entry = log.entryFor(report, now.toISOString().slice(0, 10), trigger, argValue('--notes') ?? '');
    } catch (error) {
      console.error(`Not recorded: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
    log.appendEquityEntry(entry);
    console.log(`Recorded the ${entry.date} ${entry.mode} run (${trigger}, ${entry.verdict}). Commit src/safety/equityAudit/audit-log.json.`);
    return entry.verdict === 'ok' ? 0 : 1;
  }

  if (process.argv.includes('--check')) {
    const result = log.checkEquity(report, log.readEquityLog(), now, {
      model: getConfig().MODEL_NAME,
      requireLive: process.argv.includes('--require-live'),
    });
    for (const warning of result.warnings) console.warn(`  ! ${warning}`);
    for (const problem of result.problems) console.error(`  ✗ ${problem}`);
    console.log(`live evidence: ${result.live}`);
    return result.problems.length === 0 ? 0 : 1;
  }
  return report.ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
