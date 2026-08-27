import { Euler, Quaternion, type Bone } from 'three';
import type { Rig } from './rig';
import type { CharacterAction, CharacterEmotion } from '@/components/characters/control/types';

/*
 * The 12 canonical actions and 7 emotions, driven PROCEDURALLY.
 *
 * Why procedural rather than authored clips: every character export ships
 * exactly one clip, and all of them are locomotion cycles. Meanwhile the
 * lesson catalog already authors `emotion` and `action` fields against the 2D
 * rig's vocabulary (components/characters/control/types.ts), so the content to
 * drive these characters exists — only the clips do not.
 *
 * Rather than leave the 3D characters inert until someone opens Blender, the
 * same 19 states are synthesised from bone rotations. The result is not what a
 * hand-animated clip would give, but it is expressive, it is free, and it
 * makes the 3D characters respond to existing content on day one. When real
 * clips arrive they replace individual entries here without touching callers.
 *
 * DESIGN RULES followed throughout:
 *   - Offsets are applied RELATIVE to the captured rest pose (rig.ts), never
 *     absolute, so a character keeps whatever posture its export gave it.
 *   - Amplitudes stay small. Overshooting reads as a puppet convulsing; the
 *     believable range for a stylized character is a few tenths of a radian.
 *   - Everything is a pure function of (rig, progress) — no state, no
 *     allocation per frame beyond two scratch objects.
 */

const scratchEuler = new Euler();
const scratchQuat = new Quaternion();

/**
 * Rotates a bone by an euler offset in its PARENT's space, accumulating onto
 * whatever is already there this frame.
 *
 * `premultiply`, not `multiply`, and that distinction is the whole reason the
 * first version of this file did nothing visible. Post-multiplying rotates
 * about the bone's OWN axes — and on these rigs a bone's local +Y runs along
 * its length (measured: LeftArm's child sits at [0, 28.03, 0]), so much of the
 * intended swing came out as a twist around the limb, invisible on screen.
 * Parent-space axes are stable and human-readable instead: X pitches, Y yaws,
 * Z rolls, the same way for every bone.
 *
 * Accumulate, never assign: emotion posture is applied before the action, and
 * an assigning version erased the posture as soon as an action touched the
 * same bone. The caller resets the rig to its rest pose once per frame
 * (resetRig), which is what makes accumulation safe.
 */
function turn(rig: Rig, bone: Bone | undefined, x: number, y: number, z: number): void {
  if (!bone || !rig.base.has(bone)) return;
  scratchEuler.set(x, y, z);
  scratchQuat.setFromEuler(scratchEuler);
  bone.quaternion.premultiply(scratchQuat);
}

/** Smooth 0→1→0 arc — the shape almost every one-shot gesture wants. */
export function arc(progress: number): number {
  return Math.sin(Math.min(Math.max(progress, 0), 1) * Math.PI);
}

/**
 * Vertical travel, as a fraction of the character's height, for the actions
 * that genuinely leave the ground.
 *
 * THE CLIP CARRIES THE MECHANICS, THE RUNTIME CARRIES THE TRAVEL — and that
 * split is forced, not stylistic. An authored clip can only express travel as a
 * translation on the hips, in the authoring rig's own units, which is the same
 * absolute-value-shared-between-skeletons mistake that re-posed every character
 * into Zara's body. A jump should also scale with the jumper: 0.42 of height is
 * 71 cm for a 1.7 m human and 80 cm for a 1.9 m dino, which is right, whereas
 * one baked distance would be either a hop or a launch depending on who plays it.
 *
 * (The baked translation was also wrong by three orders of magnitude — Blender
 * pose-bone location is not in armature units, so an authored 32 cm exported as
 * 0.0816 units, or 0.8 mm. Measured, not assumed.)
 */
export const CLIP_LIFT: Partial<Record<CharacterAction, number>> = { jump: 0.42, hop: 0.16 };

/** Smooth 0→1 ramp with eased ends. */
function ease(progress: number): number {
  const t = Math.min(Math.max(progress, 0), 1);
  return t * t * (3 - 2 * t);
}

export interface ActionFrame {
  /** 0..1 through the action. Looping actions receive a sawtooth. */
  progress: number;
  /** Seconds since the character mounted, for continuous motion. */
  time: number;
  /** Vertical offset in metres the caller should apply to the whole character. */
  lift: number;
}

