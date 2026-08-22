import { describe, expect, it } from 'vitest';
import {
  CLOSEUP_FRAME_FRACTION,
  CLOSEUP_HEADROOM,
  CLOSEUP_WIDE_DISTANCE,
  CLOSEUP_WIDE_OFF_AXIS,
  horizontalFov,
  SHOULDER_FRAME_FRACTION,
  poseFor,
  SHOT_AMBIENT,
  SHOT_FITS_SCENE,
  SHOT_IDS,
  shotForLegacyFraming,
  STAGE_BEARING,
  type CameraPose,
  type ShotContext,
  type ShotId,
  type ShotSubject,
  type Vec3,
} from './shots';
import {
  applyComposition,
  composeFor,
  insetsFromRects,
  padDistance,
  type HudRect,
} from './composition';

/*
 * Framing on this stage has historically been verified by LOOKING, because
 * there was no way to ask "how far back does a 9.5 m island put the camera on a
 * portrait phone" without a browser and a GPU. These are pure functions
 * precisely so that question is answerable in a millisecond, and the numbers
 * below are the real ones: diorama-a is 6.5 m across, diorama-b is 9.5 m, rho is
 * 1.70 m and dina is 1.90 m (measurements.ts).
 */

const ISLAND_A = { centre: { x: 0, y: 0.9, z: 0 }, size: { x: 6.5, y: 3.1, z: 6.5 } };
const ISLAND_B = { centre: { x: 0, y: 1.1, z: 0 }, size: { x: 9.5, y: 3.6, z: 9.5 } };

/** rho, standing right of centre, facing outward toward the opening bearing. */
const RHO: ShotSubject = { x: 1.1, y: 1.28 + 0.6, z: 1.4, facing: 0.66, height: 1.7 };
/** dina, the big quadruped, beside him. */
const DINA: ShotSubject = { x: -0.6, y: 1.43 + 0.6, z: 1.9, facing: 0.2, height: 1.9 };

function context(overrides: Partial<ShotContext> = {}): ShotContext {
  return {
    scene: ISLAND_A,
    lead: RHO,
    companion: DINA,
    aspect: 1280 / 800,
    fov: 36,
    ...overrides,
  };
}

function distance(pose: CameraPose): number {
  return Math.hypot(
    pose.position.x - pose.target.x,
    pose.position.y - pose.target.y,
    pose.position.z - pose.target.z,
  );
}

