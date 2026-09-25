/*
 * `npm run transcript-judge` — C.21: the live transcript judge's dry-run path.
 *
 *   --batch=<file>     REQUIRED: the batch Core exports:
 *                        npm --prefix backend run tutor:evaluate -- --export-judge-batch=<file>
 *                      or, for a C.23 calibration, the gold set:
 *                        npm --prefix backend run tutor:judge-calibration -- --export-gold-batch=<file>
 *   (no mode flag)     DRY RUN, zero spend: the batch's intended labels stand in
 *                      for the judge ("fixture scorer"); prints the plan, the
 *                      judge identity and how many paid calls a live run makes.
 *   --replay=<file>    recompute agreement from an earlier LIVE output.
 *   --live             OWNER-RUN ONLY: one paid judge call per transcript.
 *                      Refused unless TRANSCRIPT_JUDGE_LIVE=approved and a judge
 *                      key is configured (OD-23).
 *   --out=<file>       write the run (verdicts, judge identity, rubric hash).
 *
 * Every result is labelled "uncalibrated: Tier 3 information only". A judge
 * may gate or record nothing until it is calibrated against a human panel
 * (C.23, Appendix E §3.2); Core's schema refuses judge-scored rows. A LIVE
 * run over the gold batch is recorded as a calibration by Core:
 *   npm --prefix backend run tutor:judge-calibration -- --record --judge=transcript_judge
 *     --run=<this --out file> --ratings=a.json,b.json --recorded-by="…" --note="…"
 */

import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { callJudge, runTranscriptJudge } from '../src/evaluation/transcriptJudge.js';

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const pct = (n: number | null) => (n === null ? 'n/a' : `${(n * 100).toFixed(1)}%`);

async function main(): Promise<number> {
  const live = process.argv.includes('--live');
  const replay = arg('replay');
  const batchFile = arg('batch');
  if (!batchFile) {
    console.error('--batch=<file> is required (npm --prefix backend run tutor:evaluate -- --export-judge-batch=<file>).');
    return 2;
  }
  const mode = live ? 'live' : replay ? 'replay' : 'dry_run';
  // The live path reads the service configuration only after the approval check.
  let judgeModel = process.env.JUDGE_MODEL_NAME ?? '(JUDGE_MODEL_NAME unset)';
  let authorModel: string | null = process.env.MODEL_NAME ?? null;
  let hasJudgeKey = false;
  if (live && process.env.TRANSCRIPT_JUDGE_LIVE === 'approved') {
    const { getConfig } = await import('../src/env.js');
    const config = getConfig();
    judgeModel = config.JUDGE_MODEL_NAME;
    authorModel = config.MODEL_NAME;
    hasJudgeKey = Boolean(config.JUDGE_API_KEY);
  }
  const outcome = await runTranscriptJudge({
    raw: JSON.parse(readFileSync(batchFile, 'utf8')),
    mode,
    replay: replay ? JSON.parse(readFileSync(replay, 'utf8')) : undefined,
    env: process.env,
    judgeModel,
    authorModel,
    hasJudgeKey,
    judge: live ? callJudge : undefined,
  });
  if (!outcome.ok) {
    console.error(`${outcome.code === 'refused' ? 'Refused' : 'Invalid'}: ${outcome.why}`);
    return 2;
  }
  const { run, agreement } = outcome;
  console.log(`Transcript judge — ${run.mode}; rubric ${run.rubric.version} (${run.rubric.hash.slice(0, 12)}); judge ${run.judge.model} / ${run.judge.promptHash.slice(0, 12)}`);
  console.log('  UNCALIBRATED: Tier 3 information only. A run gates nothing; only a calibration recorded by Core does (C.23).');
  if (run.mode === 'dry_run') console.log(`  Dry run: no judge call made; the intended labels stand in for the judge. A live run makes ${outcome.plannedCalls} paid call(s).`);
  if (run.mode === 'live') console.log(`  Live: ${outcome.paidCalls} paid call(s); ${Object.keys(run.verdicts).length} parsed.`);
  console.log(`  agreement with the intended labels (the author's, NOT a human panel): ${pct(agreement.rate)} over ${agreement.compared} verdict(s)`);
  for (const [criterion, c] of Object.entries(agreement.byCriterion)) console.log(`    ${criterion.padEnd(22)} ${pct(c.rate)} (${c.agreed}/${c.compared})`);
  for (const d of agreement.disagreements.slice(0, 20)) console.log(`    disagreement ${d.transcript} ${d.criterion}: intended ${d.intended}, judge ${d.judge}`);
  const out = arg('out');
  if (out) {
    writeFileSync(out, `${JSON.stringify(run, null, 2)}\n`);
    console.log(`  wrote ${out}`);
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
