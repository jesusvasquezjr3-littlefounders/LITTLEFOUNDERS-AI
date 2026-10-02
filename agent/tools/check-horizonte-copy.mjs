#!/usr/bin/env node
/**
 * Horizonte Visual copy gate. Every pack keeps its strings in frontend/src/rebuild/learning/horizonte/<pack>/copy.ts,
 * each as { role, 'en-US', 'es-MX', 'pt-BR' }. This enumerates those modules by directory scan (no list to maintain) and checks:
 * a valid Copy Budget role, three non-empty native versions (a translated string is not a copy of the English one),
 * and the word and sentence budgets of frontend/src/rebuild/design/copyBudget.ts at the entry's age band (6-9 unless it says otherwise).
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const horizonte = resolve(root, 'frontend/src/rebuild/learning/horizonte');
const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
const ROLES = ['action', 'heading', 'body', 'prompt', 'option', 'mentor', 'narrative', 'data', 'brand', 'legal'];
const UNBUDGETED = new Set(['data', 'brand', 'legal']);

export function packCopyDirs(base = horizonte) {
  return readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(join(base, entry.name, 'copy.ts'))).map((entry) => entry.name).sort();
}

export function checkPackCopy(pack, copy, budget) {
  const problems = [];
  for (const [key, entry] of Object.entries(copy)) {
    const label = `${pack}.${key}`;
    if (!entry || typeof entry !== 'object' || !ROLES.includes(entry.role)) { problems.push(`${label}: missing or unknown data-copy-role`); continue; }
    const band = entry.band ?? '6-9';
    for (const locale of LOCALES) {
      const text = entry[locale];
      if (typeof text !== 'string' || !text.trim()) { problems.push(`${label}: no ${locale} text`); continue; }
      for (const issue of budget.checkCopy(text, entry.role, { locale, ageBand: band, surface: 'app' })) problems.push(`${label} (${locale}): ${issue}`);
      if (locale !== 'en-US' && !UNBUDGETED.has(entry.role) && text === entry['en-US'] && budget.wordCount(text) > 1) problems.push(`${label} (${locale}): identical to en-US, not a native translation`);
    }
    const extra = Object.keys(entry).filter((name) => name !== 'role' && name !== 'band' && !LOCALES.includes(name));
    if (extra.length) problems.push(`${label}: unexpected field ${extra.join(', ')}`);
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const budget = await import(pathToFileURL(resolve(root, 'frontend/src/rebuild/design/copyBudget.ts')).href);
  const problems = [];
  const packs = packCopyDirs();
  let entries = 0;
  for (const pack of packs) {
    const module = await import(pathToFileURL(join(horizonte, pack, 'copy.ts')).href);
    const exported = Object.entries(module).filter(([name]) => name.endsWith('_COPY'));
    if (exported.length !== 1) { problems.push(`${pack}: copy.ts must export exactly one *_COPY object`); continue; }
    entries += Object.keys(exported[0][1]).length;
    problems.push(...checkPackCopy(pack, exported[0][1], budget));
  }
  if (problems.length) { console.error(`Horizonte copy check failed:\n${problems.join('\n')}`); process.exitCode = 1; }
  else console.log(`Horizonte copy OK (${packs.length} packs, ${entries} strings, 3 locales).`);
}
