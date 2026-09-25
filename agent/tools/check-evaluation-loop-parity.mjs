#!/usr/bin/env node
/**
 * C.21 + C.24 — THE EVALUATION-LOOP AND DASHBOARD VOCABULARIES, HAND-WRITTEN
 * IN EVERY PACKAGE, AND THE APPENDIX F SERVICE LEVELS.
 *
 * The 11 packages share no types (CLAUDE.md), so these are typed out more
 * than once:
 *
 *   Core     backend/src/services/pedagogy/transcriptRubric.ts   the rubric criteria
 *            backend/src/services/pedagogy/transcriptScoring.ts  the score outcomes
 *            backend/src/services/pedagogy/mentorQuality.ts      owner roles, flag kinds,
 *                                                                severities, statuses, SLAs
 *            backend/src/routes/tutor.ts                          the internal run route
 *   Oracle   oracle/src/evaluation/transcriptJudge.ts             the judge's outcomes
 *   Client   frontend/src/rebuild/staff/mentorQualityApi.ts        the staff surface's copies
 *   DB       database/migrations/*_mentor_evaluation_loop_and_quality_dashboard.sql  CHECKs
 *   CI       .github/workflows/mentor-evaluation-loop.yml         the hourly pass
 *
 * A drift fails in the worst direction: a CHECK refuses the score rows the
 * pass must write (coverage silently stops), a flag kind the staff surface
 * cannot name, or an owner role nobody can act as.
 *
 * TWO GOVERNANCE GUARDS:
 *   - C.23 fence: `tutor_transcript_score.scorer` admits 'rules' only. An AI
 *     judge may write scores only after it is calibrated against a human
 *     panel; widening that CHECK is the reviewed change that says so.
 *   - Appendix F §1.4 service levels: signals refreshed within 24 hours and
 *     owners reviewing weekly. Loosening either is refused here.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FILES = {
  rubric: 'backend/src/services/pedagogy/transcriptRubric.ts',
  scoring: 'backend/src/services/pedagogy/transcriptScoring.ts',
  quality: 'backend/src/services/pedagogy/mentorQuality.ts',
  route: 'backend/src/routes/tutor.ts',
  judge: 'oracle/src/evaluation/transcriptJudge.ts',
  client: 'frontend/src/rebuild/staff/mentorQualityApi.ts',
  workflow: '.github/workflows/mentor-evaluation-loop.yml',
};

/** Appendix F §1.4 (proposed values the SPEC states): never loosened here. */
export const SERVICE_LEVELS = { freshnessHours: 24, reviewCadenceDays: 7 };

const quoted = (text) => [...text.matchAll(/'([A-Za-z_.:-]+)'/g)].map((m) => m[1]);
const sameSet = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/** `NAME ... = [ ... ]` (a type annotation between the name and `=` is allowed). */
export function arrayConst(source, name) {
  const m = new RegExp(`\\b${name}\\b[^=\\n]*=\\s*\\[([^\\]]*)\\]`).exec(source);
  return m ? quoted(m[1]) : null;
}

/** The `id: '...'` values of the rubric definition. */
export function rubricIds(source) {
  const start = source.indexOf('export const TRANSCRIPT_RUBRIC');
  const end = source.indexOf('] as const;', start);
  if (start === -1 || end === -1) return null;
  return [...source.slice(start, end).matchAll(/\bid:\s*'([a-z_]+)'/g)].map((m) => m[1]);
}

