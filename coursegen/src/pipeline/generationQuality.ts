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
      if ((key === 'icon' || key === 'ask_icon') && typeof value === 'string') out.add(value);
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

// Drag verbs across the three locales. The Lesson Engine is tap-to-place
// EVERYWHERE (chips have draggable=false), so a prompt/hint that says "drag"
// tells the kid to do something that gets no response.
const DRAG_STEMS = ['arrastr', 'arraste', 'arrastar', 'drag '];

function dragVerbCheck(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    const texts: string[] = [segment.prompt_md, ...(segment.hints ?? [])];
    for (const text of texts) {
      const lower = (text ?? '').toLowerCase();
      const hit = DRAG_STEMS.find((stem) => lower.includes(stem));
      if (hit) {
        problems.push({
          gate: 7,
          segmentId: segment.id,
          message: `text says "${hit.trim()}" but the engine is tap-to-place — use "toca"/"tap"/"toque", never a drag verb`,
        });
        break;
      }
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
  ];
}
