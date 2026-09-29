#!/usr/bin/env node
/**
 * GAP-FIX-R4 (Appendix P Part 8 Definition of Done; Bible 05 §8; CLAUDE.md
 * "text-fit, proportion and copy-budget audits must pass before merging UI"):
 * the preview renders every v2 segment kind the audits must measure from its
 * Forge fixture plan, so `audit:rebuild`, `boards()` and the chart-label check
 * reach the logic, money, story, Mentor, chart and concept boards too.
 *
 * The documents are the Forge dry-run emitter's own output
 * (coursegen/src/v2/fixtures/emitted.json, validated by Core's forge-v2:check);
 * this copies the lessons the preview uses, in all three locales, into the
 * frontend (which cannot import across packages). `--check` fails on drift.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const PREVIEW_FIXTURE_LESSONS = [
  'v2-decide-justify', 'v2-first-release-mixed', 'v2-first-release-logic', 'v2-first-release-young-money', 'v2-logic-syllogism',
  'v2-unit-price', 'v2-flowchart-build', 'v2-scam-cues', 'v2-concept-boards',
  'v2-teaching-charts', 'v2-charts-investing', 'v2-charts-entrepreneurship', 'v2-charts-tween',
];

export function previewFixtures(emitted) {
  const out = {};
  for (const lesson of PREVIEW_FIXTURE_LESSONS) {
    const rows = emitted.filter((row) => row.lesson_id === lesson);
    if (rows.length !== 3) throw new Error(`${lesson}: expected 3 emitted locales, found ${rows.length}`);
    out[lesson] = Object.fromEntries(rows.map((row) => [row.locale, row.document]));
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const emitted = JSON.parse(readFileSync(resolve(root, 'coursegen/src/v2/fixtures/emitted.json'), 'utf8'));
  const target = resolve(root, 'frontend/src/rebuild/preview/fixtures/v2FixtureDocuments.generated.json');
  const body = `${JSON.stringify(previewFixtures(emitted))}\n`;
  if (process.argv.includes('--check')) {
    let current = '';
    try { current = readFileSync(target, 'utf8'); } catch { current = ''; }
    if (current !== body) { console.error('V2 preview fixtures drift: run node agent/tools/sync-v2-preview-fixtures.mjs'); process.exitCode = 1; }
    else console.log(`V2 preview fixtures parity OK (${PREVIEW_FIXTURE_LESSONS.length} lessons, 3 locales).`);
  } else {
    writeFileSync(target, body);
    console.log(`Wrote the v2 preview fixtures (${PREVIEW_FIXTURE_LESSONS.length} lessons, 3 locales).`);
  }
}
