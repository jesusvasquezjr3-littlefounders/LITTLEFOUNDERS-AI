import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, Vector3, type Group, type PerspectiveCamera } from 'three';
import {
  poseFor,
  SHOT_AMBIENT,
  SHOT_FITS_SCENE,
  type ShotContext,
  type ShotId,
  type ShotScene,
  type ShotSubject,
} from './shots';
import {
  applyComposition,
  composeFor,
  insetsFromRects,
  NO_INSETS,
  padDistance,
  type HudRect,
  type SafeAreaInsets,
} from './composition';
import { useSafeArea } from './SafeAreaContext';
import { arc } from './characterActions';
import type { CharacterAction } from '@/components/characters/control/types';

/**
 * Class III / S16 `beat` (TUTOR_INSTRUMENTS.md §3.4): "the camera responds to
 * a teaching moment, not only a phase change." `phases.ts`'s `shotForPhase`
 * documents a hardened, three-document invariant (/ORACLE.md §9.3, §16,
 * /DESIGN.md) that a `conversing` shot may change for exactly one reason
 * (`adaptationOffered`) — a prior feature (`segmentLive`) violated this and
 * was removed 2026-08-21 after shipping a real defect (the character's own
 * head filling the frame on a phone). `beat` must therefore never touch
 * `ShotId` or distance; it rides the SAME channel that already keeps the
 * tutor clear of the plate — `composeFor`'s aim offset — as a small,
 * self-decaying ADDITION on top of it, triggered by the character's own
 * `point` gesture rather than a new schema field (nothing here changes what
 * the model is asked to produce). Deliberately tiny: this is the version the
 * decision log called "needs real visual iteration" — kept small enough that
 * an imperfect direction reads as subtle rather than broken while a future
 * pass tunes it with a human watching the render.
 */
const BEAT_DURATION_S = 1.2;
const BEAT_UP_M = 0.025;


/*
 * One camera, one damper, every shot.
 *
 * WHAT THIS REPLACES. `CameraRig` held two branches, each of which computed an
 * absolute camera position from scratch and wrote it every frame. Nothing in
 * that design held the camera's own state, so a framing change was not a move —
 * it was a different answer to the same per-frame question, applied instantly.
 * That is why every framing change on this stage SNAPPED, and it is not
 * something that could be fixed by adding an easing curve to either branch:
 * there was no "from" for a curve to start at.
 *
 * So the camera now has a position of its own, and every frame it is pulled
 * toward whatever `shots.ts` says the destination is. Framerate independence is
 * the exponential form — `x += (target - x) * (1 - exp(-lambda * dt))` — and not
 * the naive `x += (target - x) * 0.1`, which converges at a rate that depends on
 * the frame rate and therefore moves the camera measurably faster on a 120 Hz
 * phone than on a struggling one. On a stage that already demotes its own
 * quality tier under load, a camera that also speeds up when frames are cheap
 * would make the two systems visibly interact.
 *
 * THE COST IS UNCHANGED: still exactly one `position.set` and one `lookAt` per
 * frame. Transitions became a property of the system rather than a feature with
 * a price.
 *
 * THE ONE RULE THAT MUST NOT BE RELAXED. `ambientMotion: false` — which the low
 * quality tier sets, and which the governor LATCHES after two demotions — gates
 * the idle orbit, the handheld sway and the bob. It does NOT gate this damper.
 * If it did, a mid-range phone that dropped two frame-time windows would spend
 * the rest of the session on a permanently frozen island, cutting between
 * framings with no motion at all, which is a worse experience than the one the
 * demotion was protecting. The damper costs the same single camera write either
 * way, so there is nothing to save by disabling it.
 *
 * REDUCED MOTION IS A MODIFIER, NOT A SECOND PATH. Under `prefers-reduced-
 * motion` the shot vocabulary is identical and the damper collapses to a cut:
 * zero orbit, zero handheld, zero anticipation. Forking into a separate
 * accessibility camera would mean every future shot has to be designed twice,
 * and the second version is the one nobody looks at.
 */

/** How hard the camera is pulled toward the active pose, in units of 1/second. */
const TRAVEL_LAMBDA = 3.4;

/**
 * The pull during the anticipation pre-roll.
 *
 * A camera that leaves the instant it is told reads as a cut with motion blur.
 * Holding almost still for 120 ms and then moving is what makes the move read as
 * a decision — the same reason a person's head turns after their eyes do.
 */
const PRE_ROLL_LAMBDA = 0.55;
const PRE_ROLL_MS = 120;

/**
 * How long the ambient sway takes to reach full amplitude after the camera
 * arrives. Starting it at full the instant a shot lands puts a wobble on the
 * end of every move, which reads as the camera overshooting.
 */
const SETTLE_MS = 180;

