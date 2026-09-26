#!/usr/bin/env node
/**
 * C.5 + C.6 — THE LIVE-CONTENT GOVERNANCE AND CURATED-PACK VOCABULARIES,
 * HAND-WRITTEN IN EVERY PACKAGE, AND THE APPENDIX E FLOORS.
 *
 * The 11 packages share no types (CLAUDE.md), so these are typed out more
 * than once:
 *
 *   Oracle  oracle/src/content/contentRisk.ts                 the content-risk lexicon (between markers)
 *           oracle/src/core/client.ts                         the liveSuspended answer it parses
 *   Core    backend/src/services/pedagogy/contentRisk.ts      the same lexicon (between markers)
 *           backend/src/services/pedagogy/liveContentGovernance.ts
 *                                                             floors, the concordance floor, the
 *                                                             ladder-event and review vocabularies
 *           backend/src/services/tutorPacks.ts                pack demand patterns and sources
 *           backend/src/config.ts, backend/.env.example       the configured baselines
 *           backend/src/routes/tutor.ts                       the liveSuspended answer it sends
 *   DB      database/migrations/*_live_content_governance_and_curated_packs.sql  CHECKs and floors
 *
 * A drift fails in the worst direction: Oracle and Core classify the same
 * item differently (a report that cannot raise what the other side lowered),
 * a CHECK refuses the log row the live claim must write (Core then refuses
 * every live item), or an Oracle stops recognising the suspension and pays
 * for items Core will refuse.
 *
 * APPENDIX E §3.1.1 GUARD (Tier-1-adjacent). The staff-sampling floors (15%
 * standard, 50% sensitive) and the concordance floor may be RAISED by a
 * human decision; lowering any of them is a Tier 1 change that needs full
 * human review, after which this guard is updated in the same reviewed
 * change. The guard fails on any lower value in code, config default, the
 * env example or the migration. The judge-calibration minimums are guarded
 * by `npm run judge-calibration:check` since C.23 (S06.14) made them shared.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constArray } from './check-behavioral-telemetry-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FILES = {
  oracleRisk: 'oracle/src/content/contentRisk.ts',
  oracleClient: 'oracle/src/core/client.ts',
  coreRisk: 'backend/src/services/pedagogy/contentRisk.ts',
  coreGovernance: 'backend/src/services/pedagogy/liveContentGovernance.ts',
  corePacks: 'backend/src/services/tutorPacks.ts',
  coreConfig: 'backend/src/config.ts',
  coreEnv: 'backend/.env.example',
  coreRoute: 'backend/src/routes/tutor.ts',
};

/** The floors Appendix E §3.1.1 sets; never lowered without a Tier 1 review. */
export const APPENDIX_E_FLOORS = { standard: 0.15, sensitive: 0.5 };
/** The calibration minimums this build pre-registered (proposed, pending calibration). */
// The judge-calibration bar moved to the shared C.23 standard (judgeCalibration.ts,
// mentor_judge_calibration); `npm run judge-calibration:check` guards its floors.
export const CALIBRATION_MINIMUMS = { concordanceFloor: 0.9 };

const quoted = (text) => [...text.matchAll(/'([A-Za-z_.:-]+)'/g)].map((m) => m[1]);
const sameSet = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/** The text between the lexicon markers, whitespace-normalized. */
export function lexiconBlock(source) {
  const start = source.indexOf('// <content-risk-lexicon>');
  const end = source.indexOf('// </content-risk-lexicon>');
  if (start === -1 || end === -1 || end < start) return null;
  return source.slice(start, end).replace(/\s+/g, ' ').trim();
}

/** The values of a CHECK `column IN (...)` (first occurrence at or after `anchor`), or null. */
export function migrationVocab(sql, column, anchor = '') {
  const from = anchor ? sql.indexOf(anchor) : 0;
  if (from === -1) return null;
  const m = new RegExp(`\\b${column}\\s+IN\\s*\\(([^)]*)\\)`, 'i').exec(sql.slice(from));
  return m ? quoted(m[1]) : null;
}

/** The values of the `risk_signals <@ ARRAY[...]` CHECK. */
export function migrationSignals(sql) {
  const m = /risk_signals\s*<@\s*ARRAY\[([\s\S]*?)\]/i.exec(sql);
  return m ? quoted(m[1]) : null;
}

