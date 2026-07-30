import { api } from '@/lib/api';
import type { ApiResult } from '@/lib/api';
import type { ServerGameResult } from '@/game-engine/player/GamePlayer';
import type { GameInputEvent } from '@/game-engine/core/types';

/*
 * Wire layer for the games surface — GAME_ENGINE.md §8 (`/api/v1/games`).
 *
 * Local mirror of Core's response shapes, exactly like
 * `routes/app/learn/types.ts` mirrors the course tree: there is no shared-type
 * package between services (/AGENTS.md §1.2 — independent npm packages, no
 * workspaces), so the frontend re-declares the wire shape and every call still
 * goes through `lib/api.ts` so the §1.6 envelope is unwrapped in exactly one
 * place.
 *
 * The type-only import of `ServerGameResult` is erased at compile time, so the
 * hub — which imports this module — never pulls the player (or any mechanic
 * chunk) into its bundle.
 */

export type Json = Record<string, unknown>;

/** `locked` = the concept has not been learned yet · `ready` = unlocked, never
 *  finished · `played` = at least one recorded attempt. Server-computed (§8):
 *  the client never re-derives lock state. */
export type GameCatalogState = 'locked' | 'ready' | 'played';

export interface CatalogGame {
  id: string;
  slug: string;
  title: Json;
  mechanic: string;
  tier: number;
  xp_max: number;
  estimated_minutes: number;
  position: number;
  state: GameCatalogState;
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

export interface GameCatalogResponse {
  courses: CatalogCourse[];
}

export interface GameSummary {
  id: string;
  slug: string;
  title: Json;
  mechanic: string;
  tier: number;
  xp_max: number;
  estimated_minutes: number;
  position: number;
  topic_id: string;
  best_score: number;
  plays: number;
  passed: boolean;
  xp_earned: number;
}

export interface GameDetailResponse {
  game: GameSummary;
  locale: string;
  /** Raw on purpose: it is validated by `parseGameDocument`, never trusted as a
   *  `GameDocument` because the server said so. */
  document: unknown;
}

/** Body of `POST /:gameId/complete`. Deliberately carries NO score — Core replays
 *  `input_log` under `seed` and derives one (§6). */
export interface GameRunPayload {
  run_id: string;
  seed: number;
  input_log: GameInputEvent[];
  duration_seconds: number;
  local_date: string;
}

export interface GameCompletionResponse {
  /** THIS run, server-derived. */
  score: number;
  passed: boolean;
  stats: Record<string, number>;
  /** All-time figures after this run. */
  best_score: number;
  plays: number;
  xp_earned: number;
  /** XP actually GRANTED by this run (XP is a high-water mark, so a run that does
   *  not beat the previous best grants zero). */
  xp_delta: number;
  streak_days: number;
  longest_streak: number;
  streak_extended: boolean;
  first_today: boolean;
  minutes_delta: number;
  minutes_learned: number;
}

export function fetchGameCatalog(token: string | null): Promise<ApiResult<GameCatalogResponse>> {
  return api<GameCatalogResponse>('/games', { token });
}

export function fetchGame(gameId: string, token: string | null): Promise<ApiResult<GameDetailResponse>> {
  return api<GameDetailResponse>(`/games/${gameId}`, { token });
}

export function submitGameRun(
  gameId: string,
  token: string | null,
  payload: GameRunPayload,
): Promise<ApiResult<GameCompletionResponse>> {
  return api<GameCompletionResponse>(`/games/${gameId}/complete`, { method: 'POST', token, body: payload });
}

/**
 * The learner's LOCAL calendar day — the streak anchor (a kid's day follows their
 * wall clock, not the server's UTC). Built arithmetically rather than through
 * `toLocaleDateString('sv')`, which falls back to M/D/YYYY on some browsers —
 * the same construction `routes/app/learn/LessonRoute.tsx` uses.
 */
export function localCalendarDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Resolve a game by SLUG out of the catalog — the deep-link path for
 * `/games/:slug` when the hub's navigation state is absent (a refresh, a pasted
 * link, a bookmark).
 *
 * NOTE the ambiguity this inherits: `games` is `UNIQUE (topic_id, slug)`, not
 * globally unique (migration 0027), so two topics may legitimately carry the same
 * game slug. The first match in curriculum order wins, deterministically. The hub
 * always passes the id in navigation state, so this only decides which of two
 * same-slug games a bare deep link opens.
 */
export function findCatalogGameBySlug(
  courses: readonly CatalogCourse[],
  slug: string,
): { game: CatalogGame; topic: CatalogTopic; course: CatalogCourse } | null {
  for (const course of courses) {
    for (const adventure of course.adventures) {
      for (const topic of adventure.topics) {
        for (const game of topic.games) {
          if (game.slug === slug) return { game, topic, course };
        }
      }
    }
  }
  return null;
}

/**
 * Core's completion response → the player's authoritative-result shape.
 *
 * `xp_earned` maps from `xp_delta`, NOT from the response's own `xp_earned`: the
 * results screen labels the figure "XP earned" and the honest answer for THIS run
 * is what the run actually granted. XP for a game is a high-water mark, so a
 * repeat run that does not beat the previous best grants nothing, and printing the
 * all-time total there would claim a reward that was not given.
 *
 * `new_best` is INFERRED, because Core does not report it: a strict improvement is
 * the only way `xp_delta` can be positive, and the first recorded play is a new
 * best by definition. It under-claims in the rounding edge case where a better
 * score maps to the same XP — under-claiming a celebration is the safe direction.
 */
export function toServerGameResult(response: GameCompletionResponse): ServerGameResult {
  const tiedOrBeatBest = response.score >= response.best_score;
  const improved = response.plays <= 1 ? response.score > 0 : response.xp_delta > 0;
  return {
    score: response.score,
    passed: response.passed,
    xp_earned: response.xp_delta,
    best_score: response.best_score,
    new_best: tiedOrBeatBest && improved,
  };
}
