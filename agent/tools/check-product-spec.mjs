import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyManifest(root, manifest) {
  const failures = [];
  const listed = new Set();
  for (const line of manifest.trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s+\.\/([^\r\n]+)$/.exec(line);
    if (!match) { failures.push(`Malformed checksum: ${line}`); continue; }
    const [, expected, name] = match;
    const path = resolve(root, name);
    if (!path.startsWith(resolve(root) + sep) || listed.has(name)) {
      failures.push(`Invalid or duplicate manifest path: ${name}`); continue;
    }
    listed.add(name);
    try {
      const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
      if (actual !== expected) failures.push(`Specification checksum mismatch: ${name}`);
    } catch { failures.push(`Missing specification file: ${name}`); }
  }
  return failures;
}

function walk(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? walk(resolve(root, entry.name)) : [resolve(root, entry.name)]);
}

export function checkRepository(root) {
  const spec = resolve(root, 'docs/littlefounders-spec');
  const manifest = readFileSync(resolve(spec, 'CHECKSUMS.sha256'), 'utf8');
  const failures = verifyManifest(spec, manifest);
  const agents = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
  if (agents !== readFileSync(resolve(root, 'CLAUDE.md'), 'utf8')) failures.push('AGENTS.md and CLAUDE.md differ');
  if (!agents.includes('absolute, non-negotiable source of truth')) failures.push('Binding authority is missing from agent instructions');
  const product = readFileSync(resolve(spec, 'product/10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md'), 'utf8');
  const ids = [...product.matchAll(/^### ([A-H]\.\d+) /gm)].map((m) => m[1]);
  const ledger = readFileSync(resolve(root, 'docs/rebuild/REQUIREMENTS.md'), 'utf8');
  for (const id of ids) if (!ledger.includes(`| ${id} |`)) failures.push(`Untracked requirement: ${id}`);
  // The new UI may use its own components and localized resources, never the legacy UI.
  // OD-15/B.8 explicitly reuse the real 3D renderer, its quality probe and its theme context.
  // Confine that bridge to one lesson-stage adapter; it grants no legacy UI component imports.
  const stageBridge = resolve(root, 'frontend/src/rebuild/learning/CompactMentorStage.tsx');
  const stageBridgeTargets = new Set([
    resolve(root, 'frontend/src/tutor-scene/TutorStage'),
    resolve(root, 'frontend/src/tutor-scene/quality'),
    resolve(root, 'frontend/src/theme/useTheme'),
  ]);
  for (const file of walk(resolve(root, 'frontend/src/rebuild')).filter((p) => /\.tsx?$/.test(p))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
      const name = match[1];
      if (!name.startsWith('.') && !name.startsWith('@/')) continue;
      const target = name.startsWith('@/') ? resolve(root, 'frontend/src', name.slice(2)) : resolve(dirname(file), name);
      if (![resolve(root, 'frontend/src/rebuild') + sep, resolve(root, 'frontend/src/i18n') + sep].some((prefix) => target.startsWith(prefix))
        && !(file === stageBridge && stageBridgeTargets.has(target))) {
        failures.push(`Legacy dependency in new frontend: ${relative(root, file)} -> ${name}`);
      }
    }
  }
  return { failures, requirementHeadings: ids.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkRepository(fileURLToPath(new URL('../../', import.meta.url)));
  if (result.failures.length) {
    console.error(result.failures.join('\n')); process.exitCode = 1;
  } else console.log(`Product specification OK: checksums, agent parity, ${result.requirementHeadings} requirement headings, new UI boundary.`);
}
