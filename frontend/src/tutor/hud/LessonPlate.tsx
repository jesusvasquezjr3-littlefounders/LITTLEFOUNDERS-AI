import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { HudPlate } from './HudPlate';
import { MIC_ORB_SIZE_PX } from './MicOrb';

/*
 * The surface a live lesson runs on, floating over the island.
 *
 * ON DESKTOP IT IS A DOCKED FULL-HEIGHT PANEL (owner sign-off 2026-08-28,
 * superseding two earlier positions in turn). The 2026-08-21 build put the
 * stage in one half of a `lg:grid-cols-[1fr_1fr]` split and was rejected for
 * its SILHOUETTE — a near-opaque slab down half the screen reads as a
 * dashboard. The correction floated a content-fitted 420 px plate in the
 * bottom-right corner, and the owner rejected THAT on use: the transcript
 * lived folded away, the conversation had no stable home, and the screen read
 * as disorganised. The docked panel keeps what the first rejection actually
 * taught — the material stays Lumen over a full-bleed canvas, never an opaque
 * slab, and the island keeps roughly two thirds of the width with the camera
 * composing the character into it — while giving the conversation, the
 * activity and the composer one permanent, ordered home on the breakpoint
 * that has room for all three.
 *
 * ON A PHONE IT IS A BOTTOM SHEET, because 420 px of floating plate on a 375 px
 * screen is the whole screen. Three detents from /DESIGN.md's `sheet-detents`:
 * PEEK where it rests, HALF for working, FULL for reading back a long
 * conversation. The learner drags it, and the camera composes around wherever
 * they left it.
 *
 * PEEK IS A SUMMARY ROW, NOT A CLIPPED PANEL, and that correction is what makes
 * resting there honest. An 88 px sheet used to be the top 88 px of the same
 * column — half a character's head and the first line of an exercise, sliced —
 * so the only way to find out what had arrived was to open it, and the sheet
 * therefore opened itself to 45% of the screen the moment anything did. Measured
 * on a 375x812 phone that left 227 px of island under a HUD on a route whose
 * entire premise is that the island IS the page. So at PEEK the body is not
 * shown at all: the sheet is one row that SAYS what is waiting and opens on a
 * tap, and the same phone keeps 560 px of island — everything above the sheet's
 * 88 px, its 16 px inset and the microphone dock riding over it. What the
 * learner loses at PEEK is the transcript log, which is a live region; the
 * caption over the speaker's crown is mounted in every phase and carries the
 * announcement, and the row itself announces an arrival politely, so nothing
 * that speaks goes silent.
 *
 * IT PUBLISHES ITS OWN RECTANGLE, and that is what keeps the tutor's head the
 * same size on screen whether or not an exercise is up. The camera reads the
 * published rect and aims into the FREE part of the frame instead of the
 * geometric centre, so an arriving lesson never appears to shove the character
 * out of the way to make room for itself. Publishing goes through
 * `SafeAreaContext`, which is a ref channel: a drag writes sixty rectangles a
 * second and not one of them re-renders anything.
 *
 * WHY THE HEIGHT IS WRITTEN IMPERATIVELY DURING A DRAG. The obvious version
 * holds the height in state and lets React apply it. A sheet is dragged, so
 * that is a `setState` per `pointermove`, which re-renders the whole
 * conversation (including the live exercise) on every frame of the gesture,
 * while the GPU is already drawing an island. The settled height IS state,
 * because it survives a re-render and it is what the content is laid out
 * against; only the in-between frames bypass React.
 */

/** The three heights a sheet may rest at (/DESIGN.md `layout.immersive.sheet-detents`). */
export const LESSON_PLATE_DETENTS = ['peek', 'half', 'full'] as const;
export type LessonPlateDetent = (typeof LESSON_PLATE_DETENTS)[number];

const PEEK_PX = 88;
const HALF_FRACTION = 0.45;
const FULL_FRACTION = 0.88;

/**
 * The gap under a sheet, matching `layout.immersive.hud-inset-mobile`.
 *
 * A sheet flush to the bottom edge is the platform convention and it is the
 * wrong one here: the point of this route is that the island is visible around
 * everything, and a slab welded to the bottom of the screen is the silhouette
 * that got the last version rejected, rotated ninety degrees.
 */
const SHEET_INSET_PX = 16;

/** Below this the plate is a sheet. `lg`, the same breakpoint Tailwind uses. */
const DESKTOP_QUERY = '(min-width: 1024px)';

/** A pointer has to travel this far before the gesture stops being a tap. */
const DRAG_SLOP_PX = 4;