/** Nominal duration of each action, in seconds. Mirrors the 2D rig's timings. */
export const ACTION_SECONDS: Record<CharacterAction, number> = {
  idle: 0,
  jump: 0.75,
  hop: 0.55,
  wave: 1.6,
  point: 1.4,
  celebrate: 1.8,
  nod: 1.0,
  shake: 0.9,
  think: 2.2,
  dance: 2.4,
  peek: 1.5,
  bow: 1.6,
};

export const LOOPING_ACTIONS: ReadonlySet<CharacterAction> = new Set(['celebrate', 'dance', 'think']);

/*
 * Biped drivers. `p` is 0..1 through the action, `t` is absolute seconds.
 * Each returns the vertical lift it wants applied to the whole character,
 * because a jump is root motion and cannot be expressed as a bone rotation.
 */
const BIPED: Record<CharacterAction, (rig: Rig, p: number, t: number) => number> = {
  idle: () => 0,

  nod: (rig, p) => {
    // Two clean dips of the head. Chin leads, neck follows at half depth, so
    // it reads as a nod rather than the whole skull pivoting.
    const swing = Math.sin(p * Math.PI * 4) * 0.28;
    turn(rig, rig.head, swing, 0, 0);
    turn(rig, rig.neck, swing * 0.45, 0, 0);
    return 0;
  },

  shake: (rig, p) => {
    const swing = Math.sin(p * Math.PI * 4) * 0.34;
    turn(rig, rig.head, 0, swing, 0);
    turn(rig, rig.neck, 0, swing * 0.4, 0);
    return 0;
  },

  wave: (rig, p) => {
    // Arm lifts and holds while the forearm does the waving — a whole-arm
    // wave from the shoulder looks like signalling an aircraft.
    const raise = ease(Math.min(p * 3, 1)) * (1 - ease(Math.max((p - 0.75) * 4, 0)));
    turn(rig, rig.rightArm, 0, 0, -1.15 * raise);
    turn(rig, rig.rightShoulder, 0, 0, -0.25 * raise);
    turn(rig, rig.rightForeArm, 0, Math.sin(p * Math.PI * 6) * 0.5 * raise, -0.35 * raise);
    turn(rig, rig.head, -0.06 * raise, 0, 0);
    return 0;
  },

  point: (rig, p) => {
    const reach = ease(Math.min(p * 2.5, 1)) * (1 - ease(Math.max((p - 0.7) * 3.3, 0)));
    turn(rig, rig.rightArm, -1.25 * reach, 0.25 * reach, -0.35 * reach);
    turn(rig, rig.rightForeArm, -0.2 * reach, 0, 0);
    // The head follows the gesture; a point the character ignores looks broken.
    turn(rig, rig.head, 0, 0.18 * reach, 0);
    turn(rig, rig.chest, 0, 0.12 * reach, 0);
    return 0;
  },

  jump: (rig, p) => {
    const lift = arc(p);
    turn(rig, rig.spine, -0.12 * lift, 0, 0);
    turn(rig, rig.rightArm, 0, 0, -0.9 * lift);
    turn(rig, rig.leftArm, 0, 0, 0.9 * lift);
    return lift * 0.42;
  },

  hop: (rig, p) => {
    const lift = arc(p);
    turn(rig, rig.spine, -0.07 * lift, 0, 0);
    return lift * 0.16;
  },

  celebrate: (rig, p, t) => {
    const bounce = Math.abs(Math.sin(t * 4.2));
    turn(rig, rig.rightArm, 0, 0, -2.0 - Math.sin(t * 6) * 0.18);
    turn(rig, rig.leftArm, 0, 0, 2.0 + Math.sin(t * 6) * 0.18);
    turn(rig, rig.head, -0.16, Math.sin(t * 3) * 0.12, 0);
    turn(rig, rig.spine, -0.1, 0, 0);
    void p;
    return bounce * 0.12;
  },

  think: (rig, p, t) => {
    // Hand toward the chin, head tilted, with a slow drift so the pose is not
    // a freeze-frame.
    const hold = ease(Math.min(p * 3, 1));
    const drift = Math.sin(t * 0.9) * 0.05;
    turn(rig, rig.rightArm, -0.55 * hold, 0.35 * hold, -0.75 * hold);
    turn(rig, rig.rightForeArm, -1.75 * hold, 0, 0);
    turn(rig, rig.head, 0.12 * hold + drift, 0.16 * hold, 0.13 * hold);
    turn(rig, rig.neck, 0.08 * hold, 0, 0);
    return 0;
  },

  dance: (rig, p, t) => {
    const sway = Math.sin(t * 3.4);
    const alt = Math.sin(t * 3.4 + Math.PI / 2);
    turn(rig, rig.hips, 0, sway * 0.16, sway * 0.1);
    turn(rig, rig.spine, 0, -sway * 0.1, -sway * 0.08);
    turn(rig, rig.rightArm, 0, 0, -1.1 - alt * 0.45);
    turn(rig, rig.leftArm, 0, 0, 1.1 - alt * 0.45);
    turn(rig, rig.head, 0, sway * 0.16, -sway * 0.1);
    void p;
    return Math.abs(Math.sin(t * 3.4)) * 0.05;
  },

  peek: (rig, p) => {
    // Lean out sideways as if looking round a corner.
    const lean = arc(p);
    turn(rig, rig.hips, 0, 0, 0.16 * lean);
    turn(rig, rig.spine, 0, 0.1 * lean, 0.2 * lean);
    turn(rig, rig.head, 0, 0.28 * lean, 0.12 * lean);
    return 0;
  },

  bow: (rig, p) => {
    const depth = arc(p);
    turn(rig, rig.spine, 0.5 * depth, 0, 0);
    turn(rig, rig.chest, 0.22 * depth, 0, 0);
    // Chin tucks less than the torso folds, so the character stays "polite"
    // rather than staring at the floor.
    turn(rig, rig.head, 0.18 * depth, 0, 0);
    turn(rig, rig.rightArm, 0, 0, -0.28 * depth);
    turn(rig, rig.leftArm, 0, 0, 0.28 * depth);
    return -0.04 * depth;
  },
};

