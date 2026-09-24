#!/usr/bin/env node
/**
 * The v2 lesson document is intentionally hand-maintained in Core and the
 * browser. A capability present in only one copy is a release-blocking
 * contract mismatch: Core can deliver a document that the Pizarrón cannot
 * truthfully render, or the browser can claim an operation Core did not vet.
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

export function checkV2LessonCapabilityParity(coreSource, browserSource) {
  const core = extractCapabilityMap(coreSource, 'capabilities');
  const browser = extractCapabilityMap(browserSource, 'REQUIRED_SEGMENT_CAPABILITIES');
  const problems = [];
  const names = new Set([...Object.keys(core), ...Object.keys(browser)]);
  for (const name of [...names].sort()) {
    const left = core[name] ?? [];
    const right = browser[name] ?? [];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      problems.push(`${name}: Core [${left.join(', ')}] differs from browser [${right.join(', ')}]`);
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const core = readFileSync(resolve(root, 'backend/src/services/v2LessonDocument.ts'), 'utf8');
  const browser = readFileSync(resolve(root, 'frontend/src/rebuild/learning/lessonDocument.ts'), 'utf8');
  const problems = checkV2LessonCapabilityParity(core, browser);
  if (problems.length) {
    console.error(`V2 lesson capability parity failed:\n${problems.join('\n')}`);
    process.exitCode = 1;
  } else console.log('V2 lesson capability parity OK.');
}
