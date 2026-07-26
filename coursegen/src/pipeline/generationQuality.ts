// Gate 7 — generation-quality checks (added after the 2026-07-22 QA inspection
// found 62/62 lessons with content defects that the engine had to tolerate at
// runtime). These deterministic checks stop mass generation from re-producing
// the worst of them, so the runtime tolerance (icon fallback, quality-scale
// normalization, cell-key normalization) is a safety net, not the only defence.
//
// Every check here is zero-false-positive by construction: it flags only things
// that are unambiguously broken (an icon that can't render, a quality map that
// makes the correct answer unpassable, a cell key the player can never match).

import type { LessonDocumentParsed } from '../contract/schema.js';
import { GRADED_TYPES } from '../contract/registry.js';
import type { GateProblem } from './gates.js';

/**
 * Blessed Material Symbols the generator is allowed to emit. Curated (not the
 * full 3600-glyph set) on purpose: it keeps the visual language consistent AND
 * guarantees every name renders. Any icon outside it is rejected so the model
 * picks a real, on-brand glyph instead of inventing one ('lemonade',
 * 'piggy_bank', 'guitar' — the "LEMON□E" defect). Grow this list deliberately
 * rather than loosening the gate.
 */
export const ICON_PALETTE: ReadonlySet<string> = new Set([
  // money & commerce
  'savings', 'payments', 'attach_money', 'account_balance', 'account_balance_wallet',
  'wallet', 'shopping_cart', 'shopping_bag', 'shopping_basket', 'storefront', 'store',
  'sell', 'redeem', 'local_offer', 'receipt_long', 'calculate', 'paid', 'monetization_on',
  'price_check', 'price_change', 'request_quote', 'credit_card', 'toll', 'currency_exchange',
  'point_of_sale', 'local_atm',
  // learning & achievement
  'school', 'menu_book', 'auto_stories', 'lightbulb', 'tips_and_updates', 'psychology',
  'emoji_objects', 'quiz', 'checklist', 'task_alt', 'flag', 'emoji_events', 'workspace_premium',
  'military_tech', 'star', 'grade', 'favorite', 'thumb_up', 'verified', 'target', 'trophy',
  // food & nature (the lemonade-stand world)
  'local_cafe', 'restaurant', 'cookie', 'icecream', 'cake', 'local_bar', 'water_drop',
  'nutrition', 'eco', 'agriculture', 'spa', 'grass', 'park', 'wb_sunny',
  // measure, time & data
  'scale', 'balance', 'straighten', 'timer', 'schedule', 'calendar_month', 'event', 'today',
  'hourglass_empty', 'trending_up', 'trending_down', 'show_chart', 'bar_chart', 'pie_chart',
  'insights', 'analytics', 'numbers', 'tag',
  // objects, lists & containers
  'inventory_2', 'category', 'label', 'sticky_note_2', 'description', 'edit_note',
  'format_list_numbered', 'list', 'grid_view', 'widgets', 'inventory', 'package_2',
  // people & social
  'handshake', 'groups', 'person', 'family_restroom', 'volunteer_activism', 'diversity_3',
  'group', 'emoji_people',
  // status & UI
  'help', 'info', 'warning', 'error', 'check_circle', 'cancel', 'add_circle', 'remove_circle',
  'arrow_forward', 'arrow_back', 'north_east', 'swap_horiz', 'sync', 'autorenew', 'bolt',
  'local_fire_department', 'home', 'palette', 'brush', 'extension', 'toys', 'sports_esports',
  'celebration', 'rocket_launch', 'map', 'flag_circle', 'lightbulb_circle',
  // Expanded after the first hardened regeneration wrongly rejected these
  // (they ARE real Material Symbols) — food/drink, objects, nature, tools.
  'checkroom', 'table_restaurant', 'local_florist', 'bakery_dining', 'ac_unit',
  'construction', 'cleaning_services', 'lunch_dining', 'dinner_dining', 'ramen_dining',
  'local_pizza', 'local_dining', 'set_meal', 'rice_bowl', 'coffee', 'coffee_maker',
  'egg', 'egg_alt', 'liquor', 'wine_bar', 'kitchen', 'blender', 'water_bottle',
  'local_drink', 'no_drinks', 'fastfood', 'lunch_dining',
  'yard', 'potted_plant', 'forest', 'deck', 'umbrella', 'beach_access', 'pool',
  'sunny', 'cloud', 'thermostat', 'water',
  'build', 'handyman', 'carpenter', 'plumbing', 'hardware', 'format_paint', 'roofing',
  'key', 'lock', 'lock_open', 'backpack', 'luggage', 'watch', 'diamond', 'redeem',
  'science', 'biotech', 'functions', 'percent', 'add', 'remove', 'add_circle_outline',
  'done', 'close', 'chevron_right', 'expand_more', 'menu', 'apps', 'dashboard',
  'shopping_cart_checkout', 'local_mall', 'receipt', 'discount', 'loyalty',
  'volunteer_activism', 'savings_outlined', 'account_balance_wallet',
]);

