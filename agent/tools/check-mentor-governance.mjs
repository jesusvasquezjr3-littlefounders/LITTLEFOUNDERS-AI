#!/usr/bin/env node
/**
 * C.22 — THE TIERED SELF-IMPROVEMENT GOVERNANCE MODEL, ENFORCED
 * (Appendix E §3.1, §3.1.1; Appendix F §1.3 Tier-Compliance Audit, Part 3
 * Stages 0–7). The policy is docs/rebuild/mentor/SELF-IMPROVEMENT-GOVERNANCE-POLICY.md.
 *
 * What automation may and may not touch is decided per FILE by the registry
 * (docs/rebuild/mentor/governance/registry.json): every Mentor source file in
 * a governed root belongs to exactly one component, and each component has a
 * tier. This gate makes that classification binding:
 *
 *   STAGE 0 IS MECHANICAL. A new Mentor file cannot land unclassified, and a
 *   component that matches no file is stale.
 *
 *   TIER 1 CANNOT CHANGE SILENTLY. Each Tier 1 (and live-content) component's
 *   content hash must equal the latest row of the Tier 1 change record
 *   (docs/rebuild/mentor/governance/tier1-change-record.json), which names the
 *   change, its human origin and the two sign-offs (Pedagogical Reviewer,
 *   Safety/Trust Lead). The record is append-only against the base commit.
 *
 *   NO PROMOTION WITHOUT A DECISION. A component's tier is the last entry of
 *   its tier history; a move to a more autonomous tier must cite a decision
 *   signed by both leads (checked in the file and, with --base, against the
 *   base commit's registry, which is append-only too).
 *
 *   AUTOMATION IS FENCED. A commit of automated origin (a `[bot]` author or a
 *   `Mentor-Change-Origin: automated` trailer) may never touch a Tier 1 or
 *   live-content file, and may touch another governed file only under a
 *   `Mentor-Proposal: <id>` trailer naming a proposal record that has cleared
 *   the stages its tier requires. A workflow that can write to the repository
 *   must be declared, and its scope may not reach a Tier 1 or live-content
 *   file. Tier 2 parameters must sit inside their approved bounds.
 *
 *   THE AUDIT. `--release` is the Appendix F §1.3 Tier-Compliance Audit: all
 *   of the above, plus every Tier 1 change and every decision signed off.
 *
 *   FINER BOUNDARIES (OD-28, owner review M-19). A mixed file may be split at
 *   the level of its top-level declarations: components claim it through
 *   `symbols` ({ file, names, decision }) instead of `paths`. Exactly one
 *   claimant, which must be the strictest, holds `"*"` (every declaration no
 *   one else names, the module's imports and top-level statements, and any
 *   declaration added later), so the default for anything new is the strict
 *   tier. A less strict claim (a carve-out) cites a decision and takes effect
 *   only once both leads have signed it; until then its declarations stay with
 *   the strict claimant. Every named declaration must exist (no stale
 *   classification), no declaration has two owners, a Tier 3 carve-out may not
 *   be referenced by a stricter declaration of its file, and the Tier 1 hash,
 *   the automated-origin fence and the Tier 2 bounds all follow the effective
 *   owner of each declaration, not the file.
 *
 * Usage:
 *   node agent/tools/check-mentor-governance.mjs                 static checks (CI)
 *   node agent/tools/check-mentor-governance.mjs --base=<ref>    + append-only / promotion vs base (CI)
 *   node agent/tools/check-mentor-governance.mjs --range=<a..b>  + the automated-origin fence over commits (CI)
 *   node agent/tools/check-mentor-governance.mjs --release [--report=<file>]   the Tier-Compliance Audit
 *   node agent/tools/check-mentor-governance.mjs --report=<file> write the audit JSON (incl. canary regression rate)
 *   node agent/tools/check-mentor-governance.mjs --record --change="<what changed>" [--component=<id>]
 *        appends a change-record row (origin human, sign-offs pending) for each changed Tier 1 component
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REGISTRY = 'docs/rebuild/mentor/governance/registry.json';
export const LEDGER = 'docs/rebuild/mentor/governance/tier1-change-record.json';
export const PROPOSALS_DIR = 'docs/rebuild/mentor/governance/proposals';

export const TIERS = ['tier_1', 'live_content_judging', 'tier_2', 'tier_3'];
/** Change-controlled like Tier 1: hashed, signed, never automated. */
export const CONTROLLED = new Set(['tier_1', 'live_content_judging']);
/** Autonomy rank: a move to a higher rank is a promotion (the live axis sits apart and counts as a move either way). */
const RANK = { tier_1: 0, live_content_judging: 0, tier_2: 1, tier_3: 2 };
const STRICTNESS = { tier_1: 3, live_content_judging: 2, tier_2: 1, tier_3: 0 };
export const OWNER_ROLES = ['pedagogical_lead', 'safety_trust_lead', 'engineering_lead'];
const SIGNED = (v) => typeof v === 'string' && v.trim() !== '' && v.trim().toLowerCase() !== 'pending';
const AUTOMATED_TRAILER = /^Mentor-Change-Origin:\s*automated\s*$/im;
const PROPOSAL_TRAILER = /^Mentor-Proposal:\s*([A-Za-z0-9._-]+)\s*$/im;

// ── globbing and hashing ────────────────────────────────────────────────────

export function globToRegex(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*';
        i += 1;
        if (pattern[i + 1] === '/') i += 1;
      } else re += '[^/]*';
    } else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export const matches = (file, patterns) => patterns.some((p) => globToRegex(p).test(file));

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
}

/** The files a pattern names on disk (exact paths and globs; node_modules never). */
export function expand(pattern, fsList = null) {
  if (fsList) return fsList.filter((f) => globToRegex(pattern).test(f));
  if (!pattern.includes('*')) return existsSync(path.join(ROOT, pattern)) && statSync(path.join(ROOT, pattern)).isFile() ? [pattern] : [];
  const segments = pattern.split('/');
  const prefix = segments.slice(0, segments.findIndex((s) => s.includes('*'))).join('/');
  const files = [];
  walk(prefix, files);
  return files.filter((f) => globToRegex(pattern).test(f));
}

/** The governed files on disk: everything under a governed root that is not ignored. */
export function governedFiles(registry, fsList = null) {
  const files = new Set();
  for (const root of registry.governedRoots) {
    for (const f of fsList ? fsList.filter((x) => x.startsWith(root)) : expand(`${root}**`)) {
      if (!matches(f, registry.ignore ?? [])) files.add(f);
    }
  }
  return [...files].sort();
}

