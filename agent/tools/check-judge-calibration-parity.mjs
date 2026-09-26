#!/usr/bin/env node
/**
 * C.23 — THE JUDGE-CALIBRATION STANDARD, HAND-WRITTEN IN EVERY PACKAGE, AND
 * ITS TIER 1 FLOORS (Appendix E §2.1, §3.2; Appendix F §1.3).
 *
 * The 11 packages share no types (CLAUDE.md), so the calibration vocabulary
 * is typed out more than once:
 *
 *   Core    backend/src/services/pedagogy/judgeCalibration.ts   judges, kinds, questions, strata,
 *                                                             failure reasons, the floors, the
 *                                                             per-judge standard
 *           backend/src/services/pedagogy/liveContentGovernance.ts  the live gate reads it
 *           backend/src/services/pedagogy/mentorQuality.ts      the dashboard signal
 *           backend/src/scripts/judge-calibration.ts            the gold batch it exports
 *   Oracle  oracle/src/evaluation/transcriptJudge.ts            the batch/run it reads and writes
 *           oracle/scripts/content-judge-calibration.ts         the content judge's run file
 *   DB      database/migrations/*_mentor_judge_calibration_registry.sql  CHECKs, floors, the function
 *
 * A drift fails in the worst direction: a CHECK refuses the row a passed
 * calibration must write (the judge then stays untrusted forever, silently),
 * or a floor lowered in one copy lets a weaker judge through. THE FLOOR GUARD
 * (Tier 1): the thresholds may be RAISED by a human decision; lowering any of
 * them is a Tier 1 change, after which this guard changes in the same
 * reviewed change.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FILES = {
  core: 'backend/src/services/pedagogy/judgeCalibration.ts',
  liveGate: 'backend/src/services/pedagogy/liveContentGovernance.ts',
  quality: 'backend/src/services/pedagogy/mentorQuality.ts',
  cli: 'backend/src/scripts/judge-calibration.ts',
  oracleJudge: 'oracle/src/evaluation/transcriptJudge.ts',
  oracleContent: 'oracle/scripts/content-judge-calibration.ts',
};

/** The Tier 1 floors (proposed, pending calibration; never lowered here without review). */
export const FLOORS = {
  interRaterAgreement: { min: 0.85 },
  interRaterKappa: { min: 0.6 },
  judgeAgreement: { min: 0.9 },
  judgeKappa: { min: 0.7 },
  lengthBiasMaxGap: { max: 0.15 },
};
export const JUDGE_MINIMUMS = {
  live_content_judge: { minItemsPerStratum: 20, minItemsPerQuestion: 40, minPerLabel: 5 },
  transcript_judge: { minItemsPerStratum: 10, minItemsPerQuestion: 20, minPerLabel: 3 },
};
export const MAX_AGE_DAYS = 35;
/** The SQL CHECK floors the migration must keep. */
export const SQL_FLOORS = {
  threshold_inter_rater: 0.85,
  threshold_inter_rater_kappa: 0.6,
  threshold_agreement: 0.9,
  threshold_judge_kappa: 0.7,
};

const quoted = (text) => [...text.matchAll(/'([A-Za-z_.:-]+)'/g)].map((m) => m[1]);
const sameSet = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

export function arrayConst(source, name) {
  const m = new RegExp(`\\b${name}\\b[^=\\n]*=\\s*\\[([^\\]]*)\\]`).exec(source);
  return m ? quoted(m[1]) : null;
}

export function numericField(source, objectName, field) {
  const start = source.indexOf(objectName);
  if (start === -1) return null;
  const m = new RegExp(`\\b${field}:\\s*([0-9._]+)`).exec(source.slice(start));
  return m ? Number(m[1].replace(/_/g, '')) : null;
}

/** A judge's standard block in JUDGE_REGISTRY (from `<judge>: {` to its `harness:` line). */
export function judgeBlock(source, judge) {
  const start = source.indexOf(`  ${judge}: {`, source.indexOf('export const JUDGE_REGISTRY'));
  if (start === -1) return null;
  const end = source.indexOf('harness:', start);
  return source.slice(start, end === -1 ? undefined : end);
}

/** The IN (...) list or ARRAY[...] of a column in the migration. */
export function sqlVocab(sql, column) {
  const inList = new RegExp(`\\b${column}\\s+text[^\\n]*?IN\\s*\\(([^)]*)\\)`, 'i').exec(sql) ?? new RegExp(`\\b${column}\\s+IN\\s*\\(([^)]*)\\)`, 'i').exec(sql);
  if (inList) return quoted(inList[1]);
  const arr = new RegExp(`\\b${column}\\s+text\\[\\][^;]*?ARRAY\\[([^\\]]*)\\]`, 'is').exec(sql);
  return arr ? quoted(arr[1]) : null;
}

