/*
 * `npm run content-judge:calibrate` — C.5 / Appendix E §2.1/§3.2: compare the
 * live-content judge with the human panel on the seed set.
 *
 *   (no flag)            DRY RUN, zero spend: checks the seed set, uses the
 *                        seed author's intended labels as both the "panel"
 *                        and the "judge", and prints the plan. Writes a
 *                        calibration file only with --out; Core refuses to
 *                        record it (not the human panel, not a live judge).
 *   --ratings=a.json,b.json
 *                        the human panel's rating files ({ rater, source:
 *                        "human_panel", labels: { <item id>: "pass"|"fail" } }),
 *                        at least two
 *   --replay=<file>      judge verdicts from an earlier live run's output
 *                        (recomputes; not recordable as a new calibration)
 *   --live               OWNER-RUN ONLY: one paid judge call per seed item
 *                        (44 today). Refuses unless
 *                        CONTENT_JUDGE_CALIBRATION_LIVE=approved and a judge
 *                        key is configured (OD-23).
 *   --out=<file>         write the calibration file for Core:
 *                        npm --prefix backend run tutor:live-content-report --
 *                          --record-calibration=<file> --recorded-by="…" --note="…"
 *
 * The judge identity recorded is JUDGE_MODEL_NAME plus the SHA-256 of the
 * judge's prompt (CONTENT_JUDGE_PROMPT_HASH). Core refuses a live item whose
 * judge does not match the latest passed calibration, so a prompt or model
 * change requires a new run.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { getConfig } from '../src/env.js';
import { CONTENT_JUDGE_PROMPT_HASH, judgeCandidate } from '../src/content/generate.js';
import {
  authorIntendedRatings,
  dryRunVerdicts,
  parseRatingSet,
  previewAgreement,
  readSeedSet,
  seedSetProblems,
  type CalibrationFile,
  type RatingSet,
  type SeedLabel,
} from '../src/content/judgeCalibration/harness.js';

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const pct = (n: number | null) => (n === null ? 'n/a' : `${(n * 100).toFixed(1)}%`);

async function main(): Promise<number> {
  const seed = readSeedSet();
  const problems = seedSetProblems(seed);
  console.log(`Seed set ${seed.version}: ${seed.items.length} items (${seed.items.filter((i) => i.category === 'standard').length} standard, ${seed.items.filter((i) => i.category === 'sensitive').length} sensitive)`);
  if (problems.length > 0) {
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }

  let ratings: RatingSet[];
  const ratingFiles = arg('ratings');
  if (ratingFiles) {
    ratings = [];
    for (const file of ratingFiles.split(',').filter(Boolean)) {
      const parsed = parseRatingSet(JSON.parse(readFileSync(file, 'utf8')), seed);
      if (!parsed.ok) {
        console.error(`  ${file}: ${parsed.why}`);
        return 1;
      }
      ratings.push(parsed.rating);
    }
  } else {
    ratings = [authorIntendedRatings(seed)];
    console.log('  No --ratings: using the seed author\'s intended labels (NOT the human panel; not recordable).');
  }

  let judge: CalibrationFile['judge'];
  const replay = arg('replay');
  // The dry run reads no service configuration (it runs on a bare checkout);
  // the live run needs the real one.
  const judgeModelName = process.env.JUDGE_MODEL_NAME ?? '(JUDGE_MODEL_NAME unset)';
  if (process.argv.includes('--live')) {
    if (process.env.CONTENT_JUDGE_CALIBRATION_LIVE !== 'approved') {
      console.error('Refused: --live makes one PAID judge call per seed item. Set CONTENT_JUDGE_CALIBRATION_LIVE=approved (owner approval, OD-23).');
      return 2;
    }
    const config = getConfig();
    if (!config.JUDGE_API_KEY) {
      console.error('Refused: no judge is configured (JUDGE_API_KEY).');
      return 2;
    }
    const verdicts: Record<string, SeedLabel> = {};
    for (const item of seed.items) {
      const verdict = await judgeCandidate(item.segment, item.tier);
      verdicts[item.id] = verdict.pass ? 'pass' : 'fail';
      console.log(`  ${item.id} ${verdicts[item.id]}${verdict.reason ? ` — ${verdict.reason}` : ''}`);
    }
    judge = { model: config.JUDGE_MODEL_NAME, promptHash: CONTENT_JUDGE_PROMPT_HASH, mode: 'live', authorModel: config.MODEL_NAME, verdicts };
  } else if (replay) {
    const previous = JSON.parse(readFileSync(replay, 'utf8')) as CalibrationFile;
    judge = { ...previous.judge, mode: 'replay' };
  } else {
    judge = { model: judgeModelName, promptHash: CONTENT_JUDGE_PROMPT_HASH, mode: 'dry_run', authorModel: process.env.MODEL_NAME ?? null, verdicts: dryRunVerdicts(seed) };
    console.log(`  Dry run: no judge call made. Judge identity ${judgeModelName} / ${CONTENT_JUDGE_PROMPT_HASH.slice(0, 12)}; a live run makes ${seed.items.length} paid call(s).`);
  }

  const file: CalibrationFile = { seedSet: seed, ratings, judge };
  const preview = previewAgreement(file);
  console.log(`  inter-rater agreement ${pct(preview.interRater)}; judge-human agreement: standard ${pct(preview.byCategory.standard.agreement)} (${preview.byCategory.standard.n}), sensitive ${pct(preview.byCategory.sensitive.agreement)} (${preview.byCategory.sensitive.n})`);
  const recordable = judge.mode === 'live' && ratings.length >= 2 && ratings.every((r) => r.source === 'human_panel');
  console.log(`  recordable by Core: ${recordable ? 'yes' : 'no (needs the live judge and at least two human-panel rating sets)'}`);

  const out = arg('out');
  if (out) {
    writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
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
