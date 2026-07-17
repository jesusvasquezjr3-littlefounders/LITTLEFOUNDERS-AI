import { describe, expect, it } from 'vitest';
import { splitDocument, computeXpTotal } from '../pipeline/publish.js';
import { buildDocument } from './fixtures.js';

describe('splitDocument', () => {
  it('strips `answer` from every segment in the client document', () => {
    const doc = buildDocument();
    const { clientDocument } = splitDocument(doc);
    const segments = (clientDocument as { segments: Record<string, unknown>[] }).segments;
    for (const segment of segments) {
      expect('answer' in segment).toBe(false);
    }
  });

  it('produces an answer_keys entry for every graded segment, keyed by segment id', () => {
    const doc = buildDocument();
    const { answerKeys } = splitDocument(doc);
    const gradedSegments = doc.segments.filter((s) => (s as { answer?: unknown }).answer !== undefined);
    expect(Object.keys(answerKeys).sort()).toEqual(gradedSegments.map((s) => s.id).sort());
  });

  it('answer_keys values are byte-identical to the original answers', () => {
    const doc = buildDocument();
    const { answerKeys } = splitDocument(doc);
    for (const segment of doc.segments) {
      const answer = (segment as { answer?: unknown }).answer;
      if (answer === undefined) continue;
      expect(JSON.stringify(answerKeys[segment.id])).toBe(JSON.stringify(answer));
    }
  });

  it('never drops non-answer fields from client segments', () => {
    const doc = buildDocument();
    const { clientDocument } = splitDocument(doc);
    const segments = (clientDocument as { segments: Record<string, unknown>[] }).segments;
    expect(segments).toHaveLength(doc.segments.length);
    expect(segments[0]!.id).toBe(doc.segments[0]!.id);
    expect(segments[0]!.type).toBe(doc.segments[0]!.type);
  });

  it('content (story) segments have no answer key entry at all', () => {
    const doc = buildDocument();
    const { answerKeys } = splitDocument(doc);
    const storySegmentId = doc.segments.find((s) => s.type === 'story_scene')!.id;
    expect(storySegmentId in answerKeys).toBe(false);
  });
});

describe('computeXpTotal', () => {
  it('sums xp across all segments', () => {
    const doc = buildDocument();
    const expected = doc.segments.reduce((sum, s) => sum + (s as { xp: number }).xp, 0);
    expect(computeXpTotal(doc)).toBe(expected);
  });
});
