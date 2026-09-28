import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import LessonPlayer from '@/lesson-engine/player/LessonPlayer';
import type { LessonDocument } from '@/lesson-engine/core/types';
import type { SessionState } from '@/lesson-engine/core/session';
import type { AudioManifest } from '@/lesson-engine/player/narration';
import type { ServerCompletion } from '@/lesson-engine/player/completion';
import { removeCheckpoint, writeCheckpoint, type LessonCheckpoint } from '@/lesson-engine/player/checkpoint';
import type { GuidedReviewOfferValue } from '@/rebuild/learning/GuidedReviewOffer';
import type { LearnerRegister } from '@/rebuild/design/learnerRegisterPolicy.generated';
import { createCoreGrader } from './coreGrader';
import { clearCoursesCache } from './coursesCache';
// The legacy global sheet (Tailwind, the legacy tokens and typefaces) belongs to this island alone, and only
// while it is mounted: the scope inserts it on mount and removes it on unmount, so it never outlives the lesson.
import { LegacySheetScope } from '@/app-routes/legacySheet';

/*
 * THE LEGACY LESSON ISLAND (W2L.3, OD-24).
 *
 * The v1 Lesson Player (`lesson-engine/player/LessonPlayer`, 57 segment
 * renderers) is the single sanctioned legacy surface left on the learner's
 * side: the published v1 catalog plays in it until the new catalog replaces
 * the legacy content (OD-24). This file is its one adapter. Nothing else in
 * the learner lane imports the legacy lesson engine's UI, and no rebuilt file
 * imports this one: the lesson route mounts it for a `schema_version: 1`
 * document only (lazily, so the legacy sheet never loads for a v2 lesson),
 * outside the rebuilt lesson layer, so no legacy component
 * leaks into rebuilt UI and no rebuilt root restyles the legacy player
 * (`legacyLessonIsland.test.ts` pins both directions).
 *
 * What it owns, unchanged from the route it was lifted from: Core's grader
 * for v1 segments (`coreGrader.ts`), the per-learner resume checkpoint
 * (signature-checked so a revised or translated document never inherits
 * segment indices or verdicts), the completion POST with its idempotent run
 * id and retry (the player keeps the results screen up and offers the retry;
 * `onExit` is the only navigation), and the learner's register for the
 * player's cast presence and milestone motion (B.23).
 */

export function LegacyLessonIsland({ lessonId, document, audio, checkpoint, storageKey, register, onGuidedReview, onReachedResults, onExit }: {
  lessonId: string;
  document: LessonDocument;
  /** Echo's narration manifest, as Core delivered it. */
  audio: unknown;
  /** The route's checkpoint, already reconciled with this document (`reconcileLegacyCheckpoint`). */
  checkpoint: { current: LessonCheckpoint };
  storageKey: string | null;
  register: LearnerRegister;
  onGuidedReview: (offer: GuidedReviewOfferValue) => void;
  /** Reaching the results means the lesson was not abandoned, whether or not the save succeeds. */
  onReachedResults: () => void;
  onExit: () => void;
}) {
  const { getToken } = useAuth();
  const saved = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  // Keep the run across reloads; Finish discards it so deliberate replay starts fresh.
  const [runId] = useState(() => checkpoint.current.runId);
  const grader = useMemo(() => createCoreGrader(lessonId, getToken, runId, { onGuidedReview }), [lessonId, getToken, runId, onGuidedReview]);

  const saveCheckpoint = useCallback((snapshot: SessionState, elapsedMs: number) => {
    if (!active.current) return;
    checkpoint.current.state = snapshot;
    checkpoint.current.elapsedMs = elapsedMs;
    if (storageKey) writeCheckpoint(storageKey, checkpoint.current);
  }, [checkpoint, storageKey]);

  async function persistCompletion(secondsSpent: number): Promise<ServerCompletion | null> {
    onReachedResults();
    const d = new Date();
    checkpoint.current.completion ??= {
      seconds_spent: Math.min(7200, Math.max(1, secondsSpent)),
      run_id: checkpoint.current.runId,
      local_date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    };
    if (storageKey) writeCheckpoint(storageKey, checkpoint.current);
    const token = await getToken();
    if (!active.current || !token) return null;
    // The player keeps the outcome visible and exposes an explicit retry
    // on null. Reuse the run id so a lost response cannot duplicate rewards.
    const { data, error } = await api<ServerCompletion>(`/learn/lessons/${lessonId}/complete`, {
      method: 'POST',
      token,
      body: checkpoint.current.completion,
    });
    // The shelf's cached progress is now wrong whether or not the persist succeeded.
    clearCoursesCache();
    if (!error) saved.current = true;
    return error ? null : data;
  }

  function exit() {
    if (saved.current && storageKey) removeCheckpoint(storageKey);
    onExit();
  }

  return <LegacySheetScope><LessonPlayer
    document={document}
    lessonId={lessonId}
    grader={grader}
    audio={(audio ?? {}) as AudioManifest}
    recovery={checkpoint.current}
    onCheckpoint={saveCheckpoint}
    onExit={exit}
    onComplete={(result) => persistCompletion(result.seconds_spent)}
    register={register}
  /></LegacySheetScope>;
}

export default LegacyLessonIsland;
