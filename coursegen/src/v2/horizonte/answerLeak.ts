import type { GateProblem } from '../../pipeline/gates.js';
import type { V2DocumentLike } from '../gates.js';

/*
 * One backstop for what every pack's guidance says in its own words: the prompt never writes the keyed answer. A graded board
 * whose prompt hands over the figure ships to a child as a free "met". The check reads the keyed scalars of a segment and
 * looks for them in its prompt, help steps and labels:
 *   - a number is written when the text has that numeral (a decimal comma or point and a thousands mark are one numeral);
 *   - an answer part that holds several numbers (a pair, a fraction, a target object) is written only when every one is;
 *   - a reference or a string with operator characters (a formula, an expression) is written when the text holds it, spaces aside;
 *   - the name of a shape or an option letter is checked only in the fields that pick one of the boards' own options;
 *   - a word is not written when the text only offers it among others ("up or down", "the cube or the cone").
 * Numbers spelled out in words are not read: they stay with the review. Zero never counts: it is the usual "none" and the usual start.
 * A type whose goal IS a number the learner is told ("show 47", "median is 6") is listed in GOAL_STATED and keeps its numerals;
 * a function graph with no marks is the same, because its pack requires the prompt to write every nonzero target value.
 */

/** Fields of a key that are not the learner's answer: the placement and coordinate sets, the tolerances, the payload's own family. */
const NOT_AN_ANSWER = new Set(['solutions', 'required', 'tolerance', 'review', 'parameter_tolerance', 'parameter_review', 'family']);
/** Fields that name one of the options the board offers (a solid, a shape, a lettered choice). */
const OPTION_FIELDS = new Set(['solid', 'pick', 'choice']);
/** Pairs written together as one fraction. */
const PAIRED_FIELDS = [['n', 'd']] as const;
/** Letters that are also words in en, es or pt ("a plane", "y", "o", "e"): never read as an option letter. */
const WORD_LETTERS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

/**
 * Types whose prompt states the number the board is set to, so the keyed number is the goal and not a result. The prompt of each
 * says what to build or place ("Make ten", "Jump from 47 to 73", "median is 6").
 */
export const GOAL_STATED: ReadonlySet<string> = new Set([
  'math.ten-frame.v2',
  'math.number-line.empty.v2',
  'math.number-line.zoom.v2',
  'math.clock.v2',
  'math.ruler.v2',
  'math.fraction-circles.v2',
  'stats.dot-plot.v2',
  'stats.normal.v2',
  'stats.binomial.v2',
  'stats.clt.v2',
]);

/** Types whose own pack gate already refuses a prompt that writes the reference, so this gate reads their help and labels only. */
const PACK_CHECKS_REFERENCE_IN_PROMPT: ReadonlySet<string> = new Set(['math.expression-editor.v2', 'math.surface-formula.v2']);

const GRAPH = 'math.function-graph.v2';

function goalIsStated(segment: Record<string, unknown>): boolean {
  if (typeof segment.type !== 'string') return false;
  if (GOAL_STATED.has(segment.type)) return true;
  if (segment.type !== GRAPH) return false;
  const payload = segment.payload !== null && typeof segment.payload === 'object' ? (segment.payload as Record<string, unknown>) : {};
  return !Array.isArray(payload.marks) || payload.marks.length === 0;
}

const isDigit = (code: number): boolean => code >= 48 && code <= 57;

export const withoutSpaces = (text: string): string => text.split(/\s+/).join('');

/** A comma between two digits is a decimal mark: "x=0,5" is the reference "x=0.5". Any other comma stays. */
export function commaToPoint(text: string): string {
  let out = '';
  for (let at = 0; at < text.length; at += 1) {
    const between = text[at] === ',' && at > 0 && isDigit(text.charCodeAt(at - 1)) && isDigit(text.charCodeAt(at + 1));
    out += between ? '.' : text[at];
  }
  return out;
}

const canonical = (digits: string): string => {
  if (digits.length > 15) return digits;
  const value = Number(digits);
  return Number.isFinite(value) ? String(value) : digits;
};

