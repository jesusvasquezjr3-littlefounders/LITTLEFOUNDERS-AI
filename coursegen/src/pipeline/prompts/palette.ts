// The 56-type palette prompt (COURSE_ENGINE.md §4/§5) — the single source
// DeepSeek's plan/write prompts render from. PALETTE_GUIDE is typed against
// a hand-written literal union (ExerciseTypeId) mirroring LESSON_ENGINE.md
// §5 exactly, so TypeScript refuses to compile if a type is added to a
// family schema and forgotten here — the runtime half of that guarantee
// (that ExerciseTypeId still matches the ACTUAL contract, not just this
// file's belief about it) is `src/__tests__/palette.test.ts`.

import type { TaxonomyFile } from '../../catalog/schema.js';
import { ALL_TYPES, TYPE_TO_FAMILY, type FamilyName } from '../../contract/registry.js';

// prettier-ignore
export type ExerciseTypeId =
  | 'story_dialogue' | 'story_scene' | 'key_ideas' | 'concept_reveal' | 'checkpoint' | 'eavesdrop'
  | 'quiz_mcq' | 'true_false' | 'picture_choice' | 'odd_one_out' | 'best_decision' | 'yes_no_cases' | 'speed_tap' | 'confidence_quiz'
  | 'type_answer' | 'fill_blank' | 'number_input' | 'estimate_slider' | 'count_objects' | 'equation_builder'
  | 'match_pairs' | 'memory_flip' | 'sort_buckets' | 'order_steps' | 'rank_choices' | 'build_sentence' | 'timeline_order' | 'pattern_complete' | 'group_sets' | 'number_line'
  | 'coin_count' | 'make_change' | 'piggy_split' | 'needs_wants' | 'price_compare' | 'budget_fit' | 'savings_goal' | 'fair_trade' | 'interest_peek'
  | 'spot_error' | 'cause_effect' | 'compare_table' | 'read_chart' | 'evidence_hunt' | 'red_flags' | 'fact_opinion'
  | 'story_branch' | 'dialogue_choice' | 'flash_match' | 'lightning_round' | 'would_you_rather'
  | 'code_order' | 'robot_path' | 'debug_hunt' | 'balance_scale' | 'measure_read' | 'machine_io';