export function componentFiles(component, registry, fsList = null) {
  const files = new Set();
  for (const p of component.paths ?? []) for (const f of expand(p, fsList)) if (!matches(f, registry.ignore ?? [])) files.add(f);
  for (const claim of component.symbols ?? []) for (const f of expand(claim.file, fsList)) files.add(f);
  return [...files].sort();
}

/** SHA-256 over the component's files (path + content, line endings normalized to LF). */
export function hashFiles(files, read) {
  const h = createHash('sha256');
  for (const f of [...files].sort()) {
    const text = read(f);
    h.update(`${f}\n`);
    h.update((text ?? '').replace(/\r\n/g, '\n'));
    h.update('\n\u0000\n');
  }
  return h.digest('hex');
}

const readText = (f) => {
  try {
    return readFileSync(path.join(ROOT, f), 'utf8');
  } catch {
    return null;
  }
};

/**
 * SHA-256 over the component's files. A split file the component owns only in
 * part contributes `file#symbol` plus that declaration's text for each
 * declaration it effectively owns; a split file it effectively owns whole is
 * hashed exactly like any other file, so adopting a boundary changes no hash
 * until a carve-out takes effect.
 */
export function componentHash(component, registry, read = readText, fsList = null) {
  const files = componentFiles(component, registry, fsList).filter((f) => !matches(f, component.hashExclude ?? []));
  const whole = [];
  const parts = [];
  for (const f of files) {
    if (!isSplit(f, registry)) {
      whole.push(f);
      continue;
    }
    const source = read(f);
    const owners = effectiveSymbolOwners(f, source ?? '', registry);
    const owned = [...owners].filter(([, id]) => id === component.id).map(([name]) => name);
    if (owned.length === owners.size) whole.push(f);
    else {
      const symbols = topLevelSymbols(source ?? '');
      for (const name of owned.sort()) parts.push([`${f}#${name}`, symbols.get(name) ?? '']);
    }
  }
  const h = createHash('sha256');
  if (parts.length === 0) return { hash: hashFiles(whole, read), files: files.length };
  h.update(hashFiles(whole, read));
  for (const [key, text] of parts) {
    h.update(`${key}\n`);
    h.update(text);
    h.update('\n\u0000\n');
  }
  return { hash: h.digest('hex'), files: files.length };
}

// ── symbol-level claims (OD-28, M-19) ───────────────────────────────────────

const SIGNED_BY_BOTH = (d) => Boolean(d) && SIGNED(d.pedagogicalReviewer) && SIGNED(d.safetyTrustLead);

/** file → [{ component, names, decision }] for every symbol-level claim. */
export function symbolClaims(registry) {
  const byFile = new Map();
  for (const c of registry.components ?? []) {
    for (const claim of c.symbols ?? []) {
      if (!byFile.has(claim.file)) byFile.set(claim.file, []);
      byFile.get(claim.file).push({ component: c, names: claim.names ?? [], decision: claim.decision ?? null });
    }
  }
  return byFile;
}

export const isSplit = (file, registry) => symbolClaims(registry).has(file);

/** The claimant holding `"*"` for a split file (null when none or ambiguous: checkSymbols reports it). */
function starClaimant(claims) {
  const stars = claims.filter((c) => c.names.includes('*'));
  return stars.length === 1 ? stars[0] : null;
}

/** Is this carve-out in effect? A claim as strict as the `*` claimant needs no decision; a less strict one needs a decision signed by both leads. */
export function claimEffective(claim, star, registry) {
  if (!star || claim === star) return true;
  if (STRICTNESS[claim.component.tier] >= STRICTNESS[star.component.tier]) return true;
  const decision = (registry.decisions ?? []).find((d) => d.id === claim.decision);
  return SIGNED_BY_BOTH(decision);
}

/** The component that effectively owns one declaration of a split file, without reading the source. */
export function symbolOwner(file, name, registry) {
  const claims = symbolClaims(registry).get(file);
  if (!claims) return null;
  const star = starClaimant(claims);
  const explicit = claims.find((c) => c.names.includes(name));
  if (explicit && claimEffective(explicit, star, registry)) return explicit.component;
  return star ? star.component : null;
}

/** name → owning component id, for every top-level declaration (and the module) of a split file. */
export function effectiveSymbolOwners(file, source, registry) {
  const owners = new Map();
  for (const name of topLevelSymbols(source).keys()) {
    const c = symbolOwner(file, name, registry);
    if (c) owners.set(name, c.id);
  }
  return owners;
}

