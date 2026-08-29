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
    /**
     * A short, learner-facing framing for the activity.
     *
     * Free text that reaches a child's screen, so it is moderated in the same
     * call as `say` (orchestrator.ts). It did not used to be, while this line
     * claimed it was — a control that exists only in a comment is worse than a
     * known gap, because it stops anyone from looking.
     */
    framing: z.string().min(1).max(240),
    /**
     * Why this activity now. Not shown to the learner — it goes into the
     * segment's provenance so a later review can read the tutor's reasoning
     * instead of guessing at it.
     *
     * Not moderated, because nothing renders it. It DOES reach the tier-3
     * author prompt, so it is fenced as untrusted there (content/generate.ts)
     * exactly as a learner's words are.
     */
    rationale: z.string().min(1).max(400),
  })
  .strict();

/**
 * One step of an on-screen demonstration over the OPEN money-tray activity
 * (Tutor v3, /ORACLE.md). Closed vocabulary in the §5 sense: verbs from a
 * three-item enum, denominations as bare numbers the client validates against
 * the segment's own payload, pauses clamped. There is no free text and no
 * target outside the widget — an injection that reaches this field can add a
 * coin to a tray, and nothing else.
 */
export const DemoStepSchema = z
  .object({
    kind: z.enum(['add', 'remove', 'pause']),
    /** The denomination to add/remove; the client drops values the payload lacks. */
    denomination: z.number().positive().max(10_000).optional(),
    /** For 'pause': milliseconds, clamped client-side. */
    ms: z.number().int().min(100).max(2_000).optional(),
  })
  .strict();

/**
 * ONE STEP OF A LIVE VALUE SEQUENCE — V4's "whiteboard" (/ORACLE.md §20.5).
 *
 * A closed arithmetic vocabulary, exactly the §5 discipline `DemoStepSchema`
 * already uses: a three-item operator enum and one bounded number. There is
 * no free text and nothing to draw beyond a running quantity — an injection
 * that reaches this field can change a number on a board, and nothing else.
 */
export const WhiteboardStepSchema = z
  .object({
    op: z.enum(['add', 'subtract', 'multiply_percent']),
    /** The delta (add/subtract) or the percentage (multiply_percent). Bounded so a hostile or broken value cannot produce a nonsense board. */
    value: z.number().positive().max(100_000),
  })
  .strict();

/**
 * A LIVE VISUAL FOR A STORY THE TUTOR IS ALREADY TELLING (V4).
 *
 * `say` narrates hypothetical numbers by design (see the "invented numbers"
 * rule in prompt.ts) and nothing ever rendered them — a growth or spending
 * story was pure prose while an unrelated catalog activity sat on screen.
 * This is the fix: the SAME numbers the model just invented for its story,
 * as a small closed spec the client animates. `start`/`steps` are what the
 * model proposes; the values actually shown are recomputed server-side
 * (`whiteboard.ts`) and never taken from the model's own arithmetic —
 * exactly the `checkAnswer`/verdict philosophy already applied to spoken
 * answers, extended to what gets drawn.
 */
export const WhiteboardSchema = z
  .object({
    kind: z.literal('sequence'),
    /** The starting quantity. */
    start: z.number().min(0).max(1_000_000),
    steps: z.array(WhiteboardStepSchema).min(1).max(8),
    /**
     * A short caption above the board — "Cada día la caja te da más" — not the
     * numbers themselves (the board draws those). Free text, so it joins `say`
     * and `segmentRequest.framing` in the same moderation call (orchestrator.ts).
     */
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

export const TutorTurnSchema = z
  .object({
    /**
     * What the character says out loud.
     *
     * The main free-text channel, and the only one on a turn with no activity.
     * `segmentRequest.framing` is the other one; both are moderated, and any
     * NEW free-text field added here must join them in that call before it
     * ships. Everything else on this turn is a closed enum or a number.
     */
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
    /**
     * "Mira, si agrego esta moneda…" — the tutor MOVES the open manipulative
     * while speaking (Tutor v3). Valid only while an activity is on screen;
     * the client runs the steps against the live tray and aborts them on an
     * interrupt, exactly like speech.
     */
    demonstrate: z.array(DemoStepSchema).min(1).max(8).nullable().optional(),
    /**
     * V4: a live sequence board synced to this turn's story. See
     * `WhiteboardSchema`. Never both this AND a segment request in the same
     * turn — a board and a graded activity competing for the plate in one
     * turn is exactly the disconnected-surfaces bug this exists to close.
     */
    whiteboard: WhiteboardSchema.nullable().optional(),
  })
  .strict()
  .refine((turn) => turn.next !== 'segment' || turn.segmentRequest != null, {
    message: 'next="segment" requires a segmentRequest',
    path: ['segmentRequest'],
  })
  .refine((turn) => turn.demonstrate == null || turn.next !== 'segment', {
    message: 'demonstrate applies to the OPEN activity — not to one being requested',
    path: ['demonstrate'],
  })
  .refine((turn) => turn.whiteboard == null || turn.segmentRequest == null, {
    message: 'whiteboard and segmentRequest may not both be set on the same turn',
    path: ['whiteboard'],
  });

export type TutorTurn = z.infer<typeof TutorTurnSchema>;
export type SegmentRequest = z.infer<typeof SegmentRequestSchema>;
export type DemoStep = z.infer<typeof DemoStepSchema>;
export type WhiteboardStep = z.infer<typeof WhiteboardStepSchema>;
export type Whiteboard = z.infer<typeof WhiteboardSchema>;

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

  /*
   * A GESTURE IS NOT WORTH A LESSON.
   *
   * `emotion` and `action` are closed vocabularies because the client animates
   * them, and a value outside the list would animate nothing. But discarding
   * the WHOLE turn for one is absurd: on 2026-08-29 a model chose an action
   * outside the enum twice in a row, both attempts were thrown away, and a
   * child got "Se me enredaron las ideas" instead of a lesson — because the
   * character would have waved instead of nodded.
   *
   * So these two, and ONLY these two, are coerced to a safe default before
   * validation. Everything else stays strict, which is the point of the
   * schema: `say` is what the child hears, `next` and `segmentRequest` drive
   * what happens, and a wrong value in any of them is a real defect. A wrong
   * gesture is a neutral face.
   */
  if (typeof value === 'object' && value !== null) {
    const shaped = value as Record<string, unknown>;
    if (typeof shaped.emotion === 'string' && !EMOTIONS.includes(shaped.emotion as never)) {
      shaped.emotion = 'neutral';
    }
    if (typeof shaped.action === 'string' && !ACTIONS.includes(shaped.action as never)) {
      shaped.action = 'idle';
    }
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
