#!/usr/bin/env node
// check-staff-standing-constraints.mjs — G.6 and Appendix N 1.3
// (Standing-Constraint Integrity: "per-release confirmation that no staff
// read-access to a child's full AI Mentor transcripts, no staff read-access
// to banking/wallet data beyond the child and their verified guardians, and
// no user-impersonation/'login as' capability has been introduced anywhere").
// The constraints are written in docs/operations/GOVERNANCE.md section 1;
// this gate is what enforces them, in `npm run spec:check` and repo-gates.
//
// THREE CHECKS
//   1. Transcript and wallet reach. Starting from backend/src/routes/admin.ts
//      (every staff route handler is inline there), follow every imported
//      symbol the router uses, function by function, through the backend
//      modules it imports, and fail when any reachable code names a
//      transcript source (the tutor_turns table, a `/transcript` or `/turns`
//      endpoint) or a per-account wallet/banking table as a PostgREST path.
//      Aggregate metric RPCs (counts) are not per-account reads and are not
//      matched. An exception needs an ALLOWLIST entry citing an owner
//      decision (OD-n) and a reason.
//   2. Impersonation. No route path, request field or declared identifier in
//      backend/src/routes or backend/src/services is named impersonate*,
//      act-as, login-as or sudo (the social report CATEGORY 'impersonation'
//      is a value a child picks, not a capability, and is not matched).
//   3. Minting. No backend source mints a session or token for another
//      account: GoTrue generate_link, a JWT signer, or a session create call.
//
// Comments are ignored (a comment saying "no impersonation" is not a
// capability); string literals are what is scanned, because a table or an
// endpoint is named in one.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const TRANSCRIPT_PATTERNS = [
  [/\btutor_turns\b/, 'the tutor_turns transcript table'],
  [/\/transcripts?(?![\w-])/, 'a transcript endpoint'],
  [/\/turns(?![\w-])/, 'a turns endpoint'],
];

export const WALLET_TABLES = [
  'wallet_ledger', 'wallet_guardian_actions', 'wallet_self_actions', 'wallet_split_preferences', 'banking_accounts',
  'savings_goals', 'redemptions', 'redemption_catalog', 'spend_limits', 'allowance_rules', 'family_money_events',
  'personal_rewards', 'savings_bonus_explanations',
];
const WALLET_PATTERN = new RegExp(`['"\`/](?:rest/v1/)?(?:${WALLET_TABLES.join('|')})(?=[?'"\`/]|$)`);

