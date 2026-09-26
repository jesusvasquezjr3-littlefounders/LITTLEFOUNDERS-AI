// check-family-engagement-contract.mjs — D.6's regression, as a gate.
//
// The staff family-engagement insight broke because its three copies drifted
// apart: 0074 redefined the view per child while Core kept parsing the old
// per-family keys, so the endpoint answered "Family views unreachable" for
// every request and nothing failed. No shared types exist across packages
// here, so the wire keys are written out four times:
//   1. the database function family_engagement_insight (latest migration),
//   2. its nightly probe (probe_family_engagement_insight), which checks them,
//   3. Core's parser (FAMILY_ENGAGEMENT_*_KEYS in backend/src/services/insights.ts),
//   4. the staff console's types (IntelFamilySummary / IntelFamilyChild).
// This gate reads all four from the real files and fails on any difference.
// It runs in the unfiltered repo gates, since any one of them can change alone.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { latestFunctionBody } from './check-no-unbacked-guarantee.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CORE = 'backend/src/services/insights.ts';
const CONSOLE = 'frontend/src/routes/admin/AdminIntelPage.tsx';

const keysOf = (span) => [...span.matchAll(/'([a-z_]+)',/g)].map((m) => m[1]);
const sorted = (list) => [...new Set(list)].sort();

/** The summary and per-child keys the insight function builds. */
export function functionKeys(body) {
  const summaryStart = body.indexOf('SELECT jsonb_build_object(');
  const summaryEnd = body.indexOf('INTO v_summary');
  const childStart = body.indexOf('jsonb_agg(jsonb_build_object(');
  const childEnd = body.indexOf(') ORDER BY', childStart);
  if (summaryStart < 0 || summaryEnd < 0 || childStart < 0 || childEnd < 0) return null;
  const summary = keysOf(body.slice(summaryStart, summaryEnd));
  const extra = /jsonb_build_object\('([a-z_]+)', jsonb_array_length/.exec(body);
  if (extra) summary.push(extra[1]);
  return { summary: sorted(summary), child: sorted(keysOf(body.slice(childStart, childEnd) + ',')) };
}

/** The two key lists the probe checks with ?& ARRAY[...]. */
export function probeKeys(body) {
  const arrays = [...body.matchAll(/\?& ARRAY\[([^\]]*)\]/g)].map((m) => sorted([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])));
  return arrays.length === 2 ? { summary: arrays[0], child: arrays[1] } : null;
}

export function coreKeys(source) {
  const read = (name) => {
    const m = new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const;`).exec(source);
    return m ? sorted([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])) : null;
  };
  const summary = read('FAMILY_ENGAGEMENT_SUMMARY_KEYS');
  const child = read('FAMILY_ENGAGEMENT_CHILD_KEYS');
  return summary && child ? { summary, child } : null;
}

export function consoleKeys(source) {
  const read = (name) => {
    const m = new RegExp(`interface ${name} \\{([^}]*)\\}`).exec(source);
    return m ? sorted([...m[1].matchAll(/^\s*([a-z_]+)\s*:/gm)].map((x) => x[1])) : null;
  };
  const summary = read('IntelFamilySummary');
  const child = read('IntelFamilyChild');
  return summary && child ? { summary, child } : null;
}

export function checkContract({ migrations, readFile }) {
  const failures = [];
  const insight = latestFunctionBody(migrations, 'family_engagement_insight');
  const probe = latestFunctionBody(migrations, 'probe_family_engagement_insight');
  const sources = {
    [`${insight?.name ?? 'migrations'} family_engagement_insight`]: insight ? functionKeys(insight.body) : null,
    [`${probe?.name ?? 'migrations'} probe_family_engagement_insight`]: probe ? probeKeys(probe.body) : null,
    [CORE]: coreKeys(readFile(CORE) ?? ''),
    [CONSOLE]: consoleKeys(readFile(CONSOLE) ?? ''),
  };
  for (const [where, keys] of Object.entries(sources)) if (!keys) failures.push(`${where}: could not read the insight keys`);
  const known = Object.entries(sources).filter(([, keys]) => keys);
  if (known.length < 2) return failures;
  const [refName, ref] = known[0];
  for (const [where, keys] of known.slice(1)) {
    for (const part of ['summary', 'child']) {
      if (keys[part].join(',') !== ref[part].join(',')) {
        failures.push(`${part} keys differ: ${refName} has ${ref[part].join(',')} but ${where} has ${keys[part].join(',')}`);
      }
    }
  }
  return failures;
}

export function liveInputs(root = ROOT) {
  const dir = join(root, 'database/migrations');
  return {
    migrations: readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n') })),
    readFile: (path) => { try { return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = checkContract(liveInputs());
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log('family-engagement-contract OK — the insight function, its probe, Core and the staff console agree on every key');
}