/** Recursively collect every `icon`/`ask_icon`/`art.icon` string value under a node. */
function collectIcons(node: unknown, out: Set<string>): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectIcons(item, out));
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'answer') continue; // answer keys never carry renderable icons
      if ((key === 'icon' || key === 'ask_icon' || key.endsWith('_icon')) && typeof value === 'string') out.add(value);
      else collectIcons(value, out);
    }
  }
}

function iconWhitelistCheck(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    const icons = new Set<string>();
    collectIcons(segment.payload, icons);
    for (const icon of icons) {
      if (!ICON_PALETTE.has(icon)) {
        problems.push({
          gate: 7,
          segmentId: segment.id,
          message: `icon "${icon}" is not in the blessed palette — it would render as raw text. Use a listed Material Symbol.`,
        });
      }
    }
  }
  return problems;
}

/** Types whose answer is a `qualities` map that grades on the 0–100 scale. */
const QUALITY_MAP_TYPES = new Set(['best_decision', 'story_branch', 'dialogue_choice', 'would_you_rather']);

function qualityValues(answer: unknown, type: string): number[] {
  const a = answer as Record<string, unknown> | undefined;
  if (!a) return [];
  if (type === 'story_branch') {
    const list = Array.isArray(a.qualities) ? a.qualities : [];
    return list.map((q) => (q as { score?: unknown })?.score).filter((s): s is number => typeof s === 'number');
  }
  if (type === 'dialogue_choice') {
    const turns = Array.isArray(a.turns) ? a.turns : [];
    const out: number[] = [];
    for (const turn of turns) {
      const q = (turn as { qualities?: Record<string, unknown> })?.qualities ?? {};
      for (const v of Object.values(q)) if (typeof v === 'number') out.push(v);
    }
    return out;
  }
  // best_decision / would_you_rather: flat { id: number } map.
  const q = (a.qualities as Record<string, unknown>) ?? {};
  return Object.values(q).filter((v): v is number => typeof v === 'number');
}

function qualityScaleCheck(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (!QUALITY_MAP_TYPES.has(segment.type)) continue;
    const values = qualityValues(segment.answer, segment.type);
    if (values.length === 0) continue;
    const max = Math.max(...values);
    if (max <= 1) {
      // 0 = every option fails; 0<max<=1 = a 0–1 scale read as 0–100 (correct answer scores ≤1/100).
      const detail = max === 0 ? 'all qualities are 0 (no option can pass)' : `qualities are on a 0–1 scale (max ${max}) — author on 0–100`;
      // would_you_rather tolerates an all-zero map (free-choice reflection); every other type must have a passable best.
      if (!(segment.type === 'would_you_rather' && max === 0)) {
        problems.push({ gate: 7, segmentId: segment.id, message: `${segment.type} quality map is broken: ${detail}` });
      }
    }
  }
  return problems;
}

function cellKeyCheck(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'compare_table') continue;
    const cells = (segment.answer as { cells?: Record<string, unknown> } | undefined)?.cells;
    if (!cells) continue;
    for (const key of Object.keys(cells)) {
      // The player submits `<row>:<col>`; a key without a colon (e.g. underscore
      // separator) can never match, so every placement would score 0.
      if (!key.includes(':')) {
        problems.push({
          gate: 7,
          segmentId: segment.id,
          message: `compare_table cell key "${key}" must use the "<row>:<col>" colon form (the player never submits any other)`,
        });
      }
    }
  }
  return problems;
}

