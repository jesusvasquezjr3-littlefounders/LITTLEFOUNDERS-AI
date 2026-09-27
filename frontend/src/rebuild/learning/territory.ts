import { z } from 'zod';
import { call, courseRefusal, type CourseState } from './course';
import type { LearnTransport } from './learnHome';

/*
 * W2L.2 (L3): the course world, as GET /learn/courses/:slug/tree serves it.
 *
 * One read for both course engines (Core answers the tree under either; under
 * the B.6 pathway engine each chapter also carries `pathwayAccess`), refused
 * exactly as the course screen's entry is refused (the age safeguard, B.2, an
 * unknown course, a lost connection). Everything on the map is what Core
 * computed: topic states come from graded passes and the spaced-review layer
 * (`review-due`, 0016), lesson states and chapter locks from the unlock rules
 * or the pathway frontier. Nothing here re-derives a lock, and no age reaches
 * the client.
 */

const localized = z.record(z.string(), z.unknown());
const progress = z.object({ passed: z.number().int().nonnegative(), total: z.number().int().nonnegative(), pct: z.number().min(0).max(100) });

const lessonSchema = z.object({ id: z.string().min(1), state: z.enum(['locked', 'available', 'current', 'passed']) });
const topicSchema = z.object({
  id: z.string().min(1), slug: z.string(), title: localized, kind: z.string().optional(),
  state: z.enum(['not-started', 'in-progress', 'completed', 'review-due']), lessons: z.array(lessonSchema),
});
const sagaSchema = z.object({ id: z.string().min(1), slug: z.string(), title: localized, topics: z.array(topicSchema) });
const adventureSchema = z.object({
  id: z.string().min(1), slug: z.string(), title: localized, theme: z.string(),
  state: z.enum(['locked', 'available', 'completed']), progress, sagas: z.array(sagaSchema),
  /** B.6 pathway engine only: the learner's own path, an extra (younger) chapter, or one the age safeguard closes (OD-16). */
  pathwayAccess: z.enum(['pathway', 'optional', 'closed']).optional(),
});

export const territorySchema = z.object({
  course: z.object({ id: z.string().min(1), slug: z.string().min(1), title: localized, inProgress: z.boolean().optional(), progress, placementRequired: z.boolean() }),
  adventures: z.array(adventureSchema),
  nextLessonId: z.string().nullable(),
});
export type Territory = z.infer<typeof territorySchema>;
export type TerritoryWorld = z.infer<typeof adventureSchema>;
export type TerritoryTopic = z.infer<typeof topicSchema>;

export function parseTerritory(raw: unknown): Territory | null {
  const parsed = territorySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type TerritoryState = Exclude<CourseState, { status: 'ready' }> | { status: 'ready'; map: Territory };

export async function fetchTerritory(slug: string, request: LearnTransport): Promise<TerritoryState> {
  const reply = await call(request, `/learn/courses/${encodeURIComponent(slug)}/tree`);
  if (reply.error) return courseRefusal(reply.error);
  const map = parseTerritory(reply.data);
  // A malformed tree is unavailable, never partly drawn.
  return map ? { status: 'ready', map } : { status: 'error' };
}

/*
 * The six scene themes a chapter can declare (database/migrations/0007:
 * `adventures.theme` is a closed CHECK list). Each has its own scene art in
 * the manifest (`scene.<theme>.art`, 07 §3); an unknown theme draws no scene
 * rather than a stand-in.
 */
export const SCENE_THEMES = ['archipelago', 'forest', 'city', 'valley', 'kingdom', 'cosmos'] as const;
export type SceneTheme = (typeof SCENE_THEMES)[number];

export function sceneAssetId(theme: string): string | null {
  return (SCENE_THEMES as readonly string[]).includes(theme) ? `scene.${theme}.art` : null;
}

/** How the map shows one chapter: open to explore, an extra, done, not reached yet, or closed by age (never listed). */
export type WorldAccess = 'open' | 'extra' | 'later' | 'closed';

export function worldAccess(world: TerritoryWorld): WorldAccess {
  if (world.pathwayAccess === 'closed') return 'closed';
  if (world.state === 'locked') return 'later';
  return world.pathwayAccess === 'optional' ? 'extra' : 'open';
}

/** The chapter that holds the next lesson Core chose, else the first open chapter with work left. */
export function currentWorldId(map: Territory): string | null {
  if (map.nextLessonId) {
    const holder = map.adventures.find((world) => world.sagas.some((saga) => saga.topics.some((topic) => topic.lessons.some((lesson) => lesson.id === map.nextLessonId))));
    if (holder && worldAccess(holder) !== 'closed') return holder.id;
  }
  return map.adventures.find((world) => worldAccess(world) === 'open' && world.state !== 'completed')?.id ?? null;
}

/**
 * The lesson a topic opens: the next one, else one open now, else the first
 * passed (a review). Null when every lesson is still closed, or when the
 * placement is owed (Core refuses every lesson until it is taken).
 */
export function topicLesson(topic: TerritoryTopic, placementRequired: boolean): string | null {
  if (placementRequired) return null;
  return (topic.lessons.find((lesson) => lesson.state === 'current') ?? topic.lessons.find((lesson) => lesson.state === 'available')
    ?? topic.lessons.find((lesson) => lesson.state === 'passed'))?.id ?? null;
}

export function reviewsDue(map: Territory): number {
  return map.adventures.filter((world) => worldAccess(world) !== 'closed')
    .reduce((sum, world) => sum + world.sagas.reduce((inner, saga) => inner + saga.topics.filter((topic) => topic.state === 'review-due').length, 0), 0);
}
