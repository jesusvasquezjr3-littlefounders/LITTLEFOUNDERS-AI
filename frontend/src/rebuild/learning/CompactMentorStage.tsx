import type { AgeBand } from '../design/copyBudget';
import { REGISTERS, registerForCopyBand } from '../design/learnerRegisterPolicy.generated';
import { MentorStage } from '../mentor/MentorStage';
import { lessonStateFor, resolveMentorPose, type LessonVerdict } from '../mentor/stageStates';
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
export function CompactMentorStage({ ageBand, theme, verdict, character, scene, beat }: {
  ageBand: AgeBand; theme: 'light' | 'dark'; verdict: LessonVerdict;
  character: LessonMentorStage['character']; scene: LessonMentorStage['scene'];
  /** Bump for each new verdict, so a second miss gets a second nod. */
  beat?: number;
}) {
  return <MentorStage size="compact" character={character} scene={scene} state={lessonStateFor(verdict)} ageBand={ageBand}
    theme={theme} beat={beat} />;
}