/** The numerals of a text as canonical plain numbers; "0,5", "26,82" and "1,000" each read every way a learner could mean them. Zero is left out. */
export function numeralsOf(text: string): Set<string> {
  const found = new Set<string>();
  for (const [token] of text.matchAll(/\d+(?:[.,]\d+)*/g)) {
    found.add(canonical(token.replace(/,/g, '.')));
    if (/^\d{1,3}(?:[,.]\d{3})+$/.test(token)) found.add(canonical(token.replace(/[,.]/g, '')));
    if (/^\d+,\d+$/.test(token)) for (const part of token.split(',')) found.add(canonical(part));
  }
  found.delete('0');
  return found;
}

const wordsOf = (text: string): Set<string> => new Set(text.toLowerCase().match(/\p{L}+/gu) ?? []);

/** "up or down": the word sits next to an or (o, ou) and another word, so the text offers it and does not say it. */
const offered = (word: string, text: string): boolean => new RegExp(`(?:\\p{L}+\\s+(?:or|o|ou)\\s+${word}|${word}\\s+(?:or|o|ou)\\s+\\p{L}+)`, 'iu').test(text);

/** One part of an answer, as the tokens a text must all hold to have written it. */
export interface AnswerPart { field: string; numerals: string[]; words: string[]; expressions: string[]; letters: string[] }

const NUMERIC_TEXT = /^-?\d+(?:[.,/]\d+)*$/;
const OPERATORS = /[+*^=()]/;
const newPart = (field: string): AnswerPart => ({ field, numerals: [], words: [], expressions: [], letters: [] });

