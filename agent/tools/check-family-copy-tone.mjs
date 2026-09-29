// check-family-copy-tone.mjs — D.8: the tone gate for Family Hub and Digital
// Banking system copy. B.14 asks Forge to screen lesson content for "bank
// voice"; D.8 extends the same standard to the moments of monetary friction
// this Block owns: a reward that is not approved yet, a spending limit
// reached, a freeze, an allowance arriving, a correction.
//
// Scope (agent/tools/family-copy-tone.lexicon.json): every string of the
// Family Hub and banking namespaces in all three locales and the family
// subtree of common.json (the legacy tasks/banking subtrees and errors.json
// left with the legacy UI in S10L.1; `errorCodes` stays available for any
// error copy a surface resolves again). Core's own error messages are English developer diagnostics a
// family never reads (a surface resolves the error CODE to copy); the gate
// fails if a Family Hub or banking surface starts rendering one.
//
// Four categories, each with a stated reason:
//   bank_register  transactional/legal banking language (Law 2)
//   guarantee      a promise of safety, protection, insurance or a real bank
//                  or card the simulation cannot back (D.7)
//   glossary       the owner's controlled glossary (coins, never money; …)
//   shouting       stacked exclamation marks, capitals, raw error codes
// A reviewed exception names the key, the category and why.
//
// B.14's UI tone lexicon (coursegen/src/contentGates/tone.ts TONE_LEXICON; on
// the `ui` surface every entry blocks) runs over the same strings as a fifth
// category, `b14_ui`, so D.8 holds Family Hub copy to the same no-bank-register
// standard as Forge's system copy.
//
// Coverage (GAP-FIX-R2): every rebuild-family.json group a surface under
// scope.surfaces names must be one of scope.subtrees, and every i18next
// namespace a surface loads must be in scope; otherwise a lane could add copy
// the gate never reads.
//
// The engine is shared: check-social-copy-tone.mjs (GAP-FIX-R4, Appendix J
// Part 3 Stage 4) runs it with agent/tools/social-copy-tone.lexicon.json. A
// scope file may also name `coverage` (namespaces whose groups a surface may
// only name when in scope; default rebuild-family), `complete` (namespaces
// whose every group must be listed) and `accessors` ({ namespace, pattern }:
// the group a surface reads through an accessor such as learnCopy[l].together).
//
// It also reports Appendix H's Tone-Gate Pass Rate (Diagnostic): the share of
// in-scope strings that pass. `--report <path>` writes it as JSON.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const LEXICON = 'agent/tools/family-copy-tone.lexicon.json';
export const LOCALES = ['en-US', 'es-MX', 'pt-BR'];

/** Flatten a copy object into [dottedKey, text] pairs. */
export function flatten(node, prefix = '') {
  if (typeof node === 'string') return [[prefix, node]];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

/** Lower case, no diacritics, typographic apostrophes folded (as coursegen's foldText). */
export function fold(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/’/g, "'");
}

