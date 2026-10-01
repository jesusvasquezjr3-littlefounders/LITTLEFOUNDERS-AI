#!/usr/bin/env node
/**
 * check-legacy-ui.mjs — S10L.1 (OD-2, OD-15, OD-24, Frontend Bible 02 rule 23):
 * the legacy UI only shrinks.
 *
 * The legacy UI was inventoried and every module no route reaches was deleted
 * (docs/rebuild/sprints/S10-CUTOVER.md, S10L.1). What is left is frozen:
 *
 *   1. No new file under a legacy UI directory. The directories are the
 *      pre-rebuild UI roots (src/routes, src/components, src/lesson-engine,
 *      src/tutor, src/guided-voice); every non-test file they may still hold is
 *      listed in legacy-ui-freeze.json. New UI belongs under src/rebuild/ (its
 *      route wiring under src/app-routes/). Test files are exempt: a test adds
 *      no UI.
 *   2. No stale freeze entry. A listed file that no longer exists must leave
 *      the list in the same change, so the list keeps describing the tree.
 *   3. No import of a removed legacy module, from anywhere in the frontend
 *      source or scripts: a removed module coming back through an import is a
 *      rebuilt screen falling back on the legacy UI.
 *   4. The i18next bundle (src/i18n/index.ts) loads only the legacy
 *      namespaces that survived; rebuilt copy lives in rebuild-<ns>.json.
 *
 * OD-31 retires the v1 lesson player and its adapters globally. No legacy
 * lesson island remains sanctioned.
 *
 * Usage: node agent/tools/check-legacy-ui.mjs [root]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FREEZE_FILE = 'agent/tools/legacy-ui-freeze.json';
const SRC = 'frontend/src';
const CODE = /\.(tsx?|mjs|js)$/;
const TEST = /(\.test\.[cm]?[jt]sx?$)|(\/__tests__\/)|(\/test-setup\.ts$)/;
const EXT = ['', '.ts', '.tsx', '.js', '.mjs', '.json', '.css', '/index.ts', '/index.tsx'];

function walk(root, dir) {
  const full = join(root, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full, { withFileTypes: true }).flatMap((e) => {
    const rel = posix.join(dir, e.name);
    if (e.name === 'node_modules') return [];
    return e.isDirectory() ? walk(root, rel) : [rel];
  });
}

/** The src-relative module path a specifier names, or null for a package import. */
export function resolveSpecifier(fromFile, spec) {
  let target;
  if (spec.startsWith('@/')) target = posix.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) target = posix.join(posix.dirname(fromFile), spec);
  else if (spec.startsWith('/src/')) target = posix.join('frontend', spec);
  else return null;
  return target.split('?')[0];
}

/** True when `target` (repo-relative, maybe without extension) is, or lives inside, a removed module. */
export function isRemoved(target, removed) {
  return removed.some((entry) => {
    const base = posix.join(SRC, entry.path);
    if (entry.path.endsWith('/')) return target.startsWith(base) || `${target}/` === base;
    return EXT.some((ext) => target === base + ext || `${target}${ext}` === base);
  });
}

const SPECIFIERS = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]|vi\.mock\(\s*['"]([^'"]+)['"]|readFileSync\([^)]*?['"]([^'"]*src\/[^'"]+)['"]/g;

export function checkLegacyUi(root) {
  const freeze = JSON.parse(readFileSync(join(root, FREEZE_FILE), 'utf8'));
  const failures = [];
  const listed = new Set(freeze.files);

  // 1 + 2: the frozen directories.
  for (const dir of freeze.directories) {
    for (const file of walk(root, posix.join(SRC, dir))) {
      if (TEST.test(file)) continue;
      if (!listed.has(file)) failures.push(`${file}: new file under the legacy UI directory ${SRC}/${dir}/ — build it under ${SRC}/rebuild/ (02 rule 23, S10L.1)`);
    }
  }
  for (const file of freeze.files) {
    if (!existsSync(join(root, file))) failures.push(`${FREEZE_FILE}: ${file} no longer exists; remove it from the freeze list`);
    if (!freeze.directories.some((dir) => file.startsWith(`${SRC}/${dir}/`))) failures.push(`${FREEZE_FILE}: ${file} is outside the legacy UI directories`);
  }

  // 3: no import of a removed module (frontend source and scripts).
  const code = [...walk(root, SRC), ...walk(root, 'frontend/scripts')].filter((f) => CODE.test(f));
  for (const file of code) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const m of text.matchAll(SPECIFIERS)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
      let target = spec ? resolveSpecifier(file, spec) : null;
      if (!spec && m[5]) target = m[5].includes('frontend/src/') ? m[5].slice(m[5].indexOf('frontend/src/')) : posix.join('frontend', m[5].slice(m[5].indexOf('src/')));
      if (target && isRemoved(target, freeze.removed)) failures.push(`${file}: imports ${spec ?? m[5]}, a legacy module removed in S10L.1 — use the rebuilt equivalent (${freeze.removed.find((r) => isRemoved(target, [r])).replacement})`);
    }
  }

  // 4: the i18next bundle loads only the surviving legacy namespaces.
  const index = readFileSync(join(root, SRC, 'i18n/index.ts'), 'utf8');
  const loaded = [...new Set([...index.matchAll(/from\s+'\.\/[A-Za-z-]+\/([A-Za-z-]+)\.json'/g)].map((m) => m[1]))].sort();
  const allowed = [...freeze.i18nNamespaces].sort();
  for (const ns of loaded) if (!allowed.includes(ns)) failures.push(`${SRC}/i18n/index.ts: loads the namespace "${ns}"; legacy namespaces only shrink — rebuilt copy goes in rebuild-<ns>.json`);
  return { failures, frozen: freeze.files.length, scanned: code.length };
}

function main() {
  const root = resolve(process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  const { failures, frozen, scanned } = checkLegacyUi(root);
  if (failures.length > 0) {
    console.error(`legacy-ui:check FAILED (${failures.length}):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }
  console.log(`legacy-ui:check OK — ${frozen} frozen legacy files, no new ones, no import of a removed legacy module across ${scanned} files.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