/** Reads one leaf of a key into the part; `field` is the nearest field name, `nested` is true inside a list or an object. */
function collect(value: unknown, field: string, nested: boolean, part: AnswerPart): void {
  if (typeof value === 'number') {
    if (Number.isFinite(value) && value !== 0) part.numerals.push(canonical(String(Math.abs(value))));
    return;
  }
  if (Array.isArray(value)) { for (const item of value) collect(item, field, true, part); return; }
  if (value !== null && typeof value === 'object') {
    for (const [name, item] of Object.entries(value as Record<string, unknown>)) if (!NOT_AN_ANSWER.has(name)) collect(item, name, true, part);
    return;
  }
  if (typeof value !== 'string') return;
  const text = value.trim();
  const option = !nested && OPTION_FIELDS.has(field);
  if (NUMERIC_TEXT.test(text)) {
    for (const numeral of numeralsOf(text.replace(/\//g, ' '))) part.numerals.push(numeral);
  } else if (/^[a-z]$/i.test(text)) {
    if (option && !WORD_LETTERS.has(text.toLowerCase())) part.letters.push(text.toLowerCase());
  } else if (field === 'reference' || OPERATORS.test(text)) {
    if (withoutSpaces(text).length >= 3) part.expressions.push(commaToPoint(withoutSpaces(text)).toLowerCase());
  } else if (/^\p{L}{2,}$/u.test(text)) {
    if (option || nested) part.words.push(text.toLowerCase());
  }
}

/** The parts of a key: each top-level answer field is one part, n and d are one, and a list or an object is one part read whole. */
export function answerParts(key: unknown): AnswerPart[] {
  if (key === null || typeof key !== 'object' || Array.isArray(key)) return [];
  const fields = Object.entries(key as Record<string, unknown>).filter(([name]) => !NOT_AN_ANSWER.has(name));
  const parts: AnswerPart[] = [];
  const merged = new Set<string>();
  for (const names of PAIRED_FIELDS) {
    if (!names.every((name) => fields.some(([field]) => field === name))) continue;
    const part = newPart(names.join('/'));
    for (const name of names) { collect(fields.find(([field]) => field === name)![1], name, false, part); merged.add(name); }
    parts.push(part);
  }
  for (const [name, value] of fields) {
    if (merged.has(name)) continue;
    const part = newPart(name);
    collect(value, name, false, part);
    parts.push(part);
  }
  return parts.filter((part) => part.numerals.length + part.words.length + part.expressions.length + part.letters.length > 0);
}

/** Does the text write the whole part: every numeral, every word and every letter of it, or any one expression? */
function written(part: AnswerPart, text: string, goalStated: boolean): boolean {
  const compact = commaToPoint(withoutSpaces(text)).toLowerCase();
  if (part.expressions.length > 0 && part.expressions.every((expression) => compact.includes(expression))) return true;
  const numerals = goalStated ? [] : part.numerals;
  if (numerals.length + part.words.length + part.letters.length === 0) return false;
  if (numerals.length > 0) {
    const have = numeralsOf(text);
    if (!numerals.every((numeral) => have.has(numeral))) return false;
  }
  const words = wordsOf(text);
  return part.words.every((word) => words.has(word) && !offered(word, text)) && part.letters.every((letter) => words.has(letter));
}

const TREE = 'prob.tree.v2';

/** The head counts of a tree key, from its chip ids ("n-10" is 10): the tree is built from them, so the text never writes any of them. */
function treeHeadCounts(key: unknown): string[] {
  const solutions = key !== null && typeof key === 'object' ? (key as Record<string, unknown>).solutions : undefined;
  const first = Array.isArray(solutions) ? solutions[0] : undefined;
  if (first === null || typeof first !== 'object') return [];
  const counts = new Set<string>();
  for (const chips of Object.values(first as Record<string, unknown>)) {
    for (const chip of Array.isArray(chips) ? chips : []) {
      const count = typeof chip === 'string' ? canonical(/^n-(\d+)$/.exec(chip)?.[1] ?? '0') : '0';
      if (count !== '0') counts.add(count);
    }
  }
  return [...counts];
}

/** The texts the learner reads about a segment: its prompt, every help step and every label. */
function learnerTexts(segment: Record<string, unknown>): Array<{ where: string; text: string }> {
  const texts: Array<{ where: string; text: string }> = [];
  if (typeof segment.prompt === 'string') texts.push({ where: 'prompt', text: segment.prompt });
  if (Array.isArray(segment.help)) segment.help.forEach((step, index) => { if (typeof step === 'string') texts.push({ where: `help[${index}]`, text: step }); });
  if (segment.labels && typeof segment.labels === 'object') {
    for (const [id, label] of Object.entries(segment.labels as Record<string, unknown>)) if (typeof label === 'string') texts.push({ where: `labels.${id}`, text: label });
  }
  return texts;
}

/** Gate 8 (clarity) on a Horizonte board: no prompt, help step or label writes the keyed answer. Runs only where the caller holds the keys. */
export function answerLeakGates(document: V2DocumentLike, answerKeys: Record<string, unknown> | undefined, horizonteTypes: ReadonlySet<string>): GateProblem[] {
  if (!answerKeys) return [];
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    if (typeof segment.type !== 'string' || !horizonteTypes.has(segment.type) || !Object.hasOwn(answerKeys, segmentId)) continue;
    const goalStated = goalIsStated(segment);
    const texts = learnerTexts(segment);
    for (const part of answerParts(answerKeys[segmentId])) {
      const packOwnsPrompt = part.field === 'reference' && PACK_CHECKS_REFERENCE_IN_PROMPT.has(segment.type);
      const leak = texts.find(({ where, text }) => !(packOwnsPrompt && where === 'prompt') && written(part, text, goalStated));
      if (leak) problems.push({ gate: 8, segmentId, message: `${leak.where} writes the keyed answer (${part.field}): the board asks for it, so the text never gives it (clarity)` });
    }
    if (segment.type === TREE) {
      const counts = treeHeadCounts(answerKeys[segmentId]);
      for (const { where, text } of texts) {
        const have = numeralsOf(text);
        const hit = counts.find((count) => have.has(count));
        if (hit) { problems.push({ gate: 8, segmentId, message: `${where} writes the head count ${hit}: the tree is built from the counts, so the text never gives one (clarity)` }); break; }
      }
    }
  }
  return problems;
}