/** Values of `column ... IN (...)` in the CREATE TABLE block named `table`. */
export function tableVocab(sql, table, column) {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS public.${table}`);
  if (start === -1) return null;
  const end = sql.indexOf(');\n', start);
  const block = sql.slice(start, end === -1 ? undefined : end);
  const m = new RegExp(`\\b${column}\\s+IN\\s*\\(([^)]*)\\)`, 'i').exec(block);
  return m ? quoted(m[1]) : null;
}

export function numericField(source, objectName, field) {
  const start = source.indexOf(objectName);
  if (start === -1) return null;
  const m = new RegExp(`\\b${field}:\\s*([0-9._]+)`).exec(source.slice(start));
  return m ? Number(m[1].replace(/_/g, '')) : null;
}

export function checkEvaluationLoopParity(read, sql) {
  const problems = [];
  if (!sql) return ['the *_mentor_evaluation_loop_and_quality_dashboard.sql migration is missing'];
  const src = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, read(f)]));
  for (const [k, text] of Object.entries(src)) if (text === null) problems.push(`${FILES[k]} is missing`);
  if (problems.length > 0) return problems;

  const compare = (label, expected, others) => {
    if (!expected || expected.length === 0) return void problems.push(`${label}: could not read the reference list`);
    for (const [where, list] of others) {
      if (!list) problems.push(`${label}: could not read ${where}`);
      else if (!sameSet(expected, list)) problems.push(`${label}: ${where} has [${list.join(', ')}], expected [${expected.join(', ')}]`);
    }
  };

  compare('rubric criteria', rubricIds(src.rubric), [['migration CHECK on tutor_transcript_score.criterion', tableVocab(sql, 'tutor_transcript_score', 'criterion')]]);
  const outcomes = arrayConst(src.scoring, 'SCORE_OUTCOMES');
  compare('score outcomes', outcomes, [
    ['migration CHECK on tutor_transcript_score.outcome', tableVocab(sql, 'tutor_transcript_score', 'outcome')],
    ['Oracle JUDGE_OUTCOMES', arrayConst(src.judge, 'JUDGE_OUTCOMES')],
  ]);
  const roles = arrayConst(src.quality, 'OWNER_ROLES');
  compare('owner roles', roles, [
    ['migration CHECK on mentor_quality_owner', tableVocab(sql, 'mentor_quality_owner', 'owner_role')],
    ['migration CHECK on mentor_quality_flag', tableVocab(sql, 'mentor_quality_flag', 'owner_role')],
    ['migration CHECK on mentor_quality_review', tableVocab(sql, 'mentor_quality_review', 'owner_role')],
    ['the staff client', arrayConst(src.client, 'OWNER_ROLES')],
  ]);
  compare('flag kinds', arrayConst(src.quality, 'FLAG_KINDS'), [
    ['migration CHECK on mentor_quality_flag.kind', tableVocab(sql, 'mentor_quality_flag', 'kind')],
    ['the staff client', arrayConst(src.client, 'FLAG_KINDS')],
  ]);
  compare('flag severities', arrayConst(src.quality, 'FLAG_SEVERITIES'), [
    ['migration CHECK on mentor_quality_flag.severity', tableVocab(sql, 'mentor_quality_flag', 'severity')],
    ['the staff client', arrayConst(src.client, 'FLAG_SEVERITIES')],
  ]);
  compare('flag statuses', arrayConst(src.quality, 'FLAG_STATUSES'), [
    ['migration CHECK on mentor_quality_flag.status', tableVocab(sql, 'mentor_quality_flag', 'status')],
    ['the staff client', arrayConst(src.client, 'FLAG_STATUSES')],
  ]);
  compare('signal categories', arrayConst(src.quality, 'SIGNAL_CATEGORIES'), [['the staff client', arrayConst(src.client, 'SIGNAL_CATEGORIES')]]);
  const statusUnion = /export type SignalStatus\s*=\s*([^;]+);/.exec(src.quality);
  compare('signal statuses', statusUnion ? quoted(statusUnion[1]) : null, [['the staff client', arrayConst(src.client, 'SIGNAL_STATUSES')]]);

  // ── C.23 fence: no judge-written scores until the judge is calibrated ──
  const scorers = tableVocab(sql, 'tutor_transcript_score', 'scorer');
  if (!scorers || !sameSet(scorers, ['rules'])) {
    problems.push(`tutor_transcript_score.scorer admits [${(scorers ?? []).join(', ')}]: only 'rules' until a judge is calibrated (C.23); widening it is a reviewed governance change`);
  }
  if (/scorer:\s*'judge'/.test(src.quality) || /scorer:\s*'judge'/.test(read('backend/src/services/pedagogy/evaluationLoop.ts') ?? '')) {
    problems.push('Core writes judge-scored rows: forbidden until C.23 calibration');
  }

  // ── Appendix F §1.4 service levels ──
  for (const [field, limit] of Object.entries(SERVICE_LEVELS)) {
    const value = numericField(src.quality, 'MENTOR_QUALITY_THRESHOLDS', field);
    if (value === null) problems.push(`${FILES.quality}: could not read MENTOR_QUALITY_THRESHOLDS.${field}`);
    else if (value > limit) problems.push(`MENTOR_QUALITY_THRESHOLDS.${field} is ${value}, looser than Appendix F's ${limit}`);
  }

  // ── the hourly pass reaches the route that exists ──
  if (!src.route.includes("router.post('/evaluation/run'")) problems.push(`${FILES.route}: the internal /evaluation/run route is missing`);
  if (!src.workflow.includes('/api/v1/tutor/internal/evaluation/run')) problems.push(`${FILES.workflow}: does not call /api/v1/tutor/internal/evaluation/run`);
  if (!/cron:\s*'[^']*\*\s+\*\s+\*\s+\*'/.test(src.workflow)) problems.push(`${FILES.workflow}: the pass must run at least hourly (Appendix F §1.4 freshness)`);
  return problems;
}

export function readMigration() {
  const dir = path.join(ROOT, 'database/migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_mentor_evaluation_loop_and_quality_dashboard.sql'));
  return file ? readFileSync(path.join(dir, file), 'utf8') : null;
}

export const readRepo = (file) => {
  const full = path.join(ROOT, file);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
};

function main() {
  const problems = checkEvaluationLoopParity(readRepo, readMigration());
  if (problems.length > 0) {
    console.error('evaluation-loop:check FAILED — the evaluation-loop / dashboard copies disagree:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('evaluation-loop:check OK — Core, Oracle, the staff client and the migration agree on the rubric, outcomes, owner roles and flag vocabularies; judge scores stay fenced (C.23) and the Appendix F service levels are intact');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
