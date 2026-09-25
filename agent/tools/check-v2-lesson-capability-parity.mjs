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
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function extractCapabilityMap(source, declaration) {
  const start = source.indexOf(`const ${declaration} = {`);
  if (start < 0) throw new Error(`Missing ${declaration} declaration`);
  const end = source.indexOf('\n} as const', start);
  if (end < 0) throw new Error(`Could not find end of ${declaration}`);
  const block = source.slice(start, end);
  const entries = [...block.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)].map(([, segment, values]) => [
    segment,
    [...values.matchAll(/'([^']+)'/g)].map(([, capability]) => capability).sort(),
  ]);
  if (!entries.length) throw new Error(`No capability entries found in ${declaration}`);
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const core = readFileSync(resolve(root, 'backend/src/services/v2LessonDocument.ts'), 'utf8');
  const browser = readFileSync(resolve(root, 'frontend/src/rebuild/learning/lessonDocument.ts'), 'utf8');
  const forge = readFileSync(resolve(root, 'coursegen/src/v2/contract.ts'), 'utf8');
  const problems = checkV2LessonCapabilityParity(core, browser, forge);
  if (problems.length) {
    console.error(`V2 lesson capability parity failed:\n${problems.join('\n')}`);
    process.exitCode = 1;
  } else console.log('V2 lesson capability parity OK (Core, browser, Forge).');
}
