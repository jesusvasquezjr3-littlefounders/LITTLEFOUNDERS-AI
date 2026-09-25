// write stage — skeleton → full LessonDocument (COURSE_ENGINE.md §4).
// DeepSeek, temp 0.4, JSON mode, es-MX first (the authoring locale).
// Corrective retries (max 4) feed truncated Zod issues back to the model;
// if those are exhausted, one last-resort regen at temp 0.2 gets a final
// chance to fulfill the entire blueprint. Per-segment salvage is diagnostics
// only and happens after that final complete-document attempt.

import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
import { getConfig } from '../env.js';
import {
  effectiveDifficulty,
  renderReviewSourcesBlock,
  renderCompetencyBlockForPrompt,
  CONSOLIDATION_INSTRUCTION,
  INTERLEAVE_INSTRUCTION,
  connectToPriorInstruction,
  registerToneInstruction,
  type PlanContext,
  type PlanSkeleton,
} from './plan.js';
import type { FactsFile } from '../catalog/schema.js';
import { lessonDocumentSchema, type LessonDocumentParsed } from '../contract/schema.js';
import { lessonMetaSchema, lessonScoringSchema } from '../contract/core/schemaBase.js';
import { TYPE_TO_SCHEMA, GRADED_TYPES } from '../contract/registry.js';
import { shapeExample } from './shapeExample.js';
import type { LessonLocale } from '../contract/core/types.js';
import { runAllGates, type GateContext } from './gates.js';
import { ICON_PALETTE } from './generationQuality.js';
import { CONTENT_PLAYBOOK, tierReasoningGuidance } from './contentPlaybook.js';
import { contentGateGuidance, lessonPolicyGuidance } from '../contentGates/guidance.js';
import { audienceForTier } from '../contentGates/budgets.js';
import { withCorrectiveRetry, safeJsonParse, formatZodIssues, CorrectiveRetryExhaustedError } from './correctiveRetry.js';

const MAX_WRITE_ATTEMPTS = 4;
const MIN_SALVAGE_SEGMENTS = 6;

/*
 * Keep the schema's smallest interactive collections visible beside the
 * skeleton. The shape examples intentionally use tiny placeholders, so a
 * reasoning model can otherwise copy a one-item example into a field whose
 * real schema requires several choices. This is a prompt aid only: Zod and
 * the deterministic gates remain the authority.
 */
const SEGMENT_MINIMUMS: Readonly<Record<string, ReadonlyArray<readonly [string, number]>>> = {
  sort_buckets: [['payload.items', 4]],
  needs_wants: [['payload.items', 4]],
  dialogue_choice: [['payload.turns', 2], ['payload.turns[].replies', 2]],
  // quiz_mcq answers live in payload.options (schema: min 2, max 6) — it has no
  // `items` field, and directing the model at one would author a silently
  // stripped key while omitting the required options.
  quiz_mcq: [['payload.options', 3]],
  picture_choice: [['payload.options', 2]],
  choice: [['payload.options', 2]],
};

export function renderSegmentMinimums(segments: readonly PlanSegmentLike[]): string {
  return segments
    .flatMap((segment, index) =>
      (SEGMENT_MINIMUMS[segment.type] ?? []).map(
        ([path, minimum]) => `segment ${index + 1} (${segment.type}) ${path} MUST contain at least ${minimum} entries`,
      ),
    )
    .join('; ');
}

type PlanSegmentLike = { type: string };
const WRITE_ISSUE_TRUNCATE = 6;

export interface WriteInput {
  ctx: PlanContext;
  skeleton: PlanSkeleton;
  facts: FactsFile;
  locale: LessonLocale;
  slug: string;
  subject: string;
  /**
   * When provided, the deterministic gates run INSIDE the corrective-retry
   * loop: a Zod-valid document that fails a gate (uncast character, generic
   * explanation_md, wrong savings arithmetic, missing {{n}} markers…) gets
   * the gate's actionable message fed back for another attempt instead of
   * failing the slot outright. Found on the first real QA run (2026-07-13):
   * gate messages are exactly the kind of feedback the model fixes on the
   * next try, but they were thrown away — a whole slot died for a one-line
   * fixable problem. run.ts still re-runs gates afterwards as the final
   * authority (the salvage/last-resort paths here bypass this loop).
   */
  gateCtx?: GateContext;
}

export interface WriteResult {
  document: LessonDocumentParsed;
  attempts: number;
  salvaged: boolean;
  droppedSegments: number;
  /** Bounded schema/gate feedback from the final failed full-document attempt. */
  lastIssues?: string;
}

export interface WriteDeps {
  ledger?: UsageLedger;
  complete?: typeof completeDeepSeek;
}

export function renderFactsBlock(facts: FactsFile, refs: readonly string[]): string {
  if (refs.length === 0) return '(no fact refs for this topic — use only round numbers consistent with the blueprint)';
  return refs
    .map((ref) => {
      const entry = facts.facts[ref];
      if (!entry) return `${ref}: (unresolved fact ref)`;
      const valueStr = Array.isArray(entry.value) ? entry.value.join(', ') : JSON.stringify(entry.value);
      return `${ref}: ${valueStr}${entry.unit ? ` ${entry.unit}` : ''}${entry.label_es ? ` — ${entry.label_es}` : ''}`;
    })
    .join('\n');
}

/**
 * Exported so an out-of-pipeline authoring harness can render the SAME rules
 * instead of paraphrasing them into a second copy that silently drifts (the
 * contract-copy lesson in AGENTS.md, applied to prompts). Read-only: never
 * mutate this array — it is the byte-stable head of the cached prompt prefix.
 */
