#!/usr/bin/env -S npx tsx
// forge-v2:check — Core's strict v2 lesson contract over Forge's emitted rows
// (S05.4c; OD-17: generation later targets the VERIFIED contract).
//
// Forge (coursegen/) emits v2 lesson documents with its zero-spend dry-run
// emitter, but it deliberately does not re-implement the contract: packages
// share no code, and a second copy of the parser could drift into accepting
// what Core refuses. So the emitted rows are validated HERE, by the exact
// function Core runs before delivering or grading a v2 lesson
// (`validateV2LessonForGrading`: the strict public schema, lesson/locale
// identity, rubric cardinality and each rubric against its canonical scorer).
//
//   npm run forge-v2:check                    the committed Forge fixture
//   npm run forge-v2:check -- <documents.json> a dry-run's output
//
// Also part of `npm test` (via contract:check), so a Core contract change
// that Forge's emitter no longer satisfies fails Core's CI, and a Forge
// change to the committed fixture triggers Core's CI through its path filter.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkForgeV2Rows, forgeV2BehaviourPassRate } from '../src/services/forgeV2Rows.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FORGE_FIXTURE = path.resolve(here, '../../coursegen/src/v2/fixtures/emitted.json');

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const file = process.argv[2] ? path.resolve(process.argv[2]) : FORGE_FIXTURE;
  const rows = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  const problems = checkForgeV2Rows(rows);
  const behaviour = forgeV2BehaviourPassRate(rows);
  console.log(`interactive-behaviour gate: ${behaviour.passed}/${behaviour.segments} graded segments pass (${behaviour.passRate === null ? 'n/a' : `${Math.round(behaviour.passRate * 100)}%`}), ${behaviour.states} permitted states scored`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`FAIL: ${problem}`);
    process.exit(1);
  }
  console.log(`forge-v2:check OK — ${(rows as unknown[]).length} Forge-emitted v2 rows pass Core's strict contract (${path.relative(process.cwd(), file)})`);
}
