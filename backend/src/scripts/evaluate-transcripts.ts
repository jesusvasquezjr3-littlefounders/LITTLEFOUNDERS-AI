#!/usr/bin/env node
/*
 * `npm run tutor:evaluate` — Product C.21 / C.24, the evaluation loop by hand.
 *
 *   (no flag)                  DRY RUN against the configured database: scores
 *                              the backlog and computes every consolidated
 *                              signal and anomaly, and WRITES NOTHING.
 *   --record                   the same pass the hourly workflow runs through
 *                              Core's internal route: writes the scores, the
 *                              flags, the snapshot and the run row.
 *   --limit=N                  sessions to score in this pass (default 500).
 *   --fixtures                 no database: scores the hand-written rubric
 *                              fixture set and compares every rule-scored
 *                              criterion with its intended outcome. Exit 1 on
 *                              any mismatch.
 *   --export-judge-batch=FILE  no database: writes the rubric (with its hash)
 *                              and the fixture transcripts for the owner-run
 *                              judge harness:
 *                                npm --prefix oracle run transcript-judge -- --batch=FILE
 *   --json                     machine-readable output.
 *
 * No model call, ever: zero spend (OD-23). Operator tool:
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run tutor:evaluate -- [--record]
 */

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { TRANSCRIPT_FIXTURES } from '../services/pedagogy/transcriptFixtures.js';
import { scoreSession } from '../services/pedagogy/transcriptScoring.js';
import { rubricForExport, RULES_CRITERIA } from '../services/pedagogy/transcriptRubric.js';

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

/** Scores every fixture; returns the mismatches with the rule-scored intended labels. */
export function checkFixtures(): { fixtures: number; checked: number; mismatches: { fixture: string; criterion: string; expected: string; got: string }[] } {
  const mismatches: { fixture: string; criterion: string; expected: string; got: string }[] = [];
  let checked = 0;
  for (const f of TRANSCRIPT_FIXTURES) {
    for (const s of scoreSession(f.bundle)) {
      checked += 1;
      if (f.expected[s.criterion] !== s.outcome) mismatches.push({ fixture: f.id, criterion: s.criterion, expected: f.expected[s.criterion] ?? '(none)', got: s.outcome });
    }
  }
  return { fixtures: TRANSCRIPT_FIXTURES.length, checked, mismatches };
}

/** The judge batch: the rubric and the fixture transcripts, text only as written for the fixtures. */
export function judgeBatch() {
  return {
    kind: 'mentor-transcript-judge-batch',
    source: 'fixtures',
    rubric: rubricForExport(),
    transcripts: TRANSCRIPT_FIXTURES.map((f) => ({
      id: f.id,
      tier: f.bundle.session.tier,
      locale: f.bundle.session.locale,
      closeReason: f.bundle.session.close_reason,
      turns: f.bundle.turns.map((t) => ({ speaker: t.speaker, text: t.text })),
      intended: f.expected,
    })),
  };
}

async function main(): Promise<number> {
  const json = process.argv.includes('--json');
  if (process.argv.includes('--fixtures')) {
    const r = checkFixtures();
    if (json) console.log(JSON.stringify(r, null, 2));
    else {
      console.log(`Rubric fixtures: ${r.fixtures} transcript(s), ${r.checked} rule-scored verdict(s) over ${RULES_CRITERIA.length} criteria.`);
      for (const m of r.mismatches) console.log(`  MISMATCH ${m.fixture} ${m.criterion}: intended ${m.expected}, scored ${m.got}`);
      console.log(r.mismatches.length === 0 ? 'Every verdict matches its intended outcome.' : `${r.mismatches.length} mismatch(es).`);
    }
    return r.mismatches.length === 0 ? 0 : 1;
  }
  const out = arg('export-judge-batch');
  if (out) {
    const batch = judgeBatch();
    writeFileSync(out, `${JSON.stringify(batch, null, 2)}\n`);
    console.log(`Wrote ${batch.transcripts.length} fixture transcript(s) and rubric ${batch.rubric.version} (${batch.rubric.hash.slice(0, 12)}) to ${out}.`);
    return 0;
  }

  // The database pass: imported here so --fixtures and --export run on a bare checkout.
  const { runEvaluationPass } = await import('../services/pedagogy/evaluationLoop.js');
  const record = process.argv.includes('--record');
  const limitRaw = arg('limit');
  const limit = limitRaw === null ? 500 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new Error('--limit must be a whole number between 1 and 5000');
  const result = await runEvaluationPass({ trigger: 'operator', limit, dryRun: !record });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\ntutor:evaluate — ${record ? 'RECORDED' : 'dry run (nothing written)'}; rubric ${result.rubricHash.slice(0, 12)}`);
    console.log(`  scored ${result.scoring.scored} session(s), ${result.scoring.failed} could not be scored; backlog before: ${result.scoring.backlogBefore ?? 'unknown'}`);
    console.log(`  signals: ${result.signals.total} (${result.signals.breach} in breach, ${result.signals.unavailable} unavailable)`);
    for (const r of result.readings ?? []) {
      if (r.status === 'not_instrumented' || r.status === 'external') continue;
      console.log(`    ${r.id.padEnd(36)} ${r.status.padEnd(17)} ${r.value === null ? '—' : r.value.toFixed(3)} (n=${r.sample})`);
    }
    for (const a of result.anomalies ?? []) console.log(`  FLAG ${a.severity} ${a.signalId} ${a.kind} ${a.scope} → ${a.owner}`);
    if (result.flags) console.log(`  flags: ${result.flags.opened} opened, ${result.flags.refreshed} refreshed, ${result.flags.failed} failed`);
    console.log(`  status: ${result.status}`);
  }
  return result.status === 'failed' ? 2 : result.signals.breach > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(2);
    },
  );
}
