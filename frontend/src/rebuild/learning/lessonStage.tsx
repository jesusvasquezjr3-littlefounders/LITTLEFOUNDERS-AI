import { createContext, useContext, type ReactNode } from 'react';
import type { AgeBand } from '../design/copyBudget';
import { CompactMentorStage } from './CompactMentorStage';
import type { LessonMentorStage } from './lessonDocument';

/*
 * W2L.3 (B.8, Bible 08 §11): the compact Mentor stage on every v2 board, not
 * only the allocation pilot. The authenticated lesson response carries Core's
 * `mentor_stage` projection (the learner's own character and the lesson's
 * scene); the lesson renderer provides it here once and each board places the
 * slot under its progress row. Without a projection (a preview, a malformed
 * answer, a failed preference read) the slot renders nothing: the stage is
 * cosmetic and never blocks learning. The stage itself is the one named
 * bridge to the 3D engine (`CompactMentorStage.tsx`); when the Mentor lane
 * ships the shared `rebuild/mentor/MentorStage.tsx`, this slot is the one
 * place that switches to it.
 */
interface LessonStage { stage: LessonMentorStage; ageBand: AgeBand; theme: 'light' | 'dark' }

const LessonStageContext = createContext<LessonStage | null>(null);

export function LessonStageProvider({ stage, ageBand, theme, children }: {
  stage: LessonMentorStage | null; ageBand: AgeBand; theme: 'light' | 'dark'; children: ReactNode;
}) {
  return <LessonStageContext.Provider value={stage ? { stage, ageBand, theme } : null}>{children}</LessonStageContext.Provider>;
}

/** The board's own verdict, read only as met or a miss; anything else is a neutral stage. Never a celebration (D7). */
export function stageVerdict(verdict: unknown): 'met' | 'review' | null {
  return verdict === 'met' ? 'met' : verdict === 'review' ? 'review' : null;
}

export function LessonStageSlot({ verdict }: { verdict?: unknown }) {
  const value = useContext(LessonStageContext);
  if (!value) return null;
  return <CompactMentorStage ageBand={value.ageBand} theme={value.theme} verdict={stageVerdict(verdict)}
    character={value.stage.character} scene={value.stage.scene} />;
}
