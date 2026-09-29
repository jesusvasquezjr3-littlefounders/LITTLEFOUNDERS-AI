// GAP-FIX-R6 learning (B.20 "a banner naming what was done right"; Frontend
// Bible 02 §9.2; Appendix B §1.8; B.23): the v2 contract carries an optional,
// answerless, per-locale `feedback` { met, not_yet } on a graded step. Core
// serves it with the segment (never with the answer key); Forge's emitted rows
// must name what was done right from age 10 (forge-v2:check), never praise with
// nothing named, and never show a number the step does not already show.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkForgeV2Rows } from '../services/forgeV2Rows.js';
import { isGenericPraise } from '../services/learnerRegisterPolicy.js';
import { v2PublicLessonSchema, validateV2LessonForGrading } from '../services/v2LessonDocument.js';
import { v2FeedbackProblems, v2SegmentFeedback } from '../services/v2SegmentFamilies.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../coursegen/src/v2/fixtures/emitted.json');
type Segment = { id: string; type: string; grading: string; prompt: string; payload: Record<string, unknown>; feedback?: { met?: string; not_yet?: string } };
type Row = { lesson_id: string; locale: string; version_id: string; document: { age_band: string; segments: Segment[] } & Record<string, unknown>; answer_keys: Record<string, unknown> };
const rows = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Row[];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const rowOf = (lesson: string, locale = 'en-US') => clone(rows.find((row) => row.lesson_id === lesson && row.locale === locale)!);

