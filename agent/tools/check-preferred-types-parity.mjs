#!/usr/bin/env node
/**
 * ONE CLOSED VOCABULARY, TWO HAND-WRITTEN COPIES, NO COMPILER BETWEEN THEM —
 * the same shape of gap `check-instrument-parity.mjs` exists for the
 * whiteboard, applied here to `segmentRequest.preferredTypes`.
 *
 * WHY THIS EXISTS. Oracle's `PREFERRED_SEGMENT_TYPES`
 * (`oracle/src/tutor/turnSchema.ts`) is the vocabulary the model may hint at;
 * Core's `preferredTypes` enum (`backend/src/routes/tutor.ts`) is what
 * `POST /segments` actually accepts. Oracle and Core share no types
 * (/AGENTS.md §1.5), so the two lists are typed out separately — and a value
 * present on one side and missing on the other degrades silently: Oracle's
 * `sanitizePreferredTypes` already strips anything Core would reject, so a
 * drift here does not error, it just makes the hint quietly do nothing for
 * the type nobody noticed fell out of sync. That is a worse failure to debug
 * than a crash, because nothing is different to look at.
 *
 * Widened together 2026-09-02 (/TUTOR_INSTRUMENTS.md Sprint 1) from 2 values
 * to 10 — the Lesson Engine's own `money` family plus `number_line` — which is
 * exactly the kind of one-time widening this gate exists to keep honest on
 * every future edit, not just this one.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ORACLE_FILE = 'oracle/src/tutor/turnSchema.ts';
const CORE_FILE = 'backend/src/routes/tutor.ts';

/** `PREFERRED_SEGMENT_TYPES = [ 'a', 'b', ... ] as const;` — the values, in order. */
export function oracleTypes(source) {
  const m = /PREFERRED_SEGMENT_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(source);
  if (!m) return null;
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
}

/** `preferredTypes: z...array(z.enum([ 'a', 'b', ... ]))` — the values, in order. */
export function coreTypes(source) {
  const at = source.indexOf('preferredTypes: z');
  if (at === -1) return null;
  const region = source.slice(at, at + 800);
  const m = /z\.enum\(\[([\s\S]*?)\]\)/.exec(region);
  if (!m) return null;
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
}

export function checkPreferredTypesParity(read) {
  const oracle = oracleTypes(read(ORACLE_FILE));
  const core = coreTypes(read(CORE_FILE));
  const problems = [];

  if (oracle === null) problems.push(`${ORACLE_FILE}: PREFERRED_SEGMENT_TYPES not found`);
  if (core === null) problems.push(`${CORE_FILE}: preferredTypes enum not found`);
  if (oracle === null || core === null) return problems;

  const oracleSet = new Set(oracle);
  const coreSet = new Set(core);
  const missingFromCore = oracle.filter((t) => !coreSet.has(t));
  const missingFromOracle = core.filter((t) => !oracleSet.has(t));

  if (missingFromCore.length > 0) {
    problems.push(
      `${CORE_FILE}: missing ${missingFromCore.join(', ')} — Oracle can hint at ` +
        `a type Core will reject, and the hint silently does nothing`,
    );
  }
  if (missingFromOracle.length > 0) {
    problems.push(
      `${ORACLE_FILE}: missing ${missingFromOracle.join(', ')} — Core accepts a type ` +
        `Oracle can never actually send`,
    );
  }
  return problems;
}

function main() {
  const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
  const problems = checkPreferredTypesParity(read);
  if (problems.length > 0) {
    console.error('preferred-types:check FAILED — the two vocabularies disagree:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('preferred-types:check OK — oracle and core agree on the segmentRequest.preferredTypes vocabulary');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
