/*
 * Structural copy of the CLIENT-SAFE LessonDocument contract — LESSON_ENGINE.md
 * §3, §5.1, §12. Per the "no workspaces" convention (§3: "Core imports this
 * contract [as a] copy, validated by tests — no workspaces"), Echo keeps its
 * own narrow mirror instead of importing frontend/src/lesson-engine directly.
 *
 * Echo never receives answer keys — this mirror intentionally omits `answer`.
 * Only the shapes Echo actually reads (envelope + the 5 `story` family
 * payloads, per §12) are modeled; other families' payloads are read as opaque
 * `Record<string, unknown>` since Echo never narrates into them beyond the
 * shared envelope fields (`prompt_md`, `explanation_md`).
 */

export type LessonLocale = 'en-US' | 'es-MX' | 'pt-BR';

export interface StoryDialogueLine {
  character: string;
  emotion?: string;
  action?: string;
  text_md: string;
}

export interface StoryDialoguePayload {
  lines: StoryDialogueLine[];
}

export interface StoryScenePayload {
  backdrop: 'band' | 'inverse' | 'base';
  character?: string;
  emotion?: string;
  action?: string;
  body_md: string;
  art?: { icon: string; tint: string };
}

export interface KeyIdea {
  icon: string;
  title: string;
  body_md: string;
}

export interface KeyIdeasPayload {
  ideas: KeyIdea[];
}

export interface ConceptCard {
  front_md: string;
  back_md: string;
  icon?: string;
}

export interface ConceptRevealPayload {
  cards: ConceptCard[];
}

export interface EavesdropPayload {
  context_md?: string;
  lines?: { character?: string; text_md?: string; notes?: string[] }[];
}

export interface CheckpointPayload {
  recap_md: string;
  mood_prompt_md?: string;
}

/** Envelope shared by every segment (LESSON_ENGINE.md §3). `answer` deliberately absent. */
export interface LessonSegment {
  id: string;
  type: string;
  title?: string;
  prompt_md: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  xp: number;
  hints?: string[];
  explanation_md?: string;
  narrator?: { character: string; emotion?: string };
  audio_segment_id?: string;
  /**
   * B.18 (Mayer's redundancy principle) voice-channel choice, mirrored from the
   * Forge contract (coursegen/src/contract/core/schemaBase.ts). text_only: this
   * segment produces no narration. differentiated: the prompt clip reads
   * script_md, never the on-screen prompt_md.
   */
  narration?: { mode: 'text_only' } | { mode: 'differentiated'; script_md: string };
  payload: Record<string, unknown>;
}

export interface LessonDocument {
  schema_version: 1;
  meta: {
    slug: string;
    title: string;
    locale: LessonLocale;
    subject: string;
    estimated_minutes: number;
    objectives: string[];
    cast: string[];
  };
  scoring: {
    pass_threshold: number;
    hint_penalty_pct: number;
    max_attempts: number;
    hearts: number | null;
  };
  segments: LessonSegment[];
}