export const IMPERSONATION = /impersonat(?!ion['"])|\bact[-_]?as\b|\blogin[-_]?as\b|\bsudo\b|\bactAs[A-Z]?\w*|\bloginAs\w*|\bimpersonate\w*/i;
export const MINTING = [
  [/generate_link/, 'GoTrue generate_link (a sign-in link for any account)'],
  [/\bSignJWT\b|\bjwt\.sign\b|\bjsonwebtoken\b/, 'a JWT signer'],
  [/\/admin\/users\/[^'"`]*\/sessions['"`][\s\S]{0,120}method:\s*['"]POST['"]/, 'a GoTrue admin session create'],
  [/\bcreateSessionFor\w*|\bmintSession\w*|\bmintAccessToken\w*/, 'a session or token minted for another account'],
];

/**
 * Exceptions. Each must cite an owner decision (OD-n) in `decision` and say
 * why; an entry without one fails the gate. Keyed by `<file>#<symbol>`.
 */
export const ALLOWLIST = [];

// ── A small TypeScript lexer: mask comments (and optionally strings) ────────

export function mask(source, { strings = false } = {}) {
  const out = source.split('');
  const blank = (from, to) => { for (let k = from; k < to; k += 1) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0;
  let lastSignificant = '';
  const regexAllowedAfter = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      let depth = 0;
      while (j < source.length) {
        const d = source[j];
        if (d === '\\') { j += 2; continue; }
        if (c === '`' && d === '$' && source[j + 1] === '{') { depth += 1; j += 2; continue; }
        if (c === '`' && depth > 0 && d === '}') { depth -= 1; j += 1; continue; }
        if (d === c && depth === 0) break;
        j += 1;
      }
      if (strings) blank(i + 1, j);
      i = j + 1;
      lastSignificant = c;
      continue;
    }
    if (c === '/' && (regexAllowedAfter.has(lastSignificant) || /\b(return|typeof|case)\s*$/.test(source.slice(Math.max(0, i - 8), i)))) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length && source[j] !== '\n') {
        const d = source[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) break;
        j += 1;
      }
      if (source[j] === '/') {
        if (strings) blank(i + 1, j);
        i = j + 1;
        lastSignificant = '/';
        continue;
      }
    }
    if (!/\s/.test(c)) lastSignificant = /[\w$]/.test(c) ? 'w' : c;
    i += 1;
  }
  return out.join('');
}

function matchClose(structure, open) {
  const pairs = { '{': '}', '(': ')', '[': ']' };
  const stack = [pairs[structure[open]]];
  for (let k = open + 1; k < structure.length; k += 1) {
    const c = structure[k];
    if (c === '{' || c === '(' || c === '[') stack.push(pairs[c]);
    else if (c === '}' || c === ')' || c === ']') {
      stack.pop();
      if (stack.length === 0) return k;
    }
  }
  return structure.length - 1;
}

/** Top-level declarations: name -> [start, end) of its whole text. */
export function topLevelSymbols(source) {
  const structure = mask(source, { strings: true });
  const symbols = new Map();
  let depth = 0;
  for (let i = 0; i < structure.length; i += 1) {
    const c = structure[i];
    if (c === '{' || c === '(' || c === '[') { depth += 1; continue; }
    if (c === '}' || c === ')' || c === ']') { depth -= 1; continue; }
    if (depth !== 0 || !/[a-z]/.test(c) || (i > 0 && /[\w$]/.test(structure[i - 1]))) continue;
    const rest = structure.slice(i, i + 200);
    const fn = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(rest);
    const decl = fn ? null : /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(rest);
    const cls = fn || decl ? null : /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(rest);
    const found = fn ?? decl ?? cls;
    if (!found) continue;
    const name = found[1];
    let end;
    if (fn || cls) {
      // The body is the first `{` at bracket depth 0 not preceded by a type position.
      let k = i + found[0].length;
      if (fn) {
        const open = structure.indexOf('(', k);
        k = matchClose(structure, open) + 1;
      }
      let angle = 0;
      for (; k < structure.length; k += 1) {
        const d = structure[k];
        if (d === '<') angle += 1;
        else if (d === '>' && structure[k - 1] !== '=') angle -= 1;
        else if ((d === '(' || d === '[') && angle === 0) k = matchClose(structure, k);
        else if (d === '{' && angle === 0) {
          const before = structure.slice(0, k).trimEnd().slice(-1);
          if (':|&,<(='.includes(before) && !structure.slice(0, k).trimEnd().endsWith('=>')) { k = matchClose(structure, k); continue; }
          break;
        }
      }
      end = matchClose(structure, k) + 1;
    } else {
      // A declaration ends at the first `;` (or a blank line) at depth 0.
      let k = i + found[0].length;
      let d = 0;
      for (; k < structure.length; k += 1) {
        const ch = structure[k];
        if (ch === '{' || ch === '(' || ch === '[') d += 1;
        else if (ch === '}' || ch === ')' || ch === ']') d -= 1;
        else if (ch === ';' && d === 0) break;
        else if (ch === '\n' && d === 0 && structure[k + 1] === '\n') break;
      }
      end = k + 1;
    }
    symbols.set(name, [i, end]);
    i = end - 1;
  }
  return symbols;
}

/** Relative imports: local name -> { file, name } ('*' for a namespace). */
export function importsOf(source, file) {
  const map = new Map();
  const re = /import\s+(type\s+)?(?:(\*\s+as\s+([\w$]+))|\{([^}]*)\})\s+from\s+['"](\.[^'"]+)['"]/g;
  for (const m of source.matchAll(re)) {
    if (m[1]) continue;
    const target = resolve(dirname(file), m[5].replace(/\.js$/, '.ts'));
    if (!existsSync(target)) continue;
    if (m[3]) { map.set(m[3], { file: target, name: '*' }); continue; }
    for (const part of m[4].split(',')) {
      const spec = part.trim().replace(/^type\s+/, '');
      if (!spec) continue;
      const [imported, local] = spec.split(/\s+as\s+/).map((s) => s.trim());
      map.set(local ?? imported, { file: target, name: imported });
    }
  }
  return map;
}

const cache = new Map();
function load(file) {
  if (!cache.has(file)) {
    const source = readFileSync(file, 'utf8');
    cache.set(file, { source, code: mask(source), symbols: topLevelSymbols(source), imports: importsOf(source, file) });
  }
  return cache.get(file);
}

const identifiers = (text) => new Set([...text.matchAll(/[A-Za-z_$][\w$]*/g)].map((m) => m[0]));

/**
 * Walks from `root` (whole file) through every referenced symbol and returns
 * each reachable violation with its path.
 */