/**
 * order_steps/rank_choices/timeline_order/build_sentence all grade by
 * comparing the player's submitted order against `answer.order` with a
 * scorer (kendall/footrule/positional) that returns 0 outright when the two
 * arrays differ in LENGTH — and the player is forced (by canSubmit) to
 * submit exactly the type's "required slot count", never more or less. If
 * that slot count doesn't equal `answer.order.length`, EVERY submission
 * scores 0: the exercise is unwinnable regardless of what the player does.
 * This is a strict equality, not a >= : too few slots is just as broken.
 */
function requiredSlotCount(segment: { type: string; payload: unknown }): number | null {
  const p = segment.payload as Record<string, unknown>;
  if (segment.type === 'order_steps') {
    const items = Array.isArray(p.items) ? p.items.length : null;
    const slots = typeof p.slots === 'number' ? p.slots : items;
    return slots;
  }
  if (segment.type === 'rank_choices') {
    return Array.isArray(p.items) ? p.items.length : null;
  }
  if (segment.type === 'timeline_order') {
    return Array.isArray(p.events) ? p.events.length : null;
  }
  if (segment.type === 'build_sentence') {
    return typeof p.slots === 'number' ? p.slots : null;
  }
  if (segment.type === 'code_order') {
    return Array.isArray(p.blocks) ? p.blocks.length : null;
  }
  return null;
}

function orderLengthCheck(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    const required = requiredSlotCount(segment);
    if (required === null) continue;
    const answer = segment.answer as { order?: unknown; accept_orders?: unknown } | undefined;
    const order = answer?.order;
    if (!Array.isArray(order)) continue;
    if (order.length !== required) {
      problems.push({
        gate: 7,
        segmentId: segment.id,
        message: `${segment.type}: the player must submit exactly ${required} entries (items/slots), but answer.order has ${order.length} — every submission would score 0 regardless of correctness. Make answer.order's length match the required slot count exactly.`,
      });
    }
    // Each accept_orders entry (alternative valid ordering) must be a genuine
    // PERMUTATION of answer.order — same length, same id multiset. A malformed
    // alt silently accepts nothing (grader filters by length) or, worse, rewards
    // an ordering that isn't actually valid. Enforce it up front.
    if (Array.isArray(answer?.accept_orders)) {
      const canonical = [...(order as string[])].sort().join('');
      (answer.accept_orders as unknown[]).forEach((alt, i) => {
        const ok =
          Array.isArray(alt) &&
          alt.length === order.length &&
          [...(alt as unknown[])].map(String).sort().join('') === canonical;
        if (!ok) {
          problems.push({
            gate: 7,
            segmentId: segment.id,
            message: `${segment.type}: answer.accept_orders[${i}] must be a re-ordering of the SAME ids as answer.order (same length, same items) — it isn't, so it can never be scored and the intended alternative answer is still marked wrong.`,
          });
        }
      });
    }
  }
  return problems;
}

/** Accent/case/whitespace-insensitive text key, for duplicate detection only. */
function normalizeForDupeCheck(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * memory_flip is a classic 1:1 Concentration game: card A only ever matches
 * the ONE card B authored in the same pair row. If two DIFFERENT pairs in the
 * same segment share an equivalent value on either side, a card the player
 * correctly matches to the "other" occurrence gets rejected — the QA-reported
 * "found a valid pair, marked wrong" defect. Catch it at generation time.
 */
function memoryFlipDuplicatePairCheck(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'memory_flip') continue;
    const pairs = (segment.payload as { pairs?: Array<{ a_md?: unknown; b_md?: unknown }> }).pairs;
    if (!Array.isArray(pairs)) continue;
    const seen = new Map<string, number>();
    pairs.forEach((pair, i) => {
      for (const side of [pair.a_md, pair.b_md]) {
        if (typeof side !== 'string') continue;
        const key = normalizeForDupeCheck(side);
        if (!key) continue;
        const firstIndex = seen.get(key);
        if (firstIndex !== undefined && firstIndex !== i) {
          problems.push({
            gate: 7,
            segmentId: segment.id,
            message: `memory_flip pair ${i} shares the value "${side}" with pair ${firstIndex} — matching either card to the other's partner would be a valid-looking match the fixed-slot grader rejects. Make every card value unique within the segment.`,
          });
        } else {
          seen.set(key, i);
        }
      }
    });
  }
  return problems;
}