/** Stage 0 at declaration level, for every split file. */
export function checkSymbols(registry, { read = readText, fsList = null } = {}) {
  const problems = [];
  const decisions = new Map((registry.decisions ?? []).map((d) => [d.id, d]));
  for (const [file, claims] of symbolClaims(registry)) {
    if (!/\.(ts|tsx|mts|js|mjs)$/.test(file)) problems.push(`${file}: only TypeScript/JavaScript files can be split by declaration`);
    const whole = (registry.components ?? []).filter((c) => matches(file, c.paths ?? []));
    if (whole.length > 0) problems.push(`${file}: split by declaration but also claimed whole by ${whole.map((c) => c.id).join(', ')}`);
    const source = fsList ? (fsList.includes(file) ? read(file) : null) : read(file);
    if (source === null) {
      problems.push(`${file}: split by declaration, but the file does not exist (stale classification)`);
      continue;
    }
    const stars = claims.filter((c) => c.names.includes('*'));
    if (stars.length !== 1) {
      problems.push(`${file}: exactly one component must claim "*" (claimed by ${stars.length})`);
      continue;
    }
    const star = stars[0];
    for (const c of claims) {
      if (STRICTNESS[c.component.tier] > STRICTNESS[star.component.tier]) {
        problems.push(`${file}: "*" belongs to ${star.component.id} (${star.component.tier}), but ${c.component.id} (${c.component.tier}) is stricter — the default for new declarations must be the strictest tier`);
      }
    }
    const symbols = topLevelSymbols(source);
    const seen = new Map();
    for (const c of claims) {
      if (c === star) continue;
      if (c.names.includes('*')) continue;
      if (c.names.length === 0) problems.push(`${file}: ${c.component.id} claims no declaration`);
      const lessStrict = STRICTNESS[c.component.tier] < STRICTNESS[star.component.tier];
      if (lessStrict) {
        if (!c.decision || !decisions.has(c.decision)) problems.push(`${file}: the carve-out to ${c.component.id} must cite a recorded decision (it moves declarations to a less strict tier)`);
        if (c.names.includes(MODULE_SYMBOL)) problems.push(`${file}: ${MODULE_SYMBOL} (imports and top-level statements) stays with the strictest claimant`);
      }
      for (const name of c.names) {
        if (name !== MODULE_SYMBOL && !symbols.has(name)) problems.push(`${file}#${name}: named by ${c.component.id} but not a top-level declaration of the file (stale classification)`);
        if (seen.has(name)) problems.push(`${file}#${name}: claimed by ${seen.get(name)} and ${c.component.id} — a declaration has exactly one tier`);
        seen.set(name, c.component.id);
      }
    }
    // A Tier 3 (reporting) carve-out that a stricter declaration uses, in this
    // file or by import from another governed file, would make reporting a
    // decision input: its behaviour is the stricter tier's.
    const base = path.posix.basename(file).replace(/\.(ts|tsx|mts|js|mjs)$/, '');
    for (const c of claims) {
      if (c.component.tier !== 'tier_3' || c === star) continue;
      for (const name of c.names) {
        const escaped = name.replace(/[$]/g, '\\$');
        const pattern = new RegExp(`(^|[^\\w$])${escaped}(?![\\w$])`);
        for (const [other, text] of symbols) {
          if (other === name) continue;
          // The PROPOSED owner (signed or not), so a boundary is validated before anyone signs it.
          const owner = (claims.find((x) => x.names.includes(other)) ?? star).component;
          if (STRICTNESS[owner.tier] > STRICTNESS.tier_3 && pattern.test(text)) {
            problems.push(`${file}#${name}: carved out to ${c.component.id} (tier_3) but used by ${other} (${owner.tier}); its behaviour is ${owner.tier}`);
          }
        }
        const imported = new RegExp(`import\\s+(?:type\\s+)?\\{[^}]*(^|[^\\w$])${escaped}(?![\\w$])[^}]*\\}\\s*from\\s*['"][^'"]*/${base}(?:\\.js)?['"]`, 'm');
        for (const g of governedFiles(registry, fsList)) {
          if (g === file) continue;
          const text = read(g);
          if (text === null || !imported.test(text)) continue;
          const owners = classify(g, registry);
          const strictest = owners.reduce((t, o) => (t === null || STRICTNESS[o.tier] > STRICTNESS[t] ? o.tier : t), null);
          if (strictest && STRICTNESS[strictest] > STRICTNESS.tier_3) {
            problems.push(`${file}#${name}: carved out to ${c.component.id} (tier_3) but imported by ${g} (${strictest}); its behaviour is ${strictest}`);
          }
        }
      }
    }
  }
  return problems;
}

/** Which declarations of a file differ between two versions (added, removed or changed). */
export function changedSymbols(before, after) {
  const a = topLevelSymbols(before ?? '');
  const b = topLevelSymbols(after ?? '');
  const names = new Set([...a.keys(), ...b.keys()]);
  return [...names].filter((n) => a.get(n) !== b.get(n)).sort();
}

// ── symbol-level boundaries (OD-28, owner review M-19) ──────────────────────

/** The pseudo-symbol for everything at top level that is not a named declaration (imports, re-exports, statements). */
export const MODULE_SYMBOL = '<module>';

const DECLARATION =
  /^(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)|(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)|interface\s+([A-Za-z_$][\w$]*)|type\s+([A-Za-z_$][\w$]*)\s*[=<]|(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)|namespace\s+([A-Za-z_$][\w$]*))/;
const REGEX_AFTER = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await']);

/**
 * For each line of a TypeScript/JavaScript source, whether it STARTS at the top
 * level of the module: outside any brace/paren/bracket, string, template
 * literal or block comment. A small lexer (strings, templates with nested
 * `${}`, comments and regex literals by the usual previous-token heuristic);
 * it needs no compiler, and the gate's own tests pin it on the real files.
 */
export function topLevelLineStarts(source) {
  const src = source.replace(/\r\n/g, '\n');
  const starts = [true];
  let depth = 0;
  let mode = 'code'; // code | line | block | sq | dq | tpl | regex | regexClass
  const tplStack = []; // brace depth at which each open `${` returns to its template
  let lastSig = null;
  let lastWord = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '\n') {
      if (mode === 'line') mode = 'code';
      starts.push(mode === 'code' && depth === 0 && tplStack.length === 0);
      continue;
    }
    switch (mode) {
      case 'line':
        break;
      case 'block':
        if (c === '*' && n === '/') {
          mode = 'code';
          i += 1;
        }
        break;
      case 'sq':
      case 'dq':
        if (c === '\\') i += 1;
        else if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"')) {
          mode = 'code';
          lastSig = c;
        }
        break;
      case 'tpl':
        if (c === '\\') i += 1;
        else if (c === '`') {
          mode = 'code';
          lastSig = '`';
        } else if (c === '$' && n === '{') {
          tplStack.push(depth);
          depth += 1;
          mode = 'code';
          i += 1;
          lastSig = '{';
        }
        break;
      case 'regex':
        if (c === '\\') i += 1;
        else if (c === '[') mode = 'regexClass';
        else if (c === '/') {
          mode = 'code';
          lastSig = '/re';
        }
        break;
      case 'regexClass':
        if (c === '\\') i += 1;
        else if (c === ']') mode = 'regex';
        break;
      default: {
        if (c === '/' && n === '/') {
          mode = 'line';
          i += 1;
        } else if (c === '/' && n === '*') {
          mode = 'block';
          i += 1;
        } else if (c === "'") mode = 'sq';
        else if (c === '"') mode = 'dq';
        else if (c === '`') mode = 'tpl';
        else if (c === '/') {
          const regex = lastSig === null || REGEX_AFTER.has(lastSig) || (lastSig === 'w' && REGEX_AFTER_WORD.has(lastWord));
          if (regex) mode = 'regex';
          else lastSig = '/';
        } else if (c === '{' || c === '(' || c === '[') {
          depth += 1;
          lastSig = c;
        } else if (c === '}' || c === ')' || c === ']') {
          depth = Math.max(0, depth - 1);
          if (c === '}' && tplStack.length > 0 && tplStack[tplStack.length - 1] === depth) {
            tplStack.pop();
            mode = 'tpl';
          } else lastSig = c;
        } else if (/[A-Za-z0-9_$]/.test(c)) {
          let j = i;
          while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j += 1;
          lastWord = src.slice(i, j);
          lastSig = 'w';
          i = j - 1;
        } else if (!/\s/.test(c)) lastSig = c;
      }
    }
  }
  return starts;
}