export const BASE_HARD_RULES = [
  'Output STRICT JSON only: {"schema_version":1,"meta":{...},"scoring":{...},"segments":[...]}. No markdown fences, no prose outside the JSON.',
  'Produce EXACTLY one segment per skeleton entry, IN THE SAME ORDER, with the SAME `type` as the skeleton.',
  'Every segment.id must be unique within the document (short kebab-case, e.g. "s1-intro").',
  'XP bands by difficulty: 1→5-10, 2→10-20, 3→15-30, 4→25-40, 5→35-50 (story-family segments always use xp:0).',
  'Segments with difficulty >= 3 MUST include at least one `hints` entry (max 2, progressive).',
  'Every WRONG option in choice/analyze-style segments MUST carry `rationale_md` explaining why it is tempting but incorrect (P7). Correct options may omit it.',
  'narrator.character and meta.cast use ONLY: dina, liruf, rho, zara. Never any other name.',
  'NEVER introduce a generic, unnamed bystander ("un isleño", "a villager", "otro niño", "someone") as a second party in a scene or decision — a trading partner, a disagreeing neighbor, the other half of a trade, ALWAYS gets one of the 4 canonical names (whichever is not already occupied in that scene). The judge treats an anonymous stand-in as weak grounding and fails the lesson on concreteness even when everything else is right — a named character costs nothing extra and always satisfies it.',
  'meta.cast MUST list EVERY one of those 4 names that appears ANYWHERE in the document (any narrator.character, any payload character/dialogue field) — no omissions, no extras.',
  'meta.locale = "es-MX", meta.subject as given, meta.slug as given, scoring.hearts = null, scoring.pass_threshold = 70, scoring.hint_penalty_pct = 10, scoring.max_attempts = 2.',
  'Whenever you write `explanation_md` (optional, but if present): at least 40 characters, AND it must contain a specific number, OR one of dina/liruf/rho/zara by name, OR a word/phrase that also appears in that same segment\'s `payload` — a generic "¡Muy bien! Elegiste la opción correcta." is REJECTED.',
  'explanation_md is OUTCOME-NEUTRAL: it is shown after both correct AND incorrect attempts, so it must TEACH the concept, never assume success. Never open it with "¡Exacto!", "¡Correcto!", "¡Muy bien!", "¡Así es!" or similar — state the fact/why directly (e.g. "El vaso cuesta 5 pesos porque…").',
  'NEVER leak the answer: the `prompt_md`, `hints`, and `meta.objectives` must NOT state or spell out the correct choice/number/word. Hints scaffold the thinking ("piensa en cuánto cuesta cada vaso"), they do not give the answer ("la respuesta es 5"). The kid must reason to the answer.',
  'The engine is TAP-TO-PLACE for every placement type EXCEPT sort_buckets/group_sets (which also support real dragging). For sort_buckets/group_sets, "arrastra"/"drag" OR "toca"/"tap" are both fine. For EVERY OTHER type (order_steps, match_pairs, build_sentence, etc.) never write "arrastra"/"arrastrar"/"drag" — say "toca" (tap). Do NOT rely on option ORDER either — the engine shuffles every answer bank at render time, so the position you author is NOT the position the child sees: never write "elige la primera opción", and never assume your ordering survives. CRUCIALLY, this also means you must NOT CLUSTER THE ANSWERS: do not author all the correct/target items first (or contiguously) in `items`/`options`/`flags`/`justifications`/`sentences`. Scatter targets through the list. Clustering was found in shipped content — every speed_tap target sat in the first five slots and every true_false correct justification came first — which is a leak the moment any renderer displays a bank verbatim.',
  'best_decision / would_you_rather / story_branch / dialogue_choice `qualities` are on a 0-100 scale (the BEST choice ≈ 90-100, a poor choice ≈ 0-30) — NEVER a 0-1 scale, and never all zeros. The correct answer must be able to reach a passing score.',
  'best_decision segments ONLY: unlike quiz_mcq/picture_choice/confidence_quiz (which have ONE correct option and may omit `rationale_md` on it), best_decision has NO correct/wrong split — it is scored by `qualities` (0-100 per option) — so `rationale_md` is REQUIRED on EVERY option, including the best one: explain what makes it the better (or worse) trade-off.',
  'compare_table segments ONLY: `answer.cells` keys use the "<row_id>:<col_id>" COLON form (e.g. "proveedor-a:precio") — never an underscore or any other separator; the player only ever submits colon keys. SOLVABILITY (HARD GATE): the table renders with EMPTY cells and a token bank — there is NO separate data panel, so the child\'s ONLY source of truth is prompt_md. You MUST name EACH row together with its value in prompt_md, e.g. "Doña Lula vende los 10 limones por 5 pesos; Don Pepe los vende por 6 pesos." — putting the prices in a hint, explanation, or nowhere leaves the child guessing which row is which and FAILS the gate. Never require the child to COMPUTE a cell (no price-per-unit division, no hidden totals): compare DIRECT values for the SAME quantity so the comparison is read, not calculated. The ONLY cell the child derives (never stated) is the "best choice" decision cell. Every token text must be DISTINCT — never two tokens with identical text bound to different cells (they render indistinguishable and fail at random); if two cells share a value, drop that column.',
  'icon / art.icon / ask_icon / a_icon / b_icon values MUST come from the ALLOWED ICONS list included below — never any other name, never an invented one ("lemonade", "piggy_bank", "counter_1" all fail validation and kill the lesson). When unsure, prefer a plain, common glyph from the list.',
  'fill_blank segments ONLY: `payload.text_md` MUST contain a `{{1}}`, `{{2}}`… marker (matching each `answer.gaps[].gap` number, 1-indexed, in order) at the exact point each blank belongs — one marker per gap, no exceptions.',
  'savings_goal segments ONLY: OMIT `answer.correct` entirely — the grader computes it automatically as ceil(`payload.goal` / weekly) from `payload.goal`/`payload.weekly_options`. If you do include it, every key must be the exact string form of one of the `weekly_options` numbers (e.g. "20"), never a label like "weeks". CRITICAL: `payload.goal` must be the FULL amount the child divides — the prompt must NOT say part of it is "already saved"/"ya tiene $X" (the grader ignores any pre-saved amount, so the on-screen-correct answer would be graded wrong). If some is already saved, set `goal` to the REMAINING amount. And keep the UNIT consistent: the widget counts weeks — the prompt must say "semanas", not "domingos"/"días"/other unit.',
  'IMAGES ARE FILLED AUTOMATICALLY — NEVER invent any `image_url` / `a_image_url` / `b_image_url` / `ask_image_url` (no "https://example.com/…" or any placeholder). OMIT every image_url field entirely; a later stage generates a real AI illustration only for a SHORT, LITERAL noun phrase (at most four words: "concha brillante", "barco pirata"). Never use a concept ("deseo"), question, price, sentence, action, person or character as an image label: retain the icon/text fallback for those. For picture_choice and other visual tiles, design the option labels as concrete objects whenever the visual is needed. Use a valid `icon` fallback from the ALLOWED ICONS list in every case.',
  'type_answer segments ONLY: the accepted answer MUST be the NUMBER that RESULTS from a one-step calculation the child performs — NEVER a vocabulary word and NEVER a definition-recall question ("¿Cómo se llama…?"), which the judge fails as memorization. E.g. "Liruf vendió 3 vasos de 5 pesos. ¿Cuántos pesos juntó?" → `answer.accept: ["15"]`. Put the numbers needed in prompt_md, and NEVER state or hint the resulting number in prompt_md/hints/explanation. (If a word answer is truly wanted, use a different type — type_answer here is applied arithmetic.)',
  'count_objects segments ONLY (REQUIRED): give EACH `payload.scene[]` item a short `label` naming the object to draw and count (e.g. "moneda", "vaso de limonada", "limón"), and set `payload.ask_label` to the object the child must count. These labels are MANDATORY — they drive the real illustration + accessibility; omitting any of them fails the gate and the lesson regenerates.',
  'order_steps segments ONLY: if EVERY entry in `payload.items` belongs in the sequence, OMIT `payload.slots` entirely. If you include a distractor item that should NOT be placed (e.g. an extra step that doesn\'t belong), you MUST set `payload.slots` to the exact count of items that DO belong — which must equal `answer.order.length` exactly. Getting this wrong makes the exercise unwinnable (every submission scores 0). rank_choices and timeline_order have NO distractor support — `answer.order` there must include EVERY item/event, no exceptions.',
  'memory_flip segments ONLY: every pair needs `a_icon` AND `b_icon` (real Material Symbols, one per side) — NEVER invent `a_image_url`/`b_image_url` (OMIT them; the image stage fills them in). Each pair\'s a_md/b_md match must be UNIQUE within the segment: no other pair may share an equivalent value on either side, or two different pairs become interchangeably "correct" and the fixed-slot match breaks.',
  'coin_count / make_change segments ONLY: the player renders a target amount + a palette of coin/bill buttons the child TAPS to ASSEMBLE a tray that must SUM to the target (the grader passes when tray sum === target). There is NO yes/no button and NO way to answer a sufficiency question. So prompt_md MUST ask the child to FORM / GATHER / COUNT OUT the exact amount and STATE that amount (e.g. "Junta monedas para formar 5 pesos" / "Arma el cambio de 3 pesos"). NEVER pose a yes/no question ("¿tiene suficiente?", "¿le alcanza?", "¿basta para…?") — the mechanic cannot express it and the gate rejects it. The palette may be tapped as many times as needed, so `payload.denominations` MUST NOT add up to exactly the amount: if they do, tapping ONE OF EVERY coin already sums to the target and scores 100 with no arithmetic (gate rejects it). Offer a palette whose total differs from the amount — e.g. target 5 with [1, 2, 10] (1+2+10 = 13), never target 8 with [1, 2, 5]. coin_count ALSO renders the target amount on screen, so the target MUST NOT be one of its own `denominations`: if it is, the child just taps the single coin whose label matches the target and scores 100 without counting (gate rejects it). The tray must need at least TWO coins — target 5 with [1, 2, 10] is fine, target 5 with [1, 2, 5] is not.',
  'piggy_split segments ONLY: the child moves each jar up/down in fixed `payload.step` increments (default income/10) and CANNOT submit until the jars total the income exactly; the grader gives 100 only when EVERY jar sits inside its `answer.targets` {min,max} range. So: (1) `answer.targets` MUST have exactly one range per `payload.jars[].id` — no jar left out (its money would go uncounted and every submission would score 0) and no key that is not a jar; (2) `step` MUST divide `income` evenly and every range MUST contain a multiple of `step` (income 10 with step 1 and a 6-6 range is fine; a 2.5-3.5 range on a step of 1 is unwinnable); (3) the intended split MUST be UNEVEN — if dividing the income equally between the jars lands inside every range, a child tapping + on each jar in turn until the money runs out scores 100 without reading a single jar label (gate rejects it). Give the jars different jobs with different amounts (e.g. 4 to cover ingredients, 6 to the savings goal) and keep the ranges tight around the amount you mean.',
  'picture_choice segments ONLY: this renders as IMAGE tiles the child taps, so EVERY option MUST carry a short literal `text_md` (or `label`) naming its concrete object (e.g. "Moneda de 10 pesos", "Billete de 20 pesos") — that label is what the image stage illustrates; an option with no label renders a lone fallback icon next to real photos (inconsistent and confusing). The prompt MUST be answerable from THIS segment\'s own screen: state the deciding fact here — NEVER "según la conversación / el diálogo / la historia anterior" pointing at a different segment the child can no longer see or hear.',
  'sort_buckets / group_sets / needs_wants segments ONLY: every item must be UNAMBIGUOUSLY placeable in exactly one bucket using ONLY the on-screen prompt criterion — no item that a reasonable 6-13yo could defensibly put in either bucket (e.g. for a lemonade stand do NOT key "Hielo" as "can wait": ice reads as needed to sell cold lemonade). State the context the classification depends on IN THE PROMPT — e.g. say the stand sells LEMONADE, so a paleta clearly is not a need — never leave that fact only in a penalized hint. If an item is genuinely borderline, drop it or pick a clearly-one-sided item. needs_wants specifically: `answer.needs_ids` MUST key BOTH sides — roughly half the items as needs and half as wants, NEVER every item and NEVER none. The child answers Need/Want on every card, and a one-sided item set means "tap the same chip on all of them" is right by default (gate rejects it).',
  'order_steps / rank_choices / build_sentence / timeline_order / code_order that grade a FINE order ONLY: a child giving a DEFENSIBLE alternative order must not be marked wrong. If two adjacent items could reasonably swap (e.g. "buy limones" vs "buy vasos"; "verify price" vs "take payment") or a sentence has two valid phrasings ("2 vasos por 10 pesos" vs "10 pesos por 2 vasos"), you have THREE options: (1) make the criterion explicit in the prompt so exactly one order is right; (2) use a task with a genuinely-determined sequence; or (3) list EVERY equally-valid ordering in `answer.accept_orders` — an array of full id-orderings, each the SAME items as `answer.order` (the grader scores against `order` and every `accept_orders` entry and keeps the best). Prefer (3) whenever real-world order is genuinely flexible. Never rely on a penalized hint to justify the order.',
  'NEVER PUT THE ANSWER, OR AN IMPOSSIBLE INSTRUCTION, IN THE PROMPT (hard gate). match_pairs: prompt_md is the INSTRUCTION ONLY ("Une cada producto con su precio") — never list the pairings ("vaso chico 5, jarra 20"), or the child just transcribes your prompt onto the board. debug_hunt: the widget only lets the child TAP the faulty block, so ask them to FIND it — never "y corrígela"/"corrige"/"escribe la versión correcta", because there is no text field and the fix only appears after grading (put the correction in answer.fix_md, which is the feedback). spot_error: identical mechanic, identical rule — the child can ONLY tap a step, so ask them to FIND the wrong one; never "y corrígela"/"corrige la suma"/"escribe el total correcto", because the corrected arithmetic belongs in answer.correction_md and only appears after grading. ANY artifact list (sentences/lines/rows/items/blocks) that contains a line labelled "Total"/"Suma" MUST add up EXACTLY: a receipt reading 15 + 8 + 12 with "Total 47" contradicts itself, and checking arithmetic is precisely what this course teaches.',
  'NO EXERCISE MAY BE PASSABLE BY A MECHANICAL STRATEGY (hard gate). Before you finish a segment, ask: could a child score a pass by tapping everything, tapping nothing, tapping in the order shown, or copying a value straight out of the prompt — without doing the thinking the lesson is about? If yes, redesign it. Concretely: red_flags/speed_tap MUST include clearly-innocent items to leave alone (never mark every item a target); equation_builder MUST include distractor tokens (a wrong operand/operator) so the bank poses a choice instead of filling the slots exactly; build_sentence and every other ordering type (order_steps, rank_choices, timeline_order) grade the ORDER as the objective, so an order that is not EXACTLY right — or exactly one of your `accept_orders` — is capped below the pass mark however close it looks: never design an ordering exercise expecting near-misses to pass, and list every genuinely-valid ordering in `accept_orders` instead; budget_fit needs must consume enough of the budget that working out what ELSE fits is the real task (if the needs alone fit, buying only the needs already scores 100).',
  'spot_error segments ONLY: the child taps the step(s) that are WRONG, and the grader compares the SET they tapped against `answer.error_ids` (an F1 over the two sets: tapping a correct step costs, and so does missing a flawed one — an untapped step earns NOTHING, so a wrong single tap scores 0). Therefore: key ONE flawed step whenever possible (two at most), and make EVERY other step verifiably correct so there is something real to leave alone. NEVER key most of the list as flawed — if the flawed steps are the majority, "tap every step" scores a pass with zero reasoning and the gate rejects the segment. Every `answer.error_ids` entry MUST be an existing `payload.steps[].id` (a made-up id is untappable and makes the exercise unwinnable — also gated), and put the corrected arithmetic in `answer.correction_md`, never in prompt_md. `prompt_md` may ONLY ask them to FIND/TAP the wrong step: this widget is checkbox cards — no text field and no number pad — so any instruction to correct it, rewrite it or write the right total asks for an answer the child cannot give, and the gate rejects the segment.',
  'yes_no_cases segments ONLY: the widget makes the child press Yes or No on EVERY case before it will submit, and the score is the average of two halves — how many applying cases they caught, and how many non-applying cases they left alone. So `answer.applies_ids` MUST be genuinely MIXED: at least one case the rule clearly DOES cover and at least one it clearly does NOT. Never key every case, and never key none of them — a one-sided key makes "press No on all of them" (or "press Yes on all of them") the answer itself, worth 100 with no thinking, and the gate rejects the segment. Every id in `answer.applies_ids` must be one of the `payload.cases[].id` values. The split does NOT have to be even: 2 applying out of 8 is fine and grades fairly.',
  'balance_scale segments ONLY: the child taps weights from `payload.weights` to make the right plate sum EXACTLY to the fixed left plate (`payload.left_fixed`). The bank MUST hold MORE total weight than the left plate — if the bank sums to exactly the target, "tap everything" always balances and the child passes with zero reasoning (gate rejects it). Include extra/distractor weights (ideally mixed values, e.g. 3s and 2s) so choosing WHICH weights to place is the exercise, and make sure some subset hits the target exactly (otherwise it is unwinnable — also gated).',
  'measure_read segments ONLY: the interactive instrument (`payload.instrument`: ruler / scale / jug / thermometer …) MUST match what the prompt asks the child to read. A prompt about liquid rising in a measuring jug with a `ruler` instrument is a theme mismatch that confuses the child about what they are reading — pick the instrument that physically fits the quantity being measured.',
  'measure_read segments ONLY — THE DIAL MUST BE READABLE (hard gate): the instrument draws `payload.ticks` evenly spaced marks and labels ONLY `min` and `max`, so the child reads the value by COUNTING marks. Therefore: (1) `answer.value` MUST equal `payload.pointer_value` (the drawn needle is the truth — a mismatch makes a perfectly-read answer score 0); (2) pick `ticks` so the step (max − min) / (ticks − 1) is a round amount (e.g. 1, 5, 10, 50) AND the pointer lands EXACTLY on a mark — 0-400 ml over 8 marks is a step of 57.142857 and puts a 250 ml pointer between two marks, which no child can read (use 9 marks: step 50, pointer on mark 6); (3) keep `answer.tolerance` well below one step (0 is right when the pointer is on a mark) — a tolerance as wide as the step means misreading by a whole mark still passes.',
  'number_line segments ONLY — THE CHILD CAN ONLY TAP A MARK (hard gate): the line is divided into `payload.ticks` EQUAL STEPS (so `ticks` is the number of DIVISIONS, not of labelled marks: a 0-100 line counted by tens is ticks: 10, which draws 11 marks at 0, 10, 20 … 100), and every tap and slider drag SNAPS to one of those marks. So `answer.value` MUST land exactly on a mark: (max − min) / ticks must divide (answer.value − min) evenly. A 0-100 line with ticks: 11 steps by 9.09 and the child literally cannot place 20 — the gate rejects it. Keep `full_credit_delta` at about one step or less and `zero_credit_delta` at a small multiple of it: if a generous tolerance makes most of the line score a pass, "tap anywhere" wins and the gate rejects that too. Only `min` and `max` are labelled unless you set `labels: true`, so state the value the child must place in prompt_md.',
  'machine_io segments ONLY — THE CONTROL MUST FIT THE KEY (hard gate): if you include `payload.options` the child taps a CARD, so the key MUST be `answer.correct_option_id` (one of those option ids); if you OMIT `payload.options` the child types on a NUMBER PAD, so the key MUST be a numeric `answer.value`. Mixing them (options + only `value`, or no options + only `correct_option_id`) means the child submits something the grader does not read and EVERY answer scores 0. A machine whose outputs are WORDS therefore REQUIRES options — a number pad cannot type "grande". And `payload.probe_in` must NOT repeat any `examples[].in`: if it does, the answer is already on screen and the child copies the row instead of inducing the rule.',
  'debug_hunt segments ONLY: key ONE faulty block in `answer.bug_ids` (two at most) and make EVERY other block verifiably correct — the grader rewards finding the bug and penalises tapping clean blocks, so there must be clean blocks to leave alone (keying all of them lets "tap everything" score 100, which the gate rejects). Every `answer.bug_ids` entry MUST be an existing `payload.blocks[].id`; a made-up id is untappable and the exercise becomes unwinnable.',
  'code_order segments ONLY: the block bank is shuffled at render time by a function of the SEGMENT id and the BLOCK IDS — reordering `payload.blocks` changes nothing, and a segment whose shuffled bank happens to read in solution order (either direction) is rejected by the gate. If that fires, RENAME the block ids (they are internal — give each one a word that describes its step) so the shuffle lands elsewhere.',
  'equation_builder segments ONLY: each `answer.accepted` entry is a SPACE-SEPARATED SEQUENCE OF TOKEN IDS from `payload.tokens` (e.g. "t1 t3 t2" where t1.text="2", t3.text="+", t2.text="3") — NEVER the rendered equation text like "2+3=5". The token texts, concatenated in that order, must evaluate arithmetically to `payload.target_result` (it is re-executed). Do NOT include an "=" token: the sequence is only the left-hand expression.',
  'pattern_complete segments ONLY — READ CAREFULLY, this type is easy to get wrong: `payload.sequence` is the VISIBLE part of the pattern (the tiles ALREADY shown, complete, WITHOUT the missing item). The engine draws `missing_slots` EMPTY slots AFTER the sequence; the child fills them from `payload.options`. So DO NOT put the missing item inside `sequence`. `answer.correct` keys are the ZERO-BASED slot indexes ("0", plus "1" only if missing_slots=2) — NOT a sequence index like "5" — and values are ids from `payload.options`.',
  'pattern_complete VISUAL RULE: the pattern MUST be readable purely by LOOKING at the tiles, because the only things rendered are each tile\'s ICON (shape) and TINT (color). So build the pattern out of DISTINCT ICONS and/or DISTINCT TINTS that repeat obviously (e.g. lemon→cup→lemon→cup→?, or a primary→accent→primary→accent color beat). NEVER a pattern of SIZE, PRICE or amount (chico/mediano/grande, $5/$10/$15) — identical tiles cannot show size, so it is invisible and unsolvable. Keep prompt_md tiny: "¿Qué sigue en el patrón?" — the tiles carry it, no ladder described in text.',
  'pattern_complete OPTIONS RULE (hard gate): the DISTRACTORS must be OTHER TILES FROM THE SAME PATTERN, offered at the wrong beat — never unrelated tiles. For a cup→lemon→cup→lemon→? sequence the options are the cup, the lemon, and (optionally) one more tile that shares its icon or tint with them; NEVER cup + star + moon, because then the only option the child has ever seen IS the answer and "tap the familiar tile" solves it with no pattern reasoning at all (the gate rejects any single-missing-slot segment where fewer than two options are tiles that appear in the sequence). Two options must never be identical in BOTH icon and tint — the child cannot tell them apart, but the grader keys one specific id.',
  'story_branch segments ONLY: EVERY node needs at least 1 entry in `choices` — an ending node uses a single choice with `next: null` (e.g. {"id":"fin","text_md":"Fin de la historia","next":null}); never an empty choices array.',
  'story_branch segments ONLY — WHAT ACTUALLY GETS GRADED (hard gate): the grader averages the qualities of the choices taken at nodes that offer 2-4 choices, and IGNORES one-choice "continue"/ending nodes entirely (the child had no alternative there, so it is not a decision — do not bother keying "Entendido", and never rely on it to lift a score). Therefore: (1) at least ONE node must offer a real 2-4 way decision, or nothing is decided and the gate rejects the segment; (2) `answer.qualities` MUST hold an entry for EVERY choice of EVERY multi-choice node — a choice you leave unkeyed is silently DROPPED from the average, so taking it costs the child nothing and a path that makes one good decision plus unkeyed wrong turns still scores 100 (gate rejects it); (3) key the best turn ≈90-100 and the poor turns ≈0-30 so at least one whole path FAILS and at least one PASSES — if every path already clears pass_threshold there is no wrong turn to take and walking at random passes (gate rejects it), and if no path can reach it the story is unwinnable (also rejected).',
  'would_you_rather segments ONLY: the child makes ONE tap and the score IS the quality you keyed for the side they tapped, so the two sides must NOT both be passable — key the better trade-off ≈90-100 and the weaker one ≈0-30 (never both high, never both zero, or the segment cannot be failed by anybody and the gate rejects it). The genuine-dilemma teaching goes in `reveal_md` (always required, always shown): name what the side they did NOT take would have cost them. Make the weaker side genuinely tempting in `payload`, not obviously silly — the tension is in the wording, the verdict is in the qualities.',
  '`emotion` fields (story_dialogue lines, story_scene, story_branch nodes) are OPTIONAL — if you write one it MUST be EXACTLY one of: neutral, happy, excited, thinking, surprised, encouraging, proud (never any other word, e.g. never "sad"/"confused"/"worried"/"curious"). If none of those fit, OMIT the field entirely rather than inventing one.',
  'NEVER embed an acting/stage direction inside any SPOKEN text field (prompt_md, story dialogue text_md, story_scene body_md, explanation_md, recap_md, hints) — e.g. "¡Vamos! (con entusiasmo)", "(sonríe)", "(smiles)", "(pausa)". These get read aloud verbatim by the TTS and break the narration. Delivery/emotion goes in the STRUCTURED `emotion`/`action` fields only. A parenthetical in spoken text is allowed ONLY when it carries real content (a number, a clarifying example): "(5 pesos)", "(limones, vasos)" are fine; "(con voz suave)" is not.',
  'WRITE SPOKEN TEXT THE WAY A PERSON READS IT ALOUD — every field above is narrated by a TTS that reads the RAW STRING. NEVER use an abbreviation: write "cada uno", never "c/u" (it is read "ce u"); write "aproximadamente", never "aprox."; write "señor", never "Sr."; write "mililitros"/"minutos", never "ml"/"min"; write "primer día", never "1er día". Write units and courtesy titles in full. Do NOT use ALL-CAPS for emphasis on a vowel-less token, and never put a URL or markdown syntax in spoken text. (audiogen normalizes the common cases and REFUSES to synthesize anything it cannot say, so an abbreviation here costs the lesson its audio.)',
  'Write math as words when it is meant to be READ ALOUD in prose ("cinco más cinco"), and as digits+symbols only inside dedicated math widgets (equation_builder tokens, number fields). In spoken text, "+", "=", "%", "×", "÷", "$" are auto-spoken in the lesson\'s language by the audio pipeline, but prefer words in narrative prose for a natural read.',
  'Never write `explanation_md` (or any *_md field) as an empty string `""` — if you have nothing real to add, OMIT the field entirely; an empty string always fails validation.',
  'NEVER emit ANY optional field as `null` — OMIT it entirely instead. This includes `rationale_md` (on a correct option, just leave it out — only WRONG options need it), `audio_segment_id`, `narrator`, `image_url`, `emotion`, `action`, `hints`, `title`. A literal `null` ALWAYS fails validation; the field being absent is how you say "not set".',
  '`tint` fields are ONE of EXACTLY: primary, accent, success, warning, delight — never a color word like "yellow"/"blue"/"green" or any other value.',
  'robot_path `payload.commands` entries are EXACTLY one of: forward, left, right — never "up"/"down"/"move" or any other token. `payload.commands` MUST have AT MOST 3 entries — design a SHORT 2-3 move solution path (a longer maze fails validation). `payload.max_commands` is a SEPARATE field (the child\'s slot budget, may be larger); do not confuse the two.',
  'interest_peek segments ONLY: if `prediction.kind` is "choice", the answer is `correct_option_id` alone — OMIT `value`/`tolerance` entirely. If `prediction.kind` is "slider", the answer is `value` + `tolerance`, and `tolerance` MUST be a positive number greater than 0 (never 0) — pick something proportional to the values in play, e.g. 1-5 units.',
  'interest_peek CONTENT (the kid must PREDICT growth, not read it): STRONGLY PREFER `prediction.kind: "slider"` — the child slides to predict the grown amount, which is a genuine estimate and avoids handing them the answer in a list of options. NEVER state the resulting amount or the per-period gain in `prompt_md`/story — describe the piggy bank as "giving a little extra each week" WITHOUT the number, then ask the child to predict the total after ALL the periods. For slider: set `min` below the principal and `max` above the computed compound value, and `answer.value` to the computed compound value with `answer.tolerance` ~5% (>0). Keep the rate and amounts tiny and whole where possible so a young child can follow "paciente crece de a poquito". (If you must use choice, distractors are growth misconceptions fitting the SAME week count — "stays the same", a linear under/over-guess — NEVER a value implying different periods.)',
  'balance_scale segments ONLY: let leftSum = sum of every `left_fixed[].value`. `payload.weights` (3-8 entries) MUST contain SOME SUBSET of its `value`s that adds up to EXACTLY leftSum (it is re-checked programmatically) — e.g. if leftSum=8, weights could be [5,3,2,4] (5+3=8) or [2,2,4,6] (2+2+4=8); pick the weight values DELIBERATELY to satisfy this, never at random.',
  'Every number you use MUST come from the FACTS block below or be exact arithmetic the blueprint implies — never invent a fact. All arithmetic in `answer` fields must be EXACTLY correct (it is re-executed programmatically and will be rejected if wrong).',
  'story family segments (story_dialogue, story_scene, key_ideas, concept_reveal, checkpoint) carry NO `answer` field and xp:0.',
  'NON-GRADED story-family segments (especially `checkpoint`) MUST end `prompt_md` as an outcome-neutral statement or imperative, NEVER a direct question: there is no input control and a question is therefore unfair. Put reflection in `payload.recap_md` as a statement (e.g. "Recuerda comparar antes de elegir.") rather than "¿Qué elegirías?".',
  '*_md fields use ONLY MarkdownLite: **bold**, *italic*, `code`, line breaks, "- " lists. Nothing else — no headings, no links, no raw HTML.',
  'Write in es-MX, warm and encouraging, at a reading level appropriate for the stated age tier. Never mock a wrong answer (P3).',
  // LF-Brain finding (COURSE_ENGINE.md §4 "gate" stage 6 / judge concreteness):
  // generic, restated content never teaches — ground the lesson in reality.
  'At least ONE segment MUST include a worked CONCRETE instance — a specific number, a named character, or a specific scenario. Never leave the whole lesson in purely abstract phrasing.',
  'eavesdrop (type 57): payload.context_md sets the scene; each line may mark 1-3 money terms/idioms as ==término== INSIDE text_md, and payload.lines[n].notes must carry EXACTLY one kid-words explanation per highlight, in order of appearance (the schema rejects any mismatch). Highlight only REAL expressions of the lesson locale — never invent slang. Follow an eavesdrop with a graded segment that exercises the highlighted idea.',
  'EMOJIS — a light garnish, tightly scoped (hard gate). ALLOWED only in: story-family narration text (story_dialogue line text_md, story_scene body_md, eavesdrop context/lines, key_ideas/concept_reveal body text, checkpoint recap_md) and a segment\'s explanation_md — at most ONE emoji per segment, in roughly 1 of every 3 segments, placed AFTER the words it decorates ("¡Lo lograste! 🎉"), from everyday positive emoji (🎉 ✨ 💡 🍋 🥤 💰 ⭐ 😀 😉 🤔). FORBIDDEN everywhere else: prompt_md, hints, meta fields, and ANY option/item/token/card/label/answer text (they clutter comparisons and distract from the task). The audio pipeline strips emojis before narration, so an emoji must NEVER carry meaning the listener needs — it decorates a sentence that already says everything.',
];

