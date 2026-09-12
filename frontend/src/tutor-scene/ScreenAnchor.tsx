import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { AnchorId } from './anchors';
import type { HudRect } from './composition';
import { isAnchorNodeVisible, stackClearance, type ViewportBox } from './culling';
import { clampThenEscape, escapeReserved, HUD_SURFACE_GAP_PX } from './hudSpace';
import { useSafeArea } from './SafeAreaContext';

/*
 * The projection ref channel: how a DOM node gets pinned to a place in the 3D
 * scene without React ever hearing about it.
 *
 * WHY DOM AT ALL. Text has to be DOM. Rendering a caption or a control into the
 * WebGL scene means giving up the screen reader, the text selection, the focus
 * ring, the browser's own font rendering and every locale that needs a glyph the
 * atlas does not have — for a stage whose copy exists in three languages, that
 * is not a trade, it is a regression. `SpeechCaption` already proves the DOM
 * layer costs nothing in accessibility.
 *
 * WHY A REF CHANNEL AND NOT STATE. A projected position changes every frame. A
 * `useState` holding it would re-render the subtree sixty times a second, and
 * `SceneCanvas` already carries the measurement that a per-frame React update
 * costs more than the scene it is measuring. So the projector writes
 * `el.style.transform` onto the node directly. Nothing above it re-renders,
 * ever, for any number of anchored nodes.
 *
 * WHY NAMED SLOTS INSTEAD OF COORDINATES. A component that holds a coordinate is
 * a component that holds a `Vector3`, and a component that holds a `Vector3`
 * imports `three` — which would drag the renderer out of the lazy route it is
 * deliberately confined to and into the entry bundle of every marketing page.
 * The DOM side of this file imports nothing heavier than a string union.
 *
 * CULLING IS NOT OPTIONAL. A point behind the camera projects to a perfectly
 * plausible on-screen position, mirrored through the origin. Without the check,
 * a chip anchored to a character the camera has turned away from sits somewhere
 * in the middle of the screen looking like a real control, and a keyboard user
 * can tab straight to it. Behind-camera and off-screen nodes get `hidden` AND
 * `inert`, set imperatively — React 18.3 has no `inert` prop, so it is a DOM
 * assignment, not JSX.
 *
 * AND IT IS CULLED AS A BOX, NOT AS A POINT. The projected position is the
 * node's CENTRE, so a test on that point alone lets a node hang half off the
 * frame while still counting as on screen. `culling.ts` carries the geometry
 * and the story of what that cost.
 *
 * IT ALSO KNOWS WHAT THE REST OF THE HUD HAS TAKEN. The frame edge is not the
 * only thing an anchored node can collide with: the way out, the microphone dock
 * and the lesson plate are laid out by CSS against the viewport and cannot see a
 * projected point, so at 375 px the greeting caption and the way-out chip both
 * claimed the top-left corner and the learner read half a sentence. Fixed chrome
 * publishes its rects through `SafeAreaContext`, and a node registered with
 * `avoid` is displaced out of them by the shortest move that stays in frame
 * (`hudSpace.ts`). Everything else keeps the old answer to being covered, which
 * is `WorldChip`'s: disappear.
 */

/** How long the smoothing takes to close most of a gap, in seconds. */
const FOLLOW_TAU = 0.09;

/**
 * How often the canvas rect and every visible node's box are re-read, in
 * seconds.
 *
 * Both are forced layouts, so they share one slow tick rather than happening
 * per node per frame. A quarter second is imperceptible for what actually
 * changes at this cadence: the page scrolling under the scene lab, and a plate
 * growing a line because the caption got longer.
 */
const MEASURE_INTERVAL_S = 0.25;

/**
 * Distance at which an anchored node renders at its authored size, in metres.
 *
 * Roughly a close-up's distance, so plates attached to a speaking character are
 * their natural size and everything further away is modestly smaller. The scale
 * exists to give the HUD depth, not to simulate perspective — a chip that
 * genuinely scaled with distance would be unreadable at the establishing shot.
 */
const REFERENCE_DISTANCE_M = 3;

/** The most a node may be enlarged when the camera is closer than the reference. */
const MAX_SCALE = 1.15;

/**
 * The floor under every depth scale, in CSS pixels of rendered text.
 *
 * "Scales with depth" is a pleasant idea that becomes "too small to read" at the
 * establishing shot without a hard stop, and a control nobody can read is a
 * control nobody can use. The floor is computed per node from its OWN font size,
 * so a caption and a small chip each stop shrinking at the point their own text
 * would become illegible rather than at one number that is wrong for both.
 */
const MIN_READABLE_PX = 12;

/**
 * The floor under an INTERACTIVE anchored node's rendered short side, in CSS
 * pixels.
 *
 * /DESIGN.md §Layout makes 44 px non-negotiable, and until this existed the
 * rule was enforced in the stylesheet and broken on the glass: `min-h-11` is
 * 44 px of layout, and the depth scale below then multiplied it by 0.75. The
 * number is the design floor exactly; the room a control needs in order to
 * still HAVE a depth cue comes from authoring it larger (HudPlate uses 48 px),
 * not from softening this.
 */
