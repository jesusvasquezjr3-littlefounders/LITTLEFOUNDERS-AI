import { z } from 'zod';

/*
 * Layer 1 of the injection stack, and the one that does the most work
 * (/ORACLE.md §5): the model never emits prose that is rendered as given. It
 * emits a JSON object against this schema, and invalid JSON is a DISCARDED
 * turn, not a displayed one.
 *
 * This is what removes most of the injection surface. An injection can still
 * succeed in persuading the model — and then has nowhere to put the result,
 * because the only channel out is `say` (which is moderated), a member of a
 * seven-item emotion enum, a member of a twelve-item action enum, and a
 * three-item control decision. There is no field in which to return a link, a
 * script, an instruction to the client, or an exfiltrated context.
 *
 * The emotion and action vocabularies are the SAME closed sets the 2D rig and
 * the 3D stage already speak (frontend `components/characters/control/types.ts`,
 * /TUTOR_3D.md §4), so a valid turn drives the cast with no translation layer
 * and an invalid one cannot reach the renderer at all.
 */

export const EMOTIONS = [
  'neutral',
  'happy',
  'excited',
  'thinking',
  'surprised',
  'encouraging',
  'proud',
] as const;

export const ACTIONS = [
  'idle',
  'jump',
  'hop',
  'wave',
  'point',
  'celebrate',
  'nod',
  'shake',
  'think',
  'dance',
  'peek',
  'bow',
] as const;

/**
 * What the tutor wants to happen after speaking.
 *
 * `ask` keeps the conversation going, `segment` hands the right-hand panel a
 * lesson activity, `close` ends the session. There is deliberately no
 * `redirect`, `fetch`, `remember` or `escalate`: the model has no tools with
 * side effects (§5 layer 3), so it has no verbs for them either.
 */
export const NEXT_STEPS = ['ask', 'segment', 'close'] as const;

/**
 * A request for an activity, by MEANING rather than by content.
 *
 * The model says "I want to practise this skill at about this difficulty"; it
 * never authors the activity here. Authoring goes through the content ladder
 * (/ORACLE.md §7), where tier 1 serves a human-published segment and tier 3
 * runs the full gate-and-judge pipeline. Letting the model inline an exercise
 * in its turn would route around every guard in §7.3.
 */
export const SegmentRequestSchema = z
  .object({
    skillKey: z.string().min(1).max(128),
    /** 1-5, matching the Lesson Engine's own difficulty scale. */
    difficulty: z.number().int().min(1).max(5),
    /** A short, learner-facing framing for the activity. Moderated like `say`. */
    framing: z.string().min(1).max(240),
    /**
     * Why this activity now. Not shown to the learner — it goes into the
     * segment's provenance so a later review can read the tutor's reasoning
     * instead of guessing at it.
     */
    rationale: z.string().min(1).max(400),
  })
  .strict();

export const TutorTurnSchema = z
  .object({
    /** What the character says out loud. The ONLY free-text channel. */
    say: z.string().min(1).max(700),
    emotion: z.enum(EMOTIONS),
    action: z.enum(ACTIONS),
    next: z.enum(NEXT_STEPS),
    segmentRequest: SegmentRequestSchema.nullable().optional(),
    /**
     * Set when the tutor is offering to adapt (/ORACLE.md §11). The client
     * renders an accept/decline affordance; the tutor never applies it itself.
     */
    offerAdaptation: z
      .enum(['slower_pacing', 'more_examples', 'less_text', 'more_visual', 'repeat_before_advancing'])
      .nullable()
      .optional(),
  })
  .strict()
  .refine((turn) => turn.next !== 'segment' || turn.segmentRequest != null, {
    message: 'next="segment" requires a segmentRequest',
    path: ['segmentRequest'],
  });

export type TutorTurn = z.infer<typeof TutorTurnSchema>;
export type SegmentRequest = z.infer<typeof SegmentRequestSchema>;

export type TurnParse =
  | { ok: true; turn: TutorTurn }
  | { ok: false; reason: 'no_json' | 'invalid_shape'; detail: string };

/**
 * Parses a model completion into a turn.
 *
 * Tolerant about WRAPPING (models fence JSON in markdown, or preface it with
 * "Sure!"), strict about SHAPE. Those are different kinds of forgiveness: the
 * first costs nothing, the second is the whole defence.
 */
export function parseTurn(raw: string): TurnParse {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const candidate = fenced?.[1] ?? raw;
  const braced = /\{[\s\S]*\}/.exec(candidate);
  if (!braced) return { ok: false, reason: 'no_json', detail: 'no JSON object in completion' };

  let value: unknown;
  try {
    value = JSON.parse(braced[0]);
  } catch (error) {
    return {
      ok: false,
      reason: 'no_json',
      detail: error instanceof Error ? error.message : 'JSON.parse failed',
    };
  }

  const parsed = TutorTurnSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_shape',
      detail: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
    };
  }
  return { ok: true, turn: parsed.data };
}
