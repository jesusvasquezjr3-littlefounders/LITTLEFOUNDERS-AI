import { createHash } from 'node:crypto';

/** One ordered narratable unit extracted from a LessonDocument. */
export interface NarrationUnit {
  /** Deterministic id: `${segment_id}.${field}`. */
  unit_id: string;
  segment_id: string;
  /** e.g. 'prompt' | 'explanation' | 'body' | 'recap' | 'line.0' | 'idea.1' | 'card.2.back'. */
  field: string;
  /** Plain narration text — MarkdownLite already stripped. */
  text: string;
  /** `segment.narrator?.character` (dina/liruf/rho/zara) when the segment declares one — undefined otherwise. */
  character?: string;
}

/** Idempotency key: sha256(text + voice + model). Unchanged text/voice/model → reused. */
export function contentHash(text: string, voice: string, model: string): string {
  return createHash('sha256').update(`${text} ${voice} ${model}`).digest('hex');
}
