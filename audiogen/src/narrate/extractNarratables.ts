import type {
  CheckpointPayload,
  EavesdropPayload,
  ConceptRevealPayload,
  KeyIdeasPayload,
  LessonDocument,
  LessonSegment,
  StoryDialoguePayload,
  StoryScenePayload,
} from '../types/lessonDocument.js';
import { stripMarkdown } from './stripMarkdown.js';
import { normalizeForSpeech } from './normalizeForSpeech.js';
import type { NarrationUnit } from './types.js';

/*
 * Walks a LessonDocument and returns the ORDERED narratable units
 * (LESSON_ENGINE.md §12): `prompt_md` on every segment; the `story` family's
 * bodies (§5.1); `explanation_md` when present; the `choices` roll-up (option
 * labels read in order) and each `hint` — so a pre-reader can HEAR the whole
 * exercise, not just the question (the QA inspection found played narration
 * coverage stuck at ~41% because options and hints had no audio). Deterministic
 * unit id: `${segment_id}.${field}`.
 */
export function extractNarratables(document: LessonDocument): NarrationUnit[] {
  const units: NarrationUnit[] = [];

  for (const segment of document.segments) {
    // B.18 (Mayer's redundancy principle): the author chose a channel. A
    // text_only segment is deliberately silent; a differentiated segment's
    // prompt clip reads the spoken script, never the on-screen cue. Forge's
    // redundancy gate (coursegen/src/contentGates) mirrors this exact rule —
    // agent/tools/check-narration-parity.mjs keeps the two in step.
    if (segment.narration?.mode === 'text_only') continue;
    const promptSource = segment.narration?.mode === 'differentiated' ? segment.narration.script_md : segment.prompt_md;
    push(units, segment, 'prompt', promptSource);
    pushStoryBodies(units, segment);
    pushChoices(units, segment);
    segment.hints?.forEach((hint, i) => push(units, segment, `hint.${i}`, hint));
    if (segment.explanation_md) push(units, segment, 'explanation', segment.explanation_md);
  }

  // Final speech-normalization pass (symbols → locale words, stage-direction
  // parentheticals dropped). Done once here, with the document locale in hand,
  // rather than threading locale through every push() call. A unit whose whole
  // text was a stage direction normalizes to empty and is dropped — correct:
  // it should produce no audio.
  const locale = document.meta.locale;
  return units
    .map((unit) => ({ ...unit, text: normalizeForSpeech(unit.text, locale) }))
    .filter((unit) => unit.text.length > 0);
}

function push(
  units: NarrationUnit[],
  segment: LessonSegment,
  field: string,
  raw: string | undefined,
  characterOverride?: string,
): void {
  if (!raw) return;
  const text = stripMarkdown(raw);
  if (text.length === 0) return;
  units.push({
    unit_id: `${segment.id}.${field}`,
    segment_id: segment.id,
    field,
    text,
    character: characterOverride ?? segment.narrator?.character,
  });
}

// Choice-family types whose option labels are read aloud as one `choices` clip
// after the prompt (arrange/input types use per-token interaction, not a roll-up).
const CHOICE_OPTION_TYPES = new Set([
  'quiz_mcq',
  'picture_choice',
  'best_decision',
  'confidence_quiz',
  'odd_one_out',
  'yes_no_cases',
  'would_you_rather',
]);

function optionTexts(segment: LessonSegment): string[] {
  const payload = segment.payload as Record<string, unknown>;
  const texts: string[] = [];
  const collect = (arr: unknown): void => {
    if (!Array.isArray(arr)) return;
    for (const entry of arr) {
      const item = entry as { text_md?: unknown; label?: unknown };
      if (typeof item?.text_md === 'string') texts.push(item.text_md);
      else if (typeof item?.label === 'string') texts.push(item.label);
    }
  };
  collect(payload.options);
  collect(payload.items);
  collect(payload.cases);
  for (const key of ['a', 'b'] as const) {
    const side = payload[key] as { text_md?: unknown } | undefined;
    if (typeof side?.text_md === 'string') texts.push(side.text_md);
  }
  return texts;
}

function pushChoices(units: NarrationUnit[], segment: LessonSegment): void {
  if (!CHOICE_OPTION_TYPES.has(segment.type)) return;
  const texts = optionTexts(segment);
  if (texts.length < 2) return; // nothing to read (or true/false booleans)
  push(units, segment, 'choices', texts.join('. '));
}

function pushStoryBodies(units: NarrationUnit[], segment: LessonSegment): void {
  switch (segment.type) {
    case 'story_dialogue': {
      // Each line names its own speaker — more precise than the segment's
      // (usually absent) envelope-level narrator.
      const payload = segment.payload as unknown as StoryDialoguePayload;
      payload.lines?.forEach((line, i) => push(units, segment, `line.${i}`, line.text_md, line.character));
      break;
    }
    case 'story_scene': {
      const payload = segment.payload as unknown as StoryScenePayload;
      push(units, segment, 'body', payload.body_md, payload.character);
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
    case 'eavesdrop': {
      // Overheard conversation (type 57): the scene-setting context narrates
      // after the prompt, then each line in its own character's voice —
      // exactly the story_dialogue treatment. ==highlight== markers are
      // stripped by stripMarkdown; the tap-to-explain notes are deliberately
      // NOT narrated (they are on-demand reading, like hints before the QA
      // coverage fix — but notes open in-flow while audio plays, and voicing
      // them would talk over the conversation).
      const payload = segment.payload as unknown as EavesdropPayload;
      push(units, segment, 'context', payload.context_md);
      payload.lines?.forEach((line, i) => push(units, segment, `line.${i}`, line.text_md, line.character));
      break;
    }
    default:
      // Non-story segments: only the shared envelope fields (prompt/explanation) narrate.
      break;
  }
}