/**
 * The module's top-level symbols and their source text: every named top-level
 * declaration (function, const/let/var, class, interface, type, enum), with the
 * comment block directly above it. Overloads and same-named declarations are
 * joined. Everything else at top level (imports, re-exports, statements, stray
 * comments) is the MODULE_SYMBOL. Text is LF-normalized, and blank lines
 * between declarations belong to no symbol, so moving a declaration or
 * re-spacing the file changes no symbol's text.
 */
export function topLevelSymbols(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const starts = topLevelLineStarts(source);
  const symbols = new Map();
  const add = (name, text) => symbols.set(name, symbols.has(name) ? `${symbols.get(name)}\n${text}` : text);
  let current = MODULE_SYMBOL;
  let buffer = [];
  let pending = [];
  const flush = () => {
    while (buffer.length > 0 && buffer[buffer.length - 1].trim() === '') buffer.pop();
    if (buffer.length > 0) add(current, buffer.map((l) => l.trimEnd()).join('\n'));
    buffer = [];
  };
  let inTopComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const top = starts[i] === true;
    const trimmed = line.trim();
    if (!top && !inTopComment) {
      if (pending.length > 0) {
        buffer.push(...pending);
        pending = [];
      }
      buffer.push(line);
      continue;
    }
    // A top-level comment line (or the inside of a top-level block comment) waits for what follows it.
    const opensComment = top && (trimmed.startsWith('//') || trimmed.startsWith('/*'));
    if (inTopComment || opensComment) {
      pending.push(line);
      if (opensComment && trimmed.startsWith('/*')) inTopComment = !trimmed.includes('*/', 2);
      else if (inTopComment && trimmed.includes('*/')) inTopComment = false;
      continue;
    }
    if (trimmed === '') {
      // A comment separated from what follows by a blank line documents the
      // module, not the next declaration.
      if (pending.length > 0) {
        add(MODULE_SYMBOL, pending.map((l) => l.trimEnd()).join('\n'));
        pending = [];
      } else buffer.push(line);
      continue;
    }
    const m = DECLARATION.exec(line);
    if (m) {
      flush();
      current = m.slice(1).find(Boolean);
      buffer = pending;
      pending = [];
      buffer.push(line);
      continue;
    }
    if (/^[}\])]/.test(trimmed)) {
      buffer.push(...pending, line);
      pending = [];
      continue;
    }
    flush();
    current = MODULE_SYMBOL;
    buffer = [...pending, line];
    pending = [];
  }
  if (pending.length > 0) {
    flush();
    current = MODULE_SYMBOL;
    buffer = pending;
  }
  flush();
  return symbols;
}

// ── classification (Stage 0) ────────────────────────────────────────────────

/**
 * The components that own a path. `file#symbol` resolves to that declaration's
 * effective owner; a split file named whole resolves to every claimant (the
 * strictest decides, which is the safe reading of "some part of it").
 */
export function classify(file, registry) {
  const hash = file.indexOf('#');
  if (hash > 0) {
    const owner = symbolOwner(file.slice(0, hash), file.slice(hash + 1), registry);
    if (owner) return [owner];
    file = file.slice(0, hash);
  }
  const claims = symbolClaims(registry).get(file);
  const whole = registry.components.filter((c) => matches(file, c.paths ?? []));
  if (!claims) return whole;
  return [...new Set([...whole, ...claims.map((c) => c.component)])];
}

/** The strictest tier among the components that own `files`; unowned governed files are reported. */
export function tierOf(files, registry) {
  let tier = null;
  const unclassified = [];
  const components = new Set();
  for (const f of files) {
    const owners = classify(f, registry);
    if (owners.length === 0) {
      if (registry.governedRoots.some((r) => f.startsWith(r)) && !matches(f, registry.ignore ?? [])) unclassified.push(f);
      continue;
    }
    for (const c of owners) {
      components.add(c.id);
      if (tier === null || STRICTNESS[c.tier] > STRICTNESS[tier]) tier = c.tier;
    }
  }
  return { tier, unclassified, components: [...components] };
}

// ── the registry itself ─────────────────────────────────────────────────────

export function checkRegistry(registry, { fsList = null, read = readText } = {}) {
  const problems = [];
  if (registry?.kind !== 'mentor-governance-registry') return ['the registry is missing or is not a mentor-governance-registry'];
  const ids = new Set();
  const decisions = new Map((registry.decisions ?? []).map((d) => [d.id, d]));
  for (const d of registry.decisions ?? []) {
    if (!/^D-\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(d.id ?? '')) problems.push(`decision ${d.id}: id must be D-YYYY-MM-DD-<slug>`);
    if (!('pedagogicalReviewer' in d) || !('safetyTrustLead' in d)) problems.push(`decision ${d.id}: names both sign-offs (a name or "pending")`);
    if (typeof d.summary !== 'string' || d.summary.length < 20) problems.push(`decision ${d.id}: summarizes what was decided`);
  }
  for (const c of registry.components ?? []) {
    if (ids.has(c.id)) problems.push(`component ${c.id} is declared twice`);
    ids.add(c.id);
    if (!TIERS.includes(c.tier)) problems.push(`component ${c.id}: unknown tier ${c.tier}`);
    if (!OWNER_ROLES.includes(c.owner)) problems.push(`component ${c.id}: owner must be one of ${OWNER_ROLES.join(', ')}`);
    const hasSymbols = Array.isArray(c.symbols) && c.symbols.length > 0;
    if (!hasSymbols && (!Array.isArray(c.paths) || c.paths.length === 0)) problems.push(`component ${c.id}: names its paths`);
    for (const claim of c.symbols ?? []) {
      if (typeof claim.file !== 'string' || !Array.isArray(claim.names)) problems.push(`component ${c.id}: a symbol claim names its file and its declarations`);
    }
    if (!Array.isArray(c.examples) || c.examples.length === 0) problems.push(`component ${c.id}: names at least one example (C.22 DoD a)`);
    if (!c.policy || read(c.policy) === null) problems.push(`component ${c.id}: its policy document ${c.policy} does not exist`);
    if ((Array.isArray(c.paths) || hasSymbols) && componentFiles(c, registry, fsList).length === 0) problems.push(`component ${c.id}: its paths match no file (stale classification)`);
    const history = c.tierHistory ?? [];
    if (history.length === 0) problems.push(`component ${c.id}: has no tier history`);
    else if (history.at(-1).tier !== c.tier) problems.push(`component ${c.id}: its tier ${c.tier} is not the last entry of its tier history (${history.at(-1).tier})`);
    for (let i = 0; i < history.length; i++) {
      const step = history[i];
      const decision = decisions.get(step.decision);
      if (!decision) {
        problems.push(`component ${c.id}: tier history cites unknown decision ${step.decision}`);
        continue;
      }
      if (i === 0) continue;
      const prev = history[i - 1].tier;
      const promotion = RANK[step.tier] > RANK[prev] || (step.tier !== prev && (step.tier === 'live_content_judging' || prev === 'live_content_judging'));
      if (promotion && !(SIGNED(decision.pedagogicalReviewer) && SIGNED(decision.safetyTrustLead))) {
        problems.push(`component ${c.id}: moved from ${prev} to ${step.tier} without a decision signed by both leads (${decision.id})`);
      }
    }
  }
  return problems;
}

