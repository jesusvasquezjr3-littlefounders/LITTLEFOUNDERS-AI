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
 * Class III / S17 `roleplay` (TUTOR_INSTRUMENTS.md §3.4): the closed set of
 * PRE-AUTHORED scene ids, hand-mirrored against the actual content catalog
 * at `frontend/src/tutor/roleplay/scenes.ts` — widen both together, never
 * one ahead of the other.
 */
export const ROLEPLAY_SCENE_IDS = ['lemonade_change'] as const;

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

/**
 * THE CLOSED SET `preferredTypes` MAY EVER ACTUALLY CARRY PAST THIS FILE
 * (widened 2026-09-02, /TUTOR_INSTRUMENTS.md Sprint 1 — was `interest_peek`/
 * `number_line` only).
 *
 * THE CURATION RULE, stated once so a future addition has a test to pass
 * rather than a judgment call to make: every graded type in the Lesson
 * Engine's OWN `money` family (`frontend/src/lesson-engine/families/money/
 * schema.ts` — this product's dedicated subject, not a borrowed one), plus
 * `number_line`, which is the graded sibling of the whiteboard's own
 * `open_number_line` (§20.5) for exactly the same counting-up story. Nothing
 * outside that boundary is added on a guess — a type from `arrange` or
 * `analyze` earns its way in only when a real transcript shows the tutor
 * reaching for a story that family actually serves, the same evidence bar
 * `/ORACLE.md`'s own drift detectors are held to.
 */
export const PREFERRED_SEGMENT_TYPES = [
  'coin_count',
  'make_change',
  'piggy_split',
  'needs_wants',
  'price_compare',
  'budget_fit',
  'savings_goal',
  'fair_trade',
  'interest_peek',
  'number_line',
] as const;

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
  /*
   * DEDUPE BEFORE CAPPING, not the other way round — found while widening the
   * cap from 2 to 3 for this same change (2026-09-02). The old code capped
   * first (`kept.slice(0, 2)`) with no dedup step at all, and one test's own
   * ordering (`['interest_peek', 'number_line', 'interest_peek']`) happened to
   * put the duplicate LAST, so slicing to 2 silently discarded it and looked
   * like deduplication. It was not: the same values in a different order —
   * `['interest_peek', 'interest_peek', 'number_line']` — would have kept
   * BOTH copies of the duplicate and dropped the second real type instead. A
   * duplicate reaching `orderCandidates` (backend/tutorLadder.ts) is harmless
   * there (it only ever reads `.includes`), but a hint silently losing a real
   * preference to make room for a repeat of one already counted is the same
   * "told, not checked" shape this file's other comments warn about.
   */
  const deduped = [...new Set(kept)];
  // Still a SHORT hint, not a filter over the whole vocabulary — 3 survives
  // the widening from 2 to 10 types without turning "prefer this" into "only
  // this", which is what `orderCandidates` (backend/tutorLadder.ts) needs to
  // keep meaning "try these first" rather than "reject everything else".
  return deduped.length > 0 ? deduped.slice(0, 3) : null;
}

/**
 * One step of an on-screen demonstration over the OPEN active activity (Tutor
 * v3, /ORACLE.md; widened to 4 families 2026-09-02,
 * /TUTOR_INSTRUMENTS.md Sprint 2).
 *
 * STILL ONE FLAT, CLOSED SCHEMA — verbs from a fixed enum, every value a bare
 * number or a short id, no free text and no target outside the widget. Adding
 * families did not add authoring surface: `item`/`bucket`/`left`/`right` name
 * an id the CLIENT validates against the live segment's own payload before
 * acting on it, exactly the posture `denomination` already had — an injection
 * that reaches this field can move a piece already sitting in the widget, and
 * nothing else. A step whose verb does not match the segment on screen is a
 * silent no-op (`frontend/src/tutor/trayDemo.ts`'s per-family
 * adapters), never an error.
 *
 * `add`/`remove`/`pause` — the original three, unchanged, for `coin_count` /
 * `make_change`. `place` — append an item to an `order_steps` sequence.
 * `assign` — put an item in a `sort_buckets` bucket. `pair` — commit a
 * `match_pairs` match. `move` — set the marker on a `number_line`.
 *
 * DEFINED HERE ≠ OFFERED TO THE MODEL. `prompt.ts`'s `"demonstrate"` shape
 * line only ever lists `add`/`remove`/`pause`/`move` — `place`/`assign`/
 * `pair` are accepted end-to-end (this schema, the wire type, both Core
 * schemas, the frontend adapters in `trayDemo.ts`) but never invited, because
 * nothing in `orchestrator.ts` gives the model the served segment's real
 * item/bucket ids to name. See the long comment on that shape line in
 * `prompt.ts` before adding them to it: a guessed id that happens to match is
 * the graded answer, placed with no check behind it.
 */