/**
 * What the sheet must always leave above itself, in CSS pixels.
 *
 * FOUND BY MEASURING, not by reasoning. The microphone cluster rides above the
 * sheet. At the FULL detent on a 375x812 phone the raw fractions put the sheet
 * at 715 px, which pushed the cluster to y = -155: the microphone, its status
 * line and the only way to type were all off the top of the screen at once.
 * Every gate was green through it.
 *
 * So the fractions are a target and this is the ceiling. FULL becomes about
 * 63vh on that phone rather than 88vh, which is still most of the screen for
 * reading a transcript, and the hero control is still on it.
 *
 * The number is deliberately NOT re-tightened now that the composer shares the
 * orb's row and the cluster measures 136 px rather than 192 px (measured on
 * `/dev/tutor-lab` at 375x812). The reserve has to hold for the WORST dock, not
 * the resting one: an adaptation question wrapping to three lines in pt-BR
 * stacks a plate and two answers on top of that row, and the FULL detent is
 * where a learner is least able to see what they pushed off the screen. What
 * the shorter cluster buys is spent on the scene at PEEK and HALF, where the
 * learner actually sits, rather than on 56 px more transcript.
 *
 * RAISED TO 348 ON 2026-09-12, because the worst dock got worse by exactly one
 * row. The session controls — the menu and Finish — used to ride the top-right
 * corner at every width. At 390 px that corner is the only band the ANCHORED
 * caption has, and putting controls in it pushed the caption 72 px down and
 * into the dock; moving them into the dock instead, where a thumb already is
 * and where the rect is already published, made the dock 48 px taller and the
 * caption met it from the other side. `verify:tutor-ui` measured every step of
 * that: 263x49, then 262x33 once the caption dropped its identity row on a
 * phone with a board up, then 262x19.
 *
 * Shaving the caption further was the alternative and it is the wrong one: the
 * next thing to go would have been the 2D portrait, which is the only mouth
 * `liruf` and `dina` have and the one channel /ORACLE.md forbids taking from a
 * deaf learner. The dock grew, so the reserve grows. 48 px, the height of the
 * row that caused it, plus nothing.
 *
 * What it costs, stated rather than discovered later: at 375x812 the FULL
 * detent goes from 512 px to 464 px. An activity needs 363 px at 390x844
 * (measured, TUTOR_QA_2026-09-02 D2), so FULL still clears it by a hundred
 * pixels, and `ACTIVITY_FLOOR_PX` and `DETENT_STEP_PX` below keep the three
 * detents separated structurally at every viewport regardless.
 */
const STAGE_RESERVE_PX = 348;

/**
 * Found by adversarial review, round 88 (2026-08-31, HIGH). `STAGE_RESERVE_PX`
 * is a flat 300px regardless of viewport, and the media query that decides
 * whether this is a sheet at all (`DESKTOP_QUERY`) is WIDTH-only — so any phone
 * turned sideways stays in sheet mode with a viewport height far shorter than
 * the 812px this file's other comments measure against. On an iPhone SE in
 * landscape (`innerHeight` 375) the old `ceiling = max(88, 375 - 300) = 88`
 * left NOTHING above PEEK for HALF or FULL to grow into: all three detents
 * collapsed to the identical 88px, so tapping a graded activity open changed
 * `resting` from true to false — un-hiding the body — without the sheet
 * actually growing, and the exercise rendered entirely below the fold of an
 * `overflow-hidden` wrapper. Reachable by an ordinary device rotation, with no
 * orientation lock anywhere in the app and no on-screen explanation.
 *
 * The two floors below exist because raising the ceiling alone does not fix
 * this: HALF's OWN fraction (`375 * 0.45 = 169`) is what is too small on a
 * short viewport, independent of any ceiling, and a ceiling raised without
 * also floor-and-stepping HALF just lets HALF float up to meet FULL at the
 * SAME raised ceiling — a collapse one detent later. `ACTIVITY_FLOOR_PX` is
 * the minimum HALF may ever be, sized to physically hold a graded activity's
 * prompt, its answers and the Check control; `DETENT_STEP_PX` is the minimum
 * gap the code guarantees between every adjacent pair. Both are enforced
 * structurally (HALF is clamped to `ceiling - DETENT_STEP_PX`, FULL is
 * clamped to `[half + DETENT_STEP_PX, ceiling]`), not by picking numbers that
 * happen to work for two named devices, so PEEK < HALF < FULL by a real
 * margin at every viewport height, not only the ones measured here.
 *
 * `MIN_STAGE_RESERVE_PX` is the floor on the OTHER side: even the shortest
 * viewport this trades room from must never be asked to give up literally
 * everything above the sheet.
 *
 * NONE of this changes the /DESIGN.md `sheet-detents` token (`{peek: 88px,
 * half: 45vh, full: 88vh}`) on a portrait phone or a desktop-height viewport:
 * `Math.max(viewport - STAGE_RESERVE_PX, ...)` keeps the original 300px
 * reserve wherever it already produced a bigger ceiling than the new floor
 * needs (measured: 375x812 still yields exactly half=365, full=512, byte for
 * byte, and so does the 1280x900 desktop-height case). Only a viewport short
 * enough that 300px would have swallowed the whole screen gives up part of
 * that reserve — a landscape phone genuinely does not have 300px of stage to
 * spare above an 88px PEEK and still leave room for the one surface the
 * activity actually lives on.
 */
const MIN_STAGE_RESERVE_PX = 24;
const ACTIVITY_FLOOR_PX = 240;
const DETENT_STEP_PX = 100;

/**
 * `StageShell.tsx`'s own `DOCK_GAP_PX`, mirrored rather than imported.
 *
 * The dock (the microphone orb, and the composer sharing its row) rides
 * `bottom: sheetFootprint + DOCK_GAP_PX` — see `StageShell.tsx` and
 * `onFootprint` below — so this file's ceiling arithmetic needs the same
 * number to know how much room the dock actually needs above the sheet.
 * Not a live import: `StageShell.tsx` pulls in the full 3D stage
 * (`TutorStage`, react-three-fiber, the GLB pipeline), and this file's own
 * test suite (`LessonPlate.test.tsx`) exercises `detentHeights()` as plain
 * arithmetic with no renderer at all — importing the stage to reuse one
 * constant would make that impossible. Keep the two literals in sync by
 * hand; each file pins its own value in its own tests.
 */
const MIC_DOCK_GAP_PX = 12;

