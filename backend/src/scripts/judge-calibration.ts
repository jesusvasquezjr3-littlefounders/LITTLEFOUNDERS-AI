#!/usr/bin/env node
/*
 * `npm run tutor:judge-calibration` — Product C.23: calibrate every automated
 * evaluation judge against a human panel before it is trusted for anything,
 * and re-verify it on a cadence (Appendix E §2.1, §3.2; Appendix F §1.3).
 * The runbook is docs/rebuild/mentor/JUDGE-CALIBRATION-POLICY.md.
 *
 * Zero spend: nothing here calls a model (OD-23). The paid step, running the
 * real judge over the seed set, is owner-run in Oracle.
 *
 *   --status [--json]            every registered judge: trust state, scope,
 *                                verified at, due at (reads the database).
 *                                Exit 1 when a judge needs a human (not
 *                                passed, or due within 7 days).
 *   --export-rating-sheet=DIR    no database: the transcript gold set for the
 *                                human panel, BLIND (no intended label, no
 *                                judge verdict): a readable sheet and a JSON
 *                                template each rater fills in.
 *   --export-gold-batch=FILE     no database: the gold set as a judge batch
 *                                (with the rubric and its hash) for
 *                                  npm --prefix oracle run transcript-judge -- --batch=FILE [--live]
 *   --dry-run                    no database: the whole computation with the
 *                                author's labels standing in for the panel
 *                                and the judge. Proves the pipeline; NOT
 *                                recordable, by design.
 *   --record --judge=<id> --run=FILE --ratings=a.json,b.json --recorded-by="…" --note="…"
 *                                recomputes from the raw labels and verdicts and
 *                                records through record_mentor_judge_calibration.
 *                                --judge=transcript_judge: FILE is a LIVE run of
 *                                the transcript judge over the gold batch.
 *                                --judge=live_content_judge: FILE is the output of
 *                                `npm --prefix oracle run content-judge:calibrate
 *                                -- --live --ratings=… --out=FILE` (ratings inside).
 *     [--spot-check-of=<calibration id>]  records a spot check of that
 *                                calibration instead (smaller strata; a failed
 *                                spot check un-trusts the judge until a new
 *                                calibration passes).
 *   --verify-proposal=FILE       Stage 3 of a Tier 2 change: may the transcript
 *                                judge gate it? Reads the proposal record's
 *                                `stage3` and the calibration rows.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  computeJudgeCalibration,
  isJudgeId,
  JUDGE_IDS,
  JUDGE_REGISTRY,
  judgeTrust,
  readCalibrationRows,
  recordCalibration,
  verifyStage3,
  type CalibrationComputation,
  type CalibrationRunInput,
  type JudgeLabel,
  type RatingInput,
  type Stage3Claim,
} from '../services/pedagogy/judgeCalibration.js';
import {
  GOLD_QUESTIONS,
  goldLength,
  goldTurns,
  PANEL_GUIDANCE,
  TRANSCRIPT_GOLD_SET,
  TRANSCRIPT_GOLD_SET_HASH,
  TRANSCRIPT_GOLD_SET_VERSION,
} from '../services/pedagogy/transcriptGoldSet.js';
import { rubricForExport, TRANSCRIPT_RUBRIC_HASH } from '../services/pedagogy/transcriptRubric.js';

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const pct = (n: number | null) => (n === null ? 'n/a' : `${(n * 100).toFixed(1)}%`);

// ── exports for the panel and the judge (pure) ──────────────────────────────

/** The gold set as a judge batch (Oracle's `JudgeBatch`, source `gold_set`). */
export function goldBatch() {
  return {
    kind: 'mentor-transcript-judge-batch',
    source: 'gold_set',
    rubric: rubricForExport(),
    transcripts: TRANSCRIPT_GOLD_SET.map((t) => ({
      id: t.id,
      tier: t.tier,
      locale: t.locale,
      closeReason: t.closeReason,
      ageBand: t.ageBand,
      turns: goldTurns(t),
      intended: t.intended,
    })),
  };
}

/** The JSON a rater fills in: every label starts empty; nothing reveals the author's answer. */
export function ratingTemplate() {
  return {
    rater: '',
    source: 'human_panel',
    seedSet: { version: TRANSCRIPT_GOLD_SET_VERSION, hash: TRANSCRIPT_GOLD_SET_HASH },
    labels: Object.fromEntries(TRANSCRIPT_GOLD_SET.map((t) => [t.id, Object.fromEntries(GOLD_QUESTIONS.map((q) => [q, null]))])),
  };
}

