// What a v1 Forge lesson document puts on screen, and what Echo reads aloud.
//
// Two models of one document, both deterministic:
//
//  1. SCREEN BLOCKS — every learner-visible string, classified into a Bible 06
//     copy role (budgets.ts) by where it sits in the contract. The classifier
//     is total over the contract: a coverage test walks every string field of
//     all 56 segment schemas and fails when a new field has no role, so a new
//     segment type cannot ship prose the copy budget never measures.
//
//  2. NARRATION UNITS — the exact units audiogen/src/narrate/extractNarratables.ts
//     produces (same unit ids, same fields, same choice-type roll-up and the same
//     B.18 channel rule), each linked to the on-screen block(s) it voices.
//     agent/tools/check-narration-parity.mjs keeps this mirror in step with Echo.

import { NON_VISIBLE_KEYS } from '../pipeline/gates.js';
import { plainText } from './text.js';
import type { CopyRole } from './budgets.js';

type Json = unknown;
type PathPart = string | number;

export interface ScreenBlock {
  segmentId: string;
  /** Dotted path inside the segment ("payload.options[1].text_md"). */
  path: string;
  role: CopyRole;
  /** The rendered text (MarkdownLite removed). */
  text: string;
  /** The raw authored string, used by the tone gate. */
  raw: string;
}

export interface NarrationUnit {
  unitId: string;
  segmentId: string;
  field: string;
  text: string;
  /** Screen block paths this unit voices (empty when the unit reads a script that is not on screen). */
  voices: string[];
  /** The unit reads an author-declared script (B.18 differentiated channel). */
  script: boolean;
}

export interface UnclassifiedString {
  segmentId: string;
  path: string;
}

// ---- role classification ------------------------------------------------------

/** Envelope and payload keys that always carry the same role, wherever they sit. */
const ROLE_BY_KEY: Readonly<Record<string, CopyRole | 'skip'>> = {
  prompt_md: 'prompt',
  statement_md: 'prompt',
  scenario_md: 'prompt',
  claim_md: 'prompt',
  criterion_md: 'prompt',
  rule_md: 'prompt',
  instruction_md: 'prompt',
  intro_md: 'prompt',
  followup_md: 'prompt',
  rate_md: 'prompt',
  artifact_md: 'prompt',
  mood_prompt_md: 'prompt',
  npc_md: 'mentor',
  opening_md: 'mentor',
  explanation_md: 'body',
  recap_md: 'body',
  back_md: 'body',
  role_md: 'body',
  front_md: 'heading',
  title: 'heading',
  hints: 'detail',
  notes: 'detail',
  hint_md: 'detail',
  a_md: 'option',
  b_md: 'option',
  ask_label: 'option',
  unknown_label: 'option',
  placeholder: 'option',
  language_hint: 'option',
  set_a: 'option',
  set_b: 'option',
  name: 'data',
  x: 'data',
  in: 'data',
  out: 'data',
  probe_in: 'data',
};

/** Answer-subtree prose that is shown as feedback after a check; every other answer string is a key, never copy. */
const ANSWER_FEEDBACK_KEYS: Readonly<Record<string, CopyRole>> = {
  correction_md: 'body',
  fix_md: 'body',
  reveal_md: 'body',
  rationale_md: 'body',
  reactions: 'mentor',
};

/** Containers whose items are data (table headers, chart legends): Bible 06 §3.3 does not count them. */
const DATA_CONTAINERS = new Set(['rows', 'cols', 'series']);
/** Containers whose items are a character speaking on the stage. */
const MENTOR_CONTAINERS = new Set(['lines', 'nodes']);

function nearestContainer(path: readonly PathPart[]): string | undefined {
  for (let i = path.length - 2; i >= 0; i -= 1) {
    const part = path[i];
    if (typeof part === 'string') return part;
  }
  return undefined;
}

/**
 * The copy role of the string at `path` inside one segment, 'skip' for a
 * non-copy string (ids, enums, answer keys, spoken-only scripts), or undefined
 * when the contract grew a field nobody classified yet.
 */
export function classifyPath(path: readonly PathPart[], segmentType: string): CopyRole | 'skip' | undefined {
  const keys = path.filter((part): part is string => typeof part === 'string');
  const key = keys[keys.length - 1];
  if (!key) return undefined;
  if (NON_VISIBLE_KEYS.has(key) || keys.some((k) => NON_VISIBLE_KEYS.has(k) && k !== key)) return 'skip';
  if (keys[0] === 'narration') return 'skip'; // heard, never shown (the redundancy gate reads it)
  if (keys[0] === 'answer') {
    const feedback = keys.find((k) => k in ANSWER_FEEDBACK_KEYS);
    return feedback ? ANSWER_FEEDBACK_KEYS[feedback] : 'skip';
  }
  if (keys[0] === 'meta') {
    if (key === 'title') return 'heading';
    return key === 'objectives' ? 'skip' : undefined; // objectives are authoring metadata, never rendered
  }
  const container = nearestContainer(path);
  if (key === 'text_md' || key === 'label' || key === 'text') {
    if (container === 'payload') return 'prompt'; // fill_blank's sentence with gaps
    if (container && DATA_CONTAINERS.has(container)) return 'data';
    if (container && MENTOR_CONTAINERS.has(container)) return 'mentor';
    return 'option';
  }
  if (key === 'body_md') return container === 'ideas' ? 'body' : 'mentor'; // key idea card vs story_scene narration
  if (key === 'context_md') return segmentType === 'eavesdrop' ? 'mentor' : 'prompt';
  if (key === 'rationale_md') return 'body';
  const fixed = ROLE_BY_KEY[key];
  if (fixed) return fixed;
  return undefined;
}

