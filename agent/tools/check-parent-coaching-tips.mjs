// check-parent-coaching-tips.mjs — D.23's "reviewed by the Pedagogical Lead
// before send" as a gate.
//
// docs/operations/parent-coaching-tips.json lists every monthly tip with the
// Appendix G finding it comes from and its review. A tip is delivered only
// when Core marks it reviewed (backend/src/services/parentCoaching.ts
// COACHING_TIPS), and Core may mark it reviewed only when the registry
// records an approval whose hash matches the tip's exact copy in all three
// locales. This gate fails when:
//   - the registry, Core's list and the client's TIP_IDS disagree (ids,
//     order, Appendix G sections, or reviewed versus approved);
//   - a tip has no copy in a locale, or cites an Appendix G section that does
//     not exist, or has no stated finding;
//   - an approved tip's copy changed after its review (the hash no longer
//     matches), or an approval lacks the reviewer, the role or the date;
//   - a draft tip carries a review.
// `--hash <id>` prints the hash a reviewer records.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const REGISTRY = 'docs/operations/parent-coaching-tips.json';
const CORE = 'backend/src/services/parentCoaching.ts';
const CLIENT = 'frontend/src/rebuild/family/governanceApi.ts';
const APPENDIX_G = 'docs/littlefounders-spec/product/10-APPENDIX-G-FAMILY-HUB-BANKING-RESEARCH-FRAMEWORK.md';
const LOCALES = ['en-US', 'es-MX', 'pt-BR'];

/** The hash a review binds to: the tip's title, body and why in the three locales, in a fixed order. */
export function tipHash(id, locales) {
  const copy = LOCALES.map((locale) => {
    const tip = locales(locale)?.tips?.[id] ?? {};
    return [locale, tip.title ?? null, tip.body ?? null, tip.why ?? null];
  });
  return createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

/** The "### X.Y" section numbers of Appendix G. */
export function appendixSections(text) {
  return new Set([...(text ?? '').matchAll(/^### (\d+\.\d+) /gm)].map((m) => m[1]));
}

/** Core's COACHING_TIPS as [{ id, appendixG, reviewed }]. */
export function coreTips(source) {
  return [...(source ?? '').matchAll(/\{ id: '([a-z0-9-]+)', appendixG: \[([^\]]*)\], reviewed: (true|false) \}/g)]
    .map((m) => ({ id: m[1], appendixG: [...m[2].matchAll(/'([\d.]+)'/g)].map((x) => x[1]), reviewed: m[3] === 'true' }));
}

/** The client's TIP_IDS. */
export function clientTips(source) {
  const m = /export const TIP_IDS = \[([\s\S]*?)\] as const;/.exec(source ?? '');
  return m ? [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]) : null;
}

/** Pure check over in-memory inputs, so the gate can be tested against known-bad fixtures. */
export function checkTips({ registry, readFile, locales }) {
  const failures = [];
  const sections = appendixSections(readFile(APPENDIX_G));
  const ids = registry.tips.map((t) => t.id);
  if (new Set(ids).size !== ids.length) failures.push('the registry lists a tip twice');
  const core = coreTips(readFile(CORE));
  const client = clientTips(readFile(CLIENT));
  if (JSON.stringify(core.map((t) => t.id)) !== JSON.stringify(ids)) failures.push(`${CORE}: COACHING_TIPS is ${core.map((t) => t.id)} but the registry lists ${ids}`);
  if (JSON.stringify(client) !== JSON.stringify(ids)) failures.push(`${CLIENT}: TIP_IDS is ${client} but the registry lists ${ids}`);
  for (const tip of registry.tips) {
    const mirror = core.find((t) => t.id === tip.id);
    if (!tip.finding || tip.finding.trim().length < 30) failures.push(`${tip.id}: no stated Appendix G finding`);
    if (!Array.isArray(tip.appendixG) || tip.appendixG.length === 0) failures.push(`${tip.id}: cites no Appendix G section`);
    for (const s of tip.appendixG ?? []) if (!sections.has(s)) failures.push(`${tip.id}: Appendix G has no section ${s}`);
    if (mirror && JSON.stringify(mirror.appendixG) !== JSON.stringify(tip.appendixG)) failures.push(`${tip.id}: Core cites ${mirror.appendixG}, the registry ${tip.appendixG}`);
    for (const locale of LOCALES) {
      const text = locales(locale)?.tips?.[tip.id];
      for (const part of ['title', 'body', 'why']) {
        if (typeof text?.[part] !== 'string' || text[part].trim() === '') failures.push(`${tip.id}: no ${part} in ${locale}`);
      }
    }
    if (tip.status === 'approved') {
      const r = tip.review ?? {};
      if (!r.by || r.role !== registry.reviewerRole || !/^\d{4}-\d{2}-\d{2}$/.test(r.at ?? '')) failures.push(`${tip.id}: an approval needs the reviewer, the ${registry.reviewerRole} role and the date`);
      if (r.hash !== tipHash(tip.id, locales)) failures.push(`${tip.id}: the copy changed after its review; review it again before it can be sent`);
      if (mirror && !mirror.reviewed) failures.push(`${tip.id}: approved here but Core does not send it`);
    } else if (tip.status === 'draft') {
      if (tip.review !== null) failures.push(`${tip.id}: a draft carries a review`);
      if (mirror?.reviewed) failures.push(`${tip.id}: Core sends a tip nobody has reviewed`);
    } else failures.push(`${tip.id}: unknown status ${tip.status}`);
  }
  return failures;
}

export function liveInputs(root = ROOT) {
  const cache = new Map();
  return {
    registry: JSON.parse(readFileSync(join(root, REGISTRY), 'utf8')),
    readFile: (path) => { try { return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } },
    locales: (locale) => {
      if (!cache.has(locale)) {
        try { cache.set(locale, JSON.parse(readFileSync(join(root, 'frontend/src/i18n', locale, 'familyGovernance.json'), 'utf8'))); } catch { cache.set(locale, null); }
      }
      return cache.get(locale);
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inputs = liveInputs();
  const at = process.argv.indexOf('--hash');
  if (at > 0) {
    const id = process.argv[at + 1];
    if (!inputs.registry.tips.some((t) => t.id === id)) { console.error(`no tip ${id}`); process.exit(1); }
    console.log(tipHash(id, inputs.locales));
    process.exit(0);
  }
  const failures = checkTips(inputs);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  const approved = inputs.registry.tips.filter((t) => t.status === 'approved').length;
  console.log(`parent-coaching-tips OK — ${inputs.registry.tips.length} tips, each citing Appendix G, in three locales; ${approved} reviewed by the ${inputs.registry.reviewerRole} and sent, ${inputs.registry.tips.length - approved} drafted and never sent`);
}