export const DemoStepSchema = z
  .object({
    kind: z.enum(['add', 'remove', 'pause', 'place', 'assign', 'pair', 'move']),
    /** The denomination to add/remove; the client drops values the payload lacks. */
    denomination: z.number().positive().max(10_000).optional(),
    /** For 'pause': milliseconds, clamped client-side. */
    ms: z.number().int().min(100).max(2_000).optional(),
    /** For 'place' (order_steps) / 'assign' (sort_buckets, the item side): an item id from the segment's own payload. */
    item: z.string().min(1).max(64).optional(),
    /** For 'assign': which bucket. The client drops a bucket id the payload lacks, same as an unknown denomination. */
    bucket: z.string().min(1).max(64).optional(),
    /** For 'pair' (match_pairs): the left-column and right-column ids being matched. */
    left: z.string().min(1).max(64).optional(),
    right: z.string().min(1).max(64).optional(),
    /** For 'move' (number_line): the target value. The client clamps to [min, max] from the segment's own payload. */
    value: z.number().optional(),
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


/* ── WAVE 1 INSTRUMENTS (/TUTOR_INSTRUMENTS.md Sprints 7-8) ───────────────────
 *
 * Five shapes, each demanded by a move that names the staging it needs. They
 * share one rule with every kind above them, and it is the rule that decides
 * what each schema may contain: THE NUMBER THE LEARNER IS WORKING OUT IS NEVER
 * A FIELD THE MODEL CAN SET. A comparison gets no `greater`, a table of coins
 * gets no `total`, and below: a flow gets no `kept`, a goal gets no
 * `remaining`, a worked example gets no answer and no check.
 */

/** One bar of a `bar_model`. `value: null` marks THE UNKNOWN — at most one per board. */
export const BarModelPartSchema = z
  .object({
    label: z.string().min(1).max(40),
    value: z.number().min(0).max(1_000_000).nullable(),
  })
  .strict();

/**
 * `kind: 'bar_model'` — THE SINGAPORE BAR (/TUTOR_INSTRUMENTS.md §3.2 family B).
 *
 * The single most-used representation in primary mathematics teaching, and the
 * one this catalog was missing entirely: a word problem redrawn as comparable
 * lengths, with the unknown as a visible gap rather than a letter. A whole,
 * split into 2-3 named parts, exactly one of which may be unknown.
 *
 * The unknown's VALUE is never computed or sent — that is the answer, and this
 * board exists so the learner reads it off the picture. Its WIDTH is computed
 * (`computeBarModel`), because making the unknown's size apparent is precisely
 * what a bar model is for.
 */
export const WhiteboardBarModelSchema = z
  .object({
    kind: z.literal('bar_model'),
    /** The total the parts make up. Always known — a bar model with no whole has nothing to scale against. */
    whole: z.object({ label: z.string().min(1).max(40), value: z.number().positive().max(1_000_000) }).strict(),
    parts: z.array(BarModelPartSchema).min(2).max(3),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/**
 * `kind: 'part_whole'` — THE NUMBER BOND (/TUTOR_INSTRUMENTS.md §3.2 family B).
 *
 * One whole and its two parts, joined, so that adding and subtracting stop
 * being two procedures and become one relationship read in two directions. It
 * is what `worked-example-think-aloud.md`'s checking step is checking AGAINST.
 *
 * All three values are stated and the server verifies they actually bond
 * (`computePartWhole`): a board whose parts do not make its whole is dropped
 * entire, never drawn with a quiet error, because a wrong bond teaches the
 * wrong relationship more durably than a wrong sentence.
 */
export const WhiteboardPartWholeSchema = z
  .object({
    kind: z.literal('part_whole'),
    whole: z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict(),
    left: z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict(),
    right: z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict(),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/**
 * `kind: 'flow'` — WHAT CAME IN, WHAT WENT OUT, WHAT IS LEFT
 * (/TUTOR_INSTRUMENTS.md §3.2 family F). The highest-leverage instrument in the
 * catalog: it closes five misconceptions at once, all of them the core confusion
 * of the entrepreneurship strand — `revenue-is-profit`, `profit-is-revenue`,
 * `cost-equals-price`, `adds-costs-to-revenue`, `saving-is-leftover`.
 *
 * `three-piles-in-out-left.md` instructs: "make three places on the table or on
 * screen and leave them UNNAMED… coin by coin." The third place is the one being
 * taught, so THE MODEL HAS NO FIELD FOR IT — `computeFlow` derives what is left.
 * The renderer reveals the three places before their labels, which is the move's
 * own sequencing.
 */
export const WhiteboardFlowSchema = z
  .object({
    kind: z.literal('flow'),
    income: z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict(),
    spent: z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict(),
    /** What the third place is called, once it is named. The VALUE is the server's. */
    keptLabel: z.string().min(1).max(40),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/**
 * `kind: 'goal_bar'` — THE GOAL, AND WHAT IS ALREADY SAVED
 * (/TUTOR_INSTRUMENTS.md §3.2 family E).
 *
 * `find-what-is-missing.md` is a design specification, verbatim: "draw the bar
 * BEFORE any operation: the goal end to end, and the part already saved shaded
 * in from the left." What is missing is the thing being worked out, so
 * `computeGoalBar` derives it and the model has no field for it.
 */
export const WhiteboardGoalBarSchema = z
  .object({
    kind: z.literal('goal_bar'),
    goal: z.object({ label: z.string().min(1).max(40), value: z.number().positive().max(1_000_000) }).strict(),
    saved: z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict(),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/** One line of a `worked` example — the same closed arithmetic vocabulary `WhiteboardStepSchema` uses, minus percentages. */
export const WorkedStepSchema = z
  .object({
    op: z.enum(['add', 'subtract']),
    value: z.number().positive().max(100_000),
  })
  .strict();

/**
 * `kind: 'worked'` — THE CALCULATION, LINE BY LINE, INCLUDING THE CHECK
 * (/TUTOR_INSTRUMENTS.md §3.2 family C).
 *
 * `worked-example-think-aloud.md` asks for something no other kind draws:
 * "deliberately show the moment of CHECKING… undo the operation." Every board
 * above can show a result; this one shows the habit of testing it.
 *
 * Neither the running values NOR the check are model fields. `computeWorked`
 * derives both — the check by actually undoing the last step, so a board that
 * claims to verify itself has genuinely been verified by the server that drew it.
 */
export const WhiteboardWorkedSchema = z
  .object({
    kind: z.literal('worked'),
    start: z.number().min(0).max(1_000_000),
    steps: z.array(WorkedStepSchema).min(1).max(4),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();


/* ── THE CANONICAL PRIMARY-MATHS VOCABULARY (/TUTOR_INSTRUMENTS.md §3.1 source 3)
 *
 * Ten frames, open number lines, arrays, fraction strips and equal partitions
 * are not inventions of this catalog: they are the representations primary
 * mathematics teaching has converged on across decades and many countries, and
 * every one of them lands on a KC this product already teaches. Adopting the
 * established vocabulary is both more ambitious than inventing shapes and more
 * defensible — a teacher, a parent, and the child's own school all already know
 * what these mean.
 */

/**
 * `kind: 'ten_frame'` — A QUANTITY SEEN RATHER THAN COUNTED.
 *
 * Ten cells in two rows of five. A child reads "seven" off the arrangement
 * without counting to it, and sees what it takes to make ten in the same glance.
 * The complement to ten is NOT computed: that is usually the question.
 */
export const WhiteboardTenFrameSchema = z
  .object({
    kind: z.literal('ten_frame'),
    /** 1-20 — one frame, or two. Past twenty the arrangement stops being seeable. */
    count: z.number().int().min(1).max(20),
    label: z.string().min(1).max(60),
  })
  .strict();

/** One jump along an open number line. */
export const NumberLineJumpSchema = z
  .object({ value: z.number().positive().max(100_000) })
  .strict();

/**
 * `kind: 'open_number_line'` — COUNTING ON, IN JUMPS.
 *
 * The representation of `money.make-change-counting-up`, which until now had no
 * visual at all. Change is not given by subtracting; it is given by counting up
 * from the price to what was handed over, and this draws exactly that.
 *
 * The jumps must actually cover the distance — `computeOpenNumberLine` refuses a
 * line whose jumps do not land on `to`, because a picture of counting up that
 * does not arrive is a picture of the method failing.
 */
export const WhiteboardOpenNumberLineSchema = z
  .object({
    kind: z.literal('open_number_line'),
    from: z.number().min(0).max(1_000_000),
    to: z.number().min(0).max(1_000_000),
    jumps: z.array(NumberLineJumpSchema).min(1).max(5),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/**
 * `kind: 'array'` — ROWS BY COLUMNS.
 *
 * Multiplying, sharing and unit price are the same rectangle read three ways.
 * The PRODUCT is what the learner is working out, so the model has no field for
 * it — `computeArray` derives it.
 */
export const WhiteboardArraySchema = z
  .object({
    kind: z.literal('array'),
    rows: z.number().int().min(1).max(6),
    columns: z.number().int().min(1).max(6),
    /** What one cell is worth. 1 for a plain count of things; a price for a unit-price story. */
    unitValue: z.number().positive().max(100_000),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/** One strip of a fraction wall: a whole cut into `denominator` pieces, `highlighted` of them shaded. */
export const FractionStripRowSchema = z
  .object({
    denominator: z.number().int().min(1).max(12),
    highlighted: z.number().int().min(0).max(12),
  })
  .strict();

/**
 * `kind: 'fraction_strip'` — THE SAME WHOLE, CUT DIFFERENT WAYS, STACKED.
 *
 * Equivalences stop being a rule to memorise and become something read by
 * looking down a column. `compare-one-part-each.md` asks for exactly this
 * ("split it in front of them twice… take exactly ONE piece from each and set
 * them side by side"), and stacking makes the comparison unavoidable.
 */
export const WhiteboardFractionStripSchema = z
  .object({
    kind: z.literal('fraction_strip'),
    rows: z.array(FractionStripRowSchema).min(2).max(4),
    label: z.string().min(1).max(60),
  })
  .strict();

/** One way of splitting the whole on a `partition` board. */
export const PartitionSplitSchema = z
  .object({
    label: z.string().min(1).max(40),
    denominator: z.number().int().min(2).max(12),
  })
  .strict();

/**
 * `kind: 'partition'` — ONE AMOUNT, SHARED TWO OR THREE DIFFERENT WAYS.
 *
 * `compare-one-part-each.md` again, but with money on it: the same 60 pesos
 * split between two people and then between four, so that "a bigger bottom
 * number means a smaller piece" is something the learner watched happen rather
 * than something they were told.
 *
 * What ONE piece is worth in each split is the arithmetic being taught, so
 * `computePartition` derives it and the model has no field for it.
 */
export const WhiteboardPartitionSchema = z
  .object({
    kind: z.literal('partition'),
    whole: z.number().positive().max(1_000_000),
    splits: z.array(PartitionSplitSchema).min(2).max(3),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();


/* ── DECISION AND COMPARISON (/TUTOR_INSTRUMENTS.md §3.2 families D and F) ──── */

/** One option on a `table` board: what it costs and how much of it you get. */
export const TableOptionSchema = z
  .object({
    label: z.string().min(1).max(40),
    price: z.number().positive().max(1_000_000),
    units: z.number().positive().max(10_000),
  })
  .strict();

/**
 * `kind: 'table'` — TWO TO FOUR OPTIONS, COMPARED ON PRICE PER UNIT.
 *
 * Deliberately NOT a general grid of free text. A table whose cells the model
 * wrote would be the largest prose surface on this whole board family, for the
 * one instrument whose job is arithmetic. So it is narrow: each option carries a
 * price and a quantity, and `computeTable` derives the per-unit price and which
 * option actually wins — the comparison being taught (`money.unit-price`,
 * `biz.pricing-strategy`, and the `highest-price-wins` misconception).
 */
export const WhiteboardTableSchema = z
  .object({
    kind: z.literal('table'),
    options: z.array(TableOptionSchema).min(2).max(4),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/**
 * `kind: 'scale'` — TWO SIDES THAT TIP UNTIL THEY LEVEL.
 *
 * Shares its data shape with `compare` and is a different instrument: `compare`
 * asks "which is more", `scale` asks "are these fair to each other" — cost
 * against price, effort against pay. Equality becomes something seen moving
 * rather than a sign between two numbers, which is what `biz.cost-vs-price` and
 * `biz.value-of-work` actually need.
 */
export const WhiteboardScaleSchema = z
  .object({
    kind: z.literal('scale'),
    left: WhiteboardCompareSideSchema,
    right: WhiteboardCompareSideSchema,
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/** One thing being sorted on a `two_bins` board. */
export const SortedItemSchema = z
  .object({
    label: z.string().min(1).max(40),
    /** Which bin it belongs in — 0 or 1, never a name, so the two can never disagree. */
    bin: z.number().int().min(0).max(1),
  })
  .strict();

/**
 * `kind: 'two_bins'` — CLASSIFICATION, SHOWN AND NOT GRADED.
 *
 * Need against want, good against service. The Lesson Engine already has graded
 * sorting activities; this is the ungraded demonstration a tutor performs WHILE
 * TALKING, which `paying-for-the-work.md` and `value-not-appearance.md` both ask
 * for and no graded activity can be (it would stop the conversation to score).
 */
export const WhiteboardTwoBinsSchema = z
  .object({
    kind: z.literal('two_bins'),
    binLabels: z.tuple([z.string().min(1).max(40), z.string().min(1).max(40)]),
    items: z.array(SortedItemSchema).min(2).max(8),
    label: z.string().min(1).max(60),
  })
  .strict();

/**
 * `kind: 'grab'` — Class II, the first Hand mode (S9, /TUTOR_INSTRUMENTS.md
 * §3.3): "drags tokens, chips and labels into piles, bins or cells." Where
 * `two_bins` above is the tutor SHOWING a classification while talking, this
 * is the LEARNER doing the classifying — items start unplaced and stay that
 * way until tapped, then tapped again onto a bin (the Lesson Engine's own
 * `SortingBoard` tap-then-tap pattern, not native drag-and-drop: touch
 * drag-and-drop is exactly the interaction class that reads worst on a
 * phone, which is most of this product's real traffic).
 *
 * UNGRADED BY CONSTRUCTION (§8.1 decision D) — no field here for which bin
 * an item "belongs" in, unlike `two_bins.items[].bin` or `SortedItemSchema`.
 * There is no answer key for the server to defend and no placement for the
 * model to pre-decide: identity is the item's own ARRAY POSITION (as
 * `two_bins`' items already are), never a separate id, so nothing here can
 * drift out of sync with anything a server would need to check against. This
 * is also why `grab` needed no `computed` fields and no `compute*` function
 * in `whiteboard.ts` at all — the FIRST Class I/II board in the catalog with
 * that property; every prior one exists because something needed hiding
 * from the model or deriving from what it said.
 */
export const WhiteboardGrabSchema = z
  .object({
    kind: z.literal('grab'),
    binLabels: z.array(z.string().min(1).max(40)).min(2).max(4),
    items: z.array(z.string().min(1).max(40)).min(2).max(8),
    label: z.string().min(1).max(60),
  })
  .strict();

/**
 * `kind: 'fill'` — Class II, the second Hand mode (S9, /TUTOR_INSTRUMENTS.md
 * §3.3): "taps to fill a ten frame, a bar, a jar — counting with a finger."
 * The second interactive whiteboard kind, same `WhiteboardShell` `interactive`
 * mode `grab` introduced (`role="group"`, not `role="img"` — see that kind's
 * own comment). Where `grab` is about WHICH bin, `fill` is about HOW MANY:
 * `container` picks the visual metaphor only (a 2x5 ten-frame grid, a single
 * row bar, a stacked jar) — all three share ONE mechanism underneath, an
 * empty container the learner taps up to `capacity`, because the counting
 * gesture is identical across all three and only the shape a child
 * recognises changes.
 *
 * UNGRADED BY CONSTRUCTION, same as `grab`: no field for how many are
 * currently filled — that is the tapping itself, local component state,
 * never submitted. `capacity` bounds match the EXISTING static `ten_frame`
 * kind's own `count` (1-20) for the one container type both kinds can draw.
 */
export const WhiteboardFillSchema = z
  .object({
    kind: z.literal('fill'),
    container: z.enum(['ten_frame', 'bar', 'jar']),
    capacity: z.number().int().min(1).max(20),
    label: z.string().min(1).max(60),
  })
  .strict();

/** One branch of a `whatif` board: what changes, and the same closed step vocabulary `sequence` itself uses. */
export const WhiteboardWhatifBranchSchema = z
  .object({
    /** Names what THIS branch changes ("Ahorra 2 a la semana") — the tab the learner taps to see it. */
    label: z.string().min(1).max(30),
    steps: z.array(WhiteboardStepSchema).min(1).max(6),
  })
  .strict();

/**
 * `kind: 'whatif'` — Class II, S10 (/TUTOR_INSTRUMENTS.md §3.3): "moves a
 * value and watches the board answer. The server pre-computes every
 * branch; the client still only draws." Where `sequence_compare` shows two
 * FIXED trajectories side by side at once, `whatif` is the LEARNER exploring
 * 2-3 of them one at a time, tapping between tabs — the interactive sibling
 * of that static kind, generalising `computeSequenceCompare`'s own two-track
 * loop to a variable branch count.
 *
 * ALL BRANCHES MUST SPAN THE SAME NUMBER OF PERIODS (checked in
 * `computeWhatif`, the same constraint `computeSequenceCompare` already
 * has): a "what if instead" comparison is only fair read at the SAME point
 * in time, and a picture comparing two different lengths of time would call
 * a difference in TIME a difference in OUTCOME.
 *
 * NOT UNGRADED like `grab`/`fill` — this is a Class I-shaped board with a
 * REAL computed field (`values`, one array per branch), because "watches
 * the board answer" means the numbers themselves are the point, the same
 * reason `sequence` itself has never let the model state a running total.
 * Switching branches is a pure client-side re-render of ALREADY-computed
 * data — no new computation, no submission, same as flipping a tab.
 */
export const WhiteboardWhatifSchema = z
  .object({
    kind: z.literal('whatif'),
    start: z.number().min(0).max(1_000_000),
    unit: z.enum(['day', 'week', 'month', 'year']),
    branches: z.array(WhiteboardWhatifBranchSchema).min(2).max(3),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/**
 * `kind: 'your_turn'` — Class II, S10 (/TUTOR_INSTRUMENTS.md §3.3): "the
 * Tutor demonstrates, then hands the instrument over — the scaffold-fade two
 * moves ask for" (`oracle/skills/moves/scaffold-fading.md`'s FULL → LAST STEP
 * THEIRS → FIRST STEP YOURS → ALONE ladder; `concrete-to-abstract.md`'s same
 * shape on a different axis). ONE `sequence`, split in two: the first
 * `givenCount` values are the tutor's own contribution, shown immediately;
 * the rest are the learner's to reveal themselves, one tap at a time —
 * `fill`'s exact ordered-reveal mechanic, generalized from an empty
 * container to a partly-worked one.
 *
 * `values` is SERVER-COMPUTED from `start`+`steps` in ONE call
 * (`computeYourTurn`, folding `computeSequence`), never two — so the tutor's
 * shown prefix and the learner's revealed suffix can never disagree
 * arithmetically the way two independently-authored halves could. The MODEL
 * never states which values are which; it only marks the BOUNDARY
 * (`givenCount`). `computeYourTurn` refuses a board that leaves the learner
 * nothing (`givenCount >= values.length`) — a hand-over that hands over
 * nothing is just a `sequence`, and this file's server-side refusal is what
 * keeps that a compute-time guarantee rather than a prompt-time hope.
 */
export const WhiteboardYourTurnSchema = z
  .object({
    kind: z.literal('your_turn'),
    start: z.number().min(0).max(1_000_000),
    steps: z.array(WhiteboardStepSchema).min(2).max(7),
    /** How many of the folded values (start included) the TUTOR already showed. Always < steps.length + 1 — enforced in `computeYourTurn`, not here, the same posture `sequence_compare`'s equal-length tracks and `whatif`'s branch count already take. */
    givenCount: z.number().int().min(1).max(7),
    unit: z.enum(['day', 'week', 'month', 'year']),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/** One thing placed in a `venn` board's two overlapping sets. */
export const VennItemSchema = z
  .object({
    label: z.string().min(1).max(40),
    side: z.enum(['left', 'right', 'both']),
  })
  .strict();

/**
 * `kind: 'venn'` — WHAT FALLS IN BOTH.
 *
 * The instrument for `want-feels-like-need`: a thing can be a need AND
 * something you want, and a two-bin sort forces a false choice about exactly
 * the cases that confuse a learner most. Overlap is the whole point.
 */
export const WhiteboardVennSchema = z
  .object({
    kind: z.literal('venn'),
    leftLabel: z.string().min(1).max(40),
    rightLabel: z.string().min(1).max(40),
    items: z.array(VennItemSchema).min(2).max(8),
    label: z.string().min(1).max(60),
  })
  .strict();

/** One item to be ranked. */
export const RankedItemSchema = z
  .object({
    label: z.string().min(1).max(40),
    value: z.number().min(0).max(1_000_000),
  })
  .strict();

/**
 * `kind: 'ranking'` — AN ORDER THE SERVER PUTS THEM IN.
 *
 * The model supplies the items and their amounts and NOT the order: sorting
 * them is the thing being practised, so `computeRanking` does it. A tutor that
 * could assert the order could assert a wrong one over correct numbers.
 */
export const WhiteboardRankingSchema = z
  .object({
    kind: z.literal('ranking'),
    items: z.array(RankedItemSchema).min(2).max(5),
    /** Ascending puts the smallest first — "cheapest first" is a different lesson than "biggest first". */
    direction: z.enum(['asc', 'desc']),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/** One ending on an `outcomes` board. */
export const OutcomeSchema = z
  .object({
    label: z.string().min(1).max(40),
    detail: z.string().min(1).max(110),
  })
  .strict();

/**
 * `kind: 'outcomes'` — HOW IT ENDS IF IT GOES WELL, AND IF IT DOES NOT.
 *
 * `write-both-endings.md`: "put the two side by side WHERE BOTH ARE VISIBLE AT
 * ONCE. Two columns, few words. The comparison has to be seen, not remembered."
 * The only board in the family whose content is prose rather than number, which
 * is why `detail` is capped hard at a hundred-odd characters — a paragraph is
 * not an ending, it is a story, and it would not be readable side by side.
 */
export const WhiteboardOutcomesSchema = z
  .object({
    kind: z.literal('outcomes'),
    good: OutcomeSchema,
    bad: OutcomeSchema,
    label: z.string().min(1).max(60),
  })
  .strict();

/** One party's side of a trade — what they hand over and what they receive. */
export const TradeSideSchema = z
  .object({
    who: z.string().min(1).max(30),
    gives: z.string().min(1).max(40),
    gets: z.string().min(1).max(40),
  })
  .strict();

/**
 * `kind: 'trade'` — TWO PARTIES, EACH JUDGING THEIR OWN SIDE.
 *
 * `both-sides-said-yes.md` needs two points of view at once, which no
 * single-quantity board can hold. It is the instrument for `trade-has-loser`:
 * seeing what each side gave AND got is what makes "both of them wanted this"
 * an observation rather than a claim.
 */
export const WhiteboardTradeSchema = z
  .object({
    kind: z.literal('trade'),
    left: TradeSideSchema,
    right: TradeSideSchema,
    label: z.string().min(1).max(60),
  })
  .strict();

/** One possible outcome and how likely it is, as a plain weight. */
export const ChanceOutcomeSchema = z
  .object({
    label: z.string().min(1).max(40),
    /** A weight, never a percentage: the model does not have to make them sum to anything. */
    weight: z.number().int().min(1).max(100),
  })
  .strict();

/**
 * `kind: 'chance'` — LIKELIHOOD AS AREA.
 *
 * `biz.risk-and-reward` and `ignores-downside` need "usually fine, sometimes
 * not" to be visible without asking a nine-year-old to read a percentage. The
 * model gives plain WEIGHTS and never a percentage; `computeChance` normalises
 * them, so the shares drawn always add to a whole and the model cannot state a
 * probability it did not compute.
 */
export const WhiteboardChanceSchema = z
  .object({
    kind: z.literal('chance'),
    outcomes: z.array(ChanceOutcomeSchema).min(2).max(3),
    label: z.string().min(1).max(60),
  })
  .strict();


/* ── OPERATIONS AND REAL-MONEY ARTEFACTS (§3.2 families C and F) ────────────── */

/**
 * `kind: 'deal'` — REPARTIR DE A UNO, WITH THE REMAINDER VISIBLE AND APART.
 *
 * `deal-it-into-piles.md`: "one place per person… you cannot deal what you do
 * not have." `categories` draws the end state, which hides the very thing being
 * taught — that some is left over and it is not nothing. Both the share and the
 * remainder are computed (`computeDeal`); the model states neither.
 */
export const WhiteboardDealSchema = z
  .object({
    kind: z.literal('deal'),
    total: z.number().int().min(1).max(60),
    /** Who or what it is being dealt into. 2-6 places; past that nobody follows the dealing. */
    bins: z.array(z.string().min(1).max(40)).min(2).max(6),
    label: z.string().min(1).max(60),
  })
  .strict();

/**
 * `kind: 'change'` — ONE PAYMENT SPLITTING INTO WHAT IS KEPT AND WHAT COMES BACK.
 *
 * `register-keeps-the-price.md`: "split it PHYSICALLY in front of them… two
 * piles out of one payment." The `returns-payment` misconception is a learner
 * handing the whole payment back, and no subtraction sentence shows why that is
 * wrong the way two piles do. The change is computed, never stated.
 */
export const WhiteboardChangeSchema = z
  .object({
    kind: z.literal('change'),
    price: z.number().positive().max(1_000_000),
    paid: z.number().positive().max(1_000_000),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']),
  })
  .strict();

/**
 * `kind: 'regroup'` — ONE UNIT BROKEN INTO MANY.
 *
 * `trade-before-subtract.md` and `same-unit-first.md`. A ten broken into ten
 * ones is a step of the problem, not mental arithmetic, and drawing it is what
 * makes `subtracts-smaller-from-larger-digitwise` visible as a wrong move rather
 * than a wrong answer. How many you get back is computed.
 */
export const WhiteboardRegroupSchema = z
  .object({
    kind: z.literal('regroup'),
    fromDenomination: z.number().positive().max(1_000),
    fromCount: z.number().int().min(1).max(6),
    intoDenomination: z.number().positive().max(1_000),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']),
  })
  .strict();

/**
 * `kind: 'equation_bar'` — TWO SIDES AS LENGTHS THAT MUST MATCH.
 *
 * For `money.percent-intro` and tier-3 work where an equality stops being an
 * arithmetic instruction and becomes a relationship to keep. `computeEquationBar`
 * REFUSES a board whose sides do not match: an equation drawn out of balance
 * teaches that the sign is decorative.
 */
export const WhiteboardEquationBarSchema = z
  .object({
    kind: z.literal('equation_bar'),
    left: z.array(z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict()).min(1).max(3),
    right: z.array(z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict()).min(1).max(3),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/** One line of a till receipt. */
export const ReceiptLineSchema = z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict();

/**
 * `kind: 'receipt'` — THE DOCUMENT A CHILD HAS ALREADY SEEN.
 *
 * A till receipt written line by line to a total. `money.estimate-total` and
 * `add-money` are usually taught as a column of numbers; this is the same column
 * wearing the form it takes in the world, which is most of why it is worth
 * having. The total is computed.
 */
export const WhiteboardReceiptSchema = z
  .object({
    kind: z.literal('receipt'),
    lines: z.array(ReceiptLineSchema).min(1).max(6),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']),
  })
  .strict();

/** One entry in a ledger — money in or money out. */
export const LedgerEntrySchema = z
  .object({
    label: z.string().min(1).max(40),
    amount: z.number().positive().max(1_000_000),
    direction: z.enum(['in', 'out']),
  })
  .strict();

/**
 * `kind: 'ledger'` — TWO COLUMNS AND A RUNNING BALANCE.
 *
 * What a real business keeps, in a child's version. Where `flow` shows one
 * in-out-left moment, this shows the sequence of them, which is what makes
 * `saving-is-leftover` visible: the balance moves, and what is left at the end
 * was decided by every line above it. Every running balance is computed.
 */
export const WhiteboardLedgerSchema = z
  .object({
    kind: z.literal('ledger'),
    entries: z.array(LedgerEntrySchema).min(2).max(6),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']),
  })
  .strict();

/**
 * `kind: 'price_tag'` — WHERE THE DECISION ACTUALLY HAPPENS.
 *
 * Price, quantity and discount on one object, because a learner meets all three
 * on a shelf at once and has to read them together. Unit price and the
 * discounted price are computed — those are the two numbers a shopper is being
 * asked to work out, and `price-is-fixed-property` is the belief that they are
 * not workable-out at all.
 */
export const WhiteboardPriceTagSchema = z
  .object({
    kind: z.literal('price_tag'),
    item: z.string().min(1).max(40),
    price: z.number().positive().max(1_000_000),
    units: z.number().positive().max(10_000),
    /** A whole-percent discount, or null for a plain tag. */
    discountPercent: z.number().int().min(1).max(90).nullable(),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']),
  })
  .strict();

/**
 * `kind: 'inventory'` — STOCK FALLING AS SALES HAPPEN.
 *
 * Makes visible that selling is exchanging a thing for money rather than only
 * receiving money, which is the missing half of `revenue-is-profit`. What is
 * left is computed, and selling more than you had is refused.
 */
export const WhiteboardInventorySchema = z
  .object({
    kind: z.literal('inventory'),
    item: z.string().min(1).max(40),
    start: z.number().int().min(1).max(40),
    sold: z.number().int().min(0).max(40),
    label: z.string().min(1).max(60),
  })
  .strict();

/**
 * `kind: 'budget_plate'` — A TOTAL AGAINST A VISIBLE CEILING.
 *
 * `budget-is-per-item` is believing the budget applies to each thing separately.
 * A plate with a ceiling makes over-allocating show what it STEALS FROM rather
 * than produce an error message, which is the difference between a constraint a
 * learner feels and a rule they are told. Spent, remaining and any overspend are
 * computed.
 */
export const WhiteboardBudgetPlateSchema = z
  .object({
    kind: z.literal('budget_plate'),
    budget: z.number().positive().max(1_000_000),
    items: z.array(z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict()).min(2).max(5),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']),
  })
  .strict();


/* ── EARLY YEARS AND TIME — the last of the Class I catalog ─────────────────── */

/** One row of a pictograph: a thing, and how many icons stand for it. */
export const PictographRowSchema = z
  .object({
    label: z.string().min(1).max(40),
    count: z.number().int().min(1).max(12),
  })
  .strict();

/**
 * `kind: 'pictograph'` — QUANTITY AS A COUNT OF FIGURES, NOT A HEIGHT.
 *
 * For `tier_min: 1` — six and seven year olds, twelve of the twenty-eight KCs.
 * A bar is an abstraction that has to be taught before it can teach; six drawn
 * things are not. `unitValue` lets one icon stand for more than one thing,
 * which is the step from counting to scaling and the reason this is not just
 * `categories` with pictures.
 */
export const WhiteboardPictographSchema = z
  .object({
    kind: z.literal('pictograph'),
    rows: z.array(PictographRowSchema).min(2).max(4),
    /** What ONE icon is worth. 1 for plain counting; more for a first scale. */
    unitValue: z.number().positive().max(1_000),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/**
 * `kind: 'bead_string'` — TWENTY BEADS IN FIVES.
 *
 * The sibling of `ten_frame` and not a duplicate of it: a frame shows a quantity
 * as an ARRANGEMENT, a string shows it as a POSITION you can slide along. Both
 * are canonical, and a learner who reads one does not automatically read the
 * other. Like the frame, the complement is never computed — that is the question.
 */
export const WhiteboardBeadStringSchema = z
  .object({
    kind: z.literal('bead_string'),
    count: z.number().int().min(1).max(20),
    label: z.string().min(1).max(60),
  })
  .strict();

/** One thing being counted with tally marks. */
export const TallyGroupSchema = z
  .object({
    label: z.string().min(1).max(40),
    count: z.number().int().min(1).max(20),
  })
  .strict();

/**
 * `kind: 'tally'` — COUNTING EVENTS IN FIVES, AS THEY HAPPEN.
 *
 * How many sold, how many days it rained. The only board that draws a count
 * being KEPT rather than reported, which is what makes data feel collected
 * rather than handed down — the beginning of `biz.revenue`.
 */
export const WhiteboardTallySchema = z
  .object({
    kind: z.literal('tally'),
    groups: z.array(TallyGroupSchema).min(2).max(5),
    label: z.string().min(1).max(60),
  })
  .strict();

/**
 * `kind: 'fraction_circle'` — A SHARE OF A ROUND WHOLE.
 *
 * The gesture every child already owns: a slice of the cake. `fraction_strip`
 * compares wholes cut different ways; this one is the single whole a learner
 * recognises before any of that, and it is the natural picture for
 * `money.equal-sharing` and a first look at percent.
 */
export const WhiteboardFractionCircleSchema = z
  .object({
    kind: z.literal('fraction_circle'),
    denominator: z.number().int().min(2).max(12),
    highlighted: z.number().int().min(0).max(12),
    label: z.string().min(1).max(60),
  })
  .strict();

/** One column of a stacked bar: a total, decomposed. */
export const StackColumnSchema = z
  .object({
    label: z.string().min(1).max(40),
    parts: z
      .array(z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(1_000_000) }).strict())
      .min(2)
      .max(3),
  })
  .strict();

/**
 * `kind: 'stack'` — TWO OR THREE TOTALS, EACH DECOMPOSED INSIDE.
 *
 * `categories` compares totals; this compares what they are MADE OF, which is
 * the question `biz.budget-decisions` actually asks — two weeks that cost the
 * same can be spent completely differently, and only a stacked bar shows both
 * facts at once.
 */
export const WhiteboardStackSchema = z
  .object({
    kind: z.literal('stack'),
    columns: z.array(StackColumnSchema).min(2).max(3),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/** One of the two trajectories on a `sequence_compare` board. */
export const SequenceTrackSchema = z
  .object({
    label: z.string().min(1).max(40),
    start: z.number().min(0).max(1_000_000),
    steps: z.array(WhiteboardStepSchema).min(1).max(6),
  })
  .strict();

/**
 * `kind: 'sequence_compare'` — TWO FUTURES AT ONCE.
 *
 * Save two a week against save five; simple growth against compound. `sequence`
 * answers "what happens"; this answers "what happens INSTEAD", which is the only
 * form in which `money.simple-interest-peek` means anything to a child. Both
 * tracks must span the same number of periods, or the picture compares two
 * different lengths of time and calls it a difference in outcome.
 */
export const WhiteboardSequenceCompareSchema = z
  .object({
    kind: z.literal('sequence_compare'),
    unit: z.enum(['day', 'week', 'month', 'year']),
    tracks: z.tuple([SequenceTrackSchema, SequenceTrackSchema]),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
  })
  .strict();

/** One event on a timeline. */
export const TimelineEventSchema = z
  .object({
    label: z.string().min(1).max(40),
    /** Which period it happens in, counting from 1. */
    at: z.number().int().min(1).max(12),
  })
  .strict();

/**
 * `kind: 'timeline'` — WHEN, NOT HOW MUCH.
 *
 * `sequence` answers "how much"; this answers "when", and the gap between the
 * two is where `spends-until-empty` lives: money that arrives on the 15th and a
 * bill that is due on the 10th is a problem of ORDER, not of amount.
 */
export const WhiteboardTimelineSchema = z
  .object({
    kind: z.literal('timeline'),
    unit: z.enum(['day', 'week', 'month', 'year']),
    /** How many periods the line covers. */
    span: z.number().int().min(2).max(12),
    events: z.array(TimelineEventSchema).min(2).max(5),
    label: z.string().min(1).max(60),
  })
  .strict();

/**
 * `kind: 'cycle'` — A LOOP THAT COMES BACK TO ITS START.
 *
 * Buy, sell, earn, buy again. Every other board in this family draws something
 * that ENDS; a business does not, and `biz.revenue`/`profit` make a different
 * kind of sense once the arrow returns. The only Class I board with no numbers
 * at all — closed to 3-5 short steps, and moderation is its whole guard.
 */
export const WhiteboardCycleSchema = z
  .object({
    kind: z.literal('cycle'),
    steps: z.array(z.string().min(1).max(40)).min(3).max(5),
    label: z.string().min(1).max(60),
  })
  .strict();

/**
 * `kind: 'before_after'` — TWO STATES OF THE SAME THING.
 *
 * "What changed, and what stayed the same" is the question underneath every
 * operation, and it is the one a learner skips when they treat arithmetic as a
 * procedure. The change is computed, never stated.
 */
export const WhiteboardBeforeAfterSchema = z
  .object({
    kind: z.literal('before_after'),
    what: z.string().min(1).max(40),
    before: z.number().min(0).max(1_000_000),
    after: z.number().min(0).max(1_000_000),
    label: z.string().min(1).max(60),
    currency: z.enum(['MXN', 'USD', 'BRL']).nullable(),
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
  WhiteboardBarModelSchema,
  WhiteboardPartWholeSchema,
  WhiteboardFlowSchema,
  WhiteboardGoalBarSchema,
  WhiteboardWorkedSchema,
  WhiteboardTenFrameSchema,
  WhiteboardOpenNumberLineSchema,
  WhiteboardArraySchema,
  WhiteboardFractionStripSchema,
  WhiteboardPartitionSchema,
  WhiteboardTableSchema,
  WhiteboardScaleSchema,
  WhiteboardTwoBinsSchema,
  WhiteboardVennSchema,
  WhiteboardRankingSchema,
  WhiteboardOutcomesSchema,
  WhiteboardTradeSchema,
  WhiteboardChanceSchema,
  WhiteboardDealSchema,
  WhiteboardChangeSchema,
  WhiteboardRegroupSchema,
  WhiteboardEquationBarSchema,
  WhiteboardReceiptSchema,
  WhiteboardLedgerSchema,
  WhiteboardPriceTagSchema,
  WhiteboardInventorySchema,
  WhiteboardBudgetPlateSchema,
  WhiteboardPictographSchema,
  WhiteboardBeadStringSchema,
  WhiteboardTallySchema,
  WhiteboardFractionCircleSchema,
  WhiteboardStackSchema,
  WhiteboardSequenceCompareSchema,
  WhiteboardTimelineSchema,
  WhiteboardCycleSchema,
  WhiteboardBeforeAfterSchema,
  WhiteboardGrabSchema,
  WhiteboardFillSchema,
  WhiteboardWhatifSchema,
  WhiteboardYourTurnSchema,
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
    /**
     * Class III `point_at` (2026-09-04): WHICH element of the open whiteboard
     * `action: "point"` reaches toward, as a plain index into that board's
     * own drawn sequence — never a coordinate, and never anything the model
     * could use to assert content the server has not already computed. A
     * board with no element at this index, or no board open at all, is a
     * miss the client resolves to the SAME coarse, whole-plate gesture
     * `point` already had before this field existed — an out-of-range guess
     * costs nothing and asserts nothing, so this needs no upper bound here.
     */
    pointAt: z.number().int().min(0).nullable().optional(),
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
    /**
     * Class V (migration 0069, TUTOR_INSTRUMENTS.md §3.6): "persist the
     * board this turn just drew as the learner's ongoing savings plan."
     * Server-computed nothing new — Core copies `whiteboard` verbatim into
     * `tutor_plans` (a plain overwrite, see that migration's own comment on
     * why this is safe without compare-and-swap). Meaningless without a
     * `whiteboard` on the SAME turn, which the refine below enforces —
     * there is nothing here for the model to author beyond the boundary
     * itself.
     */
    savePlan: z.boolean(),
    /**
     * Class III / S17 (TUTOR_INSTRUMENTS.md §3.4): "two characters act a
     * transaction with their own cloned voices while the learner decides."
     * A closed id into a small, PRE-AUTHORED catalog
     * (`frontend/src/tutor/roleplay/scenes.ts`) — the model NAMES a scene,
     * it never composes either character's lines, the same "id names
     * content that exists" posture `skillKey` already has. One scene today
     * (`lemonade_change`); widen the enum alongside the frontend catalog,
     * never ahead of it — an id with no matching scene plays nothing.
     */
    roleplayScene: z.enum(ROLEPLAY_SCENE_IDS).nullable().optional(),
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
  })
  .refine((turn) => !turn.savePlan || turn.whiteboard != null, {
    message: 'savePlan requires a whiteboard on the SAME turn — nothing to save otherwise',
    path: ['savePlan'],
  })
  .refine((turn) => turn.roleplayScene == null || turn.whiteboard == null, {
    message: 'roleplayScene and whiteboard may not both be set on the same turn',
    path: ['roleplayScene'],
  })
  .refine((turn) => turn.roleplayScene == null || turn.segmentRequest == null, {
    message: 'roleplayScene and segmentRequest may not both be set on the same turn — start the scene, THEN request the activity once it ends',
    path: ['roleplayScene'],
  })
  .refine((turn) => turn.pointAt == null || turn.action === 'point', {
    message: 'pointAt requires action="point" on the SAME turn — it names what the gesture reaches for, not a fact on its own',
    path: ['pointAt'],
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
export type WhiteboardBarModel = z.infer<typeof WhiteboardBarModelSchema>;
export type WhiteboardPartWhole = z.infer<typeof WhiteboardPartWholeSchema>;
export type WhiteboardFlow = z.infer<typeof WhiteboardFlowSchema>;
export type WhiteboardGoalBar = z.infer<typeof WhiteboardGoalBarSchema>;
export type WhiteboardWorked = z.infer<typeof WhiteboardWorkedSchema>;
export type WhiteboardTenFrame = z.infer<typeof WhiteboardTenFrameSchema>;
export type WhiteboardOpenNumberLine = z.infer<typeof WhiteboardOpenNumberLineSchema>;
export type WhiteboardArray = z.infer<typeof WhiteboardArraySchema>;
export type WhiteboardFractionStrip = z.infer<typeof WhiteboardFractionStripSchema>;
export type WhiteboardPartition = z.infer<typeof WhiteboardPartitionSchema>;
export type WhiteboardTable = z.infer<typeof WhiteboardTableSchema>;
export type WhiteboardScale = z.infer<typeof WhiteboardScaleSchema>;
export type WhiteboardTwoBins = z.infer<typeof WhiteboardTwoBinsSchema>;
export type WhiteboardGrab = z.infer<typeof WhiteboardGrabSchema>;
export type WhiteboardFill = z.infer<typeof WhiteboardFillSchema>;
export type WhiteboardWhatifBranch = z.infer<typeof WhiteboardWhatifBranchSchema>;
export type WhiteboardWhatif = z.infer<typeof WhiteboardWhatifSchema>;
export type WhiteboardYourTurn = z.infer<typeof WhiteboardYourTurnSchema>;
export type WhiteboardVenn = z.infer<typeof WhiteboardVennSchema>;
export type WhiteboardRanking = z.infer<typeof WhiteboardRankingSchema>;
export type WhiteboardOutcomes = z.infer<typeof WhiteboardOutcomesSchema>;
export type WhiteboardTrade = z.infer<typeof WhiteboardTradeSchema>;
export type WhiteboardChance = z.infer<typeof WhiteboardChanceSchema>;
export type WhiteboardDeal = z.infer<typeof WhiteboardDealSchema>;
export type WhiteboardChange = z.infer<typeof WhiteboardChangeSchema>;
export type WhiteboardRegroup = z.infer<typeof WhiteboardRegroupSchema>;
export type WhiteboardEquationBar = z.infer<typeof WhiteboardEquationBarSchema>;
export type WhiteboardReceipt = z.infer<typeof WhiteboardReceiptSchema>;
export type WhiteboardLedger = z.infer<typeof WhiteboardLedgerSchema>;
export type WhiteboardPriceTag = z.infer<typeof WhiteboardPriceTagSchema>;
export type WhiteboardInventory = z.infer<typeof WhiteboardInventorySchema>;
export type WhiteboardBudgetPlate = z.infer<typeof WhiteboardBudgetPlateSchema>;
export type WhiteboardPictograph = z.infer<typeof WhiteboardPictographSchema>;
export type WhiteboardBeadString = z.infer<typeof WhiteboardBeadStringSchema>;
export type WhiteboardTally = z.infer<typeof WhiteboardTallySchema>;
export type WhiteboardFractionCircle = z.infer<typeof WhiteboardFractionCircleSchema>;
export type WhiteboardStack = z.infer<typeof WhiteboardStackSchema>;
export type WhiteboardSequenceCompare = z.infer<typeof WhiteboardSequenceCompareSchema>;
export type WhiteboardTimeline = z.infer<typeof WhiteboardTimelineSchema>;
export type WhiteboardCycle = z.infer<typeof WhiteboardCycleSchema>;
export type WhiteboardBeforeAfter = z.infer<typeof WhiteboardBeforeAfterSchema>;
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
    case 'bar_model':
      return [whiteboard.label, whiteboard.whole.label, ...whiteboard.parts.map((p) => p.label)];
    case 'part_whole':
      return [whiteboard.label, whiteboard.whole.label, whiteboard.left.label, whiteboard.right.label];
    case 'flow':
      return [whiteboard.label, whiteboard.income.label, whiteboard.spent.label, whiteboard.keptLabel];
    case 'goal_bar':
      return [whiteboard.label, whiteboard.goal.label, whiteboard.saved.label];
    case 'worked':
      // Steps are a closed operator enum and bounded numbers; the caption is
      // the whole of this board's free text.
      return [whiteboard.label];
    case 'ten_frame':
    case 'open_number_line':
    case 'array':
    case 'fraction_strip':
      // Numbers and closed vocabularies throughout — the caption is all the
      // learner-facing prose these carry.
      return [whiteboard.label];
    case 'partition':
      return [whiteboard.label, ...whiteboard.splits.map((s) => s.label)];
    case 'table':
      return [whiteboard.label, ...whiteboard.options.map((o) => o.label)];
    case 'scale':
      return [whiteboard.label, whiteboard.left.label, whiteboard.right.label];
    case 'two_bins':
      return [whiteboard.label, ...whiteboard.binLabels, ...whiteboard.items.map((i) => i.label)];
    case 'venn':
      return [whiteboard.label, whiteboard.leftLabel, whiteboard.rightLabel, ...whiteboard.items.map((i) => i.label)];
    case 'ranking':
      return [whiteboard.label, ...whiteboard.items.map((i) => i.label)];
    case 'outcomes':
      // The only board whose content is PROSE. Every string on it is moderated,
      // which is exactly why `detail` is capped as hard as it is.
      return [whiteboard.label, whiteboard.good.label, whiteboard.good.detail, whiteboard.bad.label, whiteboard.bad.detail];
    case 'trade':
      return [
        whiteboard.label,
        whiteboard.left.who,
        whiteboard.left.gives,
        whiteboard.left.gets,
        whiteboard.right.who,
        whiteboard.right.gives,
        whiteboard.right.gets,
      ];
    case 'chance':
      return [whiteboard.label, ...whiteboard.outcomes.map((o) => o.label)];
    case 'deal':
      return [whiteboard.label, ...whiteboard.bins];
    case 'change':
    case 'regroup':
      return [whiteboard.label];
    case 'equation_bar':
      return [whiteboard.label, ...whiteboard.left.map((t) => t.label), ...whiteboard.right.map((t) => t.label)];
    case 'receipt':
      return [whiteboard.label, ...whiteboard.lines.map((l) => l.label)];
    case 'ledger':
      return [whiteboard.label, ...whiteboard.entries.map((e) => e.label)];
    case 'price_tag':
      return [whiteboard.label, whiteboard.item];
    case 'inventory':
      return [whiteboard.label, whiteboard.item];
    case 'budget_plate':
      return [whiteboard.label, ...whiteboard.items.map((i) => i.label)];
    case 'pictograph':
      return [whiteboard.label, ...whiteboard.rows.map((r) => r.label)];
    case 'bead_string':
    case 'fraction_circle':
      return [whiteboard.label];
    case 'tally':
      return [whiteboard.label, ...whiteboard.groups.map((g) => g.label)];
    case 'stack':
      return [
        whiteboard.label,
        ...whiteboard.columns.flatMap((c) => [c.label, ...c.parts.map((p) => p.label)]),
      ];
    case 'sequence_compare':
      return [whiteboard.label, ...whiteboard.tracks.map((t) => t.label)];
    case 'timeline':
      return [whiteboard.label, ...whiteboard.events.map((e) => e.label)];
    case 'cycle':
      return [whiteboard.label, ...whiteboard.steps];
    case 'before_after':
      return [whiteboard.label, whiteboard.what];
    case 'grab':
      return [whiteboard.label, ...whiteboard.binLabels, ...whiteboard.items];
    case 'fill':
      // `container` is a closed 3-value enum, never free text; the caption
      // is this board's whole learner-facing prose surface.
      return [whiteboard.label];
    case 'whatif':
      return [whiteboard.label, ...whiteboard.branches.map((b) => b.label)];
    case 'your_turn':
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
