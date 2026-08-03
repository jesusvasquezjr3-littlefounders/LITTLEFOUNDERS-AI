#!/usr/bin/env node
/**
 * check-t-keys.mjs — verifies that every STATIC t('...') key referenced in the
 * frontend source actually EXISTS in the en-US key set (/AGENTS.md §1.8:
 * en-US defines the key set).
 *
 * Why this exists: three-locale PARITY (phase 1 of check-i18n.sh) only proves
 * the locales agree with each other. A key that a component calls but that
 * exists in NO locale is perfectly "in parity" — and i18next renders it as the
 * raw dot-path on screen ("learn.course.startButton"). 81 such keys shipped
 * before this check existed.
 *
 * Key resolution mirrors frontend/src/i18n/index.ts exactly: locale resources
 * are FRAGMENTED per route area, and the fragment FILENAME becomes the key
 * prefix — EXCEPT common.json, which is spread at the ROOT with no prefix.
 * If index.ts ever changes that mapping, change it here in the same commit or
 * this check reports false positives.
 *
 * THREE things are checked, all of them statically DECIDABLE. Nothing here is a
 * heuristic; a guess that produces false failures trains people to ignore the
 * gate, which is worse than no gate.
 *
 *   1. Plain literals — t('a.b.c') must exist in en-US.
 *   2. Conditional literals — in t(cond ? 'a.b' : 'a.c') BOTH branches are
 *      string literals, so both are statically known and both are checked
 *      exactly like case 1. Chained ternaries are walked to every leaf.
 *   3. Template-literal NAMESPACE — in t(`a.b.${expr}`) the leading segment
 *      'a.b' is known even though the last one is not. If 'a.b' is not an
 *      OBJECT node in en-US then NO key under it can resolve, so every render
 *      through that call is a raw dot-path. This proves the whole-branch-
 *      missing case only; the individual LEAVES under ${…} are NOT verified.
 *
 * Case 3 is reported as a HARD FAILURE, under its own label. That is sound,
 * not a guess: "key = <prefix>.<anything>" and "<prefix> is absent" together
 * entail "the key is absent", with no runtime information needed. The two
 * cases where a missing prefix would NOT be a defect — an i18next
 * defaultValue, or a string/expression second argument, both of which render a
 * fallback instead of the raw path — are detected and skipped before the
 * prefix is ever looked up (see hasFallback).
 *
 * Still skipped, because nothing at all is knowable: t(someVar),
 * t('a.' + b), t(`${ns}.title`) — no static leading segment exists.
 *
 * Usage:  node agent/tools/check-t-keys.mjs [path]
 * Exit:   0 = every decidable key/namespace resolves, 1 = at least one is missing
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const ROOT = process.argv[2] || 'frontend/src';
const LOCALE_DIR = join(ROOT, 'i18n', 'en-US');

const EXCLUDE_DIRS = new Set(['__tests__', 'node_modules', '.vercel', 'dist', 'i18n']);
const INCLUDE_EXTS = new Set(['.tsx', '.ts']);

/** i18next plural suffixes — t('x', { count }) resolves x_one / x_other, never x. */
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

if (!existsSync(LOCALE_DIR)) {
  console.log(`check-t-keys SKIPPED — ${LOCALE_DIR} does not exist yet`);
  process.exit(0);
}

// ── Build the en-US key set, mirroring frontend/src/i18n/index.ts ────────────
// KEYS  = leaf paths (what t() can actually render).
// NODES = container paths (what a dynamic `${…}` segment can hang off).
function flatten(obj, prefix, out, nodes) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      nodes.add(path);
      flatten(v, path, out, nodes);
    } else out.add(path);
  }
  return out;
}

const KEYS = new Set();
const NODES = new Set();
for (const file of readdirSync(LOCALE_DIR).sort()) {
  if (extname(file) !== '.json') continue;
  const json = JSON.parse(readFileSync(join(LOCALE_DIR, file), 'utf8'));
  // common.json is spread at the root (no prefix); every other fragment is
  // mounted under its own filename.
  const prefix = basename(file, '.json') === 'common' ? '' : basename(file, '.json');
  if (prefix) NODES.add(prefix);
  flatten(json, prefix, KEYS, NODES);
}

function resolves(key) {
  if (KEYS.has(key)) return true;
  return PLURAL_SUFFIXES.some((s) => KEYS.has(key + s));
}

