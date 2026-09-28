import type { PaceStatus } from './autonomy.js';
import type { CelebrationMilestone } from './celebrationBudget.js';
import type { LessonCompletionResult } from './supabaseRest.js';
import type { V2PublicLesson } from './v2LessonDocument.js';

/*
 * B.5 (S05.3d): the authenticated completion receipt the rebuilt result
 * screen renders. Every number in it comes from the database transaction
 * (complete_lesson / complete_v2_lesson); the browser supplies nothing but the
 * run it finished and the wall-clock time it measured. The receipt carries no
 * answer, rubric, reason text or age evidence.
 *
 * XP policy ("improvement_only", unchanged since 0083 and now stated): a run
 * adds XP only above the XP already kept for the lesson, and neither the kept
 * best score nor XP is ever lowered. So a replay is practice: it can raise the
 * record, never cost it, and never farm XP by repetition.
 */

export interface V2CompletionReceipt {
  schema_version: 2;
  completion_id: string;
  lesson_id: string;
  version_id: string;
  locale: V2PublicLesson['locale'];
  first_try_correct: number;
  graded_count: number;
  /** GAP-FIX-R1: non-scored steps acted on, and help-ladder steps used (0 for a lesson stored before 0193). */
  viewed_count: number;
  hints_used: number;
  awarded_xp: number;
  duration_seconds: number;
  previous_best_percent: number;
  replay: {
    kind: 'first' | 'retry' | 'replay';
    notice: 'best_kept' | 'new_best' | 'none';
    best_score_kept: boolean;
    xp_policy: 'improvement_only';
  };
  judgment: { assessed: number; sound: number; partial: number; unsupported: number };
  /*
   * S05.3e. B.20: the closed OD-7 list this completion reached (the result
   * screen celebrates nothing else) and what was figured out, so the XP tally
   * reads as information about a skill rather than payment. B.21: the streak
   * after this run, and its milestone if it reached one. B.24: today's passed
   * lessons against the learner's own pace.
   */
  celebrations: CelebrationMilestone[];
  recognition?: { skills: string[] };
  streak?: { days: number; milestone: 7 | 30 | 100 | null; rest_days_bridged: number };
  pace?: { goal: number; passed_today: number; goal_met: boolean };
}

/** True when the result screen must say the saved best is unaffected (B.5). */
export function replayNoticeRequired(completion: Pick<LessonCompletionResult, 'replay'>): boolean {
  return completion.replay?.notice === 'best_kept';
}

/**
 * Projects a v2 completion into the rebuilt receipt. Returns null for a
 * receipt stored before the S05.3d migration (no first-try facts), so the
 * client falls back to its plain "saved" state instead of inventing numbers.
 */
export function buildV2CompletionReceipt(input: {
  completion: LessonCompletionResult;
  runId: string;
  document: Pick<V2PublicLesson, 'lesson_id' | 'version_id' | 'locale'>;
  secondsSpent: number;
  motivation?: { celebrations: CelebrationMilestone[]; recognition?: { skills: string[] }; pace?: PaceStatus };
}): V2CompletionReceipt | null {
  const { completion, runId, document } = input;
  if (completion.first_try_correct === undefined || completion.graded_count === undefined
    || completion.first_try_correct > completion.graded_count || !completion.replay) return null;
  return {
    schema_version: 2,
    completion_id: runId,
    lesson_id: document.lesson_id,
    version_id: document.version_id,
    locale: document.locale,
    first_try_correct: completion.first_try_correct,
    graded_count: completion.graded_count,
    viewed_count: completion.viewed_count ?? 0,
    hints_used: completion.hints_used ?? 0,
    awarded_xp: completion.xp_delta,
    duration_seconds: Math.max(1, Math.min(7200, Math.round(input.secondsSpent))),
    previous_best_percent: completion.replay.previous_best_score ?? 0,
    replay: {
      kind: completion.replay.kind,
      notice: completion.replay.notice,
      best_score_kept: completion.replay.best_score_kept,
      xp_policy: completion.replay.xp_policy,
    },
    judgment: completion.judgment ?? { assessed: 0, sound: 0, partial: 0, unsupported: 0 },
    celebrations: input.motivation?.celebrations ?? [],
    ...(input.motivation?.recognition ? { recognition: input.motivation.recognition } : {}),
    ...(completion.streak ? { streak: { days: completion.streak_days, milestone: completion.streak.milestone, rest_days_bridged: completion.streak.rest_days_bridged } } : {}),
    ...(input.motivation?.pace ? { pace: { goal: input.motivation.pace.goal, passed_today: input.motivation.pace.passedToday, goal_met: input.motivation.pace.goalMet } } : {}),
  };
}
