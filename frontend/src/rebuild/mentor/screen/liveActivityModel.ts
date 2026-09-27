/*
 * A LIVE ACTIVITY ON THE MENTOR SCREEN, AS DATA (product inventory T1c: "do
 * activities in a side panel (Check)"; Frontend Bible 08 §2 layer 4).
 *
 * Oracle serves one Lesson Engine segment at a time (Core's catalog, bank or a
 * live-authored item). The legacy screen drew it with the legacy lesson
 * engine's 57 renderers, which the rebuild may not import (02 rule 23). This
 * module reads the segment types the Mentor actually serves into a small set of
 * interaction shapes the rebuilt screen draws with the 02 controls, and builds
 * the answer in exactly the shape Core's grader reads
 * (`backend/src/lesson-contract/families/*`). The key never reaches the
 * browser: Core grades, and pays XP only when it could re-derive the key.
 *
 * A type not read here returns null: the screen then shows the prompt and the
 * learner answers in words, which Oracle checks for the five number types.
 */

export type ActivityView =
  | { kind: 'choose'; type: string; context: string | null; options: { id: string; label: string }[] }
  | { kind: 'truefalse'; type: string; statement: string }
  | { kind: 'number'; type: string; unit: string | null; scene: { label: string; count: number }[]; ask: string | null }
  | { kind: 'text'; type: string; maxChars: number }
  | { kind: 'slider'; type: string; min: number; max: number; step: number; unit: string | null }
  | { kind: 'order'; type: string; context: string | null; items: { id: string; label: string }[] }
  | { kind: 'select'; type: 'needs_wants' | 'budget_fit'; currency: string | null; budget: number | null;
    items: { id: string; label: string; price: number | null }[] }
  | { kind: 'tray'; type: 'coin_count' | 'make_change'; currency: string; denominations: number[];
    target: number | null; price: number | null; paidWith: number | null }
  | { kind: 'blanks'; type: string; parts: ({ text: string } | { gap: number })[]; bank: { id: string; label: string }[] | null }
  | { kind: 'weeks'; type: string; currency: string; goal: number; options: number[] };

export type ActivityDraft =
  | { kind: 'choose'; id: string | null }
  | { kind: 'truefalse'; value: boolean | null }
  | { kind: 'number'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'slider'; value: number }
  | { kind: 'order'; order: string[] }
  | { kind: 'select'; ids: string[] }
  | { kind: 'tray'; picked: number[] }
  | { kind: 'blanks'; gaps: Record<string, string> }
  | { kind: 'weeks'; weeks: Record<string, string> };

type Dict = Record<string, unknown>;
const obj = (v: unknown): Dict | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Dict) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Markdown-lite as plain words: emphasis marks, code ticks and link syntax
 * go, the words stay. The Mentor's activities are short prose; a renderer for
 * markup is not worth a second text pipeline on the stage.
 */
export function plainText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function idLabels(v: unknown, field: 'text_md' | 'label'): { id: string; label: string }[] | null {
  const items = list(v).map((raw) => {
    const item = obj(raw);
    const id = item ? str(item.id) : null;
    const text = item ? str(item[field]) ?? str(item.text_md) ?? str(item.label) : null;
    return id && text ? { id, label: plainText(text) } : null;
  });
  return items.length > 0 && items.every(Boolean) ? (items as { id: string; label: string }[]) : null;
}

/** The segment's prompt as plain words, if it has one. */
export function activityPrompt(segment: Dict): string | null {
  const prompt = str(segment.prompt_md) ?? str(segment.prompt);
  return prompt ? plainText(prompt) : null;
}

