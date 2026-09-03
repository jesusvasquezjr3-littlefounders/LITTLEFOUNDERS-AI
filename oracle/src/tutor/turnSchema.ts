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
    /**
     * ROADMAP.md V4 sprint 2 backlog: a hint so the ladder can prefer a
     * VISUAL catalog segment over its own frontier fallback (Core's
     * last-resort "what should this learner do next", which can be
     * completely unrelated to the story the tutor just told). Best-effort
     * on Core's side: a skill with no matching segment of either type
     * still gets served from whatever the ladder would have picked anyway.
     *
     * DELIBERATELY LOOSE HERE — `sanitizePreferredTypes` (below) is where
     * the real closed vocabulary lives. Measured live: enforcing it AT
     * THIS SCHEMA, as a `z.enum`, cost a whole turn once already —
     * `preferredTypes.0: Invalid option` failed shape validation on BOTH
     * the first attempt and the retry, and the child got the scripted "se
     * me enredaron las ideas" line instead of a real reply to what they
     * said, over one optional hint field the rest of the turn had nothing
     * to do with. A hint that turns out malformed should degrade to no
     * hint, the same fail-open posture `computeSequence` already gives a
     * whiteboard whose arithmetic does not check out — never take an
     * otherwise-good turn down with it.
     */
    preferredTypes: z.array(z.string()).max(4).nullable().optional(),
  })
  .strict();

/** The only two values `preferredTypes` may ever actually carry past this file. */
export const PREFERRED_SEGMENT_TYPES = ['interest_peek', 'number_line'] as const;

/**
 * Filters a model-supplied `preferredTypes` down to the closed vocabulary,
 * silently — an invalid guess degrades to "no preference", never to a lost
 * turn. Call this on every parsed turn before `preferredTypes` is used or
 * forwarded to Core, which still enforces the closed enum itself and would
 * otherwise reject the whole `/segments` request over one bad entry.
 */
export function sanitizePreferredTypes(
  values: readonly string[] | null | undefined,
): (typeof PREFERRED_SEGMENT_TYPES)[number][] | null {
  if (!values || values.length === 0) return null;
  const kept = values.filter(
    (v): v is (typeof PREFERRED_SEGMENT_TYPES)[number] =>
      (PREFERRED_SEGMENT_TYPES as readonly string[]).includes(v),
  );
  return kept.length > 0 ? kept.slice(0, 2) : null;
}

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
 *
 * THIS IS `kind: 'sequence'` — one of three board shapes `WhiteboardSchema`
 * (below) now accepts. Kept as its own named schema, rather than inlined
 * into the union, because it is the proven reference implementation
 * (/ORACLE.md §20.5) the other two follow: nothing about ITS shape changed
 * to make room for them.
 */