/*
 * Quadruped drivers (Dina). A four-legged baby dinosaur has no arms to wave
 * and no torso to bow with, so the same vocabulary is expressed through the
 * parts she does have: head, chest, ears and a tail that carries most of the
 * emotion. Actions that genuinely have no quadruped reading fall back to a
 * bounce rather than being silently dropped.
 */
const QUADRUPED: Record<CharacterAction, (rig: Rig, p: number, t: number) => number> = {
  idle: () => 0,

  nod: (rig, p) => {
    turn(rig, rig.head, Math.sin(p * Math.PI * 4) * 0.3, 0, 0);
    return 0;
  },

  shake: (rig, p) => {
    const swing = Math.sin(p * Math.PI * 4) * 0.34;
    turn(rig, rig.head, 0, swing, 0);
    for (const ear of rig.ears ?? []) turn(rig, ear, 0, swing * 0.6, 0);
    return 0;
  },

  wave: (rig, p, t) => {
    // A tail wag is a dinosaur's wave.
    wagTail(rig, t, 5.5, 0.34);
    turn(rig, rig.head, -0.14 * arc(p), 0, 0);
    return 0;
  },

  point: (rig, p) => {
    const reach = ease(Math.min(p * 2.5, 1)) * (1 - ease(Math.max((p - 0.7) * 3.3, 0)));
    // Nose-point: the head extends toward the subject.
    turn(rig, rig.head, -0.3 * reach, 0.3 * reach, 0);
    turn(rig, rig.chest, -0.1 * reach, 0.1 * reach, 0);
    return 0;
  },

  jump: (rig, p) => {
    const lift = arc(p);
    turn(rig, rig.chest, -0.18 * lift, 0, 0);
    turn(rig, rig.head, -0.2 * lift, 0, 0);
    return lift * 0.3;
  },

  hop: (rig, p) => {
    const lift = arc(p);
    turn(rig, rig.chest, -0.1 * lift, 0, 0);
    return lift * 0.12;
  },

  celebrate: (rig, p, t) => {
    wagTail(rig, t, 8, 0.4);
    turn(rig, rig.head, -0.22, Math.sin(t * 4) * 0.14, 0);
    void p;
    return Math.abs(Math.sin(t * 4.2)) * 0.1;
  },

  think: (rig, p, t) => {
    const hold = ease(Math.min(p * 3, 1));
    turn(rig, rig.head, 0.1 * hold + Math.sin(t * 0.8) * 0.04, 0.2 * hold, 0.18 * hold);
    for (const ear of rig.ears ?? []) turn(rig, ear, 0.2 * hold, 0, 0);
    return 0;
  },

  dance: (rig, p, t) => {
    wagTail(rig, t, 4.5, 0.36);
    turn(rig, rig.hips, 0, Math.sin(t * 3.2) * 0.14, 0);
    turn(rig, rig.head, 0, Math.sin(t * 3.2 + 1) * 0.18, 0);
    void p;
    return Math.abs(Math.sin(t * 3.2)) * 0.05;
  },

  peek: (rig, p) => {
    const lean = arc(p);
    turn(rig, rig.head, 0, 0.35 * lean, 0.14 * lean);
    turn(rig, rig.chest, 0, 0.14 * lean, 0);
    return 0;
  },

  bow: (rig, p) => {
    // Front-down play bow — what a quadruped actually does.
    const depth = arc(p);
    turn(rig, rig.chest, 0.34 * depth, 0, 0);
    turn(rig, rig.head, 0.3 * depth, 0, 0);
    return -0.06 * depth;
  },
};