const MIN_TAP_PX = 44;

/**
 * Where an anchored node stands relative to the point it rides.
 *
 * `centre` is the original and still the default: the node's middle lands on the
 * point, which is what a chip naming a place wants.
 *
 * `above` stands the node's BOTTOM edge on the point, `HUD_SURFACE_GAP_PX` clear
 * of it, and it exists because the caption was faking it. The caption used to be
 * a `w-0 h-0` wrapper with the plate absolutely positioned upward out of it —
 * which worked visually and broke two things quietly. The projector measured the
 * wrapper, so the caption's half-extents were ZERO: its cull test was the centre
 * test this file's own comments say is not good enough, and there was no box to
 * test against the HUD at all. Making the placement a property of the anchor
 * gives the caption a real, measurable box again.
 */
export type AnchorPlacement = 'centre' | 'above';

interface AnchoredNode {
  element: HTMLElement;
  /** Smoothed viewport position in CSS pixels. */
  x: number;
  y: number;
  scale: number;
  /** False until the first projection, which snaps rather than easing in. */
  placed: boolean;
  /**
   * Smallest scale this node may be drawn at.
   *
   * The larger of two independent floors: its own text staying at
   * MIN_READABLE_PX, and — for a node a finger has to hit — its own box staying
   * at MIN_TAP_PX. The second is re-derived whenever the box is re-measured,
   * because a label that wraps to a second line in another locale is a
   * different control from the one that was registered.
   */
  minScale: number;
  /** The text floor alone, cached: the font size cannot change without a remount. */
  readableScale: number;
  placement: AnchorPlacement;
  /** True for a node that MOVES out of fixed HUD chrome instead of sitting under it. */
  avoid: boolean;
  /** True for a node that rises clear of other stacking nodes instead of onto them. */
  stack: boolean;
  /** True for a node that clamps back into the frame instead of being culled. */
  keepInFrame: boolean;
  /** The same, EXCEPT behind the camera, where it culls. See `clampToFrame`. */
  clampToFrame: boolean;
  /**
   * Half the node's own UNSCALED layout box, in CSS pixels.
   *
   * Zero until the node has been measured at a size, which reduces the cull
   * test to the old centre test for that node rather than guessing at a size.
   */
  halfWidth: number;
  halfHeight: number;
  culled: boolean;
}

interface AnchorRegistry {
  points: Map<AnchorId, readonly [number, number, number]>;
  nodes: Map<AnchorId, Set<AnchoredNode>>;
}

const AnchorContext = createContext<AnchorRegistry | null>(null);

/**
 * Holds the slot registry. Must sit ABOVE both the canvas and the HUD, because
 * both halves of the channel read it.
 *
 * React Three Fiber v8 bridges React context across its own reconciler root, so
 * a provider outside the `<Canvas>` is visible to components inside it. That is
 * what makes this a context rather than a module-level singleton: two stages on
 * one page (the scene lab has wanted this more than once) get two registries
 * instead of silently fighting over the same slot names.
 */
export function AnchorProvider({ children }: { children: ReactNode }) {
  const registry = useMemo<AnchorRegistry>(() => ({ points: new Map(), nodes: new Map() }), []);
  return <AnchorContext.Provider value={registry}>{children}</AnchorContext.Provider>;
}

/** The registry, or null where no provider is mounted. */
export function useAnchorRegistry(): AnchorRegistry | null {
  return useContext(AnchorContext);
}

/**
 * Publishes a world point under a named slot. Renders nothing.
 *
 * Lives INSIDE the Canvas, where scene-space coordinates are known and cheap.
 * Everything outside asks for the NAME.
 */
export function WorldAnchor({
  slot,
  point,
}: {
  slot: AnchorId;
  point: [number, number, number];
}): null {
  const registry = useAnchorRegistry();
  const [x, y, z] = point;

  useEffect(() => {
    if (!registry) return;
    registry.points.set(slot, [x, y, z]);
    return () => {
      registry.points.delete(slot);
    };
    // Depends on the three numbers rather than on `point`: a caller writing an
    // inline `[a, b, c]` builds a new array every render, which would tear the
    // registry entry down and rebuild it sixty times a second.
  }, [registry, slot, x, y, z]);

  return null;
}

/**
 * Returns a ref CALLBACK to put on the DOM node you want anchored.
 *
 * The node is positioned every frame by the projector. It never re-renders. When
 * the anchor is behind the camera, or when the node's own box no longer fits the
 * frame, it is hidden AND inert, so it cannot be seen, clicked or tabbed to. The
 * node is measured for that test, so give it a real box: a wrapper sized to its
 * content is measured correctly, a `w-0 h-0` wrapper with absolutely positioned
 * content is measured as a point and culls only when the POINT leaves.
 *
 * The node is positioned with `position: fixed` in VIEWPORT coordinates, which
 * makes it independent of whatever it happens to be nested inside. The one thing
 * that breaks it is a transformed ancestor, since that becomes the containing
 * block for a fixed child; the stage layer must not be transformed.
 */