/** Every governed file belongs to exactly one component. */
export function checkCoverage(registry, fsList = null, read = readText) {
  const problems = [];
  for (const f of governedFiles(registry, fsList)) {
    if (isSplit(f, registry)) continue; // Stage 0 per declaration: checkSymbols
    const owners = classify(f, registry);
    if (owners.length === 0) problems.push(`${f}: unclassified Mentor file — add it to a component in ${REGISTRY} (Stage 0)`);
    else if (owners.length > 1) problems.push(`${f}: claimed by ${owners.map((c) => c.id).join(' and ')} — a file has exactly one tier`);
  }
  problems.push(...checkSymbols(registry, { read, fsList }));
  return problems;
}

// ── the Tier 1 change record ────────────────────────────────────────────────

export function latestEntries(ledger) {
  const latest = new Map();
  for (const e of ledger?.entries ?? []) latest.set(e.component, e);
  return latest;
}

export function checkLedger(registry, ledger, { read = readText, fsList = null, release = false } = {}) {
  const problems = [];
  if (ledger?.kind !== 'mentor-tier1-change-record') return [`${LEDGER} is missing or is not a mentor-tier1-change-record`];
  const known = new Set(registry.components.map((c) => c.id));
  for (const [i, e] of (ledger.entries ?? []).entries()) {
    if (!known.has(e.component)) problems.push(`change record row ${i + 1}: unknown component ${e.component}`);
    if (e.origin !== 'human') problems.push(`change record row ${i + 1} (${e.component}): origin "${e.origin}" — a Tier 1 change is never automated`);
    if (!/^[0-9a-f]{64}$/.test(e.hash ?? '')) problems.push(`change record row ${i + 1} (${e.component}): hash is not a SHA-256`);
    if (typeof e.change !== 'string' || e.change.trim().length < 10) problems.push(`change record row ${i + 1} (${e.component}): says what changed`);
    if (!('pedagogicalReviewer' in e) || !('safetyTrustLead' in e)) problems.push(`change record row ${i + 1} (${e.component}): names both sign-offs`);
  }
  const latest = latestEntries(ledger);
  for (const c of registry.components.filter((x) => CONTROLLED.has(x.tier))) {
    const { hash } = componentHash(c, registry, read, fsList);
    const row = latest.get(c.id);
    if (!row) problems.push(`${c.id} (${c.tier}): no change-record row — run --record`);
    else if (row.hash !== hash) {
      problems.push(`${c.id} (${c.tier}) changed without a change-record row (recorded ${row.hash.slice(0, 12)}, now ${hash.slice(0, 12)}): record it with --record --change="…", then have both leads sign`);
    } else if (release && !(SIGNED(row.pedagogicalReviewer) && SIGNED(row.safetyTrustLead))) {
      problems.push(`${c.id} (${c.tier}): its current version is not signed off by both the Pedagogical Reviewer and the Safety/Trust Lead`);
    }
  }
  return problems;
}

/** Append-only against the base: earlier rows keep their content; only a "pending" sign-off may become a name. */
export function checkAppendOnly(baseLedger, ledger, baseRegistry, registry) {
  const problems = [];
  const baseRows = baseLedger?.entries ?? [];
  const rows = ledger?.entries ?? [];
  if (rows.length < baseRows.length) problems.push(`${LEDGER}: rows were removed (${baseRows.length} → ${rows.length})`);
  for (let i = 0; i < Math.min(baseRows.length, rows.length); i++) {
    const a = baseRows[i];
    const b = rows[i];
    for (const k of ['component', 'hash', 'date', 'change', 'origin']) {
      if (a[k] !== b[k]) problems.push(`${LEDGER}: row ${i + 1} field ${k} was rewritten`);
    }
    for (const k of ['pedagogicalReviewer', 'safetyTrustLead']) {
      if (a[k] !== b[k] && SIGNED(a[k])) problems.push(`${LEDGER}: row ${i + 1} sign-off ${k} was changed after it was given`);
    }
  }
  if (baseRegistry && registry) {
    const baseDecisions = new Map((baseRegistry.decisions ?? []).map((d) => [d.id, d]));
    for (const [id, d] of baseDecisions) {
      const now = (registry.decisions ?? []).find((x) => x.id === id);
      if (!now) problems.push(`${REGISTRY}: decision ${id} was removed`);
      else {
        for (const k of ['date', 'kind', 'summary']) if (JSON.stringify(d[k]) !== JSON.stringify(now[k])) problems.push(`${REGISTRY}: decision ${id} field ${k} was rewritten`);
        for (const k of ['pedagogicalReviewer', 'safetyTrustLead']) if (d[k] !== now[k] && SIGNED(d[k])) problems.push(`${REGISTRY}: decision ${id} sign-off ${k} was changed after it was given`);
      }
    }
    for (const bc of baseRegistry.components ?? []) {
      const c = registry.components.find((x) => x.id === bc.id);
      if (!c) {
        const retired = (registry.decisions ?? []).some((d) => !baseDecisions.has(d.id) && (d.components ?? []).includes(bc.id));
        if (!retired) problems.push(`${REGISTRY}: component ${bc.id} was removed without a new decision naming it`);
        continue;
      }
      const bh = bc.tierHistory ?? [];
      const h = c.tierHistory ?? [];
      if (h.length < bh.length || bh.some((s, i) => JSON.stringify(s) !== JSON.stringify(h[i]))) {
        problems.push(`${REGISTRY}: component ${c.id}'s tier history was rewritten (it is append-only)`);
      }
    }
  }
  return problems;
}

// ── Tier 2 bounds, policy statements, pipelines ─────────────────────────────

export function numericField(source, objectName, field) {
  const start = source.indexOf(objectName);
  if (start === -1) return null;
  const end = source.indexOf('};', start);
  const block = source.slice(start, end === -1 ? undefined : end);
  const m = new RegExp(`\\b${field}:\\s*(-?[0-9._]+)`).exec(block);
  return m ? Number(m[1].replace(/_/g, '')) : null;
}

