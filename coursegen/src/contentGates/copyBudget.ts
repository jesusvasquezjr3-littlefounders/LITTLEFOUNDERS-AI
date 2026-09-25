// OD-13 — Copy Budget content gate (Frontend Bible 06).
//
// Measures every classified on-screen string of a lesson (or catalog) against
// its role budget. Blocks over budget fail with the exact numbers and the
// Bible 06 §4 remedy order (cut, show it, say it, put it behind a tap). A
// translation that cannot meet ×1.25 is not truncated: the source is rewritten
// shorter (Bible 06 §5.9), which is why the gate re-runs on every locale.

import { COPY_BUDGETS, wordLimit, type Audience, type ContentLocale, type CopyRole } from './budgets.js';
import { countSentences, countWords, excerpt } from './text.js';

export interface BudgetedString {
  segmentId: string;
  path: string;
  role: CopyRole;
  text: string;
}

export interface CopyBudgetFinding {
  segmentId: string;
  path: string;
  role: Exclude<CopyRole, 'data'>;
  words: number;
  wordLimit: number;
  sentences: number;
  sentenceLimit?: number;
  message: string;
}

const REMEDY: Readonly<Record<Exclude<CopyRole, 'data'>, string>> = {
  heading: 'a title is a noun phrase or a short question, with no trailing explanation',
  prompt: 'keep the context plus ONE question; numbers the learner needs stay, decoration goes; story belongs to the Mentor turn',
  option: 'an option is a short label the picture can carry; move the reason into the option rationale',
  mentor: 'one Mentor turn holds one idea and at most one question; split the rest into another turn',
  body: 'one idea per string: cut reassurance and repetition, or move the detail behind a "Why?" tap',
  detail: 'a sheet behind a tap holds at most 60 words in short paragraphs',
};

export function checkCopyBudget(strings: readonly BudgetedString[], locale: ContentLocale, audience: Audience): CopyBudgetFinding[] {
  const findings: CopyBudgetFinding[] = [];
  for (const item of strings) {
    if (item.role === 'data') continue;
    const role = item.role;
    const budget = COPY_BUDGETS[role];
    const limit = wordLimit(role, locale, audience);
    const words = countWords(item.text);
    const sentences = countSentences(item.text);
    const overWords = words > limit;
    const overSentences = budget.sentences !== undefined && sentences > budget.sentences;
    if (!overWords && !overSentences) continue;
    const parts = [
      overWords ? `${words} words (max ${limit})` : null,
      overSentences ? `${sentences} sentences (max ${budget.sentences})` : null,
    ].filter(Boolean);
    findings.push({
      segmentId: item.segmentId,
      path: item.path,
      role,
      words,
      wordLimit: limit,
      sentences,
      ...(budget.sentences !== undefined ? { sentenceLimit: budget.sentences } : {}),
      message:
        `${item.segmentId === '(lesson)' || item.segmentId === '(catalog)' ? '' : `segment "${item.segmentId}" `}${item.path} [${role}]: ${parts.join(', ')} — ` +
        `Copy Budget OD-13 (${audience.label}, ${locale}). Rewrite shorter, never truncate: ${REMEDY[role]}. Text: "${excerpt(item.text, 70)}"`,
    });
  }
  return findings;
}

/**
 * Advisory only: the words a segment shows at once (title + prompt + options +
 * the longest single stage turn) against Bible 06's first-view budget (40,
 * ages 6–9: 25; ×1.25 es/pt). The real first view depends on layout, so the
 * rendered-app copy-budget audit is the authority; this is an early warning.
 */
export function segmentFirstViewWords(strings: readonly BudgetedString[]): Map<string, number> {
  const totals = new Map<string, { base: number; longestTurn: number }>();
  for (const item of strings) {
    if (item.role === 'data' || item.role === 'detail' || item.role === 'body' || item.segmentId.startsWith('(')) continue;
    const entry = totals.get(item.segmentId) ?? { base: 0, longestTurn: 0 };
    const words = countWords(item.text);
    if (item.role === 'mentor') entry.longestTurn = Math.max(entry.longestTurn, words);
    else entry.base += words;
    totals.set(item.segmentId, entry);
  }
  return new Map([...totals].map(([id, entry]) => [id, entry.base + entry.longestTurn]));
}

export function firstViewLimit(locale: ContentLocale, audience: Audience): number {
  return Math.ceil((audience.young ? 25 : 40) * (locale === 'en-US' ? 1 : 1.25));
}
