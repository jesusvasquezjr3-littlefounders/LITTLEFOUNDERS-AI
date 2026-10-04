import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { preview } from './helpers.mjs';

/*
 * Horizonte Visual (F0-F4): one fixture state per pack fixture, discovered by scanning
 * frontend/src/rebuild/learning/horizonte/<pack>/audit.json, so a pack lane adds its audit states by editing only its own folder.
 *
 *   audit.json   [{ "fixture": "<fixture id>", "age": "6-9" }, ...]; each entry stages the pack fixture of that id at that age
 *                (preview `?screen=fixture&seg=hz:<pack>:<fixture id>`, rebuilt from the pack's fixtures.ts). A vitest coverage test
 *                (horizonte/harness/fixtureCoverage.test.tsx) keeps audit.json and the fixtures in step.
 */
export const lane = 'horizonte';

const root = new URL('../../../src/rebuild/learning/horizonte/', import.meta.url);

export function horizonteAuditEntries() {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/audit.json`, root)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => JSON.parse(readFileSync(new URL(`${entry.name}/audit.json`, root), 'utf8')).map((item) => ({ pack: entry.name, ...item })));
}

export const states = horizonteAuditEntries().map(({ pack, fixture, age }) =>
  preview(`fixture-hz-${pack}-${fixture}@${age}`, { screen: 'fixture', age, seg: `hz:${pack}:${fixture}` }));

export const scenarios = {};

/* The synthetic Core calls every lane's `respond`; this lane answers nothing of its own, so it declines. */
export function respond() { return undefined; }