export interface AnchorOptions {
  /** Where the node stands relative to the point. Defaults to `centre`. */
  place?: AnchorPlacement;
  /**
   * Move out of viewport-anchored HUD chrome rather than sitting under it.
   *
   * OFF BY DEFAULT, because for most anchored chrome the right answer to being
   * covered is to disappear: `WorldChip` hides itself, so a chip behind the
   * lesson plate stops being a tab stop the learner cannot see. The caption is
   * the exception the whole mechanism exists for — it is the deaf learner's
   * entire channel (/ORACLE.md §1 step 4), so it may never hide, which leaves
   * moving as the only answer available to it.
   */
  avoid?: boolean;
  /**
   * Rise clear of other stacking nodes rather than sitting on them.
   *
   * FOR A SET OF PEERS THAT NAME DIFFERENT THINGS, and for nothing else. The
   * personalization candidates are the case: four plates on four crowns the
   * camera routinely puts 50 px apart, at a size that has a readability floor
   * and therefore cannot shrink to match. Measured at 375x812, that was 7
   * mutual overlaps; at 1280x800, 2.
   *
   * It is opt-in because the answer is only right when the nodes are peers.
   * Lifting a caption off a chip would move the tutor's words away from the
   * tutor's head, and `avoid` (four directions, smallest move) is that node's
   * answer instead. Which nodes count as peers is decided by who asks, so two
   * unrelated families of chrome never start pushing each other around.
   */
  stack?: boolean;
  /**
   * Never disappear. Slide back into the frame instead of being culled.
   *
   * FOR THE SPEECH CAPTION AND NOTHING ELSE, and it closes a defect that was
   * measured rather than reasoned about. /DESIGN.md → Screen Recipes → Tutor
   * already states the rule — "a WorldChip hides, and the speech caption MOVES,
   * because it is the deaf learner's whole channel and may never hide" — and
   * `avoid` only ever implemented half of it. `avoid` escapes viewport-anchored
   * CHROME; nothing escaped the frame EDGE. So at 1280x800 in `conversing`, a
   * shot that fills the frame with the tutor's face puts the crown above the top
   * of the screen, the caption's box left the view, and the ordinary cull ran:
   * `hidden` and `inert`, measured live on `/dev/tutor-lab`. On desktop, for the
   * whole of every conversation, the tutor's words existed only inside the
   * lesson plate — and the plate rests CLOSED on a phone, so the same rule would
   * have taken the last copy away there too.
   *
   * Clamping is the smallest honest answer: the caption keeps following the
   * speaker's crown everywhere it can, and where the crown is off screen it
   * stops at the edge instead of leaving with it. It stays a per-node opt-in
   * because for everything else disappearing is CORRECT — a chip pinned to the
   * far side of the island belongs off screen when the island is, and a chip
   * pressed to the frame edge points at nothing.
   */
  keepInFrame?: boolean;
  /**
   * Slide back into the frame rather than disappearing — but still disappear
   * when the point goes behind the camera.
   *
   * THE WEAKER HALF OF `keepInFrame`, AND IT EXISTS FOR THE AUDITION. A
   * candidate's name plate rides that candidate's crown, and it is the surface
   * a learner taps to choose them (/ORACLE.md §10). Measured on
   * `/dev/tutor-lab` at 375x812 with the camera held still: Liruf's cluster
   * projected to x = 321 with a half-width of 55, so its right edge landed at
   * 376 against a 375 px viewport and the ordinary box cull removed it. **One
   * pixel**, and with it the candidate — hidden AND inert, on the one screen
   * whose entire job is choosing a tutor by looking at them. His cluster is the
   * widest because he is the current companion, so it carries the dismiss orb
   * beside the plate; a longer name in another locale reaches the same edge
   * without any orb at all.
   *
   * Clamping is right here for the reason it is wrong for a chip on a rim pad.
   * /DESIGN.md's rule against it — "a chip pressed flat against the frame edge
   * points at nothing" — is about a control naming a PLACE that has left the
   * picture. This one names a PERSON who is still standing in it, two
   * centimetres away, fully rendered. Sliding the plate 1 px inward keeps it
   * over its own character; culling it takes a candidate out of the audition.
   *
   * It is NOT `keepInFrame`, and the difference is the `behind` case: a
   * candidate the camera has turned past is genuinely not on screen, and
   * parking their name at the top of the frame would be a label for somebody
   * nobody can see. Behind the camera, this culls.
   */
  clampToFrame?: boolean;
  /**
   * The smallest this node's own text may RENDER at, in CSS pixels, once the
   * depth scale has been applied. Defaults to `MIN_READABLE_PX`.
   *
   * THE DEFAULT IS THE FLOOR FOR A LABEL AND IS THE WRONG FLOOR FOR A SENTENCE.
   * 12 px is where a two-word chip stops being readable, and every chip on this
   * layer is held well above it by the 44 px TAP floor anyway. The speech
   * caption has no tap floor — nobody presses it — so 12 was the only thing
   * under it, and /DESIGN.md §Lumen → Type calls exactly that size "not a size,
   * an apology" and has the stylesheet neutralise `lf-caption` on chrome to
   * stop it happening. The depth scale then reintroduced it on the one node the
   * same section calls "the largest type on the stage after the character".
   *
   * Measured on `/dev/tutor-lab` at 375x812 during an adaptation offer: the
   * two-shot stands the camera back far enough that the caption clamped to
   * exactly 12.0 px — smaller than the 13.7 px a world chip's label gets, and
   * smaller than the 15 px `lf-action` the material guarantees any chrome
   * caption — while the same tutor's question, one plate below it in the dock,
   * was 19 px. One speaker, two voices, and the primary one was the whisper.
   */
  minTextPx?: number;
}