/**
 * Found by adversarial review, round 91 (2026-08-31, HIGH). `StageShell.tsx`
 * does not lay the microphone dock out against fixed chrome: it reads the
 * sheet's own published footprint (`onFootprint`, below) and sets its
 * `bottom` CSS property to `footprint + DOCK_GAP_PX`, with nothing clamping
 * how far that can push it. So the dock never overlaps the sheet — it is
 * shoved by it, unconditionally, and round 88's ceiling only ever asked "is
 * there room for a real step between HALF and FULL", never "is there still
 * room for the thing riding above FULL".
 *
 * Measured live on `/dev/tutor-lab`, conversing phase, an activity open, at
 * 667x375 (iPhone SE landscape) with the sheet dragged to FULL:
 * `getBoundingClientRect()` on the mic orb read `top: -89, bottom: 7` — 89 of
 * its 96px were off the TOP of the viewport — and the composer's input read
 * `top: -63, bottom: -19`, entirely negative and entirely invisible. Round
 * 88's own fix was real and is untouched by this one: at HALF on the same
 * viewport the orb measured `top: 11`, safely on screen. FULL is what grew
 * past what the dock needs.
 *
 * `DOCK_CLEARANCE_PX` is that real minimum: the orb's own height
 * (`MIC_ORB_SIZE_PX`, the tallest thing in the shared mobile row — see
 * `MicOrb.tsx`) plus the sheet's own bottom inset (`SHEET_INSET_PX`) plus the
 * dock's own gap above it (`MIC_DOCK_GAP_PX`). It covers the ORDINARY dock —
 * the orb sharing a row with the composer, no adaptation offer — which is
 * the only content the dock can carry while the sheet is actually visible:
 * an offer stands the sheet down entirely (`standDown`, below), so the two
 * never compete for the same pixels.
 */
export const DOCK_CLEARANCE_PX = MIC_ORB_SIZE_PX + SHEET_INSET_PX + MIC_DOCK_GAP_PX;

type DetentHeights = Record<LessonPlateDetent, number>;

/**
 * Exported for direct testing, the same reason `nearestDetent` is: this is
 * pure arithmetic over `window.innerHeight`, and a real assertion needs to
 * drive it at specific viewport heights (a landscape phone, a portrait one)
 * rather than trust a live `matchMedia`/layout pass in jsdom to reproduce one.
 */
export function detentHeights(): DetentHeights {
  // 812 is a phone, and it is only ever used where there is no window at all
  // (a server render, a test). Every real caller measures.
  const viewport = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 812;

  // The ceiling: the original 300px-reserved target, UNLESS the viewport is so
  // short that target would leave less than a real HALF+FULL pair can use —
  // in which case the reserve shrinks, down to a hard floor of
  // `MIN_STAGE_RESERVE_PX` above the sheet.
  const ceiling = Math.max(
    PEEK_PX,
    Math.min(
      viewport - MIN_STAGE_RESERVE_PX,
      Math.max(viewport - STAGE_RESERVE_PX, ACTIVITY_FLOOR_PX + DETENT_STEP_PX),
    ),
  );

  /*
   * ROUND 91: neither detent may grow into the room the microphone dock
   * actually needs above the sheet — see `DOCK_CLEARANCE_PX`. `ceiling` above
   * only ever reasoned about HALF and FULL against each other; this reasons
   * about the dock against whichever of them ends up tallest. It can only
   * ever tighten `ceiling` further, never loosen it, so a viewport where the
   * 300px reserve was already generous enough (a portrait phone, a desktop
   * height) is completely unaffected — `viewport - DOCK_CLEARANCE_PX` only
   * binds once `ceiling` has already been pulled down near the short-viewport
   * floor above.
   */
  const dockSafeCeiling = Math.max(PEEK_PX, Math.min(ceiling, viewport - DOCK_CLEARANCE_PX));

  /*
   * HALF: the /DESIGN.md fraction, floored so it is never a sliver on a short
   * viewport. Capped a full step below `dockSafeCeiling` so FULL normally has
   * a real step of its own left to open into — UNLESS that would push the cap
   * below `ACTIVITY_FLOOR_PX`, which is what `dockSafeCeiling` being tighter
   * than a plain `ceiling` can now do on the shortest landscape phones. The
   * activity floor wins that conflict: a HALF too small to hold a graded
   * activity is the exact defect round 88 fixed, and it outranks FULL getting
   * a full 100px step over it. `Math.min(dockSafeCeiling, ...)` still bounds
   * the whole expression, so HALF itself never exceeds what the dock needs
   * either.
   */
  const halfCap = Math.min(dockSafeCeiling, Math.max(dockSafeCeiling - DETENT_STEP_PX, ACTIVITY_FLOOR_PX));
  const half = Math.max(
    PEEK_PX,
    Math.min(halfCap, Math.max(ACTIVITY_FLOOR_PX, Math.round(viewport * HALF_FRACTION))),
  );

  /*
   * FULL: the /DESIGN.md fraction, floored to HALF's own height plus a real
   * step (not HALF's pre-floor fraction — that is what let the two collapse
   * together right at the boundary where the fraction alone had just cleared
   * the floor), and capped at `dockSafeCeiling` rather than the plain
   * `ceiling` — this is the actual fix: FULL may no longer grow into the
   * dock's own reserve.
   *
   * The outer floor is `half + 1`, not `half`, and only the `+ 1` is new.
   * `dockSafeCeiling` can itself equal `half` on a viewport shorter than any
   * phone this product targets (the sweep test below stress-tests down to
   * 350, ten pixels under the shortest supported device, on purpose) — at
   * that extreme, honouring the dock reserve exactly would collapse FULL onto
   * HALF, which is the identical-detents defect round 88 closed. A one-pixel
   * intrusion into the dock's reserve, only below the shortest device this
   * product supports, is the smaller of the two failures.
   */
  const full = Math.max(
    half + 1,
    Math.min(dockSafeCeiling, Math.max(half + DETENT_STEP_PX, Math.round(viewport * FULL_FRACTION))),
  );

  return { peek: PEEK_PX, half, full };
}