/** One terse line per type: pedagogical trigger + exact payload/answer field contract (LESSON_ENGINE.md §5). */
export const PALETTE_GUIDE: Record<ExerciseTypeId, string> = {
  // -- story (content, ungraded, xp:0) --
  story_dialogue: 'Narrative beat via character lines. payload:{lines:[{character,emotion?,action?,text_md}] 1-12}. No answer.',
  story_scene: 'One illustrated beat. payload:{backdrop, character?, emotion?, action?, body_md, art?:{icon,tint}}. No answer.',
  key_ideas: 'Takeaway cards. payload:{ideas:[{icon,title,body_md}] 2-5}. No answer.',
  concept_reveal: 'Curiosity-gap flip cards. payload:{cards:[{front_md,back_md,icon?}] 2-6}. No answer.',
  checkpoint: 'Mid-lesson self-check (metacognition, never graded). payload:{recap_md, mood_prompt_md?}. No answer.',
  eavesdrop: 'Overheard money conversation between canon characters, revealed turn by turn; ==highlighted== terms carry tap-to-explain notes (real locale expressions only). payload:{context_md, lines:[{character,emotion?,text_md,notes?}] 2-10}. No answer. Follow with a graded segment exercising the highlighted idea.',
  // -- choice --
  quiz_mcq: 'Single-choice with per-wrong-option rationale. payload:{options:IdText&rationale_md 2-6, shuffle?}. answer:{correct_option_id}.',
  true_false: 'Judge a claim, optionally justify. payload:{statement_md, justifications?:IdText 2-4}. answer:{is_true, correct_justification_id?}.',
  picture_choice: 'Choose the correct VISUAL tile (icon or generated image). payload:{options:[{id,icon,image_url?,label,rationale_md?}] 2-6}. answer:{correct_option_id}.',
  odd_one_out: 'Find the intruder. payload:{items:IdText 3-6, reasons?:IdText 2-4}. answer:{odd_item_id, correct_reason_id?}.',
  best_decision: 'No single right answer — every option rationale teaches. payload:{scenario_md, options:[{id,text_md,rationale_md}] 2-4}. answer:{qualities:{option_id:0-100}}.',
  yes_no_cases: 'Does the rule apply per case? payload:{rule_md, cases:IdText 3-8}. answer:{applies_ids:id[]} (may be empty).',
  speed_tap: 'FLOW: tap everything matching the rule before a gentle timer ends. payload:{instruction_md, items:IdText 6-14, seconds 10-45}. answer:{target_ids:id[]}.',
  confidence_quiz: 'Answer AND rate certainty 50-100 (calibration). payload:{options:IdText&rationale_md 2-5}. answer:{correct_option_id}.',
  // -- input --
  type_answer: 'Type a short answer, fuzzy-matched. payload:{placeholder?, max_chars<=80}. answer:{accept:string[], keywords?, case_sensitive?}.',
  fill_blank: 'Cloze with {{n}} markers in text_md; mode typed or bank (tap-token). payload:{text_md, mode, bank?:IdText}. answer:{gaps:[{gap:n, accept?, bank_id?}]} — one gap object per {{n}} marker, no gaps in excess or missing.',
  number_input: 'Compute a number on the kid pad. payload:{unit?, decimals_hint?}. answer:{value, tolerance}.',
  estimate_slider: 'Slide to estimate magnitude, not precision. payload:{min,max,step?,unit?,scale:linear|log}. answer:{value, full_credit_delta, zero_credit_delta}.',
  count_objects: 'Count target objects in a generated scene. payload:{scene:[{icon,tint?,count}] 1-6, ask_icon}. answer:{value}.',
  equation_builder: 'Build a working expression from number/operator tiles (distractors allowed). payload:{tokens:[{id,text}] 3-12, slots 2-9, target_result}. answer:{accepted:string[]} — canonical token-id sequences (space-joined ids) that evaluate to target_result using ONLY the given tokens.',
  // -- arrange --
  match_pairs: 'Tap-match two columns. payload:{left:IdText 2-8, right:IdText 2-10 (distractors ok)}. answer:{pairs:[leftId,rightId][]}.',
  memory_flip: 'FLOW: concentration/memory game, score derived from flips — NO answer key. payload:{pairs:[{a_md,b_md}] 3-6}.',
  sort_buckets: 'Classify items into buckets. payload:{buckets:IdLabel 2-5, items:IdText 4-16}. answer:{assignments:{item_id:bucket_id}}.',
  order_steps: 'Put procedure steps in order. payload:{items:IdText 3-8}. answer:{order:id[]} length == items.length.',
  rank_choices: 'Rank items by a stated criterion. payload:{criterion_md, items:IdText 3-7}. answer:{order:id[]} length == items.length.',
  build_sentence: 'Arrange word tiles into the concept sentence (distractors allowed). payload:{tokens:IdText 3-12, slots}. answer:{order:id[]} length == slots.',
  timeline_order: 'Place events left-to-right on a timeline. payload:{events:[{id,text_md,icon?}] 3-7}. answer:{order:id[]} length == events.length.',
  pattern_complete: 'Continue the visual pattern (pre-algebra). payload:{sequence:[{icon,tint}] 3-10, options:[{id,icon,tint}] 3-5, missing_slots 1-2}. answer:{correct:{"slotIndex":option_id}} — one key per missing slot, keys are stringified integers starting at 1.',
  group_sets: 'Venn-style zone sort (set intersection, concretely). payload:{set_a,set_b, items:IdText 4-12}. answer:{zones:{item_id:"a"|"b"|"both"|"none"}}.',
  number_line: 'Tap the position of a value on a number line. payload:{min,max,ticks?,labels?}. answer:{value, full_credit_delta, zero_credit_delta}.',
  // -- money --
  coin_count: 'Tap coins/bills into the tray to pay EXACTLY. payload:{currency, denominations:number[] 2-9, target}. answer:{} (self-contained sum check) — target MUST be reachable as a sum of the given denominations.',
  make_change: 'Give correct change from the till. payload:{currency, denominations 2-9, price, paid_with}. answer:{} (self-contained; correct change = paid_with - price, must be reachable from denominations, paid_with > price).',
  piggy_split: 'Split earnings across 2-4 jars (save/spend/share). payload:{income, unit:currency, jars:[{id,label,icon,hint_md?}] 2-4, step?}. answer:{targets:{jar_id:{min,max}}, rationale_md?} — every jar has a target range and all ranges must be satisfiable summing to income.',
  needs_wants: 'Classic needs-vs-wants sort, as icon cards. payload:{items:[{id,text_md,icon?}] 4-12}. answer:{needs_ids:id[]}.',
  price_compare: 'Which deal is actually better (unit price)? payload:{offers:[{id,label,qty,unit,price}] 2-4, currency}. answer:{best_offer_id} — must be the true lowest unit price among offers.',
  budget_fit: 'Fill the cart within budget without dropping the needs. payload:{budget, currency, items:[{id,label,icon,price,need?}] 4-10, must_buy_needs}. answer:{} (self-contained constraint check vs budget/needs).',
  savings_goal: 'How many weeks to the goal at this rate? payload:{goal, currency, weekly_options:number[] 1-4}. answer:{correct?:{weekly:weeks}} — grader recomputes weeks = ceil(goal/weekly) itself; if provided, values MUST equal ceil(goal/weekly).',
  fair_trade: 'Is the trade fair given the exchange rate? payload:{offer_a:{label,icon,qty}, offer_b:{label,icon,qty}, rate_md}. answer:{verdict:"fair"|"a_wins"|"b_wins"}.',
  interest_peek: 'FLOW: predict compound growth, then watch it happen. payload:{principal, rate_pct, periods 2-10, currency, prediction:{kind:"choice",options:IdText}|{kind:"slider",min,max}}. answer:{correct_option_id?|value?,tolerance?} — value must equal principal*(1+rate_pct/100)^periods within tolerance.',
  // -- analyze --
  spot_error: 'Find the flawed step(s). payload:{context_md?, steps:IdText 3-10}. answer:{error_ids:id[] (>=1), correction_md?}.',
  cause_effect: 'Build the cause->effect chain. payload:{events:IdText 4-9 (distractors ok), slots 3-6}. answer:{chain:id[]} length == slots.',
  compare_table: 'Fill the comparison grid. payload:{rows:IdLabel 2-4, cols:IdLabel 2-3, tokens:IdText}. answer:{cells:{"rowId:colId":token_id}} — one entry per row*col cell.',
  read_chart: 'Read a kid-styled chart and answer. payload:{chart:{kind,series,unit?}, questions:[{id,prompt_md,options:IdText}] 1-3}. answer:{correct:{question_id:option_id}}.',
  evidence_hunt: 'Highlight sentences that support the claim. payload:{claim_md, sentences:IdText 3-12}. answer:{evidence_ids:id[] (>=1)}.',
  red_flags: 'Audit a realistic FAKE ad/message/deal for scam signals (safety-arc adventures only). payload:{artifact_md, artifact_kind, flags:IdText 4-10}. answer:{redflag_ids:id[] (>=1)}.',
  fact_opinion: 'Tag each statement fact vs opinion. payload:{statements:IdText 3-8}. answer:{fact_ids:id[]} — statements NOT listed are opinions.',
  // -- storyplay (flows) --
  story_branch: 'Branching decision story — wrong-ish paths still teach. payload:{start_node, nodes:[{id,text_md,character?,emotion?,choices:[{id,text_md,next}]}] 2-12}. answer:{qualities:[{node_id,choice_id,score:0-100}]} — one entry per choice of every MULTI-choice node (>=1 such node required; one-choice continue/ending nodes are NOT decisions and are not graded). Score the best turn 90-100 and poor turns 0-30 so some path fails and some path passes.',
  dialogue_choice: 'Scripted NPC roleplay. Reply quality/reactions live ONLY in the answer — never in payload. payload:{persona:{character,name?,role_md}, opening_md, turns:[{id,npc_md,replies:IdText 2-4}] 2-6}. answer:{turns:[{turn_id,qualities:{reply_id:0-100},reactions?:{reply_id:react_md}}]}.',
  flash_match: 'FLOW: speed-match under a timer. payload:{left:IdText 3-8, right:IdText 3-8, seconds 20-90}. answer:{pairs:[id,id][]}.',
  lightning_round: 'FLOW: rapid-fire mini-quiz. payload:{questions:[{id,prompt_md,options:IdText 2-4}] 3-8, seconds_per_q 5-15}. answer:{correct:{question_id:option_id}}.',
  would_you_rather: 'Tradeoff pick — ONE tap, so exactly one side may be passable: key the better trade-off 90-100 and the weaker (but tempting) one 0-30, NEVER both high and never both 0. payload:{a:{text_md,icon?}, b:{text_md,icon?}, followup_md?}. answer:{qualities:{a:0-100,b:0-100}, reveal_md} (reveal_md ALWAYS required — it teaches the opportunity cost of the side not taken).',
  // -- maker --
  code_order: 'Arrange code blocks into a working program. payload:{blocks:IdText 3-8, language_hint?}. answer:{order:id[]} length == blocks.length.',
  robot_path: 'FLOW: queue commands, RUN, walk the grid. payload:{grid:{w,h} 3-6, start:{x,y,dir}, goal:{x,y}, walls?, commands:("forward"|"left"|"right")[], max_commands}. answer:{} (simulated — the grader re-runs `commands` against the grid).',
  debug_hunt: 'Find the buggy line(s). payload:{intro_md, blocks:IdText 3-8}. answer:{bug_ids:id[] (>=1), fix_md?}.',
  balance_scale: 'Algebra intuition — place weights to balance the scale exactly. payload:{left_fixed:[{label,value}] 1-4, weights:[{id,label,value}] 3-8, unknown_label?}. answer:{} (state check — grader sums left_fixed vs the submitted subset of weights).',
  measure_read: 'Read an SVG instrument (ruler/thermometer/gauge/beaker) at pointer_value. payload:{instrument, min, max, ticks, unit, pointer_value}. answer:{value, tolerance} — value MUST equal pointer_value.',
  machine_io: 'Induce a function from in/out examples, predict probe_in. payload:{examples:[{in,out}] 2-4, probe_in, options?:IdText}. answer:{value?|correct_option_id?} — must be internally consistent with every example pair.',
};

