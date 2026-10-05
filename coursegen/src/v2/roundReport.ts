// npm run v2:round-report: measure pilot rounds so a change in how lessons are
// written shows up as numbers, not as an impression (pilot round 2).
//
//   npm run v2:round-report -- --round round-1=<plans dir> --round round-2=<plans dir> [--json out.json] [--markdown out.md]
//
// Everything here is offline and deterministic: it reads plans, runs the emitter
// (the same gates `v2:emit` runs) and counts. The reading-level numbers are
// reported, never gated (readability.ts documents why: the formulas skew hard on
// short gamified text). A round with no `teaching_role` annotations is measured
// from segment type and grading alone, so round 1 stays comparable.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readabilityScore, type ReadabilityLocale } from '../pipeline/readability.js';
import { isNonCopyKey, V2_LOCALES } from './contract.js';
import { emitV2Lesson, forgeVersionId } from './emit.js';
import { summarizeLessonDesign } from './lessonDesign.js';
import { loadV2Plans, type V2LessonPlan } from './plan.js';

export interface LessonMetrics {
  lessonId: string;
  mentor: string | null;
  ageBand: string;
  segments: number;
  /** Ungraded segments: Mentor turns and episodes, the part of the lesson that shows. */
  shown: number;
  /** Graded segments: the part of the lesson that asks. */
  asked: number;
  /** Segments the learner sees before the first graded one. */
  leadIn: number;
  /** Graded items per ungraded one; null when nothing is shown. */
  askedPerShown: number | null;
  /** Declared teaching roles, when the plan names them. */
  roles: Record<string, number> | null;
  /** Demonstration steps (examples and guided steps) and independent exercises (practice and transfer), when roles are declared. */
  demonstrations: number | null;
  independentExercises: number | null;
  /** Independent exercises per demonstration step, when roles are declared. */
  exercisesPerDemonstration: number | null;
  /** Share of graded segments whose three locales all carry feedback.met. */
  feedbackMetShare: number;
  preItems: number;
  postItems: number;
  /** Words in the longest and the average learner-visible Mentor line / graded prompt, per market. */
  words: Record<string, { mentorAverage: number; promptAverage: number; longest: number }>;
  /** Readability per market over the whole lesson's copy (en-US grade, lower is easier; es-MX and pt-BR ease, higher is easier). */
  readability: Record<string, number | null>;
  emit: { blocked: number; review: number; blockedByGate: Record<string, number>; reviewByGate: Record<string, number> };
}

export interface RoundMetrics {
  label: string;
  lessons: LessonMetrics[];
  totals: {
    lessons: number;
    segments: number;
    shown: number;
    asked: number;
    shownShare: number;
    averageLeadIn: number;
    lessonsWithPre: number;
    lessonsWithPost: number;
    lessonsWithRoles: number;
    demonstrations: number;
    independentExercises: number;
    exercisesPerDemonstration: number | null;
    gradedShare: number;
    feedbackMetShare: number;
    emitBlocked: number;
    emitReview: number;
  };
}

function copyStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(copyStrings);
  if (value && typeof value === 'object') return Object.entries(value).filter(([key]) => !isNonCopyKey(key)).flatMap(([, child]) => copyStrings(child));
  return [];
}

const wordCount = (text: string) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
const mean = (values: number[]) => (values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)));
const tally = (gates: number[]) => gates.reduce<Record<string, number>>((out, gate) => ({ ...out, [gate]: (out[gate] ?? 0) + 1 }), {});

function feedbackMetShare(plan: V2LessonPlan): number {
  const graded = plan.segments.filter((segment) => segment.grading === 'server');
  if (graded.length === 0) return 1;
  const covered = graded.filter((segment) => V2_LOCALES.every((locale) => segment.copy[locale].feedback?.met)).length;
  return Number((covered / graded.length).toFixed(2));
}

