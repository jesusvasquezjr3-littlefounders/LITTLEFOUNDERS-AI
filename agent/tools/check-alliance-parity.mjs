#!/usr/bin/env node
/**
 * C.15 + C.14 + C.7 — ONE ALLIANCE / SELF-EXPLANATION / DISPOSITION RECORD,
 * HAND-WRITTEN IN EVERY PACKAGE.
 *
 * The 11 packages share no types (CLAUDE.md), so these vocabularies are typed
 * out more than once:
 *
 *   Oracle   oracle/src/tutor/allianceController.ts   CONTINUITY_KINDS, CONTINUITY_MOVES,
 *                                                     GOAL_AGREEMENTS, RENEGOTIATION_OUTCOMES,
 *                                                     AllianceReport
 *            oracle/src/tutor/selfExplanation.ts      DECISION_SOURCES, PROMPT_VARIANTS,
 *                                                     EXPLANATION_QUALITIES, SELF_EXPLANATION_OUTCOMES
 *            oracle/src/tutor/explanationLexicon.ts   CONCEPT_FAMILIES
 *            oracle/src/tutor/dispositionProfile.ts   HELP_STYLES, PERSISTENCE, EXPLANATION_STYLES,
 *                                                     DISPOSITION_EFFECTS, DispositionProfileSchema,
 *                                                     DispositionObservation
 *            oracle/src/ws/protocol.ts                `goal_check` / `goal_response`
 *   Core     backend/src/services/pedagogy/alliance.ts     the same, as zod bodies
 *            backend/src/services/pedagogy/disposition.ts  the profile vocabularies and projection
 *   DB       database/migrations/*_mentor_alliance_and_disposition.sql  CHECKs
 *   Client   frontend/src/tutor/types.ts               the two socket frames
 *            frontend/src/rebuild/mentor/allianceApi.ts the bond-proxy answers and profile labels
 *
 * A drift fails in the worst direction: Core's strict body refuses the close
 * (the session row stays open), a CHECK refuses a row Core believed it wrote,
 * a projection field an Oracle cannot parse refuses every session, or a
 * client sends a bond-proxy answer Core rejects. This gate fails first.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodFields } from './check-session-end-parity.mjs';
import { constArray, interfaceFields } from './check-behavioral-telemetry-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FILES = {
  alliance: 'oracle/src/tutor/allianceController.ts',
  selfExplanation: 'oracle/src/tutor/selfExplanation.ts',
  lexicon: 'oracle/src/tutor/explanationLexicon.ts',
  disposition: 'oracle/src/tutor/dispositionProfile.ts',
  oracleProtocol: 'oracle/src/ws/protocol.ts',
  coreAlliance: 'backend/src/services/pedagogy/alliance.ts',
  coreDisposition: 'backend/src/services/pedagogy/disposition.ts',
  clientTypes: 'frontend/src/tutor/types.ts',
  clientApi: 'frontend/src/rebuild/mentor/allianceApi.ts',
};

const quoted = (text) => [...text.matchAll(/'([A-Za-z_]+)'/g)].map((m) => m[1]);
const same = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/** The values of a CHECK `column IN (...)` (first occurrence), or null. */
export function migrationVocab(sql, column) {
  const m = new RegExp(`\\b${column}\\s+IN\\s*\\(([^)]*)\\)`, 'i').exec(sql);
  return m ? quoted(m[1]) : null;
}

/** The literal members of `type NAME = 'a' | 'b'`. */
export function unionType(source, name) {
  const m = new RegExp(`type ${name}\\s*=\\s*([^;]+);`).exec(source);
  return m ? quoted(m[1]) : null;
}

