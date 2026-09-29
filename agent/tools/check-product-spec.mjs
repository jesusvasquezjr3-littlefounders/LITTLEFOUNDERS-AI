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

/*
 * GAP-FIX-R6 (02 rule 23, D13; OD-24): the legacy v1 LessonPlayer is the one
 * sanctioned legacy island, and ONLY for the v1 catalog it plays. It is
 * reachable through exactly two adapters, each behind a schema-1 decision:
 *
 *   - routes/app/learn/LegacyLessonIsland.tsx, mounted only by the learner
 *     route (LessonRoute.tsx) when isLegacyLessonDocument() holds
 *     (schema_version === 1);
 *   - app-routes/ScopedLessonPlayer.tsx, mounted only by the staff console's
 *     lesson preview host (app-routes/staffConsole.tsx) inside its
 *     `request.schemaVersion === 1` branch; a v2 document previews in the
 *     rebuilt lesson view.
 *
 * The lesson engine itself (src/lesson-engine/, its lab pages included) may
 * import its own player. Anything else importing the player or either adapter,
 * or an adapter host that loses its schema-1 guard, fails the check.
 */
export const LEGACY_PLAYER = 'frontend/src/lesson-engine/player/LessonPlayer';
export const LEGACY_PLAYER_ADAPTERS = {
  'frontend/src/routes/app/learn/LegacyLessonIsland': {
    host: 'frontend/src/routes/app/learn/LessonRoute.tsx',
    guard: (source) => /schema_version\s*===\s*1/.test(source) && /isLegacyLessonDocument\(state\.document\)/.test(source),
  },
  'frontend/src/app-routes/ScopedLessonPlayer': {
    host: 'frontend/src/app-routes/staffConsole.tsx',
    guard: (source) => {
      // Every mount of the adapter sits inside the schema-1 branch, which ends at the renderer's `return null;`.
      const branch = source.indexOf('if (request.schemaVersion === 1) {');
      const close = branch === -1 ? -1 : source.indexOf('return null;', branch);
      const uses = [...source.matchAll(/<LegacyLessonPlayer\b/g)].map((match) => match.index);
      return branch !== -1 && close !== -1 && uses.length > 0 && uses.every((index) => index > branch && index < close);
    },
  },
};

const withoutExtension = (path) => path.replace(/\.(tsx?|mjs|js)$/, '');

/** The legacy player and its adapters, imported only where the schema-1 decision is made. `sources`: [{ file, source }]. */
export function legacyPlayerFailures(root, sources) {
  const failures = [];
  const rel = (file) => relative(root, file).split(sep).join('/');
  for (const { file, source } of sources) {
    const from = rel(file);
    for (const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
      const name = match[1];
      if (!name.startsWith('.') && !name.startsWith('@/')) continue;
      const target = withoutExtension(rel(name.startsWith('@/') ? resolve(root, 'frontend/src', name.slice(2)) : resolve(dirname(file), name)));
      if (target === LEGACY_PLAYER) {
        const allowed = from.startsWith('frontend/src/lesson-engine/') || Object.keys(LEGACY_PLAYER_ADAPTERS).includes(withoutExtension(from));
        if (!allowed) failures.push(`Legacy v1 player reached outside its schema-1 adapters: ${from} -> ${name}`);
      }
      const adapter = LEGACY_PLAYER_ADAPTERS[target];
      if (adapter && from !== adapter.host) failures.push(`Legacy v1 player adapter mounted outside its host: ${from} -> ${name}`);
      if (adapter && from === adapter.host && !adapter.guard(source)) failures.push(`Legacy v1 player adapter mounted without its schema-1 guard: ${from} -> ${name}`);
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