/*
 * PREFIX-CACHE DISCIPLINE (AGENTS.md "Mass generation" #12): DeepSeek's
 * automatic context cache bills identical LEADING tokens ~120x cheaper, so the
 * prompt is assembled static-first — playbook, tier guidance, base hard rules,
 * icon whitelist and meta shape are byte-identical across every write call in
 * a run and form one long cached prefix. Everything per-lesson (directives,
 * context, facts, skeleton, shape examples) comes AFTER. That is also why the
 * base rules are numbered ALONE: appending conditionals into the numbered list
 * used to renumber nothing here (they went last) but the same splice pattern
 * in plan.ts broke its prefix a few hundred tokens in — keep the shape.
 */
export function renderBaseHardRules(): string {
  return BASE_HARD_RULES.map((line, i) => `${i + 1}. ${line}`).join('\n');
}

/** Per-lesson directives — the conditional rules, now OUTSIDE the cached prefix. */
export function buildLessonDirectives(ctx: PlanContext): string {
  const directives: string[] = [];
  if (ctx.review) {
    directives.push(CONSOLIDATION_INSTRUCTION);
    directives.push(`No segment.difficulty may exceed ${effectiveDifficulty(ctx)} in this review lesson.`);
    if (ctx.review.kind === 'review_interleaved' || ctx.review.kind === 'review_quest') {
      directives.push(INTERLEAVE_INSTRUCTION);
    }
  }
  if (ctx.prior) directives.push(connectToPriorInstruction(ctx.prior));
  if (ctx.register?.toneDirectiveEs) directives.push(registerToneInstruction(ctx.register.toneDirectiveEs));
  if (directives.length === 0) return '';
  return ['', 'LESSON DIRECTIVES (non-negotiable for THIS lesson, same force as the hard rules):', ...directives.map((d) => `- ${d}`)].join(
    '\n',
  );
}

