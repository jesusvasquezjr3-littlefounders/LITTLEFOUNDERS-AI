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
      aspect: viewport.width / viewport.height,
      fov: baseFov.current,
    };

    if (activeShot.current !== shot) {
      activeShot.current = shot;
      shotChangedAt.current = state.clock.elapsedTime;
      arrivedAt.current = null;
    }

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
      const fit = composeFor(insets.current, viewport, distance, ctx);
      position = padDistance(pose.position, pose.target, fit.padding);
      distance = Math.hypot(
        position.x - pose.target.x,
        position.y - pose.target.y,
        position.z - pose.target.z,
      );
    }

    const composition = composeFor(insets.current, viewport, distance, ctx);
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
        const angle = ORBIT_RATE * orbitPhase.current;
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