/** The readable, blind sheet: transcripts in a shuffled-but-stable order, the questions and the guidance. */
export function ratingSheetMarkdown(): string {
  const lines: string[] = [
    `# Transcript judge calibration: rating sheet (${TRANSCRIPT_GOLD_SET_VERSION})`,
    '',
    `Seed-set hash: \`${TRANSCRIPT_GOLD_SET_HASH}\``,
    '',
    'Rate every transcript on all six questions, alone, without discussing them with another rater. Write',
    '`pass` when the Mentor did the right thing on that question, `fail` when it did not, and `not_applicable`',
    'when the transcript gives the question no opportunity. Fill the JSON template (`rating-template.json`)',
    'with your name as `rater`; keep `source` as `human_panel`.',
    '',
    '## The questions',
    '',
  ];
  for (const q of GOLD_QUESTIONS) {
    const g = PANEL_GUIDANCE[q];
    lines.push(`- **${q}**: ${g.question}`, `  - Applies when: ${g.applies}`, `  - Fail when: ${g.fail}`);
  }
  lines.push('', '## The transcripts', '');
  // Ordered by the opaque id: stable, and unrelated to the author's grouping, so strata are not visible.
  const ordered = [...TRANSCRIPT_GOLD_SET].sort((a, b) => a.id.localeCompare(b.id));
  for (const t of ordered) {
    lines.push(`### ${t.id}`, '', `Locale ${t.locale}; age band ${t.ageBand} (tier ${t.tier}).`, '');
    for (const turn of goldTurns(t)) lines.push(`- **${turn.speaker === 'tutor' ? 'Mentor' : 'Learner'}:** ${turn.text}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

// ── building a calibration input (pure, validated) ──────────────────────────

interface TranscriptRunFile {
  kind?: string;
  mode?: string;
  judge?: { model?: string; promptHash?: string; authorModel?: string | null };
  rubric?: { hash?: string };
  batch?: { source?: string };
  verdicts?: Record<string, Record<string, string>>;
}

interface RatingFile {
  rater?: string;
  source?: string;
  seedSet?: { version?: string; hash?: string };
  labels?: Record<string, Record<string, string | null>>;
}

const LABELS = new Set(['pass', 'fail', 'not_applicable']);

/** Parses one rater's file for the transcript gold set; refuses a file for another version. */
export function parseTranscriptRating(raw: unknown): { ok: true; rating: RatingInput } | { ok: false; why: string } {
  const r = raw as RatingFile | null;
  if (!r || typeof r.rater !== 'string' || r.rater.trim() === '') return { ok: false, why: 'a rating file names its rater' };
  if (typeof r.source !== 'string') return { ok: false, why: `${r.rater}: the rating file has no source` };
  if (r.seedSet?.hash !== TRANSCRIPT_GOLD_SET_HASH) {
    return { ok: false, why: `${r.rater}: rated a different gold set (${r.seedSet?.version ?? '?'}); export a new sheet` };
  }
  const labels: RatingInput['labels'] = {};
  for (const t of TRANSCRIPT_GOLD_SET) {
    const row = r.labels?.[t.id];
    labels[t.id] = {};
    for (const q of GOLD_QUESTIONS) {
      const v = row?.[q];
      if (typeof v !== 'string' || !LABELS.has(v)) return { ok: false, why: `${r.rater}: no label for ${t.id} / ${q}` };
      labels[t.id]![q] = v as JudgeLabel;
    }
  }
  for (const id of Object.keys(r.labels ?? {})) {
    if (!TRANSCRIPT_GOLD_SET.some((t) => t.id === id)) return { ok: false, why: `${r.rater}: label for unknown transcript ${id}` };
  }
  return { ok: true, rating: { rater: r.rater.trim(), source: r.source, labels } };
}

/**
 * The transcript judge's calibration input from a run file and the panel's
 * ratings. Refuses a run that is not over this gold set, not on the current
 * rubric, or missing a verdict (the recomputation refuses non-live modes).
 */
export function transcriptCalibrationInput(
  run: unknown,
  ratings: RatingInput[],
  kind: 'calibration' | 'spot_check',
  verifies: CalibrationRunInput['verifies'] = null,
): { ok: true; input: CalibrationRunInput } | { ok: false; why: string } {
  const r = run as TranscriptRunFile | null;
  if (!r || r.kind !== 'mentor-transcript-judge-run') return { ok: false, why: 'the run file is not a transcript-judge run' };
  if (r.batch?.source !== 'gold_set') return { ok: false, why: 'the run did not judge the gold set (export it with --export-gold-batch)' };
  if (r.rubric?.hash !== TRANSCRIPT_RUBRIC_HASH) return { ok: false, why: 'the run judged a different rubric than the current one' };
  if (!r.judge?.model || !r.judge.promptHash) return { ok: false, why: 'the run does not name its judge' };
  const verdicts: CalibrationRunInput['judge']['verdicts'] = {};
  for (const t of TRANSCRIPT_GOLD_SET) {
    verdicts[t.id] = {};
    for (const q of GOLD_QUESTIONS) {
      const v = r.verdicts?.[t.id]?.[q];
      // A missing verdict (an unparsed judge answer) stays missing: the
      // computation refuses the run rather than inventing a label.
      if (typeof v === 'string' && LABELS.has(v)) verdicts[t.id]![q] = v as JudgeLabel;
    }
  }
  return {
    ok: true,
    input: {
      judgeId: 'transcript_judge',
      kind,
      seedSet: {
        version: TRANSCRIPT_GOLD_SET_VERSION,
        hash: TRANSCRIPT_GOLD_SET_HASH,
        items: TRANSCRIPT_GOLD_SET.map((t) => ({ id: t.id, stratum: t.stratum, length: goldLength(t) })),
      },
      ratings,
      judge: { model: r.judge.model, promptHash: r.judge.promptHash, mode: r.mode ?? 'unknown', authorModel: r.judge.authorModel ?? null, verdicts },
      verifies,
    },
  };
}

/** The zero-spend dry run: the author's labels as two "raters" and as the "judge". */
export function dryRunComputation(): CalibrationComputation {
  const authorLabels = Object.fromEntries(TRANSCRIPT_GOLD_SET.map((t) => [t.id, { ...t.intended }]));
  return computeJudgeCalibration({
    judgeId: 'transcript_judge',
    kind: 'calibration',
    seedSet: {
      version: TRANSCRIPT_GOLD_SET_VERSION,
      hash: TRANSCRIPT_GOLD_SET_HASH,
      items: TRANSCRIPT_GOLD_SET.map((t) => ({ id: t.id, stratum: t.stratum, length: goldLength(t) })),
    },
    ratings: [
      { rater: 'seed-author', source: 'author_intended', labels: authorLabels },
      { rater: 'seed-author-copy', source: 'author_intended', labels: authorLabels },
    ],
    judge: { model: '(dry run: the author labels)', promptHash: 'dry-run', mode: 'dry_run', authorModel: null, verdicts: authorLabels },
  });
}

export function printComputation(result: CalibrationComputation): void {
  const t = result.thresholds;
  console.log(`  raters ${result.raters}; items ${result.items}`);
  console.log(`  panel: agreement ${pct(result.interRaterAgreement)} (≥ ${pct(t.interRater)}), Fleiss kappa ${result.interRaterKappa.toFixed(3)} (≥ ${t.interRaterKappa})`);
  console.log(`  judge family ${result.judgeFamily}, author family ${result.authorFamily}${result.sameFamily ? ' — SAME FAMILY (self-enhancement risk)' : ''}`);
  console.log(`  verbosity: agreement gap short vs long items ${result.lengthBiasGap === null ? 'n/a (too few items)' : pct(result.lengthBiasGap)} (≤ ${pct(t.lengthGap)})`);
  for (const s of result.strata) {
    console.log(
      `    ${s.question.padEnd(21)} ${s.stratum.padEnd(9)} n=${String(s.items).padStart(3)} pass ${String(s.panelPass).padStart(2)} fail ${String(s.panelFail).padStart(2)}  agreement ${pct(s.agreement).padStart(6)}  kappa ${s.questionKappa.toFixed(3)}  ${s.passed ? 'ok' : 'NOT MET'}`,
    );
  }
  console.log(`  calibrated scope: ${result.scope.length > 0 ? result.scope.join(', ') : '(none)'}`);
  if (result.failureReasons.length > 0) console.log(`  failure reasons: ${result.failureReasons.join(', ')}`);
  for (const d of result.disagreements.slice(0, 25)) console.log(`    disagreement ${d.item} ${d.question} (${d.stratum}): panel ${d.panel}, judge ${d.judge}`);
  console.log(`  verdict: ${result.verdict.toUpperCase()}${result.recordable ? '' : ' — NOT RECORDABLE'}`);
  for (const r of result.refusals.slice(0, 10)) console.log(`    - ${r}`);
}

// ── the commands ────────────────────────────────────────────────────────────

async function status(json: boolean): Promise<number> {
  const rows = await readCalibrationRows();
  if (rows === null) {
    console.error('Could not read mentor_judge_calibration (apply the migration and check the service key).');
    return 2;
  }
  const now = new Date();
  const trusts = JUDGE_IDS.map((id) => judgeTrust(id, rows, now));
  if (json) console.log(JSON.stringify(trusts, null, 2));
  else {
    console.log('JUDGE CALIBRATION (C.23)');
    for (const t of trusts) {
      const def = JUDGE_REGISTRY[t.judgeId];
      console.log(`  ${t.judgeId} (${def.requirement}): ${t.state.toUpperCase()}`);
      console.log(`    gates: ${def.gates}`);
      console.log(`    scope: ${t.scope.length > 0 ? t.scope.join(', ') : '(none)'}; verified ${t.verifiedAt ?? 'never'}; due ${t.dueAt ?? 'n/a'}${t.dueSoon ? ' (DUE SOON)' : ''}`);
      if (t.firstYearEndsAt) console.log(`    monthly cadence at least until ${t.firstYearEndsAt.slice(0, 10)}; quarterly only by a recorded Tier 1 decision`);
      if (t.state !== 'passed') console.log(`    next step: the panel rates the seed set, then the owner runs \`${def.harness}\` with ${def.liveApprovalEnv}=approved (OD-23)`);
    }
  }
  return trusts.some((t) => t.state !== 'passed' || t.dueSoon) ? 1 : 0;
}

