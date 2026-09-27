import type { AgeBand } from '../design/copyBudget';
import { isMilestone, type Milestone } from '../design/milestones';
import { REGISTERS, registerForCopyBand } from '../design/learnerRegisterPolicy.generated';
import type { CharacterAction, CharacterEmotion } from './session/vocabulary';

/*
 * What the learner sees the Mentor do (Frontend Bible 08 §3), as catalogue
 * poses. The UI requests a STATE; this module says which pose of the pose
 * catalogue (`tutor-scene/poseLibrary.ts`) plays it, for the learner's age band.
 * It never invents a pose: every id below is a catalogue row, and
 * `tutor-scene/__tests__/rebuildMentorParity.test.ts` checks each id exists and
 * that its emotion and action here are the catalogue's own.
 *
 * Pure on purpose: the mapping is tested without a GPU, and the rebuilt Mentor
 * screen and the lesson's compact stage read the same table (08 §11).
 */

/** The eight states of 08 §3, plus 08 §11's neutral reaction to a met answer in a lesson. */
export const MENTOR_STAGE_STATES = [
  'idle', 'listening', 'thinking', 'speaking', 'demonstrating', 'encouraging', 'celebrating', 'closing', 'acknowledging',
] as const;
export type MentorStageState = (typeof MENTOR_STAGE_STATES)[number];

/** How a session ended (C.16), which picks the closing gesture: the server's closing script. */
export const CLOSING_SCRIPTS = ['completed', 'interrupted', 'learner_left', 'safety_stop'] as const;
export type MentorClosingScript = (typeof CLOSING_SCRIPTS)[number];

/** Idle and reaction animation level for the character, from the register policy (B.23). */
export type MentorAnimationLevel = 'lively' | 'moderate' | 'calm';

/** One catalogue pose, as the stage plays it. */
export interface MentorPose {
  /** The pose catalogue id. */
  id: string;
  emotion: CharacterEmotion;
  action: CharacterAction;
}

const pose = (id: string, emotion: CharacterEmotion, action: CharacterAction): MentorPose => ({ id, emotion, action });

/*
 * The catalogue rows the stage uses, named once. `use` in the catalogue says
 * why each fits:
 *   ambient.idle           "The resting state. Every surface's default."
 *   ambient.listen         "The Tutor while the learner is speaking or typing." (catalogue wording, pre-OD-6)
 *   think.ponder           "While the learner is deciding." A thinking pose, never typing dots (08 §3).
 *   teach.aside            thinking, held low: the calm register's thinking pose.
 *   ambient.idle.happy     resting and warm; the speaking animation (articulation and, with audio, the
 *                          mouth) is layered on top by the renderer.
 *   teach.explain          "Walking through a worked example." A pointing gesture toward the board.
 *   feedback.retry.gentle  a warm nod after a miss. Never disappointment, never a sad face (B.26).
 *   feedback.correct.quiet "Right, but the segment continues - no interruption." (08 §11)
 *   greet.nod              "Acknowledging the learner with no words." The calm register's met reaction.
 *   celebrate.with         "Celebrating WITH the learner rather than at them." D7 milestones only.
 *   celebrate.applaud      "Applauding the learner rather than themselves." The calm register's milestone.
 *   transition.close.warm  "A warm close to a segment that went well." A completed session.
 *   transition.exit        "Leaving a scene." A paused or left session: see you next time.
 *   transition.pause       "A held beat between sections." A safety stop: calm, no praise.
 */
const P = {
  idle: pose('ambient.idle', 'neutral', 'idle'),
  listen: pose('ambient.listen', 'encouraging', 'idle'),
  ponder: pose('think.ponder', 'thinking', 'think'),
  aside: pose('teach.aside', 'thinking', 'idle'),
  speak: pose('ambient.idle.happy', 'happy', 'idle'),
  explain: pose('teach.explain', 'encouraging', 'point'),
  retryGentle: pose('feedback.retry.gentle', 'encouraging', 'nod'),
  correctQuiet: pose('feedback.correct.quiet', 'happy', 'idle'),
  nod: pose('greet.nod', 'neutral', 'nod'),
  celebrateWith: pose('celebrate.with', 'encouraging', 'celebrate'),
  applaud: pose('celebrate.applaud', 'proud', 'wave'),
  closeWarm: pose('transition.close.warm', 'encouraging', 'bow'),
  exit: pose('transition.exit', 'happy', 'wave'),
  pause: pose('transition.pause', 'neutral', 'idle'),
} as const;

/** Every catalogue pose this module can return (for the parity test and the audit). */
export const MENTOR_STAGE_POSES: readonly MentorPose[] = Object.values(P);

type OpenState = Exclude<MentorStageState, 'closing'>;

/** Lively and moderate registers (6–9, 10–12). */
const EXPRESSIVE: Record<OpenState, MentorPose> = {
  idle: P.idle,
  listening: P.listen,
  thinking: P.ponder,
  speaking: P.speak,
  demonstrating: P.explain,
  encouraging: P.retryGentle,
  acknowledging: P.correctQuiet,
  celebrating: P.celebrateWith,
};

/** The calm register (13–17 and adults): the same character, calmer animation, framing never childish (08 §9). */
const CALM: Record<OpenState, MentorPose> = {
  ...EXPRESSIVE,
  thinking: P.aside,
  encouraging: P.listen,
  acknowledging: P.nod,
  celebrating: P.applaud,
};

const CLOSING: Record<MentorClosingScript, MentorPose> = {
  completed: P.closeWarm,
  interrupted: P.exit,
  learner_left: P.exit,
  safety_stop: P.pause,
};

/** The animation level of a copy band's register. */
export function animationLevelFor(ageBand: AgeBand): MentorAnimationLevel {
  return REGISTERS[registerForCopyBand(ageBand)].mentor.animation;
}

export interface MentorPoseRequest {
  state: MentorStageState;
  ageBand: AgeBand;
  /** Required for `celebrating`: the D7 milestone reached in this session (OD-7). */
  milestone?: Milestone | null;
  /** How the session ended, for `closing` (C.16). Defaults to a completed session. */
  closing?: MentorClosingScript | null;
}

export interface ResolvedMentorPose {
  /**
   * The state actually shown. Equal to the request except for a celebration
   * without a closed-list milestone, which is refused and shown as `idle`: the
   * stage never celebrates outside D7, and never fakes a state.
   */
  state: MentorStageState;
  pose: MentorPose;
}

/** The catalogue pose for a requested state, age band, milestone and closing script. */
export function resolveMentorPose({ state, ageBand, milestone = null, closing = null }: MentorPoseRequest): ResolvedMentorPose {
  const shown: MentorStageState = state === 'celebrating' && !(milestone && isMilestone(milestone)) ? 'idle' : state;
  if (shown === 'closing') return { state: shown, pose: CLOSING[closing && CLOSING_SCRIPTS.includes(closing) ? closing : 'completed'] };
  const table = animationLevelFor(ageBand) === 'calm' ? CALM : EXPRESSIVE;
  return { state: shown, pose: table[shown] };
}

/** A lesson verdict (08 §11): the compact stage introduces, then reacts. */
export type LessonVerdict = 'met' | 'review' | 'incomplete' | 'invalid' | null;

/** The stage state for a lesson verdict: an encouraging reaction to a miss, a neutral one to a met answer. Never a celebration. */
export function lessonStateFor(verdict: LessonVerdict): MentorStageState {
  return verdict === null ? 'idle' : verdict === 'met' ? 'acknowledging' : 'encouraging';
}