// Drag verbs across the three locales. The Lesson Engine is tap-to-place
// EVERYWHERE (chips have draggable=false) EXCEPT the classification types
// sort_buckets/group_sets, which added real pointer-drag (a chip can be
// dragged into a bucket, tap still works as the fallback). For every OTHER
// placement type a prompt/hint that says "drag" tells the kid to do something
// that gets no response, so it's still flagged.
const DRAG_STEMS = ['arrastr', 'arraste', 'arrastar', 'drag '];
const DRAG_ENABLED_TYPES = new Set(['sort_buckets', 'group_sets']);

function dragVerbCheck(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (DRAG_ENABLED_TYPES.has(segment.type)) continue; // drag is real here — the verb is accurate
    const texts: string[] = [segment.prompt_md, ...(segment.hints ?? [])];
    for (const text of texts) {
      const lower = (text ?? '').toLowerCase();
      const hit = DRAG_STEMS.find((stem) => lower.includes(stem));
      if (hit) {
        problems.push({
          gate: 7,
          segmentId: segment.id,
          message: `text says "${hit.trim()}" but the engine is tap-to-place for ${segment.type} — use "toca"/"tap"/"toque", never a drag verb`,
        });
        break;
      }
    }
  }
  return problems;
}

// Graded types that legitimately carry NO answer key — their grader derives the
// correct answer from the PAYLOAD alone (schema answer is `z.object({})`).
// memory_flip scores from flips; savings_goal computes weeks = ceil(goal/weekly);
// coin_count sums the tray against payload.target; make_change = paid_with−price;
// budget_fit checks the cart against payload budget/needs; balance_scale solves
// subset-sum against payload weights. Requiring an `answer` object for these is
// wrong — it made the visual-first regen fail 5 otherwise-valid lessons.
const KEYLESS_GRADED_TYPES = new Set([
  'memory_flip',
  'savings_goal',
  'coin_count',
  'make_change',
  'budget_fit',
  'balance_scale',
  'robot_path', // grader re-runs the submitted program against the payload
]);

/**
 * Every graded segment MUST carry an answer key — a keyed type without one is
 * ungradeable at runtime (Core refuses to grade, the kid is stuck forever on
 * a "Comprobar" that can never succeed). Found live 2026-07-23: a regenerated
 * story-dialogue lesson shipped an extra quiz_mcq with no `answer` in all 3
 * locales; Zod allows it (answer is contract-optional — client documents are
 * served stripped), so only a gate can catch it.
 */
function gradedAnswerKeyCheck(document: LessonDocumentParsed, gradedTypes: readonly string[]): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (!gradedTypes.includes(segment.type) || KEYLESS_GRADED_TYPES.has(segment.type)) continue;
    const answer = (segment as { answer?: unknown }).answer;
    if (answer === undefined || answer === null || (typeof answer === 'object' && Object.keys(answer as object).length === 0)) {
      problems.push({
        gate: 7,
        segmentId: segment.id,
        message: `graded segment type "${segment.type}" has NO answer key — it can never be graded; author the \`answer\` object for it`,
      });
    }
  }
  return problems;
}

/*
 * Emoji discipline. Emojis are a permitted garnish in NARRATION surfaces only
 * (story-family payload text, a segment's explanation_md) — sparse, decorative,
 * always stripped before TTS. Everywhere else they are unambiguously wrong:
 * prompt_md is an instruction, hints are scaffolding, meta is chrome, and any
 * option/item/token/answer text is answer-critical (an emoji there clutters
 * comparisons and can differ between otherwise-identical choices). The write
 * prompt states the rule; this gate enforces it deterministically — the same
 * "prompts hope, gates guarantee" split as every other hard rule.
 */