export function useAnchorSlot(
  slot: AnchorId,
  options: AnchorOptions = {},
): (node: HTMLElement | null) => void {
  const registry = useAnchorRegistry();
  const attached = useRef<AnchoredNode | null>(null);
  // Destructured to PRIMITIVES before they reach the dependency list: a caller
  // writing an inline `{ place: 'above' }` builds a new object every render, and
  // a ref callback whose identity changed would detach and re-register the node
  // — losing its smoothing and flashing it at the origin — on every render.
  const place = options.place ?? 'centre';
  const avoid = options.avoid ?? false;
  const stack = options.stack ?? false;
  const keepInFrame = options.keepInFrame ?? false;
  const clampToFrame = options.clampToFrame ?? false;
  const minTextPx = options.minTextPx ?? MIN_READABLE_PX;

  return useCallback(
    (node: HTMLElement | null) => {
      const previous = attached.current;
      if (previous) {
        registry?.nodes.get(slot)?.delete(previous);
        // Leave the node in a sane state if it outlives its anchor — an element
        // released while culled would otherwise stay permanently hidden and
        // inert, which looks exactly like a component that failed to render.
        hide(previous.element, false);
        releaseProjection(previous.element);
        attached.current = null;
      }

      if (!node || !registry) return;

      /*
       * One computed-style read per node, at registration. It forces a layout,
       * which is why it happens here and never in the frame loop.
       */
      const fontSize = Number.parseFloat(window.getComputedStyle(node).fontSize);
      const readableScale = Number.isFinite(fontSize) && fontSize > 0 ? Math.min(1, minTextPx / fontSize) : 1;

      /*
       * The node's box, read in the same forced layout the font size already
       * costs. It has to happen BEFORE the node is hidden below: a hidden node
       * is `display: none` and measures zero, and a first cull decision taken
       * against a zero box is a decision taken against a point.
       */
      const width = node.offsetWidth;
      const height = node.offsetHeight;

      /*
       * THE DEPTH SCALE MAY NOT SHRINK A CONTROL BELOW THE TAP TARGET.
       *
       * The readability floor above protects TEXT and was quietly assumed to
       * protect the control around it. It does not, and the gap is measurable:
       * on `/dev/tutor-lab` at 375x812, `personalizing` rendered six buttons
       * under 44 px — "Talk with Dina" at 44x33, "Ask Liruf to head off" at
       * 36x36, "Move the sun to Dusk" at 56x33 — every one of them authored at
       * the 44 px minimum and every one of them multiplied down by its distance
       * from the camera. /DESIGN.md calls 44 px non-negotiable, and a control
       * that meets it in the stylesheet and misses it on the glass has met
       * nothing.
       *
       * The floor is applied to INTERACTIVE nodes only, and it is a floor on
       * the scale rather than a ban on scaling: a plate authored at 48 px can
       * still ride from 0.92 to 1.15 with the camera, which is the depth cue
       * this scale exists for, while never rendering under the minimum.
       */
      const minScale = Math.max(readableScale, tapFloor(node));

      claimProjection(node);
      // Hidden until the first projection: a node placed at 0,0 for one frame is
      // a control that flashes in the top-left corner of the stage on mount —
      // and a node whose slot is NEVER published stays there for good, which is
      // exactly what `hide` exists to make true rather than merely intended.
      hide(node, true);

      const entry: AnchoredNode = {
        element: node,
        x: 0,
        y: 0,
        scale: 1,
        placed: false,
        minScale,
        readableScale,
        placement: place,
        avoid,
        stack,
        keepInFrame,
        clampToFrame,
        halfWidth: width > 0 ? width / 2 : 0,
        halfHeight: height > 0 ? height / 2 : 0,
        culled: true,
      };

      let set = registry.nodes.get(slot);
      if (!set) {
        set = new Set();
        registry.nodes.set(slot, set);
      }
      set.add(entry);
      attached.current = entry;
    },
    [registry, slot, place, avoid, stack, keepInFrame, clampToFrame, minTextPx],
  );
}