function buildWriteMessages(input: WriteInput, factsBlock: string, issues: string | undefined) {
  const system =
    'You are Forge, the WRITE stage of a financial-literacy lesson generator for children (LittleFounders). ' +
    'You expand an approved segment skeleton into a complete, gradeable lesson document. ' +
    'Your job is not just to satisfy the schema — it is to design exercises a child genuinely WANTS to do, at ' +
    'Duolingo/Brilliant quality: concrete, relatable, decision-driven, never a dry recall drill. Follow the CONTENT PLAYBOOK.';

  /*
   * A `retypedFrom` segment carries a brief written for a DIFFERENT mechanic:
   * the planner could not satisfy the mix rules in its allotted attempts, so
   * the deterministic net changed the type and the brief stayed behind. Left
   * unflagged, the author dutifully transcribes a decision-quiz premise into a
   * jar-splitting widget and the child meets an exercise with no relationship
   * to the story it just read — the "question out of nowhere" report of
   * 2026-08-15. Naming the mismatch is what lets the author RE-ANCHOR the
   * premise in the same micro-situation instead of forcing the old one through
   * a mechanic that cannot express it.
   */
  const skeletonText = input.skeleton.segments
    .map((s, i) => {
      const line = `${i + 1}. type="${s.type}" — ${s.brief}`;
      return s.retypedFrom
        ? `${line}\n   ⚠ This brief was written for "${s.retypedFrom}" and the type CHANGED to "${s.type}". Keep the same characters, objects and stakes, but RE-ANCHOR the premise so it is genuinely a "${s.type}" exercise — never force the old premise into a mechanic that cannot express it, and never leave the child with a question the lesson has not set up.`
        : line;
    })
    .join('\n');
  const minimumsText = renderSegmentMinimums(input.skeleton.segments);

  // The model otherwise has to guess each type's `payload`/`answer` field
  // names from nothing but its name — it guesses inconsistently, and
  // usually wrong (confirmed empirically: story_scene alone produced 4
  // different invalid shapes across 4 retries before this existed). One
  // exact JSON shape per DISTINCT type in the skeleton, values are
  // placeholders — content quality is covered by the hard rules above.
  const uniqueTypes = [...new Set(input.skeleton.segments.map((s) => s.type))];
  const shapeExamplesText = uniqueTypes
    .map((type) => {
      const schema = TYPE_TO_SCHEMA.get(type);
      if (!schema) return null;
      return `type="${type}":\n${JSON.stringify(shapeExample(schema))}`;
    })
    .filter((s): s is string => s !== null)
    .join('\n\n');

  // meta/scoring are top-level document fields, not part of any segment
  // schema — HARD_RULES only calls out meta.locale/subject/slug and the
  // scoring literals explicitly; without this, meta.title/estimated_minutes/
  // objectives (all REQUIRED) were routinely omitted entirely, especially
  // under retry pressure (empirically the single largest failure category).
  const metaShapeText = JSON.stringify({ meta: shapeExample(lessonMetaSchema), scoring: shapeExample(lessonScoringSchema) });

  const reviewBlock = input.ctx.review
    ? [
        '',
        `SOURCE TOPICS (this is a ${input.ctx.review.kind} review lesson — ground every segment in these, introduce nothing new):`,
        renderReviewSourcesBlock(input.ctx.review.sources),
      ].join('\n')
    : '';
  const renderedCompetency = renderCompetencyBlockForPrompt(input.ctx.competency, input.ctx.review);
  const competencyBlock = renderedCompetency ? [``, renderedCompetency].join('\n') : '';

  // Static-first assembly — see the prefix-cache note above renderBaseHardRules.
  const user = [
    CONTENT_PLAYBOOK,
    '',
    `AGE-TIER REASONING CEILING for THIS lesson — ${tierReasoningGuidance(input.ctx.tier)}`,
    '',
    // Gates 11-13 stated up front (S05.4a): same numbers the gates enforce, per tier.
    contentGateGuidance(audienceForTier(input.gateCtx?.taxonomy, input.ctx.tier, input.gateCtx?.register ?? 'kid')),
    // Gates 14-16 for THIS lesson (S05.4b): declared concepts, misjudgment episode.
    ...(input.gateCtx?.lessonPolicy ? [lessonPolicyGuidance(input.gateCtx.lessonPolicy)] : []),
    '',
    'HARD RULES (mechanical constraints — the playbook above is the quality bar; these are the non-negotiable format rules):',
    renderBaseHardRules(),
    '',
    // The model used to GUESS icon names from thin air (invented "counter_1",
    // "lemonade", "piggy_bank" — each one kills the lesson at gate 7). Giving
    // it the actual whitelist converts that failure class into a lookup.
    `ALLOWED ICONS (the complete whitelist — every icon-valued field must use one of these): ${[...ICON_PALETTE].join(', ')}`,
    '',
    'EXACT top-level `meta`/`scoring` JSON SHAPE — ALL fields shown are REQUIRED (title, estimated_minutes, and objectives are easy to forget and the document is rejected without them):',
    metaShapeText,
    buildLessonDirectives(input.ctx),
    '',
    'LESSON CONTEXT:',
    `Age tier: ${input.ctx.tier}`,
    `Topic concept: ${input.ctx.topic.concept}`,
    `Learning objective: ${input.ctx.topic.learningObjective}`,
    `Key vocabulary: ${input.ctx.topic.keyVocabulary.join(', ')}`,
    `Micro-objective: ${input.ctx.lesson.microObjective}`,
    `Narrative beat: ${input.ctx.lesson.narrativeBeat}`,
    `Lesson slug: ${input.slug}`,
    `Subject: ${input.subject}`,
    competencyBlock,
    reviewBlock,
    '',
    'FACTS (the ONLY source of numbers, besides pure arithmetic):',
    factsBlock,
    '',
    'SEGMENT SKELETON (expand each into a full segment, in order):',
    skeletonText,
    ...(minimumsText
      ? [
          '',
          'SCHEMA MINIMUMS FOR THIS SKELETON (mandatory; these are counts, not suggestions):',
          minimumsText,
        ]
      : []),
    '',
    'EXACT JSON SHAPE per type used above (field names/nesting/enum options are LAW — never invent, rename, or move a field; `payload`/`answer` sit alongside `id`/`type`/`prompt_md`/`difficulty`/`xp`/`hints`/`narrator` at the segment\'s top level, never nested inside each other):',
    shapeExamplesText,
  ].join('\n');

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];

  if (issues) {
    messages.push({
      role: 'user' as const,
      content: `Your previous JSON failed validation. Fix these issues and resend the FULL corrected JSON document:\n${issues}`,
    });
  }

  return messages;
}

