/*
 * The Tutor's shot vocabulary.
 *
 * WHY THIS IS A MODULE AND NOT A BRANCH IN THE CAMERA RIG. The stage shipped
 * with two framings decided inside `useFrame`, each of which computed an
 * ABSOLUTE camera position and wrote it every frame. That works, and it is also
 * the reason every framing change SNAPPED: there was no state between "here" and
 * "there" for anything to move through. A camera that teleports is not a
 * cheaper camera move, it is the absence of one.
 *
 * Splitting the DESTINATION from the TRAVEL fixes that in one step. Every
 * function here answers a single question — given the island, the cast and the
 * viewport, where should the camera BE for this shot — and answers it with pure
 * arithmetic. `CameraDirector` then owns the travel, and owns it once, for every
 * shot, instead of each shot reinventing it.
 *
 * PURE ON PURPOSE. Nothing here imports `three` or React, so the whole framing
 * system is testable headless the way `measurements.ts` already is. That is not
 * tidiness: framing bugs on this stage have historically been found by LOOKING,
 * because there was no way to ask "how far back does a 9.5 m island put the
 * camera on a portrait phone" without a browser and a GPU. Now there is.
 *
 * THE TRAP, recorded because it has already cost this scene once. Every shot
 * here is built off the cast's own facing axis, and `two-shot` blends two of
 * them. None of them may EVER feed back into the placement solver: if the cast
 * re-solves to face the camera while the camera is moving, the two chase each
 * other and the characters end up facing a shot that has already moved on. The
 * camera reads placement; placement never reads the camera.
 */

/** A point or a direction in scene space, in metres. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Every framing the stage can hold.
 *
 * Closed, and small enough to enumerate in a picker — which the scene lab does,
 * because a framing nobody can put on screen on demand is a framing nobody
 * verifies.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `over-shoulder` WAS THE SIXTH ENTRY AND IS GONE. Removed 2026-08-21, after
 * the stage was driven at 375x812 and 1280x800 and photographed.
 *
 * WHAT WAS ON THE SCREEN. It was the framing `conversing` took whenever a live
 * segment was on the plate. At 375x812 the viewport was filled by HAIR AND ONE
 * EAR — no island, no face, no companion. At 1280x800 the back of Dr Rho's head
 * filled the left two-thirds in profile. Every metric in this repo read
 * perfectly throughout, because a character's own body counts as painted scene
 * and the shot tests asked only for sign and finiteness.
 *
 * WHY THE ARITHMETIC SAYS IT COULD NOT BE SAVED. The camera stood
 * `0.72 x height` behind the lead's mid-head — 1.22 m for Rho — and Rho's head
 * is 0.81 m tall while the frame at 1.22 m is 0.795 m tall. The head was
 * literally larger than the picture. Standing back far enough to make the near
 * figure a foreground EDGE (a third of frame height, which for a cartoon head
 * at 47% of body height means about 2.1 x height, ~3.5 m) then collides with
 * the other constraint: the cast stands ~1.4 m apart, so from 3.5 m behind, the
 * lead subtends 5.97 degrees off axis and the companion 4.27 degrees. They are
 * 1.7 degrees apart — the "foreground shoulder" lands ON TOP of the subject.
 * Widening the lateral offset does not help, because at 375x812 half the
 * horizontal field of view is only 8.53 degrees, which caps the offset at
 * 0.53 m and the separation at 2.4 degrees. An over-the-shoulder needs the
 * stand-off to be SMALL relative to the separation; here it is the reverse, and
 * no tuning reverses it. §1.11 makes 375 px non-negotiable, so a framing that
 * is geometrically impossible there cannot stay in the vocabulary.
 *
 * WHY NOTHING REPLACES IT. Its one caller was `conversing` with a live segment,
 * and that caller was itself a violation of three authoritative documents:
 * /ORACLE.md §9.3 ("the character's on-screen height is the same with a segment
 * and without one"), /ORACLE.md §16's shipping gate ("the character's measured
 * on-screen height unchanged with and without a live segment"), and /DESIGN.md
 * → Screen Recipes → Tutor ("the character's on-screen height must be identical
 * with and without a segment, or the lesson appears to shove the tutor out of
 * the way to make room for itself"). A live segment must NOT change the shot at
 * all. `composition.ts` is what moves the character out from behind the plate,
 * and it does that without touching distance by design.
 *
 * And there was never anything in the WORLD to look over a shoulder at: the
 * activity is DOM chrome on a plate, and a world camera cannot frame a
 * screen-space rectangle. The pair moment that IS expressible — one character
 * putting a question to another — is `two-shot`, which /ORACLE.md §9.4 already
 * assigns.
 * ────────────────────────────────────────────────────────────────────────────
 */
export type ShotId =
  | 'establishing'
  | 'approach'
  | 'closeup'
  | 'closeup-wide'
  | 'two-shot';

export const SHOT_IDS = [
  'establishing',
  'approach',
  'closeup',
  'closeup-wide',
  'two-shot',
] as const satisfies readonly ShotId[];

/**
 * Who is being framed, and how big they are.
 *
 * The point is the character's MID-HEAD, not their feet and not their crown.
 * That choice is load bearing and was made by measurement: aiming at the crown
 * put the entire face in the bottom half of frame, and aiming at a fixed eye
 * height aimed at sky for Dina, who is a quadruped 0.70 m to the shoulder.
 */
export interface ShotSubject {
  x: number;
  y: number;
  z: number;
  /** Yaw the subject faces, in radians. Same convention as the placement solver. */
  facing: number;
  /** The subject's own height in metres, so every framing scales to them. */
  height: number;
}

/**
 * The composed scene's measured bounds. Supplied by the caller rather than
 * computed here, because measuring means walking an `Object3D` graph and that is
 * exactly the dependency this module exists without.
 */
export interface ShotScene {
  centre: Vec3;
  /** FULL extents of the bounding box, in metres (not half-extents). */
  size: Vec3;
}