/** Compact example fragments for the 10 most error-prone types (task brief). */
export const PALETTE_EXAMPLES: Partial<Record<ExerciseTypeId, string>> = {
  fill_blank:
    '{"payload":{"text_md":"Una {{1}} vale {{2}} pesos.","mode":"typed"},"answer":{"gaps":[{"gap":1,"accept":["paleta"]},{"gap":2,"accept":["15"]}]}}',
  equation_builder:
    '{"payload":{"tokens":[{"id":"t1","text":"5"},{"id":"t2","text":"+"},{"id":"t3","text":"3"},{"id":"t4","text":"9"}],"slots":3,"target_result":8},"answer":{"accepted":["t1 t2 t3"]}}',
  robot_path:
    '{"payload":{"grid":{"w":4,"h":4},"start":{"x":0,"y":0,"dir":"right"},"goal":{"x":2,"y":0},"commands":["forward","forward"],"max_commands":4},"answer":{}}',
  piggy_split:
    '{"payload":{"income":30,"unit":"MXN","jars":[{"id":"save","label":"Ahorrar","icon":"savings"},{"id":"spend","label":"Gastar","icon":"shopping_bag"},{"id":"share","label":"Compartir","icon":"volunteer_activism"}]},"answer":{"targets":{"save":{"min":10,"max":15},"spend":{"min":10,"max":15},"share":{"min":5,"max":10}}}}',
  story_branch:
    '{"payload":{"start_node":"n1","nodes":[{"id":"n1","text_md":"...","choices":[{"id":"c1","text_md":"...","next":null},{"id":"c2","text_md":"...","next":null}]}]},"answer":{"qualities":[{"node_id":"n1","choice_id":"c1","score":100},{"node_id":"n1","choice_id":"c2","score":40}]}}',
  dialogue_choice:
    '{"payload":{"persona":{"character":"zara","role_md":"..."},"opening_md":"...","turns":[{"id":"t1","npc_md":"...","replies":[{"id":"r1","text_md":"..."},{"id":"r2","text_md":"..."}]}]},"answer":{"turns":[{"turn_id":"t1","qualities":{"r1":100,"r2":40},"reactions":{"r1":"...","r2":"..."}}]}}',
  compare_table:
    '{"payload":{"rows":[{"id":"row1","label":"Ahorrar"}],"cols":[{"id":"colA","label":"Rápido"}],"tokens":[{"id":"tok1","text_md":"Sí"}]},"answer":{"cells":{"row1:colA":"tok1"}}}',
  pattern_complete:
    '{"payload":{"sequence":[{"icon":"star","tint":"primary"},{"icon":"circle","tint":"accent"},{"icon":"star","tint":"primary"}],"options":[{"id":"o1","icon":"circle","tint":"accent"},{"id":"o2","icon":"star","tint":"primary"}],"missing_slots":1},"answer":{"correct":{"1":"o1"}}}',
  coin_count:
    '{"payload":{"currency":"MXN","denominations":[1,2,5,10],"target":8},"answer":{}}',
  interest_peek:
    '{"payload":{"principal":100,"rate_pct":10,"periods":2,"currency":"MXN","prediction":{"kind":"choice","options":[{"id":"a","text_md":"110"},{"id":"b","text_md":"121"}]}},"answer":{"correct_option_id":"b"}}',
};