/**
 * Projects every published slot and writes the result onto its nodes.
 *
 * Lives inside the Canvas. One `useFrame` for the whole HUD rather than one per
 * anchored node: the projection shares a camera, a canvas rect and a viewport
 * size, and re-reading those per node is the difference between a HUD that costs
 * nothing and one that costs a forced layout per control per frame.
 */
export function AnchorProjector() {
  const registry = useAnchorRegistry();
  const safeArea = useSafeArea();
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);

  const projected = useMemo(() => new Vector3(), []);
  const cameraPosition = useMemo(() => new Vector3(), []);
  // Mutated in place rather than rebuilt per slot: this runs sixty times a
  // second across every anchored node, and a fresh object per slot per frame is
  // garbage the GC collects in the middle of a camera move.
  const view = useRef<ViewportBox>({ left: 0, top: 0, width: 0, height: 0 });
  const measureAge = useRef(Infinity);

  /*
   * The fixed chrome, flattened once per CHANGE rather than once per frame.
   *
   * `chromeVersionRef` is bumped by the safe area whenever a measured rect
   * actually moved, so the array below is rebuilt when the dock lifts over a
   * sheet and at no other time. Rebuilding it per frame would allocate a fresh
   * array behind a 3D render for an answer that is identical 59 frames out of
   * 60, which is exactly the cost `SafeAreaContext` publishes into refs to avoid.
   */
  const reserved = useRef<HudRect[]>([]);
  const reservedVersion = useRef(-1);

  /*
   * Where the stacking nodes ended up THIS frame.
   *
   * One array, truncated rather than rebuilt: it is filled and emptied sixty
   * times a second behind a 3D render, and a fresh array per frame is garbage
   * the GC collects in the middle of a camera move — the same reasoning as
   * `view` above.
   */
  const stacked = useRef<HudRect[]>([]);

  useFrame((_, delta) => {
    if (!registry || registry.nodes.size === 0) return;

    stacked.current.length = 0;

    if (safeArea && safeArea.chromeVersionRef.current !== reservedVersion.current) {
      reservedVersion.current = safeArea.chromeVersionRef.current;
      reserved.current = [...safeArea.chromeRef.current.values()];
    }

    const dt = Number.isFinite(delta) && delta > 0 ? Math.min(delta, 0.1) : 0.016;

    // The canvas's own position on the page, re-read a few times a second. On
    // the real stage it is `fixed inset-0` and never moves; on the scene lab it
    // moves when the page scrolls.
    measureAge.current += dt;
    const remeasure = measureAge.current >= MEASURE_INTERVAL_S;
    if (remeasure) {
      measureAge.current = 0;
      const box = gl.domElement.getBoundingClientRect();
      view.current.left = box.left;
      view.current.top = box.top;
    }
    view.current.width = size.width;
    view.current.height = size.height;

    camera.getWorldPosition(cameraPosition);
    const follow = 1 - Math.exp(-dt / FOLLOW_TAU);

    for (const [slot, nodes] of registry.nodes) {
      if (nodes.size === 0) continue;
      const point = registry.points.get(slot);

      if (!point) {
        // A slot nobody has published is not an error — the cast has not been
        // placed yet, or this island has no such feature. It is simply not on
        // screen, and it must not be reachable.
        for (const entry of nodes) cull(entry);
        continue;
      }

      projected.set(point[0], point[1], point[2]);
      const distance = cameraPosition.distanceTo(projected);
      projected.project(camera);

      // z > 1 is behind the near plane. Such a point still projects to a
      // plausible x/y, mirrored through the origin, so this test is the only
      // thing separating "off screen" from "convincingly in the wrong place".
      const behind = projected.z > 1;
      const x = view.current.left + (projected.x * 0.5 + 0.5) * size.width;
      const y = view.current.top + (-projected.y * 0.5 + 0.5) * size.height;

      for (const entry of nodes) {
        if (behind && !entry.keepInFrame) {
          cull(entry);
          continue;
        }

        /*
         * Only nodes that are currently on screen are re-measured. A culled
         * node is `display: none` and reports zero, and a zero box reads as a
         * point — which un-culls it, which makes it measurable, which culls it
         * again, four times a second for as long as the camera is looking away.
         */
        if (remeasure && !entry.culled) measureBox(entry);

        const depthScale = distance > 1e-3 ? REFERENCE_DISTANCE_M / distance : MAX_SCALE;
        const scale = Math.min(MAX_SCALE, Math.max(entry.minScale, depthScale));

        const halfWidth = entry.halfWidth * scale;
        const halfHeight = entry.halfHeight * scale;
        // `above` hangs the node upward off the point, so its centre — the thing
        // both the cull test and the escape are about — is a whole node-height
        // and one gap higher than the point itself.
        const rise = entry.placement === 'above' ? HUD_SURFACE_GAP_PX + halfHeight : 0;

        /*
         * OUT FROM UNDER THE FIXED CHROME, BEFORE ANYTHING ELSE IS DECIDED.
         *
         * Applied to the TARGET rather than to the smoothed position on purpose:
         * the escape is a discontinuous choice between four directions, so a
         * node crossing the point where two of them cost the same would JUMP if
         * it were applied last. Displacing the target and letting the existing
         * follow do the work turns that jump into the same 90 ms ease as every
         * other move the camera makes.
         */
        let targetX = x;
        let targetY = y - rise;
        /*
         * A point behind the camera projects to a plausible position mirrored
         * through the origin, so for the one node that may not disappear there
         * is nothing to follow and the honest answer is a fixed place: the top
         * of the frame, where the caption already lives whenever the speaker is
         * close. The escape and the clamp below still apply to it, so it lands
         * clear of the way out rather than under it.
         */
        if (behind) {
          targetX = view.current.left + view.current.width / 2;
          targetY = view.current.top + halfHeight + HUD_SURFACE_GAP_PX;
        }
        if (entry.avoid && halfWidth > 0 && halfHeight > 0 && reserved.current.length > 0) {
          const move = escapeReserved(
            {
              left: targetX - halfWidth,
              top: targetY - halfHeight,
              width: halfWidth * 2,
              height: halfHeight * 2,
            },
            reserved.current,
            { width: view.current.width, height: view.current.height },
          );
          targetX += move.dx;
          targetY += move.dy;
        }

        /*
         * AND OUT FROM UNDER EACH OTHER, which the frame edge and the fixed
         * chrome say nothing about.
         *
         * Only nodes that asked for it (`stack`) take part, and they only ever
         * rise. The reasoning, and the measurements that forced it, are on
         * `culling.ts` → `stackClearance`; what belongs here is why it is in the
         * frame loop at all. The candidates' plates are laid out by the camera,
         * and the camera moves — `SHOT_AMBIENT` orbits the picker's shot — so
         * how much room two labels have is a per-frame fact. An authored ladder
         * was written first and was correct in the screenshot that justified it
         * and wrong a few seconds later, at a different bearing.
         *
         * Applied to the TARGET, like the escape above, so the existing follow
         * turns a change of lift into the same 90 ms ease as every other move.
         */
        if (entry.stack && halfWidth > 0 && halfHeight > 0) {
          const box = {
            left: targetX - halfWidth,
            top: targetY - halfHeight,
            width: halfWidth * 2,
            height: halfHeight * 2,
          };
          targetY -= stackClearance(box, stacked.current, HUD_SURFACE_GAP_PX);
        }

        /*
         * The BOX, at the size it is about to be drawn at. Each node in a slot
         * is tested on its own because they are different sizes: a two-line
         * plate and a one-word chip riding the same world point leave the frame
         * at different moments, and the plate is the one a learner would have
         * caught half-cut.
         */
        if (!isAnchorNodeVisible(targetX, targetY, halfWidth, halfHeight, view.current)) {
          if (!entry.keepInFrame && !entry.clampToFrame) {
            cull(entry);
            continue;
          }
          /*
           * It slides back in rather than leaving. See `keepInFrame`: the rule
           * /DESIGN.md states — the caption MOVES, it never hides — was only
           * half implemented, because `avoid` escapes fixed CHROME and nothing
           * escaped the frame EDGE.
           *
           * AND THEN IT ESCAPES THE CHROME AGAIN, which is a fix rather than
           * belt-and-braces (`hudSpace.ts` → `clampThenEscape` carries the
           * measurement). The escape above ran on the position the CAMERA asked
           * for, and for the caption at a close-up that position is off the top
           * of the frame entirely — so it overlapped nothing, correctly did
           * nothing, and the clamp then parked the plate exactly where the way
           * out stands.
           */
          const settled = clampThenEscape(
            targetX,
            targetY,
            halfWidth,
            halfHeight,
            {
              // Inset by the same gap the node keeps over a crown, so a clamped
              // caption reads as resting against the edge rather than as cropped
              // by it. Measured without it: the plate sat at top = 0, flush.
              left: view.current.left + HUD_SURFACE_GAP_PX,
              top: view.current.top + HUD_SURFACE_GAP_PX,
              width: view.current.width - HUD_SURFACE_GAP_PX * 2,
              height: view.current.height - HUD_SURFACE_GAP_PX * 2,
            },
            { width: view.current.width, height: view.current.height },
            entry.avoid ? reserved.current : [],
          );
          targetX = settled.x;
          targetY = settled.y;
        }

        if (!entry.placed) {
          entry.x = targetX;
          entry.y = targetY;
          entry.scale = scale;
          entry.placed = true;
        } else {
          // Smoothed, so the handheld sway does not shiver the text. The camera
          // is allowed to breathe; the label attached to it is not.
          entry.x += (targetX - entry.x) * follow;
          entry.y += (targetY - entry.y) * follow;
          entry.scale += (scale - entry.scale) * follow;
        }

        if (entry.culled) {
          entry.culled = false;
          hide(entry.element, false);
        }

        /*
         * Published for the nodes that come after it, at the place it is
         * actually going. A culled node never gets here, so a label the camera
         * has taken off screen does not reserve sky nobody can see.
         */
        if (entry.stack) {
          stacked.current.push({
            left: targetX - halfWidth,
            top: targetY - halfHeight,
            width: halfWidth * 2,
            height: halfHeight * 2,
          });
        }

        /*
         * ONE transform for both placements, and that is the point of expressing
         * `above` as a rise rather than as a different translate. `entry.y` is
         * the node's CENTRE either way, so the centred origin stays the fixed
         * point of the scale and the box the escape and the cull were computed
         * against is exactly the box that gets painted.
         */
        entry.element.style.transform = `translate3d(${entry.x.toFixed(2)}px, ${entry.y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${entry.scale.toFixed(4)})`;
      }
    }
  });

  return null;
}