export interface ShotContext {
  scene: ShotScene;
  /** The speaking character. Null until the placement solve lands. */
  lead: ShotSubject | null;
  /** The second character, when there is one. */
  companion: ShotSubject | null;
  /** Viewport aspect, width / height. */
  aspect: number;
  /** The camera's vertical field of view, in degrees. */
  fov: number;
}

/**
 * Metres about the target that must stay inside the frame, whatever the HUD
 * asks for — stated PER SCREEN AXIS.
 *
 * The composition solver moves the aim so the subject lands in the part of the
 * screen a panel is not covering, and on a phone the free rectangle can ask for
 * a shift big enough to push the top of a character's head off the top of the
 * viewport. Only the shot knows what it is actually framing, so the shot states
 * what it may not lose and `composition.composeFor` clamps against it — and
 * sizes its retreat from it.
 *
 * IT WAS ONE NUMBER AND THAT WAS WRONG FOR EVERY WIDE SHOT. A single radius is
 * compared against both the half-width and the half-height of the frame, so an
 * island shot holding a 3.4 m ring reported 3.4 m of protection on the vertical
 * axis too — against a half-frame of 2.7 m. The solver read that as "this
 * subject already overflows", refused to shift at all, and asked for the full
 * 1.9x retreat on every phase with a microphone dock on it. Measured at
 * 1280x800: an `establishing` pose that covered 41.6% of the frame was pushed
 * back until it covered 15.7%. The two axes are genuinely different sizes on a
 * flat wide subject, and one scalar cannot say so.
 */
export interface KeepInFrame {
  /** Half-width along the camera's own right axis. */
  right: number;
  /** Half-height along the camera's own up axis. */
  up: number;
}

/** A shot with nothing to protect — its subject is off the frame edge on purpose. */
export const KEEP_NOTHING: Readonly<KeepInFrame> = Object.freeze({ right: 0, up: 0 });

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
  near: number;
  far: number;
  keepInFrame: KeepInFrame;
}

/**
 * The bearing the stage opens on, in radians about +Y.
 *
 * Derived from the placement solver's own `preferDirection` of (0.35, 0, 1)
 * rather than authored separately. The two used to be independent numbers that
 * happened to agree within four degrees — the cast gathers on the side the
 * camera opens onto because both constants said so, not because anything
 * connected them. Deriving one from the other makes the agreement a fact rather
 * than a coincidence that survives until someone tunes one of them.
 */
export const STAGE_BEARING = Math.atan2(0.35, 1);

/**
 * How far off the subject's own facing axis `closeup-wide` sits, in radians.
 *
 * /ORACLE.md §2.2's primary decision for the two characters with no mouth card
 * is "they frame wider" — their performance is posture and gesture, and a
 * dead-on close-up frames the one thing that is not working. 22 degrees is
 * enough to read as a chosen angle rather than a mistake, and little enough that
 * the face is still the subject.
 */
export const CLOSEUP_WIDE_OFF_AXIS = (22 * Math.PI) / 180;

/** How much further back `closeup-wide` sits than `closeup`. */
export const CLOSEUP_WIDE_DISTANCE = 1.35;

/**
 * How much of the character a close-up frames, as a fraction of their height.
 *
 * IT WAS 0.70, AND THAT IS WHY THE OFFER CHIPS SIT ON DR RHO'S MOUSTACHE. At
 * 0.70 the frame is 1.19 m tall for a 1.70 m character and his head alone is
 * 0.81 m of it — 68% of the viewport is face, and the published `lead.chest`
 * anchor lands at about 90% of the screen, underneath the microphone. /DESIGN.md
 * → Screen Recipes → Tutor puts the offer chips AT THE TUTOR'S CHEST as
 * world-anchored chrome and closes the count of viewport-anchored elements at
 * three, so there is nowhere else for them to go: if the chest is not on screen
 * above the microphone dock, the openings are either culled or laid across the
 * face. The stage has exactly one lever for that, and it is this number.
 *
 * 0.90 puts the crown, the face and the chest all in frame with the head still
 * 53% of the frame height — measured against the 2.4x height spread of the cast,
 * a mouth is still tens of pixels tall at 375 px, which is the measurement the
 * whole rebuild started from (a 2.4 px mouth at the island shot). Anything
 * larger than this and the chest leaves the screen again; anything much smaller
 * and this stops being a close-up.
 *
 * THE FACE IS THE THING THE 3D CAST EXISTS FOR. Between opening the shot and
 * covering the face, opening the shot is the cheap option — it costs on-screen
 * head height, which is still ample, where the other costs the one asset the
 * character rig, the mouth atlas, the viseme pipeline and the lip-sync analyser
 * were all built to show.
 */
export const CLOSEUP_FRAME_FRACTION = 0.9;

/**
 * How far above the horizon an island shot stands, in radians.
 *
 * THIS IS THE NUMBER THAT DECIDES WHETHER A PHONE IS FULL, and it is not
 * obvious until it is measured. The island is a FLOATING disc in an alpha
 * canvas: everything that is not island is transparent. A camera near the
 * cast's own eye level therefore sees the disc EDGE ON — a thin bright band
 * across the middle of the screen with void above it and void below it. At
 * 375x812 that is literally what shipped: `arriving` painted 6.5% of the
 * viewport, an island about 220x110 px floating dead centre in an 812 px page,
 * and the phase read as a product photo of a diorama rather than as a place.
 *
 * Tilt the camera down and the same disc opens out toward a circle: its
 * projected height grows as `sin(elevation)` while its width does not change at
 * all. A portrait frame is 2.2x taller than it is wide, so the height is the
 * dimension there is spare of, and elevation is the only lever that converts
 * island into pixels on that axis.
 *
 * PORTRAIT LOOKS DOWN HARDER THAN LANDSCAPE, for that reason and no other. It
 * is not a taste: at 1280x800 the frame is wider than the island and the extra
 * tilt buys nothing but a view of the top of everybody's head, which is the one
 * thing a cast of faces should not be showing.
 */
