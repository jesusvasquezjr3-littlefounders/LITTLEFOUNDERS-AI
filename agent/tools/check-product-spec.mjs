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
  for (const file of walk(resolve(root, 'frontend/src/rebuild')).filter((p) => /\.tsx?$/.test(p))) {
    failures.push(...boundaryFailures(root, file, readFileSync(file, 'utf8')));
  }
  const sources = walk(resolve(root, 'frontend/src'))
    .filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !p.includes(`${sep}__tests__${sep}`))
    .map((file) => ({ file, source: readFileSync(file, 'utf8') }));
  failures.push(...legacyPlayerFailures(root, sources));
  return { failures, requirementHeadings: ids.length };
}

/** Retired lesson UI has no sanctioned importers or runtime adapters. */
export const LEGACY_PLAYER = 'frontend/src/lesson-engine/player/LessonPlayer';
export const LEGACY_PLAYER_ADAPTERS = {};
const RETIRED_LESSON_MODULES = [
  'frontend/src/lesson-engine/',
  'frontend/src/components/ui/',
  'frontend/src/app-routes/ScopedLessonPlayer',
  'frontend/src/app-routes/legacySheet',
  'frontend/src/routes/app/learn/LegacyLessonIsland',
];
const withoutExtension = (file) => file.replace(/\.(tsx?|mjs|js)$/, '');
export function legacyPlayerFailures(root, sources) {
  const failures = [];
  const rel = (file) => relative(root, file).split(sep).join('/');
  const retired = (file) => RETIRED_LESSON_MODULES.some((module) => module.endsWith('/') ? file.startsWith(module) : withoutExtension(file) === module);
  for (const { file, source } of sources) {
    const from = rel(file);
    if (retired(from)) failures.push('Retired legacy lesson UI exists: ' + from);
    for (const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
      const name = match[1];
      if (!name.startsWith('.') && !name.startsWith('@/')) continue;
      const target = rel(name.startsWith('@/') ? resolve(root, 'frontend/src', name.slice(2)) : resolve(dirname(file), name));
      if (retired(target)) failures.push('Retired legacy lesson dependency: ' + from + ' -> ' + name);
    }
  }
  return failures;
}

/*
 * The new UI may use its own components and localized resources, never the
 * legacy UI. OD-15/B.8 explicitly reuse the real 3D renderer, its quality
 * probe and its theme context. That bridge is confined to NAMED stage files,
 * never a directory, and it grants no legacy UI component imports:
 *
 *   - rebuild/learning/CompactMentorStage.tsx: the compact Mentor stage inside
 *     a lesson (Bible 08 §11, B.8).
 *   - rebuild/mentor/MentorStage.tsx: the Mentor screen's stage, the one
 *     isolated component with a documented interface that Bible 08 §7 asks for
 *     (W2: reserved for the Mentor lane; it may not exist yet). The Mentor
 *     screen's other files import the stage, not the 3D engine, and the tutor/
 *     session hooks stay out of reach until that lane rebuilds them.
 */
export const STAGE_BRIDGES = [
  'frontend/src/rebuild/learning/CompactMentorStage.tsx',
  'frontend/src/rebuild/mentor/MentorStage.tsx',
];
export const STAGE_BRIDGE_TARGETS = [
  'frontend/src/tutor-scene/TutorStage',
  'frontend/src/tutor-scene/quality',
  'frontend/src/theme/useTheme',
];

/** Imports of one rebuilt file that reach outside src/rebuild and src/i18n, except a stage bridge's named targets. */
export function boundaryFailures(root, file, source) {
  const failures = [];
  const bridge = STAGE_BRIDGES.some((path) => resolve(root, path) === resolve(file));
  const targets = new Set(STAGE_BRIDGE_TARGETS.map((path) => resolve(root, path)));
  for (const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
    const name = match[1];
    if (!name.startsWith('.') && !name.startsWith('@/')) continue;
    const target = name.startsWith('@/') ? resolve(root, 'frontend/src', name.slice(2)) : resolve(dirname(file), name);
    if (![resolve(root, 'frontend/src/rebuild') + sep, resolve(root, 'frontend/src/i18n') + sep].some((prefix) => target.startsWith(prefix))
      && !(bridge && targets.has(target))) {
      failures.push(`Legacy dependency in new frontend: ${relative(root, file)} -> ${name}`);
    }
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkRepository(fileURLToPath(new URL('../../', import.meta.url)));
  if (result.failures.length) {
    console.error(result.failures.join('\n')); process.exitCode = 1;
  } else console.log(`Product specification OK: checksums, agent parity, ${result.requirementHeadings} requirement headings, new UI boundary.`);
}