export const WhiteboardSequenceSchema = z
  .object({
    kind: z.literal('sequence'),
    /** The starting quantity. */
    start: z.number().min(0).max(1_000_000),
    steps: z.array(WhiteboardStepSchema).min(1).max(8),
    /**
     * What ONE step represents in time — "cada día" vs. "cada semana" vs.
     * "cada mes" vs. "cada año". Added after a real session showed the exact
     * defect this closes: the story said "cada semana" three times and the
     * board, hard-coded to "Día 1/2/3", drew days — a visual that
     * CONTRADICTED its own narration instead of matching it, on the feature
     * whose entire purpose is that match.
     */
    unit: z.enum(['day', 'week', 'month', 'year']),
    /**
     * A short caption above the board — "Cada día la caja te da más" — not the
     * numbers themselves (the board draws those). Free text, so it joins `say`
     * and `segmentRequest.framing` in the same moderation call (orchestrator.ts).
     */
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/**
 * ONE SIDE OF A TWO-QUANTITY COMPARISON (V4, /ORACLE.md §20.5 backlog).
 *
 * A bare bounded number plus the short label that says WHICH quantity it is
 * ("Tienda A", "Ahorro de Ana") — without a label, two bars are just two
 * numbers with nothing to tell them apart. `value` is bounded exactly like
 * `WhiteboardSequenceSchema.start`, the same closed-numeric posture §5
 * already applies everywhere on this turn.
 */
export const WhiteboardCompareSideSchema = z
  .object({
    label: z.string().min(1).max(60),
    value: z.number().min(0).max(1_000_000),
  })
  .strict();

/**
 * ONE NAMED BAR OF A `categories` BOARD.
 *
 * `label` is free text — a few words naming what this bar IS ("Renta",
 * "Ahorro"), never a full sentence — so it joins `say` and the board's own
 * top-level `label` in the same moderation call (orchestrator.ts) exactly
 * like `WhiteboardSequenceSchema.label` already does. `value` is the bar's own
 * bounded number; there is no arithmetic relating one category to another
 * for the model to get wrong the way a running sequence total can be.
 */
export const WhiteboardCategorySchema = z
  .object({
    label: z.string().min(1).max(40),
    value: z.number().min(0).max(1_000_000),
  })
  .strict();

/**
 * `kind: 'compare'` — TWO QUANTITIES, SIDE BY SIDE (V4, /ORACLE.md §20.5
 * backlog: "same schema family, straightforward once sequence is proven
 * live"). For a story that puts two things next to each other for the
 * learner to weigh — two prices, two ways to save, two options in a budget
 * decision — rather than one quantity that moves over time (`sequence`).
 *
 * Deliberately NOT two nested sequences: the backlog line asks for "two
 * values/quantities side by side," not two growth stories side by side, and
 * this codebase's own operating rules are explicit against building for a
 * need nobody has asked for yet. If a real session ever needs to compare two
 * quantities that EACH grow over time, that is a follow-up scoped from a
 * live example, the same way `sequence` itself grew its `unit` field only
 * after a real session showed the gap.
 *
 * `left`/`right` are never taken as "which is bigger" — the schema has no
 * field for that claim at all, so the model cannot assert it. The server
 * derives `difference`/`greater` from the two raw values (`whiteboard.ts`'s
 * `computeComparison`) and attaches them only on the wire, exactly the
 * posture `values` already has for `sequence`.
 */
export const WhiteboardCompareSchema = z
  .object({
    kind: z.literal('compare'),
    left: WhiteboardCompareSideSchema,
    right: WhiteboardCompareSideSchema,
    /**
     * The question itself — "¿Cuál playera es más barata?" — not either
     * quantity (each side carries its own label). Free text, moderated
     * alongside `say` the same way `WhiteboardSequenceSchema.label` is.
     */
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/**
 * A LIVE VISUAL COMPARING SEVERAL NAMED THINGS AT ONE MOMENT (V4 backlog,
 * ROADMAP.md "UI generativa acotada" / blueprint §10.4 — the first bounded
 * slice of it, scoped deliberately narrow; see that section's own comment
 * for what remains explicitly out of scope).
 *
 * `sequence` covers ONE quantity moving through TIME; `compare` covers
 * exactly TWO static quantities weighed against each other. This is a third,
 * narrowly-scoped shape for a story that names SEVERAL things at once ("how
 * did 100 pesos split across three things") without inventing a fake time
 * axis or forcing a >2-way comparison into `compare`'s fixed two sides —
 * same closed-vocabulary posture as every other field in this file: a
 * bounded count of named, bounded-number bars, no free-form layout, no
 * image, nothing the server does not independently re-verify before it
 * reaches a child's screen (`whiteboard.ts`'s `computeCategories`, the same
 * "never taken on the model's word" rule `computeSequence`/`computeComparison`
 * already apply).
 */
export const WhiteboardCategoriesSchema = z
  .object({
    kind: z.literal('categories'),
    /** 2-6 named bars — one is not a comparison, and past 6 stops being a glance. */
    categories: z.array(WhiteboardCategorySchema).min(2).max(6),
    /** A short caption above the board — see `WhiteboardSequenceSchema.label`. */
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/**
 * ONE MARKED POINT ON A `marked_line` BOARD (V4, /ORACLE.md §20.5 backlog).
 *
 * A bounded value plus the short label naming what it represents ("Lo que
 * tienes", "La bicicleta") — the value alone is a dot with no story.
 */
export const WhiteboardMarkSchema = z
  .object({
    value: z.number().min(0).max(1_000_000),
    label: z.string().min(1).max(60),
  })
  .strict();

/**
 * `kind: 'marked_line'` — ONE OR MORE VALUES PLACED ON A LINE BETWEEN TWO
 * REFERENCES (V4, /ORACLE.md §20.5 backlog). For a story about WHERE a
 * number sits — a savings amount against a price, a value inside a budget
 * range — rather than a quantity that moves over time (`sequence`) or two
 * quantities weighed against each other with no shared line (`compare`).
 *
 * `min`/`max` are NOT cross-checked here (`max > min`) — `z.discriminatedUnion`
 * (below) requires every member to be a plain `ZodObject` it can read the
 * `kind` literal off of directly, and a `.refine()` on this schema would
 * turn it into a `ZodEffects` that breaks that. This is not a gap: it is
 * the SAME split `WhiteboardSequenceSchema` already has between what the
 * schema bounds (one field at a time) and what only a real computation can
 * catch (a relationship BETWEEN fields, or an accumulation across several) —
 * `whiteboard.ts`'s `computeMarkedLine` is where `max > min`, and every
 * mark actually falling inside `[min, max]`, is verified, at authoring time
 * and again at the wire, exactly like a sequence's running total is.
 * NAMED `marked_line`, never `number_line`: the Lesson Engine already has a
 * GRADED segment type spelled `number_line` (`frontend/src/lesson-engine/
 * families/arrange/schema.ts`) — an entirely different, pre-authored,
 * scored activity reached through `segmentRequest.preferredTypes`, not
 * through this field. Reusing that exact string for an ungraded, live,
 * tutor-drawn visual would make two unrelated concepts share one name in
 * the same prompt and the same doc section (/ORACLE.md §20.5 already
 * discusses both `preferredTypes` and `whiteboard.kind` side by side).
 */
export const WhiteboardMarkedLineSchema = z
  .object({
    kind: z.literal('marked_line'),
    /** The line's two ends. */
    min: z.number().min(0).max(1_000_000),
    max: z.number().min(0).max(1_000_000),
    marks: z.array(WhiteboardMarkSchema).min(1).max(4),
    /**
     * The question itself — "¿Te alcanza para el cine?" — not any one mark
     * (each carries its own label). Free text, moderated alongside `say`.
     */
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/**
 * ONE PILE OF IDENTICAL COINS OR NOTES on a `tokens` board — a denomination
 * and how many of it are on the table.
 *
 * NO LABEL, deliberately. Every other kind's items carry model-written prose;
 * this one's identity is its own denomination, which the server verifies
 * against the real denominations of the board's currency (`whiteboard.ts`'s
 * `computeTokens`). That makes `tokens` the first instrument with NO new
 * moderation surface at all — its only free text is the board's own top-level
 * `label`, exactly as `sequence` has always been.
 */
export const WhiteboardTokenGroupSchema = z
  .object({
    /**
     * The face value of one coin or note. Bounded here, but the real check is
     * cross-field and lives in `computeTokens`: it must be a denomination that
     * actually EXISTS in this board's currency. A "7-peso coin" passes every
     * per-field bound and would teach a child something false about the money
     * in their own hand (§1.14: generated content verified for SUBJECT, not
     * only for form).
     */
    denomination: z.number().positive().max(1_000),
    /** How many of it. Past a dozen a pile stops being countable at a glance. */
    count: z.number().int().min(1).max(12),
  })
  .strict();

/**
 * `kind: 'tokens'` — DISCRETE, DENOMINATED OBJECTS ON THE TABLE
 * (/TUTOR_INSTRUMENTS.md §3.2, Sprint 6). The first instrument in the catalog
 * that is not a chart.
 *
 * WHY IT EXISTS, in the tutor's own words. `oracle/skills/moves/
 * biggest-coin-first.md` instructs: "Keep the coins ON THE TABLE where they can
 * be picked up. This move dies if it becomes arithmetic in the head."
 * `value-not-appearance.md` asks to "count the same pile twice".
 * `stop-at-the-target.md` wants a running total said aloud, coin by coin. None
 * of that is expressible as the height of a number, which is all every other
 * kind can draw — a bar chart of "three 10s and two 5s" is a picture of two
 * numbers, not of a pile a child can count.
 *
 * THE TOTAL IS THE ONE THING THE MODEL MAY NOT SAY. There is no `total` field
 * here, on purpose and for the same reason `compare` has no `greater`: the sum
 * of a pile is precisely the arithmetic the learner is doing, so it is computed
 * server-side (`computeTokens`) and attached at the wire. A model that could
 * assert the total could assert a wrong one over a correct picture.
 *
 * `currency` is NOT nullable here, unlike every other kind. A bar can be an
 * abstract quantity; a coin cannot — a token with no currency is not money,
 * and the denominations this board draws are only checkable against a currency
 * that is actually named.
 */
export const WhiteboardTokensSchema = z
  .object({
    kind: z.literal('tokens'),
    /** 1-6 piles. Past six the table stops being readable on a phone. */
    groups: z.array(WhiteboardTokenGroupSchema).min(1).max(6),
    /** A short caption above the table — see `WhiteboardSequenceSchema.label`. */
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']),
  })
  .strict();

/**
 * THE CLOSED SET OF BOARD SHAPES (V4). A discriminated union on `kind`,
 * never free-form — the same §5 discipline every other model-facing schema
 * on this turn already follows. `parseTurn`'s own fail-open guard
 * (`WhiteboardSchema.safeParse`, below) validates whichever member `kind`
 * names and nulls the whole board on anything else, so an unrecognised
 * `kind` degrades exactly like a malformed `sequence` already does — never
 * a discarded turn. Extended the same way each time a new bounded kind
 * ships: one more closed schema, dispatched by `kind`, without touching the
 * shape of any kind already shipped.
 */
export const WhiteboardSchema = z.discriminatedUnion('kind', [
  WhiteboardSequenceSchema,
  WhiteboardCompareSchema,
  WhiteboardMarkedLineSchema,
  WhiteboardCategoriesSchema,
  WhiteboardTokensSchema,
]);

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
     * V4: a live visual synced to this turn's story — a value sequence over
     * time, or a comparison across named categories. See `WhiteboardSchema`.
     * Never both this AND a segment request in the same turn — a board and a
     * graded activity competing for the plate in one turn is exactly the
     * disconnected-surfaces bug this exists to close.
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
export type WhiteboardSequence = z.infer<typeof WhiteboardSequenceSchema>;
export type WhiteboardCompareSide = z.infer<typeof WhiteboardCompareSideSchema>;
export type WhiteboardCompare = z.infer<typeof WhiteboardCompareSchema>;
export type WhiteboardMark = z.infer<typeof WhiteboardMarkSchema>;
export type WhiteboardMarkedLine = z.infer<typeof WhiteboardMarkedLineSchema>;
export type WhiteboardCategory = z.infer<typeof WhiteboardCategorySchema>;
export type WhiteboardCategories = z.infer<typeof WhiteboardCategoriesSchema>;
export type WhiteboardTokenGroup = z.infer<typeof WhiteboardTokenGroupSchema>;
export type WhiteboardTokens = z.infer<typeof WhiteboardTokensSchema>;
/** Any of the closed board shapes — see `WhiteboardSchema`'s own comment. */
export type Whiteboard = z.infer<typeof WhiteboardSchema>;

/**
 * Every free-text string a whiteboard shows a learner, regardless of `kind`
 * — the top-level caption plus any per-item label (a comparison's two
 * sides, a marked line's own marks). A single source of what "the board's
 * visible text" means, used everywhere a turn's learner-facing strings are
 * gathered for a check: the moderation call (orchestrator.ts) and the tier-
 * vocabulary/language-drift checks right beside it. Without this, adding a
 * new label field to a new `kind` is exactly the class of gap that let
 * `segmentRequest.framing` reach a child unmoderated for one day — a field
 * that existed and was learner-facing, just not listed at the one call site
 * that mattered.
 */
export function whiteboardVisibleText(whiteboard: Whiteboard | null | undefined): string[] {
  if (whiteboard == null) return [];
  switch (whiteboard.kind) {
    case 'sequence':
      return [whiteboard.label];
    case 'compare':
      return [whiteboard.label, whiteboard.left.label, whiteboard.right.label];
    case 'marked_line':
      return [whiteboard.label, ...whiteboard.marks.map((m) => m.label)];
    case 'categories':
      // A `categories` board's own per-bar labels are free text too (a few
      // words each, but still model-authored prose reaching a child's
      // screen) — a field moderated nowhere is a field an injection can use
      // as freely as an unmoderated one, regardless of how short it is
      // expected to stay.
      return [whiteboard.label, ...whiteboard.categories.map((c) => c.label)];
    case 'tokens':
      // The only kind whose ITEMS carry no prose at all: a pile is identified
      // by its own denomination, which the server verifies against the real
      // denominations of the currency. So this board's entire learner-facing
      // free-text surface is its own caption.
      return [whiteboard.label];
  }
}

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
   * So these two are coerced to a safe default before validation. Everything
   * else stays strict, which is the point of the schema: `say` is what the
   * child hears, `next` and `segmentRequest` drive what happens, and a wrong
   * value in any of them is a real defect. A wrong gesture is a neutral face.
   */
  if (typeof value === 'object' && value !== null) {
    const shaped = value as Record<string, unknown>;
    if (typeof shaped.emotion === 'string' && !EMOTIONS.includes(shaped.emotion as never)) {
      shaped.emotion = 'neutral';
    }
    if (typeof shaped.action === 'string' && !ACTIONS.includes(shaped.action as never)) {
      shaped.action = 'idle';
    }
    /*
     * A BOARD THAT DOES NOT CHECK OUT IS NO BOARD — the same fail-open
     * posture `computeSequence` already gives a whiteboard whose arithmetic
     * is wrong (see `preferredTypes`'s doc comment above), extended to a
     * whiteboard whose SHAPE is wrong. Found live, round 39 (2026-08-30):
     * a real session had the model set `whiteboard.unit` to a value outside
     * `day|week|month|year`, which failed `TutorTurnSchema`'s strict parse
     * and discarded the ENTIRE turn — a real, well-taught reply to the
     * learner, lost over one cosmetic field the retry then had no
     * corrective guidance to fix (unlike every other repairable fault this
     * file's schema produces, `invalid_shape` sets no `turnCorrection`, so
     * the retry is a blind re-ask). The whiteboard is a bonus visual for a
     * story `say` already tells in words; losing it for one turn costs far
     * less than losing the turn. Validated against its OWN schema and
     * dropped wholesale on any failure — not patched field-by-field — so a
     * bad `op`, `currency`, or `kind` degrades the same way a bad `unit`
     * does.
     */
    if (shaped.whiteboard !== null && shaped.whiteboard !== undefined) {
      if (!WhiteboardSchema.safeParse(shaped.whiteboard).success) {
        shaped.whiteboard = null;
      }
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