export const ISLAND_ELEVATION = {
  landscape: (28 * Math.PI) / 180,
  portrait: (40 * Math.PI) / 180,
} as const;

/**
 * The share of the island's own radius an island shot promises to keep inside
 * the frame's WIDTH.
 *
 * BELOW 1 THE ISLAND RUNS OFF THE LEFT AND RIGHT EDGES, and that is the point.
 * A subject that bleeds past the frame reads as a place you are standing in; a
 * subject with air on all four sides reads as an object on a table. The
 * previous fit put the island's whole bounding box inside the frame on BOTH
 * axes, so on a portrait phone — where half the horizontal field of view is
 * 8.53 degrees — the width requirement pushed the camera to about 29 m and the
 * island then used 27% of the frame's height. Four fifths of the phone was
 * empty, and the metric that was supposed to defend the composition (distance
 * from the top of the viewport to the first HUD pixel) reported 88% clear.
 *
 * Landscape stays above 1 deliberately. `/DESIGN.md` -> Screen Recipes ->
 * Tutor spends the freed width at 1280 px on "a wider establishing shot and
 * real island around the floating plate", so there the whole rim is in the
 * picture with a margin — which is also what keeps the `island.rim.*` pads
 * pickable at the breakpoint where they fit.
 */
export const ISLAND_HOLD = { landscape: 1.06, portrait: 0.44 } as const;

/**
 * The same promise for `approach`, which is a WIDER hold than `establishing`
 * asks for because of what stands on the island during its one phase.
 *
 * `approach` is `personalizing`, and `personalizing` is an AUDITION: the whole
 * catalog stands on the island at once, on rings out to 0.70 of its radius
 * (`standingSpots.ts`), each with a name plate riding their crown. A plate
 * whose anchor leaves the frame is hidden AND inert, so a candidate framed out
 * is a candidate who cannot be chosen by looking at them — which is the exact
 * bug the audition was built to fix.
 *
 * SO THE PORTRAIT FIGURE IS MEASURED, NOT REASONED. Driven at 375x812 on
 * `/dev/tutor-lab` with the whole catalog on stage: at 0.62 the fourth plate
 * (Liruf's) comes back `hidden`, at 0.68 all four are on screen and the island
 * paints 30% of the viewport, and every step above that only spends coverage.
 * The widest candidate the solver seats measures about 0.69 of the radius from
 * the island's centre, which is why the number lands where it does.
 *
 * The landscape figure is set by the `island.rim.*` pads instead — they are the
 * one world control this phase mounts that lives out at 0.88 of the radius, and
 * at 1280 px there is width enough to keep them and their chip inside the
 * frame.
 *
 * SO ON A PHONE THIS SHOT SITS FURTHER OUT THAN `establishing` DOES, and the
 * inversion is deliberate rather than an oversight. It used to be a fixed 0.62
 * of the island fit, which made it strictly nearer at every aspect; keeping
 * that relationship while `establishing` came in close enough to fill a phone
 * would have framed one candidate out of four. The two shots answer different
 * questions — `establishing` frames the PLACE, `approach` frames the PEOPLE
 * standing on it — and in portrait, four people spread across a 6.5 m island
 * need more horizontal room than the island's middle does. In landscape, where
 * there is width to spare, `approach` is nearer than `establishing` exactly as
 * it always was.
 */
export const APPROACH_HOLD = { landscape: 0.94, portrait: 0.68 } as const;

/**
 * And its own elevation, steeper in portrait than `establishing`'s.
 *
 * Steeper BECAUSE it is further out. Elevation is the only thing that converts
 * a floating island into pixels on a portrait phone's long axis, and this shot
 * has to stand about 20 m back to keep four candidates and their name plates
 * inside a 17-degree horizontal field. From there a character is roughly 105 px
 * tall whatever the angle, so the tilt costs almost nothing in face legibility
 * and buys the difference between an island band across the middle of the
 * screen and an island the learner is standing over.
 *
 * Landscape is SHALLOWER than `establishing`'s, and for the mirror reason: at
 * 1280 px this shot is the nearer of the two, the candidates are large, and
 * looking down on them is exactly what the phase must not do — you choose a
 * tutor by their face.
 */
export const APPROACH_ELEVATION = {
  landscape: (24 * Math.PI) / 180,
  portrait: (44 * Math.PI) / 180,
} as const;

/**
 * How far `approach`'s aim leans off the island's centre toward the lead.
 *
 * It was 0.6, which is a portrait lean: it parks the frame on one character and
 * charges the shot for the distance needed to keep the others from falling off
 * the far edge. A quarter of the way still reads as "toward them" and costs the
 * ring almost nothing.
 */
export const APPROACH_LEAN = 0.25;

/**
 * How far inside the frame edge a held point must land, as a fraction of the
 * half-frame.
 *
 * A point exactly on the edge is cropped as far as a learner is concerned, and
 * it is also one composition shift away from actually being cropped. This is
 * tighter than the 12% the shot audit asks of a HEAD, so a shot that satisfies
 * its own hold satisfies the audit with room left over.
 */
export const HOLD_MARGIN = 0.86;

/**
 * Where an island shot aims, as a fraction of the island's own height above the
 * middle of its bounding box.
 *
 * Aiming at the box centre aims at rock: the box runs from the underside of the
 * floating island to the top of its palms, and the ground the cast stands on is
 * most of the way up it. Lifting the aim puts the standing surface near the
 * centre line, which is where the near rim starts bleeding off the bottom of a
 * portrait frame instead of leaving a band of void under it.
 */
export const ISLAND_AIM_LIFT = 0.18;

/**
 * How far above the pair's own eye line a `two-shot` stands, in radians.
 *
 * Smaller than an island shot's, because this one is framing FACES and a
 * question one character puts to another. It is not zero — which is what
 * shipped — because a level camera at 14 m puts the island edge on behind the
 * pair and fills the rest of a portrait phone with nothing: `adapting` measured
 * 7.0% of the viewport at 375x812, two toys about 45 px tall with a dead band
 * between them. A few degrees of tilt puts the island BEHIND them instead of
 * under them, which is what a two-shot's background is for.
 */