/** Sine wave down the tail chain, each segment lagging the one before it. */
function wagTail(rig: Rig, t: number, speed: number, amplitude: number): void {
  const tail = rig.tail ?? [];
  tail.forEach((bone, index) => {
    turn(rig, bone, 0, Math.sin(t * speed - index * 0.55) * amplitude * (0.5 + index / (tail.length * 2)), 0);
  });
}

/*
 * Emotions are POSTURE here, not expression.
 *
 * In 2D these map to each character's face. There is no facial rig on any of
 * these exports — not one jaw or brow bone — so the honest translation is
 * body language: proud lifts the chest and chin, thinking tilts the head,
 * surprised recoils. It is a weaker channel than a face, and it is stated
 * plainly rather than pretended otherwise.
 */
const EMOTION_POSTURE: Record<CharacterEmotion, (rig: Rig, t: number) => void> = {
  neutral: () => undefined,
  happy: (rig) => {
    turn(rig, rig.head, -0.07, 0, 0);
    turn(rig, rig.chest, -0.05, 0, 0);
  },
  excited: (rig, t) => {
    turn(rig, rig.head, -0.1 + Math.sin(t * 5) * 0.03, 0, 0);
    turn(rig, rig.chest, -0.08, 0, 0);
  },
  thinking: (rig) => {
    turn(rig, rig.head, 0.09, 0.13, 0.11);
  },
  surprised: (rig) => {
    turn(rig, rig.head, -0.15, 0, 0);
    turn(rig, rig.chest, 0.07, 0, 0);
  },
  encouraging: (rig) => {
    turn(rig, rig.chest, 0.1, 0, 0);
    turn(rig, rig.head, -0.05, 0, 0);
  },
  proud: (rig) => {
    turn(rig, rig.chest, -0.12, 0, 0);
    turn(rig, rig.head, -0.11, 0, 0);
  },
};


/*
 * THE LEARNER MUST BE ABLE TO SEE THE FACE.
 *
 * This is a product rule, and it is enforced here because NO SINGLE LAYER can
 * enforce it. A character's backward lean is composed from three independent
 * sources that never see each other: the character's own rest stance, an
 * authored emotion clip, and an authored or procedural action. Each is
 * reasonable alone. `celebrate` leans back about 30 degrees, which reads as joy;
 * `proud` adds another 28; together they put Zara's chin at the camera and her
 * face at the ceiling, held for the whole loop, on the results screen of a
 * finished lesson. MEASURED against the rest pose, chest + neck + head:
 * `marketing.banner` (neutral + celebrate) -30.5 deg and the face reads
 * perfectly; `celebrate.lesson` (proud + celebrate) -59.7 deg and the face is
 * gone. The limit below sits between them, so every pose that already read well
 * is untouched and only the compositions that lose the face are pulled back.
 *
 * WHY A CAP AND NOT A RE-AUTHORED CLIP. Re-authoring `celebrate` fixes one
 * composition of two; the next emotion paired with the next clip is the same
 * bug again, discovered the same way — by somebody happening to look. A cap
 * states the invariant once and holds for every pairing, including the ones
 * added later by content rather than by code.
 *
 * The correction is proportional, so the SHAPE of the gesture survives: a
 * celebration still throws the head back, just not past the point where the
 * character stops facing the learner. And it is measured as a delta from each
 * bone's REST orientation (`rig.base`), never from a world transform, for the
 * reason `modelBounds.ts` exists.
 */

