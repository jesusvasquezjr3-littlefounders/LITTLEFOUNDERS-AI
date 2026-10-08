import type { AgeBand } from '../design/copyBudget';
import { isMilestone, type Milestone } from '../design/milestones';
import { REGISTERS, registerForCopyBand } from '../design/learnerRegisterPolicy.generated';
import type { CharacterAction, CharacterEmotion } from './session/vocabulary';

/*
 * What the learner sees the Mentor do, as catalogue
 * poses. The UI requests a STATE; this module says which pose of the pose
 * catalogue (`tutor-scene/poseLibrary.ts`) plays it, for the learner's age band.
 * It never invents a pose: every id below is a catalogue row.
 *
 * Pure on purpose: the mapping needs no GPU, and the rebuilt Mentor
 * screen and the lesson's compact stage read the same table.
 */

/** The eight states, plus a neutral reaction to a met answer in a lesson. */
export const MENTOR_STAGE_STATES = [
  'idle', 'listening', 'thinking', 'speaking', 'demonstrating', 'encouraging', 'celebrating', 'closing', 'acknowledging',
] as const;
export type MentorStageState = (typeof MENTOR_STAGE_STATES)[number];

/** How a session ended, which picks the closing gesture: the server's closing script. */
export const CLOSING_SCRIPTS = ['completed', 'interrupted', 'learner_left', 'safety_stop'] as const;
export type MentorClosingScript = (typeof CLOSING_SCRIPTS)[number];

/** Idle and reaction animation level for the character, from the register policy. */
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
 *   ambient.listen         "The Tutor while the learner is speaking or typing." (catalogue wording)
 *   think.ponder           "While the learner is deciding." A thinking pose, never typing dots.
 *   teach.aside            thinking, held low: the calm register's thinking pose.
 *   ambient.idle.happy     resting and warm; the speaking animation (articulation and, with audio, the
 *                          mouth) is layered on top by the renderer.
 *   teach.explain          "Walking through a worked example." A pointing gesture toward the board.
 *   feedback.retry.gentle  a warm nod after a miss. Never disappointment, never a sad face.
 *   feedback.correct.quiet "Right, but the segment continues - no interruption."
 *   greet.nod              "Acknowledging the learner with no words." The calm register's met reaction.
 *   celebrate.with         "Celebrating WITH the learner rather than at them." Milestones only.
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

/** Every catalogue pose this module can return. */
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

/** The calm register (13–17 and adults): the same character, calmer animation, framing never childish. */
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
  /** Required for `celebrating`: the milestone reached in this session. */
  milestone?: Milestone | null;
  /** How the session ended, for `closing`. Defaults to a completed session. */
  closing?: MentorClosingScript | null;
}

export interface ResolvedMentorPose {
  /**
   * The state actually shown. Equal to the request except for a celebration
   * without a closed-list milestone, which is refused and shown as `idle`: the
   * stage never celebrates outside the milestone list, and never fakes a state.
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

/** A lesson verdict: the compact stage introduces, then reacts. */
export type LessonVerdict = 'met' | 'review' | 'incomplete' | 'invalid' | null;

/** The stage state for a lesson verdict: an encouraging reaction to a miss, a neutral one to a met answer. Never a celebration. */
export function lessonStateFor(verdict: LessonVerdict): MentorStageState {
  return verdict === null ? 'idle' : verdict === 'met' ? 'acknowledging' : 'encouraging';
}

/**
 * What the lesson asks of the compact
 * stage besides a verdict. `speaking` while the Mentor's narration plays (and
 * the short introduction hold when a segment opens), `demonstrating` while a
 * worked example or a step replay is on screen, `encouraging` while the
 * guided-review offer is open ("when offering a guided review").
 */
export interface LessonStageRequests {
  speaking: boolean;
  demonstrating: boolean;
  encouraging: boolean;
}

export const NO_LESSON_STAGE_REQUESTS: LessonStageRequests = { speaking: false, demonstrating: false, encouraging: false };

/**
 * The compact stage's state in a lesson. A verdict reaction wins (the
 * stage reacts to answers), then an open offer, then the Mentor speaking (its
 * narration, or the introduction of a new segment), then a demonstration
 * beside the board; otherwise idle. No path returns `celebrating`.
 */
export function lessonStageStateFor(verdict: LessonVerdict, { intro = false, requests = NO_LESSON_STAGE_REQUESTS }: {
  intro?: boolean; requests?: LessonStageRequests;
} = {}): MentorStageState {
  if (verdict !== null) return lessonStateFor(verdict);
  if (requests.encouraging) return 'encouraging';
  if (requests.speaking || intro) return 'speaking';
  if (requests.demonstrating) return 'demonstrating';
  return 'idle';
}
