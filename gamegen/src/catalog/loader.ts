// Arcade game-catalog loader — GAME_ENGINE.md §8/§9, gamegen/AGENTS.md.
//
// Loads `gamegen/curriculum/<course-slug>/games.yaml`, Zod-validates it, and
// CROSS-VALIDATES it against Forge's own catalog: every blueprint's `topic_path` must
// resolve to a real topic in `coursegen/curriculum/<course-slug>/catalog.yaml` (plus
// the adventure files that catalog points at). A game bound to a concept that does not
// exist is an ORPHAN, and orphan games do not exist — that is the standing invariant in
// gamegen/AGENTS.md, enforced at publish time by a NOT NULL `games.topic_id` FK. This
// gate is the same rule moved earlier, to before the first paid call.
//
// ── DEPLOYMENT NOTE — THIS IS A DEV/CI-TIME GATE ONLY ─────────────────────────────
// Railway deploys gamegen with `--path-as-root`, so `coursegen/` does NOT exist in the
// production image and the cross-catalog read here would fail there by construction.
// That is fine and intended: nothing on a request path may call this module. It runs in
// exactly two places — `npm run catalog:check` (via src/catalogCli.ts) and the pipeline's
// free `validate` stage on an operator's machine / in CI, where the whole monorepo is
// checked out. `gamegen-ci.yml`'s path filters must therefore include
// `coursegen/curriculum/**`, or a Forge rename breaks the binding with nothing failing.
// ──────────────────────────────────────────────────────────────────────────────────
//
// Never throws on malformed content — always returns a result with `ok` + a flat issue
// list naming the FILE and the path inside it, so one run reports everything an author
// has to fix instead of stopping at the first problem (Forge's loader posture).

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  gamesFileSchema,
  courseCatalogIndexSchema,
  courseAdventureIndexSchema,
  MECHANIC_IDS,
  type GamesFile,
  type GameBlueprint,
} from './schema.js';

// `gamegen/src/catalog/loader.ts` → 3 levels up is the repo root. Identical depth from
// `gamegen/dist/catalog/loader.js`, so a built run resolves the same tree. Prior art for
// a cross-package dev-time file read: `coursegen/src/contract/check.ts`.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const DEFAULT_COURSEGEN_CURRICULUM_ROOT = path.join(REPO_ROOT, 'coursegen/curriculum');

export interface GameCatalogIssue {
  level: 'error' | 'warning';
  file: string;
  message: string;
}

/** Per-mechanic and per-topic distribution, surfaced so an author can SEE the shape of
 *  a course instead of inferring it by scrolling YAML. */
export interface GameCatalogCoverage {
  blueprints: number;
  /** Every one of the 8 closed mechanic ids is a key, zero-count included. */
  mechanicCounts: Record<string, number>;
  unusedMechanics: string[];
  gamesPerTopic: { topicPath: string; count: number }[];
  topicsWithGames: number;
  /** `null` when Forge's catalog could not be read — never a silent 0. */
  topicsInCourse: number | null;
}

export interface GameCatalogLoadResult {
  ok: boolean;
  issues: GameCatalogIssue[];
  courseDir: string;
  file: string;
  /** Undefined when games.yaml is missing or failed to parse/validate. */
  catalog?: GamesFile;
  coverage: GameCatalogCoverage;
}

export interface LoadGameCatalogOptions {
  /**
   * Overrides where Forge's curriculum tree lives. Tests point this at a fixture tree;
   * nothing in production does (see the deployment note above).
   */
  coursegenCurriculumRoot?: string;
}

// ---- Forge topic index ------------------------------------------------------------

interface TopicRef {
  /** `"tierN"` as Forge's adventure declares it, when it declares one. */
  ageTier?: string;
}

interface TopicIndex {
  topics: Map<string, TopicRef>;
}

function readYaml(filePath: string): { data: unknown; error?: string } {
  if (!existsSync(filePath)) return { data: undefined, error: 'file not found' };
  try {
    return { data: parseYaml(readFileSync(filePath, 'utf8')) };
  } catch (err) {
    return { data: undefined, error: err instanceof Error ? err.message : String(err) };
  }
}

