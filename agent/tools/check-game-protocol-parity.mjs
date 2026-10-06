#!/usr/bin/env node
/**
 * Games in /learn — THE kr.v1 PROTOCOL AND ITS VOCABULARIES, HAND-WRITTEN IN
 * EVERY PACKAGE THAT TOUCHES THEM.
 *
 * The packages share no types (CLAUDE.md), so the wire between a game, the SPA
 * and Core is typed out more than once. docs/games/krv1.manifest.json is the
 * contract's machine-checkable field list, and every copy is held to it:
 *
 *   Contract  docs/games/krv1.manifest.json    messages, StartSpec, Lens, driftReleases fields
 *   SPA       frontend/src/games/kartrush/protocol.ts   `KRV1_MANIFEST` (the same literal) and the
 *                                                       closed vocabularies (`KR_*`)
 *   Core      backend/src/games/runReport.ts   `RUN_REPORT_FIELDS`, `LENS_FIELDS`, `DRIFT_FIELDS`, the
 *                                              zod shapes behind them, and the same vocabularies
 *   Oracle    oracle/src/context/schema.ts     `GAME_LENS_KEYS`, `GAME_BANDS` (the sealed debrief input)
 *
 * The game's own copy lives in the KartRush repository and is pinned there to
 * the same manifest; this repo cannot read it, so it is pinned here through the
 * SPA's copy (which a test in the SPA holds equal to the JSON file).
 *
 * A drift fails in the worst direction: Core's strict body refuses a race the
 * game just finished (RunReport is `.strict()`), the SPA drops a message the
 * game sent (an unknown field is rejected, never coerced), a lens key the SPA
 * has no copy for reaches a child as a blank pit stop, or Oracle refuses the
 * closed input Core sends and the AI line silently never appears. This fails first.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FILES = {
  manifest: 'docs/games/krv1.manifest.json',
  spa: 'frontend/src/games/kartrush/protocol.ts',
  core: 'backend/src/games/runReport.ts',
  oracle: 'oracle/src/context/schema.ts',
};

const quoted = (text) => [...text.matchAll(/'([^'\n]+)'/g)].map((m) => m[1]);
const sorted = (list) => [...list].sort();
const same = (a, b) => a.length === b.length && sorted(a).every((v, i) => v === sorted(b)[i]);

/** `NAME = [ 'a', 'b' ] as const` (any type annotation allowed) -> ['a', 'b']; null when absent. */
export function constArray(source, name) {
  const m = new RegExp(`\\b${name}\\b(?:\\s*:[^=]+)?\\s*=\\s*\\[([^\\]]*)\\]`).exec(source);
  return m ? quoted(m[1]) : null;
}

/** The field names of the zod object literal that follows `anchor` (two-space-indented keys, up to `.strict()`). */
export function zodFields(source, anchor) {
  const at = source.indexOf(anchor);
  if (at === -1) return null;
  const open = source.indexOf('z.object({', at);
  const close = source.indexOf('}).strict()', open);
  if (open === -1 || close === -1) return null;
  return [...source.slice(open, close).matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
}

/** The plain object literal assigned to `NAME` (single quotes, trailing commas, `as const`) as a JS value; null when absent or not plain. */
export function manifestLiteral(source, name) {
  const at = source.indexOf(`${name} =`);
  if (at === -1) return null;
  const open = source.indexOf('{', at);
  const end = source.indexOf('} as const', open);
  if (open === -1 || end === -1) return null;
  const json = source.slice(open, end + 1)
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'([^'\n]*)'/g, '"$1"')
    .replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Every difference between two manifests, as sentences. Arrays are sets: the order of a field list is not wire. */
export function manifestDifferences(label, expected, actual) {
  const out = [];
  const keys = (o) => Object.keys(o ?? {});
  for (const group of ['hostToGame', 'gameToHost']) {
    for (const t of new Set([...keys(expected[group]), ...keys(actual[group])])) {
      const a = expected[group]?.[t];
      const b = actual[group]?.[t];
      if (!a) out.push(`${label}: ${group} has a message the contract does not: ${t}`);
      else if (!b) out.push(`${label}: ${group} lacks the contract's ${t}`);
      else if (!same(a, b)) out.push(`${label}: ${group}.${t} [${b.join(', ')}] ≠ contract [${a.join(', ')}]`);
    }
  }
  for (const list of ['startSpec', 'lens', 'driftReleases']) {
    if (!actual[list]) out.push(`${label}: lacks ${list}`);
    else if (!same(expected[list] ?? [], actual[list])) out.push(`${label}: ${list} [${actual[list].join(', ')}] ≠ contract [${(expected[list] ?? []).join(', ')}]`);
  }
  if (actual.protocol !== expected.protocol) out.push(`${label}: protocol "${actual.protocol}" ≠ contract "${expected.protocol}"`);
  return out;
}

/**
 * `read(file)` returns a file's text or throws. Returns every problem found;
 * an empty list means every copy agrees.
 */
