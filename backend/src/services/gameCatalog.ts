import type { CourseTree } from './courseTree.js';
import type { GameProgressRow, GameRow } from './gameData.js';

/*
 * Pure assembly of the /api/v1/games hub — published games grouped
 * course → adventure → topic, each with the caller's own progress and its
 * server-computed `state`. No I/O here (routes/games.ts fetches the rows), so
 * the gating rule is unit-testable with plain fixtures.
 *
 * THE GATE (GAME_ENGINE.md §8): a game is `locked` until the topic it hangs off
 * has at least ONE lesson this user has PASSED. Games consolidate a concept, they
 * do not teach it — a child who has not met the concept would be guessing at an
 * arcade loop, which is the opposite of the pedagogy.
 *
 * "Passed" is read off the already-assembled course tree, never recomputed: the
 * tree comes from `assembleCourseTree`/`computeLessonStates`, which is Core's
 * single source of truth for unlock state. A second implementation of "has this
 * child passed a lesson" is the v1 failure the platform already paid for once.
 */

type Json = Record<string, unknown>;

/** `locked` → the concept has not been learned yet; `ready` → unlocked, never
 *  finished a run; `played` → at least one recorded attempt. */
export type GameState = 'locked' | 'ready' | 'played';

export interface CatalogGame {
  id: string;
  slug: string;
  title: Json;
  mechanic: string;
  tier: number;
  xp_max: number;
  estimated_minutes: number;
  position: number;
  state: GameState;
  best_score: number;
  plays: number;
  passed: boolean;
  xp_earned: number;
  last_played_at: string | null;
}

export interface CatalogTopic {
  id: string;
  slug: string;
  title: Json;
  position: number;
  /** Whether the concept gate is open — the reason every game below is/isn't locked. */
  unlocked: boolean;
  games: CatalogGame[];
}

export interface CatalogAdventure {
  id: string;
  slug: string;
  title: Json;
  theme: string;
  position: number;
  topics: CatalogTopic[];
}

export interface CatalogCourse {
  id: string;
  slug: string;
  title: Json;
  subject: string;
  adventures: CatalogAdventure[];
}

/** Every topic in the tree with >= 1 PASSED lesson — the concept gate. */
export function unlockedTopicIds(tree: CourseTree): Set<string> {
  const unlocked = new Set<string>();
  for (const adventure of tree.adventures) {
    for (const saga of adventure.sagas) {
      for (const topic of saga.topics) {
        if (topic.lessons.some((lesson) => lesson.state === 'passed')) unlocked.add(topic.id);
      }
    }
  }
  return unlocked;
}

/** The per-game state, from the gate and the caller's own progress row. */
export function gameStateFor(topicUnlocked: boolean, progress: GameProgressRow | undefined): GameState {
  if (!topicUnlocked) return 'locked';
  return progress !== undefined && progress.plays > 0 ? 'played' : 'ready';
}

const ZERO_PROGRESS = { best_score: 0, plays: 0, passed: false, xp_earned: 0, last_played_at: null } as const;

/**
 * Group published games under the courses/adventures/topics the caller can see.
 *
 * Branches with no games are PRUNED: the hub is a games surface, and a course
 * tree carrying dozens of empty topics would make the client filter server-owned
 * structure back out again.
 */
export function groupGameCatalog(
  trees: readonly CourseTree[],
  games: readonly GameRow[],
  progressRows: readonly GameProgressRow[],
): CatalogCourse[] {
  const gamesByTopic = new Map<string, GameRow[]>();
  for (const game of games) {
    const bucket = gamesByTopic.get(game.topic_id);
    if (bucket) bucket.push(game);
    else gamesByTopic.set(game.topic_id, [game]);
  }
  const progressByGame = new Map(progressRows.map((p) => [p.game_id, p]));

  const courses: CatalogCourse[] = [];
  for (const tree of trees) {
    const unlocked = unlockedTopicIds(tree);
    const adventures: CatalogAdventure[] = [];

    for (const adventure of tree.adventures) {
      const topics: CatalogTopic[] = [];
      for (const saga of adventure.sagas) {
        for (const topic of saga.topics) {
          const topicGames = gamesByTopic.get(topic.id);
          if (topicGames === undefined || topicGames.length === 0) continue;
          const topicUnlocked = unlocked.has(topic.id);
          topics.push({
            id: topic.id,
            slug: topic.slug,
            title: topic.title,
            position: topic.position,
            unlocked: topicUnlocked,
            games: [...topicGames]
              .sort((a, b) => a.position - b.position)
              .map((game) => {
                const progress = progressByGame.get(game.id);
                const stats = progress ?? ZERO_PROGRESS;
                return {
                  id: game.id,
                  slug: game.slug,
                  title: game.title,
                  mechanic: game.mechanic,
                  tier: game.tier,
                  xp_max: game.xp_max,
                  estimated_minutes: game.estimated_minutes,
                  position: game.position,
                  state: gameStateFor(topicUnlocked, progress),
                  best_score: stats.best_score,
                  plays: stats.plays,
                  passed: stats.passed,
                  xp_earned: stats.xp_earned,
                  last_played_at: stats.last_played_at,
                };
              }),
          });
        }
      }
      if (topics.length === 0) continue;
      adventures.push({
        id: adventure.id,
        slug: adventure.slug,
        title: adventure.title,
        theme: adventure.theme,
        position: adventure.position,
        topics,
      });
    }

    if (adventures.length === 0) continue;
    courses.push({
      id: tree.course.id,
      slug: tree.course.slug,
      title: tree.course.title,
      subject: tree.course.subject,
      adventures,
    });
  }
  return courses;
}