/** Reads a served segment into the shape the screen draws, or null for a type the screen answers in words. */
export function activityView(segment: Dict): ActivityView | null {
  const type = str(segment.type);
  const p = obj(segment.payload);
  if (!type || !p) return null;
  switch (type) {
    case 'quiz_mcq': case 'picture_choice': case 'odd_one_out': {
      if (type === 'odd_one_out' && list(p.reasons).length > 0) return null;
      const options = idLabels(type === 'odd_one_out' ? p.items : p.options, type === 'picture_choice' ? 'label' : 'text_md');
      return options && options.length >= 2 ? { kind: 'choose', type, context: null, options } : null;
    }
    case 'best_decision': {
      const options = idLabels(p.options, 'text_md');
      const scenario = str(p.scenario_md);
      return options && options.length >= 2 ? { kind: 'choose', type, context: scenario ? plainText(scenario) : null, options } : null;
    }
    case 'price_compare': {
      const currency = str(p.currency);
      const offers = list(p.offers).map((raw) => {
        const o = obj(raw);
        const id = o ? str(o.id) : null;
        const label = o ? str(o.label) : null;
        const qty = o ? num(o.qty) : null;
        const unit = o ? str(o.unit) : null;
        const price = o ? num(o.price) : null;
        return id && label && qty !== null && unit && price !== null && currency ? { id, label: `${label}: ${qty} ${unit}`, price } : null;
      });
      if (offers.length < 2 || !offers.every(Boolean) || !currency) return null;
      return { kind: 'choose', type, context: null, options: (offers as { id: string; label: string; price: number }[]).map((o) => ({ id: o.id, label: `${o.label}, ${money(o.price, currency)}` })) };
    }
    case 'true_false': {
      if (list(p.justifications).length > 0) return null;
      const statement = str(p.statement_md);
      return statement ? { kind: 'truefalse', type, statement: plainText(statement) } : null;
    }
    case 'number_input':
      return { kind: 'number', type, unit: str(p.unit), scene: [], ask: null };
    case 'count_objects': {
      const scene = list(p.scene).map((raw) => {
        const s = obj(raw);
        const label = s ? str(s.label) : null;
        const count = s ? num(s.count) : null;
        return label && count !== null ? { label, count } : null;
      });
      if (scene.length === 0 || !scene.every(Boolean)) return null;
      return { kind: 'number', type, unit: null, scene: scene as { label: string; count: number }[], ask: str(p.ask_label) };
    }
    case 'type_answer':
      return { kind: 'text', type, maxChars: Math.max(1, Math.min(80, num(p.max_chars) ?? 80)) };
    case 'estimate_slider': {
      const min = num(p.min), max = num(p.max);
      if (min === null || max === null || max <= min) return null;
      const step = num(p.step) ?? Math.max((max - min) / 100, Number.EPSILON);
      return { kind: 'slider', type, min, max, step, unit: str(p.unit) };
    }
    case 'order_steps': case 'rank_choices': case 'timeline_order': {
      const items = idLabels(type === 'timeline_order' ? p.events : p.items, 'text_md');
      const slots = num(p.slots);
      if (!items || items.length < 2 || (slots !== null && slots !== items.length)) return null;
      const criterion = str(p.criterion_md);
      return { kind: 'order', type, context: criterion ? plainText(criterion) : null, items };
    }
    case 'needs_wants': case 'budget_fit': {
      const currency = str(p.currency);
      const items = list(p.items).map((raw) => {
        const i = obj(raw);
        const id = i ? str(i.id) : null;
        const label = i ? str(i.label) ?? str(i.text_md) : null;
        return id && label ? { id, label: plainText(label), price: i ? num(i.price) : null } : null;
      });
      if (items.length < 2 || !items.every(Boolean)) return null;
      const budget = num(p.budget);
      if (type === 'budget_fit' && (budget === null || !currency || items.some((i) => i!.price === null))) return null;
      return { kind: 'select', type, currency, budget, items: items as { id: string; label: string; price: number | null }[] };
    }
    case 'coin_count': case 'make_change': {
      const currency = str(p.currency);
      const denominations = list(p.denominations).map(num).filter((d): d is number => d !== null && d > 0);
      if (!currency || denominations.length === 0) return null;
      const target = num(p.target), price = num(p.price), paidWith = num(p.paid_with);
      if (type === 'coin_count' && target === null) return null;
      if (type === 'make_change' && (price === null || paidWith === null)) return null;
      return { kind: 'tray', type, currency, denominations: [...new Set(denominations)].sort((a, b) => a - b), target, price, paidWith };
    }
    case 'fill_blank': {
      const text = str(p.text_md);
      if (!text) return null;
      const bank = p.mode === 'bank' ? idLabels(p.bank, 'text_md') : null;
      if (p.mode === 'bank' && !bank) return null;
      const parts: ({ text: string } | { gap: number })[] = [];
      let last = 0;
      for (const match of text.matchAll(/\{\{(\d+)\}\}/g)) {
        if (match.index! > last) parts.push({ text: plainText(text.slice(last, match.index)) });
        parts.push({ gap: Number(match[1]) });
        last = match.index! + match[0].length;
      }
      if (last < text.length) parts.push({ text: plainText(text.slice(last)) });
      return parts.some((part) => 'gap' in part) ? { kind: 'blanks', type, parts: parts.filter((part) => !('text' in part) || part.text !== ''), bank } : null;
    }
    case 'savings_goal': {
      const currency = str(p.currency), goal = num(p.goal);
      const options = list(p.weekly_options).map(num).filter((o): o is number => o !== null && o > 0);
      return currency && goal !== null && options.length > 0 ? { kind: 'weeks', type, currency, goal, options } : null;
    }
    default:
      return null;
  }
}

