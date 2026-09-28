import type { LessonClientDocument } from './lessonDocument';
import { v2ScorerPayload } from './v2ScorerPayload.generated';
import { scoreV2Visual, type V2VisualKind } from './v2VisualScorer.generated';

/**
 * Appendix P Part 8 scorer parity (GAP-FIX-R2): the browser's advisory reading
 * of an answer with the same canonical scorer and semantic payload Core uses,
 * without a rubric (the browser never has one). Core records whether it
 * agreed and never grades with it. Undefined for kinds the visual scorer does
 * not grade (concept boards, voice turns) or a segment the document lacks.
 */
export function clientScorerVerdict(document: LessonClientDocument, segmentId: string, answer: unknown): 'valid' | 'invalid' | undefined {
  const segment = document.segments.find((item) => item.id === segmentId);
  if (!segment) return undefined;
  const payload = v2ScorerPayload(segment as unknown as { type: string; payload: Record<string, unknown> });
  if (!payload) return undefined;
  try {
    return scoreV2Visual(segment.type as V2VisualKind, payload, answer) === 'invalid' ? 'invalid' : 'valid';
  } catch {
    return 'invalid';
  }
}