function zodIssues(file: string, issues: readonly { path: PropertyKey[]; message: string }[]): GameCatalogIssue[] {
  return issues.map((issue) => ({
    level: 'error' as const,
    file,
    message: `${issue.path.join('.') || '<root>'}: ${issue.message}`,
  }));
}

/**
 * Enumerates every `"<adventure>/<saga>/<topic>"` path of a Forge course by reading its
 * `catalog.yaml` and the adventure files it references. Returns `null` for the index
 * when the course cannot be read at all — the caller then SKIPS per-blueprint resolution
 * rather than reporting every blueprint as unresolvable on top of the real cause.
 */
export function loadCourseTopicIndex(coursegenCourseDir: string): {
  index: TopicIndex | null;
  issues: GameCatalogIssue[];
} {
  const issues: GameCatalogIssue[] = [];
  const catalogPath = path.join(coursegenCourseDir, 'catalog.yaml');

  const raw = readYaml(catalogPath);
  if (raw.error) {
    issues.push({
      level: 'error',
      file: catalogPath,
      message:
        `${raw.error} — every game blueprint binds to a topic in this file. ` +
        `catalog:check is a DEV/CI-time gate and needs the whole monorepo checked out ` +
        `(coursegen/ is absent from gamegen's Railway image by design).`,
    });
    return { index: null, issues };
  }

  const parsed = courseCatalogIndexSchema.safeParse(raw.data);
  if (!parsed.success) {
    issues.push(...zodIssues(catalogPath, parsed.error.issues));
    return { index: null, issues };
  }

  const topics = new Map<string, TopicRef>();
  for (const ref of parsed.data.adventures) {
    const adventurePath = path.join(coursegenCourseDir, ref.file);
    const adventureRaw = readYaml(adventurePath);
    if (adventureRaw.error) {
      issues.push({ level: 'error', file: adventurePath, message: adventureRaw.error });
      continue;
    }
    const adventure = courseAdventureIndexSchema.safeParse(adventureRaw.data);
    if (!adventure.success) {
      issues.push(...zodIssues(adventurePath, adventure.error.issues));
      continue;
    }
    const { adventure: head, sagas } = adventure.data;
    for (const saga of sagas) {
      for (const topic of saga.topics) {
        const ref: TopicRef = {};
        if (head.age_tier !== undefined) ref.ageTier = head.age_tier;
        topics.set(`${head.slug}/${saga.slug}/${topic.slug}`, ref);
      }
    }
  }

  return { index: { topics }, issues };
}

// ---- "did you mean" suggestions ---------------------------------------------------

/** Plain Levenshtein. Every index below is in-bounds by construction (`prev` has
 *  `n + 1` entries, `curr` has `j` entries when `curr[j - 1]` is read); the `?? 0`
 *  fallbacks exist only to satisfy `noUncheckedIndexedAccess`. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      curr.push(Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost));
    }
    prev = curr;
  }
  return prev[n] ?? 0;
}

function sharedLeadingSegments(a: string, b: string): number {
  const left = a.split('/');
  const right = b.split('/');
  let shared = 0;
  while (shared < left.length && shared < right.length && left[shared] === right[shared]) shared++;
  return shared;
}

/**
 * The closest real topic paths to a path that did not resolve. Ranked by shared leading
 * segments FIRST (a typo in the topic slug of the right saga is far more likely than a
 * globally-similar string elsewhere in the course), then by edit distance.
 */
export function closestTopicPaths(target: string, candidates: Iterable<string>, limit = 3): string[] {
  const scored = Array.from(candidates, (candidate) => ({
    candidate,
    shared: sharedLeadingSegments(target, candidate),
    distance: levenshtein(target, candidate),
  }));
  scored.sort((a, b) => b.shared - a.shared || a.distance - b.distance || a.candidate.localeCompare(b.candidate));
  return scored.slice(0, limit).map((s) => s.candidate);
}