describe('v2 segment feedback: the contract', () => {
  it('accepts met and/or not_yet, and refuses an empty, over-long, blank or extra-keyed object', () => {
    expect(v2SegmentFeedback.safeParse({ met: 'You turned only the cards that could break the rule.' }).success).toBe(true);
    expect(v2SegmentFeedback.safeParse({ not_yet: 'Not yet. Ask which cards could break the rule.' }).success).toBe(true);
    for (const bad of [{}, { met: '' }, { met: '   ' }, { met: 'x'.repeat(161) }, { met: 'Named.', praise: 'Great job!' }, { met: 7 }, 'You did it', null]) {
      expect(v2SegmentFeedback.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('Core delivers the authored feedback with the segment, and never inside the answer key', () => {
    const row = rowOf('v2-first-release-logic');
    const parsed = validateV2LessonForGrading(row.document, row.answer_keys, { lessonId: row.lesson_id, locale: row.locale });
    expect(parsed).not.toBeNull();
    const cards = parsed!.segments.find((segment) => segment.id === 'cards-01')!;
    expect(cards.feedback).toEqual({ met: 'You turned only the cards that could break the rule.', not_yet: 'Not yet. Ask which cards could break the rule.' });
    expect(JSON.stringify(row.answer_keys)).not.toContain('feedback');
    // Every family's segment schema carries it (the concept boards have their own contract base).
    const concept = rowOf('v2-concept-boards');
    expect(v2PublicLessonSchema.parse(concept.document).segments.filter((segment) => segment.feedback?.met).length).toBeGreaterThan(0);
    const malformed = clone(row);
    malformed.document.segments[0]!.feedback = { met: 'Named.', extra: 'no' } as never;
    expect(validateV2LessonForGrading(malformed.document, malformed.answer_keys, { lessonId: row.lesson_id, locale: row.locale })).toBeNull();
  });
});

describe('v2FeedbackProblems (Forge and forge-v2:check)', () => {
  const graded = (feedback?: Segment['feedback']): Segment => ({ id: 'step-01', type: 'money.coin-tray.v2', grading: 'server', prompt: 'Make 25 coins.',
    payload: { price_minor: 1250, denominations: [{ value_minor: 10 }, { value_minor: 5 }] }, ...(feedback ? { feedback } : {}) });

  it('requires feedback.met on every graded step from age 10, not below', () => {
    expect(v2FeedbackProblems({ age_band: '10-12', segments: [graded()] })).toEqual([expect.stringMatching(/step-01: a graded step for ages 10 and up needs feedback\.met/)]);
    expect(v2FeedbackProblems({ age_band: 'adult', segments: [graded({ not_yet: 'Not yet. Count the tray.' })] })).toHaveLength(1);
    expect(v2FeedbackProblems({ age_band: '6-9', segments: [graded()] })).toEqual([]);
    expect(v2FeedbackProblems({ age_band: '13-17', segments: [{ ...graded(), grading: 'none' }] })).toEqual([]);
  });

  it('refuses feedback on an ungraded step', () => {
    expect(v2FeedbackProblems({ age_band: '6-9', segments: [{ ...graded({ met: 'You counted it.' }), grading: 'none' }] }))
      .toEqual([expect.stringMatching(/feedback on an ungraded step is never shown/)]);
  });

  it('is answerless: a number the step does not show is refused; shown numbers, hundredths and zeros pass', () => {
    expect(v2FeedbackProblems({ age_band: '10-12', segments: [graded({ met: 'Your tray makes 25 coins with tens and fives.' })] })).toEqual([]);
    expect(v2FeedbackProblems({ age_band: '10-12', segments: [graded({ met: 'You matched the 12.50 price.' })] })).toEqual([]);
    expect(v2FeedbackProblems({ age_band: '10-12', segments: [graded({ met: 'You used 3 tens and 7 fives.' })] }))
      .toEqual([expect.stringMatching(/feedback\.met shows 3, 7, a number the step does not show/)]);
    expect(v2FeedbackProblems({ age_band: '10-12', segments: [graded({ met: 'You counted it.', not_yet: 'Not yet. The answer is 40.' })] }))
      .toEqual([expect.stringMatching(/feedback\.not_yet shows 40/)]);
  });
});

describe('forge-v2:check over emitted rows (B.20, B.23)', () => {
  it('passes the committed fixture, where every graded step for ages 10 and up names what was done right', () => {
    expect(checkForgeV2Rows(rows)).toEqual([]);
    const tenPlus = rows.filter((row) => row.document.age_band !== '6-9').flatMap((row) => row.document.segments.filter((segment) => segment.grading === 'server'));
    expect(tenPlus.length).toBeGreaterThan(150);
    for (const segment of tenPlus) expect(segment.feedback?.met, segment.id).toBeTruthy();
  });

  it('refuses a 10+ row whose graded step lost its feedback.met', () => {
    const row = rowOf('v2-unit-price');
    delete row.document.segments[0]!.feedback;
    expect(checkForgeV2Rows([row])).toEqual([expect.stringMatching(/feedback, unit-price-01: a graded step for ages 10 and up needs feedback\.met/)]);
  });

  it('refuses praise that names nothing, including a bare verdict', () => {
    for (const met of ['Great job!', 'Correct', 'That works.', '¡Exacto!']) {
      const row = rowOf('v2-unit-price');
      row.document.segments[0]!.feedback = { met };
      expect(checkForgeV2Rows([row]), met).toEqual([expect.stringMatching(/praises with nothing named/)]);
    }
  });

  it('refuses a number that gives the answer away', () => {
    const row = rowOf('v2-schema-diagram');
    row.document.segments.find((segment) => segment.id === 'schema-answer-01')!.feedback = { met: 'You found 15 coins left.' };
    expect(checkForgeV2Rows([row])).toEqual([expect.stringMatching(/schema-answer-01: feedback\.met shows 15/)]);
  });
});

describe('generic praise (learner register policy, B.20 / B.23)', () => {
  it('counts a bare verdict as praise that names nothing, and a named step as specific', () => {
    for (const text of ['Correct', 'Correct!', "That's right.", 'That works.', 'Correcto', 'Es correcto.', '¡Exacto!', 'Eso funciona.', 'Correto!', 'Está certo.', 'Isso mesmo!', 'Great job!']) {
      expect(isGenericPraise(text), text).toBe(true);
    }
    for (const text of ['You turned only the cards that could break the rule.', 'Correct the total first.', 'Eso funciona porque ahorraste un tercio.']) {
      expect(isGenericPraise(text), text).toBe(false);
    }
  });
});
