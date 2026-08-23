import { describe, expect, it } from 'vitest';
import {
  APPROACH_HOLD,
  CLOSEUP_FRAME_FRACTION,
  CLOSEUP_HEADROOM,
  CLOSEUP_WIDE_DISTANCE,
  CLOSEUP_WIDE_OFF_AXIS,
  horizontalFov,
  ISLAND_AIM_LIFT,
  ISLAND_HOLD,
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
  it('aims OVER the island centre from the opening bearing', () => {
    /*
     * Over, not at. The bounding box runs from the underside of a floating
     * island to the top of its palms, so its centre is inside rock and the
     * ground the cast stands on is most of the way up it. `ISLAND_AIM_LIFT`
     * puts that standing surface near the centre line, which is what lets the
     * near rim bleed off the bottom of a portrait frame instead of leaving a
     * band of void underneath it.
     */
    const pose = poseFor('establishing', context());
    expect(pose.target.x).toBe(ISLAND_A.centre.x);
    expect(pose.target.z).toBe(ISLAND_A.centre.z);
    expect(pose.target.y).toBeCloseTo(ISLAND_A.centre.y + ISLAND_A.size.y * ISLAND_AIM_LIFT, 6);
    expect(bearingTo(pose.target, pose.position)).toBeCloseTo(STAGE_BEARING, 6);
  });

  it('lets the island run off the sides of a phone and holds it whole on a desktop', () => {
    /*
     * THE WHOLE POINT OF THE REWRITE, as one assertion.
     *
     * The fit this replaced put the island's bounding BOX inside the frame on
     * both axes. On a portrait phone half the horizontal field of view is 8.53
     * degrees, so the width requirement pushed the camera to 29 m and the island
     * then used a quarter of the frame's height: about 220x110 px in an 812 px
     * page, which is the owner's original "minimizaste el escenario" still true
     * in the phases nobody had looked at. A subject with air on all four sides
     * is an object on a table; one that runs past the edge is a place you are
     * standing in.
     *
     * Landscape keeps the whole rim, because /DESIGN.md -> Screen Recipes ->
     * Tutor spends the freed width at 1280 px on the SCENE, and because the
     * `island.rim.*` pads are pickable at that breakpoint.
     */
    const rim = ISLAND_A.size.x / 2;
    const rimAt = (pose: CameraPose, aspect: number, sign: number): number => {
      const at = project(
        pose,
        {
          x: Math.cos(STAGE_BEARING) * rim * sign,
          y: pose.target.y,
          z: -Math.sin(STAGE_BEARING) * rim * sign,
        },
        aspect,
      );
      return Math.abs(at?.x ?? 0);
    };

    const portraitAspect = 375 / 812;
    const portrait = poseFor('establishing', context({ aspect: portraitAspect }));
    expect(ISLAND_HOLD.portrait).toBeLessThan(1);
    expect(rimAt(portrait, portraitAspect, 1)).toBeGreaterThan(1);
    expect(rimAt(portrait, portraitAspect, -1)).toBeGreaterThan(1);

    const landscapeAspect = 1280 / 800;
    const landscape = poseFor('establishing', context({ aspect: landscapeAspect }));
    expect(ISLAND_HOLD.landscape).toBeGreaterThan(1);
    expect(rimAt(landscape, landscapeAspect, 1)).toBeLessThan(1);
    expect(rimAt(landscape, landscapeAspect, -1)).toBeLessThan(1);
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

  it('tilts down harder in portrait, because that is what fills a tall frame', () => {
    /*
     * The island is a floating disc on an alpha canvas, so a camera near eye
     * level sees it EDGE ON and everything around it is transparent. Its
     * projected height grows as sin(elevation) while its width does not move at
     * all, and a portrait frame is 2.2x taller than it is wide — so elevation is
     * the only lever that turns island into pixels on the axis there is spare
     * of. At 375x812 this is the difference between 7% of the frame and 43%.
     */
    const elevation = (pose: CameraPose): number =>
      Math.asin((pose.position.y - pose.target.y) / distance(pose));
    expect(elevation(poseFor('establishing', context({ aspect: 375 / 812 })))).toBeGreaterThan(
      elevation(poseFor('establishing', context({ aspect: 1280 / 800 }))) + 0.1,
    );
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

  it('leans toward the lead at both breakpoints', () => {
    for (const aspect of [1280 / 800, 375 / 812]) {
      const wide = poseFor('establishing', context({ aspect }));
      const near = poseFor('approach', context({ aspect }));
      // The aim has moved off the island's centre, toward whoever is speaking.
      expect(Math.hypot(near.target.x - RHO.x, near.target.z - RHO.z)).toBeLessThan(
        Math.hypot(wide.target.x - RHO.x, wide.target.z - RHO.z),
      );
    }
  });

  it('is nearer than the establishing shot on a desktop, and never further out than arrival for its own sake', () => {
    /*
     * THE RULE CHANGED ON 2026-08-22, AND THE OLD ONE IS WHY THE PHONE WAS
     * EMPTY.
     *
     * `approach`'s only phase is `personalizing`, and `personalizing` is an
     * AUDITION: the whole catalog stands on the island at once, each with a
     * name plate riding their crown. A plate whose anchor leaves the frame is
     * hidden AND inert, so a candidate framed out is a candidate who cannot be
     * chosen by looking at them — the exact bug the audition exists to fix.
     *
     * The shot used to buy that safety with a bigger HOLD: a symmetric ring at
     * 0.68 of the island's radius, hand-tuned until the widest candidate fitted.
     * A ring is not four people. It charged the camera for both sides of a
     * circle when what had to be in frame was four points, and it kept charging
     * after the cast moved — so `personalizing` painted 29.9% of a 375x812
     * phone while `arriving` painted 50.7%.
     *
     * Now the shot holds the CAST (`ShotContext.cast`) and this constant is only
     * the FLOOR, equal to `ISLAND_HOLD.portrait`: the audition is never framed
     * further out than arrival for want of a subject. It can still end up
     * further out when the cast genuinely stands wide, which is the next test.
     */
    const landscape = 1280 / 800;
    expect(distance(poseFor('approach', context({ aspect: landscape })))).toBeLessThan(
      distance(poseFor('establishing', context({ aspect: landscape }))),
    );

    expect(APPROACH_HOLD.portrait).toBe(ISLAND_HOLD.portrait);
  });

  it('comes IN when the cast gathers, and gives ground when it spreads', () => {
    /*
     * THE WHOLE POINT OF `ShotContext.cast`, as arithmetic.
     *
     * This is the property the old fixed hold could not have: the framing is a
     * function of where the people actually are. `standingSpots.ts` →
     * `AUDITION_NARROW_WEIGHT` is the other half — it is what makes the cast
     * gather in DEPTH rather than across the frame, and depth is free because
     * the frame's width is what a portrait phone has least of.
     *
     * Measured on the real islands, the gathering moved `diorama-a`'s widest
     * candidate from 1.97 m off the aim to 1.56 m, and the island went from
     * 29.9% of a 375x812 phone to 49.1%.
     */
    const portrait = { aspect: 375 / 812 };
    const at = (lateral: number): number => {
      const rightX = Math.cos(STAGE_BEARING);
      const rightZ = -Math.sin(STAGE_BEARING);
      const spread: ShotSubject[] = [-1, 1].map((side) => ({
        x: rightX * lateral * side,
        y: 1.5,
        z: rightZ * lateral * side,
        facing: STAGE_BEARING,
        height: 1.7,
      }));
      return distance(poseFor('approach', context({ ...portrait, cast: spread })));
    };

    expect(at(1.4)).toBeLessThan(at(2.6));

    /*
     * And the floor holds underneath it. A cast standing almost on top of each
     * other must not walk the camera into the island — `APPROACH_HOLD` still
     * promises that much of the rim, so the distance stops falling.
     */
    expect(at(0.1)).toBeCloseTo(at(0.5), 5);
  });

  it('holds every candidate, not just the lead and the companion', () => {
    /*
     * The regression this field exists to prevent: a fourth candidate standing
     * wider than either principal has to be able to push the camera back. With
     * `cast` ignored they were framed by whoever happened to be the tutor that
     * session, which is a different answer every time the learner picks
     * somebody.
     */
    const portrait = { aspect: 375 / 812 };
    const rightX = Math.cos(STAGE_BEARING);
    const rightZ = -Math.sin(STAGE_BEARING);
    const outlier: ShotSubject = {
      x: rightX * 2.9,
      y: 1.5,
      z: rightZ * 2.9,
      facing: STAGE_BEARING,
      height: 1.7,
    };

    const pair = poseFor('approach', context(portrait));
    const withOutlier = poseFor('approach', context({ ...portrait, cast: [RHO, DINA, outlier] }));
    expect(distance(withOutlier)).toBeGreaterThan(distance(pair));
    expect(withOutlier.keepInFrame.right).toBeGreaterThan(pair.keepInFrame.right);
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
    expect(pose.target).toEqual(poseFor('establishing', context({ lead: null })).target);
    expect(pose.target.x).toBe(ISLAND_A.centre.x);
    expect(pose.target.z).toBe(ISLAND_A.centre.z);
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

describe('the subject is actually in the picture, at BOTH breakpoints', () => {
  /*
   * THE SUITE THAT WOULD HAVE CAUGHT THE EAR.
   *
   * `over-shoulder` shipped, ran in `conversing` for every learner with an
   * activity on the plate, and filled a 375 px phone with the back of Dr Rho's
   * head — hair and one ear, no island, no face, no companion. Nothing here went
   * red, because the shot suites asked their subjects the wrong question:
   * `establishing` was measured for distance, `closeup` and `closeup-wide` for
   * on-screen SIZE, and the rest for the sign of a dot product and for
   * finiteness. A pose can be finite, correctly signed, and pointed at the
   * inside of a skull.
   *
   * So this asks the one question a learner asks, of every shot, at both
   * mandatory breakpoints (§1.11): is the thing this shot is FOR in the picture,
   * and not jammed against an edge. Portrait is the hard half — an aspect of
   * 0.46 turns a 36-degree vertical field of view into a 17-degree horizontal
   * one, so a lateral offset that is comfortable at 1280 px is off the side of
   * the screen at 375 px.
   *
   * It is still not a screenshot and does not pretend to be. It cannot see that
   * a head is BACKWARDS — an ear projects inside the frame perfectly well. What
   * it can do is fail the day a shot stops holding what it promises, which is
   * the failure that reached a learner undetected.
   */
  const BREAKPOINTS: ReadonlyArray<readonly [string, number]> = [
    ['1280x800', 1280 / 800],
    ['375x812', 375 / 812],
  ];

  /**
   * How far inside the frame edge a HEAD has to land, as a fraction of the
   * half-frame.
   *
   * A face touching the edge of a phone reads as cropped whether or not the
   * arithmetic says it fits, and it is also the state one composition shift away
   * from actually being cropped. Twelve per cent is about 49 px on an 812 px
   * viewport.
   */
  const HEAD_MARGIN = 0.12;

  function head(subject: ShotSubject): Vec3 {
    return { x: subject.x, y: subject.y, z: subject.z };
  }

  function crown(subject: ShotSubject): Vec3 {
    return { x: subject.x, y: subject.y + subject.height * 0.25, z: subject.z };
  }

  function chest(subject: ShotSubject): Vec3 {
    return { x: subject.x, y: subject.y - subject.height * 0.28, z: subject.z };
  }

  /**
   * What each shot PROMISES to hold, as world points.
   *
   * `heads` must clear the margin; `body` need only be inside the frame. The
   * split is not decoration: the crown and the chest are where `StageAnchors`
   * publishes `lead.crown` and `lead.chest`, so a body point off the frame is a
   * culled caption or a culled row of offer chips, while a HEAD near the edge is
   * the shot itself having gone wrong.
   */
  function promises(shot: ShotId, ctx: ShotContext): { heads: Vec3[]; body: Vec3[] } {
    const lead = ctx.lead;
    if (!lead) throw new Error('every promise in this suite is about a placed cast');
    const cast = ctx.companion ? [lead, ctx.companion] : [lead];

    switch (shot) {
      case 'establishing':
      case 'approach': {
        /*
         * The cast, the island's top, and the RING EACH SHOT SAYS IT HOLDS.
         *
         * It used to be the ring at 0.88 of the radius — where `StageAnchors`
         * publishes `island.rim.left/right` — for `establishing` and nothing at
         * all for `approach`, which had it exactly backwards on both counts.
         * The rim pads only ever mount during `personalizing`, which is
         * `approach`; and `establishing` now frames the island close enough
         * that on a phone the rim is deliberately off the sides of the screen,
         * so asserting it is inside would be asserting the bug back.
         *
         * So each shot is asked to hold what it declares — `ISLAND_HOLD` and
         * `APPROACH_HOLD` — which is a promise a reader can check against the
         * constant rather than a number that happens to pass today. Measured at
         * 375x812, `approach`'s hold is what keeps all four audition plates on
         * screen; at 0.62 of the radius the fourth one is culled.
         */
        const portrait = ctx.aspect < 1;
        const hold = shot === 'establishing' ? ISLAND_HOLD : APPROACH_HOLD;
        const held = (ctx.scene.size.x / 2) * (portrait ? hold.portrait : hold.landscape);
        const rightX = Math.cos(STAGE_BEARING);
        const rightZ = -Math.sin(STAGE_BEARING);
        const top = ctx.scene.centre.y + ctx.scene.size.y / 2;
        return {
          heads: cast.map(head),
          body: [
            ctx.scene.centre,
            { x: rightX * held, y: top, z: rightZ * held },
            { x: -rightX * held, y: top, z: -rightZ * held },
            { x: 0, y: top, z: 0 },
            ...cast.map(crown),
            ...cast.map(chest),
          ],
        };
      }
      case 'closeup':
      case 'closeup-wide':
        /*
         * Crown AND chest, because both carry chrome: the caption rides
         * `lead.crown` and the offer chips ride `lead.chest` (/DESIGN.md →
         * Screen Recipes → Tutor). A chest below the bottom of the frame culls
         * the openings entirely, which is how they came to be hung across the
         * mouth instead.
         */
        return { heads: [head(lead)], body: [crown(lead), chest(lead)] };
      case 'two-shot':
        // Both of them, or the frame is not a two-shot.
        return { heads: cast.map(head), body: [...cast.map(crown), ...cast.map(chest)] };
    }
  }

  /** Every shot, at every breakpoint, paired and solo. */
  const CASES: ReadonlyArray<readonly [string, ShotId, number, ShotSubject | null]> = BREAKPOINTS.flatMap(
    ([label, aspect]) =>
      SHOT_IDS.flatMap((shot) =>
        ([
          ['paired', DINA],
          ['solo', null],
        ] as ReadonlyArray<readonly [string, ShotSubject | null]>).map(
          ([cast, companion]) => [`${shot} · ${label} · ${cast}`, shot, aspect, companion] as const,
        ),
      ),
  );

  it.each(CASES)('%s holds what it promises', (_label, shot, aspect, companion) => {
    /*
     * SOLO IS NOT A COSMETIC VARIANT. A learner with no companion chosen is an
     * ordinary configuration, and it is the one every degradation path runs
     * through: `two-shot` falls back to `closeup-wide` there, and the removed
     * `over-shoulder` used to aim at a point 1.8 m in front of the lead — empty
     * air — with the camera 1.22 m behind their head.
     */
    const ctx = context({ aspect, companion });
    const pose = poseFor(shot, ctx);
    const { heads, body } = promises(shot, ctx);

    for (const point of heads) {
      const at = project(pose, point, aspect);
      // Null means BEHIND the camera, which is the failure a magnitude check
      // hides: a shot that has swung past its own subject still reports a
      // plausible-looking offset.
      expect(at, 'a head is behind the camera').not.toBeNull();
      expect(Math.abs(at?.x ?? 9)).toBeLessThanOrEqual(1 - HEAD_MARGIN);
      expect(Math.abs(at?.y ?? 9)).toBeLessThanOrEqual(1 - HEAD_MARGIN);
    }

    for (const point of body) {
      const at = project(pose, point, aspect);
      expect(at, 'an anchor point is behind the camera').not.toBeNull();
      expect(Math.abs(at?.x ?? 9)).toBeLessThanOrEqual(1);
      expect(Math.abs(at?.y ?? 9)).toBeLessThanOrEqual(1);
    }
  });

  it.each(BREAKPOINTS)('no shot at %s stands inside the character it is framing', (_label, aspect) => {
    /*
     * THE EAR, AS ONE NUMBER. `over-shoulder` put the camera 0.72 x height
     * behind the lead's mid-head — 1.22 m for Rho, whose head alone is 0.81 m
     * tall against a 0.795 m frame at that distance. The head was larger than
     * the picture, so the picture was an ear.
     *
     * Stated as a ratio it is checkable for every shot without knowing which one
     * is which: the frame a camera has at its distance from a character must be
     * taller than that character's head.
     */
    const ctx = context({ aspect });
    for (const shot of SHOT_IDS) {
      const pose = poseFor(shot, ctx);
      for (const subject of [RHO, DINA]) {
        const gap = Math.hypot(
          pose.position.x - subject.x,
          pose.position.y - subject.y,
          pose.position.z - subject.z,
        );
        const frameHeight = 2 * gap * Math.tan(((pose.fov * Math.PI) / 180) / 2);
        // A cartoon head is ~47% of body height (Rho's is 0.81 m of 1.70 m).
        expect(frameHeight, `${shot} is standing inside a character`).toBeGreaterThan(subject.height * 0.47);
      }
    }
  });
});

describe('how much of the frame the island actually covers', () => {
  /*
   * THE METRIC THE OWNER'S COMPLAINT IS ABOUT, and the one this repo did not
   * have.
   *
   * The stage was defended by "distance from the top of the viewport to the
   * first pixel of HUD", which counts EMPTY BACKGROUND as scene and therefore
   * reported 88% clear on the very phase that painted 6.5% of the screen. The
   * honest measurement is what the canvas paints — its alpha channel — and that
   * needs a GPU. This is its headless twin: the share of the frame taken by the
   * island's own ground disc, computed by casting one ray per sample through
   * the pose and intersecting the horizontal plane at the island's mid-height.
   *
   * IT IS A LOWER BOUND, deliberately. It counts no rock underside, no palms,
   * no arch and no characters, all of which paint pixels. Measured side by side
   * on `/dev/tutor-lab` against the canvas alpha channel, with the real HUD
   * mounted:
   *
   *      phase            disc here   alpha in a browser
   *      arriving  375      42.7%          50.7%
   *      arriving 1280      41.6%          53.1%
   *      personalizing 375  31.1%          30.2%
   *      adapting  375      29.4%          34.6%
   *
   * Re-measured on 2026-08-22, after `approach` started holding the CAST rather
   * than a fixed fraction of the island and the audition started gathering in
   * depth (`shots.ts` -> `APPROACH_HOLD`, `standingSpots.ts` ->
   * `AUDITION_NARROW_WEIGHT`):
   *
   *      personalizing 375  47.2%          49.1%
   *      personalizing 1280 46.4%          55.5%
   *
   * So a floor here is a slightly conservative floor on the real thing, which
   * is the right direction for a gate to be wrong in.
   *
   * WHAT THE FLOORS ARE CHOSEN FROM. The same measurement on the framing this
   * replaced, at the same fixtures:
   *
   *      shot            1280x800   375x812        now
   *      establishing      18.1%      7.2%    ->  41.6% / 42.7%
   *      approach          32.5%     11.1%    ->  46.4% / 47.2%
   *      two-shot          30.9%      4.5%    ->  43.4% / 29.4%
   *      closeup           32.2%     36.9%    ->  unchanged
   *      closeup-wide      33.9%     26.1%    ->  unchanged
   *
   * The floors sit roughly a fifth below the tightest value each shot now
   * reaches, which is loose enough that ordinary retuning does not trip them
   * and tight enough that every one of the three regressions above goes red
   * rather than shipping. They are per shot because the shots frame different
   * things: `establishing` exists to show the PLACE and is held to the most,
   * while a close shot's frame is mostly CHARACTER — its island share is
   * incidental and its real guard is the on-screen height suite above.
   *
   * All seven phases are covered, through `shotForPhase`: arriving, closing and
   * unavailable are `establishing`; personalizing is `approach`; adapting is
   * `two-shot`; introducing and conversing are `closeup` or `closeup-wide`.
   */
  const COVERAGE_FLOOR: Readonly<Record<ShotId, number>> = Object.freeze({
    establishing: 0.3,
    approach: 0.37,
    closeup: 0.2,
    'closeup-wide': 0.2,
    'two-shot': 0.24,
  });

  /** One ray per sample, against the island's ground plane. */
  function islandCoverage(pose: CameraPose, scene: ShotContext['scene'], aspect: number): number {
    const forward = {
      x: pose.target.x - pose.position.x,
      y: pose.target.y - pose.position.y,
      z: pose.target.z - pose.position.z,
    };
    const length = Math.hypot(forward.x, forward.y, forward.z);
    const f = { x: forward.x / length, y: forward.y / length, z: forward.z / length };
    const rl = Math.hypot(-f.z, f.x);
    const r = { x: -f.z / rl, y: 0, z: f.x / rl };
    const u = {
      x: r.y * f.z - r.z * f.y,
      y: r.z * f.x - r.x * f.z,
      z: r.x * f.y - r.y * f.x,
    };

    const vFov = (pose.fov * Math.PI) / 180;
    const tanV = Math.tan(vFov / 2);
    const tanH = Math.tan(horizontalFov(vFov, aspect) / 2);
    const radius = Math.max(scene.size.x, scene.size.z) / 2;

    // 120x120 is 14 400 rays, about a millisecond, and resolves the disc's edge
    // to under one per cent of the frame — finer than any floor below.
    const samples = 120;
    let hits = 0;
    for (let iy = 0; iy < samples; iy += 1) {
      const ny = (2 * (iy + 0.5)) / samples - 1;
      for (let ix = 0; ix < samples; ix += 1) {
        const nx = (2 * (ix + 0.5)) / samples - 1;
        const dir = {
          x: f.x + r.x * nx * tanH + u.x * ny * tanV,
          y: f.y + r.y * nx * tanH + u.y * ny * tanV,
          z: f.z + r.z * nx * tanH + u.z * ny * tanV,
        };
        if (Math.abs(dir.y) < 1e-9) continue;
        const t = (scene.centre.y - pose.position.y) / dir.y;
        if (t <= 0) continue;
        const dx = pose.position.x + dir.x * t - scene.centre.x;
        const dz = pose.position.z + dir.z * t - scene.centre.z;
        if (dx * dx + dz * dz <= radius * radius) hits += 1;
      }
    }
    return hits / (samples * samples);
  }

  const AUDIT: ReadonlyArray<readonly [string, number]> = [
    ['1280x800', 1280 / 800],
    ['375x812', 375 / 812],
  ];

  const CASES = AUDIT.flatMap(([label, aspect]) =>
    SHOT_IDS.map((shot) => [`${shot} · ${label}`, shot, aspect] as const),
  );

  it.each(CASES)('%s paints enough of the frame to be a place', (_label, shot, aspect) => {
    const ctx = context({ aspect });
    const covered = islandCoverage(poseFor(shot, ctx), ctx.scene, aspect);
    expect(covered, `${shot} leaves the frame empty`).toBeGreaterThan(COVERAGE_FLOOR[shot]);
  });

  it.each(AUDIT)('the audition still paints a place with the WHOLE cast on stage, at %s', (_label, aspect) => {
    /*
     * THE CASE THE FLOOR ABOVE CANNOT SEE, and it is the one that shipped
     * broken.
     *
     * Every other case here frames the two people a session is about.
     * `approach` never does: its one phase is `personalizing`, where the whole
     * catalog is standing there and the shot has to hold all four. That is
     * strictly harder than holding two, so a gate that only ever asks the easy
     * question passes while the real screen paints 29.9% of a phone — which is
     * exactly what happened.
     *
     * The fixture is the arrangement the solver actually produces on
     * `diorama-a` with the audition's own options, read off
     * `npm run verify:placement`: four candidates within 1.56 m of the aim
     * across the frame and spread 3.0 m in depth, which is the gathering
     * `AUDITION_NARROW_WEIGHT` buys.
     */
    const rightX = Math.cos(STAGE_BEARING);
    const rightZ = -Math.sin(STAGE_BEARING);
    const inX = Math.sin(STAGE_BEARING);
    const inZ = Math.cos(STAGE_BEARING);
    const stand = (lateral: number, depth: number, height: number): ShotSubject => ({
      x: rightX * lateral + inX * depth,
      y: 1.28 + height * 0.75,
      z: rightZ * lateral + inZ * depth,
      facing: STAGE_BEARING,
      height,
    });
    const audition = [
      stand(-0.2, 1.5, 1.9),
      stand(1.56, -0.4, 1.65),
      stand(-1.5, -0.3, 1.7),
      stand(-0.6, -1.4, 1.61),
    ];

    const ctx = context({ aspect, cast: audition });
    const pose = poseFor('approach', ctx);
    expect(
      islandCoverage(pose, ctx.scene, aspect),
      'the audition leaves the frame empty',
    ).toBeGreaterThan(COVERAGE_FLOOR.approach);

    // And every one of them is still inside the frame, which is the constraint
    // that made this hard in the first place: a candidate framed out is a
    // candidate who cannot be chosen by looking at them.
    for (const candidate of audition) {
      const at = project(pose, { x: candidate.x, y: candidate.y, z: candidate.z }, aspect);
      expect(at, 'a candidate is behind the camera').not.toBeNull();
      expect(Math.abs(at!.x), 'a candidate is off the side of the frame').toBeLessThan(1);
      expect(Math.abs(at!.y), 'a candidate is off the top or bottom of the frame').toBeLessThan(1);
    }
  });

  it.each(AUDIT)('the microphone dock does not undo the framing at %s', (label, aspect) => {
    /*
     * THE SECOND HALF OF THE SAME BUG, and it lived in `composition.ts`.
     *
     * A fitting shot answers a HUD inset by retreating, and the retreat used to
     * be `viewport / free` — the dock ate a quarter of the height, so every
     * island shot went back a third, whatever it was framing. Coverage falls as
     * the SQUARE of that, so a shot sized to fill a phone was then pushed back
     * until it filled a third of one. The retreat is now measured against the
     * radius the shot says it is protecting, so a subject that already fits the
     * free rectangle costs nothing.
     */
    const viewport = label === '375x812' ? { width: 375, height: 812 } : { width: 1280, height: 800 };
    const dock: HudRect =
      label === '375x812'
        ? { left: 15, top: 812 - 12 - 188, width: 345, height: 188 }
        : { left: 400, top: 800 - 24 - 204, width: 480, height: 204 };
    const ctx = context({ aspect });

    const insets = insetsFromRects([dock], viewport);
    for (const shot of ['establishing', 'approach', 'two-shot'] as const) {
      const pose = poseFor(shot, ctx);
      const reach = distance(pose);
      const fit = composeFor(insets, viewport, reach, ctx, pose.keepInFrame);
      const pushed = padDistance(pose.position, pose.target, fit.padding);

      /*
       * The two island shots give up NOTHING. They bleed past the frame on
       * purpose, so there is no size requirement left for a retreat to satisfy
       * — the aim shift does all the composing and the framing survives intact.
       *
       * `two-shot` is the one that legitimately gives ground, and only a little:
       * it holds two whole characters, they really are taller than the band the
       * dock leaves at 1280x800, and buying that room is exactly what a retreat
       * is for. 1.14x, against the 1.9x ceiling the old rule pinned itself to.
       */
      const given = Math.hypot(
        pushed.x - pose.target.x,
        pushed.y - pose.target.y,
        pushed.z - pose.target.z,
      ) / reach;
      if (shot === 'two-shot') expect(given, 'the pair gave up too much').toBeLessThan(1.2);
      else expect(given, `${shot} gave up its framing to the dock`).toBeCloseTo(1, 9);

      expect(
        islandCoverage({ ...pose, position: pushed }, ctx.scene, aspect),
        `${shot} is empty once the dock has been paid for`,
      ).toBeGreaterThan(COVERAGE_FLOOR[shot]);
    }
  });
});

describe('composed against a real HUD at 375x812', () => {
  const PORTRAIT = 375 / 812;
  const ctx = context({ aspect: PORTRAIT });

  it('composes the conversing close-up above a half-height sheet', () => {
    /*
     * The portrait complaint, end to end. At 375x812 the sheet at HALF plus the
     * dock riding above it claim 593 px of 812, and the camera that shipped
     * answered that by charging the sheet to the RIGHT edge and trucking a third
     * of a screen sideways. Composed correctly the character stands in the band
     * above the sheet, crown on screen, with nothing of them behind it.
     *
     * IT IS ALSO THE FRAME A LIVE SEGMENT NOW GETS. `conversing` used to swing
     * to `over-shoulder` the moment an activity reached this sheet; it stays on
     * the close-up, because /ORACLE.md §9.3, /ORACLE.md §16's gate and
     * /DESIGN.md → Screen Recipes → Tutor all require the character's on-screen
     * height to be identical with and without a segment.
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

  it('keeps the character exactly the same size with a segment and without one', () => {
    /*
     * /ORACLE.md §16 states this as a SHIPPING GATE: "the character's measured
     * on-screen height unchanged with and without a live segment". It is the
     * sentence the removed `over-shoulder` mapping broke, and the reason the
     * shot mapping can no longer be told that a segment is live at all.
     *
     * Measured as crown-to-chest in CSS pixels, with the resting HUD (dock only,
     * the sheet at PEEK) against the same dock plus a HALF sheet.
     *
     * HALF A PIXEL, NOT ZERO, and the residual is real rather than slack.
     * `applyComposition` performs a TRUCK — position and target move together —
     * so the camera's distance to the aim is arithmetically unchanged, which the
     * second assertion states directly. The crown and the chest are not AT the
     * aim, though: they are a few centimetres off it, so trucking changes their
     * depth by a hair and perspective renders them a hair differently. Measured
     * here that is 0.11 px on a 317 px character — a thousandth of the height,
     * and invisible. Asserting exact equality would be asserting that the shot
     * is orthographic.
     */
    const viewport = { width: 375, height: 812 };
    const dockOnly: HudRect = { left: 15, top: 812 - 12 - 188, width: 345, height: 188 };
    const sheet: HudRect = { left: 16, top: 812 - 16 - 365, width: 343, height: 365 };
    const dockAboveSheet: HudRect = { left: 15, top: 812 - 381 - 12 - 188, width: 345, height: 188 };

    const resting = composedFrame('closeup', ctx, viewport, [dockOnly]);
    const withSegment = composedFrame('closeup', ctx, viewport, [sheet, dockAboveSheet]);

    expect(Math.abs((withSegment.chest - withSegment.crown) - (resting.chest - resting.crown))).toBeLessThan(0.5);

    // And the reason it holds: a close shot answers an inset by SHIFTING, so
    // `SHOT_FITS_SCENE` keeps `padDistance` away from it entirely.
    expect(SHOT_FITS_SCENE.closeup).toBe(false);
    expect(SHOT_FITS_SCENE['closeup-wide']).toBe(false);
  });

  it('every shot keeps a protected half-frame that actually fits its own frame', () => {
    /*
     * `keepInFrame` is what the composition solver may not shift out of view,
     * and it now sizes the RETREAT as well as clamping the shift. Bigger than
     * the half-frame on either axis and composition is disabled entirely
     * (nothing may move) while the retreat pins itself at the 1.9x ceiling —
     * which is a silent way to lose the whole feature on the breakpoint that
     * needs it most. It is stated per axis for exactly this reason: an island
     * shot holds a 3.4 m ring sideways and about 1.1 m vertically, and one
     * scalar reported the 3.4 on both axes.
     */
    for (const shot of SHOT_IDS) {
      const pose = poseFor(shot, ctx);
      const halfUp = distance(pose) * Math.tan(((pose.fov * Math.PI) / 180) / 2);
      const halfRight = distance(pose) * Math.tan(horizontalFov((pose.fov * Math.PI) / 180, PORTRAIT) / 2);
      expect(pose.keepInFrame.up).toBeGreaterThanOrEqual(0);
      expect(pose.keepInFrame.right).toBeGreaterThanOrEqual(0);
      expect(pose.keepInFrame.up, `${shot} protects more height than it frames`).toBeLessThan(halfUp);
      expect(pose.keepInFrame.right, `${shot} protects more width than it frames`).toBeLessThan(halfRight);
    }
  });
});