/** Yaw from the camera toward a point, in the XZ plane. */
function bearingTo(from: Vec3, to: Vec3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function shortestArc(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/**
 * Where a world point lands in the frame, in normalised screen coordinates.
 *
 * ±1 is the edge of the frame on each axis, so "is this inside the shot" is
 * `Math.abs(...) <= 1` and "how close to the edge" is the number itself. Null
 * means the point is behind the camera, which is a different failure from being
 * off the side and has to be distinguishable: a shot that has swung past its own
 * subject reports a plausible-looking offset if you only take a magnitude.
 *
 * This is the honest projection — the same basis three.js builds from
 * `lookAt` — rather than a bearing comparison, because a bearing says nothing
 * about the top of a head leaving the top of the screen, which is exactly the
 * portrait failure these tests exist for.
 */
function project(pose: CameraPose, point: Vec3, aspect: number): { x: number; y: number } | null {
  const fx = pose.target.x - pose.position.x;
  const fy = pose.target.y - pose.position.y;
  const fz = pose.target.z - pose.position.z;
  const flen = Math.hypot(fx, fy, fz);
  const f = { x: fx / flen, y: fy / flen, z: fz / flen };

  // right = normalize(forward × worldUp); up = right × forward.
  const rx = -f.z;
  const rz = f.x;
  const rlen = Math.hypot(rx, rz);
  const r = { x: rx / rlen, y: 0, z: rz / rlen };
  const u = {
    x: r.y * f.z - r.z * f.y,
    y: r.z * f.x - r.x * f.z,
    z: r.x * f.y - r.y * f.x,
  };

  const v = {
    x: point.x - pose.position.x,
    y: point.y - pose.position.y,
    z: point.z - pose.position.z,
  };
  const depth = v.x * f.x + v.y * f.y + v.z * f.z;
  if (depth <= 1e-6) return null;

  const vFov = (pose.fov * Math.PI) / 180;
  const halfHeight = depth * Math.tan(vFov / 2);
  const halfWidth = depth * Math.tan(horizontalFov(vFov, aspect) / 2);

  return {
    x: (v.x * r.x + v.y * r.y + v.z * r.z) / halfWidth,
    y: (v.x * u.x + v.y * u.y + v.z * u.z) / halfHeight,
  };
}

/**
 * Where the lead's crown, chin and chest actually land, in CSS pixels down the
 * viewport, with the HUD composed against.
 *
 * THE ONLY QUESTION THAT MATTERS ON THIS ROUTE, and neither module can answer it
 * alone: `shots.ts` says where the camera stands, `composition.ts` says how the
 * HUD moves it, and whether a chip is on a moustache is a fact about the two of
 * them together. Every gate was green while four chips sat across Dr Rho's face
 * on production, because nothing joined them up.
 */
function composedFrame(
  shot: ShotId,
  ctx: ShotContext,
  viewport: { width: number; height: number },
  hud: readonly HudRect[],
): { crown: number; chin: number; chest: number; head: number } {
  const lead = ctx.lead;
  if (!lead) throw new Error('composedFrame needs a lead');

  const pose = poseFor(shot, ctx);
  const insets = insetsFromRects(hud, viewport);

  let position = pose.position;
  let far = distance(pose);
  if (SHOT_FITS_SCENE[shot]) {
    const fit = composeFor(insets, viewport, far, ctx, pose.keepInFrame);
    position = padDistance(pose.position, pose.target, fit.padding);
    far = Math.hypot(
      position.x - pose.target.x,
      position.y - pose.target.y,
      position.z - pose.target.z,
    );
  }
  const composition = composeFor(insets, viewport, far, ctx, pose.keepInFrame);
  const moved = applyComposition(position, pose.target, composition);
  const composed: CameraPose = { ...pose, position: moved.position, target: moved.target };

  /** Normalised +1 (top of frame) → 0 px, -1 (bottom) → viewport height. */
  const downTo = (point: Vec3): number => {
    const at = project(composed, point, ctx.aspect);
    if (!at) return Number.NaN;
    return ((1 - at.y) / 2) * viewport.height;
  };

  return {
    crown: downTo({ x: lead.x, y: lead.y + lead.height * 0.25, z: lead.z }),
    head: downTo({ x: lead.x, y: lead.y, z: lead.z }),
    // Half a head below the mid-head point: the bottom of the face, and the
    // line nothing may cross.
    chin: downTo({ x: lead.x, y: lead.y - lead.height * 0.238, z: lead.z }),
    chest: downTo({ x: lead.x, y: lead.y - lead.height * 0.28, z: lead.z }),
  };
}

function isFinitePose(pose: CameraPose): boolean {
  return [
    pose.position.x,
    pose.position.y,
    pose.position.z,
    pose.target.x,
    pose.target.y,
    pose.target.z,
    pose.fov,
    pose.near,
    pose.far,
  ].every((value) => Number.isFinite(value));
}

describe('the shot vocabulary', () => {
  it('is closed and has no duplicates', () => {
    expect(new Set(SHOT_IDS).size).toBe(SHOT_IDS.length);
  });

  it('classifies every shot for fit and for ambient motion', () => {
    // A missing entry would read as `undefined`, which is falsy — a new shot
    // would silently become a non-fitting one with no ambient motion at all.
    for (const shot of SHOT_IDS) {
      expect(typeof SHOT_FITS_SCENE[shot]).toBe('boolean');
      expect(['orbit', 'handheld']).toContain(SHOT_AMBIENT[shot]);
    }
  });

  it('produces a finite pose for every shot', () => {
    for (const shot of SHOT_IDS) {
      expect(isFinitePose(poseFor(shot, context()))).toBe(true);
      expect(isFinitePose(poseFor(shot, context({ lead: null, companion: null })))).toBe(true);
    }
  });

  it('survives a zero-sized viewport rather than producing NaN', () => {
    /*
     * A zero-height canvas is a real state: it is what jsdom reports, and what a
     * browser reports for one frame while a panel animates open. A NaN camera
     * renders nothing at all, with no error anywhere, forever.
     */
    for (const shot of SHOT_IDS) {
      expect(isFinitePose(poseFor(shot, context({ aspect: 0, fov: 0 })))).toBe(true);
      expect(isFinitePose(poseFor(shot, context({ aspect: Number.NaN })))).toBe(true);
    }
  });

  it('maps the legacy two-value framing onto the union', () => {
    expect(shotForLegacyFraming('vignette')).toBe('establishing');
    expect(shotForLegacyFraming('conversation')).toBe('closeup');
  });
});

describe('establishing', () => {
  it('aims at the island centre from the opening bearing', () => {
    const pose = poseFor('establishing', context());
    expect(pose.target).toEqual(ISLAND_A.centre);
    expect(bearingTo(pose.target, pose.position)).toBeCloseTo(STAGE_BEARING, 6);
  });

  it('clears the island it is framing', () => {
    // The camera must be further out than the island is wide, or half of it is
    // behind the lens.
    const pose = poseFor('establishing', context());
    expect(distance(pose)).toBeGreaterThan(ISLAND_A.size.x / 2);
  });

  it('pulls further back for the bigger island', () => {
    // 6.5 m versus 9.5 m. The cache that only invalidated on viewport resize
    // used one of these fits for the other island.
    const a = distance(poseFor('establishing', context({ scene: ISLAND_A })));
    const b = distance(poseFor('establishing', context({ scene: ISLAND_B })));
    expect(b).toBeGreaterThan(a * 1.2);
  });

  it('pulls further back on a portrait viewport than a landscape one', () => {
    const landscape = distance(poseFor('establishing', context({ aspect: 1280 / 800 })));
    const portrait = distance(poseFor('establishing', context({ aspect: 375 / 812 })));
    expect(portrait).toBeGreaterThan(landscape);
  });

  it('looks down at the island rather than up at it', () => {
    const pose = poseFor('establishing', context());
    expect(pose.position.y).toBeGreaterThan(pose.target.y);
  });

  it('keeps the near plane in front of the camera and the far plane past the island', () => {
    const pose = poseFor('establishing', context());
    expect(pose.near).toBeGreaterThan(0);
    expect(pose.far).toBeGreaterThan(distance(pose) + ISLAND_A.size.x);
  });
});

describe('approach', () => {
  it('holds the opening bearing so arrival reads as walking up to one place', () => {
    const pose = poseFor('approach', context());
    expect(bearingTo(pose.target, pose.position)).toBeCloseTo(STAGE_BEARING, 6);
  });

  it('is closer than the establishing shot and leans toward the lead', () => {
    const wide = poseFor('establishing', context());
    const near = poseFor('approach', context());
    expect(distance(near)).toBeLessThan(distance(wide));
    // The aim has moved off the island's centre, toward whoever is speaking.
    expect(Math.hypot(near.target.x - RHO.x, near.target.z - RHO.z)).toBeLessThan(
      Math.hypot(wide.target.x - RHO.x, wide.target.z - RHO.z),
    );
  });
});

describe('closeup', () => {
  it('stands in FRONT of the subject, not behind them', () => {
    /*
     * The single mistake this scene has already made once. "Inward" and "toward
     * the viewer" are opposites when the camera is outside the island, so a
     * plausible-looking sign error shows the cast's backs.
     */
    const pose = poseFor('closeup', context());
    const toCamera = { x: pose.position.x - RHO.x, z: pose.position.z - RHO.z };
    const facing = { x: Math.sin(RHO.facing), z: Math.cos(RHO.facing) };
    expect(toCamera.x * facing.x + toCamera.z * facing.z).toBeGreaterThan(0);
  });

  it('aims just below the mid-head point, so the head has headroom', () => {
    /*
     * It aimed exactly at the mid-head, which is the naive framing: the head
     * lands on the centre line, half the picture is under the chin and the top
     * of the skull runs to the edge. The aim now drops by
     * `CLOSEUP_HEADROOM` of the frame — and the space that opens below the chin
     * is where the offer chips hang, which is the difference between chips at
     * the tutor's chest and chips on the tutor's mouth.
     */
    const ctx = context();
    const pose = poseFor('closeup', ctx);
    expect(pose.target.x).toBe(RHO.x);
    expect(pose.target.z).toBe(RHO.z);
    expect(pose.target.y).toBeLessThan(RHO.y);

    const frame = 2 * distance(pose) * Math.tan(((pose.fov * Math.PI) / 180) / 2);
    expect((RHO.y - pose.target.y) / frame).toBeCloseTo(CLOSEUP_HEADROOM.landscape, 3);

    // And portrait gets more of it, because portrait has less to spare.
    const portrait = poseFor('closeup', context({ aspect: 375 / 812 }));
    const portraitFrame = 2 * distance(portrait) * Math.tan(((portrait.fov * Math.PI) / 180) / 2);
    expect((RHO.y - portrait.target.y) / portraitFrame).toBeCloseTo(CLOSEUP_HEADROOM.portrait, 3);
  });

  it('scales its distance to the subject rather than using a fixed metre count', () => {
    // Rho's head alone is 47% of his height; Dina is a quadruped. One number
    // cannot frame both, which is why the frame is a fraction of the character.
    const shortSubject: ShotSubject = { ...RHO, height: 0.9 };
    const near = distance(poseFor('closeup', context({ lead: shortSubject })));
    const far = distance(poseFor('closeup', context({ lead: { ...RHO, height: 2.6 } })));
    expect(far).toBeGreaterThan(near);
  });

  it('falls back to the island when the placement solve has not landed', () => {
    const pose = poseFor('closeup', context({ lead: null }));
    expect(pose.target).toEqual(ISLAND_A.centre);
  });
});

describe('closeup-wide', () => {
  it('sits off-axis by the stated angle', () => {
    const pose = poseFor('closeup-wide', context());
    const bearing = bearingTo(pose.target, pose.position);
    expect(Math.abs(shortestArc(RHO.facing, bearing))).toBeCloseTo(CLOSEUP_WIDE_OFF_AXIS, 3);
  });

  it('sits further back than the straight close-up by the stated factor', () => {
    const close = distance(poseFor('closeup', context()));
    const wide = distance(poseFor('closeup-wide', context()));
    // Compared on the horizontal plane: the wide shot also drops its aim, so
    // the straight-line distance carries a small vertical component too.
    expect(wide / close).toBeGreaterThan(CLOSEUP_WIDE_DISTANCE * 0.95);
    expect(wide / close).toBeLessThan(CLOSEUP_WIDE_DISTANCE * 1.1);
  });

  it('aims below the head so the hands are in frame', () => {
    // For liruf and dina the hands ARE the performance; a dead-on head shot
    // frames the one thing that is not working.
    const pose = poseFor('closeup-wide', context());
    expect(pose.target.y).toBeLessThan(RHO.y);
  });
});

describe('two-shot', () => {
  it('holds both subjects inside the horizontal field of view', () => {
    const ctx = context();
    const pose = poseFor('two-shot', ctx);
    const half = horizontalFov((pose.fov * Math.PI) / 180, ctx.aspect) / 2;
    const axis = bearingTo(pose.position, pose.target);
    for (const subject of [RHO, DINA]) {
      const angle = Math.abs(shortestArc(axis, bearingTo(pose.position, subject)));
      expect(angle).toBeLessThan(half);
    }
  });

  it('aims between them', () => {
    const pose = poseFor('two-shot', context());
    expect(pose.target.x).toBeCloseTo((RHO.x + DINA.x) / 2, 6);
    expect(pose.target.z).toBeCloseTo((RHO.z + DINA.z) / 2, 6);
  });

  it('pulls back further when they stand further apart', () => {
    const close = distance(poseFor('two-shot', context({ companion: { ...DINA, x: RHO.x + 0.9, z: RHO.z } })));
    const spread = distance(poseFor('two-shot', context({ companion: { ...DINA, x: RHO.x + 4.5, z: RHO.z } })));
    expect(spread).toBeGreaterThan(close);
  });

  it('degrades to the wider single rather than framing an absent second subject', () => {
    const solo = poseFor('two-shot', context({ companion: null }));
    const wide = poseFor('closeup-wide', context({ companion: null }));
    expect(solo).toEqual(wide);
  });
});

describe('how big the character actually is on screen', () => {
  /*
   * The closest a headless test gets to the screenshot that decides this.
   *
   * The complaint that started the rebuild was perceptual, and the specific
   * measurement behind it is that at the island framing a character stands 104
   * px tall and their MOUTH is 2.4 px — every viseme identical, all authored
   * facial work invisible. So the assertion is the one that matters: on a close
   * shot the character fills most of the frame, at BOTH breakpoints, for all
   * four of them, including the 2.4x height spread between rho and dina.
   *
   * `fraction` is the share of the viewport's height the framed part of the
   * character occupies. Under about 0.5 and the mouth is back in single-digit
   * pixels; over 1.0 and the head is cropped.
   */
  function frameFraction(shot: 'closeup' | 'closeup-wide', subject: ShotSubject, aspect: number): number {
    const ctx = context({ lead: subject, companion: null, aspect });
    const pose = poseFor(shot, ctx);
    const vFov = (pose.fov * Math.PI) / 180;
    const worldHeight = 2 * distance(pose) * Math.tan(vFov / 2);
    // The head-and-shoulders span, so the number keeps meaning the same thing
    // when the shot's own framed fraction is retuned.
    return (subject.height * 0.7) / worldHeight;
  }

  const CAST: Array<[string, number]> = [
    ['rho', 1.7],
    ['zara', 1.61],
    ['liruf', 1.647],
    ['dina', 1.9],
  ];

  it.each(CAST)('frames %s large enough to read a face at 1280px', (_name, height) => {
    const fraction = frameFraction('closeup', { ...RHO, height }, 1280 / 800);
    expect(fraction).toBeGreaterThan(0.6);
    expect(fraction).toBeLessThan(1);
  });

  it.each(CAST)('frames %s large enough to read a face at 375px', (_name, height) => {
    // Portrait costs distance, so this is the breakpoint where a close shot
    // silently becomes a medium one.
    const fraction = frameFraction('closeup', { ...RHO, height }, 375 / 812);
    expect(fraction).toBeGreaterThan(0.5);
    expect(fraction).toBeLessThan(1);
  });

  it.each(CAST)('keeps %s clearly visible on the wider shot too', (_name, height) => {
    // The shot liruf and dina get. Wider is the point; unreadably small is not.
    const fraction = frameFraction('closeup-wide', { ...RHO, height }, 375 / 812);
    expect(fraction).toBeGreaterThan(0.35);
  });
});

describe('the introducing phase, composed', () => {
  /*
   * THE SCREENSHOT, AS ARITHMETIC.
   *
   * The owner looked at production and found four offer chips laid across Dr
   * Rho's moustache and mouth. Everything in this suite was green at the time,
   * because the shot was tested for how big the character is and the composition
   * was tested for which edge an inset lands on, and nobody asked the only
   * question a learner asks: is the tutor's FACE clear.
   *
   * The chips ride `lead.chest` (/DESIGN.md → Screen Recipes → Tutor names the
   * chest, and closes the count of viewport-anchored elements at three, so there
   * is nowhere else to put them). The microphone dock is the bottom of the
   * screen. So the band the cluster lives in is chest → dock, and the assertions
   * are that it exists, that it is big enough, and that it starts BELOW the chin.
   *
   * The two dock heights are the composed cluster: the resting cluster measures
   * 136 px at 375x812 and about 160 px at 1280x800 (`layout.immersive.orb` at 96
   * and 112 plus its status caption and gaps), and the row of two secondary
   * chips that moved here out of the chest cluster adds 44 plus an 8 px gap.
   * They are measurements taken elsewhere rather than in this process, which is
   * why the assertions are inequalities with room in them rather than pixel
   * equalities — the pixel truth is a screenshot, per the standing instruction
   * on this project.
   */
  /*
   * MEASURED IN A BROWSER at 375x812 and 1280x800, not derived: the openings are
   * a two-column grid on a phone (156 px in en-US, 140 in es-MX and pt-BR, whose
   * labels break differently) and one wrapped row of 52 px at 1280. Guessing
   * these is how the last version ended up on a moustache.
   *
   * The DOCK fixtures below are measured the same way, and the desktop one was
   * the last number here that was not. It was carried as 212 px — inferred from
   * the 375 px measurement plus the token sizes, because the browser of the day
   * would not composite a frame. Driven at 1280x800 the dock is
   * (400, 572, 480, 204): 204 px, not 212, with its bottom edge on the 24 px
   * `hud-inset`. Eight pixels do not move any assertion in this file, which is
   * exactly why it was worth replacing — an inferred fixture that happens to
   * pass teaches the next reader that inferring is fine.
   */
  const CLUSTER_PORTRAIT_PX = 156;
  const CLUSTER_DESKTOP_PX = 52;
  const CLUSTER_GAP_PX = 8; // `top-2`, the chip's gap from the body

  it('leaves the face clear and the chest usable at 1280x800', () => {
    const viewport = { width: 1280, height: 800 };
    const dock: HudRect = { left: 400, top: 800 - 24 - 204, width: 480, height: 204 };
    const seen = composedFrame('closeup', context(), viewport, [dock]);

    // The whole head is on screen…
    expect(seen.crown).toBeGreaterThan(0);
    expect(seen.chin).toBeLessThan(viewport.height);
    // …the chest is above the microphone with room for the one row of chips…
    const band = dock.top - (seen.chest + CLUSTER_GAP_PX);
    expect(band).toBeGreaterThan(CLUSTER_DESKTOP_PX + CLUSTER_GAP_PX);
    // …and the chips start below the chin, which is the whole point.
    expect(seen.chest + CLUSTER_GAP_PX).toBeGreaterThan(seen.chin);
  });

  it('leaves the face clear and the chest usable at 375x812', () => {
    /*
     * Two columns here, not one wrapped row: at 375 px the four openings are
     * 209, 170, 265 and 167 px wide, so a wrapped row gives each of them a line
     * of its own and the block is 208 px — a quarter of the phone. The grid is
     * 156, and that difference is the whole margin this breakpoint has.
     */
    const viewport = { width: 375, height: 812 };
    const dock: HudRect = { left: 15, top: 812 - 12 - 188, width: 345, height: 188 };
    const seen = composedFrame('closeup', context({ aspect: 375 / 812 }), viewport, [dock]);

    expect(seen.crown).toBeGreaterThan(0);
    const band = dock.top - (seen.chest + CLUSTER_GAP_PX);
    expect(band).toBeGreaterThan(CLUSTER_PORTRAIT_PX + CLUSTER_GAP_PX);
    expect(seen.chest + CLUSTER_GAP_PX).toBeGreaterThan(seen.chin);
    // The caption rides the crown and hangs above it, so the crown may not be
    // jammed against the top edge either: three lines of greeting at 375 px is
    // about 70 px, plus the 16 px `hud-inset-mobile`.
    expect(seen.crown).toBeGreaterThan(86);
  });

  it('would have failed on the framing that shipped', () => {
    /*
     * The guard on the guard. `CLOSEUP_FRAME_FRACTION` was 0.70 with a 1.0/1.18
     * aspect pad, and at that framing the chest projects off the bottom of the
     * screen — which is exactly why the cluster was hung 10vh under the mid-head
     * instead, i.e. on the mouth. If someone tightens the shot back up, this is
     * the assertion that says what they have just done.
     */
    const viewport = { width: 1280, height: 800 };
    const dock: HudRect = { left: 400, top: 800 - 24 - 204, width: 480, height: 204 };
    const seen = composedFrame('closeup', context(), viewport, [dock]);
    const shippedSpan = 0.7 * RHO.height;
    const composedSpan = CLOSEUP_FRAME_FRACTION * RHO.height;
    expect(composedSpan).toBeGreaterThan(shippedSpan);
    // The chest is on screen at all, which it was not before.
    expect(seen.chest).toBeLessThan(viewport.height);
  });
});

describe('over-shoulder', () => {
  it('puts the camera behind the lead and aims at the companion', () => {
    const pose = poseFor('over-shoulder', context());
    expect(pose.target).toEqual({ x: DINA.x, y: DINA.y, z: DINA.z });

    // Behind: the camera is on the far side of the lead from the companion.
    const leadToCompanion = { x: DINA.x - RHO.x, z: DINA.z - RHO.z };
    const leadToCamera = { x: pose.position.x - RHO.x, z: pose.position.z - RHO.z };
    expect(leadToCompanion.x * leadToCamera.x + leadToCompanion.z * leadToCamera.z).toBeLessThan(0);
  });

  it('stands clear of the lead rather than inside their head', () => {
    const pose = poseFor('over-shoulder', context());
    expect(Math.hypot(pose.position.x - RHO.x, pose.position.z - RHO.z)).toBeGreaterThan(0.6);
  });

  it('looks at the space in front of the lead when there is no companion', () => {
    // Which is where a live segment happens: during an exercise the learner's
    // attention belongs on the work, not on the tutor's face.
    const pose = poseFor('over-shoulder', context({ companion: null }));
    const forward = { x: Math.sin(RHO.facing), z: Math.cos(RHO.facing) };
    const toTarget = { x: pose.target.x - RHO.x, z: pose.target.z - RHO.z };
    expect(toTarget.x * forward.x + toTarget.z * forward.z).toBeGreaterThan(0);
  });

  it('survives both characters solving onto nearly the same spot', () => {
    // A degenerate separation would divide by zero and put the camera at NaN.
    const pose = poseFor('over-shoulder', context({ companion: { ...RHO, x: RHO.x + 1e-9, z: RHO.z } }));
    expect(isFinitePose(pose)).toBe(true);
  });

  it('keeps the shoulder it is named after INSIDE the frame in portrait', () => {
    /*
     * THE BUG THIS SHOT SHIPPED WITH, in one number. It was the only shot in the
     * vocabulary with no portrait correction: a flat 0.34-of-height lateral
     * offset behind a 0.72-of-height stand-off puts the lead 14.4 degrees off
     * the view axis, and at 375x812 a 36-degree vertical field of view is 17.1
     * degrees WIDE — half of it is 8.53. The shoulder was outside the frame, so
     * the over-the-shoulder shot had no shoulder in it, which reads to a learner
     * as the camera having lost the tutor rather than as a framing choice.
     */
    const ctx = context({ aspect: 375 / 812 });
    const shoulder = project(poseFor('over-shoulder', ctx), RHO, ctx.aspect);
    expect(shoulder).not.toBeNull();
    expect(Math.abs(shoulder?.x ?? 9)).toBeLessThanOrEqual(SHOULDER_FRAME_FRACTION + 0.02);
  });

  it('still stands where it was authored to at desktop aspects', () => {
    /*
     * The cap is a portrait correction and must not quietly retune the shot that
     * already reads correctly. At 1280x800 the frame is wide enough for the
     * authored 0.34, so the solved offset is the authored offset.
     */
    const ctx = context();
    const pose = poseFor('over-shoulder', ctx);
    // Perpendicular distance from the lead→companion line to the camera.
    const dx = DINA.x - RHO.x;
    const dz = DINA.z - RHO.z;
    const len = Math.hypot(dx, dz);
    const lateral = Math.abs(
      ((pose.position.x - RHO.x) * (dz / len) - (pose.position.z - RHO.z) * (dx / len)),
    );
    expect(lateral).toBeCloseTo(RHO.height * 0.34, 6);
  });
});

describe('every shot at 375x812', () => {
  /*
   * §1.11 makes the portrait breakpoint non-negotiable, and portrait is where
   * framing arithmetic fails silently: an aspect of 0.46 turns a 36-degree
   * vertical field of view into a 17-degree horizontal one, so anything placed
   * off-axis by an angle that is comfortable at 1280 px is off the side of the
   * screen at 375 px. Every shot is asked the same question here — is the thing
   * this shot is FOR actually in the picture — because the answer used to be no
   * for one of them and nothing in the suite could tell.
   */
  const PORTRAIT = 375 / 812;
  const ctx = context({ aspect: PORTRAIT });

  /** A point is in the picture when both axes are inside the frame edges. */
  function inFrame(pose: CameraPose, point: Vec3): boolean {
    const at = project(pose, point, PORTRAIT);
    return at !== null && Math.abs(at.x) <= 1 && Math.abs(at.y) <= 1;
  }

  function bodyPoints(subject: ShotSubject): Vec3[] {
    return [
      // Crown, mid-head, chest — the three points the anchors publish, which is
      // what the HUD actually hangs off.
      { x: subject.x, y: subject.y + subject.height * 0.25, z: subject.z },
      { x: subject.x, y: subject.y, z: subject.z },
      { x: subject.x, y: subject.y - subject.height * 0.28, z: subject.z },
    ];
  }

  it('establishing holds the island and the rim anchors the HUD hangs off', () => {
    /*
     * The rim points rather than the bounding box's corners, because
     * `fitDistance` fits the BOX and not a sphere around it, deliberately — a
     * sphere pushes the camera 65% further back and leaves the island a small
     * object in a sea of margin. The promise is therefore the island and the two
     * rim anchors `StageAnchors` publishes at 0.88 of its radius, which are what
     * a chip can actually be pinned to.
     */
    const pose = poseFor('establishing', ctx);
    const rim = (ISLAND_A.size.x / 2) * 0.88;
    const rightX = Math.cos(STAGE_BEARING);
    const rightZ = -Math.sin(STAGE_BEARING);
    for (const point of [
      ISLAND_A.centre,
      { x: rightX * rim, y: ISLAND_A.centre.y, z: rightZ * rim },
      { x: -rightX * rim, y: ISLAND_A.centre.y, z: -rightZ * rim },
      { x: 0, y: ISLAND_A.centre.y + ISLAND_A.size.y / 2, z: 0 },
    ]) {
      expect(inFrame(pose, point)).toBe(true);
    }
  });

  it('approach still holds the lead it is walking toward', () => {
    const pose = poseFor('approach', ctx);
    for (const point of bodyPoints(RHO)) expect(inFrame(pose, point)).toBe(true);
  });

  it('closeup holds the crown AND the chest, which is where the offer chips ride', () => {
    /*
     * The reason `CLOSEUP_FRAME_FRACTION` is no longer 0.70. /DESIGN.md → Screen
     * Recipes → Tutor puts the offer chips at the tutor's chest, and a chest
     * below the bottom of the frame means the openings are culled — which is why
     * the shipped version hung them 10vh under the mid-head instead, i.e. across
     * the mouth.
     */
    const pose = poseFor('closeup', ctx);
    for (const point of bodyPoints(RHO)) expect(inFrame(pose, point)).toBe(true);
  });

  it('closeup-wide holds the whole of the character it exists to show', () => {
    const pose = poseFor('closeup-wide', ctx);
    for (const point of bodyPoints(RHO)) expect(inFrame(pose, point)).toBe(true);
  });

  it('two-shot holds both of them', () => {
    const pose = poseFor('two-shot', ctx);
    for (const subject of [RHO, DINA]) expect(inFrame(pose, { x: subject.x, y: subject.y, z: subject.z })).toBe(true);
  });

  it('over-shoulder holds the subject and the shoulder both', () => {
    const pose = poseFor('over-shoulder', ctx);
    expect(inFrame(pose, { x: DINA.x, y: DINA.y, z: DINA.z })).toBe(true);
    expect(inFrame(pose, { x: RHO.x, y: RHO.y, z: RHO.z })).toBe(true);
  });

  it('over-shoulder holds the shoulder with no companion to look at either', () => {
    const pose = poseFor('over-shoulder', context({ aspect: PORTRAIT, companion: null }));
    expect(inFrame(pose, { x: RHO.x, y: RHO.y, z: RHO.z })).toBe(true);
  });

  it('composes the conversing close-up above a half-height sheet', () => {
    /*
     * The portrait complaint, end to end. At 375x812 the sheet at HALF plus the
     * dock riding above it claim 593 px of 812, and the camera that shipped
     * answered that by charging the sheet to the RIGHT edge and trucking a third
     * of a screen sideways. Composed correctly the character stands in the band
     * above the sheet, crown on screen, with nothing of them behind it.
     *
     * WHAT THIS DELIBERATELY DOES NOT CLAIM: that the face also clears the
     * microphone. There are 219 px of free stage in this state and the head
     * alone is 307 px, so no camera position exists that satisfies both — the
     * orb ends up over the chin. That is a HUD-height problem (the HALF detent
     * plus a full mic cluster is 73% of a phone) and it belongs to the surfaces,
     * not to the director; the honest thing is to say so here rather than to
     * assert something weaker and call the shot composed.
     */
    const viewport = { width: 375, height: 812 };
    const sheet = { left: 16, top: 812 - 16 - 365, width: 343, height: 365 };
    const dock = { left: 15, top: 812 - 381 - 12 - 188, width: 345, height: 188 };
    const seen = composedFrame('closeup', ctx, viewport, [sheet, dock]);

    expect(seen.crown).toBeGreaterThan(0);
    expect(seen.chin).toBeLessThan(sheet.top);
    expect(seen.chest).toBeLessThan(sheet.top);
  });

  it('every shot keeps a protected radius that actually fits its own frame', () => {
    /*
     * `keepInFrame` is the radius the composition solver may not shift out of
     * view. A radius bigger than the half-frame would disable composition
     * entirely (nothing may move), which is a silent way to lose the whole
     * feature on the breakpoint that needs it most.
     */
    for (const shot of SHOT_IDS) {
      const pose = poseFor(shot, ctx);
      const half = distance(pose) * Math.tan(((pose.fov * Math.PI) / 180) / 2);
      expect(pose.keepInFrame).toBeGreaterThanOrEqual(0);
      expect(pose.keepInFrame).toBeLessThan(half);
    }
  });
});