/**
 * Takes a node out of the frame and out of the tab order.
 *
 * All THREE, together, always. `hidden` alone still leaves a focusable
 * descendant reachable in some engines when the element is display-overridden,
 * and `inert` alone leaves a visible control that does nothing. Guarded on the
 * previous state so a culled node is not written to on every one of the frames
 * it spends off screen.
 *
 * THE DISPLAY WRITE IS NOT BELT AND BRACES — `hidden` ALONE DOES NOTHING to an
 * anchored node that carries a Tailwind display utility, and two of them do.
 * `[hidden] { display: none }` is a USER-AGENT rule, so any author `display`
 * wins it outright: `flex` on the element beats it, silently, with no warning
 * anywhere. Measured on `/dev/tutor-lab` at 375x812 during personalization, the
 * candidate plate for a character the projector had never placed sat at
 * (0, 0, 197, 70) — on top of the way out, fully painted, and `inert`, which is
 * the worst of the three possible states: a control a child can see, aim at and
 * press, that does nothing at all. Writing `display` from the same origin as
 * the class settles it for every anchored node at once, which is the only place
 * this can be fixed once rather than remembered in every component that ever
 * adds `flex` to an anchored wrapper.
 */
function cull(entry: AnchoredNode): void {
  if (entry.culled) return;
  entry.culled = true;
  entry.placed = false;
  hide(entry.element, true);
}