/** Distance in metres below which the camera counts as arrived. */
const ARRIVAL_EPSILON = 0.02;

/** Idle orbit rate, radians per second. Slow enough to be a place, not a ride. */
const ORBIT_RATE = 0.04;

/**
 * How far the idle orbit is allowed to travel either side of the shot's own
 * bearing, in radians.
 *
 * IT USED TO BE UNBOUNDED, and that was survivable only because the island shot
 * used to stand so far back that nothing could leave the frame however far the
 * camera walked round. `angle = ORBIT_RATE * phase` on a phase that only ever
 * accumulates is a CIRCUIT: half a minute on `unavailable` is 69 degrees, two
 * minutes is a quarter turn, and the placement solver faces the cast outward
 * along the stage bearing, so far enough round is the backs of their heads.
 *
 * Now that `establishing` frames close enough to bleed off the sides of a
 * phone, an unbounded orbit also walks the cast out of frame: at 375x812 the
 * half-frame is about 1.8 m of world and a character stands about 2.0 m from
 * the island's centre, so a quarter turn puts them outside it. A shot cannot
 * promise to hold a subject it is going to orbit away from.
 *
 * 0.10 rad is 5.7 degrees — the parallax still reads as a living place rather
 * than a photograph, it never approaches the cast's own facing, and it is small
 * enough that `HOLD_MARGIN` covers the lateral travel it causes (about 0.20 m
 * for a subject 2 m off the aim, against 0.25 m of reserve).
 */
const ORBIT_SWING = 0.1;

/**
 * How often the canvas's own position on the page is re-read, in seconds.
 *
 * HUD rects are measured against the viewport and the camera composes against
 * the canvas, so the two are related by the canvas's bounding box. Reading that
 * box every frame is a forced layout every frame; reading it a few times a
 * second is free and cannot be wrong for longer than that. On the real stage the
 * canvas is `fixed inset-0` and the box never moves at all.
 */
const CANVAS_RECT_INTERVAL = 0.25;

export interface CameraDirectorProps {
  /** The composed scene, for the establishing fit. */
  content: React.RefObject<Group>;
  shot: ShotId;
  lead: ShotSubject | null;
  companion: ShotSubject | null;
  /**
   * EVERYONE ON THE ISLAND, when that is more than the two this session is
   * about — which is exactly the personalization audition and nothing else.
   *
   * Passed straight through to `ShotContext.cast`, where the note on why it
   * exists lives. Null in every other phase, and the shots then hold the lead
   * and their companion as they always did.
   */
  cast?: readonly ShotSubject[] | null;
  /**
   * The lead's current gesture, for `beat` ONLY — see this file's own header
   * comment. Not read for anything else; the shot itself stays a pure
   * function of phase, exactly as `shotForPhase` requires.
   */
  action?: CharacterAction;
  /** Bumped per turn; a repeated `point` (same action, new key) beats again. */
  actionKey?: number;
  /**
   * The quality tier's ambient-motion budget. Gates orbit, handheld and bob.
   * NEVER the damper.
   */
  ambientMotion: boolean;
  /** The accessibility instruction. Collapses travel to a cut. */
  reducedMotion: boolean;
  /**
   * Changes whenever the measured scene could have changed — a different island,
   * a different cast. The fit is cached because it walks the whole object graph,
   * and a cache that only invalidated on viewport resize was measurably wrong:
   * the two islands are 6.5 m and 9.5 m across, so a stale fit frames one of them
   * with a third of the screen empty or the other one cropped.
   */
  fitKey: string;
}

interface DampedPose {
  position: Vector3;
  target: Vector3;
}