/**
 * Recursively drops object keys whose value is literally `null`. DeepSeek
 * stubbornly emits `null` for optional fields it means to omit
 * (`rationale_md` on a correct option, `audio_segment_id`, `narrator`,
 * `emotion`…) — and does it AGAIN on every corrective retry even with the
 * Zod error fed back and a hard rule forbidding it (observed live 2026-07-23:
 * a quiz_mcq failed all 4 write attempts + salvage + last-resort on the same
 * two nulls). Fighting the model is futile; sanitizing is deterministic. A
 * `null` on an OPTIONAL field becomes "absent" → valid; a `null` on a REQUIRED
 * field becomes "missing" → still a Zod error, correctly. Arrays keep their
 * length (elements recurse). This runs BEFORE every schema check.
 */
/**
 * Keys where `null` is SEMANTIC, not "model meant to omit": story_branch's
 * `choices[].next` (null = ending node — the schema REQUIRES the explicit
 * null; stripping it produced "expected string, received undefined" and
 * exhausted every write retry on story_branch lessons before this list
 * existed), and `hearts` (null = cheer mode). Never strip these.
 */
const SEMANTIC_NULL_KEYS = new Set(['next', 'hearts']);

export function stripNullValues(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripNullValues);
  if (node !== null && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (value === null && !SEMANTIC_NULL_KEYS.has(key)) continue;
      out[key] = value === null ? null : stripNullValues(value);
    }
    return out;
  }
  return node;
}

