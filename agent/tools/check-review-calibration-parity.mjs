#!/usr/bin/env node
/**
 * C.11 + C.17 — ONE ROUTING RULE AND ONE DIALOGUE REGISTER, HAND-WRITTEN IN
 * EVERY PACKAGE.
 *
 * The 11 packages share no types (CLAUDE.md), so these are typed out more
 * than once:
 *
 *   Oracle  oracle/src/tutor/spacedReview.ts         the routing vocabularies, the rule's
 *                                                    thresholds, RoutingDecisionSchema, SpacedReviewReport
 *           oracle/src/tutor/controller.ts           REVIEW_OPEN_TURNS
 *           oracle/src/tutor/dialogueCalibration.ts  DIALOGUE_BANDS / _VARIANTS / _ASSIGNMENTS,
 *                                                    DialogueCalibrationSchema, DialogueCalibrationReport
 *   Core    backend/src/services/pedagogy/spacedReview.ts         the same, as zod bodies + the mirrored rule
 *           backend/src/services/pedagogy/dialogueCalibration.ts  the same, as zod bodies
 *           backend/src/services/pedagogy/fsrs.ts                 ReviewTier (kc_attempt.review_tier)
 *           backend/src/config.ts                                 MENTOR_DIALOGUE_EXPERIMENT_BANDS default
 *   DB      database/migrations/*_mentor_spaced_review_and_dialogue_calibration.sql  CHECKs
 *
 * A drift fails in the worst direction: Core's strict body refuses the close
 * (the session row stays open), a CHECK refuses a row Core believed it wrote,
 * the Routing Accuracy audit re-evaluates decisions with a rule that is not
 * the one Oracle ran (every decision reads as a misroute and the Stage 7
 * rollback trips on a false alarm) — or the experiment starts enrolling
 * minors by a default nobody decided. This gate fails first.
 *
 * OD-23 / OD-26 / H.7 GUARD. OD-26 (owner review M-12, 27 September 2026)
 * opened C.17, and only C.17, to teens 13-17 (their own analytics opt-in) and
 * tweens 10-12 (a verified guardian's analytics consent); children 6-9 stay
 * excluded, and every other experiment keeps OD-23's adults-only rule. So:
 * the default may name adult, teen and tween and nothing else; the config
 * schema must not even accept young_child; and Core's resolver must keep
 * young_child out of its openable bands, admit a tween only on an exact age
 * of 10 to 12, and route consent by band (the guardian's for a tween). Any
 * further widening is a new owner-log decision, after which this guard is
 * updated in the same reviewed change.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodFields } from './check-session-end-parity.mjs';
import { constArray, interfaceFields } from './check-behavioral-telemetry-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FILES = {
  review: 'oracle/src/tutor/spacedReview.ts',
  controller: 'oracle/src/tutor/controller.ts',
  dialogue: 'oracle/src/tutor/dialogueCalibration.ts',
  coreReview: 'backend/src/services/pedagogy/spacedReview.ts',
  coreDialogue: 'backend/src/services/pedagogy/dialogueCalibration.ts',
  coreFsrs: 'backend/src/services/pedagogy/fsrs.ts',
  coreConfig: 'backend/src/config.ts',
};

/** OD-26: the only bands the C.17 experiment may ever enrol. */
const OPENABLE_BANDS = ['adult', 'teen', 'tween'];
const quoted = (text) => [...text.matchAll(/'([A-Za-z_]+)'/g)].map((m) => m[1]);
const same = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/** The values of a CHECK `column IN (...)` (first occurrence), or null. */
export function migrationVocab(sql, column) {
  const m = new RegExp(`\\b${column}\\s+IN\\s*\\(([^)]*)\\)`, 'i').exec(sql);
  return m ? quoted(m[1]) : null;
}

/** A `NAME = { key: <number expression>, ... }` object as numbers (only `digits`, `_`, `*`, `+`). */
export function numericObject(source, name) {
  const at = source.indexOf(`${name} = {`);
  if (at === -1) return null;
  const body = source.slice(source.indexOf('{', at) + 1, source.indexOf('}', at));
  const out = {};
  for (const m of body.matchAll(/^\s*(\w+):\s*([\d_*+ .]+),/gm)) {
    const expr = m[2].replaceAll('_', '').trim();
    if (!/^[\d.]+(\s*[*+]\s*[\d.]+)*$/.test(expr)) return null;
    out[m[1]] = expr.split('+').reduce((sum, term) => sum + term.split('*').reduce((p, f) => p * Number(f), 1), 0);
  }
  return Object.keys(out).length === 0 ? null : out;
}

/** The string literal of `export const NAME = '...'`. */
export function stringConst(source, name) {
  const m = new RegExp(`${name}\\s*=\\s*'([^']+)'`).exec(source);
  return m ? m[1] : null;
}

/** The literal members of `type NAME = 'a' | 'b'`. */
export function unionType(source, name) {
  const m = new RegExp(`type ${name}\\s*=\\s*([^;]+);`).exec(source);
  return m ? quoted(m[1]) : null;
}

