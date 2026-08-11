// Local mirror of Core's /learn/courses/:slug/tree response shape
// (backend/src/services/courseTree.ts — COURSE_ENGINE.md §2). No shared-type
// package exists between services (/AGENTS.md §1.2: 8 independent npm
// packages, no workspaces), so the frontend re-declares the wire shape here.

export type Json = Record<string, unknown>

export type LessonState = 'locked' | 'available' | 'current' | 'passed'
export type AdventureState = 'locked' | 'available' | 'completed'

export interface ProgressShape {
  passed: number
  total: number
  pct: number
}

export interface LessonNode {
  id: string
  slug: string
  title: Json
  position: number
  difficulty: number
  xp_total: number
  estimated_minutes: number
  state: LessonState
  bestScore: number
  /** Placed past this lesson by the course's placement quiz (0043) — counts toward the badge/progress bar, but never a real play-through. */
  placementCredited: boolean
}

/** Territory-map state per topic — server-derived (courseTree.ts, 0016), never self-reported. */
export type TopicState = 'not-started' | 'in-progress' | 'completed' | 'review-due'

export interface TopicNode {
  id: string
  slug: string
  title: Json
  position: number
  kind: string
  reviewOf: string[]
  state: TopicState
  lessons: LessonNode[]
}

export interface SagaNode {
  id: string
  slug: string
  title: Json
  icon: string
  position: number
  progress: ProgressShape
  topics: TopicNode[]
}

export interface AdventureNode {
  id: string
  slug: string
  title: Json
  description: Json
  theme: string
  position: number
  state: AdventureState
  progress: ProgressShape
  sagas: SagaNode[]
}

export interface CourseTree {
  course: {
    id: string
    slug: string
    title: Json
    description: Json
    subject: string
    badgeAsset?: string | null
    progress: ProgressShape
    /** True until this user has completed this course's placement quiz (0043) — the client-side redirect is UX only, the real gate is server-side (learn.ts's PLACEMENT_REQUIRED 403). */
    placementRequired: boolean
  }
  adventures: AdventureNode[]
  nextLessonId: string | null
}

/** Resolve a locale-keyed jsonb title/description field, falling back to en-US then any value then a plain string. */
export function localizedText(value: Json | null | undefined, locale: string, fallback = ''): string {
  if (!value) return fallback
  const direct = value[locale]
  if (typeof direct === 'string') return direct
  const en = value['en-US']
  if (typeof en === 'string') return en
  const first = Object.values(value).find((v): v is string => typeof v === 'string')
  return first ?? fallback
}

/** Which adventure (by id) a lesson belongs to — used to auto-open the accordion around nextLessonId. */
export function findAdventureForLesson(tree: CourseTree, lessonId: string): string | null {
  for (const adventure of tree.adventures) {
    for (const saga of adventure.sagas) {
      for (const topic of saga.topics) {
        if (topic.lessons.some((l) => l.id === lessonId)) return adventure.id
      }
    }
  }
  return null
}

/** Find a lesson in the server-derived course tree without creating a second data source. */
export function findLesson(tree: CourseTree, lessonId: string | null): LessonNode | null {
  if (!lessonId) return null
  for (const adventure of tree.adventures) {
    for (const saga of adventure.sagas) {
      for (const topic of saga.topics) {
        const lesson = topic.lessons.find((candidate) => candidate.id === lessonId)
        if (lesson) return lesson
      }
    }
  }
  return null
}