/**
 * Deterministic content repairs for constraints the model reliably fumbles
 * even with the rule spelled out and the gate message fed back (same
 * "sanitize, don't argue" philosophy as stripNullValues).
 *
 * balance_scale: the puzzle is only solvable when SOME subset of
 * `payload.weights` sums exactly to the left pan's total. DeepSeek picks
 * plausible-looking weights that miss the sum ~often enough to kill slots
 * (observed live 2026-07-23: a whole lesson died on `no subset of weights
 * sums to left_fixed total 8`). When no subset works we overwrite the FIRST
 * weight's value with the exact left-pan total — a single-weight solution
 * always exists after that, every other weight stays as an authored
 * distractor, and the answer key is state-checked (recomputed), so nothing
 * else needs patching.
 */
export function repairDocument(node: unknown): unknown {
  const doc = node as { segments?: unknown; schema_version?: unknown } | null;
  if (!doc || !Array.isArray(doc.segments)) return node;
  /*
   * `schema_version` is a CONSTANT (literal 1), not a judgement — the model has
   * no information we lack. Yet a real 1000-lesson-scale failure died here: after
   * a transient abort and a gate rejection, the last-resort regen returned
   * `schema_version: "1"` (or omitted it) and the slot was lost to
   * `Invalid input: expected 1`. Losing a lesson over a constant we can simply
   * set is indefensible at scale, so set it. Anything genuinely model-authored
   * still fails loudly; this only normalises a field with exactly one legal value.
   */
  if (doc.schema_version !== 1) doc.schema_version = 1;
  for (const seg of doc.segments as Array<Record<string, unknown>>) {
    repairPresentationTokens(seg);
    if (seg?.type === 'balance_scale') repairBalanceScale(seg);
    else if (seg?.type === 'interest_peek') repairInterestPeek(seg);
    else if (seg?.type === 'savings_goal') repairSavingsGoal(seg);
    else if (seg?.type === 'measure_read') repairMeasureRead(seg);
  }
  return node;
}

