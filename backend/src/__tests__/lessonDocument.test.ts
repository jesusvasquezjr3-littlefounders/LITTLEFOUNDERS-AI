import { describe, expect, it } from 'vitest';
import { findGradingSegment, gradedSegmentIds, pickLessonLocale, stripAnswers, xpBySegmentId } from '../services/lessonDocument.js';

const rows = [
  { lesson_id: 'l1', locale: 'en-US', schema_version: 1, document: { locale: 'en-US' }, answer_keys: {}, audio: {}, updated_at: '2026-08-01T00:00:00Z' },
  { lesson_id: 'l1', locale: 'es-MX', schema_version: 1, document: { locale: 'es-MX' }, answer_keys: {}, audio: {}, updated_at: '2026-08-01T00:00:00Z' },
  { lesson_id: 'l1', locale: 'pt-BR', schema_version: 1, document: { locale: 'pt-BR' }, answer_keys: {}, audio: {}, updated_at: '2026-08-01T00:00:00Z' },
];

describe('pickLessonLocale', () => {
  it("picks the caller's locale when present", () => {
    expect(pickLessonLocale(rows, 'pt-BR')?.locale).toBe('pt-BR');
  });

  it('falls back to es-MX (authoring locale) when the caller locale row is missing', () => {
    expect(pickLessonLocale(rows.filter((r) => r.locale !== 'en-US'), 'en-US')?.locale).toBe('es-MX');
  });

  it('falls back to any available row when neither the caller locale nor es-MX exist', () => {
    const onlyEnglish = rows.filter((r) => r.locale === 'en-US');
    expect(pickLessonLocale(onlyEnglish, 'pt-BR')?.locale).toBe('en-US');
  });

  it('returns null for an empty row set', () => {
    expect(pickLessonLocale([], 'en-US')).toBeNull();
  });

  it('treats a null caller locale the same as missing', () => {
    expect(pickLessonLocale(rows, null)?.locale).toBe('es-MX');
  });
});

describe('stripAnswers', () => {
  it('removes the answer key from every segment, defensively', () => {
    const doc = {
      segments: [
        { id: 's1', type: 'quiz_mcq', answer: { correct_option_id: 'a' }, payload: {} },
        { id: 's2', type: 'story_scene', payload: {} },
      ],
    };
    const stripped = stripAnswers(doc) as { segments: Array<Record<string, unknown>> };
    expect(stripped.segments[0]).not.toHaveProperty('answer');
    expect(stripped.segments[0]?.id).toBe('s1');
    expect(stripped.segments[1]).not.toHaveProperty('answer');
  });

  it('is a no-op on a document with no segments array', () => {
    const doc = { meta: { slug: 'x' } };
    expect(stripAnswers(doc)).toBe(doc);
  });
});

describe('findGradingSegment', () => {
  const document = {
    segments: [{ id: 'quiz-1', type: 'quiz_mcq', prompt_md: 'Pick one', difficulty: 2, xp: 10, payload: { options: [] } }],
  };
  const answerKeys = { 'quiz-1': { correct_option_id: 'a' } };

  it('merges the document segment with its server-only answer key', () => {
    const seg = findGradingSegment(document, answerKeys, 'quiz-1');
    expect(seg).toMatchObject({ id: 'quiz-1', type: 'quiz_mcq', xp: 10, answer: { correct_option_id: 'a' } });
  });

  it('returns a segment with answer=undefined when no key exists (caller maps this to 422)', () => {
    const seg = findGradingSegment(document, {}, 'quiz-1');
    expect(seg?.answer).toBeUndefined();
  });

  it('returns null when the segment id does not exist in the document', () => {
    expect(findGradingSegment(document, answerKeys, 'nope')).toBeNull();
  });
});

describe('xpBySegmentId / gradedSegmentIds', () => {
  it('maps xp per segment id and lists graded (answer-keyed) segment ids', () => {
    const document = {
      segments: [
        { id: 'story-1', type: 'story_scene', xp: 0 },
        { id: 'quiz-1', type: 'quiz_mcq', xp: 10 },
      ],
    };
    const answerKeys = { 'quiz-1': { correct_option_id: 'a' } };
    expect(xpBySegmentId(document)).toEqual(new Map([['story-1', 0], ['quiz-1', 10]]));
    expect(gradedSegmentIds(answerKeys)).toEqual(['quiz-1']);
  });
});