// Keycap sequences ("1️⃣" = digit + U+FE0F + U+20E3) contain NO
// Extended_Pictographic codepoint, so FE0F/20E3 are matched explicitly —
// audiogen's stripEmojis covers them too, and the two layers must agree on
// what an emoji is.
const EMOJI_PRESENCE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{FE0F}\u{20E3}]/u;
// One VISIBLE emoji = one grapheme cluster: a ZWJ family sequence is 4
// pictographic codepoints and a flag is 2 regional indicators, but a child
// sees ONE symbol — counting codepoints made a single 👨‍👩‍👧‍👦 trip the
// clutter cap (caught by the 2026-07-26 adversarial review).
const GRAPHEMES = new Intl.Segmenter('es', { granularity: 'grapheme' });
/** The story family + eavesdrop — the segments whose payload text IS narration. */
const EMOJI_ALLOWED_PAYLOAD_TYPES = new Set([
  'story_dialogue',
  'story_scene',
  'key_ideas',
  'concept_reveal',
  'checkpoint',
  'eavesdrop',
]);
/** Emojis a segment may carry across its allowed surfaces before it reads as clutter (the prompt asks for ≤1). */
const EMOJI_SEGMENT_CAP = 2;

function collectStrings(node: unknown, out: string[]): void {
  if (typeof node === 'string') {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectStrings(item, out));
    return;
  }
  if (node !== null && typeof node === 'object') {
    for (const value of Object.values(node as Record<string, unknown>)) collectStrings(value, out);
  }
}

function countEmojis(text: string): number {
  if (!EMOJI_PRESENCE.test(text)) return 0; // fast path — most strings have none
  let count = 0;
  for (const { segment } of GRAPHEMES.segment(text)) {
    if (EMOJI_PRESENCE.test(segment)) count++;
  }
  return count;
}

function emojiDisciplineCheck(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];

  const metaStrings: string[] = [];
  collectStrings(document.meta, metaStrings);
  if (metaStrings.some((s) => EMOJI_PRESENCE.test(s))) {
    problems.push({ gate: 7, message: 'meta fields carry an emoji — meta is chrome (title, objectives), never decorated' });
  }

  for (const segment of document.segments) {
    if (segment.prompt_md && EMOJI_PRESENCE.test(segment.prompt_md)) {
      problems.push({
        gate: 7,
        segmentId: segment.id,
        message: 'prompt_md carries an emoji — prompts are instructions; emojis belong only in story narration text or explanation_md',
      });
    }
    for (const hint of segment.hints ?? []) {
      if (EMOJI_PRESENCE.test(hint)) {
        problems.push({ gate: 7, segmentId: segment.id, message: 'a hint carries an emoji — hints are scaffolding, never decorated' });
        break;
      }
    }
    const answerStrings: string[] = [];
    collectStrings((segment as { answer?: unknown }).answer, answerStrings);
    if (answerStrings.some((s) => EMOJI_PRESENCE.test(s))) {
      problems.push({ gate: 7, segmentId: segment.id, message: 'answer-key text carries an emoji — answer surfaces are never decorated' });
    }
    const payloadStrings: string[] = [];
    collectStrings(segment.payload, payloadStrings);
    const payloadAllowed = EMOJI_ALLOWED_PAYLOAD_TYPES.has(segment.type);
    if (!payloadAllowed && payloadStrings.some((s) => EMOJI_PRESENCE.test(s))) {
      problems.push({
        gate: 7,
        segmentId: segment.id,
        message: `emoji in the payload of graded type "${segment.type}" — option/item/token/label text is answer-critical and never decorated; emojis belong only in story narration or explanation_md`,
      });
    }
    // Clutter cap over the ALLOWED surfaces (story payload + explanation_md).
    let allowedCount = segment.explanation_md ? countEmojis(segment.explanation_md) : 0;
    if (payloadAllowed) for (const s of payloadStrings) allowedCount += countEmojis(s);
    if (allowedCount > EMOJI_SEGMENT_CAP) {
      problems.push({
        gate: 7,
        segmentId: segment.id,
        message: `${allowedCount} emojis in one segment reads as clutter — keep at most one, placed after the words it decorates`,
      });
    }
  }
  return problems;
}

/** Gate 7 — see the file header. Composes the deterministic generation-quality checks. */
export function runGenerationQualityGate(document: LessonDocumentParsed): GateProblem[] {
  return [
    ...iconWhitelistCheck(document),
    ...qualityScaleCheck(document),
    ...cellKeyCheck(document),
    ...dragVerbCheck(document),
    ...memoryFlipDuplicatePairCheck(document),
    ...orderLengthCheck(document),
    ...gradedAnswerKeyCheck(document, GRADED_TYPES),
    ...emojiDisciplineCheck(document),
  ];
}