const escapePhrase = (phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');

/** B.14's phrases per locale, parsed from coursegen's tone lexicon source (bank/hype/urge/proc all block on `ui`). */
export function parseB14Lexicon(source) {
  const out = {};
  for (const locale of LOCALES) {
    const start = source.indexOf(`'${locale}': [`);
    if (start < 0) continue;
    const block = source.slice(start, source.indexOf('\n  ],', start));
    out[locale] = [...block.matchAll(/\b(?:bank|hype|urge|proc)\((['"])(.*?)\1\)/g)].map((m) => m[2]);
  }
  return out;
}

function compile(words) {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.join('|')})(?![\\p{L}\\p{N}])`, 'iu');
}

/** Every finding for one string: [{ category, match }]. */
export function findings(text, locale, lexicon) {
  const out = [];
  for (const [category, spec] of Object.entries(lexicon.categories)) {
    if (category === 'shouting') {
      for (const pattern of spec.patterns) {
        for (const m of text.matchAll(new RegExp(pattern, 'g'))) {
          if (!spec.allowCaps.includes(m[0])) out.push({ category, match: m[0] });
        }
      }
      continue;
    }
    const words = spec[locale];
    if (!words || words.length === 0) continue;
    const plain = text.replace(/\{\{?\w+\}?\}/g, ' ');
    const m = spec.folded ? compile(words.map(escapePhrase)).exec(fold(plain)) : compile(words).exec(plain);
    if (m) out.push({ category, match: m[0] });
  }
  return out;
}

/** Pure check over in-memory inputs, so the gate can be tested against known-bad fixtures. */
export function checkTone({ lexicon, readLocale, surfaceSources = [], lexiconPath = LEXICON }) {
  const strings = [];
  const add = (key, locale, text) => strings.push({ key, locale, text });
  for (const locale of LOCALES) {
    for (const ns of lexicon.scope.namespaces) {
      const file = readLocale(locale, ns);
      if (file === null) { add(`${ns}:(missing file)`, locale, null); continue; }
      for (const [k, text] of flatten(file)) add(`${ns}:${k}`, locale, text);
    }
    for (const subtree of lexicon.scope.subtrees) {
      const [ns, path] = subtree.split(':');
      const node = path.split('.').reduce((n, k) => n?.[k], readLocale(locale, ns));
      for (const [k, text] of flatten(node, path)) add(`${ns}:${k}`, locale, text);
    }
    const errors = readLocale(locale, 'errors')?.api ?? {};
    for (const code of lexicon.scope.errorCodes) if (typeof errors[code] === 'string') add(`errors:api.${code}`, locale, errors[code]);
  }
  const excepted = new Set(lexicon.exceptions.map((e) => `${e.key}|${e.category}`));
  const failures = [];
  let passed = 0;
  for (const s of strings) {
    if (s.text === null) { failures.push(`${s.key}: in scope but not found`); continue; }
    const found = findings(s.text, s.locale, lexicon).filter((f) => !excepted.has(`${s.key}|${f.category}`));
    if (found.length === 0) passed++;
    for (const f of found) failures.push(`${s.key} [${s.locale}] ${f.category}: "${f.match}" in "${s.text}"`);
  }
  const used = new Set();
  for (const s of strings) {
    if (s.text === null) continue;
    for (const f of findings(s.text, s.locale, lexicon)) if (excepted.has(`${s.key}|${f.category}`)) used.add(`${s.key}|${f.category}`);
  }
  for (const e of lexicon.exceptions) {
    if (!e.why || e.why.trim().length < 20) failures.push(`exception ${e.key}: needs a reason a reviewer can check`);
    // A stale exception would silently excuse the next string written under that key.
    if (!used.has(`${e.key}|${e.category}`)) failures.push(`exception ${e.key} (${e.category}) excuses nothing any more; remove it`);
  }
  // A family reads only in-scope copy: no Family Hub or banking surface renders a raw Core message.
  for (const [file, source] of surfaceSources) {
    // Comparing a message (the offline probe) is not rendering it.
    if (/\berror\??\.message\b(?!\s*[!=]==)/.test(source)) failures.push(`${file}: renders a raw Core error message; map the code to copy instead`);
  }
  // Coverage: no surface renders a group of a covered namespace (scope.coverage, default rebuild-family)
  // or an i18next namespace the gate never reads; and every group of a `scope.complete` namespace is in
  // scope, even one no surface names yet.
  const scopedNamespaces = new Set([...lexicon.scope.namespaces, ...lexicon.scope.subtrees.map((s) => s.split(':')[0])]);
  const groupsOf = (ns) => new Set(lexicon.scope.subtrees.filter((s) => s.startsWith(`${ns}:`)).map((s) => s.slice(ns.length + 1).split('.')[0]));
  const unread = new Map();
  for (const ns of lexicon.scope.coverage ?? ['rebuild-family']) {
    if (lexicon.scope.namespaces.includes(ns)) continue;
    const groups = Object.keys(readLocale('en-US', ns) ?? {});
    const scopedGroups = groupsOf(ns);
    for (const [file, source] of surfaceSources) {
      for (const g of groups) if (!scopedGroups.has(g) && new RegExp(`\\b${g}\\b`).test(source)) unread.set(`${ns}:${g}`, file);
    }
  }
  for (const [file, source] of surfaceSources) {
    for (const m of source.matchAll(/useTranslation\(\s*\[?\s*['"]([\w-]+)['"]/g)) if (!scopedNamespaces.has(m[1])) unread.set(m[1], file);
    // A namespace whose group names are ordinary words (rebuild-learn: back, home, lesson) is covered by
    // the accessor a surface reads it through instead (e.g. learnCopy[locale].together).
    for (const { namespace, pattern } of lexicon.scope.accessors ?? []) {
      const scopedGroups = groupsOf(namespace);
      for (const m of source.matchAll(new RegExp(pattern, 'g'))) if (!scopedGroups.has(m[1])) unread.set(`${namespace}:${m[1]}`, file);
    }
  }
  for (const [group, file] of unread) failures.push(`${file}: renders ${group}, which is outside the tone gate's scope; add it to scope in ${lexiconPath}`);
  for (const ns of lexicon.scope.complete ?? []) {
    const listed = groupsOf(ns);
    for (const g of Object.keys(readLocale('en-US', ns) ?? {})) {
      if (!listed.has(g)) failures.push(`${ns}:${g} is a copy group outside the tone gate's scope; add it to scope in ${lexiconPath}`);
    }
  }
  return { checked: strings.length, passed, failures };
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

export const B14_TONE = 'coursegen/src/contentGates/tone.ts';

/** The lexicon file plus B.14's UI phrases as the folded `b14_ui` category. */
export function loadLexicon(root = ROOT, lexiconPath = LEXICON) {
  const lexicon = JSON.parse(readFileSync(join(root, lexiconPath), 'utf8'));
  const b14 = parseB14Lexicon(readFileSync(join(root, B14_TONE), 'utf8'));
  if (LOCALES.some((l) => !(b14[l]?.length > 0))) throw new Error(`${B14_TONE}: could not read TONE_LEXICON for every locale`);
  lexicon.categories.b14_ui = { why: "B.14's UI tone lexicon (Law 2), shared with Forge's system-copy gate.", folded: true, ...b14 };
  return lexicon;
}

/** A `scope.surfaces` entry is a directory (walked) or a single file. */
function surfaceFiles(root, entry) {
  const path = join(root, entry);
  return statSync(path).isDirectory() ? walk(path) : [path];
}

/** The live inputs for one scope file: the family scope by default, the social-layer scope for check-social-copy-tone.mjs. */
export function liveInputs(root = ROOT, lexiconPath = LEXICON) {
  const lexicon = loadLexicon(root, lexiconPath);
  return {
    lexicon,
    lexiconPath,
    readLocale: (locale, ns) => { try { return JSON.parse(readFileSync(join(root, 'frontend/src/i18n', locale, `${ns}.json`), 'utf8')); } catch { return null; } },
    surfaceSources: (lexicon.scope.surfaces ?? []).flatMap((entry) => surfaceFiles(root, entry))
      .filter((f) => /\.(tsx?|mjs)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map((f) => [f.slice(root.length).replace(/\\/g, '/'), readFileSync(f, 'utf8')]),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkTone(liveInputs());
  const rate = result.checked > 0 ? result.passed / result.checked : null;
  const reportAt = process.argv.indexOf('--report');
  if (reportAt > 0 && process.argv[reportAt + 1]) {
    writeFileSync(process.argv[reportAt + 1], `${JSON.stringify({
      metric: 'Tone-Gate Pass Rate (Family Hub/Banking copy), Appendix H Part 1.3, Diagnostic',
      at: new Date().toISOString(), checked: result.checked, passed: result.passed, passRate: rate, failures: result.failures,
    }, null, 2)}\n`);
  }
  if (result.failures.length > 0) {
    for (const failure of result.failures) console.error(`FAIL: ${failure}`);
    console.error(`family-copy-tone: ${result.passed} of ${result.checked} strings pass (${((rate ?? 0) * 100).toFixed(1)}%)`);
    process.exit(1);
  }
  console.log(`family-copy-tone OK — ${result.checked} Family Hub and banking strings in three locales; no surface renders a raw Core message; pass rate ${((rate ?? 0) * 100).toFixed(1)}%`);
}
