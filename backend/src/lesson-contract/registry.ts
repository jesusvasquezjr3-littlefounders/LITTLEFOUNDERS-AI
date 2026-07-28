// Server-side grader registry — mirrors frontend/src/lesson-engine/registry.ts's
// GRADERS composition (families only; no components/registry entries, Core
// never renders anything). `story` is intentionally absent: its 5 types are
// ungraded content (LESSON_ENGINE.md §5.1) and never reach the grade endpoint.

import type { FamilyGrader } from './core/types.js';
import { choiceGraders } from './families/choice/grade.js';
import { inputGraders } from './families/input/grade.js';
import { arrangeGraders } from './families/arrange/grade.js';
import { moneyGraders } from './families/money/grade.js';
import { analyzeGraders } from './families/analyze/grade.js';
import { storyplayGraders } from './families/storyplay/grade.js';
import { makerGraders } from './families/maker/grade.js';

export const GRADERS: Record<string, FamilyGrader> = {
  ...choiceGraders,
  ...inputGraders,
  ...arrangeGraders,
  ...moneyGraders,
  ...analyzeGraders,
  ...storyplayGraders,
  ...makerGraders,
};

/**
 * Types whose grader derives the score from the submitted board/payload alone
 * and carry NO server-side answer key (`segment.answer` is always undefined).
 * `memory_flip` scores from the flip count vs the pair count — it never had an
 * answer key, so the grade endpoint's blanket `segment.answer === undefined`
 * rejection made the lesson impossible to complete (422 on every submission).
 * The grade route must allow these types through without an answer key.
 */
export const KEYLESS_GRADERS = new Set<string>(['memory_flip']);
