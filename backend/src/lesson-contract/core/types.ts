// Lesson Engine contract types — TRIMMED, SERVER-SIDE COPY.
//
// Source of truth: frontend/src/lesson-engine/core/types.ts (LESSON_ENGINE.md
// §3, §6, §7). This file exists because the platform has NO shared-package
// workspace (/AGENTS.md §1.2 — "8 independent npm packages, no workspaces"):
// Core needs the same grading contract the frontend engine and dev harness
// use, so the pure (non-React) parts are copied here instead of re-derived.
//
// PARITY CONTRACT: `VerdictTier`, `Verdict`, `GradeMeta`, `Grader`,
// `GradeOutcome`, `FamilyGrader`, `tierFor` and `verdictFrom` must stay
// byte-for-byte identical (modulo import lines/whitespace) to the frontend
// original — enforced by `npm run contract:check`
// (backend/scripts/contract-check.ts). Never hand-edit those symbols here
// without mirroring the edit in frontend/src/lesson-engine/core/types.ts in
// the SAME commit.
//
// Everything else below is DELIBERATELY NOT part of the parity contract: the
// frontend original couples `SegmentBase.narrator` to `CharacterId`/
// `CharacterEmotion` (from frontend/src/components/characters/control/types,
// a React-adjacent module) and also carries a `ComponentType`-based
// Registry/ExerciseProps section Core has no use for (grading never renders
// anything). Those are trimmed / loosely re-typed here on purpose.

export const LESSON_LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const
export type LessonLocale = (typeof LESSON_LOCALES)[number]

/** Loosely typed vs. the frontend's CharacterId/CharacterEmotion — graders never read this field. */
export interface SegmentNarrator {
  character: string
  emotion?: string
}

/** Envelope shared by every segment. `payload`/`answer` stay opaque records server-side — the per-type shape lives in the frontend family schemas only. */
export interface SegmentBase {
  id: string
  type: string
  title?: string
  prompt_md: string
  difficulty: 1 | 2 | 3 | 4 | 5
  xp: number
  hints?: string[]
  explanation_md?: string
  narrator?: SegmentNarrator
  audio_segment_id?: string
  payload: Record<string, unknown>
  /** Server-only answer key. NEVER present on a document served to a client. */
  answer?: Record<string, unknown>
}

export interface LessonScoring {
  pass_threshold: number
  hint_penalty_pct: number
  max_attempts: number
  /** null = cheer mode (kid default, no fail state). Number = arcade mode. */
  hearts: number | null
}

export interface LessonDocument {
  schema_version: 1
  segments: SegmentBase[]
  scoring: LessonScoring
}

// ---- Grading boundary (PARITY CONTRACT — see file header) --------------------

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
