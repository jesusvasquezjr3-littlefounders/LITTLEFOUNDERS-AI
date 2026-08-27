import type {
  CharacterAction,
  CharacterEmotion,
  CharacterId,
} from '@/components/characters/control/types';

/*
 * THE POSE LIBRARY — every concrete thing a character can be asked to do,
 * named once, documented, and reusable from the Lesson Engine, the Tutor,
 * marketing captures and anything built later.
 *
 * WHY A CATALOG AND NOT A COMBINATION. The primitives are 7 emotions and 12
 * actions, which multiply to 84 pairs. Most of those pairs are meaningless
 * ("surprised" + "bow") and a few are the entire product ("proud" + "celebrate"
 * after a correct answer). Enumerating the grid would produce 84 rows nobody
 * can choose between; this file names the ones that MEAN something and says
 * what each is for, so picking a pose is a decision about intent rather than
 * about which two enums to combine.
 *
 * A POSE IS NOT A NEW ANIMATION. Every entry resolves to the existing
 * emotion/action vocabulary that both the 2D rig and `Character3D` already
 * speak, plus presentation parameters. That is deliberate and it is what makes
 * the library cheap: adding a pose costs a row and a review, not an authored
 * clip and a download. Where the rig genuinely cannot express something, the
 * answer is a new clip in `clips-biped.glb` through `scripts/author-clips.py`
 * and a row here pointing at it - not a row here pretending.
 *
 * DINA IS NOT EXCLUDED, AND THE FIRST DRAFT OF THIS FILE HAD THAT WRONG.
 * She is a quadruped on a 27-joint rig, so the instinct is to mark every pose
 * that needs hands as biped-only. But `characterActions.ts` already carries a
 * QUADRUPED driver table typed `Record<CharacterAction, ...>` - all twelve
 * actions, expressed through the parts she has: head, chest, ears, and a tail
 * that carries most of the emotion. Excluding her here would have removed her
 * from poses she performs perfectly well, and would have duplicated a solved
 * problem with a worse solution.
 *
 * `only` survives for poses that are genuinely one character's - a signature
 * move, a marketing frame built around one silhouette - and for nothing else.
 * If a pose reads badly on a rig, the fix is in the driver table, not a row
 * here quietly dropping a character.
 */

export type PoseCategory =
  | 'greeting'
  | 'teaching'
  | 'feedback'
  | 'celebration'
  | 'thinking'
  | 'transition'
  | 'ambient'
  | 'marketing';

export interface Pose {
  /** Stable id. Content and code address a pose by this and nothing else. */
  id: string;
  category: PoseCategory;
  emotion: CharacterEmotion;
  action: CharacterAction;
  /** What this is FOR. The reason the catalog is worth more than the grid. */
  use: string;
  /*
   * Keeps playing until something changes it.
   *
   * Only for actions BOTH renderers loop, which today is `celebrate` and
   * `dance` and nothing else. The 3D procedural layer also loops `think`
   * (`LOOPING_ACTIONS`) while the 2D one does not (`LOOPABLE_ACTIONS`), so a
   * looping `think` pose would repeat in a lesson and fire once in a
   * marketing capture - the same content behaving differently depending on
   * who drew it. The catalog takes the INTERSECTION and the test enforces it.
   */
  loop?: boolean;
  /** Y rotation in radians. Non-zero when the pose reads better off-axis. */
  rotation?: number;
  /** Characters this pose is valid for. Absent means every character. */
  only?: readonly CharacterId[];
}

