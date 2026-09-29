// check-no-unbacked-guarantee.mjs — D.7's standing principle as a gate: no
// visual element or copy in the Wallet or the Family Hub may imply a
// guarantee the system does not enforce.
//
// docs/operations/block-d-controls.json lists every control a family sees
// (the practice card, the freeze and each thing it holds, who may lift it,
// the spending limit, the bonus framing, the age register), what the product
// may say it does, where it is enforced and which adversarial test proves it.
// This gate reads the real files and fails when:
//   - an enforcement or a proof named in the registry is gone;
//   - the LATEST migration defining an enforcing SQL function no longer
//     carries its guard (a later CREATE OR REPLACE that drops the freeze
//     check is exactly how a control silently becomes cosmetic, D.1);
//   - Core's or the client's list of what a freeze holds differs from the
//     registry (the freeze card renders that list, so it may only name what
//     the database refuses);
//   - a rebuilt surface declares a data-control the registry does not know;
//   - a copy key the registry names is missing in any locale;
//   - a retired claim (a promise the product stopped backing, such as "every
//     reward waits for your approval" once D.17 pre-approves small ones)
//     reappears anywhere in its namespace, in any locale;
//   - two public strings that share one statement (the Families page and the
//     FAQ answer on under-13 usage data) stop carrying it in any locale;
//   - any package depends on a payment, card-issuing or bank-linking SDK
//     (the simulation claim, "no bank or card behind it", would stop being true).
// It runs in the unfiltered repo gates: the evidence spans database/,
// backend/, frontend/ and docs/, and any of them can change alone.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const REGISTRY = 'docs/operations/block-d-controls.json';
const LOCALES = ['en-US', 'es-MX', 'pt-BR'];

/** The body of the latest migration that (re)defines public.<fn>, or null. Migrations are [{ name, sql }] in apply order. */
export function latestFunctionBody(migrations, fn) {
  // Only a definition counts, never a REVOKE/GRANT ON FUNCTION or a trigger's EXECUTE FUNCTION.
  const head = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fn}\\s*\\(`, 'i');
  for (let i = migrations.length - 1; i >= 0; i--) {
    const { name, sql } = migrations[i];
    const matches = [...sql.matchAll(new RegExp(head.source, 'gi'))];
    if (matches.length === 0) continue;
    // A file may define the function more than once; the last definition wins.
    const at = matches[matches.length - 1].index;
    const rest = sql.slice(at);
    const open = /\bAS\s+(\$[A-Za-z_]*\$)/i.exec(rest);
    if (!open) continue;
    const start = open.index + open[0].length;
    const end = rest.indexOf(open[1], start);
    if (end === -1) continue;
    return { name, body: rest.slice(start, end) };
  }
  return null;
}

/** The literal members of `export const FREEZE_HOLDS = [...] as const;` in a source file. */
export function holdsIn(source) {
  const m = /export const FREEZE_HOLDS = \[([^\]]*)\] as const;/.exec(source ?? '');
  return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : null;
}

/** Every data-control a rebuilt .tsx declares: literals, and the `prefix.${…}` templates as "prefix.*". */
export function declaredControls(source) {
  const literal = [...source.matchAll(/data-control="([a-z_.]+)"/g)].map((m) => m[1]);
  const template = [...source.matchAll(/data-control=\{`([a-z_]+)\.\$\{/g)].map((m) => `${m[1]}.*`);
  return [...literal, ...template];
}

/** Every string leaf of a copy file as [dotted key, text]. */
export function flatStrings(node, prefix = '') {
  if (typeof node === 'string') return [[prefix, node]];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([key, value]) => flatStrings(value, prefix ? `${prefix}.${key}` : key));
}

function lookup(json, path) {
  return path.split('.').reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), json);
}