function sameHeights(a: DetentHeights, b: DetentHeights): boolean {
  return a.peek === b.peek && a.half === b.half && a.full === b.full;
}

/** The detent a released drag should settle into. */
export function nearestDetent(heightPx: number, heights: DetentHeights): LessonPlateDetent {
  let best: LessonPlateDetent = 'peek';
  let bestDistance = Infinity;
  for (const detent of LESSON_PLATE_DETENTS) {
    const distance = Math.abs(heights[detent] - heightPx);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = detent;
    }
  }
  return best;
}

function step(detent: LessonPlateDetent, direction: 1 | -1): LessonPlateDetent {
  const index = LESSON_PLATE_DETENTS.indexOf(detent);
  const next = Math.min(LESSON_PLATE_DETENTS.length - 1, Math.max(0, index + direction));
  return LESSON_PLATE_DETENTS[next] ?? detent;
}

/**
 * Whether the plate is in its desktop form.
 *
 * A media query rather than a Tailwind breakpoint, because the two forms differ
 * in BEHAVIOUR and not only in styling: one is dragged and reports a footprint,
 * the other is fitted to its content and reports none. Styling both and hiding
 * one would mount two plates, publish two rectangles, and leave the camera
 * composing around a sheet nobody can see.
 *
 * Exported because the personalization plate takes the same corner at the same
 * breakpoint and has the same two behaviours: in the corner it stands beside
 * the microphone, and below `lg:` the microphone has to ride above it. A second
 * media-query hook a hundred lines away is how two surfaces come to change form
 * at different widths.
 */