export function reachViolations(rootFile, { allowlist = ALLOWLIST, root = ROOT } = {}) {
  const violations = [];
  const seen = new Set();
  const queue = [{ file: rootFile, name: null, path: [relative(root, rootFile).replaceAll('\\', '/')] }];
  while (queue.length > 0) {
    const { file, name, path } = queue.shift();
    const key = `${file}#${name ?? '*file*'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const unit = load(file);
    let text;
    if (name === null) text = unit.code;
    else {
      const span = unit.symbols.get(name);
      if (!span) continue;
      text = unit.code.slice(span[0], span[1]);
    }
    const rel = relative(root, file).replaceAll('\\', '/');
    const allowed = allowlist.find((entry) => entry.symbol === `${rel}#${name}`);
    const hits = [
      ...TRANSCRIPT_PATTERNS.filter(([re]) => re.test(text)).map(([, why]) => why),
      ...(WALLET_PATTERN.test(text) ? [`a wallet/banking table (${WALLET_PATTERN.exec(text)[0].replace(/^['"`/]/, '')})`] : []),
    ];
    if (hits.length > 0 && !(allowed && /\bOD-\d+\b/.test(allowed.decision ?? ''))) {
      violations.push({ at: `${rel}${name ? `#${name}` : ''}`, via: path.join(' -> '), hits });
    }
    for (const id of identifiers(text)) {
      if (id === name) continue;
      if (unit.symbols.has(id) && name !== null) queue.push({ file, name: id, path: [...path, `${rel}#${id}`] });
      if (name === null && unit.symbols.has(id)) queue.push({ file, name: id, path: [...path, `${rel}#${id}`] });
      const imported = unit.imports.get(id);
      if (!imported) continue;
      const target = imported.file;
      const targetRel = relative(root, target).replaceAll('\\', '/');
      if (!targetRel.startsWith('backend/src/')) continue;
      if (imported.name === '*') {
        for (const m of text.matchAll(new RegExp(`\\b${id}\\.([A-Za-z_$][\\w$]*)`, 'g'))) {
          queue.push({ file: target, name: m[1], path: [...path, `${targetRel}#${m[1]}`] });
        }
      } else queue.push({ file: target, name: imported.name, path: [...path, `${targetRel}#${imported.name}`] });
    }
  }
  return violations;
}

function listTs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : listTs(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [full] : [];
  });
}

/** Route paths, request fields and declared identifiers named like impersonation. */
export function impersonationFindings(files, root = ROOT) {
  const findings = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const code = mask(source);
    const rel = relative(root, file).replaceAll('\\', '/');
    for (const m of code.matchAll(/\b(?:router|app)\.(?:get|post|put|patch|delete|use|all)\(\s*(['"`])([^'"`]*)\1/g)) {
      if (IMPERSONATION.test(m[2])) findings.push(`${rel}: route "${m[2]}"`);
    }
    for (const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*:\s*z\./g)) {
      if (IMPERSONATION.test(m[1])) findings.push(`${rel}: request field "${m[1]}"`);
    }
    for (const m of code.matchAll(/\b(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) {
      if (IMPERSONATION.test(m[1])) findings.push(`${rel}: identifier "${m[1]}"`);
    }
    for (const m of code.matchAll(/(['"`])((?:\/[\w:.-]+)+\/?)\1/g)) {
      if (IMPERSONATION.test(m[2])) findings.push(`${rel}: path "${m[2]}"`);
    }
  }
  return findings;
}

export function mintingFindings(files, root = ROOT) {
  const findings = [];
  for (const file of files) {
    const code = mask(readFileSync(file, 'utf8'));
    const rel = relative(root, file).replaceAll('\\', '/');
    for (const [re, why] of MINTING) if (re.test(code)) findings.push(`${rel}: ${why}`);
  }
  return findings;
}

export function checkStaffStandingConstraints(root = ROOT, { allowlist = ALLOWLIST } = {}) {
  const failures = [];
  for (const entry of allowlist) {
    if (!/\bOD-\d+\b/.test(entry.decision ?? '') || !entry.why) failures.push(`allowlist entry ${entry.symbol} cites no owner decision (OD-n) or reason`);
  }
  const admin = join(root, 'backend/src/routes/admin.ts');
  for (const v of reachViolations(admin, { allowlist, root })) {
    failures.push(`${v.at} reaches ${v.hits.join(' and ')} from the staff router (${v.via})`);
  }
  const files = [...listTs(join(root, 'backend/src/routes')), ...listTs(join(root, 'backend/src/services')), ...listTs(join(root, 'backend/src/lib')), ...listTs(join(root, 'backend/src/middleware'))];
  for (const f of impersonationFindings(files, root)) failures.push(`impersonation capability: ${f}`);
  for (const f of mintingFindings(files, root)) failures.push(`token or session minting: ${f}`);
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = checkStaffStandingConstraints();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log('staff standing constraints OK (G.6): no staff route reaches a Mentor transcript or a per-account wallet table, no impersonation or login-as capability, no token minted for another account');
}