export interface AllowedTypesResult {
  allowed: string[];
  familiesUsed: FamilyName[];
}

/**
 * Palette SUBSETTING (COURSE_ENGINE.md §4): filter the full 56-type palette
 * down to what a given age tier may draw from — family allowlist first,
 * then named exceptions punch (extra-allowed) or close (banned) holes.
 *
 * `opts.fullPalette` (COURSE_ENGINE.md §3.3, adult register) bypasses tier
 * subsetting entirely — every type in the closed canon is allowed, no
 * allowlist/exception lookups at all.
 */
export function resolveAllowedTypes(
  taxonomy: TaxonomyFile,
  tier: string,
  opts: { fullPalette?: boolean } = {},
): AllowedTypesResult {
  if (opts.fullPalette) {
    const familiesUsed = Array.from(new Set(ALL_TYPES.map((t) => TYPE_TO_FAMILY.get(t)).filter((f): f is FamilyName => !!f)));
    return { allowed: [...ALL_TYPES], familiesUsed };
  }

  const families = new Set(taxonomy.family_allowlist_by_tier[tier] ?? []);
  const extraAllowed = new Set(taxonomy.type_exceptions[`${tier}_extra_allowed`] ?? []);
  const banned = new Set(taxonomy.type_exceptions[`${tier}_banned_types`] ?? []);

  const allowed = ALL_TYPES.filter((type) => {
    const family = TYPE_TO_FAMILY.get(type);
    const familyAllowed = family ? families.has(family) : false;
    if (banned.has(type)) return false;
    if (extraAllowed.has(type)) return true;
    return familyAllowed;
  });

  const familiesUsed = Array.from(new Set(allowed.map((t) => TYPE_TO_FAMILY.get(t)).filter((f): f is FamilyName => !!f)));

  return { allowed, familiesUsed };
}

/** Renders the subsetted palette as a prompt-ready text block. */
export function renderPalette(allowedTypes: readonly string[]): string {
  const lines = allowedTypes.map((type) => {
    const guide = PALETTE_GUIDE[type as ExerciseTypeId];
    const example = PALETTE_EXAMPLES[type as ExerciseTypeId];
    return example ? `- ${type}: ${guide}\n  example: ${example}` : `- ${type}: ${guide}`;
  });
  return lines.join('\n');
}