// ---- coverage-oracle thresholds ---------------------------------------------------
//
// WARNINGS, never errors — Forge's quota posture. A catalog that trips one is a design
// conversation, not a broken file.

/** Below this many blueprints, "you left a mechanic unused" is noise, not a finding. */
const MIN_BLUEPRINTS_FOR_COVERAGE_WARNING = MECHANIC_IDS.length;
/** Above this share of a course, one mechanic is the course. */
const MECHANIC_DOMINANCE_SHARE = 0.4;
const MIN_BLUEPRINTS_FOR_DOMINANCE_WARNING = 5;

// ---- the loader -------------------------------------------------------------------

export function loadGameCatalog(courseDir: string, options: LoadGameCatalogOptions = {}): GameCatalogLoadResult {
  const issues: GameCatalogIssue[] = [];
  const file = path.join(courseDir, 'games.yaml');
  const emptyCoverage = (): GameCatalogCoverage => ({
    blueprints: 0,
    mechanicCounts: Object.fromEntries(MECHANIC_IDS.map((m) => [m, 0])),
    unusedMechanics: [...MECHANIC_IDS],
    gamesPerTopic: [],
    topicsWithGames: 0,
    topicsInCourse: null,
  });

  const raw = readYaml(file);
  if (raw.error) {
    issues.push({ level: 'error', file, message: raw.error });
    return { ok: false, issues, courseDir, file, coverage: emptyCoverage() };
  }

  const parsed = gamesFileSchema.safeParse(raw.data);
  if (!parsed.success) {
    issues.push(...zodIssues(file, parsed.error.issues));
    return { ok: false, issues, courseDir, file, coverage: emptyCoverage() };
  }
  const catalog = parsed.data;

  // The declared course slug is authoritative for cross-catalog resolution, so a
  // disagreement with the directory it lives in means one of the two is a typo — and the
  // consequence is a whole course of games silently bound to the wrong curriculum.
  const dirName = path.basename(courseDir);
  if (dirName !== catalog.course) {
    issues.push({
      level: 'error',
      file,
      message: `course "${catalog.course}" does not match the containing directory "${dirName}" — one of the two is a typo`,
    });
  }

  const curriculumRoot = options.coursegenCurriculumRoot ?? DEFAULT_COURSEGEN_CURRICULUM_ROOT;
  const { index, issues: courseIssues } = loadCourseTopicIndex(path.join(curriculumRoot, catalog.course));
  issues.push(...courseIssues);

  // ---- per-blueprint: local integrity, then cross-catalog resolution ----
  const slugsByTopic = new Map<string, Set<string>>();
  const positionsByTopic = new Map<string, Set<number>>();
  const gamesPerTopic = new Map<string, number>();
  const mechanicCounts: Record<string, number> = Object.fromEntries(MECHANIC_IDS.map((m) => [m, 0]));

  for (const game of catalog.games) {
    gamesPerTopic.set(game.topic_path, (gamesPerTopic.get(game.topic_path) ?? 0) + 1);
    // `mechanic` already passed the closed-set schema check, so this key exists.
    mechanicCounts[game.mechanic] = (mechanicCounts[game.mechanic] ?? 0) + 1;

    const slugs = slugsByTopic.get(game.topic_path) ?? new Set<string>();
    if (slugs.has(game.slug)) {
      issues.push({
        level: 'error',
        file,
        message: `duplicate game slug "${game.slug}" within topic "${game.topic_path}" — games.slug is UNIQUE per topic (games table: UNIQUE (topic_id, slug))`,
      });
    }
    slugs.add(game.slug);
    slugsByTopic.set(game.topic_path, slugs);

    if (game.position !== undefined) {
      const positions = positionsByTopic.get(game.topic_path) ?? new Set<number>();
      if (positions.has(game.position)) {
        issues.push({
          level: 'error',
          file,
          message: `game "${game.slug}" reuses position ${game.position} within topic "${game.topic_path}" — the games table carries UNIQUE (topic_id, position)`,
        });
      }
      positions.add(game.position);
      positionsByTopic.set(game.topic_path, positions);
    }

    if (index) resolveTopicPath(game, index, catalog.course, file, issues);
  }

  // ---- coverage oracle (warnings only) ----
  const blueprints = catalog.games.length;
  const unusedMechanics = MECHANIC_IDS.filter((m) => (mechanicCounts[m] ?? 0) === 0);

  if (blueprints >= MIN_BLUEPRINTS_FOR_COVERAGE_WARNING && unusedMechanics.length > 0) {
    issues.push({
      level: 'warning',
      file,
      message: `${blueprints} blueprints use ${MECHANIC_IDS.length - unusedMechanics.length}/${MECHANIC_IDS.length} mechanics — unused: ${unusedMechanics.join(', ')}`,
    });
  }
  if (blueprints >= MIN_BLUEPRINTS_FOR_DOMINANCE_WARNING) {
    for (const mechanic of MECHANIC_IDS) {
      const count = mechanicCounts[mechanic] ?? 0;
      if (count / blueprints > MECHANIC_DOMINANCE_SHARE) {
        issues.push({
          level: 'warning',
          file,
          message: `mechanic "${mechanic}" is ${count}/${blueprints} of this course's games (>${Math.round(MECHANIC_DOMINANCE_SHARE * 100)}%) — variety is the point of having eight`,
        });
      }
    }
  }
  if (catalog.density !== undefined) {
    for (const [topicPath, count] of gamesPerTopic) {
      if (count !== catalog.density) {
        issues.push({
          level: 'warning',
          file,
          message: `topic "${topicPath}" carries ${count} game(s); this catalog declares density: ${catalog.density}`,
        });
      }
    }
  }

  const coverage: GameCatalogCoverage = {
    blueprints,
    mechanicCounts,
    unusedMechanics: [...unusedMechanics],
    gamesPerTopic: Array.from(gamesPerTopic, ([topicPath, count]) => ({ topicPath, count })).sort((a, b) =>
      a.topicPath.localeCompare(b.topicPath),
    ),
    topicsWithGames: gamesPerTopic.size,
    topicsInCourse: index ? index.topics.size : null,
  };

  return { ok: issues.every((i) => i.level !== 'error'), issues, courseDir, file, catalog, coverage };
}