/**
 * Every inline property the projector writes, in the one list that both
 * `claimProjection` and `releaseProjection` read.
 *
 * IT IS A PAIR, AND IT WAS NOT (2026-09-12). The projector took a node over by
 * writing six properties onto it and gave it back by clearing exactly one —
 * `transform`. An inline declaration beats every class, so the other five
 * outlived the takeover: `position: fixed; left: 0; top: 0; margin: 0` stayed on
 * the node for the rest of the session and quietly won against whatever
 * stylesheet was supposed to place it next.
 *
 * MEASURED IN PRODUCTION, desktop 1604x677, es-MX. `SpeechCaption` positions
 * itself two ways: anchored over the speaking character's crown while
 * `docked === null`, and by CSS (`top-20 mx-auto right-[min(27.5rem,34vw)]`)
 * once it docks beside the desktop panel. Crossing the `lg` breakpoint — a
 * rotation, a window drag, a tablet entering split view — flips `docked` from
 * `null` to `'panel'`, so React drops the ref and this release path runs. The
 * caption then went from (326, 80) to **(0, 0)**: `.top-20` and `.mx-auto`
 * still matched, and `.top-20 { top: 5rem }` was still in the stylesheet, but
 * the stale inline `top: 0; margin: 0` outranked both. At (0, 0) the caption's
 * 512x220 box covered the "way out" chip at (24, 24, 152, 48) completely — all
 * 152x48 px of it, the ONLY navigation on the route. The chip sits at `z-50`
 * against the caption's `z-20` so it stayed clickable, which made it worse
 * rather than better: the tutor's own identity row was painted underneath a
 * control, unreadable, with nothing on screen to say why.
 *
 * So the release writes the EMPTY STRING for each one, for the same reason
 * `hide` does below: the node's real position belongs to its classes, and
 * naming a value here would be this system guessing at a layout it does not own.
 */
const PROJECTED_STYLE_PROPS = [
  'left',
  'top',
  'margin',
  'transformOrigin',
  'willChange',
  'transform',
] as const;

/*
 * `position` IS DELIBERATELY NOT IN THAT LIST, and leaving it out is a fix for
 * the fix.
 *
 * The first version of this release cleared all seven, which is what symmetry
 * argues for and what the caption bug did not need — the stale declarations
 * that beat `top-20 mx-auto` are `top`, `left` and `margin`. Clearing
 * `position` as well returns a released node to `static`, and a static node
 * REJOINS THE NORMAL FLOW and starts taking up space in whatever container it
 * is in. Not every anchored node declares its own position in CSS, so for
 * those the stale `position: fixed` was the only thing keeping them out of
 * layout.
 *
 * `verify:tutor-ui` caught it within one run: at mobile-es the speech caption
 * came out overlapping the microphone dock by 323x67 px — the escape
 * arithmetic is fine, the boxes it was escaping had moved. Reverting this one
 * property returns the gate to green while `top`/`left`/`margin` still go
 * back, which is all the caption ever needed.
 *
 * Being left `fixed` is also the correct resting state rather than a
 * concession: every node this projector positions is HUD chrome, both of the
 * caption's own modes are `fixed`, and out-of-flow is what the rest of the
 * layout is measured against.
 */