export const TWO_SHOT_PAD = {
  landscape: 1.06,
  /*
   * 1.18 UNTIL 2026-08-22, AND THE 12% IT SPENT WAS THE WHOLE COMPLAINT.
   *
   * A `two-shot` is already padded laterally: `halfWidth` adds 0.42 of the
   * taller character's height OUTSIDE each of them before anything is fitted.
   * The portrait pad was a second margin on top of that first one, added when a
   * bottom sheet took 45% of a phone and the shot needed somewhere to go. It
   * did not survive the sheet being fixed: measured on `/dev/tutor-lab` at
   * 375x812 with an adaptation offer up, the island covered 39.3% of the frame
   * and the pair sat in the middle of it with a dead band above and below —
   * the reviewer's "the island is a thin strip across the middle".
   *
   * Standing 12% closer is safe rather than brave, because the shot no longer
   * has to guess: it publishes `keepInFrame` (half the pair's separation plus a
   * head and chest), and `composition.ts` retreats by exactly what the HUD
   * actually takes and by nothing at all when the HUD takes nothing. A margin
   * paid in advance against a surface that may not be there is the retreat
   * `establishing` already stopped paying, for the same reason.
   */
  portrait: 1.06,
} as const;

export const TWO_SHOT_ELEVATION = {
  landscape: (12 * Math.PI) / 180,
  portrait: (30 * Math.PI) / 180,
} as const;

/**
 * The distance multipliers that pay for the aspect ratio, landscape then
 * portrait.
 *
 * Portrait loses horizontal room, so the same subject needs more distance for
 * the same composure — and it loses it twice over here, because the offer chips
 * that fit in one row across a desktop chest wrap to TWO rows on a 375 px one
 * while the microphone dock underneath grows from 96 px of orb to a fifth of the
 * screen. These are the numbers that put the chest above that dock at both
 * breakpoints with the cluster's measured height in between; the arithmetic is
 * written out as a test in `shots.test.ts` → "the introducing phase, composed".
 *
 * They also decide the conversing phase, and for the better: at 375 px with the
 * sheet at HALF the pair puts the whole character, crown to chest, in the band
 * ABOVE the sheet instead of half behind it. That is the owner's original
 * complaint about this route, in portrait.
 */
export const CLOSEUP_ASPECT_PAD = { landscape: 1.18, portrait: 1.45 } as const;

/**
 * How far below the mid-head point the chest anchor sits, as a fraction of the
 * character's height. Published by `StageAnchors`; named here because the close
 * shots have to promise to keep it in frame.
 *
 * A close shot's `keepInFrame` is what stops the composition solver from lifting
 * the subject out of the top of the frame when a bottom sheet claims most of a
 * phone, and this is the lower half of what it protects.
 */
export const CLOSEUP_KEEP_IN_FRAME = 0.28;

/**
 * How far above the middle of the frame the subject's head rides, as a fraction
 * of the frame's own height.
 *
 * HEADROOM, which a head dead-centre does not have. It is the ordinary framing
 * rule — a portrait with the eyes on the centre line puts half the picture under
 * the chin and cuts the top of the skull to the edge — and here it is also load
 * bearing, because the space it opens under the chin is where the offer chips
 * live. MEASURED at 375x812 in a browser: the openings are 156 px as a
 * two-column grid, the microphone cluster with its secondary row is 188 px, and
 * the chest has to land above the one with room for the other. A head on the
 * centre line leaves 124 px for a 156 px cluster; this is the 40 px that closes
 * that gap, rounded up so a longer locale still fits.
 *
 * Portrait needs more than landscape because it has less to spare in every
 * direction, and because the same four chips are two rows there and one row at
 * 1280 px.
 *
 * It is NOT a substitute for the composition solver and does not overlap with
 * it: this is a property of the SHOT, computed from the aspect alone, so it
 * cannot feed back on a measured HUD rect the way a surface-driven offset would.
 * The solver's clamp accounts for it through `keepInFrame`.
 */
export const CLOSEUP_HEADROOM = { landscape: 0.03, portrait: 0.07 } as const;

/**
 * The band above the crown that a close shot promises not to lift off the top of
 * the screen, as a fraction of the frame's height.
 *
 * THE CAPTION LIVES THERE. It rides `lead.crown` and hangs above it, it is what
 * a deaf learner reads and what everyone reads on a bus with no headphones, and
 * /ORACLE.md does not treat it as optional. It also cannot register with the
 * safe area — it is world-anchored, and the rule against that is on
 * `SafeAreaSlot` — so the only place its room can be reserved is here, by the
 * shot that decides where the crown lands.
 *
 * 0.08 is 65 px on a 812 px phone. MEASURED at 375 px: a long Spanish line wraps
 * to 75 px of text in the 22rem caption, so this is a couple of lines rather
 * than every line, chosen because the alternative — reserving for the longest
 * possible sentence — pushes the character down the screen on every short one.
 * Without any reserve at all the composed crown lands at 22 px with the sheet at
 * HALF, and the tutor speaks in a caption that is off the top of the screen.
 */
export const CLOSEUP_CAPTION_BAND = 0.08;

/**
 * Which shots FIT a measured object, and therefore must give ground when the HUD
 * eats part of the viewport.
 *
 * A fitting shot has a size requirement, so a smaller free rectangle means
 * pulling back. A close shot does not: /ORACLE.md's composition rule is that the
 * character's on-screen height does not change when a lesson plate appears, so
 * a close shot answers an inset by SHIFTING its aim and never by retreating.
 * Conflating the two is how a lesson panel silently shrinks the character it is
 * supposed to be sitting beside.
 */
export const SHOT_FITS_SCENE: Readonly<Record<ShotId, boolean>> = Object.freeze({
  establishing: true,
  approach: true,
  closeup: false,
  'closeup-wide': false,
  'two-shot': true,
});