export function checkTier2Parameters(registry, read = readText) {
  const problems = [];
  for (const p of registry.tier2Parameters ?? []) {
    // In a split file the parameter's own declaration must be Tier 2, not merely some part of the file.
    const owners = classify(isSplit(p.file, registry) ? `${p.file}#${p.object}` : p.file, registry);
    if (!owners.some((c) => c.tier === 'tier_2')) problems.push(`Tier 2 parameter ${p.id}: ${p.file}${isSplit(p.file, registry) ? `#${p.object}` : ''} is not in a Tier 2 component`);
    const text = read(p.file);
    const value = text === null ? null : numericField(text, p.object, p.field);
    if (value === null) problems.push(`Tier 2 parameter ${p.id}: could not read ${p.object}.${p.field} in ${p.file}`);
    else if (value < p.bounds[0] || value > p.bounds[1]) {
      problems.push(`Tier 2 parameter ${p.id} is ${value}, outside its approved bounds [${p.bounds.join(', ')}] — widening the bounds is a Tier 1 decision`);
    }
  }
  return problems;
}

/** C.22 DoD (c): every Block C item touching automation states its tier in its own documentation. */
export function checkPolicyStatements(registry, read = readText) {
  const problems = [];
  for (const [req, doc] of Object.entries(registry.automationPolicyDocs ?? {})) {
    const text = read(doc);
    if (text === null) problems.push(`${req}: its policy ${doc} is missing`);
    else if (!/C\.22/.test(text) || !/\bTier (1|2|3)\b/.test(text)) problems.push(`${req}: ${doc} does not state which C.22 tier it operates under`);
  }
  for (const req of ['C.5', 'C.21', 'C.23', 'C.24']) {
    if (!(req in (registry.automationPolicyDocs ?? {}))) problems.push(`${req} touches automation and must name its policy document`);
  }
  return problems;
}

const WRITES_REPO = /contents:\s*write|git push|gh pr merge|gh pr create|create-pull-request|git commit /;

export function checkPipelines(registry, { read = readText, fsList = null, workflowFiles = null } = {}) {
  const problems = [];
  const declared = new Map((registry.automatedPipelines ?? []).map((p) => [p.workflow, p]));
  const workflows = workflowFiles ?? expand('.github/workflows/*.yml', fsList);
  const controlled = registry.components.filter((c) => CONTROLLED.has(c.tier)).flatMap((c) => componentFiles(c, registry, fsList));
  for (const wf of workflows) {
    const text = (read(wf) ?? '').split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    if (!WRITES_REPO.test(text)) continue;
    const decl = declared.get(wf);
    if (!decl) {
      problems.push(`${wf} can write to the repository but is not declared in ${REGISTRY} automatedPipelines`);
      continue;
    }
    if (CONTROLLED.has(decl.maxTier)) problems.push(`${wf}: an automated pipeline may never be allowed to change ${decl.maxTier}`);
    const reach = controlled.filter((f) => matches(f, decl.scope ?? []));
    if (reach.length > 0) problems.push(`${wf}: its scope reaches Tier 1 / live-content files (${reach.slice(0, 3).join(', ')})`);
  }
  for (const [wf] of declared) if (!workflows.includes(wf)) problems.push(`${REGISTRY}: declared pipeline ${wf} does not exist`);
  for (const g of registry.automatedProposalGenerators ?? []) {
    if (CONTROLLED.has(g.maxTier)) problems.push(`proposal generator ${g.id}: may never target ${g.maxTier}`);
  }
  return problems;
}

// ── change proposals (Appendix F Part 3) ────────────────────────────────────

export const PROPOSAL_STATUSES = ['draft', 'in_review', 'canary', 'released', 'rolled_back', 'rejected'];
const ORDER = { draft: 0, rejected: 0, in_review: 1, canary: 2, released: 3, rolled_back: 3 };
const nonEmpty = (v, n = 1) => typeof v === 'string' && v.trim().length >= n;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));

/**
 * Which stages a proposal still misses for its status, and any violation.
 * The tier is COMPUTED from the paths (never trusted from the record).
 */
