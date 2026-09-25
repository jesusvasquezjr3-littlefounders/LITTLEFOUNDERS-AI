// The three Forge content gates over one v1 lesson document, in Appendix C
// Stage 2 order: redundancy (B.18, gate 11), tone (B.14, gate 12), then the
// OD-13 Copy Budget (gate 13). Deterministic and free: they run inside
// runAllGates (so the write stage's corrective retry, the judge's revision,
// localization and verify:course all enforce them) and in `content:gates`.

import type { GateProblem } from '../pipeline/gates.js';
import { checkRedundancy, type RedundancyFinding } from './redundancy.js';
import { scanTone, toneAdvice, type ToneFinding } from './tone.js';
import { checkCopyBudget, firstViewLimit, segmentFirstViewWords, type CopyBudgetFinding } from './copyBudget.js';
import { narrationUnits, screenBlocks, type LessonDocumentLike, type UnclassifiedString } from './lessonModel.js';
import type { Audience, ContentLocale } from './budgets.js';

export const CONTENT_GATE = { redundancy: 11, tone: 12, copyBudget: 13 } as const;

export interface LocatedToneFinding extends ToneFinding {
  segmentId: string;
  path: string;
}

export interface FirstViewAdvisory {
  segmentId: string;
  words: number;
  limit: number;
}

export interface LessonContentReport {
  problems: GateProblem[];
  redundancy: RedundancyFinding[];
  tone: LocatedToneFinding[];
  copyBudget: CopyBudgetFinding[];
  /** Tone hits a human reviewer must judge (Appendix C Stage 3). Never block. */
  toneReview: LocatedToneFinding[];
  firstView: FirstViewAdvisory[];
  unclassified: UnclassifiedString[];
}

const LOCALES: readonly ContentLocale[] = ['en-US', 'es-MX', 'pt-BR'];

/**
 * Fields whose contract purpose is material the learner INSPECTS rather than
 * the Mentor's voice: red_flags shows a suspicious message and asks which parts
 * are warning signs, so urgency or hype wording there is the point of the
 * exercise. Tone hits inside them go to human review, never silently pass.
 */
export const EXAMINED_PATHS: Readonly<Record<string, RegExp>> = {
  red_flags: /^payload\.(artifact_md|flags\[\d+\]\.text_md)$/,
};

export function documentLocale(document: LessonDocumentLike): ContentLocale {
  const locale = document.meta?.locale;
  return LOCALES.includes(locale as ContentLocale) ? (locale as ContentLocale) : 'es-MX';
}

export function runLessonContentGates(document: LessonDocumentLike, audience: Audience): LessonContentReport {
  const locale = documentLocale(document);
  const { blocks, unclassified } = screenBlocks(document);
  const units = narrationUnits(document);
  const typeByid = new Map((document.segments ?? []).map((segment) => [segment.id, segment.type]));

  const redundancy = checkRedundancy(blocks, units, locale, audience);

  const toneAll: LocatedToneFinding[] = [];
  for (const block of blocks) {
    const segmentType = typeByid.get(block.segmentId);
    const examined = !!segmentType && !!EXAMINED_PATHS[segmentType]?.test(block.path);
    for (const finding of scanTone(block.raw, locale, 'lesson', { examined })) toneAll.push({ ...finding, segmentId: block.segmentId, path: block.path });
  }
  for (const unit of units.filter((u) => u.script)) {
    for (const finding of scanTone(unit.text, locale, 'lesson')) toneAll.push({ ...finding, segmentId: unit.segmentId, path: 'narration.script_md' });
  }
  const tone = toneAll.filter((f) => f.severity === 'block');
  const toneReview = toneAll.filter((f) => f.severity === 'review');

  const budgeted = blocks.map((block) => ({ segmentId: block.segmentId, path: block.path, role: block.role, text: block.text }));
  const copyBudget = checkCopyBudget(budgeted, locale, audience);

  const limit = firstViewLimit(locale, audience);
  const firstView = [...segmentFirstViewWords(budgeted)]
    .filter(([, words]) => words > limit)
    .map(([segmentId, words]) => ({ segmentId, words, limit }));

  const problems: GateProblem[] = [
    ...redundancy.map((f) => ({ gate: CONTENT_GATE.redundancy, segmentId: f.segmentId, message: f.message })),
    ...tone.map((f) => ({
      gate: CONTENT_GATE.tone,
      ...(f.segmentId.startsWith('(') ? {} : { segmentId: f.segmentId }),
      message: `${f.path}: "${f.phrase}" (${f.category}) — ${toneAdvice(f.category)}. Text: "${f.excerpt}"`,
    })),
    ...copyBudget.map((f) => ({ gate: CONTENT_GATE.copyBudget, ...(f.segmentId.startsWith('(') ? {} : { segmentId: f.segmentId }), message: f.message })),
  ];
  return { problems, redundancy, tone, copyBudget, toneReview, firstView, unclassified };
}
