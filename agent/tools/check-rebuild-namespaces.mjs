import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * i18n:check phase 1b — the rebuilt UI's copy namespaces (W2 "Shells and
 * routing"). The rebuilt copy is one JSON file per wave-2 lane and locale
 * (`frontend/src/i18n/<locale>/rebuild-<namespace>.json`), registered in
 * `frontend/src/i18n/rebuild.ts` (REBUILD_NAMESPACES). Phase 1 already proves
 * the three locales hold the same files and keys. This proves what phase 1
 * cannot see:
 *
 *   - every rebuild-*.json on disk is a registered namespace, and every
 *     registered namespace exists (an unregistered file is copy no surface,
 *     test or glossary rule reads through the merged object);
 *   - a top-level key lives in exactly one namespace (the merge spreads the
 *     namespaces into one object, so a duplicate silently shadows another
 *     lane's string);
 *   - the pre-split `rebuild.json` does not come back.
 */
export const LOCALES = ['en-US', 'es-MX', 'pt-BR'];

export function registeredNamespaces(root) {
  const source = readFileSync(join(root, 'frontend/src/i18n/rebuild.ts'), 'utf8');
  const match = /export const REBUILD_NAMESPACES = \[([^\]]*)\]/.exec(source);
  if (!match) return null;
  return [...match[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
}

export function checkRebuildNamespaces(root) {
  const failures = [];
  const namespaces = registeredNamespaces(root);
  if (!namespaces?.length) return ['REBUILD_NAMESPACES not found in frontend/src/i18n/rebuild.ts'];
  for (const locale of LOCALES) {
    const dir = join(root, 'frontend/src/i18n', locale);
    if (existsSync(join(dir, 'rebuild.json'))) failures.push(`${locale}/rebuild.json exists: rebuilt copy lives in the per-lane rebuild-<namespace>.json files`);
    const files = readdirSync(dir).filter((file) => /^rebuild-.*\.json$/.test(file));
    for (const file of files) {
      const namespace = file.slice('rebuild-'.length, -'.json'.length);
      if (!namespaces.includes(namespace)) failures.push(`${locale}/${file} is not a registered namespace (add it to REBUILD_NAMESPACES in frontend/src/i18n/rebuild.ts)`);
    }
    const owner = new Map();
    for (const namespace of namespaces) {
      const file = join(dir, `rebuild-${namespace}.json`);
      if (!existsSync(file)) { failures.push(`${locale}/rebuild-${namespace}.json is missing`); continue; }
      let copy;
      try { copy = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { failures.push(`${locale}/rebuild-${namespace}.json: ${error.message}`); continue; }
      for (const key of Object.keys(copy)) {
        if (owner.has(key)) failures.push(`${locale}: top-level key "${key}" is in both rebuild-${owner.get(key)}.json and rebuild-${namespace}.json`);
        else owner.set(key, namespace);
      }
    }
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const failures = checkRebuildNamespaces(root);
  if (failures.length) {
    console.error(`i18n:check FAILED — rebuilt copy namespaces:\n${failures.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`i18n:check OK — rebuilt copy namespaces registered and disjoint (${registeredNamespaces(root).join(', ')})`);
  }
}