export function sqlFloor(sql, column) {
  const m = new RegExp(`${column}\\s+numeric\\([^)]*\\)\\s+NOT NULL CHECK \\(${column} BETWEEN ([0-9.]+) AND ([0-9.]+)\\)`).exec(sql);
  return m ? { low: Number(m[1]), high: Number(m[2]) } : null;
}

export function checkJudgeCalibrationParity(read, sql) {
  const problems = [];
  if (!sql) return ['the *_mentor_judge_calibration_registry.sql migration is missing'];
  const src = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, read(f)]));
  for (const [k, text] of Object.entries(src)) if (text === null) problems.push(`${FILES[k]} is missing`);
  if (problems.length > 0) return problems;

  const compare = (label, expected, where, list) => {
    if (!expected || expected.length === 0) problems.push(`${label}: could not read the Core list`);
    else if (!list) problems.push(`${label}: could not read ${where}`);
    else if (!sameSet(expected, list)) problems.push(`${label}: ${where} has [${list.join(', ')}], Core has [${expected.join(', ')}]`);
  };
  compare('judge ids', arrayConst(src.core, 'JUDGE_IDS'), 'the migration CHECK on judge_id', sqlVocab(sql, 'judge_id'));
  compare('calibration kinds', arrayConst(src.core, 'CALIBRATION_KINDS'), 'the migration CHECK on kind', sqlVocab(sql, 'kind'));
  compare('strata', arrayConst(src.core, 'CALIBRATION_STRATA'), 'the migration CHECK on stratum', sqlVocab(sql, 'stratum'));
  compare('questions', arrayConst(src.core, 'CALIBRATION_QUESTIONS'), 'the migration CHECK on question', sqlVocab(sql, 'question'));
  compare('questions', arrayConst(src.core, 'CALIBRATION_QUESTIONS'), 'the migration ARRAY on scope', sqlVocab(sql, 'scope'));
  compare('failure reasons', arrayConst(src.core, 'FAILURE_REASONS'), 'the migration ARRAY on failure_reasons', sqlVocab(sql, 'failure_reasons'));

  // ── the floors (Core) ──
  for (const [field, bound] of Object.entries(FLOORS)) {
    const value = numericField(src.core, 'export const CALIBRATION_FLOORS', field);
    if (value === null) problems.push(`${FILES.core}: could not read CALIBRATION_FLOORS.${field}`);
    else if ('min' in bound && value < bound.min) problems.push(`CALIBRATION_FLOORS.${field} lowered to ${value} (floor ${bound.min}): a Tier 1 change`);
    else if ('max' in bound && value > bound.max) problems.push(`CALIBRATION_FLOORS.${field} loosened to ${value} (ceiling ${bound.max}): a Tier 1 change`);
  }
  const maxAge = numericField(src.core, 'const BASE', 'maxAgeDays');
  if (maxAge === null) problems.push(`${FILES.core}: could not read the cadence (maxAgeDays)`);
  else if (maxAge > MAX_AGE_DAYS) problems.push(`the calibration cadence is ${maxAge} days, looser than Appendix F's monthly (${MAX_AGE_DAYS} with grace)`);
  for (const [judge, minimums] of Object.entries(JUDGE_MINIMUMS)) {
    const block = judgeBlock(src.core, judge);
    if (!block) {
      problems.push(`${FILES.core}: JUDGE_REGISTRY has no ${judge}`);
      continue;
    }
    for (const [field, min] of Object.entries(minimums)) {
      const m = new RegExp(`\\b${field}:\\s*(\\d+)`).exec(block);
      if (!m) problems.push(`${judge}: could not read ${field}`);
      else if (Number(m[1]) < min) problems.push(`${judge}.${field} lowered to ${m[1]} (minimum ${min}): a Tier 1 change`);
    }
    if (!/cadence:\s*'monthly'/.test(block)) problems.push(`${judge}: the cadence is not monthly (quarterly needs a recorded Tier 1 decision and this guard updated with it)`);
  }

  // ── the floors (migration) ──
  for (const [column, min] of Object.entries(SQL_FLOORS)) {
    const f = sqlFloor(sql, column);
    if (!f) problems.push(`migration: could not read the CHECK floor of ${column}`);
    else if (f.low < min) problems.push(`migration: ${column} may be recorded as low as ${f.low} (floor ${min})`);
  }
  const gap = sqlFloor(sql, 'threshold_length_gap');
  if (!gap) problems.push('migration: could not read the CHECK on threshold_length_gap');
  else if (gap.high > FLOORS.lengthBiasMaxGap.max) problems.push(`migration: threshold_length_gap may be recorded as high as ${gap.high}`);
  for (const [judge, m] of Object.entries(JUDGE_MINIMUMS)) {
    const re = new RegExp(`judge_id = '${judge}' AND \\(\\s*\\(kind = 'calibration' AND min_items_per_stratum >= (\\d+) AND min_items_per_question >= (\\d+) AND min_per_label >= (\\d+)\\)`);
    const hit = re.exec(sql);
    if (!hit) problems.push(`migration: could not read ${judge}'s minimum strata`);
    else if (Number(hit[1]) < m.minItemsPerStratum || Number(hit[2]) < m.minItemsPerQuestion || Number(hit[3]) < m.minPerLabel) {
      problems.push(`migration: ${judge}'s minimum strata were lowered (${hit.slice(1).join('/')})`);
    }
  }
  for (const needle of ['NOT same_family', "RAISE EXCEPTION 'the claimed scope", 'a spot check must re-verify a passed calibration of the same judge identity', 'v_kappa >= v_row.threshold_judge_kappa']) {
    if (!sql.includes(needle)) problems.push(`migration: the recording function no longer enforces "${needle}"`);
  }
  if (!/ENABLE ROW LEVEL SECURITY/.test(sql) || /CREATE POLICY/.test(sql)) problems.push('migration: the calibration tables must have RLS enabled and no client policy');

  // ── who reads it ──
  if (!/readCalibrationRows\('live_content_judge'/.test(src.liveGate)) problems.push(`${FILES.liveGate}: the live gate no longer reads mentor_judge_calibration`);
  if (!/id: 'transcript_judge\.agreement'[^\n]*instrumented: 'yes'/.test(src.quality)) problems.push(`${FILES.quality}: the transcript judge's calibration is not on the dashboard`);

  // ── Oracle reads Core's gold batch and writes what Core records ──
  if (!/source: z\.enum\(\[[^\]]*'gold_set'[^\]]*\]\)/.test(src.oracleJudge)) problems.push(`${FILES.oracleJudge}: the batch schema does not admit source 'gold_set'`);
  if (!/ageBand: z\.enum\(\['child', 'teen', 'adult'\]\)/.test(src.oracleJudge)) problems.push(`${FILES.oracleJudge}: the batch schema does not carry the age band`);
  if (!/authorModel: string \| null/.test(src.oracleJudge)) problems.push(`${FILES.oracleJudge}: the run does not carry the author model (self-enhancement check)`);
  if (!/source: 'gold_set'/.test(src.cli)) problems.push(`${FILES.cli}: the gold batch is not exported as source 'gold_set'`);
  if (!/authorModel:/.test(src.oracleContent)) problems.push(`${FILES.oracleContent}: the content judge's run does not carry the author model`);

  // ── live runs stay owner-approved (OD-23) ──
  for (const [judge, env, file] of [['live_content_judge', 'CONTENT_JUDGE_CALIBRATION_LIVE', src.oracleContent], ['transcript_judge', 'TRANSCRIPT_JUDGE_LIVE', src.oracleJudge]]) {
    if (!new RegExp(`liveApprovalEnv: '${env}'`).test(judgeBlock(src.core, judge) ? src.core.slice(src.core.indexOf(`  ${judge}: {`)) : '')) problems.push(`${judge}: the registry does not name ${env}`);
    if (!new RegExp(`${env} !== 'approved'`).test(file)) problems.push(`${judge}: the Oracle harness no longer refuses a live run without ${env}=approved`);
  }
  return problems;
}

function main() {
  const read = (f) => {
    try {
      return readFileSync(path.join(ROOT, f), 'utf8');
    } catch {
      return null;
    }
  };
  const dir = path.join(ROOT, 'database/migrations');
  const file = existsSync(dir) ? readdirSync(dir).find((f) => /_mentor_judge_calibration_registry\.sql$/.test(f)) : undefined;
  const sql = file ? readFileSync(path.join(dir, file), 'utf8') : null;
  const problems = checkJudgeCalibrationParity(read, sql);
  if (problems.length > 0) {
    console.error('judge-calibration:check FAILED:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('judge-calibration:check OK — Core, Oracle and the migration agree on the calibration vocabulary; the Tier 1 floors, the per-judge minimums and the monthly cadence are intact; live runs stay owner-approved');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