/*
 * Icon fields are renderer tokens, not authored learning content. Models still
 * occasionally emit a sensible English noun outside our deliberately curated
 * Material Symbols palette (for example `fruit` or `shoes`); that would render
 * as raw text. Map the recurring nouns to approved equivalents and use a
 * truthful generic object fallback for every other unknown token. Likewise,
 * emojis in graded payload text are decoration rather than semantics and are
 * forbidden by the render-quality gate, so remove them before validation
 * instead of spending another full-document completion on presentation-only
 * cleanup.
 */
const ICON_REPAIRS: Readonly<Record<string, string>> = {
  fruit: 'nutrition',
  shoes: 'checkroom',
  shoe: 'checkroom',
  money: 'attach_money',
  coin: 'monetization_on',
  coins: 'monetization_on',
  book: 'menu_book',
  pencil: 'brush',
  toy: 'toys',
  bicycle: 'toys',
};

const EMOJI_TOKEN_RE = /\p{Extended_Pictographic}(?:\uFE0F|\u20E3)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\u20E3)?)*\s*/gu;

/** \u00A9/\u00AE/\u2122 are Extended_Pictographic but they are legal-notation TEXT, never decoration. */
const TEXTUAL_PICTOGRAPHS = new Set(['\u00A9', '\u00AE', '\u2122']);

function stripEmojiTokens(value: string): string {
  const stripped = value
    .replace(EMOJI_TOKEN_RE, (token) => (TEXTUAL_PICTOGRAPHS.has(token.replace(/\uFE0F/gu, '').trimEnd()) ? token : ''))
    .trim();
  // An all-emoji string keeps its original text: collapsing it to '' would turn
  // a presentation-only cleanup into a min-length Zod failure downstream.
  return stripped.length > 0 ? stripped : value.trim();
}

function stripPayloadEmojis(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(stripPayloadEmojis);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') record[key] = stripEmojiTokens(value);
    else stripPayloadEmojis(value);
  }
}

function repairPresentationTokens(seg: Record<string, unknown>): void {
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if ((key === 'icon' || key === 'ask_icon' || key.endsWith('_icon')) && typeof value === 'string' && !ICON_PALETTE.has(value)) {
        record[key] = ICON_REPAIRS[value.toLowerCase()] ?? 'emoji_objects';
      } else {
        visit(value);
      }
    }
  };

  visit(seg.payload);
  if (typeof seg.type === 'string' && GRADED_TYPES.includes(seg.type)) stripPayloadEmojis(seg.payload);
}

/**
 * savings_goal's answer is COMPUTED by the grader (weeks = ceil(goal/weekly)).
 * The model keeps authoring `answer.correct` with wrong weeks (e.g. 2 instead
 * of ceil(80/20)=4), which the arithmetic gate then rejects. The write rule
 * says OMIT it; when the model includes it anyway, drop it — the grader is the
 * source of truth, so a stale/wrong authored key is pure downside.
 */
function repairSavingsGoal(seg: Record<string, unknown>): void {
  const answer = seg.answer as Record<string, unknown> | undefined;
  if (answer && 'correct' in answer) delete answer.correct;
}

function repairBalanceScale(seg: Record<string, unknown>): void {
  const payload = seg.payload as { left_fixed?: Array<{ value?: unknown }>; weights?: Array<{ value?: unknown }> } | undefined;
  const left = Array.isArray(payload?.left_fixed) ? payload.left_fixed : [];
  const weights = Array.isArray(payload?.weights) ? payload.weights : [];
  const values = weights.map((w) => (typeof w?.value === 'number' ? w.value : NaN));
  if (left.length === 0 || weights.length === 0 || values.some(Number.isNaN)) return;
  const leftSum = left.reduce((acc, e) => acc + (typeof e?.value === 'number' ? e.value : 0), 0);
  // subset-sum over ≤8 small weights — brute force is fine
  let solvable = false;
  for (let mask = 1; mask < 1 << values.length && !solvable; mask++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) if (mask & (1 << i)) sum += values[i]!;
    if (Math.abs(sum - leftSum) < 1e-9) solvable = true;
  }
  if (!solvable && weights[0]) weights[0].value = leftSum;
}

/**
 * measure_read is graded on a number the child must READ off an SVG instrument
 * that draws `ticks` evenly-spaced marks and labels only `min` and `max`. The
 * model picks min/max/pointer_value sensibly and then picks `ticks` at random, so
 * the marks land nowhere near the value: the published beaker used 0-400 ml over
 * 8 marks (step 57.142857) with the pointer at 250, i.e. 4.375 marks — with
 * tolerance 0, unreadable and therefore unanswerable. `ticks` is PURE RENDERING
 * geometry (nothing grades it), so instead of failing the lesson we re-choose it:
 * the smallest mark count in the schema's 2-20 range whose step is a round amount
 * (a multiple of 0.1) AND divides the pointer's distance from `min`, so the needle
 * lands exactly on a mark. Nothing else is touched — if no tick count can rescue
 * the scale, gate 8 still reports it with the arithmetic.
 */
function repairMeasureRead(seg: Record<string, unknown>): void {
  const payload = seg.payload as { min?: unknown; max?: unknown; ticks?: unknown; pointer_value?: unknown } | undefined;
  if (!payload) return;
  const { min, max, ticks, pointer_value: pointer } = payload;
  if (typeof min !== 'number' || typeof max !== 'number' || typeof ticks !== 'number') return;
  if (typeof pointer !== 'number' || max <= min || pointer < min || pointer > max) return;
  const isWhole = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
  const readable = (count: number): boolean => {
    const step = (max - min) / (count - 1);
    return isWhole(step * 10) && isWhole((pointer - min) / step);
  };
  if (ticks >= 2 && readable(ticks)) return;
  for (let count = 3; count <= 20; count++) {
    if (readable(count)) {
      payload.ticks = count;
      return;
    }
  }
}

/**
 * interest_peek constraints the model fumbles even with the rule spelled out
 * (observed live: `periods: 1` and `tolerance: 0`, both schema-fatal after
 * every retry). periods < 2 → 2, with `answer.value` recomputed via the SAME
 * compound formula gate 3 re-executes (principal·(1+rate/100)^periods) so the
 * fact gate stays green; tolerance ≤ 0 → ~5% of the computed value (min 1).
 */