export function checkAllianceParity(read, migrationSql) {
  const problems = [];
  const src = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, read(f)]));
  if (migrationSql === null) return ['database/migrations: no *_mentor_alliance_and_disposition.sql migration found'];

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

  // C.15 — the alliance record.
  compare('continuity kinds', constArray(src.alliance, 'CONTINUITY_KINDS'), [
    [FILES.coreAlliance, constArray(src.coreAlliance, 'CONTINUITY_KINDS')],
    [FILES.coreDisposition, constArray(src.coreDisposition, 'CONTINUITY_KINDS')],
    ['migration CHECK on continuity', migrationVocab(migrationSql, 'continuity')],
  ]);
  compare('continuity moves', constArray(src.alliance, 'CONTINUITY_MOVES'), [
    [FILES.coreAlliance, constArray(src.coreAlliance, 'CONTINUITY_MOVES')],
    ['migration CHECK on continuity_move', migrationVocab(migrationSql, 'continuity_move')],
  ]);
  compare('goal agreements', constArray(src.alliance, 'GOAL_AGREEMENTS'), [
    [FILES.coreAlliance, constArray(src.coreAlliance, 'GOAL_AGREEMENTS')],
    ['migration CHECK on goal_agreement', migrationVocab(migrationSql, 'goal_agreement')],
  ]);
  compare('renegotiation outcomes', constArray(src.alliance, 'RENEGOTIATION_OUTCOMES'), [
    [FILES.coreAlliance, constArray(src.coreAlliance, 'RENEGOTIATION_OUTCOMES')],
    ['migration CHECK on the renegotiation outcome', migrationVocab(migrationSql.slice(migrationSql.indexOf('tutor_alliance_renegotiation (')), 'outcome')],
  ]);
  fields('alliance report', interfaceFields(src.alliance, 'AllianceReport'), zodFields(src.coreAlliance, 'export const AllianceReportBody'));

  // C.14 — the self-explanation events.
  compare('concept families', constArray(src.lexicon, 'CONCEPT_FAMILIES'), [
    [FILES.coreAlliance, constArray(src.coreAlliance, 'CONCEPT_FAMILIES')],
    ['migration CHECK on family', migrationVocab(migrationSql, 'family')],
  ]);
  compare('decision sources', constArray(src.selfExplanation, 'DECISION_SOURCES'), [
    [FILES.coreAlliance, constArray(src.coreAlliance, 'DECISION_SOURCES')],
    ['migration CHECK on source', migrationVocab(migrationSql, 'source')],
  ]);
  compare('prompt variants', constArray(src.selfExplanation, 'PROMPT_VARIANTS'), [
    [FILES.coreAlliance, constArray(src.coreAlliance, 'PROMPT_VARIANTS')],
    ['migration CHECK on variant', migrationVocab(migrationSql, 'variant')],
  ]);
  compare('explanation qualities', constArray(src.selfExplanation, 'EXPLANATION_QUALITIES'), [
    [FILES.coreAlliance, constArray(src.coreAlliance, 'EXPLANATION_QUALITIES')],
    ['migration CHECK on first_quality', migrationVocab(migrationSql, 'first_quality')],
    ['migration CHECK on followup_quality', migrationVocab(migrationSql, 'followup_quality')],
  ]);
  compare('self-explanation outcomes', constArray(src.selfExplanation, 'SELF_EXPLANATION_OUTCOMES'), [
    [FILES.coreAlliance, constArray(src.coreAlliance, 'SELF_EXPLANATION_OUTCOMES')],
    ['migration CHECK on the self-explanation outcome', migrationVocab(migrationSql.slice(migrationSql.indexOf('tutor_self_explanation_event (')), 'outcome')],
  ]);
  fields('self-explanation event', zodFields(src.selfExplanation, 'const EventSchema'), zodFields(src.coreAlliance, 'export const SelfExplanationEventBody'));
  fields('self-explanation report', interfaceFields(src.selfExplanation, 'SelfExplanationReport'), zodFields(src.coreAlliance, 'export const SelfExplanationReportBody'));

  // C.7 — the disposition profile.
  compare('help styles', constArray(src.disposition, 'HELP_STYLES'), [
    [FILES.coreDisposition, constArray(src.coreDisposition, 'HELP_STYLES')],
    ['migration CHECK on help_style', migrationVocab(migrationSql, 'help_style')],
    [FILES.clientApi, unionType(src.clientApi, 'HelpStyle')],
  ]);
  compare('persistence', constArray(src.disposition, 'PERSISTENCE'), [
    [FILES.coreDisposition, constArray(src.coreDisposition, 'PERSISTENCE')],
    ['migration CHECK on persistence', migrationVocab(migrationSql, 'persistence')],
    [FILES.clientApi, unionType(src.clientApi, 'Persistence')],
  ]);
  compare('explanation styles', constArray(src.disposition, 'EXPLANATION_STYLES'), [
    [FILES.coreDisposition, constArray(src.coreDisposition, 'EXPLANATION_STYLES')],
    ['migration CHECK on explanation', migrationVocab(migrationSql, 'explanation')],
    [FILES.clientApi, unionType(src.clientApi, 'ExplanationStyle')],
  ]);
  compare('disposition effects', constArray(src.disposition, 'DISPOSITION_EFFECTS'), [
    [FILES.coreDisposition, constArray(src.coreDisposition, 'DISPOSITION_EFFECTS')],
    [FILES.clientApi, unionType(src.clientApi, 'DispositionEffect')],
  ]);
  fields('disposition projection', zodFields(src.disposition, 'export const DispositionProfileSchema'), interfaceFields(src.coreDisposition, 'OracleDispositionProjection'));
  fields('disposition observation', interfaceFields(src.disposition, 'DispositionObservation'), zodFields(src.coreDisposition, 'export const DispositionObservationBody'));

  // The bond proxy: the client sends only what Core and the migration accept.
  compare('bond-proxy answers', constArray(src.coreAlliance, 'BOND_PROXY_ANSWERS'), [
    [FILES.clientApi, constArray(src.clientApi, 'BOND_PROXY_ANSWERS')],
    ['migration CHECK on bond_proxy', migrationVocab(migrationSql, 'bond_proxy')],
  ]);

  // The goal chips exist on both ends of the socket.
  for (const frame of ['goal_check', 'goal_response']) {
    const literal = new RegExp(`'${frame}'`);
    if (!literal.test(src.oracleProtocol)) problems.push(`${FILES.oracleProtocol}: no '${frame}' frame`);
    if (!literal.test(src.clientTypes)) problems.push(`${FILES.clientTypes}: no '${frame}' frame`);
  }
  return problems;
}

export function readMigration() {
  const dir = path.join(ROOT, 'database/migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_mentor_alliance_and_disposition.sql'));
  return file ? readFileSync(path.join(dir, file), 'utf8') : null;
}

function main() {
  const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
  const problems = checkAllianceParity(read, readMigration());
  if (problems.length > 0) {
    console.error('alliance:check FAILED — the alliance / self-explanation / disposition copies disagree:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    'alliance:check OK — Oracle, Core, the migration and the client agree on the alliance record, the self-explanation events, the disposition profile, the bond-proxy answers and the goal frames',
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
