/*
 * The lesson-thread chip's step dots (ORACLE.md §19.5 — "the conversing-phase
 * screen-state machine and step dots"; the step dots half of that pair).
 *
 * `ConversationView.tsx` already prints "Lesson · step {{step}} of {{of}}" as
 * text (V4/C6, `TutorOrchestrator.lessonThread`) — the accessible source of
 * truth, and RUNBOOK.md Round 124's fix for exactly what that pair of numbers
 * counts by. Dots are a purely VISUAL companion to that text, not a second
 * source of truth: a glance at filled-vs-empty circles reads faster than two
 * numbers, but a screen reader must hear the sentence once, not the sentence
 * and then a dot count — see the `aria-hidden` on the row that renders these.
 *
 * PURE AND SEPARATELY TESTED, the same reason `stage/phases.ts` and
 * `replay/replayScript.ts`'s `progressOf` are: the one way this can go wrong
 * is an out-of-range `step`/`of` from a server that evolves independently of
 * this file, and AGENTS.md §1.14's "degrade rather than crash" applies to a
 * display-only read exactly like this one.
 */

export type LessonStepDotState = 'done' | 'current' | 'upcoming';

/**
 * A defensive ceiling on how many dots this ever draws, independent of the
 * data. Nothing today plans more than six: `oracle/src/tutor/plan.ts`'s
 * macro arc is 3-5 steps, and `PedagogicalController.kcProgress` counts a
 * session plan capped at up to 2 review entries plus 4 frontier entries
 * (/ORACLE.md §19.1). The chip this renders inside is a `max-w-[60vw]` pill
 * that already truncates its own text on a phone; nothing would gain from a
 * ninth or tenth dot even if a future planner ever sent one.
 */
export const MAX_LESSON_STEP_DOTS = 8;

/**
 * One state per dot, left to right. Empty when there is nothing to show —
 * the caller's own job is not calling this at all while `of <= 0`, but the
 * function still answers safely rather than trusting that.
 *
 * `step`/`of` are clamped rather than trusted: both cross a network boundary
 * (`ws/server.ts`'s `lesson` frame) that this file does not control, and
 * `Array.from({ length: negative })` throws — a malformed pair must degrade
 * to no dots, never crash a screen a child is looking at.
 */
export function lessonStepDots(step: number, of: number): LessonStepDotState[] {
  const total = Math.min(Math.max(Math.trunc(of), 0), MAX_LESSON_STEP_DOTS);
  if (total <= 0) return [];
  const currentIndex = Math.min(Math.max(Math.trunc(step), 1), total) - 1;
  return Array.from({ length: total }, (_, i) =>
    i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming',
  );
}