/**
 * The ambient motion each shot wears when ambient motion is on at all.
 *
 * `orbit` is the slow circle that turns a mesh into a place. `handheld` is a
 * far smaller sway that reads as a held camera — an orbit during dialogue reads
 * as the room moving rather than the person speaking, which is a different scene
 * entirely.
 */
export const SHOT_AMBIENT: Readonly<Record<ShotId, 'orbit' | 'handheld'>> = Object.freeze({
  establishing: 'orbit',
  approach: 'orbit',
  closeup: 'handheld',
  'closeup-wide': 'handheld',
  'two-shot': 'handheld',
});

/* Small local vector helpers. Deliberately not `three`'s — see the header. */

function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

/**
 * Guards the viewport numbers before any trigonometry touches them.
 *
 * A zero-height canvas is a real state — it is what jsdom reports, and what a
 * browser reports for one frame while a panel is animating open. `width / 0` is
 * `Infinity`, which propagates through `atan` into a camera position of NaN, and
 * a NaN camera renders nothing at all with no error anywhere. Substituting a
 * square viewport is wrong by a little for one frame; NaN is wrong forever.
 */
function safeAspect(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

function safeFovRadians(fovDegrees: number): number {
  const fov = Number.isFinite(fovDegrees) && fovDegrees > 1 && fovDegrees < 179 ? fovDegrees : 36;
  return (fov * Math.PI) / 180;
}

/** Horizontal field of view implied by a vertical one at this aspect. */
export function horizontalFov(verticalFovRadians: number, aspect: number): number {
  return 2 * Math.atan(Math.tan(verticalFovRadians / 2) * safeAspect(aspect));
}

/**
 * How far back a camera must sit to contain a subject of these half-extents.
 *
 * Fits the BOX, never the bounding sphere. A sphere around a wide flat island is
 * dominated by its width, so fitting one pushed the camera about 65% further
 * back than necessary and left the island a small object in a sea of margin.
 * `fitCamera.ts` still fits a sphere and is still correct for what it does —
 * framing one unknown asset in the inspector, where over-framing is safe and
 * cropping is not.
 */
export function fitDistance(
  halfWidth: number,
  halfHeight: number,
  halfDepth: number,
  verticalFovRadians: number,
  aspect: number,
): number {
  const hFov = horizontalFov(verticalFovRadians, aspect);
  const forHeight = halfHeight / Math.tan(verticalFovRadians / 2) + halfDepth;
  const forWidth = halfWidth / Math.tan(hFov / 2) + halfDepth;
  return Math.max(forHeight, forWidth);
}

/**
 * Camera position at a TRUE distance and an elevation angle around a target.
 *
 * The old signature took a HORIZONTAL distance and an absolute height, which is
 * the same picture described in coordinates that no framing rule is written in.
 * Every requirement a shot has — "this point must land inside the frame", "the
 * frame must be taller than that character's head" — is about the distance
 * along the view ray, so stating the pose that way removes a conversion that
 * was silently making every island shot 7% further out than its own arithmetic
 * asked for.
 */
function orbitPosition(target: Vec3, bearing: number, distance: number, elevation: number): Vec3 {
  const flat = distance * Math.cos(elevation);
  return vec(
    target.x + Math.sin(bearing) * flat,
    target.y + distance * Math.sin(elevation),
    target.z + Math.cos(bearing) * flat,
  );
}

/**
 * The camera basis at a bearing and elevation. Right is horizontal by
 * construction, which is what `applyComposition` also assumes.
 */
function cameraBasis(bearing: number, elevation: number) {
  const cosE = Math.cos(elevation);
  const sinE = Math.sin(elevation);
  const sinB = Math.sin(bearing);
  const cosB = Math.cos(bearing);
  return {
    forward: vec(-sinB * cosE, -sinE, -cosB * cosE),
    right: vec(cosB, 0, -sinB),
    up: vec(-sinB * sinE, cosE, -cosB * sinE),
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * The nearest a camera may stand to `aim` and still have `point` inside the
 * frame, with `margin` of the half-frame left over on the binding axis.
 *
 * WHY THIS IS THE WHOLE FIT NOW. `fitDistance` answers "how far back must I be
 * to contain this BOX", and a box is the wrong subject for a round island: it
 * charges the camera for the far rim, the near rim and both sides at once, on
 * both axes, and on a portrait phone the width term alone is three and a half
 * times the height term. What a shot actually promises is a SET OF POINTS —
 * these heads, that rim, the top of those palms — and everything else is free
 * to run off the edge. Asking each promised point for the distance IT needs,
 * and taking the largest, is the same question asked about the right subject.
 *
 * Exact rather than iterative: the point's depth is `distance + along`, so both
 * requirements are linear in `distance` and solve in closed form. An iterative
 * fit would converge to the same answer and would be one more thing that can
 * fail to converge on a degenerate frame.
 */
function holdDistance(
  point: Vec3,
  aim: Vec3,
  bearing: number,
  elevation: number,
  verticalFovRadians: number,
  aspect: number,
  margin: number,
  /**
   * Extra metres of the subject's own body to clear SIDEWAYS of `point`.
   *
   * Lateral only. A character's silhouette spreads either side of the anchor on
   * their spine, which is the axis a bleeding frame crops; it does not spread
   * above their crown, and charging the vertical for it cost 4 m of stand-off
   * on a portrait phone to reserve room above nothing at all.
   */
  pad = 0,
): number {
  const basis = cameraBasis(bearing, elevation);
  const offset = vec(point.x - aim.x, point.y - aim.y, point.z - aim.z);
  const along = dot(offset, basis.forward);
  const lateral = Math.abs(dot(offset, basis.right)) + pad;
  const raise = Math.abs(dot(offset, basis.up));

  const tanV = Math.tan(verticalFovRadians / 2);
  const tanH = Math.tan(horizontalFov(verticalFovRadians, aspect) / 2);
  const guard = Math.max(margin, 0.05);

  return Math.max(lateral / (guard * tanH) - along, raise / (guard * tanV) - along);
}

/** Shortest-arc average of two yaws. Naive averaging flips across ±π. */
function blendYaw(a: number, b: number, t: number): number {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}

/** The island's radius and the height of the ground the cast stands on. */
function islandShape(scene: ShotScene): { radius: number; height: number; top: number } {
  const span = Math.max(scene.size.x, scene.size.z, 1e-3);
  const height = Math.max(scene.size.y, 1e-3);
  return { radius: span / 2, height, top: scene.centre.y + height / 2 };
}

/** Two points on the island's ground ring, at the extreme left and right of frame. */
function ringPoints(scene: ShotScene, radius: number, y: number, bearing: number): HoldPoint[] {
  const rightX = Math.cos(bearing);
  const rightZ = -Math.sin(bearing);
  return [
    { point: vec(scene.centre.x + rightX * radius, y, scene.centre.z + rightZ * radius), pad: 0 },
    { point: vec(scene.centre.x - rightX * radius, y, scene.centre.z - rightZ * radius), pad: 0 },
  ];
}

/** A promised point plus the body around it that must clear the frame edge too. */
interface HoldPoint {
  point: Vec3;
  pad: number;
}

/**
 * Head, crown and chest of whoever is on stage — the points chrome hangs on —
 * each carrying the character's own silhouette as a pad.
 *
 * THE PAD IS NOT DECORATION. A character's anchors sit on their spine, so a
 * frame that holds the anchor holds a LINE and crops whatever is either side of
 * it. Photographed at 375x812 with the new island framing that was Liruf's
 * snout, sliced off by the right edge while his head point sat comfortably
 * inside — a crop that reads as a mistake rather than as a composition, which
 * is the opposite of what letting the ISLAND bleed is for.
 *
 * 0.22 of height, and it is a compromise stated rather than hidden. The measured
 * footprints (`measurements.ts`) are the character's WIDEST horizontal extent,
 * which for three of the four is their length and not their width: Liruf is
 * 1.03x his height nose to tail and Dina 1.48x, while Rho and Zara are about
 * 0.48x across. Reserving half of Dina's 2.83 m broadside on both sides of
 * every anchor would cost about a third of the island's on-screen area in every
 * phase, to protect a tail that is usually pointing away from the camera.
 * 0.22 x height is a shoulder and a cheek — 0.37 m for Liruf — and on top of
 * `HOLD_MARGIN`'s own reserve it is what stops a frame edge landing on a face.
 */
const CAST_SHOULDER = 0.22;

function castPoints(ctx: ShotContext): HoldPoint[] {
  const points: HoldPoint[] = [];
  for (const subject of [ctx.lead, ctx.companion]) {
    if (!subject) continue;
    const pad = subject.height * CAST_SHOULDER;
    points.push({ point: vec(subject.x, subject.y + subject.height * 0.25, subject.z), pad });
    points.push({ point: vec(subject.x, subject.y, subject.z), pad });
    points.push({ point: vec(subject.x, subject.y - subject.height * 0.28, subject.z), pad });
  }
  return points;
}

/**
 * The one framing rule both island shots are built from.
 *
 * Stand as CLOSE as the promised points allow and let everything else bleed.
 * That single sentence is the whole change: the fit it replaces asked how far
 * back the camera must be to contain the island's bounding box, which is a
 * question about an object, and answered it on the axis a portrait phone has
 * least of.
 */
function islandFraming(
  ctx: ShotContext,
  hold: { landscape: number; portrait: number },
  elevation: { landscape: number; portrait: number },
  /** How far the aim leans off the island's centre toward the lead, 0..1. */
  lean: number,
): { distance: number; elevation: number; target: Vec3; keep: KeepInFrame } {
  const vFov = safeFovRadians(ctx.fov);
  const aspect = safeAspect(ctx.aspect);
  const portrait = aspect < 1;
  const angle = portrait ? elevation.portrait : elevation.landscape;
  const shape = islandShape(ctx.scene);
  const held = shape.radius * (portrait ? hold.portrait : hold.landscape);

  const centred = vec(
    ctx.scene.centre.x,
    ctx.scene.centre.y + shape.height * ISLAND_AIM_LIFT,
    ctx.scene.centre.z,
  );
  // Resolved BEFORE the hold distances, because every one of them is measured
  // from the aim: leaning afterwards would move the frame off the points it was
  // just sized to hold.
  const target =
    ctx.lead && lean > 0 ? mix(centred, vec(ctx.lead.x, ctx.lead.y, ctx.lead.z), lean) : centred;

  const promised: HoldPoint[] = [
    ...ringPoints(ctx.scene, held, shape.top, STAGE_BEARING),
    // The top of the island's own bounding box — an arch, a palm, a mast. It is
    // the silhouette that says "island" from any distance, and cropping it is
    // how a place starts reading as a floor.
    { point: vec(ctx.scene.centre.x, shape.top, ctx.scene.centre.z), pad: 0 },
    ...castPoints(ctx),
  ];

  const basis = cameraBasis(STAGE_BEARING, angle);
  let distance = 0;
  const keep: KeepInFrame = { right: 0, up: 0 };
  for (const { point, pad } of promised) {
    distance = Math.max(
      distance,
      holdDistance(point, target, STAGE_BEARING, angle, vFov, aspect, HOLD_MARGIN, pad),
    );
    const offset = vec(point.x - target.x, point.y - target.y, point.z - target.z);
    keep.right = Math.max(keep.right, Math.abs(dot(offset, basis.right)) + pad);
    keep.up = Math.max(keep.up, Math.abs(dot(offset, basis.up)));
  }

  /*
   * The floor, and it is the same one the shot audit states as a rule: the
   * frame at the camera's distance must be taller than a cartoon head, which is
   * about 47% of body height. Nothing in the arithmetic above can produce a
   * pose inside somebody's skull, but a degenerate scene measurement (a single
   * frame during load, an island that has not streamed in) can produce a very
   * small one, and a camera that dives into the geometry for one frame is a
   * flash of the inside of a rock.
   */
  const tallest = Math.max(ctx.lead?.height ?? 0, ctx.companion?.height ?? 0, 0);
  const floor = tallest * 0.6 + shape.radius * 0.25;
  return { distance: Math.max(distance, floor, 0.5), elevation: angle, target, keep };
}

/**
 * The island, framed as a PLACE: close enough that it runs off the sides of a
 * phone, tilted down far enough that its surface reads rather than its edge.
 */
function establishing(ctx: ShotContext): CameraPose {
  const framing = islandFraming(ctx, ISLAND_HOLD, ISLAND_ELEVATION, 0);
  const { distance, target } = framing;
  return {
    position: orbitPosition(target, STAGE_BEARING, distance, framing.elevation),
    target,
    fov: ctx.fov,
    near: Math.max(distance / 200, 0.01),
    far: distance * 20 + Math.max(ctx.scene.size.x, ctx.scene.size.z) * 20,
    /*
     * WHAT THE HUD MAY NOT SHIFT OUT OF SIGHT, and it is no longer zero.
     *
     * Zero meant "this shot answers an inset by retreating", and retreating was
     * the right answer while the shot's subject was the island's whole bounding
     * box. It is not the right answer for a shot that is deliberately bleeding:
     * there is nothing left to fit, so a retreat only undoes the framing. The
     * shot now states the radius it is actually holding and `composition.ts`
     * pays for the HUD by SHIFTING the aim first and retreating only if that
     * radius genuinely will not fit the room left over.
     */
    keepInFrame: framing.keep,
  };
}

/**
 * The cast, on the same bearing the stage opened on.
 *
 * Holding the bearing is the whole point: this is the move that makes arrival
 * feel like walking up to a place rather than cutting to a different one, and a
 * bearing change during it would make it a different place.
 *
 * WHAT IT FRAMES IS THE PEOPLE, not the island — see `APPROACH_HOLD` for why
 * that makes it the wider of the two shots on a phone and the nearer of the two
 * on a desktop.
 */
function approach(ctx: ShotContext): CameraPose {
  /*
   * The aim leans off the island's centre toward whoever is speaking, which is
   * what makes this a step toward them rather than a wider version of the same
   * picture. It leans less than it used to (0.6), because the phase's subject
   * is the whole ring of candidates and an aim parked on one of them pushes the
   * others toward the edge they must not cross.
   */
  const framing = islandFraming(ctx, APPROACH_HOLD, APPROACH_ELEVATION, APPROACH_LEAN);
  const { distance, target } = framing;
  return {
    position: orbitPosition(target, STAGE_BEARING, distance, framing.elevation),
    target,
    fov: ctx.fov,
    near: Math.max(distance / 200, 0.01),
    far: distance * 20 + Math.max(ctx.scene.size.x, ctx.scene.size.z) * 20,
    keepInFrame: framing.keep,
  };
}

/**
 * How far a head-and-chest shot of THIS subject sits.
 *
 * A fraction of the character, never a fixed number of metres. A metre-based
 * framing was measured and looked far too tight, and the reason is anatomy:
 * these are cartoon proportions and Rho's head alone is 0.81 m, 47% of his
 * height. A 0.70 m tall frame that would be a comfortable head-and-shoulders on
 * a human cropped his skull and his chin at once.
 *
 * The fraction it frames is `CLOSEUP_FRAME_FRACTION`, and the note on that
 * constant is where the reason it is no longer 0.70 is written down.
 */
function closeupDistance(subject: ShotSubject, ctx: ShotContext): number {
  const vFov = safeFovRadians(ctx.fov);
  const aspect = safeAspect(ctx.aspect);
  const framedHeight = subject.height * CLOSEUP_FRAME_FRACTION;
  const pad = aspect < 1 ? CLOSEUP_ASPECT_PAD.portrait : CLOSEUP_ASPECT_PAD.landscape;
  return (framedHeight / 2 / Math.tan(vFov / 2)) * pad + 0.15;
}

function closeup(ctx: ShotContext): CameraPose {
  const lead = ctx.lead;
  // No cast yet means the placement solve has not landed. Framing the island is
  // the honest answer; framing the origin would aim at empty sky under the
  // island and read as a broken scene rather than a loading one.
  if (!lead) return establishing(ctx);

  const distance = closeupDistance(lead, ctx);

  /*
   * The aim sits BELOW the mid-head by the headroom, which is what puts the head
   * above the centre line. Derived from the frame this shot actually has rather
   * than from the character's height: the point of it is a share of the PICTURE,
   * and a fraction of the subject would mean a taller character got more
   * headroom than a shorter one at the same framing, which is backwards.
   */
  const frameHeight = 2 * distance * Math.tan(safeFovRadians(ctx.fov) / 2);
  const headroom =
    frameHeight * (safeAspect(ctx.aspect) < 1 ? CLOSEUP_HEADROOM.portrait : CLOSEUP_HEADROOM.landscape);
  const aimY = lead.y - headroom;
  const target = vec(lead.x, aimY, lead.z);
  return {
    // Standing ON the facing vector puts the camera in FRONT of the character.
    // This is the single mistake this scene has already made once: "inward" and
    // "toward the viewer" are opposites when the camera is outside the island.
    position: vec(
      lead.x + Math.sin(lead.facing) * distance,
      aimY + lead.height * 0.04,
      lead.z + Math.cos(lead.facing) * distance,
    ),
    target,
    fov: ctx.fov,
    near: 0.01,
    far: 100,
    /*
     * The crown, which the headroom has just moved further from the aim, and
     * with it the chest — the chest is not decoration here: it is the anchor the
     * offer chips ride, and a chest pushed off the bottom of the frame culls the
     * openings entirely rather than merely cropping a shoulder. The crown is the
     * larger of the two once headroom is counted, so it is the one that binds.
     */
    keepInFrame: {
      // Sideways, the character's own silhouette: a close-up may truck to clear
      // a panel, never so far that it trucks past its subject.
      right: lead.height * 0.25,
      up: lead.height * 0.25 + headroom + frameHeight * CLOSEUP_CAPTION_BAND,
    },
  };
}

/**
 * The wider close shot, for the characters whose performance is their body.
 *
 * Liruf and Dina have no mouth card (/TUTOR_3D.md §7.1), so a dead-on close-up
 * frames a painted, motionless mouth at full size. /ORACLE.md §2.2's primary
 * decision for them is to frame wider and keep more of the body in shot; the
 * stage shipped §2.2's FALLBACK instead ("never close the camera on them"),
 * which left them at the island shot where nothing about them is legible either.
 *
 * So: off the facing axis, further back, and aimed BETWEEN the head and the
 * hands rather than at the head. Hands are where gesture lives, and gesture is
 * what these two say things with.
 */
function closeupWide(ctx: ShotContext): CameraPose {
  const lead = ctx.lead;
  if (!lead) return establishing(ctx);

  const distance = closeupDistance(lead, ctx) * CLOSEUP_WIDE_DISTANCE;
  const frameHeight = 2 * distance * Math.tan(safeFovRadians(ctx.fov) / 2);
  const yaw = lead.facing + CLOSEUP_WIDE_OFF_AXIS;
  // Drop the aim from mid-head toward the chest so both the face and the hands
  // are inside the frame rather than the face alone at the bottom of it.
  const aimY = lead.y - lead.height * 0.13;
  const target = vec(lead.x, aimY, lead.z);
  return {
    position: vec(lead.x + Math.sin(yaw) * distance, aimY + lead.height * 0.06, lead.z + Math.cos(yaw) * distance),
    target,
    fov: ctx.fov,
    near: 0.01,
    far: 100,
    // The aim has already dropped 0.13 toward the chest, so the crown is that
    // much further above it than on the straight close-up — and the caption
    // still rides above the crown, on this shot as on every other.
    keepInFrame: {
      right: lead.height * 0.25,
      up: lead.height * (CLOSEUP_KEEP_IN_FRAME + 0.13) + frameHeight * CLOSEUP_CAPTION_BAND,
    },
  };
}

/**
 * Both characters in one frame, for the moments that are about the pair.
 *
 * With one character on stage this degrades to `closeup-wide` rather than
 * failing: a two-shot of one person IS a wider single, and a frame built around
 * an absent second subject would sit half empty pointing at nothing.
 */
function twoShot(ctx: ShotContext): CameraPose {
  const { lead, companion } = ctx;
  if (!lead || !companion) return closeupWide(ctx);

  const vFov = safeFovRadians(ctx.fov);
  const aspect = safeAspect(ctx.aspect);
  const mid = vec((lead.x + companion.x) / 2, (lead.y + companion.y) / 2, (lead.z + companion.z) / 2);
  const separation = Math.hypot(companion.x - lead.x, companion.z - lead.z);
  const tallest = Math.max(lead.height, companion.height);

  /*
   * The pair's separation is used UNPROJECTED, which over-frames whenever the
   * pair happens to stand along the view axis. That is the safe direction to be
   * wrong in: an over-framed two-shot is a slightly loose two-shot, while an
   * under-framed one crops a character out of a frame whose entire purpose is
   * that both of them are in it.
   */
  const halfWidth = separation / 2 + tallest * 0.42;
  const halfHeight = tallest * 0.62;
  const distance =
    fitDistance(halfWidth, halfHeight, tallest * 0.3, vFov, aspect) *
    (aspect < 1 ? TWO_SHOT_PAD.portrait : TWO_SHOT_PAD.landscape);

  // Stand where both are facing, so the camera is in front of the pair rather
  // than behind either of them. The solver already turns each a quarter of the
  // way toward the other, so their average facing is the frame they compose.
  const yaw = blendYaw(lead.facing, companion.facing, 0.5);
  /*
   * AND STAND ABOVE THEIR EYE LINE, which the shipped version did not.
   *
   * The distance here is set by the pair's separation against a horizontal
   * field of view that is 17 degrees on a portrait phone, so it is long — about
   * 14 m — and there is nothing to be done about that: two characters 1.8 m
   * apart cannot be in one frame from closer. What CAN be done is decide what
   * is behind them at that distance. A level camera on a floating island looks
   * straight out over the rim, so the answer was VOID: `adapting` painted 7.0%
   * of a 375x812 phone, two figures about 45 px tall with transparent canvas
   * above, below and between them. Tilting down puts the island's own surface
   * behind the pair instead, and the same shot of the same two characters
   * becomes a shot of two characters somewhere.
   */
  const elevation = aspect < 1 ? TWO_SHOT_ELEVATION.portrait : TWO_SHOT_ELEVATION.landscape;
  return {
    position: orbitPosition(mid, yaw, distance, elevation),
    target: mid,
    fov: ctx.fov,
    near: 0.01,
    far: Math.max(distance * 20, 100),
    /*
     * The pair, which the tilt must not lift off the top of the frame when a
     * bottom sheet claims most of a phone. Half their separation plus a body's
     * worth of head-and-chest is exactly what this shot exists to hold.
     */
    keepInFrame: { right: halfWidth, up: halfHeight },
  };
}

const SHOTS: Readonly<Record<ShotId, (ctx: ShotContext) => CameraPose>> = Object.freeze({
  establishing,
  approach,
  closeup,
  'closeup-wide': closeupWide,
  'two-shot': twoShot,
});

/** Resolves a shot to the pose the camera should be travelling toward. */
export function poseFor(shot: ShotId, ctx: ShotContext): CameraPose {
  return SHOTS[shot](ctx);
}

/**
 * The legacy two-value framing the stage shipped with.
 *
 * Kept because `ConversationView` still speaks it and is owned by a later
 * increment. Mapping rather than deleting is what lets the camera system land
 * without a flag day across files this change does not touch.
 */
export type LegacyFraming = 'vignette' | 'conversation';

export function shotForLegacyFraming(framing: LegacyFraming): ShotId {
  return framing === 'conversation' ? 'closeup' : 'establishing';
}