export const POSES: readonly Pose[] = Object.freeze([
  // ── greeting ───────────────────────────────────────────────────────────
  { id: 'greet.hello', category: 'greeting', emotion: 'happy', action: 'wave', use: 'First contact in a lesson or a Tutor session.' },
  { id: 'greet.warm', category: 'greeting', emotion: 'encouraging', action: 'wave', use: 'Returning learner, softer than a first hello.' },
  { id: 'greet.excited', category: 'greeting', emotion: 'excited', action: 'jump', use: 'A brand-new course opening.' },
  { id: 'greet.bow', category: 'greeting', emotion: 'neutral', action: 'bow', use: 'Formal open, Dr. Rho in particular.' },
  { id: 'greet.peek', category: 'greeting', emotion: 'happy', action: 'peek', use: 'Arriving mid-scene without taking it over.' },
  { id: 'greet.nod', category: 'greeting', emotion: 'neutral', action: 'nod', use: 'Acknowledging the learner with no words.' },
  { id: 'greet.hop', category: 'greeting', emotion: 'happy', action: 'hop', use: 'Light arrival for a young learner.' },

  // ── teaching ───────────────────────────────────────────────────────────
  { id: 'teach.point', category: 'teaching', emotion: 'neutral', action: 'point', use: 'Directing attention at the exercise body.' },
  { id: 'teach.point.excited', category: 'teaching', emotion: 'excited', action: 'point', use: 'The key idea of a segment.' },
  { id: 'teach.explain', category: 'teaching', emotion: 'encouraging', action: 'point', use: 'Walking through a worked example.' },
  { id: 'teach.emphasise', category: 'teaching', emotion: 'excited', action: 'nod', use: 'The sentence that must land.' },
  { id: 'teach.aside', category: 'teaching', emotion: 'thinking', action: 'idle', use: 'A caveat or a footnote, deliberately low energy.' },
  { id: 'teach.warn', category: 'teaching', emotion: 'surprised', action: 'shake', use: 'A common mistake, before it is made.' },
  { id: 'teach.recap', category: 'teaching', emotion: 'neutral', action: 'nod', use: 'Closing a segment by restating it.' },
  { id: 'teach.invite', category: 'teaching', emotion: 'encouraging', action: 'wave', use: 'Handing the turn to the learner.' },

  // ── feedback ───────────────────────────────────────────────────────────
  { id: 'feedback.correct', category: 'feedback', emotion: 'happy', action: 'nod', use: 'A right answer, first time.' },
  { id: 'feedback.correct.proud', category: 'feedback', emotion: 'proud', action: 'celebrate', use: 'A right answer on a hard item.' },
  { id: 'feedback.correct.streak', category: 'feedback', emotion: 'excited', action: 'jump', use: 'Several right in a row.' },
  { id: 'feedback.correct.quiet', category: 'feedback', emotion: 'happy', action: 'idle', use: 'Right, but the segment continues - no interruption.' },
  { id: 'feedback.retry', category: 'feedback', emotion: 'encouraging', action: 'shake', use: 'Wrong answer. Never scolding (LESSON_ENGINE.md).' },
  { id: 'feedback.retry.gentle', category: 'feedback', emotion: 'encouraging', action: 'nod', use: 'A second miss, softer than the first.' },
  { id: 'feedback.almost', category: 'feedback', emotion: 'surprised', action: 'think', use: 'Close but not right - the answer was reasonable.' },
  { id: 'feedback.hint', category: 'feedback', emotion: 'thinking', action: 'point', use: 'Offering a hint the learner asked for.' },
  { id: 'feedback.timeout', category: 'feedback', emotion: 'encouraging', action: 'wave', use: 'A timer ran out with no answer.' },

  // ── celebration ────────────────────────────────────────────────────────
  { id: 'celebrate.lesson', category: 'celebration', emotion: 'proud', action: 'celebrate', use: 'Lesson complete, on the results screen.', loop: true },
  { id: 'celebrate.perfect', category: 'celebration', emotion: 'excited', action: 'dance', use: 'A perfect score.', loop: true },
  { id: 'celebrate.streak', category: 'celebration', emotion: 'proud', action: 'jump', use: 'A daily streak extended.' },
  { id: 'celebrate.levelup', category: 'celebration', emotion: 'excited', action: 'celebrate', use: 'Crossing into a new adventure or saga.', loop: true },
  { id: 'celebrate.dance.slow', category: 'celebration', emotion: 'happy', action: 'dance', use: 'Background joy that must not pull focus.', loop: true },
  { id: 'celebrate.applaud', category: 'celebration', emotion: 'proud', action: 'wave', use: 'Applauding the learner rather than themselves.' },
  { id: 'celebrate.first', category: 'celebration', emotion: 'excited', action: 'hop', use: 'The learner’s very first completed lesson.' },
  { id: 'celebrate.comeback', category: 'celebration', emotion: 'proud', action: 'nod', use: 'Right after a run of wrong answers.' },

  // ── thinking ───────────────────────────────────────────────────────────
  { id: 'think.ponder', category: 'thinking', emotion: 'thinking', action: 'think', use: 'While the learner is deciding.' },
  { id: 'think.puzzled', category: 'thinking', emotion: 'surprised', action: 'think', use: 'An unexpected answer.' },
  { id: 'think.consider', category: 'thinking', emotion: 'thinking', action: 'nod', use: 'Weighing two options in a decision exercise.' },
  { id: 'think.wait', category: 'thinking', emotion: 'neutral', action: 'idle', use: 'Patient silence. The default while a learner reads.' },
  { id: 'think.curious', category: 'thinking', emotion: 'thinking', action: 'peek', use: 'Leaning in at something the learner did.' },
  { id: 'think.realise', category: 'thinking', emotion: 'surprised', action: 'jump', use: 'The moment an idea lands.' },

  // ── transition ─────────────────────────────────────────────────────────
  { id: 'transition.next', category: 'transition', emotion: 'happy', action: 'point', use: 'Moving to the next segment.' },
  { id: 'transition.enter', category: 'transition', emotion: 'neutral', action: 'peek', use: 'A character joining a scene already running.' },
  { id: 'transition.exit', category: 'transition', emotion: 'happy', action: 'wave', use: 'Leaving a scene.' },
  { id: 'transition.handoff', category: 'transition', emotion: 'encouraging', action: 'point', use: 'Passing narration to another character.', rotation: 0.5 },
  { id: 'transition.pause', category: 'transition', emotion: 'neutral', action: 'idle', use: 'A held beat between sections.' },
  { id: 'transition.recap', category: 'transition', emotion: 'neutral', action: 'bow', use: 'Closing a saga.' },

  // ── ambient ────────────────────────────────────────────────────────────
  { id: 'ambient.idle', category: 'ambient', emotion: 'neutral', action: 'idle', use: 'The resting state. Every surface’s default.' },
  { id: 'ambient.idle.happy', category: 'ambient', emotion: 'happy', action: 'idle', use: 'Resting, but the segment is going well.' },
  { id: 'ambient.listen', category: 'ambient', emotion: 'encouraging', action: 'idle', use: 'The Tutor while the learner is speaking or typing.' },
  { id: 'ambient.attentive', category: 'ambient', emotion: 'neutral', action: 'nod', use: 'Following along without interrupting.' },
  { id: 'ambient.sway', category: 'ambient', emotion: 'happy', action: 'dance', use: 'Very low-energy background motion.', loop: true },
  { id: 'ambient.watch', category: 'ambient', emotion: 'thinking', action: 'idle', use: 'Present but deliberately not the subject.' },

  // ── marketing ──────────────────────────────────────────────────────────
  { id: 'marketing.hero', category: 'marketing', emotion: 'happy', action: 'idle', use: 'Standing portrait for a landing surface.' },
  { id: 'marketing.present', category: 'marketing', emotion: 'encouraging', action: 'point', use: 'Presenting something beside them, e.g. a decision card.', rotation: 0.5 },
  { id: 'marketing.invite', category: 'marketing', emotion: 'happy', action: 'wave', use: 'A call to action.' },
  { id: 'marketing.proud', category: 'marketing', emotion: 'proud', action: 'idle', use: 'A confident still for a mentor line-up.' },
  { id: 'marketing.celebrate', category: 'marketing', emotion: 'excited', action: 'celebrate', use: 'A joyful capture for a results or pricing surface.', loop: true },
  { id: 'marketing.think', category: 'marketing', emotion: 'thinking', action: 'think', use: 'Illustrating a decision or a problem.' },
  { id: 'marketing.bow', category: 'marketing', emotion: 'neutral', action: 'bow', use: 'A closing frame.' },
]);

