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
  { id: 'greet.plain', category: 'greeting', emotion: 'neutral', action: 'wave', use: 'A plain open, for a lesson whose own copy sets the tone.' },
  { id: 'greet.return', category: 'greeting', emotion: 'excited', action: 'wave', use: 'The learner is back after several days away.' },
  { id: 'greet.shy', category: 'greeting', emotion: 'surprised', action: 'peek', use: 'Appearing where the learner did not expect a character.' },
  { id: 'greet.thanks', category: 'greeting', emotion: 'happy', action: 'bow', use: 'Thanking the learner for showing up today.' },
  { id: 'greet.ready', category: 'greeting', emotion: 'encouraging', action: 'hop', use: 'Signalling that the exercise is about to begin.' },
  { id: 'greet.settle', category: 'greeting', emotion: 'excited', action: 'idle', use: 'Arrived and eager, waiting to be given the floor.' },

  // ── teaching ───────────────────────────────────────────────────────────
  { id: 'teach.point', category: 'teaching', emotion: 'neutral', action: 'point', use: 'Directing attention at the exercise body.' },
  { id: 'teach.point.excited', category: 'teaching', emotion: 'excited', action: 'point', use: 'The key idea of a segment.' },
  { id: 'teach.explain', category: 'teaching', emotion: 'encouraging', action: 'point', use: 'Walking through a worked example.' },
  { id: 'teach.emphasise', category: 'teaching', emotion: 'excited', action: 'nod', use: 'The sentence that must land.' },
  { id: 'teach.aside', category: 'teaching', emotion: 'thinking', action: 'idle', use: 'A caveat or a footnote, deliberately low energy.' },
  { id: 'teach.warn', category: 'teaching', emotion: 'surprised', action: 'shake', use: 'A common mistake, before it is made.' },
  { id: 'teach.recap', category: 'teaching', emotion: 'neutral', action: 'nod', use: 'Closing a segment by restating it.' },
  { id: 'teach.invite', category: 'teaching', emotion: 'encouraging', action: 'wave', use: 'Handing the turn to the learner.' },
  { id: 'teach.spot', category: 'teaching', emotion: 'surprised', action: 'point', use: 'Calling out a detail the learner has just uncovered.' },
  { id: 'teach.showcase', category: 'teaching', emotion: 'proud', action: 'point', use: 'Presenting the learner’s own work back to them.' },
  { id: 'teach.rule.out', category: 'teaching', emotion: 'thinking', action: 'shake', use: 'Discarding a candidate answer while reasoning aloud.' },
  { id: 'teach.weigh', category: 'teaching', emotion: 'neutral', action: 'think', use: 'Holding two options side by side before choosing one.' },
  { id: 'teach.notthat', category: 'teaching', emotion: 'happy', action: 'shake', use: 'This one, not that one - correcting the framing, never the learner.' },
  { id: 'teach.checkin', category: 'teaching', emotion: 'encouraging', action: 'peek', use: 'Checking whether the learner is still following.' },
  { id: 'teach.wonder', category: 'teaching', emotion: 'excited', action: 'think', use: 'Opening a question the character finds genuinely interesting.' },

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
  { id: 'feedback.correct.bright', category: 'feedback', emotion: 'happy', action: 'jump', use: 'A right answer that deserves more than a nod.' },
  { id: 'feedback.better', category: 'feedback', emotion: 'surprised', action: 'nod', use: 'The answer went further than the one that was expected.' },
  { id: 'feedback.plain.no', category: 'feedback', emotion: 'neutral', action: 'shake', use: 'Wrong, stated plainly and without weight.' },
  { id: 'feedback.nudge', category: 'feedback', emotion: 'encouraging', action: 'jump', use: 'Nudging a learner who has stalled on an easy item.' },
  { id: 'feedback.hold', category: 'feedback', emotion: 'surprised', action: 'idle', use: 'Holding still while the learner reconsiders an answer.' },
  { id: 'feedback.impressed', category: 'feedback', emotion: 'proud', action: 'peek', use: 'Leaning in at an answer that went past what was asked.' },

  // ── celebration ────────────────────────────────────────────────────────
  { id: 'celebrate.lesson', category: 'celebration', emotion: 'proud', action: 'celebrate', use: 'Lesson complete, on the results screen.', loop: true },
  { id: 'celebrate.perfect', category: 'celebration', emotion: 'excited', action: 'dance', use: 'A perfect score.', loop: true },
  { id: 'celebrate.streak', category: 'celebration', emotion: 'proud', action: 'jump', use: 'A daily streak extended.' },
  { id: 'celebrate.levelup', category: 'celebration', emotion: 'excited', action: 'celebrate', use: 'Crossing into a new adventure or saga.', loop: true },
  { id: 'celebrate.dance.slow', category: 'celebration', emotion: 'happy', action: 'dance', use: 'Background joy that must not pull focus.', loop: true },
  { id: 'celebrate.applaud', category: 'celebration', emotion: 'proud', action: 'wave', use: 'Applauding the learner rather than themselves.' },
  { id: 'celebrate.first', category: 'celebration', emotion: 'excited', action: 'hop', use: 'The learner’s very first completed lesson.' },
  { id: 'celebrate.comeback', category: 'celebration', emotion: 'proud', action: 'nod', use: 'Right after a run of wrong answers.' },
  { id: 'celebrate.joy', category: 'celebration', emotion: 'happy', action: 'celebrate', use: 'Joy without the ceremony of a level-up.', loop: true },
  { id: 'celebrate.bow', category: 'celebration', emotion: 'proud', action: 'bow', use: 'Taking a bow at the end of a whole course.' },
  { id: 'celebrate.with', category: 'celebration', emotion: 'encouraging', action: 'celebrate', use: 'Celebrating WITH the learner rather than at them.', loop: true },
  { id: 'celebrate.surprise', category: 'celebration', emotion: 'surprised', action: 'celebrate', use: 'A reward the learner did not know was coming.', loop: true },
  { id: 'celebrate.leap', category: 'celebration', emotion: 'neutral', action: 'jump', use: 'Plain elevation, for a scoreboard beat that carries its own copy.' },
  { id: 'celebrate.satisfied', category: 'celebration', emotion: 'proud', action: 'dance', use: 'A slow, satisfied dance after a long streak.', loop: true },

  // ── thinking ───────────────────────────────────────────────────────────
  { id: 'think.ponder', category: 'thinking', emotion: 'thinking', action: 'think', use: 'While the learner is deciding.' },
  { id: 'think.puzzled', category: 'thinking', emotion: 'surprised', action: 'think', use: 'An unexpected answer.' },
  { id: 'think.consider', category: 'thinking', emotion: 'thinking', action: 'nod', use: 'Weighing two options in a decision exercise.' },
  { id: 'think.wait', category: 'thinking', emotion: 'neutral', action: 'idle', use: 'Patient silence. The default while a learner reads.' },
  { id: 'think.curious', category: 'thinking', emotion: 'thinking', action: 'peek', use: 'Leaning in at something the learner did.' },
  { id: 'think.realise', category: 'thinking', emotion: 'surprised', action: 'jump', use: 'The moment an idea lands.' },
  { id: 'think.hmm', category: 'thinking', emotion: 'proud', action: 'think', use: 'Being asked something the character already knows well.' },
  { id: 'think.along', category: 'thinking', emotion: 'encouraging', action: 'think', use: 'Thinking alongside the learner rather than ahead of them.' },
  { id: 'think.wander', category: 'thinking', emotion: 'happy', action: 'think', use: 'Idle curiosity in the gap between two exercises.' },
  { id: 'think.startle', category: 'thinking', emotion: 'surprised', action: 'hop', use: 'A small jolt at something that just appeared on screen.' },

  // ── transition ─────────────────────────────────────────────────────────
  { id: 'transition.next', category: 'transition', emotion: 'happy', action: 'point', use: 'Moving to the next segment.' },
  { id: 'transition.enter', category: 'transition', emotion: 'neutral', action: 'peek', use: 'A character joining a scene already running.' },
  { id: 'transition.exit', category: 'transition', emotion: 'happy', action: 'wave', use: 'Leaving a scene.' },
  { id: 'transition.handoff', category: 'transition', emotion: 'encouraging', action: 'point', use: 'Passing narration to another character.', rotation: 0.5 },
  { id: 'transition.pause', category: 'transition', emotion: 'neutral', action: 'idle', use: 'A held beat between sections.' },
  { id: 'transition.recap', category: 'transition', emotion: 'neutral', action: 'bow', use: 'Closing a saga.' },
  { id: 'transition.step.in', category: 'transition', emotion: 'neutral', action: 'hop', use: 'Stepping into frame without ceremony.' },
  { id: 'transition.withdraw', category: 'transition', emotion: 'thinking', action: 'bow', use: 'Withdrawing from a scene that continues without them.' },
  { id: 'transition.lift', category: 'transition', emotion: 'thinking', action: 'jump', use: 'Carrying momentum into a harder section.' },
  { id: 'transition.called.back', category: 'transition', emotion: 'surprised', action: 'wave', use: 'Being called back just as they were leaving.' },
  { id: 'transition.close.warm', category: 'transition', emotion: 'encouraging', action: 'bow', use: 'A warm close to a segment that went well.' },

  // ── ambient ────────────────────────────────────────────────────────────
  { id: 'ambient.idle', category: 'ambient', emotion: 'neutral', action: 'idle', use: 'The resting state. Every surface’s default.' },
  { id: 'ambient.idle.happy', category: 'ambient', emotion: 'happy', action: 'idle', use: 'Resting, but the segment is going well.' },
  { id: 'ambient.listen', category: 'ambient', emotion: 'encouraging', action: 'idle', use: 'The Tutor while the learner is speaking or typing.' },
  { id: 'ambient.attentive', category: 'ambient', emotion: 'neutral', action: 'nod', use: 'Following along without interrupting.' },
  { id: 'ambient.sway', category: 'ambient', emotion: 'happy', action: 'dance', use: 'Very low-energy background motion.', loop: true },
  { id: 'ambient.watch', category: 'ambient', emotion: 'thinking', action: 'idle', use: 'Present but deliberately not the subject.' },
  { id: 'ambient.hum', category: 'ambient', emotion: 'neutral', action: 'dance', use: 'Background motion in a scene the learner is not looking at.', loop: true },
  { id: 'ambient.curious', category: 'ambient', emotion: 'excited', action: 'peek', use: 'Watching the learner work, from the edge of the frame.' },
  { id: 'ambient.drift', category: 'ambient', emotion: 'thinking', action: 'dance', use: 'Very slow background motion for a thoughtful scene.', loop: true },

  // ── marketing ──────────────────────────────────────────────────────────
  { id: 'marketing.hero', category: 'marketing', emotion: 'happy', action: 'idle', use: 'Standing portrait for a landing surface.' },
  { id: 'marketing.present', category: 'marketing', emotion: 'encouraging', action: 'point', use: 'Presenting something beside them, e.g. a decision card.', rotation: 0.5 },
  { id: 'marketing.invite', category: 'marketing', emotion: 'happy', action: 'wave', use: 'A call to action.' },
  { id: 'marketing.proud', category: 'marketing', emotion: 'proud', action: 'idle', use: 'A confident still for a mentor line-up.' },
  { id: 'marketing.celebrate', category: 'marketing', emotion: 'excited', action: 'celebrate', use: 'A joyful capture for a results or pricing surface.', loop: true },
  { id: 'marketing.think', category: 'marketing', emotion: 'thinking', action: 'think', use: 'Illustrating a decision or a problem.' },
  { id: 'marketing.bow', category: 'marketing', emotion: 'neutral', action: 'bow', use: 'A closing frame.' },
  { id: 'marketing.hero.turned', category: 'marketing', emotion: 'happy', action: 'idle', use: 'The hero portrait at three-quarters, for a two-column block.', rotation: 0.55 },
  { id: 'marketing.away', category: 'marketing', emotion: 'neutral', action: 'idle', use: 'Facing away, for a header where the copy leads and the character frames it.', rotation: Math.PI },
  { id: 'marketing.wave.right', category: 'marketing', emotion: 'happy', action: 'wave', use: 'Waving toward copy that sits to their right.', rotation: -0.5 },
  { id: 'marketing.banner', category: 'marketing', emotion: 'neutral', action: 'celebrate', use: 'A large still for a pricing or results banner.', loop: true },
  { id: 'marketing.flourish', category: 'marketing', emotion: 'excited', action: 'bow', use: 'A showman close for a promotional frame.' },
  { id: 'marketing.approach', category: 'marketing', emotion: 'thinking', action: 'wave', use: 'Beckoning the reader further into the product.' },
]);

/*
 * HOW MANY DIFFERENT THINGS THIS LIBRARY CAN ACTUALLY SHOW.
 *
 * Not the same number as `POSES.length`, and the difference is the point.
 * /AGENTS.md §1.14 was written after a coverage metric counted PRESENCE and
 * reported 100% while a thousand lessons opened with the same picture: "make a
 * coverage metric count DISTINCTNESS, not presence".
 *
 * A pose is a named INTENT, so two intents legitimately resolve to the same
 * render - `greet.hello` and `transition.exit` are both a happy wave, and
 * content is right to address them separately. But if the catalog grew by
 * renaming rather than by adding, the count would keep climbing while the
 * screen stopped changing. This is the number that would not move.
 */
export function poseSignature(pose: Pose): string {
  return `${pose.emotion}+${pose.action}@${pose.rotation ?? 0}`;
}

/** How many visually distinct renders the catalog can produce. */
export function distinctPoseCount(): number {
  return new Set(POSES.map(poseSignature)).size;
}

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