// ── Scan source for static t('...') / t("...") calls ─────────────────────────
// Not preceded by an identifier char, so expect(, useState( etc. never match;
// `i18n.t('x')` still does.
const T_CALL = /(?<![A-Za-z0-9_$])t\s*\(\s*(['"])((?:[^'"\\\n]|\\.)+)\1/g;

// ── Micro-scanner for the DYNAMIC forms ──────────────────────────────────────
// A regex cannot tell `t(a ? 'x' : 'y', { defaultValue })` from `t(b('?'), c)`,
// so the dynamic pass walks the call text character by character instead. It is
// deliberately conservative: any construct it cannot read cleanly makes it bail
// out and check nothing, which can never produce a false failure. No parser
// dependency — the repo root has zero npm dependencies and this gate keeps it
// that way.

/** Same call opener as T_CALL, but without consuming the argument. */
const T_OPEN = /(?<![A-Za-z0-9_$])t\s*\(/g;

/** Longest call text the scanner will read before giving up. */
const SCAN_LIMIT = 4000;

/** Index of the closing quote of the literal starting at i, or -1. */
function skipQuoted(s, i) {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === q) return j;
    if (s[j] === '\n') return -1; // unterminated on its line — not a literal
  }
  return -1;
}

/** Index of the closing backtick of the template starting at i, or -1. */
function skipTemplate(s, i) {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '`') return j;
    if (s[j] === '$' && s[j + 1] === '{') {
      let depth = 1;
      let k = j + 2;
      while (k < s.length && depth > 0) {
        const c = s[k];
        if (c === '\\') { k += 2; continue; }
        if (c === "'" || c === '"') { const e = skipQuoted(s, k); if (e < 0) return -1; k = e + 1; continue; }
        if (c === '`') { const e = skipTemplate(s, k); if (e < 0) return -1; k = e + 1; continue; }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        k++;
      }
      if (depth > 0) return -1;
      j = k - 1; // the for-loop's j++ steps past the closing '}'
      continue;
    }
  }
  return -1;
}

/**
 * Reads the call whose '(' sits at openIdx and returns
 * { arg, rest } — argument 1 verbatim, and everything after the first
 * top-level comma. Returns null if the call does not close cleanly.
 */
function readCall(content, openIdx) {
  let depth = 0;
  let argEnd = -1;
  for (let i = openIdx; i < content.length && i - openIdx < SCAN_LIMIT; i++) {
    const c = content[i];
    if (c === "'" || c === '"') { const e = skipQuoted(content, i); if (e < 0) return null; i = e; continue; }
    if (c === '`') { const e = skipTemplate(content, i); if (e < 0) return null; i = e; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')') {
      depth--;
      if (depth === 0) {
        return argEnd < 0
          ? { arg: content.slice(openIdx + 1, i), rest: '' }
          : { arg: content.slice(openIdx + 1, argEnd), rest: content.slice(argEnd + 1, i) };
      }
      if (depth < 0) return null;
      continue;
    }
    if (c === ']' || c === '}') { depth--; if (depth < 0) return null; continue; }
    if (c === ',' && depth === 1 && argEnd < 0) argEnd = i;
  }
  return null;
}

/**
 * True when a missing key would render a FALLBACK rather than the raw dot-path,
 * so it is not a defect. i18next accepts t(key, defaultValue, opts) as well as
 * t(key, opts) — any non-object second argument IS the default value.
 */
function hasFallback(rest) {
  const r = rest.trim();
  if (!r) return false;
  if (r.startsWith('{')) return /\bdefaultValue\b/.test(r);
  return true;
}

/** Index of the conditional '?' at nesting depth 0 in expr, or -1. */
function topLevelQuestion(expr) {
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === "'" || c === '"') { const e = skipQuoted(expr, i); if (e < 0) return -1; i = e; continue; }
    if (c === '`') { const e = skipTemplate(expr, i); if (e < 0) return -1; i = e; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; continue; }
    if (c === '?' && depth === 0) {
      if (expr[i + 1] === '?') { i++; continue; } // ?? / ??=
      if (expr[i + 1] === '.') continue; // ?.
      return i;
    }
  }
  return -1;
}

/** Index of the ':' that pairs with the '?' at qIdx, or -1. */
function matchingColon(expr, qIdx) {
  let depth = 0;
  let nested = 0;
  for (let i = qIdx + 1; i < expr.length; i++) {
    const c = expr[i];
    if (c === "'" || c === '"') { const e = skipQuoted(expr, i); if (e < 0) return -1; i = e; continue; }
    if (c === '`') { const e = skipTemplate(expr, i); if (e < 0) return -1; i = e; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; continue; }
    if (depth !== 0) continue;
    if (c === '?') {
      if (expr[i + 1] === '?') { i++; continue; }
      if (expr[i + 1] === '.') continue;
      nested++;
      continue;
    }
    if (c === ':') { if (nested === 0) return i; nested--; }
  }
  return -1;
}

/**
 * Every statically-known key form the expression can evaluate to. Ternaries are
 * walked to their leaves; a leaf that is neither a string literal nor a template
 * literal contributes nothing (it is simply unknowable, never a failure).
 */
function collectBranches(expr, out) {
  const q = topLevelQuestion(expr);
  if (q >= 0) {
    const c = matchingColon(expr, q);
    if (c < 0) return;
    collectBranches(expr.slice(q + 1, c), out);
    collectBranches(expr.slice(c + 1), out);
    return;
  }
  const e = expr.trim();
  if ((e.startsWith("'") || e.startsWith('"')) && skipQuoted(e, 0) === e.length - 1) {
    out.push({ kind: 'exact', value: e.slice(1, -1) });
  } else if (e.startsWith('`') && skipTemplate(e, 0) === e.length - 1) {
    out.push({ kind: 'template', value: e });
  }
}

