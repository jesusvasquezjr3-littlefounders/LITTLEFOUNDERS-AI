#!/usr/bin/env node
/**
 * ONE CLOSED STEP SHAPE, SIX HAND-WRITTEN COPIES, NO COMPILER BETWEEN THEM —
 * the same shape of gap `check-instrument-parity.mjs` exists for the
 * whiteboard and `check-preferred-types-parity.mjs` exists for
 * `preferredTypes`, applied here to a `demonstrate` step.
 *
 * WHY THIS EXISTS. `oracle` and `backend`/`frontend` share no types
 * (/AGENTS.md §1.5), so a `demonstrate` step's `{ kind, denomination?, ms?,
 * item?, bucket?, left?, right?, value? }` shape is typed out six times:
 * Oracle's model-facing `DemoStepSchema` (turnSchema.ts), Oracle's wire type
 * `WireDemoStep` (ws/protocol.ts), Core's request-body validator
 * `DemonstrateBody` (routes/tutor.ts), Core's TS mirror
 * `TutorTurnDemonstrateStep` AND its OWN separate read-time revalidator
 * `DemonstrateStepRowSchema` (both in services/tutorData.ts — two copies in
 * ONE file, which can drift from each other as easily as from anywhere
 * else), and the frontend's wire type `TrayDemoStep` (tutor/types.ts). A verb
 * or field added on one side and missed on another degrades SILENTLY: a step
 * naming an unknown field is dropped by whichever `.strict()` schema meets it
 * first, and a step naming a `kind` the frontend adapter does not recognise
 * is a silent no-op in `trayDemo.ts` — nothing crashes, the demonstration
 * just does not happen, and that is a worse failure to debug than an error.
 *
 * Widened from 3 verbs (`add`/`remove`/`pause`) to 7 2026-09-02/03
 * (/TUTOR_INSTRUMENTS.md Sprint 2) — exactly the kind of one-time widening
 * across six hand-synced copies this gate exists to keep honest on every
 * future edit, not just this one. Built alongside the same sprint's decision
 * to keep three of those seven verbs (`place`/`assign`/`pair`) OUT of
 * `prompt.ts`'s active vocabulary (see that file's own comment on the
 * `"demonstrate"` shape line) — this gate checks that all SIX COPIES agree
 * with each other, not that the model prompt matches the schema; the prompt
 * is deliberately narrower than what the schema (and this gate) allow.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SITES = [
  { file: 'oracle/src/tutor/turnSchema.ts', anchor: 'export const DemoStepSchema' },
  { file: 'oracle/src/ws/protocol.ts', anchor: 'export interface WireDemoStep' },
  { file: 'backend/src/routes/tutor.ts', anchor: 'const DemonstrateBody' },
  { file: 'backend/src/services/tutorData.ts', anchor: 'export interface TutorTurnDemonstrateStep' },
  { file: 'backend/src/services/tutorData.ts', anchor: 'const DemonstrateStepRowSchema' },
  { file: 'frontend/src/tutor/types.ts', anchor: 'export interface TrayDemoStep' },
];

/**
 * From an anchor (a unique declaration string), find the `kind` line that
 * follows it and read forward to the block's own closing `}` — works for
 * both a Zod `z.object({ kind: z.enum([...]), ... })` and a TS
 * `interface { kind: 'a' | 'b' | ...; ...; }`, since both close their block
 * with a bare `}` as the first non-whitespace character on its line.
 */
function extractStep(source, anchor) {
  const anchorAt = source.indexOf(anchor);
  if (anchorAt === -1) return null;
  const kindAt = source.indexOf('kind:', anchorAt);
  if (kindAt === -1 || kindAt - anchorAt > 1_200) return null;
  const rest = source.slice(kindAt);
  const closeAt = /\n\s*\}/.exec(rest);
  const region = closeAt ? rest.slice(0, closeAt.index) : rest.slice(0, 700);

  const kindMatch = /kind:\s*(?:z\.enum\(\[([\s\S]*?)\]\)|([\s\S]*?);)/.exec(region);
  if (!kindMatch) return null;
  const kinds = [...(kindMatch[1] ?? kindMatch[2]).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

  const fields = [...region.matchAll(/^\s*(\w+)\??:\s/gm)].map((m) => m[1]).filter((f) => f !== 'kind');

  return { kinds, fields };
}

export function checkDemoStepParity(read) {
  const problems = [];
  const found = SITES.map(({ file, anchor }) => {
    const source = read(file);
    const step = extractStep(source, anchor);
    if (!step) problems.push(`${file} (${anchor}): could not find a "kind" step shape to check`);
    return { file, anchor, step };
  });
  if (problems.length > 0) return problems;

  const [canonical, ...rest] = found;
  const canonicalKinds = canonical.step.kinds.slice().sort();
  const canonicalFields = canonical.step.fields.slice().sort();

  for (const { file, anchor, step } of rest) {
    const kinds = step.kinds.slice().sort();
    const fields = step.fields.slice().sort();
    const missingKinds = canonicalKinds.filter((k) => !kinds.includes(k));
    const extraKinds = kinds.filter((k) => !canonicalKinds.includes(k));
    const missingFields = canonicalFields.filter((f) => !fields.includes(f));
    const extraFields = fields.filter((f) => !canonicalFields.includes(f));
    if (missingKinds.length > 0) {
      problems.push(`${file} (${anchor}): missing kind(s) ${missingKinds.join(', ')} present in ${canonical.file}`);
    }
    if (extraKinds.length > 0) {
      problems.push(`${file} (${anchor}): has kind(s) ${extraKinds.join(', ')} that ${canonical.file} does not`);
    }
    if (missingFields.length > 0) {
      problems.push(`${file} (${anchor}): missing field(s) ${missingFields.join(', ')} present in ${canonical.file}`);
    }
    if (extraFields.length > 0) {
      problems.push(`${file} (${anchor}): has field(s) ${extraFields.join(', ')} that ${canonical.file} does not`);
    }
  }
  return problems;
}

function main() {
  const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
  const problems = checkDemoStepParity(read);
  if (problems.length > 0) {
    console.error('demo-step:check FAILED — the six demonstrate-step copies disagree:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('demo-step:check OK — all six demonstrate-step copies agree on kind and field vocabulary');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
