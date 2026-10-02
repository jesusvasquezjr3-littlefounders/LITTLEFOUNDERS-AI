#!/usr/bin/env node
/**
 * The v2 lesson document is intentionally hand-maintained in Core and the
 * browser. A capability present in only one copy is a release-blocking
 * contract mismatch: Core can deliver a document that the Pizarrón cannot
 * truthfully render, or the browser can claim an operation Core did not vet.
 *
 * S05.4c: Forge's v2 emitter keeps a third copy (coursegen/src/v2/contract.ts
 * V2_SEGMENT_CAPABILITIES) to declare each emitted document's
 * required_capabilities. A drift there makes Forge emit documents Core
 * refuses, or omit a segment kind Core already delivers.
 *
 * Horizonte Visual packs: each pack keeps its own `<PACK>_CAPABILITIES` literal in all three layers
 * (backend/src/services/horizonte/<pack>/capabilities.ts, frontend/src/rebuild/learning/horizonte/<pack>/capabilities.ts,
 * coursegen/src/v2/horizonte/<pack>.ts); they are compared pack by pack, so two lanes never edit one shared map.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function extractCapabilityMap(source, declaration, { allowEmpty = false } = {}) {
  const start = source.indexOf(`const ${declaration} = {`);
  if (start < 0) throw new Error(`Missing ${declaration} declaration`);
  const end = source.indexOf('\n} as const', start);
  if (end < 0) throw new Error(`Could not find end of ${declaration}`);
  const block = source.slice(start, end);
  const entries = [...block.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)].map(([, segment, values]) => [
    segment,
    [...values.matchAll(/'([^']+)'/g)].map(([, capability]) => capability).sort(),
  ]);
  if (!entries.length && !allowEmpty) throw new Error(`No capability entries found in ${declaration}`);
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function compareMaps(core, other, label) {
  const problems = [];
  const names = new Set([...Object.keys(core), ...Object.keys(other)]);
  for (const name of [...names].sort()) {
    const left = core[name] ?? [];
    const right = other[name] ?? [];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      problems.push(`${name}: Core [${left.join(', ')}] differs from ${label} [${right.join(', ')}]`);
    }
  }
  return problems;
}

export function checkV2LessonCapabilityParity(coreSource, browserSource, forgeSource) {
  const core = extractCapabilityMap(coreSource, 'capabilities');
  const problems = compareMaps(core, extractCapabilityMap(browserSource, 'REQUIRED_SEGMENT_CAPABILITIES'), 'browser');
  if (forgeSource !== undefined) problems.push(...compareMaps(core, extractCapabilityMap(forgeSource, 'V2_SEGMENT_CAPABILITIES'), 'Forge'));
  return problems;
}

/** The literal name a pack's capabilities map must use: golden -> GOLDEN_CAPABILITIES, num-a -> NUM_A_CAPABILITIES. */
export const packCapabilityName = (pack) => `${pack.toUpperCase().replace(/-/g, '_')}_CAPABILITIES`;

/** Each argument maps pack id -> source text; an empty pack map is valid, a pack missing from a layer is not. */
export function checkHorizonteCapabilityParity(core, browser, forge) {
  const problems = [];
  const packs = new Set([...Object.keys(core), ...Object.keys(browser), ...Object.keys(forge)]);
  const seen = new Map();
  for (const pack of [...packs].sort()) {
    const maps = {};
    for (const [label, sources] of [['Core', core], ['browser', browser], ['Forge', forge]]) {
      if (!(pack in sources)) { problems.push(`pack ${pack}: missing from ${label}`); continue; }
      try { maps[label] = extractCapabilityMap(sources[pack], packCapabilityName(pack), { allowEmpty: true }); } catch (error) { problems.push(`pack ${pack} (${label}): ${error.message}`); }
    }
    if (!maps.Core) continue;
    if (maps.browser) problems.push(...compareMaps(maps.Core, maps.browser, 'browser').map((problem) => `pack ${pack}: ${problem}`));
    if (maps.Forge) problems.push(...compareMaps(maps.Core, maps.Forge, 'Forge').map((problem) => `pack ${pack}: ${problem}`));
    for (const type of Object.keys(maps.Core)) {
      if (seen.has(type)) problems.push(`${type}: declared by packs ${seen.get(type)} and ${pack}`);
      else seen.set(type, pack);
    }
  }
  return problems;
}

export function readHorizontePackSources(root) {
  const base = resolve(root, 'backend/src/services/horizonte');
  const ids = readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== 'harness').map((entry) => entry.name).sort();
  const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined);
  const layer = (file) => Object.fromEntries(ids.map((id) => [id, read(file(id))]).filter(([, source]) => source !== undefined));
  return {
    core: layer((id) => resolve(base, id, 'capabilities.ts')),
    browser: layer((id) => resolve(root, 'frontend/src/rebuild/learning/horizonte', id, 'capabilities.ts')),
    forge: layer((id) => resolve(root, 'coursegen/src/v2/horizonte', `${id}.ts`)),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const core = readFileSync(resolve(root, 'backend/src/services/v2LessonDocument.ts'), 'utf8');
  const browser = readFileSync(resolve(root, 'frontend/src/rebuild/learning/lessonDocument.ts'), 'utf8');
  const forge = readFileSync(resolve(root, 'coursegen/src/v2/contract.ts'), 'utf8');
  const packs = readHorizontePackSources(root);
  const problems = [...checkV2LessonCapabilityParity(core, browser, forge), ...checkHorizonteCapabilityParity(packs.core, packs.browser, packs.forge)];
  if (problems.length) {
    console.error(`V2 lesson capability parity failed:\n${problems.join('\n')}`);
    process.exitCode = 1;
  } else console.log('V2 lesson capability parity OK (Core, browser, Forge, Horizonte packs).');
}