export function emptyDraft(view: ActivityView): ActivityDraft {
  switch (view.kind) {
    case 'choose': return { kind: 'choose', id: null };
    case 'truefalse': return { kind: 'truefalse', value: null };
    case 'number': return { kind: 'number', text: '' };
    case 'text': return { kind: 'text', text: '' };
    case 'slider': return { kind: 'slider', value: Math.round(((view.min + view.max) / 2) / view.step) * view.step };
    case 'order': return { kind: 'order', order: [] };
    case 'select': return { kind: 'select', ids: [] };
    case 'tray': return { kind: 'tray', picked: [] };
    case 'blanks': return { kind: 'blanks', gaps: {} };
    case 'weeks': return { kind: 'weeks', weeks: {} };
  }
}

/** A typed number in any of the three locales ("12,5", "12.5", "1 200"), or null. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[\s$]/g, '').replace(/^R\$/, '');
  if (!/^-?\d+([.,]\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export const gapNumbers = (view: Extract<ActivityView, { kind: 'blanks' }>): number[] =>
  view.parts.flatMap((part) => ('gap' in part ? [part.gap] : []));

/**
 * The answer in the grader's own shape, or null while the learner has not
 * given one yet (the Check control stays disabled).
 */
export function answerOf(view: ActivityView, draft: ActivityDraft): unknown | null {
  if (view.kind !== draft.kind) return null;
  switch (draft.kind) {
    case 'choose':
      if (!draft.id) return null;
      return view.type === 'odd_one_out' ? { item_id: draft.id } : view.type === 'price_compare' ? { offer_id: draft.id } : { option_id: draft.id };
    case 'truefalse': return draft.value === null ? null : { is_true: draft.value };
    case 'number': {
      const value = parseNumber(draft.text);
      return value === null ? null : { value };
    }
    case 'text': return draft.text.trim() === '' ? null : { text: draft.text.trim() };
    case 'slider': return { value: draft.value };
    case 'order':
      return view.kind === 'order' && draft.order.length === view.items.length ? { order: draft.order } : null;
    case 'select':
      if (draft.ids.length === 0) return null;
      return view.type === 'needs_wants' ? { needs_ids: draft.ids } : { selected_ids: draft.ids };
    case 'tray': return draft.picked.length === 0 ? null : { picked: draft.picked };
    case 'blanks': {
      if (view.kind !== 'blanks') return null;
      const gaps = gapNumbers(view);
      return gaps.every((gap) => (draft.gaps[String(gap)] ?? '').trim() !== '')
        ? { gaps: Object.fromEntries(gaps.map((gap) => [String(gap), draft.gaps[String(gap)]!.trim()])) } : null;
    }
    case 'weeks': {
      if (view.kind !== 'weeks') return null;
      const weeks: Record<string, number> = {};
      for (const weekly of view.options) {
        const value = parseNumber(draft.weeks[String(weekly)] ?? '');
        if (value === null || value <= 0 || !Number.isInteger(value)) return null;
        weeks[String(weekly)] = value;
      }
      return { weeks };
    }
  }
}

/** A money amount in the learner's locale. */
export function money(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
  } catch {
    return String(amount);
  }
}

/** The tray's running total, rounded to cents so 0.1 + 0.2 reads as 0.30. */
export const traySum = (picked: readonly number[]): number => Math.round(picked.reduce((sum, value) => sum + value, 0) * 100) / 100;

/** The Mentor's demonstration moves the open tray (Tutor v3): the draft as the driver reads and writes it. */
export function demoDraftOf(draft: ActivityDraft): unknown {
  if (draft.kind === 'tray') return { picked: draft.picked };
  if (draft.kind === 'order') return { order: draft.order };
  return undefined;
}

export function draftFromDemo(draft: ActivityDraft, next: unknown): ActivityDraft {
  const value = obj(next);
  if (draft.kind === 'tray' && value && Array.isArray(value.picked)) return { kind: 'tray', picked: value.picked.filter((v): v is number => typeof v === 'number') };
  if (draft.kind === 'order' && value && Array.isArray(value.order)) return { kind: 'order', order: value.order.filter((v): v is string => typeof v === 'string') };
  return draft;
}