export function measureLesson(plan: V2LessonPlan, options: { requireLessonDesign?: boolean } = {}): LessonMetrics {
  const shown = plan.segments.filter((segment) => segment.grading === 'none').length;
  const asked = plan.segments.length - shown;
  const firstGraded = plan.segments.findIndex((segment) => segment.grading === 'server');
  const design = summarizeLessonDesign(plan);
  const words: LessonMetrics['words'] = {};
  const readability: LessonMetrics['readability'] = {};
  for (const locale of V2_LOCALES) {
    const mentorLines = plan.segments.filter((segment) => segment.grading === 'none').map((segment) => wordCount(segment.copy[locale].prompt));
    const prompts = plan.segments.filter((segment) => segment.grading === 'server').map((segment) => wordCount(segment.copy[locale].prompt));
    words[locale] = { mentorAverage: mean(mentorLines), promptAverage: mean(prompts), longest: Math.max(0, ...mentorLines, ...prompts) };
    readability[locale] = readabilityScore(plan.segments.flatMap((segment) => copyStrings(segment.copy[locale])).join('. '), locale as ReadabilityLocale);
  }
  const result = emitV2Lesson(plan, { versionId: forgeVersionId('round-report'), ...(options.requireLessonDesign ? { requireLessonDesign: true } : {}) });
  return {
    lessonId: plan.lesson_id,
    mentor: plan.mentor_stage?.character ?? null,
    ageBand: plan.age_band,
    segments: plan.segments.length,
    shown,
    asked,
    leadIn: firstGraded === -1 ? plan.segments.length : firstGraded,
    askedPerShown: shown === 0 ? null : Number((asked / shown).toFixed(2)),
    roles: design.declared ? design.roles : null,
    demonstrations: design.declared ? design.demonstrations : null,
    independentExercises: design.declared ? design.independentExercises : null,
    exercisesPerDemonstration: design.declared ? design.exerciseToDemonstration : null,
    feedbackMetShare: feedbackMetShare(plan),
    preItems: plan.segments.filter((segment) => segment.item_phase === 'pre').length,
    postItems: plan.segments.filter((segment) => segment.item_phase === 'post').length,
    words,
    readability: Object.fromEntries(Object.entries(readability).map(([locale, score]) => [locale, score === null ? null : Number(score.toFixed(1))])),
    emit: {
      blocked: result.problems.length,
      review: result.review.length,
      blockedByGate: tally(result.problems.map((problem) => problem.gate)),
      reviewByGate: tally(result.review.map((finding) => finding.gate)),
    },
  };
}

export function measureRound(label: string, plansDir: string, options: { requireLessonDesign?: boolean } = {}): RoundMetrics {
  const loaded = loadV2Plans(plansDir);
  const bad = loaded.filter((entry) => !entry.plan);
  if (bad.length > 0) throw new Error(`${label}: ${bad.map((entry) => `${entry.file} (${entry.errors[0]})`).join('; ')}`);
  const lessons = loaded.flatMap((entry) => (entry.plan ? [measureLesson(entry.plan, options)] : []));
  const shown = lessons.reduce((sum, lesson) => sum + lesson.shown, 0);
  const asked = lessons.reduce((sum, lesson) => sum + lesson.asked, 0);
  const demonstrations = lessons.reduce((sum, lesson) => sum + (lesson.demonstrations ?? 0), 0);
  const independentExercises = lessons.reduce((sum, lesson) => sum + (lesson.independentExercises ?? 0), 0);
  return {
    label,
    lessons,
    totals: {
      lessons: lessons.length,
      segments: shown + asked,
      shown,
      asked,
      shownShare: shown + asked === 0 ? 0 : Number((shown / (shown + asked)).toFixed(2)),
      averageLeadIn: mean(lessons.map((lesson) => lesson.leadIn)),
      lessonsWithPre: lessons.filter((lesson) => lesson.preItems > 0).length,
      lessonsWithPost: lessons.filter((lesson) => lesson.postItems > 0).length,
      lessonsWithRoles: lessons.filter((lesson) => lesson.roles !== null).length,
      demonstrations,
      independentExercises,
      exercisesPerDemonstration: demonstrations === 0 ? null : Number((independentExercises / demonstrations).toFixed(2)),
      gradedShare: shown + asked === 0 ? 0 : Number((asked / (shown + asked)).toFixed(2)),
      feedbackMetShare: lessons.length === 0 ? 1 : Number((lessons.reduce((sum, lesson) => sum + lesson.feedbackMetShare, 0) / lessons.length).toFixed(2)),
      emitBlocked: lessons.reduce((sum, lesson) => sum + lesson.emit.blocked, 0),
      emitReview: lessons.reduce((sum, lesson) => sum + lesson.emit.review, 0),
    },
  };
}