async function record(): Promise<number> {
  const judgeId = arg('judge');
  const runFile = arg('run');
  const recordedBy = arg('recorded-by');
  const note = arg('note');
  const spotOf = arg('spot-check-of');
  if (!isJudgeId(judgeId) || !runFile || !recordedBy || !note || note.trim().length < 10) {
    console.error(`--record needs --judge=<${JUDGE_IDS.join('|')}> --run=FILE --recorded-by="<who>" --note="<what was run, 10+ characters>"`);
    return 2;
  }
  let verifies: CalibrationRunInput['verifies'] = null;
  if (spotOf) {
    const rows = await readCalibrationRows(judgeId);
    if (rows === null) {
      console.error('Could not read the calibration rows.');
      return 2;
    }
    const target = rows.find((r) => r.id === spotOf);
    if (!target || target.kind !== 'calibration' || target.verdict !== 'passed') {
      console.error(`--spot-check-of=${spotOf} is not a passed calibration of ${judgeId}.`);
      return 2;
    }
    verifies = { id: target.id, model: target.judge_model, promptHash: target.judge_prompt_hash, scope: target.scope ?? [] };
  }
  const kind = spotOf ? 'spot_check' : 'calibration';
  const run = JSON.parse(readFileSync(runFile, 'utf8')) as Record<string, unknown>;

  let input: CalibrationRunInput;
  if (judgeId === 'transcript_judge') {
    const ratingFiles = (arg('ratings') ?? '').split(',').filter(Boolean);
    const ratings: RatingInput[] = [];
    for (const f of ratingFiles) {
      const parsed = parseTranscriptRating(JSON.parse(readFileSync(f, 'utf8')));
      if (!parsed.ok) {
        console.error(`  ${f}: ${parsed.why}`);
        return 1;
      }
      ratings.push(parsed.rating);
    }
    const built = transcriptCalibrationInput(run, ratings, kind, verifies);
    if (!built.ok) {
      console.error(`NOT RECORDED: ${built.why}`);
      return 1;
    }
    input = built.input;
  } else {
    // The content judge's calibration file carries its ratings (S06.12 format).
    const { calibrationInputFrom } = await import('./live-content-report.js');
    const content = calibrationInputFrom(run as never);
    const asQ = (labels: Record<string, string>) => Object.fromEntries(Object.entries(labels).map(([id, l]) => [id, { approve: l as JudgeLabel }]));
    input = {
      judgeId: 'live_content_judge',
      kind,
      seedSet: {
        version: content.seedSet.version,
        hash: content.seedSet.hash,
        items: content.seedSet.items.map((i) => ({ id: i.id, stratum: i.category, length: i.length ?? 0 })),
      },
      ratings: content.ratings.map((r) => ({ rater: r.rater, source: r.source, labels: asQ(r.labels) })),
      judge: { ...content.judge, authorModel: content.judge.authorModel ?? null, verdicts: asQ(content.judge.verdicts) },
      verifies,
    };
  }

  const result = computeJudgeCalibration(input);
  console.log(`${judgeId} — ${kind}; seed ${input.seedSet.version} (${input.seedSet.hash.slice(0, 12)}); judge ${input.judge.model} (${input.judge.mode})`);
  printComputation(result);
  if (!result.recordable) {
    console.error('\nNOT RECORDED (see the refusals above).');
    return 1;
  }
  const outcome = await recordCalibration({
    result,
    seedSet: { version: input.seedSet.version, hash: input.seedSet.hash },
    judge: { model: input.judge.model, promptHash: input.judge.promptHash, authorModel: input.judge.authorModel },
    verifiesId: verifies?.id ?? null,
    recordedBy: recordedBy.trim(),
    note: note.trim(),
  });
  if (!outcome.ok) {
    console.error(`\nNOT RECORDED: ${outcome.why}`);
    return 1;
  }
  console.log(`\nRecorded ${kind} ${outcome.id}: ${result.verdict.toUpperCase()}.`);
  return result.verdict === 'passed' ? 0 : 1;
}