/** Every pose id, for exhaustiveness checks and the lab. */
export const POSE_IDS: readonly string[] = Object.freeze(POSES.map((p) => p.id));

const BY_ID = new Map(POSES.map((p) => [p.id, p]));

/** A pose by id, or null. Never throws: content is data and may be wrong. */
export function poseById(id: string): Pose | null {
  return BY_ID.get(id) ?? null;
}

/** Does this character support this pose? */
export function poseSupports(pose: Pose, id: CharacterId): boolean {
  return pose.only ? pose.only.includes(id) : true;
}

/*
 * The pose a character should actually play, given one that may not apply to
 * them. A quadruped asked to wave gets the closest thing in the same category
 * that it CAN do rather than nothing - falling back to a frozen idle would read
 * as a broken model, and reading as broken is worse than reading as different.
 */
export function resolvePose(id: string, character: CharacterId): Pose | null {
  const pose = poseById(id);
  if (!pose) return null;
  if (poseSupports(pose, character)) return pose;
  return (
    POSES.find((p) => p.category === pose.category && p.emotion === pose.emotion && poseSupports(p, character)) ??
    POSES.find((p) => p.category === pose.category && poseSupports(p, character)) ??
    poseById('ambient.idle')
  );
}

/** Poses grouped for the lab, in catalog order. */
export function posesByCategory(): Map<PoseCategory, Pose[]> {
  const out = new Map<PoseCategory, Pose[]>();
  for (const pose of POSES) {
    const list = out.get(pose.category) ?? [];
    list.push(pose);
    out.set(pose.category, list);
  }
  return out;
}