export function evaluateProposal(p, registry) {
  const violations = [];
  const missing = [];
  if (p?.kind !== 'mentor-change-proposal') return { computedTier: null, violations: ['not a mentor-change-proposal'], missing: [], releaseReady: false };
  if (!/^P-\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(p.id ?? '')) violations.push('id must be P-YYYY-MM-DD-<slug>');
  if (!['automated', 'human'].includes(p.origin)) violations.push('origin must be "automated" or "human"');
  if (!PROPOSAL_STATUSES.includes(p.status)) violations.push(`unknown status ${p.status}`);
  const { tier, unclassified } = tierOf(p.paths ?? [], registry);
  for (const f of unclassified) violations.push(`${f} is an unclassified Mentor file`);
  if (!Array.isArray(p.paths) || p.paths.length === 0) violations.push('names the paths it changes');
  if (tier === null) return { computedTier: null, violations, missing, releaseReady: violations.length === 0 };
  if (p.origin === 'automated' && CONTROLLED.has(tier)) violations.push(`an automated proposal may never change ${tier} (Appendix E §3.1: never automate)`);
  if (p.declaredTier && STRICTNESS[p.declaredTier] < STRICTNESS[tier]) violations.push(`declared ${p.declaredTier}, but the paths make it ${tier}`);
  const level = ORDER[p.status] ?? 0;
  const behaviour = tier !== 'tier_3';

  // Stage 0 — classification by both leads, always.
  if (!p.stage0 || !nonEmpty(p.stage0.pedagogicalLead) || !nonEmpty(p.stage0.safetyTrustLead) || !isDate(p.stage0.date)) missing.push('stage0 (both leads classify the change)');

  // Stage 2 — simulated students, for any behaviour change.
  if (behaviour && level >= 1) {
    const s2 = p.stage2;
    const personas = registry.stage2Personas ?? [];
    if (!s2 || !isDate(s2.date) || !/^[0-9a-f]{64}$/.test(s2.reportSha256 ?? '')) missing.push('stage2 (the simulated-student report and its SHA-256)');
    else {
      const absent = personas.filter((x) => !(x in (s2.personas ?? {})));
      if (absent.length > 0) missing.push(`stage2 personas: ${absent.join(', ')}`);
      const failed = Object.entries(s2.personas ?? {}).filter(([, v]) => v !== 'pass').map(([k]) => k);
      if (failed.length > 0) {
        if (!Array.isArray(s2.failures) || s2.failures.length === 0) violations.push('a Stage 2 failure returns to Stage 1 with an itemized failure report');
        if (level >= 1) violations.push(`Stage 2 failed for ${failed.join(', ')}: the change returns to Stage 1`);
      }
    }
  }

  // Stage 3 / Stage 4.
  const s3 = p.stage3;
  const s4 = p.stage4;
  const humanReview = s4 && nonEmpty(s4.pedagogicalReviewer) && nonEmpty(s4.safetyTrustLead) && isDate(s4.date) && nonEmpty(s4.addresses, 40);
  if (s4 && nonEmpty(s4.pedagogicalReviewer) && s4.pedagogicalReviewer.trim().toLowerCase() === (s4.safetyTrustLead ?? '').trim().toLowerCase()) {
    violations.push('Stage 4 needs two distinct reviewers (Pedagogical Reviewer and Safety/Trust Lead)');
  }
  if (CONTROLLED.has(tier)) {
    if (s3) violations.push(`${tier} bypasses Stage 3: a judge never gates it`);
    if (level >= 2 && !humanReview) missing.push('stage4 (Pedagogical Reviewer + Safety/Trust Lead, addressing the specific risk)');
  } else if (tier === 'tier_2' && level >= 2) {
    const judged = s3 && s3.verdict === 'pass' && nonEmpty(s3.calibrationId) && /^[0-9a-f]{64}$/.test(s3.judgePromptHash ?? '') && Array.isArray(s3.criteria) && s3.criteria.length > 0 && nonEmpty(s3.verifiedWith);
    if (!judged && !humanReview) missing.push('stage3 (a calibrated judge, verified with tutor:judge-calibration --verify-proposal) or stage4 (human review)');
  }

  // Stage 5 — canary with a human reading real transcripts, for any behaviour change.
  if (behaviour && level >= 3) {
    const s5 = p.stage5;
    const min = registry.canaryMinTranscriptsRead ?? 20;
    if (!s5 || !nonEmpty(s5.experimentId) || !nonEmpty(s5.reader) || !isDate(s5.date) || !(s5.transcriptsRead >= min)) {
      missing.push(`stage5 (a canary, and a named person who read at least ${min} real transcripts)`);
    } else if (p.status === 'released' && s5.outcome !== 'clear') violations.push('released after a canary that was not clear');
    else if (p.status === 'rolled_back' && s5.outcome !== 'rolled_back') violations.push('rolled back, but the canary outcome says otherwise');
  }
  // Stage 6 — the metric ships with the change.
  if (p.status === 'released' && (!p.stage6 || !isDate(p.stage6.releasedAt) || !Array.isArray(p.stage6.metrics) || p.stage6.metrics.length === 0)) {
    missing.push('stage6 (released with its Appendix F metric instrumented)');
  }
  return { computedTier: tier, violations, missing, releaseReady: violations.length === 0 && missing.length === 0 };
}

export function readProposals(read = readText, fsList = null) {
  return expand(`${PROPOSALS_DIR}/*.json`, fsList).map((f) => {
    try {
      return { file: f, record: JSON.parse(read(f) ?? 'null') };
    } catch {
      return { file: f, record: null };
    }
  });
}

export function checkProposals(registry, proposals) {
  const problems = [];
  for (const { file, record } of proposals) {
    if (!record) {
      problems.push(`${file}: not valid JSON`);
      continue;
    }
    if (path.basename(file, '.json') !== record.id) problems.push(`${file}: the file name must be the proposal id`);
    const r = evaluateProposal(record, registry);
    for (const v of r.violations) problems.push(`${file}: ${v}`);
    // A proposal cannot claim a status its stages do not support.
    if (['canary', 'released', 'rolled_back'].includes(record.status)) for (const m of r.missing) problems.push(`${file}: status ${record.status} but missing ${m}`);
  }
  return problems;
}

/** Appendix F §1.4 Canary Regression Rate, from the proposal records. */
export function canaryRegressionRate(proposals) {
  const canaried = proposals.filter((p) => p.record?.stage5?.outcome === 'clear' || p.record?.stage5?.outcome === 'rolled_back');
  const rolledBack = canaried.filter((p) => p.record.stage5.outcome === 'rolled_back').length;
  return { canaried: canaried.length, rolledBack, rate: canaried.length === 0 ? null : rolledBack / canaried.length };
}

// ── git: the automated-origin fence ─────────────────────────────────────────

function git(args) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

export function commitsIn(range, registry = null) {
  const raw = git(['log', '--format=%H%x1f%an%x1f%ae%x1f%B%x1e', range]);
  const show = (rev, f) => {
    try {
      return git(['show', `${rev}:${f}`]);
    } catch {
      return null;
    }
  };
  return raw
    .split('\x1e')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [sha, name, email, body] = s.split('\x1f');
      const files = git(['diff-tree', '--no-commit-id', '--name-only', '-r', '-m', sha]).split('\n').filter(Boolean);
      const commit = { sha, name, email, body: body ?? '', files: [...new Set(files)] };
      // OD-28 (M-19): for a split file, which declarations the commit changed.
      if (registry) {
        const symbolChanges = {};
        for (const f of commit.files) if (isSplit(f, registry)) symbolChanges[f] = changedSymbols(show(`${sha}^`, f), show(sha, f));
        if (Object.keys(symbolChanges).length > 0) commit.symbolChanges = symbolChanges;
      }
      return commit;
    });
}

/** A commit's governed paths, with each split file replaced by `file#symbol` for the declarations it changed (when known). */
export function commitPaths(commit, registry) {
  const out = [];
  for (const f of commit.files) {
    const changed = commit.symbolChanges?.[f];
    if (isSplit(f, registry) && Array.isArray(changed)) out.push(...changed.map((n) => `${f}#${n}`));
    else out.push(f);
  }
  return out;
}

export const isAutomated = (c) => /\[bot\]/i.test(`${c.name} ${c.email}`) || AUTOMATED_TRAILER.test(c.body);