export function checkReviewCalibrationParity(read, migrationSql) {
  const problems = [];
  const src = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, read(f)]));
  if (migrationSql === null) return ['database/migrations: no *_mentor_spaced_review_and_dialogue_calibration.sql migration found'];

  const compare = (label, reference, others) => {
    if (reference === null || reference.length === 0) {
      problems.push(`${label}: could not resolve the reference vocabulary in Oracle`);
      return;
    }
    for (const [where, values] of others) {
      if (values === null) problems.push(`${where}: could not find ${label}`);
      else if (!same(values, reference)) problems.push(`${where}: ${label} [${values.join(', ')}] ≠ Oracle's [${reference.join(', ')}]`);
    }
  };
  const fields = (label, oracle, core) => {
    if (!oracle || !core) problems.push(`${label}: could not read the fields on both sides`);
    else if (!same(oracle, core)) problems.push(`${label}: Oracle [${oracle.join(', ')}] ≠ Core [${core.join(', ')}]`);
  };
  const routing = migrationSql.slice(migrationSql.indexOf('tutor_review_routing ('));
  const calibration = migrationSql.slice(migrationSql.indexOf('tutor_dialogue_calibration ('));

  // ── C.11: the routing vocabularies, the rule and the record ──
  compare('review tiers', constArray(src.review, 'REVIEW_TIERS'), [
    [FILES.coreReview, constArray(src.coreReview, 'REVIEW_TIERS')],
    ['migration CHECK on tier', migrationVocab(routing, 'tier')],
  ]);
  compare('routing reasons', constArray(src.review, 'ROUTING_REASONS'), [
    [FILES.coreReview, constArray(src.coreReview, 'ROUTING_REASONS')],
    ['migration CHECK on reason', migrationVocab(routing, 'reason')],
  ]);
  compare('routing sources', constArray(src.review, 'ROUTING_SOURCES'), [
    [FILES.coreReview, constArray(src.coreReview, 'ROUTING_SOURCES')],
    ['migration CHECK on source', migrationVocab(routing, 'source')],
  ]);
  compare('routing outcomes', constArray(src.review, 'ROUTING_OUTCOMES'), [
    [FILES.coreReview, constArray(src.coreReview, 'ROUTING_OUTCOMES')],
    ['migration CHECK on outcome', migrationVocab(routing, 'outcome')],
  ]);
  compare('budget states', constArray(src.review, 'BUDGET_STATES'), [
    [FILES.coreReview, constArray(src.coreReview, 'BUDGET_STATES')],
    ['migration CHECK on budget_state', migrationVocab(routing, 'budget_state')],
  ]);
  const oracleRule = numericObject(src.review, 'SPACED_REVIEW_THRESHOLDS');
  const coreRule = numericObject(src.coreReview, 'SPACED_REVIEW_THRESHOLDS');
  if (!oracleRule || !coreRule) problems.push('the rule thresholds: could not read SPACED_REVIEW_THRESHOLDS on both sides');
  else if (JSON.stringify(Object.entries(oracleRule).sort()) !== JSON.stringify(Object.entries(coreRule).sort())) {
    problems.push(`the rule thresholds: Oracle ${JSON.stringify(oracleRule)} ≠ Core ${JSON.stringify(coreRule)} — Core would re-evaluate a different rule`);
  }
  const openTurns = /export const REVIEW_OPEN_TURNS\s*=\s*(\d+)/.exec(src.controller)?.[1];
  if (!openTurns || !oracleRule || Number(openTurns) !== oracleRule.reviewOpenTurns) {
    problems.push(`${FILES.controller}: REVIEW_OPEN_TURNS (${openTurns ?? 'missing'}) ≠ the router's reviewOpenTurns (${oracleRule?.reviewOpenTurns ?? 'missing'})`);
  }
  const oracleVersion = stringConst(src.review, 'SPACED_REVIEW_RULE_VERSION');
  const coreVersion = stringConst(src.coreReview, 'SPACED_REVIEW_RULE_VERSION');
  if (!oracleVersion || oracleVersion !== coreVersion) problems.push(`the rule version: Oracle ${oracleVersion} ≠ Core ${coreVersion}`);
  fields('routing decision', zodFields(src.review, 'export const RoutingDecisionSchema'), zodFields(src.coreReview, 'export const RoutingDecisionBody'));
  fields('spaced-review report', interfaceFields(src.review, 'SpacedReviewReport'), zodFields(src.coreReview, 'export const SpacedReviewReportBody'));
  compare('review tier on the evidence log', ['spaced', 'short_horizon'], [
    [FILES.coreFsrs, unionType(src.coreFsrs, 'ReviewTier')],
    ['migration CHECK on review_tier', migrationVocab(migrationSql, 'review_tier')],
  ]);

  // ── C.17: the register ──
  compare('dialogue bands', constArray(src.dialogue, 'DIALOGUE_BANDS'), [
    [FILES.coreDialogue, constArray(src.coreDialogue, 'DIALOGUE_BANDS')],
    ['migration CHECK on band', migrationVocab(calibration, 'band')],
  ]);
  compare('dialogue variants', constArray(src.dialogue, 'DIALOGUE_VARIANTS'), [
    [FILES.coreDialogue, constArray(src.coreDialogue, 'DIALOGUE_VARIANTS')],
    ['migration CHECK on variant', migrationVocab(calibration, 'variant')],
  ]);
  compare('dialogue assignments', constArray(src.dialogue, 'DIALOGUE_ASSIGNMENTS'), [
    [FILES.coreDialogue, constArray(src.coreDialogue, 'DIALOGUE_ASSIGNMENTS')],
    ['migration CHECK on assignment', migrationVocab(calibration, 'assignment')],
  ]);
  fields('dialogue calibration (context)', zodFields(src.dialogue, 'export const DialogueCalibrationSchema'), interfaceFields(src.coreDialogue, 'DialogueCalibration'));
  const oracleReport = [...(zodFields(src.dialogue, 'export const DialogueCalibrationSchema') ?? []), ...(interfaceFields(src.dialogue, 'DialogueCalibrationReport') ?? [])];
  fields('dialogue calibration report', oracleReport.length > 4 ? oracleReport : null, zodFields(src.coreDialogue, 'export const DialogueCalibrationReportBody'));

  // ── OD-23 / OD-26 / H.7: adults, teens and tweens for C.17; never a young child ──
  const bandsBlock = /MENTOR_DIALOGUE_EXPERIMENT_BANDS:\s*z([\s\S]*?)\n {2}\/\/|MENTOR_DIALOGUE_EXPERIMENT_BANDS:\s*z([\s\S]*?)\),\n/.exec(src.coreConfig);
  const bandsDefault = /MENTOR_DIALOGUE_EXPERIMENT_BANDS:\s*z[\s\S]*?\.default\('([^']*)'\)/.exec(src.coreConfig)?.[1];
  if (bandsDefault === undefined) problems.push(`${FILES.coreConfig}: could not read the MENTOR_DIALOGUE_EXPERIMENT_BANDS default`);
  else {
    const outside = bandsDefault.split(',').map((b) => b.trim()).filter((b) => !OPENABLE_BANDS.includes(b));
    if (outside.length > 0) {
      problems.push(
        `${FILES.coreConfig}: the C.17 experiment would enrol ${outside.join(', ')} by default — OD-26 opens only adults, teens and tweens, and OD-23/H.7 keep everything else out`,
      );
    }
  }
  const schema = (bandsBlock?.[1] ?? bandsBlock?.[2] ?? '');
  if (!schema || /young_child/.test(schema)) {
    problems.push(`${FILES.coreConfig}: MENTOR_DIALOGUE_EXPERIMENT_BANDS must not accept young_child at all (OD-26: children 6-9 stay excluded)`);
  }
  const openableMatch = /DIALOGUE_EXPERIMENT_OPENABLE_BANDS(?::[^=]*)?=\s*\[([^\]]*)\]/.exec(src.coreDialogue);
  const openable = openableMatch ? quoted(openableMatch[1]) : null;
  if (!openable || !same(openable, OPENABLE_BANDS)) {
    problems.push(`${FILES.coreDialogue}: DIALOGUE_EXPERIMENT_OPENABLE_BANDS must be exactly ${OPENABLE_BANDS.join(', ')} (OD-26), found ${openable ? openable.join(', ') : 'none'}`);
  }
  if (!/DIALOGUE_EXPERIMENT_OPENABLE_BANDS\.includes\(input\.band\)/.test(src.coreDialogue)) {
    problems.push(`${FILES.coreDialogue}: the resolver must refuse every band outside DIALOGUE_EXPERIMENT_OPENABLE_BANDS whatever the configuration says (OD-26)`);
  }
  if (!/input\.band === 'tween' && \(input\.age === null \|\| input\.age < 10 \|\| input\.age > 12\)/.test(src.coreDialogue)) {
    problems.push(`${FILES.coreDialogue}: a tween may be enrolled only on an exact age of 10 to 12 (OD-26: never a tier guess that could be a younger child)`);
  }
  if (!/case 'tween':\s*return guardianConsent\(\);/.test(src.coreDialogue)) {
    problems.push(`${FILES.coreDialogue}: a tween's enrolment must need a verified guardian's analytics consent (OD-26)`);
  }
  return problems;
}

export function readMigration() {
  const dir = path.join(ROOT, 'database/migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_mentor_spaced_review_and_dialogue_calibration.sql'));
  return file ? readFileSync(path.join(dir, file), 'utf8') : null;
}

function main() {
  const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
  const problems = checkReviewCalibrationParity(read, readMigration());
  if (problems.length > 0) {
    console.error('review-calibration:check FAILED — the spaced-review / dialogue-calibration copies disagree:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    'review-calibration:check OK — Oracle, Core and the migration agree on the routing rule and its record, the dialogue register and its record; the C.17 experiment enrols adults, teens and tweens only, never a young child (OD-26)',
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