/** Takes a node over for per-frame projection. Paired with `releaseProjection`. */
function claimProjection(node: HTMLElement): void {
  node.style.position = 'fixed';
  node.style.left = '0';
  node.style.top = '0';
  node.style.margin = '0';
  /*
   * Centred for BOTH placements. `above` is expressed as a rise applied to the
   * projected point (see the frame loop), never as a different transform
   * origin: the centre is the fixed point of a scale, so the box the cull test
   * and the HUD escape are computed against stays the box that is actually
   * painted, at every camera distance.
   */
  node.style.transformOrigin = 'center center';
  node.style.willChange = 'transform';
}

/**
 * Hands a node back to its own stylesheet, completely.
 *
 * Called from the ref callback's release path — the moment a component stops
 * being anchored, whether it unmounted or merely switched to a CSS-positioned
 * mode while staying on screen. The second case is the one that bit us; see
 * `PROJECTED_STYLE_PROPS`.
 */
function releaseProjection(element: HTMLElement): void {
  for (const prop of PROJECTED_STYLE_PROPS) element.style[prop] = '';
}

/**
 * Hides or restores an anchored node, inline, in that one place.
 *
 * Restoring writes the EMPTY STRING rather than a display value: the element's
 * real display belongs to its classes (`flex` on a row, the initial `block` on
 * everything else), and naming one here would flatten every wrapper this system
 * has ever positioned into the same box model.
 */
function hide(element: HTMLElement, hidden: boolean): void {
  element.hidden = hidden;
  element.inert = hidden;
  element.style.display = hidden ? 'none' : '';
}

/**
 * Re-reads a visible node's own box.
 *
 * `offsetWidth`/`offsetHeight` rather than `getBoundingClientRect`, because the
 * rect would fold in the scale the projector wrote last frame and the cull test
 * applies that scale itself — measuring it twice shrinks the node's apparent
 * box at the establishing shot, which is where a plate is already closest to
 * the frame edge.
 *
 * A zero reading is ignored rather than stored: it means the node is hidden,
 * not that it has no size, and forgetting the real size is what would make the
 * cull oscillate.
 */
function measureBox(entry: AnchoredNode): void {
  const width = entry.element.offsetWidth;
  const height = entry.element.offsetHeight;
  if (width > 0) entry.halfWidth = width / 2;
  if (height > 0) entry.halfHeight = height / 2;
  /*
   * The tap floor is re-derived UNGATED, unlike the box above.
   *
   * A zero box means "this node is hidden" for the cull, but it does not mean
   * the node has no controls: the opening offers ride a wrapper whose own
   * `offsetHeight` is 0 because its four chips are laid out out of flow, so
   * gating on the wrapper's box was the difference between a floor that applied
   * and a floor measured once, at registration, while the node was still
   * display:none — 40 px chips on a 375 px phone, which is the exact failure
   * this floor exists to stop. `tapFloor` returns 0 for a node with no laid-out
   * controls, which is the same answer as not applying it — and a zero is
   * DISCARDED rather than stored, for the same reason the box above discards
   * one: it means "not laid out right now", never "has no controls".
   */
  const floor = tapFloor(entry.element);
  if (floor > 0) entry.minScale = Math.max(entry.readableScale, floor);
}

/** Everything a finger is expected to hit. */
const TAP_TARGETS = 'button, a[href], input, select, textarea, [role="button"]';

/**
 * The smallest scale at which every control inside this node still renders at
 * MIN_TAP_PX on its short side. Zero — no floor — for a node that is only read.
 *
 * IT MEASURES THE SMALLEST CONTROL, NOT THE NODE. An anchored node is often a
 * CLUSTER: the four opening offers ride one anchor inside a wrapper 150 px
 * tall, so a floor derived from the wrapper's own box is 44/150 and constrains
 * nothing, while the 48 px buttons inside it render at 40. Taking the minimum
 * over the controls themselves is what makes the floor mean what it says.
 */
function tapFloor(node: HTMLElement): number {
  const targets: HTMLElement[] = node.matches(TAP_TARGETS)
    ? [node]
    : [...node.querySelectorAll<HTMLElement>(TAP_TARGETS)];
  let shortest = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const side = Math.min(target.offsetWidth, target.offsetHeight);
    if (side > 0 && side < shortest) shortest = side;
  }
  if (!Number.isFinite(shortest)) return 0;
  // Capped at 1: the floor stops a control from SHRINKING below the target, it
  // never enlarges one that was authored smaller than it. That would be a
  // layout bug growing a second one.
  return Math.min(1, MIN_TAP_PX / shortest);
}
