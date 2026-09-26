// check-family-copy-tone.mjs — D.8: the tone gate for Family Hub and Digital
// Banking system copy. B.14 asks Forge to screen lesson content for "bank
// voice"; D.8 extends the same standard to the moments of monetary friction
// this Block owns: a reward that is not approved yet, a spending limit
// reached, a freeze, an allowance arriving, a correction.
//
// Scope (agent/tools/family-copy-tone.lexicon.json): every string of the
// Family Hub and banking namespaces in all three locales, the Family Hub and
// banking subtrees of common.json and the family and banking error codes of
// errors.json. Core's own error messages are English developer diagnostics a
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
// It also reports Appendix H's Tone-Gate Pass Rate (Diagnostic): the share of
// in-scope strings that pass. `--report <path>` writes it as JSON.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    if (!words) continue;
    const m = compile(words).exec(text.replace(/\{\{?\w+\}?\}/g, ' '));
    if (m) out.push({ category, match: m[0] });
  }
  return out;
}

/** Pure check over in-memory inputs, so the gate can be tested against known-bad fixtures. */
export function checkTone({ lexicon, readLocale, surfaceSources = [] }) {
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
    if (/\berror\??\.message\b/.test(source)) failures.push(`${file}: renders a raw Core error message; map the code to copy instead`);
  }
  return { checked: strings.length, passed, failures };
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

export function liveInputs(root = ROOT) {
  return {
    lexicon: JSON.parse(readFileSync(join(root, LEXICON), 'utf8')),
    readLocale: (locale, ns) => { try { return JSON.parse(readFileSync(join(root, 'frontend/src/i18n', locale, `${ns}.json`), 'utf8')); } catch { return null; } },
    surfaceSources: (JSON.parse(readFileSync(join(root, LEXICON), 'utf8')).scope.surfaces ?? []).flatMap((dir) => walk(join(root, dir)))
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