function repairInterestPeek(seg: Record<string, unknown>): void {
  const payload = seg.payload as {
    principal?: unknown;
    rate_pct?: unknown;
    periods?: unknown;
    prediction?: { kind?: string; options?: Array<{ id?: string; text_md?: string }> };
  } | undefined;
  const answer = seg.answer as { value?: unknown; tolerance?: unknown; correct_option_id?: unknown } | undefined;
  if (!payload || typeof payload.principal !== 'number' || typeof payload.rate_pct !== 'number') return;
  if (typeof payload.periods === 'number' && payload.periods < 2) {
    payload.periods = 2;
    if (answer && typeof answer.value === 'number') {
      answer.value = Math.round(payload.principal * (1 + payload.rate_pct / 100) ** 2 * 100) / 100;
    }
  }
  if (answer && typeof answer.tolerance === 'number' && answer.tolerance <= 0) {
    const base = typeof answer.value === 'number' ? Math.abs(answer.value) : payload.principal;
    answer.tolerance = Math.max(1, Math.round(base * 0.05));
  }
  // CHOICE mode: the correct option must show ≈ the compound value (gate 4
  // re-executes principal·(1+rate/100)^periods). The model routinely picks a
  // wrong round number; snap the correct option's number to the computed value
  // so the one option that must be right, is — distractors keep their numbers.
  if (
    payload.prediction?.kind === 'choice' &&
    typeof payload.periods === 'number' &&
    answer &&
    typeof answer.correct_option_id === 'string' &&
    Array.isArray(payload.prediction.options)
  ) {
    const computed = Math.round(payload.principal * (1 + payload.rate_pct / 100) ** payload.periods * 100) / 100;
    const option = payload.prediction.options.find((o) => o?.id === answer.correct_option_id);
    if (option && typeof option.text_md === 'string' && /\d/.test(option.text_md)) {
      // Replace the first number token (int or decimal) with the computed value.
      option.text_md = option.text_md.replace(/\d+(?:[.,]\d+)?/, String(computed));
    }
  }
}

interface SalvageOutcome {
  document: LessonDocumentParsed;
  dropped: number;
}

function trySalvage(rawJson: unknown): SalvageOutcome | null {
  if (typeof rawJson !== 'object' || rawJson === null) return null;
  const obj = rawJson as Record<string, unknown>;

  const metaParsed = lessonMetaSchema.safeParse(obj.meta);
  if (!metaParsed.success) return null;
  const scoringParsed = lessonScoringSchema.safeParse(obj.scoring ?? {});
  const scoring = scoringParsed.success ? scoringParsed.data : lessonScoringSchema.parse({});

  const rawSegments = Array.isArray(obj.segments) ? obj.segments : [];
  const seenIds = new Set<string>();
  const validSegments: { id: string; type: string }[] = [];
  let dropped = 0;

  for (const seg of rawSegments) {
    if (typeof seg !== 'object' || seg === null) {
      dropped++;
      continue;
    }
    const type = (seg as Record<string, unknown>).type;
    const schema = typeof type === 'string' ? TYPE_TO_SCHEMA.get(type) : undefined;
    if (!schema) {
      dropped++;
      continue;
    }
    const parsed = schema.safeParse(seg);
    if (!parsed.success) {
      dropped++;
      continue;
    }
    const data = parsed.data as { id: string; type: string };
    if (seenIds.has(data.id)) {
      dropped++;
      continue;
    }
    seenIds.add(data.id);
    validSegments.push(data);
  }

  const gradedCount = validSegments.filter((s) => GRADED_TYPES.includes(s.type)).length;
  if (validSegments.length < MIN_SALVAGE_SEGMENTS || gradedCount < 1) return null;

  const candidate = {
    schema_version: 1 as const,
    meta: metaParsed.data,
    scoring,
    segments: validSegments,
  };
  const finalParsed = lessonDocumentSchema.safeParse(candidate);
  if (!finalParsed.success) return null;
  return { document: finalParsed.data, dropped };
}

export async function writeLessonDocument(input: WriteInput, deps: WriteDeps = {}): Promise<WriteResult> {
  const complete = deps.complete ?? completeDeepSeek;
  const factsBlock = renderFactsBlock(input.facts, input.ctx.topic.factRefs);

  let lastRawJson: unknown;
  let lastIssues: string | undefined;

  try {
    const { data, attempts } = await withCorrectiveRetry<LessonDocumentParsed>({
      maxAttempts: MAX_WRITE_ATTEMPTS,
      callModel: async (issues) => {
        const messages = buildWriteMessages(input, factsBlock, issues);
        const result = await complete(
          // maxTokens explicit: a full lesson document (segments + hints +
          // rationale_md per distractor) can run long, and DeepSeek's
          // implicit default silently truncates mid-string instead of
          // erroring — surfaced live 2026-07-14 as "invalid JSON:
          // Unterminated string" on a content-heavy balance_scale lesson.
          { messages, temperature: 0.4, jsonMode: true, maxTokens: getConfig().FORGE_DOCUMENT_MAX_TOKENS },
          { operation: 'write', ledger: deps.ledger },
        );
        return result.content;
      },
      parse: (raw) => {
        const json = safeJsonParse(raw);
        if (!json.ok) {
          lastIssues = `invalid JSON: ${json.error}`;
          if (process.env.FORGE_DEBUG_WRITE) console.error('DEBUG raw write output (unparseable):', raw);
          return { ok: false, issues: lastIssues };
        }
        lastRawJson = repairDocument(stripNullValues(json.value));
        const parsed = lessonDocumentSchema.safeParse(lastRawJson);
        if (!parsed.success) {
          lastIssues = formatZodIssues(parsed.error.issues, WRITE_ISSUE_TRUNCATE);
          if (process.env.FORGE_DEBUG_WRITE) console.error('DEBUG raw write output:', JSON.stringify(json.value, null, 2));
          return { ok: false, issues: lastIssues };
        }
        if (input.gateCtx) {
          /*
           * Gate 10 is wired HERE and not at run.ts's second gate pass, because
           * this is the only point where the comparison is exact: run.ts may
           * append a recap segment (appendRecapSegment) before it gates, so the
           * document it checks can legitimately be one segment longer than the
           * plan. Here the document is the author's answer to the skeleton and
           * nothing else, and a drift is still inside the corrective-retry
           * loop — the author gets told which position moved and rewrites it.
           */
          const gateReport = runAllGates(parsed.data, {
            ...input.gateCtx,
            plannedSegmentTypes: input.skeleton.segments.map((segment) => segment.type),
          });
          if (!gateReport.ok || !gateReport.document) {
            lastIssues = gateReport.problems
              .slice(0, WRITE_ISSUE_TRUNCATE)
              .map((p) => `[gate ${p.gate}${p.segmentId ? ` @${p.segmentId}` : ''}] ${p.message}`)
              .join('; ');
            return { ok: false, issues: lastIssues };
          }
          return { ok: true, data: gateReport.document };
        }
        return { ok: true, data: parsed.data };
      },
    });
    return { document: data, attempts, salvaged: false, droppedSegments: 0 };
  } catch (err) {
    if (!(err instanceof CorrectiveRetryExhaustedError)) throw err;
  }

  // Corrective retries exhausted — give the author one final chance to return
  // the COMPLETE blueprint. Do not let a partial salvage skip this recovery:
  // release candidates refuse shortened documents, while a clean full redraw
  // can still satisfy every planned segment.
  const messages = buildWriteMessages(input, factsBlock, lastIssues);
  const result = await complete(
    { messages, temperature: 0.2, jsonMode: true, maxTokens: getConfig().FORGE_DOCUMENT_MAX_TOKENS },
    { operation: 'write-last-resort', ledger: deps.ledger },
  );
  const json = safeJsonParse(result.content);
  if (json.ok) {
    const sanitized = repairDocument(stripNullValues(json.value));
    const parsed = lessonDocumentSchema.safeParse(sanitized);
    if (parsed.success) {
      return { document: parsed.data, attempts: MAX_WRITE_ATTEMPTS + 1, salvaged: false, droppedSegments: 0 };
    }
    lastIssues = formatZodIssues(parsed.error.issues, WRITE_ISSUE_TRUNCATE);
  } else {
    lastIssues = `invalid JSON: ${json.error}`;
  }

  // Keep a validated partial document only as failure diagnostics. run.ts
  // refuses it before review/publication, but exposing the dropped count makes
  // the author-quality defect observable rather than silently discarding it.
  const salvage = json.ok ? trySalvage(json.value) : lastRawJson ? trySalvage(lastRawJson) : null;
  if (salvage) {
    return {
      document: salvage.document,
      attempts: MAX_WRITE_ATTEMPTS + 1,
      salvaged: true,
      droppedSegments: salvage.dropped,
      lastIssues,
    };
  }

  throw new Error(
    `write stage: exhausted corrective retries, a full last-resort regen, and diagnostic salvage. Last issues: ${lastIssues ?? 'unknown'}`,
  );
}