export function checkGameProtocolParity(read) {
  const problems = [];
  const src = {};
  for (const [key, file] of Object.entries(FILES)) {
    try {
      src[key] = read(file);
    } catch {
      problems.push(
        key === 'spa'
          ? `${file}: does not exist. The SPA's copy of the protocol is what pins the game's wire to the contract from this repo; the game protocol has nothing to be compared with until it is added`
          : `${file}: cannot be read`,
      );
    }
  }
  if (problems.length > 0) return problems;

  let manifest;
  try {
    manifest = JSON.parse(src.manifest);
  } catch {
    return [`${FILES.manifest}: is not valid JSON`];
  }
  for (const key of ['protocol', 'hostToGame', 'gameToHost', 'startSpec', 'lens', 'driftReleases']) {
    if (manifest[key] === undefined) problems.push(`${FILES.manifest}: lacks "${key}"`);
  }
  if (!manifest.gameToHost?.['kr.runFinished']) problems.push(`${FILES.manifest}: lacks gameToHost["kr.runFinished"]`);
  if (problems.length > 0) return problems;

  // (a) The SPA's copy is the contract.
  const spa = manifestLiteral(src.spa, 'KRV1_MANIFEST');
  if (!spa) problems.push(`${FILES.spa}: could not read the KRV1_MANIFEST literal (keep it a plain object ending in "} as const")`);
  else problems.push(...manifestDifferences(FILES.spa, manifest, spa));

  // (b) Core's run report: the literal field lists, and the zod shapes behind them.
  const fields = (label, found, expected) => {
    if (!found) problems.push(`${FILES.core}: could not read ${label}`);
    else if (!same(found, expected)) problems.push(`${FILES.core}: ${label} [${found.join(', ')}] ≠ contract [${expected.join(', ')}]`);
  };
  const reportFields = constArray(src.core, 'RUN_REPORT_FIELDS');
  const lensFields = constArray(src.core, 'LENS_FIELDS');
  const driftFields = constArray(src.core, 'DRIFT_FIELDS');
  fields('RUN_REPORT_FIELDS', reportFields, manifest.gameToHost['kr.runFinished']);
  fields('LENS_FIELDS', lensFields, manifest.lens);
  fields('DRIFT_FIELDS', driftFields, manifest.driftReleases);
  fields('the RunReport zod object', zodFields(src.core, 'export const RunReport ='), manifest.gameToHost['kr.runFinished']);
  fields('the Lens zod object', zodFields(src.core, 'export const Lens ='), manifest.lens);
  fields('the DriftReleases zod object', zodFields(src.core, 'export const DriftReleases ='), manifest.driftReleases);

  // (c) The closed vocabularies every copy shares.
  const vocab = (label, reference, copies) => {
    if (!reference || reference.length === 0) {
      problems.push(`${label}: could not read the reference vocabulary in Core`);
      return;
    }
    for (const [where, values] of copies) {
      if (!values) problems.push(`${where}: could not find ${label}`);
      else if (!same(values, reference)) problems.push(`${where}: ${label} [${values.join(', ')}] ≠ Core's [${reference.join(', ')}]`);
    }
  };
  const core = (name) => constArray(src.core, name);
  vocab('mentors', core('MENTORS'), [
    [`${FILES.spa} KR_CHARACTERS`, constArray(src.spa, 'KR_CHARACTERS')],
    [`${FILES.oracle} CHARACTER_IDS`, constArray(src.oracle, 'CHARACTER_IDS')],
  ]);
  vocab('track ids', core('TRACK_IDS'), [[`${FILES.spa} KR_TRACK_IDS`, constArray(src.spa, 'KR_TRACK_IDS')]]);
  vocab('speed classes', core('SPEED_CLASSES'), [[`${FILES.spa} KR_SPEED_CLASSES`, constArray(src.spa, 'KR_SPEED_CLASSES')]]);
  vocab('lens keys', core('LENS_KEYS'), [
    [`${FILES.spa} KR_LENSES`, constArray(src.spa, 'KR_LENSES')],
    [`${FILES.oracle} GAME_LENS_KEYS`, constArray(src.oracle, 'GAME_LENS_KEYS')],
  ]);
  vocab('age bands', core('BANDS'), [[`${FILES.oracle} GAME_BANDS`, constArray(src.oracle, 'GAME_BANDS')]]);
  // A practice lap is never reported, so Core's modes are the game's minus practice.
  const spaModes = constArray(src.spa, 'KR_MODES');
  const coreModes = core('RUN_MODES');
  if (!spaModes || !coreModes) problems.push('run modes: could not read both copies');
  else if (!same(spaModes.filter((m) => m !== 'practice'), coreModes) || !spaModes.includes('practice')) {
    problems.push(`run modes: Core [${coreModes.join(', ')}] must be the SPA's [${spaModes.join(', ')}] minus practice`);
  }

  return problems;
}

function main() {
  const problems = checkGameProtocolParity((file) => readFileSync(path.join(ROOT, file), 'utf8'));
  if (problems.length > 0) {
    console.error('games:parity FAILED — the game protocol copies disagree:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('games:parity OK — the contract manifest, the SPA protocol, Core\'s run report and Oracle\'s debrief input agree on every field and closed vocabulary');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