export function CameraDirector({
  content,
  shot,
  lead,
  companion,
  cast = null,
  action,
  actionKey,
  ambientMotion,
  reducedMotion,
  fitKey,
}: CameraDirectorProps) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const safeArea = useSafeArea();

  const measured = useRef<ShotScene | null>(null);
  const damped = useRef<DampedPose | null>(null);
  const baseFov = useRef(0);

  const orbitPhase = useRef(0);
  const swayClock = useRef(0);
  const shotChangedAt = useRef(0);
  const beatActionKey = useRef<number | null>(null);
  const beatStartedAt = useRef<number | null>(null);
  const arrivedAt = useRef<number | null>(null);
  const activeShot = useRef<ShotId>(shot);

  const insets = useRef<Readonly<SafeAreaInsets>>(NO_INSETS);
  const insetVersion = useRef(-1);
  const canvasOrigin = useRef({ left: 0, top: 0 });
  const rectAge = useRef(CANVAS_RECT_INTERVAL);

  // The measured bounds are a fact about the object graph, not about the
  // viewport: a resize changes the FIT, which `shots.ts` recomputes from the
  // aspect every frame, and not the box.
  useEffect(() => {
    measured.current = null;
  }, [fitKey]);

  useFrame((state, delta) => {
    const group = content.current;
    if (!group) return;

    // R3F emits an implausible delta on the first frame and whenever a
    // backgrounded tab resumes. Feeding one to the damper teleports the camera,
    // which is the exact failure this component exists to remove.
    const dt = Number.isFinite(delta) && delta > 0 ? Math.min(delta, 0.1) : 0.016;

    if (!measured.current) {
      const box = new Box3().setFromObject(group);
      if (box.isEmpty()) return;
      const extent = box.getSize(new Vector3());
      const centre = box.getCenter(new Vector3());
      measured.current = {
        centre: { x: centre.x, y: centre.y, z: centre.z },
        size: { x: extent.x, y: extent.y, z: extent.z },
      };
    }

    if (baseFov.current === 0) baseFov.current = camera.fov;

    const viewport = { width: size.width, height: Math.max(size.height, 1) };
    const ctx: ShotContext = {
      scene: measured.current,
      lead,
      companion,
      cast,
      aspect: viewport.width / viewport.height,
      fov: baseFov.current,
    };

    if (activeShot.current !== shot) {
      activeShot.current = shot;
      shotChangedAt.current = state.clock.elapsedTime;
      arrivedAt.current = null;
    }

    // `beat`: a new `point` occurrence (action unchanged but actionKey
    // bumped counts as new — the character re-pointing at something else).
    if (action === 'point' && actionKey !== undefined && beatActionKey.current !== actionKey) {
      beatActionKey.current = actionKey;
      beatStartedAt.current = state.clock.elapsedTime;
    }
    const beatElapsed = beatStartedAt.current === null ? null : state.clock.elapsedTime - beatStartedAt.current;
    const beatAmount =
      beatElapsed !== null && beatElapsed >= 0 && beatElapsed <= BEAT_DURATION_S && !reducedMotion
        ? arc(beatElapsed / BEAT_DURATION_S)
        : 0;

    /* ---- Where the camera is going ------------------------------------- */

    const pose = poseFor(shot, ctx);

    /* ---- How the HUD moves it ------------------------------------------ */

    rectAge.current += dt;
    if (rectAge.current >= CANVAS_RECT_INTERVAL) {
      rectAge.current = 0;
      const box = gl.domElement.getBoundingClientRect();
      canvasOrigin.current = { left: box.left, top: box.top };
      // Force a recompute: the canvas may have moved under rects that did not.
      insetVersion.current = -1;
    }

    if (!safeArea) {
      // Held as the shared frozen constant rather than a fresh object each
      // frame: with no HUD mounted this branch runs 60 times a second forever.
      insets.current = NO_INSETS;
    } else if (safeArea.versionRef.current !== insetVersion.current) {
      insetVersion.current = safeArea.versionRef.current;
      const local: HudRect[] = [];
      for (const rect of safeArea.rectsRef.current.values()) {
        local.push({
          left: rect.left - canvasOrigin.current.left,
          top: rect.top - canvasOrigin.current.top,
          width: rect.width,
          height: rect.height,
        });
      }
      insets.current = insetsFromRects(local, viewport);
    }

    let position = pose.position;
    const straightDistance = Math.hypot(
      pose.position.x - pose.target.x,
      pose.position.y - pose.target.y,
      pose.position.z - pose.target.z,
    );

    /*
     * A fitting shot gives ground to the HUD; a close shot does not.
     *
     * The padding is resolved BEFORE the aim shift because metres-per-pixel is a
     * function of distance, so shifting first and padding second would compute
     * the shift at a distance the camera is no longer at, and the subject would
     * settle just off the free rectangle's centre.
     */
    let distance = straightDistance;
    if (SHOT_FITS_SCENE[shot]) {
      const fit = composeFor(insets.current, viewport, distance, ctx, pose.keepInFrame);
      position = padDistance(pose.position, pose.target, fit.padding);
      distance = Math.hypot(
        position.x - pose.target.x,
        position.y - pose.target.y,
        position.z - pose.target.z,
      );
    }

    /*
     * `pose.keepInFrame` is what stops the shift from becoming a crop. The
     * solver otherwise obeys the free rectangle literally, and at 375x812 with
     * the lesson sheet at HALF that asks for a 235 px lift on a frame whose
     * subject is only 200 px from crown to aim — the character comes out from
     * behind the sheet with the top of their head off the screen. The shot
     * states the radius it may not lose; the solver clamps against it.
     */
    const composition = composeFor(insets.current, viewport, distance, ctx, pose.keepInFrame);
    // `beat`: an ADDITIVE nudge on the aim only — never `composition.padding`,
    // which is what `distance` above was already fixed from. Adding to an
    // already-resolved distance's own offset cannot smuggle in a shot or
    // distance change; it can only ever move where the same shot, at the
    // same distance, is currently looking.
    if (beatAmount > 0) composition.up += BEAT_UP_M * beatAmount;
    const composed = applyComposition(position, pose.target, composition);

    /* ---- Ambient motion, which the quality tier may switch off ---------- */

    let goalX = composed.position.x;
    let goalY = composed.position.y;
    let goalZ = composed.position.z;

    const ambient = ambientMotion && !reducedMotion;
    if (ambient) {
      const settled = arrivedAt.current === null ? 0 : (state.clock.elapsedTime - arrivedAt.current) * 1000;
      const amplitude = Math.min(1, settled / SETTLE_MS);
      swayClock.current += dt;

      const offsetX = goalX - composed.target.x;
      const offsetZ = goalZ - composed.target.z;

      if (SHOT_AMBIENT[shot] === 'orbit') {
        /*
         * The orbit clock only advances while an orbit shot is live.
         *
         * It used to run off the global clock, which meant it kept accruing
         * through an entire spoken turn spent on a close shot — so returning to
         * the island jumped to wherever the orbit would have been had it never
         * left. Freezing it means the stage comes back to the bearing it left
         * from, which is both correct and free.
         */
        orbitPhase.current += dt * amplitude;
        // A SWING, not a circuit — see `ORBIT_SWING`. The phase still only
        // advances while an orbit shot is live, so the stage comes back to the
        // bearing it left from rather than to wherever a global clock had got
        // to; bounding it means it also comes back to a bearing that still
        // holds what the shot promised.
        const angle = ORBIT_SWING * Math.sin(ORBIT_RATE * orbitPhase.current);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        goalX = composed.target.x + offsetX * cos + offsetZ * sin;
        goalZ = composed.target.z - offsetX * sin + offsetZ * cos;
        goalY += Math.sin(orbitPhase.current * 0.28) * distance * 0.012 * amplitude;
      } else {
        // Handheld: a far smaller sway that reads as a held camera. An orbit
        // during dialogue reads as the room moving rather than the person
        // speaking, which is a different scene entirely.
        const drift = Math.sin(swayClock.current * 0.19) * 0.05 * amplitude;
        const cos = Math.cos(drift);
        const sin = Math.sin(drift);
        goalX = composed.target.x + offsetX * cos + offsetZ * sin;
        goalZ = composed.target.z - offsetX * sin + offsetZ * cos;
        goalY += Math.sin(swayClock.current * 0.27) * 0.012 * amplitude;
      }
    }

    /* ---- The travel ----------------------------------------------------- */

    if (!damped.current) {
      // The first frame is an arrival, not a move. Damping in from wherever the
      // default camera happened to be would fly the learner in from the origin.
      damped.current = {
        position: new Vector3(goalX, goalY, goalZ),
        target: new Vector3(composed.target.x, composed.target.y, composed.target.z),
      };
      arrivedAt.current = state.clock.elapsedTime;
    } else {
      let alpha = 1;
      if (!reducedMotion) {
        const sinceChange = (state.clock.elapsedTime - shotChangedAt.current) * 1000;
        const lambda = sinceChange < PRE_ROLL_MS ? PRE_ROLL_LAMBDA : TRAVEL_LAMBDA;
        alpha = 1 - Math.exp(-lambda * dt);
      }
      damped.current.position.x += (goalX - damped.current.position.x) * alpha;
      damped.current.position.y += (goalY - damped.current.position.y) * alpha;
      damped.current.position.z += (goalZ - damped.current.position.z) * alpha;
      damped.current.target.x += (composed.target.x - damped.current.target.x) * alpha;
      damped.current.target.y += (composed.target.y - damped.current.target.y) * alpha;
      damped.current.target.z += (composed.target.z - damped.current.target.z) * alpha;
    }

    if (arrivedAt.current === null) {
      const remaining = Math.hypot(
        goalX - damped.current.position.x,
        goalY - damped.current.position.y,
        goalZ - damped.current.position.z,
      );
      if (remaining < ARRIVAL_EPSILON) arrivedAt.current = state.clock.elapsedTime;
    }

    /* ---- The one write --------------------------------------------------- */

    /*
     * Near and far are set from the destination pose rather than damped. They
     * are clipping planes, not a look: an island fit wants a far plane twenty
     * times its radius and a close-up wants a near plane at a centimetre, and
     * interpolating between them would spend the whole travel in a range that
     * suits neither. Nothing about the switch is visible, because both ends are
     * conservative by construction.
     */
    if (camera.near !== pose.near || camera.far !== pose.far || camera.fov !== pose.fov) {
      camera.near = pose.near;
      camera.far = pose.far;
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }

    camera.position.copy(damped.current.position);
    camera.lookAt(damped.current.target);
  });

  return null;
}