/**
 * `a.b.${x}`        → { prefix: 'a.b' }      (namespace known, leaf unknown)
 * `a.b.metric${x}`  → { prefix: 'a.b' }      (dynamic segment is glued to 'metric')
 * `a.b.c`           → { full: 'a.b.c' }      (no substitution: an ordinary key)
 * `${ns}.title`     → {}                     (nothing static leads the key)
 */
function templatePrefix(tpl) {
  const inner = tpl.slice(1, -1);
  const at = inner.indexOf('${');
  if (at < 0) return { full: inner };
  const head = inner.slice(0, at);
  if (!head.includes('.')) return {};
  return { prefix: head.slice(0, head.lastIndexOf('.')) };
}

const missing = [];
const missingNs = [];

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (const m of content.matchAll(T_CALL)) {
    const key = m[2];
    if (resolves(key)) continue;

    const lineno = content.slice(0, m.index).split('\n').length;
    const line = lines[lineno - 1] ?? '';
    // A comment mentioning a key is documentation, not a render path.
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
    // t('x', { defaultValue: ... }) renders the fallback, never the raw path.
    if (line.slice(line.indexOf(key)).includes('defaultValue')) continue;

    missing.push({ key, file: filePath, lineno });
  }

  // Dynamic forms: t(cond ? 'a' : 'b') and t(`a.b.${expr}`).
  for (const m of content.matchAll(T_OPEN)) {
    const openIdx = m.index + m[0].length - 1;
    const call = readCall(content, openIdx);
    if (!call) continue;

    const isTernary = topLevelQuestion(call.arg) >= 0;
    const isTemplate = call.arg.trim().startsWith('`');
    if (!isTernary && !isTemplate) continue; // plain literals belong to the pass above

    const lineno = content.slice(0, openIdx).split('\n').length;
    const line = lines[lineno - 1] ?? '';
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
    if (hasFallback(call.rest)) continue; // renders the default, never the raw path

    const branches = [];
    collectBranches(call.arg, branches);
    for (const b of branches) {
      if (b.kind === 'exact') {
        if (!resolves(b.value)) missing.push({ key: b.value, file: filePath, lineno });
        continue;
      }
      const { full, prefix } = templatePrefix(b.value);
      if (full !== undefined) {
        if (!resolves(full)) missing.push({ key: full, file: filePath, lineno });
      } else if (prefix && !NODES.has(prefix)) {
        missingNs.push({ ns: prefix, expr: b.value, file: filePath, lineno });
      }
    }
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (st.isFile() && INCLUDE_EXTS.has(extname(entry)) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      scanFile(full);
    }
  }
}

walk(ROOT);

const NOTE =
  'check-t-keys NOTE — under a dynamic `${…}` segment only the static namespace is\n' +
  '  verified. The individual LEAF keys below it are NOT checked and cannot be: a\n' +
  '  green run is not proof that every dynamic key resolves.';

if (missing.length > 0) {
  console.error('check-t-keys FAILED — t() keys referenced in source but missing from en-US:');
  for (const { key, file, lineno } of missing.sort((a, b) => a.key.localeCompare(b.key))) {
    console.error(`  ${key}  ←  ${file}:${lineno}`);
  }
  const unique = new Set(missing.map((m) => m.key)).size;
  console.error(`\ncheck-t-keys: ${unique} missing key(s) across ${missing.length} reference(s).`);
  console.error('Add each key to en-US first, then es-MX and pt-BR in the SAME commit (§1.8).');
}

if (missingNs.length > 0) {
  if (missing.length > 0) console.error('');
  console.error('check-t-keys FAILED [dynamic namespace] — t() builds keys under a namespace that');
  console.error('does not exist in en-US, so EVERY key it can build renders as a raw dot-path:');
  for (const { ns, expr, file, lineno } of missingNs.sort((a, b) => a.ns.localeCompare(b.ns))) {
    console.error(`  ${ns}.*  ←  ${file}:${lineno}   from ${expr}`);
  }
  const unique = new Set(missingNs.map((m) => m.ns)).size;
  console.error(`\ncheck-t-keys: ${unique} missing namespace(s) across ${missingNs.length} reference(s).`);
  console.error('Add the whole branch to en-US first, then es-MX and pt-BR in the SAME commit (§1.8).');
}

if (missing.length > 0 || missingNs.length > 0) {
  console.error(`\n${NOTE}`);
  process.exit(1);
}

console.log('check-t-keys OK — every static t() key resolves in en-US');
console.log('check-t-keys OK — both branches of every literal t(cond ? a : b) resolve in en-US');
console.log('check-t-keys OK — every t(`ns.${…}`) namespace exists in en-US');
console.log(NOTE);
process.exit(0);