export function useDesktopPlate(): boolean {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.(DESKTOP_QUERY).matches ?? false),
  );

  useEffect(() => {
    const query = typeof window !== 'undefined' ? window.matchMedia?.(DESKTOP_QUERY) : undefined;
    if (!query) return;
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return desktop;
}

export interface LessonPlateProps {
  /** Accessible name for the whole surface. It is a landmark on this route. */
  label: string;
  /** Accessible name for the drag handle. */
  resizeLabel: string;
  /** Where the sheet rests. Ignored on desktop, where the plate fits content. */
  detent: LessonPlateDetent;
  onDetentChange: (next: LessonPlateDetent) => void;
  /**
   * How much of the bottom of the viewport this surface occupies right now,
   * including its own inset, in CSS pixels. Zero on desktop, where it sits in
   * the corner and nothing needs to ride above it.
   *
   * Called on EVERY frame of a drag, so the receiver must write a style or a
   * ref and must never call `setState`. It is how the microphone cluster stays
   * above the sheet while the sheet is moving under the learner's thumb.
   */
  onFootprint?: (px: number) => void;
  /**
   * Whether this plate is holding the bottom-RIGHT corner at this instant.
   *
   * The sibling of `onFootprint`, for the other axis: that one says how much of
   * the bottom EDGE is taken and is called on every frame of a drag; this one
   * says whether the corner is occupied at all and changes at most once per
   * phase or breakpoint, so it is allowed to be state on the other side.
   *
   * It exists because the shell used to derive the same fact from the PHASE,
   * and a phase cannot see either of the two things that actually decide it:
   * whether this plate is in its desktop form, and whether it has stood down.
   * An adaptation question is still the `conversing` phase with the plate
   * `display: none`, and the dock went on clearing 480 px of empty island for
   * it (`StageDockValue.setCornerPlate`).
   */
  onCornerHeld?: (held: boolean) => void;
  /**
   * Get out of the way completely, without forgetting anything.
   *
   * For the one moment on this route that is not a lesson: the tutor has asked
   * a yes-or-no and is waiting (`ConversationView`). The sheet is the last
   * surface between the question and the island, and at 375 px its resting row
   * is 88 px plus a 16 px inset of a screen the whole point of which is that
   * the island is the page.
   *
   * HIDDEN, NOT UNMOUNTED, and the difference is the learner's half-finished
   * exercise. React keeps the state of a hidden subtree and throws away the
   * state of an unmounted one, so standing down has to be a style and an
   * `inert`, never a `&&` at the call site. It publishes a footprint of ZERO
   * while it is down, so the microphone dock drops to its own resting inset
   * instead of floating above a sheet that is not there — the same failure the
   * ref-callback release below exists to prevent, arriving from the other
   * direction.
   */
  standDown?: boolean;
  /** Sits in the non-scrolling row beside the handle, so it survives any detent. */
  header?: ReactNode;
  /**
   * The NEWS the resting sheet carries, when there is any.
   *
   * Optional, and usually absent, which is the correction of 2026-08-22. It
   * used to be supplied unconditionally and said "Conversation" when nothing
   * had happened — naming the screen the learner is standing on. Without it the
   * row is a grab bar and a chevron, which is a complete statement: this opens.
   * With it the row says the one thing the learner cannot read anywhere else,
   * which today is that an activity has arrived.
   */
  peekLabel?: string;
  /**
   * The same news, announced politely, while the sheet is at PEEK.
   *
   * Separate from `peekLabel` because the two have different jobs: the label is
   * a control's name and stays imperative, this is a sentence about what
   * changed. It exists because the body — and with it the transcript's live
   * region — is not mounted at PEEK, so an activity arriving would otherwise be
   * a purely visual event for a learner who is not looking at the sheet.
   */
  peekStatus?: string;
  /**
   * Where ONE TAP on the resting row lands, when the row is carrying news.
   *
   * The row's default is to step up one detent, which is right when the learner
   * is simply opening the sheet to look. It is wrong when the row says an
   * ACTIVITY IS WAITING: HALF is 45% of a phone, and after the plate's own
   * header and the pinned check control that left about 90 px for the exercise
   * itself (measured at 375x812) — so the one tap the row invites lands the
   * learner somewhere they still cannot work, and they have to discover a
   * second gesture. A control that announces something should open far enough
   * to act on it.
   *
   * Only consulted while the sheet is RESTING and `peekLabel` is set, so the
   * ordinary "open the sheet" tap is untouched.
   */
  peekOpensTo?: LessonPlateDetent;
  /**
   * How the body is laid out — and it decides WHAT SCROLLS.
   *
   * `scroll` (the default, and every caller that has not asked otherwise) makes
   * the body one scroller with the children stacked inside it. Simple, and
   * correct for a plate whose content is prose.
   *
   * `column` makes the body a non-scrolling flex column and hands the scrolling
   * to ONE child. That is what a plate carrying an EXERCISE needs, and the
   * difference is measurable rather than stylistic. In `scroll` the prompt, the
   * answers, the check control and the conversation log are one tall strip: a
   * learner reaching the last option scrolls the question they are answering off
   * the top, and on the 14 of 55 exercise types that do not fit a 420 px plate
   * they scroll the `Check` control out of the frame as well. Measured at
   * 1280x800: `read_chart` needs 817 px of prompt-plus-answers against 540 px of
   * plate. In `column` the question is pinned above and the action is pinned
   * below, so what scrolls is the answers, between two things that never move.
   *
   * The caller owns the arithmetic: exactly ONE child may be `flex-auto
   * min-h-0` with its own scroller, and the rest must be `shrink-0`.
   */
  bodyLayout?: 'scroll' | 'column';
  children: ReactNode;
  className?: string;
}

export function LessonPlate({
  label,
  resizeLabel,
  detent,
  onDetentChange,
  onFootprint,
  onCornerHeld,
  standDown = false,
  header,
  peekLabel,
  peekStatus,
  peekOpensTo,
  bodyLayout = 'scroll',
  children,
  className,
}: LessonPlateProps) {
  const desktop = useDesktopPlate();
  const safeArea = useSafeArea();

  const nodeRef = useRef<HTMLElement | null>(null);
  const [heights, setHeights] = useState<DetentHeights>(detentHeights);

  const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number; moved: boolean } | null>(
    null,
  );
  // A drag that ends over the handle also fires a click. Without this, letting
  // go always cycled the detent on top of the snap the drag had just chosen.
  const suppressClickRef = useRef(false);

  // Held in a ref so the publisher below does not have to depend on the
  // caller's callback identity, which changes on every render of the layer.
  const onFootprintRef = useRef(onFootprint);
  onFootprintRef.current = onFootprint;

  const publishFootprint = useCallback(
    (heightPx: number) => {
      // A sheet that is standing down occupies nothing, so the dock drops back
      // to its own resting inset rather than riding above a surface nobody can
      // see. Same channel, same ref, no re-render.
      onFootprintRef.current?.(desktop || standDown ? 0 : heightPx + SHEET_INSET_PX);
    },
    [desktop, standDown],
  );

  /*
   * The measured node belongs to two owners: this component needs it to write
   * heights, and `SafeAreaContext` needs it to publish rectangles. The safe
   * area's callback is stable per SLOT, so this merge only changes identity
   * when the plate changes form, which is exactly when the old slot should be
   * cleared and the new one filled.
   */
  const measure = safeArea?.measure(desktop ? 'lesson' : 'sheet');
  const attach = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      // A sheet standing down publishes no rectangle either: the camera must
      // compose into the room it has just given back, not around a box that is
      // `display: none`. And it leaves the tab order with it — React 18.3 has
      // no `inert` prop, so it is a DOM assignment, as in `ScreenAnchor`.
      if (node) node.inert = standDown;
      measure?.(standDown ? null : node);

      /*
       * AND THE DOCK'S EDGE IS RELEASED HERE, IN THE REF, NOT IN AN UNMOUNT
       * EFFECT — which is where it was written first, and which measured wrong
       * on `/dev/tutor-lab` at 375x812.
       *
       * The bug it fixes is real: leaving a conversation left the dock's inline
       * `bottom` at the sheet's last footprint with no sheet under it, so the
       * microphone floated a third of the way up the screen over empty island
       * on the introduce and goodbye phases. Nothing published zero, because
       * the only publisher had just unmounted.
       *
       * The reason it cannot be an unmount effect is the phase order. React
       * detaches a removed tree's refs during the MUTATION phase and runs its
       * passive cleanups AFTER the next tree's refs have already attached — and
       * the personalization plate claims the same edge from a ref callback. A
       * release in a cleanup therefore ran last and wiped a claim that was
       * already correct: measured on the lab, moving from a conversation to the
       * picker put the microphone back on top of the picker's own plate. Here
       * the release lands in the same phase as the claim, and deletions are
       * processed before insertions, so whoever arrives next has the last word.
       */
      if (!node) onFootprintRef.current?.(0);
    },
    [measure, standDown],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      const next = detentHeights();
      setHeights((previous) => (sameHeights(previous, next) ? previous : next));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /*
   * The camera has to know where this is from the first frame it exists, not
   * from the first frame somebody drags it. A LAYOUT effect, deliberately:
   * `standDown` flipping back (the learner just answered an adaptation offer)
   * makes the sheet reappear in the same commit, and a passive effect
   * republished the footprint one paint LATER — so for those frames the dock
   * sat at its resting inset with the sheet already over it, and the 300 ms
   * bottom transition stretched the collision into something a person sees.
   * Before paint, the dock never has a frame with a stale floor.
   */
  useLayoutEffect(() => {
    publishFootprint(heights[detent]);
  }, [publishFootprint, heights, detent]);

  /*
   * The corner claim, and it is a PASSIVE EFFECT rather than the ref callback
   * the footprint uses — deliberately, and for the reason the ref callback
   * documents in reverse.
   *
   * The footprint has to be released in the mutation phase because two
   * surfaces hand the same bottom EDGE to each other across a phase change, and
   * a passive cleanup would land after the newcomer's ref had already claimed
   * it. Passive effects have the opposite ordering guarantee: React runs every
   * unmount cleanup in a commit before any mount effect in the same commit, so
   * a plate leaving cannot wipe the claim of the plate arriving. And unlike the
   * edge, the corner is not written during a drag, so it costs one render per
   * change rather than sixty per second.
   */
  const onCornerHeldRef = useRef(onCornerHeld);
  onCornerHeldRef.current = onCornerHeld;
  const holdingCorner = desktop && !standDown;
  useEffect(() => {
    const publish = onCornerHeldRef.current;
    publish?.(holdingCorner);
    return () => publish?.(false);
  }, [holdingCorner]);

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const node = nodeRef.current;
    if (desktop || !node) return;
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: node.getBoundingClientRect().height || heights[detent],
      moved: false,
    };
    // The settled height animates; a dragged one must not, or the sheet lags
    // the thumb by the length of the transition.
    node.style.transition = 'none';
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const node = nodeRef.current;
    if (!drag || !node || drag.pointerId !== event.pointerId) return;

    const delta = drag.startY - event.clientY;
    if (Math.abs(delta) > DRAG_SLOP_PX) drag.moved = true;
    const next = Math.min(heights.full, Math.max(heights.peek, drag.startHeight + delta));
    node.style.height = `${next}px`;
    publishFootprint(next);
  };

  const onHandlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const node = nodeRef.current;
    if (!drag || !node || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    suppressClickRef.current = drag.moved;
    node.style.transition = '';

    const settled = nearestDetent(node.getBoundingClientRect().height || heights[detent], heights);
    // Written here as well as through the style prop below: when the drag ends
    // on the detent it started from there is no re-render, and the imperative
    // height from the last pointermove would otherwise stay where the thumb
    // left it.
    node.style.height = `${heights[settled]}px`;
    publishFootprint(heights[settled]);
    if (settled !== detent) onDetentChange(settled);
  };

  const onHandleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (desktop) return;
    const next =
      event.key === 'ArrowUp'
        ? step(detent, 1)
        : event.key === 'ArrowDown'
          ? step(detent, -1)
          : event.key === 'Home'
            ? 'peek'
            : event.key === 'End'
              ? 'full'
              : null;
    if (!next) return;
    // A sheet that can only be resized by dragging is a sheet a keyboard user
    // cannot resize at all, and at PEEK that hides the activity from them.
    event.preventDefault();
    if (next !== detent) onDetentChange(next);
  };

  /**
   * The sheet is a summary row rather than a panel right now.
   *
   * Only ever true on a phone: the desktop plate has no detents at all, and a
   * corner plate that collapsed itself to one line would be hiding the lesson
   * on the breakpoint where there is room for everything.
   */
  const resting = !desktop && detent === 'peek';

  const onHandleClick = () => {
    if (desktop) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // A resting row that is ANNOUNCING something opens far enough to act on it.
    if (resting && peekLabel && peekOpensTo) {
      onDetentChange(peekOpensTo);
      return;
    }
    onDetentChange(detent === 'full' ? 'peek' : step(detent, 1));
  };

  return (
    <HudPlate
      as="aside"
      shape="sheet"
      /*
       * `none` because the plate is a COLUMN with a pinned header and a
       * scrolling body, and HudPlate's own content slot is a centred flex row
       * sized for a label. It is NOT a way out of the material: the frame is
       * `.lf-lumen .lf-lumen-reading` (a `sheet` defaults to the reading
       * density), which is where the contrast comes from.
       *
       * THE OPAQUE `bg-surface` CORE THAT USED TO BE IN HERE IS GONE, and it is
       * the last one on the route. It was written under the opaque-floor rule
       * of 2026-08-21 and outlived it by a day: with the material underneath it
       * doing the work, all the core did was paint over the island — so the one
       * surface a learner spends a whole conversation looking at was the one
       * surface the island could not be seen through. At the reading alpha the
       * ratio is 4.96:1 in light and 7.2:1 in dark for muted body text, which is
       * the bound §Lumen states and `HudPlate.test.tsx` re-derives.
       */
      floor="none"
      aria-label={label}
      ref={attach}
      /*
       * THE WIDTH IS PINNED IN PIXELS, not left to `HudPlate`'s `44ch` reading
       * measure, and that is a correction made from a measurement rather than a
       * preference. `ch` is the width of a zero in whatever font has actually
       * loaded: with Inter it lands near the 420 px token, and against the
       * fallback face the same class measured 444 px in a live browser. A
       * design token that drifts by 24 px depending on whether a webfont has
       * arrived is not a token, and 420 px is a number /DESIGN.md states
       * outright.
       */
      /*
       * `display: none` INLINE while standing down, not a `hidden` class.
       * `[hidden] { display: none }` is a user-agent rule and the frame carries
       * `flex` from an author stylesheet, so the attribute alone paints the
       * sheet anyway — the same trap `ScreenAnchor` documents for anchored
       * nodes, arrived at independently by two different surfaces on this
       * route. An inline style wins outright.
       */
      style={{
        maxWidth: desktop ? 'min(25.625rem, 34vw)' : 'calc(100vw - 2rem)',
        height: desktop ? undefined : heights[detent],
        /*
         * IT FLOATS AGAIN (2026-09-06, owner direction), and the two square
         * corners go with the dock. The panel was full-height and flush to the
         * right edge — an owner decision from 2026-08-28, made against a
         * floating CORNER plate that had its content folded away. The Stitch
         * study answers the same question a third way: a floating card that is
         * neither full-height nor folded, with the stage visible under and
         * behind it, and the owner has now chosen that. A card that floats has
         * four corners.
         */
        ...(standDown ? { display: 'none' } : {}),
      }}
      // Out of the accessibility tree, and out of the tab order with it (the
      // `inert` half is set on the node itself in `attach` — React 18.3 has no
      // `inert` prop, exactly as `ScreenAnchor` records).
      aria-hidden={standDown ? true : undefined}
      className={cn(
        'pointer-events-auto fixed z-30 flex w-full flex-col overflow-hidden',
        /*
         * ONE SURFACE AT BOTH WIDTHS AGAIN (2026-09-12).
         *
         * Desktop used to be a COLUMN OF CARDS — the frame stopped painting,
         * through a rail-bare class in index.css that is deleted with this
         * change, and each zone inside carried its own Lumen, because there
         * were three of them: the
         * activity, the transcript and the composer. There is one now. The
         * transcript is a section of the session menu and the composer has one
         * home in the dock, so the plate holds the board and nothing else — and
         * a bare frame around a single card is a material that exists to
         * separate things that are no longer there.
         *
         * It is also not optional. Photographed at 1280x900 the moment the
         * cards came out: the question, its three options and the Check control
         * were painting straight onto the 3D scene, with the companion
         * character showing through the middle of the answers. The plate's own
         * Lumen is what makes a reading surface legible over a moving island —
         * `HudPlate.test.tsx` re-derives the contrast bound it guarantees.
         */
        desktop
          ? /*
             * A DOCKED FULL-HEIGHT PANEL (owner sign-off 2026-08-28), replacing
             * the floating bottom-right corner plate. The owner's feedback was
             * that the floating plate — content-fitted, transcript folded, the
             * conversation living in a corner — read as disorganised: on the
             * one breakpoint with room for everything, the conversation, the
             * activity and the composer should simply BE there, side by side
             * with the stage. The island keeps ~66-70% of the width, the camera
             * composes the character into it (this panel publishes its rect on
             * the `lesson` safe-area slot exactly as the corner plate did), and
             * the microphone dock already steps left of the corner claim
             * (`StageShell` → `besidePlate`). What is deliberately KEPT from
             * the rejected two-panel split's post-mortem: the panel is Lumen
             * material over the island, never an opaque slab, and the stage is
             * never squeezed into a half-width cell — the canvas stays
             * full-bleed underneath.
             */
            /*
             * The study's own geometry: a 380px card (410 at `xl`) inset from
             * the top-right corner, capped so it can never reach the
             * microphone dock at the bottom of the frame. `top-20` clears the
             * header row of chips above it.
             */
            /*
             * A DEFINITE HEIGHT, not `max-h`, and that is the whiteboard's
             * requirement rather than a taste. Several boards draw their bars
             * with `height: N%`, which resolves against a DEFINITE parent
             * height and collapses to zero pixels without one — the failure
             * /AGENTS.md §5 already names for `sequence` and `CategoriesBoard`.
             * Floating the card with `max-h` made it content-sized, and
             * `verify:tutor-ui` immediately reported 3/3, 2/2 and 3/3 bars at
             * zero across whiteboard, compare and categories. It still floats:
             * inset from the corner, four rounded corners, stage visible
             * around and behind it.
             */
            /*
             * CAPPED AT 34rem (2026-09-12), and still DEFINITE.
             *
             * The full `calc(100vh-11rem)` was right while the card held three
             * zones — a board, a transcript and a composer stacked down it. It
             * holds one now, and a three-option quiz in a 724 px column left
             * about 400 px of empty Lumen between the last answer and the Check
             * control: the same "panel with nothing in it" this branch was
             * meant to cure, wearing a different shape.
             *
             * `min()` of two lengths is still a LENGTH, so every percentage bar
             * inside keeps the definite containing block the comment above says
             * it cannot live without — which is why this is a cap and not the
             * `max-h` that put 3/3, 2/2 and 3/3 bars at zero. A board taller
             * than the cap scrolls in the body's own scroller, with the edge
             * cue that says so.
             */
            'right-4 top-20 h-[min(calc(100vh-11rem),34rem)] xl:right-6'
          : 'inset-x-0 bottom-4 mx-auto motion-safe:transition-[height] motion-safe:duration-300 motion-safe:ease-[var(--lf-ease)]',
        className,
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[inherit] text-content">
        {/*
          THE ROW ONLY EXISTS IF IT HAS SOMETHING IN IT (2026-09-06).
          On desktop the session chips moved out to the shell's own header row,
          which left this one holding nothing and still paying its padding and
          its rule — photographed as an empty 40px bar across the top of the
          card. Below `lg:` the row is the DRAG HANDLE and is never empty, so
          the condition is desktop-only.
        */}
        {(!desktop || header) && (
        <div
          className={cn(
            'flex shrink-0 items-center gap-2 px-2 pt-2 lg:px-3 lg:pt-3',
            // At PEEK the row IS the sheet, so it takes the whole height and
            // centres itself in it rather than sitting at the top of 88 px of
            // empty surface.
            resting && 'h-full pb-2',
            /*
             * A RULE UNDER THE HEADER, desktop only. The docked panel is one
             * continuous fill from the minutes chip down to the composer, with
             * nothing marking where the header ends and the conversation
             * begins — photographed on 2026-09-05 next to the design study,
             * whose own board separates every zone with a hairline
             * (`border-b border-white/10`) at half the strength of its outer
             * edge. `content/10` is the ink-based equivalent: on this dark
             * glass `--lf-content` resolves near-white, so it reads as the
             * same soft light seam.
             *
             * Not applied on mobile: there the row IS the drag handle, and its
             * own grip bar already reads as the seam between "closed" and
             * "open" — a second line under it would be a second divider for
             * one boundary.
             */
            desktop && !resting && 'border-b border-content/10 pb-2 lg:pb-3',
          )}
        >
          {!desktop && (
            <button
              type="button"
              /*
               * The visible words come FIRST and the resize sentence after
               * them. A control whose spoken name omits its printed label
               * breaks voice control, and a control announced only as "make
               * this panel bigger" never mentions that an activity is waiting
               * inside it.
               */
              aria-label={resting && peekLabel ? peekLabel + ' ' + resizeLabel : resizeLabel}
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
              onKeyDown={onHandleKeyDown}
              onClick={onHandleClick}
              // `touch-none` or the browser scrolls the page instead of giving
              // us the pointermove stream, and the sheet simply will not move.
              className={cn(
                'flex min-h-11 flex-1 cursor-grab touch-none items-center rounded-md lf-focus',
                resting ? 'gap-2 px-2 text-left' : 'justify-center',
              )}
            >
              {/*
                THE CHEVRON IS ALWAYS THERE WHILE THE SHEET RESTS, AND THE WORDS
                ARE NOT.

                It used to be the other way round: the row printed
                "Conversation" whenever nothing was waiting — the name of the
                screen the learner is already standing on, which is the one
                thing a label may never be (/DESIGN.md §Lumen → What to delete).
                What the row actually has to do is say that it OPENS, and a
                chevron over a grab bar says that without a word in any locale.
                When there IS something to say — an activity has arrived — the
                row says that instead, which is the only news it ever carries.
              */}
              {resting ? (
                <>
                  <span aria-hidden="true" className="flex shrink-0 flex-col items-center gap-1">
                    <span className="h-1 w-8 rounded-full bg-content/25" />
                    <Icon name="keyboard_arrow_up" className="!text-[20px]" />
                  </span>
                  {/* Wraps to a second line rather than truncating: this label
                      swings by more than 1.8x across our three locales. */}
                  {peekLabel && <span className="lf-action min-w-0 text-content">{peekLabel}</span>}
                </>
              ) : (
                <span aria-hidden="true" className="h-1 w-12 rounded-full bg-content/25" />
              )}
            </button>
          )}
          <div className={cn('flex items-center gap-2', desktop ? 'ml-auto' : 'shrink-0')}>{header}</div>
        </div>
        )}

        {/*
          Announced, not merely drawn. The body below is not mounted at PEEK, so
          its transcript log cannot carry this, and an activity arriving on a
          sheet nobody is looking at has to reach a learner who is listening.
        */}
        {resting && peekStatus && (
          <span role="status" className="sr-only">
            {peekStatus}
          </span>
        )}

        {/*
          `hidden` at PEEK, not merely clipped, and the two are different
          promises. Clipped content is still focusable and still announced from
          behind an 88 px window — a keyboard user tabs into an exercise nobody
          can see. Hidden content is neither, and React keeps its state, so a
          half-answered activity is exactly where the learner left it when they
          open the sheet again.
        */}
        <div
          hidden={resting}
          // The body is the thing a measurement script and a test both have to
          // find, and both used to find it by an accessible name that happened
          // to be inside it. A named seam beats a lucky landmark.
          data-plate-body=""
          /*
           * `display: none` INLINE, not the `hidden` attribute alone, and this
           * is the third surface on this route to learn it the same way.
           * `[hidden] { display: none }` is a 0-1-0 USER-AGENT rule, and in
           * `column` mode this element carries `flex` from an author
           * stylesheet, which beats it outright. Measured on `/dev/tutor-lab` at
           * 375x812 with the sheet resting at PEEK: the whole exercise was laid
           * out below the fold — three option buttons at y = 925, 986 and 1047 —
           * reporting `hidden === true` to every script that asked, focusable,
           * announced, and 200 px past the bottom of the phone. Exactly the trap
           * `ScreenAnchor` and `WorldChip` already record.
           */
          style={resting ? { display: 'none' } : undefined}
          className={cn(
            'min-h-0 flex-1',
            /*
             * DESKTOP HAS ITS OWN PADDING NOW. It was `p-0` because each card
             * inside the bare rail brought its own (`px-4 py-3.5`); with the
             * cards gone the board was painting flush to the plate's rounded
             * edge — its model-written label touching the top hairline and the
             * keep control against the right edge. The plate is the reading
             * surface, so the plate holds the measure.
             */
            desktop ? 'px-5 pb-5 pt-4' : 'px-4 pb-4 pt-2 lg:px-5 lg:pb-5',
            bodyLayout === 'column'
              ? // The body does not scroll; one child does. See `bodyLayout`.
                'flex flex-col gap-3 overflow-hidden'
              : 'space-y-3 overflow-y-auto overscroll-contain',
          )}
        >
          {children}
        </div>
      </div>
    </HudPlate>
  );
}