/**
 * The critical check: does this blueprint's `topic_path` name a topic that actually
 * exists in Forge's catalog? An unresolvable path is a HARD failure — the alternative is
 * an orphan game, and `games.topic_id` is NOT NULL, so the run would die at publish after
 * every paid stage had already been billed.
 */
function resolveTopicPath(
  game: GameBlueprint,
  index: TopicIndex,
  courseSlug: string,
  file: string,
  issues: GameCatalogIssue[],
): void {
  const topic = index.topics.get(game.topic_path);
  if (!topic) {
    const suggestions = closestTopicPaths(game.topic_path, index.topics.keys());
    const hint =
      suggestions.length > 0
        ? ` — closest topics in this course: ${suggestions.map((s) => `"${s}"`).join(', ')}`
        : ' — this course declares no topics at all';
    issues.push({
      level: 'error',
      file,
      message: `game "${game.slug}" binds to topic_path "${game.topic_path}", which does not exist in coursegen/curriculum/${courseSlug}/catalog.yaml${hint}`,
    });
    return;
  }

  // Tier consistency, where knowable: Forge declares the audience band on the ADVENTURE
  // (`age_tier: tierN`). A game whose tier disagrees with the tier of the material it
  // consolidates is a design smell, not a broken file — an author may deliberately pitch
  // a consolidation game one band easier than the lesson that taught it.
  const declared = topic.ageTier;
  if (declared === undefined) return;
  const match = /^tier(\d+)$/.exec(declared);
  if (!match) return;
  const courseTier = Number(match[1]);
  if (!Number.isInteger(courseTier) || courseTier < 1 || courseTier > 3) return;
  if (courseTier !== game.tier) {
    issues.push({
      level: 'warning',
      file,
      message: `game "${game.slug}" declares tier ${game.tier} but its topic "${game.topic_path}" sits in a "${declared}" adventure`,
    });
  }
}