/** Pure check over in-memory inputs, so the gate can be tested against known-bad fixtures. */
export function checkControls({ registry, readFile, migrations, rebuiltSources, locales, packages }) {
  const failures = [];
  const ids = new Set();
  const holds = [];
  for (const control of registry.controls ?? []) {
    const id = control.id;
    if (!id || ids.has(id)) failures.push(`control "${id}": missing or duplicate id`);
    ids.add(id);
    if (!control.claim || control.claim.trim().length < 20) failures.push(`${id}: no written claim`);
    if (!Array.isArray(control.enforcedBy) || control.enforcedBy.length === 0) failures.push(`${id}: no enforcement listed`);
    if (!Array.isArray(control.provedBy) || control.provedBy.length === 0) failures.push(`${id}: no adversarial proof listed`);
    if (control.hold) holds.push(control.hold);
    for (const evidence of [...(control.enforcedBy ?? []), ...(control.provedBy ?? [])]) {
      if (evidence.fn) {
        const found = latestFunctionBody(migrations, evidence.fn);
        if (!found) failures.push(`${id}: no migration defines public.${evidence.fn}`);
        else if (!found.body.includes(evidence.contains)) failures.push(`${id}: the latest definition of public.${evidence.fn} (${found.name}) no longer contains "${evidence.contains}"`);
      } else if (evidence.file) {
        const text = readFile(evidence.file);
        if (text === null) failures.push(`${id}: ${evidence.file} does not exist`);
        else if (!text.includes(evidence.contains)) failures.push(`${id}: ${evidence.file} no longer contains "${evidence.contains}"`);
      } else failures.push(`${id}: an evidence entry names neither a file nor a function`);
    }
    for (const key of control.ui ?? []) {
      const [ns, path] = key.split(':');
      for (const locale of LOCALES) {
        const value = lookup(locales(locale, ns), path);
        if (typeof value !== 'string' || value.trim() === '') failures.push(`${id}: copy ${key} is missing in ${locale}`);
      }
    }
  }
  const expected = [...holds].sort().join(',');
  for (const file of ['backend/src/services/moneyPresentation.ts', 'frontend/src/rebuild/banking/bankingApi.ts']) {
    const actual = holdsIn(readFile(file));
    if (actual === null) failures.push(`${file}: FREEZE_HOLDS not found`);
    else if ([...actual].sort().join(',') !== expected) failures.push(`${file}: FREEZE_HOLDS is ${actual.join(',')} but the registry lists ${expected}`);
  }
  for (const [file, source] of rebuiltSources) {
    for (const control of declaredControls(source)) {
      if (control.endsWith('.*')) {
        const prefix = control.slice(0, -1);
        if (![...ids].some((i) => i.startsWith(prefix))) failures.push(`${file}: data-control ${control} matches no registered control`);
      } else if (!ids.has(control)) failures.push(`${file}: data-control="${control}" is not in ${REGISTRY}`);
    }
  }
  // S07.8: a claim the product stopped backing (every reward waits for a tap
  // once D.17 pre-approves small ones; Share coins "toward someone else's
  // goal" that no flow ever produced) may not come back in any string of the
  // namespace, in any locale.
  for (const retired of registry.retiredClaims ?? []) {
    for (const locale of LOCALES) {
      const strings = flatStrings(locales(locale, retired.namespace));
      for (const phrase of retired.phrases?.[locale] ?? []) {
        const hit = strings.find(([, text]) => text.toLowerCase().includes(phrase.toLowerCase()));
        if (hit) failures.push(`${retired.namespace}:${hit[0]} (${locale}) says "${phrase}", a claim the product no longer backs: ${retired.why}`);
      }
    }
  }
  // F3-identity-site: a promise made on two public surfaces (the Families page
  // and the FAQ answer it restates) must keep the same statement in every
  // locale, so one of them cannot drift back to a control that does not ship.
  for (const shared of registry.sharedStatements ?? []) {
    if (!Array.isArray(shared.keys) || shared.keys.length < 2) failures.push(`${shared.id}: a shared statement needs two or more copy keys`);
    for (const locale of LOCALES) {
      const phrase = shared.phrases?.[locale];
      if (typeof phrase !== 'string' || phrase.trim() === '') {
        failures.push(`${shared.id}: no ${locale} statement`);
        continue;
      }
      for (const key of shared.keys ?? []) {
        const [ns, path] = key.split(':');
        const value = lookup(locales(locale, ns), path);
        if (typeof value !== 'string' || !value.toLowerCase().includes(phrase.toLowerCase())) {
          failures.push(`${key} (${locale}) no longer says "${phrase}", the statement it shares with ${shared.keys.filter((other) => other !== key).join(', ')}: ${shared.why}`);
        }
      }
    }
  }
  const forbidden = new Set(registry.forbiddenDependencies ?? []);
  for (const [file, pkg] of packages) {
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const dep of Object.keys(pkg[field] ?? {})) {
        if (forbidden.has(dep)) failures.push(`${file}: depends on ${dep}, a payment or bank-linking SDK; the simulation claim would no longer be true`);
      }
    }
  }
  return failures;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

export function liveInputs(root = ROOT) {
  const dir = join(root, 'database/migrations');
  const migrations = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n') }));
  const rebuilt = join(root, 'frontend/src/rebuild');
  const rebuiltSources = walk(rebuilt).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    .map((f) => [f.slice(root.length).replace(/\\/g, '/'), readFileSync(f, 'utf8')]);
  const packages = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(root, e.name, 'package.json'))
    .concat([join(root, 'package.json')])
    .flatMap((f) => { try { return [[f.slice(root.length).replace(/\\/g, '/'), JSON.parse(readFileSync(f, 'utf8'))]]; } catch { return []; } });
  const cache = new Map();
  return {
    registry: JSON.parse(readFileSync(join(root, REGISTRY), 'utf8')),
    readFile: (path) => { try { return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } },
    migrations,
    rebuiltSources,
    packages,
    locales: (locale, ns) => {
      const key = `${locale}/${ns}`;
      if (!cache.has(key)) {
        try { cache.set(key, JSON.parse(readFileSync(join(root, 'frontend/src/i18n', locale, `${ns}.json`), 'utf8'))); } catch { cache.set(key, null); }
      }
      return cache.get(key);
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inputs = liveInputs();
  const failures = checkControls(inputs);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log(`no-unbacked-guarantee OK — ${inputs.registry.controls.length} controls, each enforced and proved; freeze holds agree; ${inputs.rebuiltSources.length} rebuilt surfaces declare only registered controls`);
}