// ---- screen blocks --------------------------------------------------------------

function formatPath(path: readonly PathPart[]): string {
  return path.reduce<string>((acc, part) => (typeof part === 'number' ? `${acc}[${part}]` : acc ? `${acc}.${part}` : part), '');
}

function walkStrings(node: Json, path: PathPart[], visit: (path: PathPart[], value: string) => void): void {
  if (typeof node === 'string') {
    visit(path, node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => walkStrings(item, [...path, index], visit));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, Json>)) walkStrings(value, [...path, key], visit);
  }
}

interface SegmentLike {
  id: string;
  type: string;
  prompt_md?: string;
  hints?: string[];
  explanation_md?: string;
  narration?: { mode: 'text_only' } | { mode: 'differentiated'; script_md: string };
  payload?: Record<string, Json>;
}

export interface LessonDocumentLike {
  meta?: { title?: string; locale?: string };
  segments?: SegmentLike[];
}

export interface ScreenModel {
  blocks: ScreenBlock[];
  unclassified: UnclassifiedString[];
}

export function screenBlocks(document: LessonDocumentLike): ScreenModel {
  const blocks: ScreenBlock[] = [];
  const unclassified: UnclassifiedString[] = [];
  const title = document.meta?.title;
  if (typeof title === 'string' && title.trim()) {
    blocks.push({ segmentId: '(lesson)', path: 'meta.title', role: 'heading', text: plainText(title), raw: title });
  }
  for (const segment of document.segments ?? []) {
    walkStrings(segment, [], (path, value) => {
      if (path.length === 1 && (path[0] === 'id' || path[0] === 'type')) return;
      const role = classifyPath(path, segment.type);
      if (role === 'skip') return;
      if (role === undefined) {
        unclassified.push({ segmentId: segment.id, path: formatPath(path) });
        return;
      }
      if (!value.trim()) return;
      blocks.push({ segmentId: segment.id, path: formatPath(path), role, text: plainText(value), raw: value });
    });
  }
  return { blocks, unclassified };
}

// ---- narration units (mirror of audiogen extractNarratables) ---------------------

/** Mirrors audiogen CHOICE_OPTION_TYPES: option labels read aloud as one `choices` clip after the prompt. */
export const CHOICE_OPTION_TYPES: readonly string[] = [
  'quiz_mcq',
  'picture_choice',
  'best_decision',
  'confidence_quiz',
  'odd_one_out',
  'yes_no_cases',
  'would_you_rather',
];

/** Mirrors audiogen pushStoryBodies: the story-family payload fields Echo narrates. */
export const NARRATED_STORY_TYPES: readonly string[] = ['story_dialogue', 'story_scene', 'key_ideas', 'concept_reveal', 'checkpoint', 'eavesdrop'];

function arr(value: Json): Array<Record<string, Json>> {
  return Array.isArray(value) ? (value as Array<Record<string, Json>>) : [];
}

function str(value: Json): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function narrationUnits(document: LessonDocumentLike): NarrationUnit[] {
  const units: NarrationUnit[] = [];
  for (const segment of document.segments ?? []) {
    if (segment.narration?.mode === 'text_only') continue;
    const payload = segment.payload ?? {};
    const push = (field: string, raw: string | undefined, voices: string[], script = false): void => {
      if (!raw) return;
      const text = plainText(raw);
      if (!text) return;
      units.push({ unitId: `${segment.id}.${field}`, segmentId: segment.id, field, text, voices, script });
    };

    if (segment.narration?.mode === 'differentiated') push('prompt', segment.narration.script_md, [], true);
    else push('prompt', segment.prompt_md, ['prompt_md']);

    switch (segment.type) {
      case 'story_dialogue':
        arr(payload.lines).forEach((line, i) => push(`line.${i}`, str(line.text_md), [`payload.lines[${i}].text_md`]));
        break;
      case 'story_scene':
        push('body', str(payload.body_md), ['payload.body_md']);
        break;
      case 'key_ideas':
        arr(payload.ideas).forEach((idea, i) => push(`idea.${i}`, str(idea.body_md), [`payload.ideas[${i}].body_md`]));
        break;
      case 'concept_reveal':
        arr(payload.cards).forEach((card, i) => push(`card.${i}.back`, str(card.back_md), [`payload.cards[${i}].back_md`]));
        break;
      case 'checkpoint':
        push('recap', str(payload.recap_md), ['payload.recap_md']);
        break;
      case 'eavesdrop':
        push('context', str(payload.context_md), ['payload.context_md']);
        arr(payload.lines).forEach((line, i) => push(`line.${i}`, str(line.text_md), [`payload.lines[${i}].text_md`]));
        break;
      default:
        break;
    }

    if (CHOICE_OPTION_TYPES.includes(segment.type)) {
      const texts: string[] = [];
      const voices: string[] = [];
      for (const container of ['options', 'items', 'cases'] as const) {
        arr(payload[container]).forEach((item, i) => {
          const key = typeof item.text_md === 'string' ? 'text_md' : typeof item.label === 'string' ? 'label' : undefined;
          if (!key) return;
          texts.push(item[key] as string);
          voices.push(`payload.${container}[${i}].${key}`);
        });
      }
      for (const side of ['a', 'b'] as const) {
        const value = payload[side] as Record<string, Json> | undefined;
        if (value && typeof value.text_md === 'string') {
          texts.push(value.text_md);
          voices.push(`payload.${side}.text_md`);
        }
      }
      if (texts.length >= 2) push('choices', texts.join('. '), voices);
    }

    (segment.hints ?? []).forEach((hint, i) => push(`hint.${i}`, hint, [`hints[${i}]`]));
    push('explanation', segment.explanation_md, ['explanation_md']);
  }
  return units;
}
