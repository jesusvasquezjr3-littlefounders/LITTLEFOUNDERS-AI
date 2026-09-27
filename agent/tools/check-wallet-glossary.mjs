#!/usr/bin/env node
// check-wallet-glossary.mjs — OD-28 (H-16, owner review 27 September 2026):
// the money section formerly called "Digital Banking" / "Banca Digital" /
// "Banco Digital" is the Wallet / Cartera / Carteira (owner log §5, the
// controlled glossary). This gate keeps the retired name from coming back
// anywhere a person reads it:
//
//   1. every i18n namespace in every locale (the rebuilt app, the legacy
//      surfaces still mounted, the public site, account emails, errors);
//      es-MX also may not call it "monedero" or "billetera", pt-BR not
//      "carteira digital", and no locale may label it "Banking" / "Banca" /
//      "Banco" on its own (a navigation label);
//   2. inline strings in the SPA, its scripts (SEO, prerender) and public
//      files, the account-email templates, and the user-facing strings of
//      every backend service (comments are stripped: an identifier or route
//      such as `/banking` is not a name anyone reads);
//   3. the documentation. History keeps the old name: the review queue and
//      its answers, the legacy audit, sprint records and applied migrations.
//      The binding SPEC (docs/littlefounders-spec/, checksummed) is the
//      owner's text: OD-28 in its owner log already renames the section and
//      outranks the older wording in Product 10 and its appendices, which only
//      the owner amends. A doc line that names the rename itself ("formerly",
//      OD-28, H-16) is allowed.
//
// A sentence that says coins are NOT in a bank ("not a bank account") stays
// allowed: the rule is about the section's name, not about the disclaimer.
//
//   node agent/tools/check-wallet-glossary.mjs      (inside spec:check)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** The retired name in any of the three locales. */
export const RETIRED_NAME = /(?<![\p{L}])(?:digital banking|banca digital|banco digital)(?![\p{L}])/iu;
/** Per-locale synonyms the controlled glossary rules out for the section. */
export const LOCALE_SYNONYMS = {
  'en-US': /(?<![\p{L}])(?:online banking)(?![\p{L}])/iu,
  'es-MX': /(?<![\p{L}])(?:monedero|billetera|banca en l[ií]nea)(?![\p{L}])/iu,
  'pt-BR': /(?<![\p{L}])(?:carteira digital)(?![\p{L}])/iu,
};
/** A label that is only the old short name (the legacy navigation said "Banking"). */
export const BARE_LABEL = /^\s*(?:banking|banca|banco)\s*$/iu;
/** A doc line may name the old section when it records the rename. */
export const RENAME_NOTE = /formerly|OD-28|H-16|antes llamad|antigo|anteriormente/i;

/** Documentation kept as history, or owned by the owner (the checksummed SPEC): never rewritten here, so never scanned. */
export const HISTORY = [
  'docs/littlefounders-spec/',
  'docs/rebuild/OWNER-REVIEW-QUEUE.md',
  'docs/rebuild/OWNER-REVIEW-ANSWERS.md',
  'docs/rebuild/sprints/',
  'docs/product-audit/',
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.lane-cache', 'runs', '.vite', '__snapshots__']);
const SOURCE = /\.(?:ts|tsx|mjs|js|cjs)$/;
const TEST = /(?:\.test\.|\.spec\.|__tests__|[\\/]tests?[\\/]|Fixtures?\.ts$|fixtures\.ts$)/;
const PUBLIC_TEXT = /\.(?:html|txt|xml|json|webmanifest|md|svg)$/;

function walk(dir, keep, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, keep, out);
    else if (keep(path)) out.push(path);
  }
  return out;
}

const rel = (root, path) => relative(root, path).split(sep).join('/');

/** Strips block and line comments, keeping `://` in URLs. */
export function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function flatten(value, prefix = '') {
  if (typeof value === 'string') return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((item, i) => flatten(item, `${prefix}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
  return [];
}

/** One i18n value: the retired name, a locale synonym, or a bare "Banking" label. */
export function copyViolation(locale, text) {
  if (RETIRED_NAME.test(text)) return 'retired name';
  if (LOCALE_SYNONYMS[locale]?.test(text)) return 'glossary synonym';
  if (BARE_LABEL.test(text)) return 'bare banking label';
  return null;
}

export function scanI18n(root) {
  const base = join(root, 'frontend/src/i18n');
  const found = [];
  if (!existsSync(base)) return found;
  for (const locale of readdirSync(base)) {
    const dir = join(base, locale);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
      const strings = flatten(JSON.parse(readFileSync(join(dir, file), 'utf8')));
      for (const [key, text] of strings) {
        const why = copyViolation(locale, text);
        if (why) found.push(`frontend/src/i18n/${locale}/${file} ${key}: ${why} "${text}"`);
      }
    }
  }
  return found;
}

/** Source and public files a person reads the output of. */
export function scanSources(root) {
  const serviceDirs = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'package.json')) && existsSync(join(root, entry.name, 'src')))
    .map((entry) => join(root, entry.name, 'src'));
  const sources = [
    ...serviceDirs.flatMap((dir) => walk(dir, (path) => SOURCE.test(path) && !TEST.test(path))),
    ...walk(join(root, 'frontend/scripts/seo'), (path) => SOURCE.test(path) && !TEST.test(path)),
  ];
  const publicFiles = [
    ...walk(join(root, 'frontend/public'), (path) => PUBLIC_TEXT.test(path)),
    ...['frontend/index.html'].map((path) => join(root, path)).filter(existsSync),
  ];
  const found = [];
  for (const file of sources) {
    const lines = withoutComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, i) => { if (RETIRED_NAME.test(line)) found.push(`${rel(root, file)}:${i + 1}: retired name in a string`); });
  }
  for (const file of publicFiles) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => { if (RETIRED_NAME.test(line)) found.push(`${rel(root, file)}:${i + 1}: retired name in a public file`); });
  }
  return found;
}

export function scanDocs(root) {
  const docs = [
    ...walk(join(root, 'docs'), (path) => /\.(?:md|json)$/.test(path)),
    ...['README.md', 'CLAUDE.md', 'AGENTS.md'].map((path) => join(root, path)).filter(existsSync),
  ];
  const found = [];
  for (const file of docs) {
    const path = rel(root, file);
    if (HISTORY.some((prefix) => path === prefix || path.startsWith(prefix))) continue;
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (RETIRED_NAME.test(line) && !RENAME_NOTE.test(line)) found.push(`${path}:${i + 1}: retired name in a doc`);
    });
  }
  return found;
}

export function checkWalletGlossary(root = repo) {
  return [...scanI18n(root), ...scanSources(root), ...scanDocs(root)];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const found = checkWalletGlossary();
  if (found.length) {
    console.error(`wallet glossary (OD-28): ${found.length} place(s) still name the money section "Digital Banking" or a ruled-out synonym:`);
    for (const line of found) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log('wallet glossary (OD-28): the money section is Wallet / Cartera / Carteira everywhere a person reads it.');
}
