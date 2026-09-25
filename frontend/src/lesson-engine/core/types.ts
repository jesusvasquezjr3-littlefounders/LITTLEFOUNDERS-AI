// Lesson Engine contract types — LESSON_ENGINE.md §3, §6, §7.
// Payload/answer shapes per type live in families/*/schema.ts (Zod-inferred).

import type { ComponentType } from 'react'
import type { CharacterAction, CharacterEmotion, CharacterId } from '@/components/characters/control/types'

export const LESSON_LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const
export type LessonLocale = (typeof LESSON_LOCALES)[number]

export const LESSON_SUBJECTS = ['money', 'math', 'science', 'economics', 'code', 'mixed'] as const
export type LessonSubject = (typeof LESSON_SUBJECTS)[number]

export interface LessonMeta {
  slug: string
  title: string
  locale: LessonLocale
  subject: LessonSubject
  estimated_minutes: number
  objectives: string[]
  cast: CharacterId[]
}

export interface LessonScoring {
  pass_threshold: number
  hint_penalty_pct: number
  max_attempts: number
  /** null = cheer mode (kid default, no fail state). Number = arcade mode. */
  hearts: number | null
}

export interface SegmentNarrator {
  character: CharacterId
  emotion?: CharacterEmotion
}

/** B.18: text_only = not narrated; differentiated = Echo narrates script_md in place of prompt_md. */
export type SegmentNarration = { mode: 'text_only' } | { mode: 'differentiated'; script_md: string }

/** Envelope shared by every segment. `payload`/`answer` are narrowed per type by the family schemas. */
export interface SegmentBase {
  id: string
  type: string
  title?: string
  /** Optional segment-level "scene anchor" illustration (Prism pipeline). */
  image_url?: string
  prompt_md: string
  difficulty: 1 | 2 | 3 | 4 | 5
  xp: number
  hints?: string[]
  explanation_md?: string
  narrator?: SegmentNarrator
  audio_segment_id?: string
  /** B.18 voice-channel choice; see schemaBase.ts. Rendering ignores it: it only changes what Echo narrates. */
  narration?: SegmentNarration
  payload: Record<string, unknown>
  /** Server-only answer key. Stripped by stripAnswers() before any production serve. */
  answer?: Record<string, unknown>
}

export interface LessonDocument {
  schema_version: 1
  meta: LessonMeta
  scoring: LessonScoring
  segments: SegmentBase[]
}

// ---- Grading boundary ----------------------------------------------------------

export type VerdictTier = 'perfect' | 'great' | 'almost' | 'tryAgain'

export interface Verdict {
  correct: boolean
  score: number
  tier: VerdictTier
  /** Per-distractor rationale or templated count feedback. MarkdownLite. */
  feedback_md?: string
  /** Correct-answer summary — present ONLY when retries are exhausted or score is 100. */
  reveal?: unknown
  allowRetry: boolean
}

export interface GradeMeta {
  attempt_number: number
  time_spent_seconds?: number
  /** Hints the kid revealed before this submission — the server applies the penalty. */
  hints_used?: number
}

/** Pluggable grading boundary. Production: Core endpoint. Dev harness: local grader. */
export interface Grader {
  grade(segmentId: string, answer: unknown, meta: GradeMeta): Promise<Verdict>
}

/** What a family's pure grader returns; verdict assembly + reveal gating happen at the boundary. */
export interface GradeOutcome {
  score: number
  feedback_md?: string
  /** Correct-answer summary; the boundary strips it until retries are exhausted or score is 100. */
  reveal?: unknown
}

/** Pure per-type validator. Malformed answers → score 0 (never throw to the UI). */
export type FamilyGrader = (segment: SegmentBase, answer: unknown) => GradeOutcome

export function tierFor(score: number, passThreshold: number): VerdictTier {
  if (score >= 100) return 'perfect'
  if (score >= passThreshold) return 'great'
  if (score >= 40) return 'almost'
  return 'tryAgain'
}

export function verdictFrom(score: number, passThreshold: number, feedback_md?: string): Verdict {
  const s = Math.max(0, Math.min(100, Math.round(score)))
  return {
    correct: s >= passThreshold,
    score: s,
    tier: tierFor(s, passThreshold),
    feedback_md,
    allowRetry: s < 100,
  }
}

// ---- Registry ---------------------------------------------------------------

export type SegmentKind = 'content' | 'input' | 'flow'

/**
 * Who a `story` family renderer is portraying RIGHT NOW, for a host that has
 * no `CharacterLayerProvider` of its own to draw it (LESSON_ENGINE.md §9.1,
 * `oracle/AGENTS.md` — the Tutor's live activity plate).
 *
 * `CharacterActor3D`/`CharacterSlot` fall back to the flat 2D rig OUTSIDE a
 * provider by design (a caller that forgets the provider still gets a working
 * character rather than an empty box) — which is correct for a surface that
 * simply forgot to mount one, and wrong for a surface that structurally has
 * nowhere honest to put one. The Tutor's activity panel is Lumen glass over a
 * persistent, already-mounted 3D island (`TutorScene`): a second character
 * canvas embedded inside that glass would either need a second WebGL context
 * (the ONE-CONTEXT invariant §6.2 of TUTOR_3D.md exists to prevent) or would
 * render blurred behind the panel's own `backdrop-filter`. Neither is a fix.
 *
 * So a story renderer that receives `onCharacterCue` does NOT render its own
 * `CharacterActor3D` at all — it fires this cue instead, and the host
 * portrays it through whatever 3D character machinery it already owns. Every
 * other consumer of `ExerciseProps` (all 50+ non-story types, and the course
 * player's `LessonPlayer`, which never passes this prop) is unaffected.
 */
export interface CharacterCue {
  character: CharacterId
  emotion: CharacterEmotion
  action: CharacterAction
  /** Bump per beat so a one-shot action (e.g. a new line) replays. */
  actionKey: number
  /** Drives the syllabic articulation heuristic, never real lip-sync — see `applySpeaking`. */
  speaking: boolean
}

export interface ExerciseProps<S extends SegmentBase = SegmentBase> {
  segment: S
  /** Controlled draft (input kind). Shape is per-type; starts undefined. */
  value: unknown
  onChange: (draft: unknown) => void
  disabled: boolean
  /** flow kind only: report the final answer exactly once. */
  onFinish?: (answer: unknown) => void
  /** content kind only: report completion (reveals done, self-mark chosen…). */
  onContentDone?: (signal?: 'got_it' | 'review') => void
  /** Last verdict for this segment, if any (renderers may highlight correct/wrong). */
  verdict?: Verdict | null
  /**
   * Present ONLY on a host with no `CharacterLayerProvider` of its own (the
   * Tutor's live activity plate). A `story` family renderer that receives this
   * MUST NOT render its own `CharacterActor3D` — see `CharacterCue`.
   */
  onCharacterCue?: (cue: CharacterCue | null) => void
}

export interface RegistryEntry {
  kind: SegmentKind
  component: ComponentType<ExerciseProps>
  /** input kind: is the draft structurally submittable? */
  canSubmit?: (draft: unknown, segment: SegmentBase) => boolean
  /** input kind: map the draft to the final answer shape when they differ. */
  buildAnswer?: (draft: unknown, segment: SegmentBase) => unknown
}

export type Registry = Record<string, RegistryEntry>