export function renderMarkdown(rounds: RoundMetrics[]): string {
  const row = (cells: Array<string | number>) => `| ${cells.join(' | ')} |`;
  const lines: string[] = ['## Totals', '', row(['Metric', ...rounds.map((round) => round.label)]), row(['---', ...rounds.map(() => '---')])];
  const metric = (name: string, pick: (round: RoundMetrics) => string | number) => lines.push(row([name, ...rounds.map(pick)]));
  metric('Lessons', (round) => round.totals.lessons);
  metric('Segments', (round) => round.totals.segments);
  metric('Shown (Mentor turns, ungraded)', (round) => round.totals.shown);
  metric('Asked (graded)', (round) => round.totals.asked);
  metric('Shown share of the lesson', (round) => `${Math.round(round.totals.shownShare * 100)}%`);
  metric('Demonstration steps (examples and guided steps, roles declared)', (round) => round.totals.demonstrations || '-');
  metric('Independent exercises (practice and transfer, roles declared)', (round) => round.totals.independentExercises || '-');
  metric('Exercises per demonstration step', (round) => round.totals.exercisesPerDemonstration ?? '-');
  metric('Graded share of the segments', (round) => `${Math.round(round.totals.gradedShare * 100)}%`);
  metric('Average segments before the first question', (round) => round.totals.averageLeadIn);
  metric('Lessons with a pre item', (round) => `${round.totals.lessonsWithPre}/${round.totals.lessons}`);
  metric('Lessons with a post item', (round) => `${round.totals.lessonsWithPost}/${round.totals.lessons}`);
  metric('Lessons that name teaching roles', (round) => `${round.totals.lessonsWithRoles}/${round.totals.lessons}`);
  metric('Graded steps whose feedback names what was met', (round) => `${Math.round(round.totals.feedbackMetShare * 100)}%`);
  metric('Emit: blocking problems', (round) => round.totals.emitBlocked);
  metric('Emit: review items', (round) => round.totals.emitReview);
  for (const round of rounds) {
    lines.push('', `## ${round.label}`, '', row(['Lesson', 'Mentor', 'Shown', 'Asked', 'Demos', 'Exercises', 'Lead-in', 'Pre', 'Post', 'Longest line (es/en/pt words)', 'Reading es / en / pt']), row(Array(11).fill('---')));
    for (const lesson of round.lessons) {
      lines.push(row([
        lesson.lessonId, lesson.mentor ?? '-', lesson.shown, lesson.asked, lesson.demonstrations ?? '-', lesson.independentExercises ?? '-', lesson.leadIn, lesson.preItems, lesson.postItems,
        `${lesson.words['es-MX']?.longest} / ${lesson.words['en-US']?.longest} / ${lesson.words['pt-BR']?.longest}`,
        `${lesson.readability['es-MX'] ?? '-'} / ${lesson.readability['en-US'] ?? '-'} / ${lesson.readability['pt-BR'] ?? '-'}`,
      ]));
    }
  }
  return `${lines.join('\n')}\n`;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const rounds: Array<{ label: string; dir: string }> = [];
  let json: string | undefined;
  let markdown: string | undefined;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) throw new Error(`v2:round-report: ${flag} requires a value`);
      return next;
    };
    if (flag === '--round') {
      const [label, dir] = value().split('=');
      if (!label || !dir) throw new Error('v2:round-report: --round takes <label>=<plans dir>');
      rounds.push({ label, dir: path.resolve(dir) });
    } else if (flag === '--json') json = path.resolve(value());
    else if (flag === '--markdown') markdown = path.resolve(value());
    else throw new Error(`v2:round-report: unknown flag "${flag}"`);
  }
  if (rounds.length === 0) throw new Error('v2:round-report: pass at least one --round <label>=<plans dir>');
  // Plans that name teaching roles are checked by the lesson-design gate; plans that do not are measured as written.
  const measured = rounds.map(({ label, dir }) => measureRound(label, dir, { requireLessonDesign: false }));
  const text = renderMarkdown(measured);
  if (json) {
    mkdirSync(path.dirname(json), { recursive: true });
    writeFileSync(json, `${JSON.stringify(measured, null, 2)}\n`);
  }
  if (markdown) {
    mkdirSync(path.dirname(markdown), { recursive: true });
    writeFileSync(markdown, text);
  }
  console.log(text);
}