/** A numeric field of a `const NAME = { ... }` object literal (first match). */
export function numericField(source, objectName, field) {
  const start = source.indexOf(objectName);
  if (start === -1) return null;
  const m = new RegExp(`\\b${field}:\\s*([0-9._]+)`).exec(source.slice(start));
  return m ? Number(m[1].replace(/_/g, '')) : null;
}

export function checkLiveContentParity(read, sql) {
  const problems = [];
  const src = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, read(f)]));
  if (!sql) return ['the *_live_content_governance_and_curated_packs.sql migration is missing'];

  // ── the lexicon ──
  const oracleBlock = lexiconBlock(src.oracleRisk);
  const coreBlock = lexiconBlock(src.coreRisk);
  if (!oracleBlock || !coreBlock) problems.push('a content-risk lexicon block (between the markers) is missing');
  else if (oracleBlock !== coreBlock) problems.push(`the content-risk lexicon differs between ${FILES.oracleRisk} and ${FILES.coreRisk}`);

  const compare = (label, expected, others) => {
    if (!expected || expected.length === 0) {
      problems.push(`${label}: could not read the reference list`);
      return;
    }
    for (const [where, list] of others) {
      if (!list) problems.push(`${label}: could not read ${where}`);
      else if (!sameSet(expected, list)) problems.push(`${label}: ${where} has [${list.join(', ')}], expected [${expected.join(', ')}]`);
    }
  };

  const signals = constArray(src.coreRisk, 'CONTENT_RISK_SIGNALS');
  compare('content-risk signals (+ unrecognized_signal)', signals ? [...signals, 'unrecognized_signal'] : null, [
    ['migration CHECK on risk_signals', migrationSignals(sql)],
  ]);
  compare('risk categories', constArray(src.coreGovernance, 'RISK_CATEGORIES'), [
    ['migration CHECK on tutor_live_content_log.risk_category', migrationVocab(sql, 'risk_category', 'CREATE TABLE IF NOT EXISTS public.tutor_live_content_log')],
    ['migration CHECK on tutor_packs.risk_category', migrationVocab(sql, 'risk_category', 'ADD COLUMN IF NOT EXISTS risk_category')],
  ]);
  compare('ladder outcomes', constArray(src.coreGovernance, 'LADDER_OUTCOMES'), [['migration CHECK on outcome', migrationVocab(sql, 'outcome')]]);
  compare('ladder routes', constArray(src.coreGovernance, 'LADDER_ROUTES'), [['migration CHECK on route', migrationVocab(sql, 'route')]]);
  const suspension = constArray(src.coreGovernance, 'SUSPENSION_REASONS');
  compare('ladder event reasons', suspension ? [...suspension, 'judge_not_calibrated', 'gate_unavailable', 'verification_failed'] : null, [
    ['migration CHECK on reason', migrationVocab(sql, 'reason', 'CREATE TABLE IF NOT EXISTS public.tutor_content_ladder_events')],
  ]);
  if (!/REFUSAL_REASONS\s*=\s*\[\.\.\.SUSPENSION_REASONS,\s*'judge_not_calibrated',\s*'gate_unavailable'\]/.test(src.coreGovernance)) {
    problems.push(`${FILES.coreGovernance}: REFUSAL_REASONS must be SUSPENSION_REASONS + judge_not_calibrated + gate_unavailable (the migration lists exactly those)`);
  }
  if (!/LADDER_EVENT_REASONS\s*=\s*\[\.\.\.REFUSAL_REASONS,\s*'verification_failed'\]/.test(src.coreGovernance)) {
    problems.push(`${FILES.coreGovernance}: LADDER_EVENT_REASONS must be REFUSAL_REASONS + verification_failed`);
  }
  compare('review issues', constArray(src.coreGovernance, 'REVIEW_ISSUES'), [['migration CHECK on review_issue', migrationVocab(sql, 'review_issue')]]);
  compare('pack demand patterns', constArray(src.corePacks, 'PACK_DEMAND_PATTERNS'), [['migration CHECK on demand_pattern', migrationVocab(sql, 'demand_pattern')]]);
  compare('pack sources', constArray(src.corePacks, 'PACK_SOURCES'), [['migration CHECK on source', migrationVocab(sql, 'source', 'ADD COLUMN IF NOT EXISTS source')]]);

  // ── Appendix E §3.1.1 floors (Tier-1-adjacent) ──
  const floorsDecl = /LIVE_CONTENT_FLOORS[^=]*=\s*\{\s*standard:\s*([0-9.]+),\s*sensitive:\s*([0-9.]+)\s*\}/.exec(src.coreGovernance);
  if (!floorsDecl) problems.push(`${FILES.coreGovernance}: could not read LIVE_CONTENT_FLOORS`);
  else {
    const [standard, sensitive] = [Number(floorsDecl[1]), Number(floorsDecl[2])];
    if (standard < APPENDIX_E_FLOORS.standard || sensitive < APPENDIX_E_FLOORS.sensitive) {
      problems.push(`LIVE_CONTENT_FLOORS lowered to ${standard}/${sensitive}: Appendix E §3.1.1 floors are 15%/50% and lowering them is a Tier 1 change`);
    }
  }
  const sqlFloors = [...sql.matchAll(/risk_category\s*=\s*'(standard|sensitive)'\s+AND\s+(?:p_)?sample_rate\s*[<>]=?\s*([0-9.]+)/gi)];
  if (sqlFloors.length < 4) problems.push('the migration must state both floors in the log CHECK and in the claim function');
  for (const [, category, value] of sqlFloors) {
    if (Number(value) < APPENDIX_E_FLOORS[category]) problems.push(`migration: the ${category} floor is ${value}, below Appendix E's ${APPENDIX_E_FLOORS[category]}`);
  }
  const configDefault = (name) => {
    const m = new RegExp(`${name}:\\s*z[\\s\\S]*?\\.default\\(([0-9.]+)\\)`).exec(src.coreConfig);
    return m ? Number(m[1]) : null;
  };
  const envValue = (name) => {
    const m = new RegExp(`^${name}=([0-9.]+)\\s*$`, 'm').exec(src.coreEnv);
    return m ? Number(m[1]) : null;
  };
  for (const [name, category] of [['TUTOR_LIVE_REVIEW_SAMPLE_RATE', 'standard'], ['TUTOR_LIVE_REVIEW_SENSITIVE_SAMPLE_RATE', 'sensitive']]) {
    const d = configDefault(name);
    const e = envValue(name);
    if (d === null) problems.push(`${FILES.coreConfig}: could not read the ${name} default`);
    else if (d < APPENDIX_E_FLOORS[category]) problems.push(`${FILES.coreConfig}: ${name} defaults to ${d}, below the ${category} floor`);
    if (e === null) problems.push(`${FILES.coreEnv}: ${name} is not documented`);
    else if (e < APPENDIX_E_FLOORS[category]) problems.push(`${FILES.coreEnv}: ${name}=${e}, below the ${category} floor`);
  }

  // ── the concordance floor (the calibration floors are judge-calibration:check's) ──
  for (const [field, minimum] of Object.entries(CALIBRATION_MINIMUMS)) {
    const value = numericField(src.coreGovernance, 'LIVE_CONTENT_THRESHOLDS', field);
    if (value === null) problems.push(`${FILES.coreGovernance}: could not read LIVE_CONTENT_THRESHOLDS.${field}`);
    else if (value < minimum) problems.push(`LIVE_CONTENT_THRESHOLDS.${field} lowered to ${value} (minimum ${minimum}): a Tier 1 change`);
  }

  // ── the suspension answer: Core sends it, Oracle parses it ──
  if (!/needsGeneration:\s*false,\s*liveSuspended:\s*true/.test(src.coreRoute)) problems.push(`${FILES.coreRoute}: the liveSuspended answer is missing`);
  if (!/liveSuspended:\s*z\.literal\(true\)/.test(src.oracleClient)) problems.push(`${FILES.oracleClient}: Oracle does not parse the liveSuspended answer`);
  return problems;
}

export function readMigration() {
  const dir = path.join(ROOT, 'database/migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_live_content_governance_and_curated_packs.sql'));
  return file ? readFileSync(path.join(dir, file), 'utf8') : null;
}

function main() {
  const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
  const problems = checkLiveContentParity(read, readMigration());
  if (problems.length > 0) {
    console.error('live-content:check FAILED — the live-content governance / curated-pack copies disagree:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    'live-content:check OK — Oracle, Core and the migration agree on the content-risk lexicon and every governance vocabulary; the Appendix E floors (15% / 50%) and the concordance floor are intact',
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