/** Radians. Between the -30.5 that reads well and the -59.7 that does not. */
export const MAX_FACE_LIFT = 0.58;

/**
 * Signed twist of `delta` about X, in radians.
 *
 * Negative is FACE-LIFTING on every rig in the cast — verified by measuring the
 * live skeleton, not assumed: Zara's head sits at +33.7 deg at rest and drops
 * toward 0 as she leans back, and the quadruped driver expresses her look-up
 * with a negative head rotation too.
 */
function twistX(delta: Quaternion): number {
  const angle = 2 * Math.atan2(delta.x, delta.w);
  if (angle > Math.PI) return angle - 2 * Math.PI;
  if (angle < -Math.PI) return angle + 2 * Math.PI;
  return angle;
}

const liftDelta = new Quaternion();
const liftCorrection = new Quaternion();

/**
 * Pulls the head chain forward until the face is visible again.
 *
 * Returns the total face lift BEFORE correction, in radians, so a caller (or a
 * test) can see how close a pose runs to the limit. Call it after the pose for
 * the frame is fully composed — it reads what is there and does not care which
 * layer put it there, which is the entire point.
 */
export function limitFaceLift(rig: Rig, max: number = MAX_FACE_LIFT): number {
  const chain = [rig.chest, rig.neck, rig.head].filter(
    (bone): bone is Bone => bone !== undefined && rig.base.has(bone),
  );
  if (chain.length === 0) return 0;

  const twists = chain.map((bone) => {
    liftDelta.copy(rig.base.get(bone)!).invert().multiply(bone.quaternion);
    return twistX(liftDelta);
  });
  // Only the lifting parts count. A bone leaning FORWARD during a bow must not
  // buy budget for another bone to lean further back.
  const lift = twists.reduce((sum, twist) => sum + Math.min(twist, 0), 0);
  // Math.abs, not -lift: negating a zero sum yields -0, which is a surprising
  // thing to hand back from a function whose result is a magnitude.
  if (-lift <= max) return Math.abs(lift);

  const keep = max / -lift;
  chain.forEach((bone, index) => {
    const twist = twists[index] as number;
    if (twist >= 0) return;
    // A rotation about X, built directly: no Vector3 axis to allocate or share.
    const half = (twist * (keep - 1)) / 2;
    liftCorrection.set(Math.sin(half), 0, 0, Math.cos(half));
    bone.quaternion.multiply(liftCorrection);
  });
  return Math.abs(lift);
}

/**
 * Applies an emotion posture and an action to a rig for one frame.
 * Returns the vertical lift the caller should apply to the whole character.
 */
export function applyCharacterFrame(
  rig: Rig,
  emotion: CharacterEmotion,
  action: CharacterAction,
  frame: ActionFrame,
): number {
  // Posture first so an action's rotations compose on top of it.
  EMOTION_POSTURE[emotion](rig, frame.time);
  const drivers = rig.kind === 'quadruped' ? QUADRUPED : BIPED;
  return drivers[action](rig, frame.progress, frame.time);
}

/**
 * Applies ONLY the emotion posture, for when an authored clip owns the action.
 *
 * An AnimationMixer writes absolute bone orientations every frame, so the two
 * layers cannot both run: `resetRig` would erase the clip, and the procedural
 * action driver would fight it for the same joints. Emotion survives the switch
 * because it is expressed as a RELATIVE offset — premultiplied onto whatever
 * the mixer just wrote — which is the same reason it composes over a procedural
 * action. That is what lets an authored `wave` and a `proud` posture coexist
 * without the clip having to be re-authored once per emotion.
 */
export function applyEmotionPosture(rig: Rig, emotion: CharacterEmotion, time: number): void {
  EMOTION_POSTURE[emotion](rig, time);
}