export function checkCommits(commits, registry, proposals) {
  const problems = [];
  const byId = new Map(proposals.filter((p) => p.record).map((p) => [p.record.id, p.record]));
  for (const c of commits) {
    if (!isAutomated(c)) continue;
    const paths = commitPaths(c, registry);
    const { tier, components } = tierOf(paths, registry);
    const governed = paths.filter((f) => classify(f, registry).length > 0);
    if (tier && CONTROLLED.has(tier)) {
      problems.push(`${c.sha.slice(0, 10)} (automated: ${c.name}) touches ${tier} (${components.join(', ')}): never automated`);
      continue;
    }
    if (governed.length === 0) continue;
    const id = PROPOSAL_TRAILER.exec(c.body)?.[1];
    const proposal = id ? byId.get(id) : undefined;
    if (!proposal) {
      problems.push(`${c.sha.slice(0, 10)} (automated: ${c.name}) changes governed files without a Mentor-Proposal record`);
      continue;
    }
    if (proposal.origin !== 'automated') problems.push(`${c.sha.slice(0, 10)}: cites ${id}, which is not an automated proposal`);
    const named = proposal.paths ?? [];
    const outside = governed.filter((f) => !named.includes(f) && !named.includes(f.split('#')[0]));
    if (outside.length > 0) problems.push(`${c.sha.slice(0, 10)}: changes files its proposal ${id} does not name (${outside.join(', ')})`);
    const r = evaluateProposal(proposal, registry);
    if (!['canary', 'released'].includes(proposal.status) || r.violations.length > 0 || r.missing.length > 0) {
      problems.push(`${c.sha.slice(0, 10)}: proposal ${id} has not cleared its stages (${[...r.violations, ...r.missing].join('; ') || proposal.status})`);
    }
  }
  return problems;
}

// ── record ──────────────────────────────────────────────────────────────────

export function recordChanges(registry, ledger, { change, component = null, date, read = readText, fsList = null }) {
  const latest = latestEntries(ledger);
  const added = [];
  for (const c of registry.components.filter((x) => CONTROLLED.has(x.tier) && (component === null || x.id === component))) {
    const { hash, files } = componentHash(c, registry, read, fsList);
    if (latest.get(c.id)?.hash === hash) continue;
    const row = { component: c.id, hash, files, date, change, origin: 'human', pedagogicalReviewer: 'pending', safetyTrustLead: 'pending' };
    ledger.entries.push(row);
    added.push(row);
  }
  return added;
}

// ── main ────────────────────────────────────────────────────────────────────

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function parseJson(text) {
  try {
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

function main() {
  const registry = parseJson(readText(REGISTRY));
  const ledger = parseJson(readText(LEDGER)) ?? { kind: 'mentor-tier1-change-record', version: 1, entries: [] };
  if (!registry) {
    console.error(`${REGISTRY} is missing or not JSON`);
    return 1;
  }

  if (process.argv.includes('--record')) {
    const change = arg('change');
    if (!change || change.trim().length < 10) {
      console.error('--record needs --change="<what changed, 10+ characters>"');
      return 2;
    }
    const added = recordChanges(registry, ledger, { change: change.trim(), component: arg('component'), date: new Date().toISOString().slice(0, 10) });
    if (added.length === 0) {
      console.log('No Tier 1 or live-content component changed since its last row.');
      return 0;
    }
    writeFileSync(path.join(ROOT, LEDGER), `${JSON.stringify(ledger, null, 2)}\n`);
    for (const r of added) console.log(`recorded ${r.component} ${r.hash.slice(0, 12)} (${r.files} files) — sign-offs pending`);
    console.log('Both leads must replace "pending" with their names before release (npm run governance:check -- --release).');
    return 0;
  }

  const release = process.argv.includes('--release');
  const proposals = readProposals();
  const sections = {
    registry: checkRegistry(registry),
    coverage: checkCoverage(registry),
    changeRecord: checkLedger(registry, ledger, { release }),
    tier2Bounds: checkTier2Parameters(registry),
    policyStatements: checkPolicyStatements(registry),
    pipelines: checkPipelines(registry),
    proposals: checkProposals(registry, proposals),
  };
  if (release) {
    const unsigned = (registry.decisions ?? []).filter((d) => !(SIGNED(d.pedagogicalReviewer) && SIGNED(d.safetyTrustLead)));
    sections.decisions = unsigned.map((d) => `decision ${d.id} is not signed by both leads`);
  }
  const base = arg('base');
  if (base) {
    const show = (f) => {
      try {
        return git(['show', `${base}:${f}`]);
      } catch {
        return null;
      }
    };
    sections.appendOnly = checkAppendOnly(parseJson(show(LEDGER)), ledger, parseJson(show(REGISTRY)), registry);
  }
  const range = arg('range');
  let commits = [];
  if (range) {
    commits = commitsIn(range, registry);
    sections.automatedOrigin = checkCommits(commits, registry, proposals);
  }

  const problems = Object.values(sections).flat();
  const canary = canaryRegressionRate(proposals);
  const controlled = registry.components.filter((c) => CONTROLLED.has(c.tier));
  const latest = latestEntries(ledger);
  const carveOuts = [];
  for (const [file, claims] of symbolClaims(registry)) {
    const star = starClaimant(claims);
    for (const c of claims) {
      if (c === star) continue;
      carveOuts.push({ file, component: c.component.id, tier: c.component.tier, names: c.names, decision: c.decision, effective: claimEffective(c, star, registry) });
    }
  }
  const report = {
    kind: 'mentor-tier-compliance-audit',
    mode: release ? 'release' : 'check',
    generatedAt: new Date().toISOString(),
    components: registry.components.map((c) => ({ id: c.id, tier: c.tier, files: componentFiles(c, registry).length })),
    carveOuts,
    controlledComponents: controlled.length,
    signedOff: controlled.filter((c) => SIGNED(latest.get(c.id)?.pedagogicalReviewer) && SIGNED(latest.get(c.id)?.safetyTrustLead)).length,
    automatedCommitsChecked: commits.filter(isAutomated).length,
    proposals: proposals.length,
    canaryRegressionRate: canary,
    violations: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v])),
    result: problems.length === 0 ? 'pass' : 'fail',
  };
  const out = arg('report');
  if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

  if (problems.length > 0) {
    console.error(`governance:check FAILED — ${problems.length} problem(s)${release ? ' (Tier-Compliance Audit)' : ''}:`);
    for (const [name, list] of Object.entries(sections)) for (const p of list) console.error(`  [${name}] ${p}`);
    return 1;
  }
  console.log(
    `governance:check OK — ${registry.components.length} components, ${governedFiles(registry).length} governed files classified (${symbolClaims(registry).size} split by declaration; ${carveOuts.filter((c) => c.effective).length} of ${carveOuts.length} carve-outs in effect, the rest wait for both leads' signatures), ${controlled.length} Tier 1 / live-content components match their change record${release ? ' and are signed off' : ''}; ${commits.length} commit(s) checked; canary regression rate ${canary.rate === null ? 'n/a (no canary yet)' : `${(canary.rate * 100).toFixed(1)}%`}`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
