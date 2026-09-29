import type { ReactNode } from 'react';
import type { AgeBand } from '../design/copyBudget';
import { REGISTERS, registerForCopyBand } from '../design/learnerRegisterPolicy.generated';
import { MentorStage } from '../mentor/MentorStage';
import { lessonStateFor, resolveMentorPose, type LessonVerdict, type MentorStageState } from '../mentor/stageStates';
import type { LessonMentorStage } from './lessonDocument';
import './mentorStage.css';

/**
 * B.23 / B.26 (S05.3f): presence and reactions come from the one register
 * policy, through the Mentor stage's own state table (`mentor/stageStates.ts`).
 * A miss is always met with encouragement, never a sad or disappointed state; a
 * teen's Mentor is calmer and smaller. Never a celebration for a single answer
 * (OD-7).
 */
export function mentorReaction(ageBand: AgeBand, verdict: LessonVerdict) {
  const mentor = REGISTERS[registerForCopyBand(ageBand)].mentor;
  const { pose } = resolveMentorPose({ state: lessonStateFor(verdict), ageBand });
  return { mentor, emotion: pose.emotion, action: pose.action };
}

/**
 * The lesson player's Mentor presence (Frontend Bible 08 §11, B.8): the SAME
 * stage component as the Mentor screen, at its compact size. Decorative here:
 * the lesson's prompt label carries the Mentor's name and words.
 */
export function CompactMentorStage({ ageBand, theme, verdict, state, character, scene, beat, backdrop = null }: {
  ageBand: AgeBand; theme: 'light' | 'dark'; verdict: LessonVerdict;
  /**
   * GAP-FIX-R5 (08 §11): the state the lesson requests (`lessonStageStateFor`: introducing, speaking,
   * demonstrating, offering), already resolved against the verdict. Absent: the verdict alone decides.
   */
  state?: MentorStageState;
  character: LessonMentorStage['character']; scene: LessonMentorStage['scene'];
  /** Bump for each new verdict, so a second miss gets a second nod. */
  beat?: number;
  /** The lesson's adventure scene, drawn inside the one band (GAP-FIX-R3), never as its own stripe. */
  backdrop?: ReactNode;
}) {
  return <MentorStage size="compact" character={character} scene={scene} state={state ?? lessonStateFor(verdict)} ageBand={ageBand}
    theme={theme} beat={beat} backdrop={backdrop} />;
}
