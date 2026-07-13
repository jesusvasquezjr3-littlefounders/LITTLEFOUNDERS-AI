import type {
  CheckpointPayload,
  ConceptRevealPayload,
  KeyIdeasPayload,
  LessonDocument,
  LessonSegment,
  StoryDialoguePayload,
  StoryScenePayload,
} from '../types/lessonDocument.js';
import { stripMarkdown } from './stripMarkdown.js';
import type { NarrationUnit } from './types.js';

/*
 * Walks a LessonDocument and returns the ORDERED narratable units
 * (LESSON_ENGINE.md §12): `prompt_md` on every segment; the `story` family's
 * bodies (§5.1); `explanation_md` when present. Deterministic unit id:
 * `${segment_id}.${field}`.
 */
export function extractNarratables(document: LessonDocument): NarrationUnit[] {
  const units: NarrationUnit[] = [];

  for (const segment of document.segments) {
    push(units, segment, 'prompt', segment.prompt_md);
    pushStoryBodies(units, segment);
    if (segment.explanation_md) push(units, segment, 'explanation', segment.explanation_md);
  }

  return units;
}

function push(units: NarrationUnit[], segment: LessonSegment, field: string, raw: string | undefined): void {
  if (!raw) return;
  const text = stripMarkdown(raw);
  if (text.length === 0) return;
  units.push({ unit_id: `${segment.id}.${field}`, segment_id: segment.id, field, text });
}

function pushStoryBodies(units: NarrationUnit[], segment: LessonSegment): void {
  switch (segment.type) {
    case 'story_dialogue': {
      const payload = segment.payload as unknown as StoryDialoguePayload;
      payload.lines?.forEach((line, i) => push(units, segment, `line.${i}`, line.text_md));
      break;
    }
    case 'story_scene': {
      const payload = segment.payload as unknown as StoryScenePayload;
      push(units, segment, 'body', payload.body_md);
      break;
    }
    case 'key_ideas': {
      const payload = segment.payload as unknown as KeyIdeasPayload;
      payload.ideas?.forEach((idea, i) => push(units, segment, `idea.${i}`, idea.body_md));
      break;
    }
    case 'concept_reveal': {
      const payload = segment.payload as unknown as ConceptRevealPayload;
      payload.cards?.forEach((card, i) => push(units, segment, `card.${i}.back`, card.back_md));
      break;
    }
    case 'checkpoint': {
      const payload = segment.payload as unknown as CheckpointPayload;
      push(units, segment, 'recap', payload.recap_md);
      break;
    }
    default:
      // Non-story segments: only the shared envelope fields (prompt/explanation) narrate.
      break;
  }
}
