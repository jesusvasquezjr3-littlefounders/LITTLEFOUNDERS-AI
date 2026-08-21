import { describe, expect, it } from 'vitest';
import {
  CLOSEUP_WIDE_DISTANCE,
  CLOSEUP_WIDE_OFF_AXIS,
  horizontalFov,
  poseFor,
  SHOT_AMBIENT,
  SHOT_FITS_SCENE,
  SHOT_IDS,
  shotForLegacyFraming,
  STAGE_BEARING,
  type CameraPose,
  type ShotContext,
  type ShotSubject,
  type Vec3,
} from './shots';

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

  it('aims at the mid-head point the placement pass reported', () => {
    const pose = poseFor('closeup', context());
    expect(pose.target).toEqual({ x: RHO.x, y: RHO.y, z: RHO.z });
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
});