async function verifyProposal(file: string): Promise<number> {
  const proposal = JSON.parse(readFileSync(file, 'utf8')) as { id?: string; stage3?: Stage3Claim | null };
  if (!proposal.stage3) {
    console.log(`${proposal.id ?? file}: no Stage 3 claim — the change goes to Stage 4 (human review), as Tier 1 would.`);
    return 1;
  }
  const rows = await readCalibrationRows('transcript_judge');
  if (rows === null) {
    console.error('Could not read the calibration rows: the judge cannot gate (fail closed).');
    return 2;
  }
  const verdict = verifyStage3(proposal.stage3, rows);
  if (verdict.mayGate) {
    console.log(`${proposal.id ?? file}: the calibrated transcript judge MAY gate Stage 3 on ${proposal.stage3.criteria.join(', ')}.`);
    return 0;
  }
  console.log(`${proposal.id ?? file}: the judge may NOT gate Stage 3; route the change to Stage 4 (human review).`);
  for (const r of verdict.reasons) console.log(`  - ${r}`);
  return 1;
}

async function main(): Promise<number> {
  const sheetDir = arg('export-rating-sheet');
  if (sheetDir) {
    mkdirSync(sheetDir, { recursive: true });
    writeFileSync(path.join(sheetDir, 'rating-sheet.md'), ratingSheetMarkdown());
    writeFileSync(path.join(sheetDir, 'rating-template.json'), `${JSON.stringify(ratingTemplate(), null, 2)}\n`);
    console.log(`Wrote the blind rating sheet for ${TRANSCRIPT_GOLD_SET.length} transcripts (${TRANSCRIPT_GOLD_SET_VERSION}) to ${sheetDir}.`);
    return 0;
  }
  const batchFile = arg('export-gold-batch');
  if (batchFile) {
    const batch = goldBatch();
    writeFileSync(batchFile, `${JSON.stringify(batch, null, 2)}\n`);
    console.log(`Wrote the gold batch (${batch.transcripts.length} transcripts, rubric ${batch.rubric.hash.slice(0, 12)}) to ${batchFile}.`);
    console.log(`A live run makes ${batch.transcripts.length} paid call(s): TRANSCRIPT_JUDGE_LIVE=approved npm --prefix oracle run transcript-judge -- --batch=${batchFile} --live --out=<run.json>`);
    return 0;
  }
  if (process.argv.includes('--dry-run')) {
    console.log(`transcript_judge — DRY RUN over ${TRANSCRIPT_GOLD_SET_VERSION} (${TRANSCRIPT_GOLD_SET_HASH.slice(0, 12)}): the author's labels stand in for the panel AND the judge. No model call.`);
    const result = dryRunComputation();
    printComputation(result);
    return result.scope.length === GOLD_QUESTIONS.length && !result.recordable ? 0 : 1;
  }
  const proposal = arg('verify-proposal');
  if (proposal) return verifyProposal(proposal);
  if (process.argv.includes('--record')) return record();
  if (process.argv.includes('--status')) return status(process.argv.includes('--json'));
  console.error('Choose one: --status | --export-rating-sheet=DIR | --export-gold-batch=FILE | --dry-run | --record … | --verify-proposal=FILE');
  return 2;
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
