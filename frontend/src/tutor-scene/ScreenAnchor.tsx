import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { AnchorId } from './anchors';

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
 */

/** How long the smoothing takes to close most of a gap, in seconds. */
const FOLLOW_TAU = 0.09;

/** Off-screen margin before a node is culled, in CSS pixels. */
const CULL_MARGIN_PX = 96;

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

interface AnchoredNode {
  element: HTMLElement;
  /** Smoothed viewport position in CSS pixels. */
  x: number;
  y: number;
  scale: number;
  /** False until the first projection, which snaps rather than easing in. */
  placed: boolean;
  /** Smallest scale that keeps this node's own text at MIN_READABLE_PX. */
  minScale: number;
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
 * the anchor is behind the camera or off-screen the node is hidden AND inert, so
 * it cannot be seen, clicked or tabbed to.
 *
 * The node is positioned with `position: fixed` in VIEWPORT coordinates, which
 * makes it independent of whatever it happens to be nested inside. The one thing
 * that breaks it is a transformed ancestor, since that becomes the containing
 * block for a fixed child; the stage layer must not be transformed.
 */
export function useAnchorSlot(slot: AnchorId): (node: HTMLElement | null) => void {
  const registry = useAnchorRegistry();
  const attached = useRef<AnchoredNode | null>(null);

  return useCallback(
    (node: HTMLElement | null) => {
      const previous = attached.current;
      if (previous) {
        registry?.nodes.get(slot)?.delete(previous);
        // Leave the node in a sane state if it outlives its anchor — an element
        // released while culled would otherwise stay permanently hidden and
        // inert, which looks exactly like a component that failed to render.
        previous.element.hidden = false;
        previous.element.inert = false;
        previous.element.style.transform = '';
        attached.current = null;
      }

      if (!node || !registry) return;

      /*
       * One computed-style read per node, at registration. It forces a layout,
       * which is why it happens here and never in the frame loop.
       */
      const fontSize = Number.parseFloat(window.getComputedStyle(node).fontSize);
      const minScale = Number.isFinite(fontSize) && fontSize > 0 ? Math.min(1, MIN_READABLE_PX / fontSize) : 1;

      node.style.position = 'fixed';
      node.style.left = '0';
      node.style.top = '0';
      node.style.margin = '0';
      node.style.transformOrigin = 'center center';
      node.style.willChange = 'transform';
      // Hidden until the first projection: a node placed at 0,0 for one frame is
      // a control that flashes in the top-left corner of the stage on mount.
      node.hidden = true;
      node.inert = true;

      const entry: AnchoredNode = {
        element: node,
        x: 0,
        y: 0,
        scale: 1,
        placed: false,
        minScale,
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
    [registry, slot],
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
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);

  const projected = useMemo(() => new Vector3(), []);
  const cameraPosition = useMemo(() => new Vector3(), []);
  const origin = useRef({ left: 0, top: 0 });
  const rectAge = useRef(Infinity);

  useFrame((_, delta) => {
    if (!registry || registry.nodes.size === 0) return;

    const dt = Number.isFinite(delta) && delta > 0 ? Math.min(delta, 0.1) : 0.016;

    // The canvas's own position on the page, re-read a few times a second. On
    // the real stage it is `fixed inset-0` and never moves; on the scene lab it
    // moves when the page scrolls.
    rectAge.current += dt;
    if (rectAge.current >= 0.25) {
      rectAge.current = 0;
      const box = gl.domElement.getBoundingClientRect();
      origin.current = { left: box.left, top: box.top };
    }

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
      const x = origin.current.left + (projected.x * 0.5 + 0.5) * size.width;
      const y = origin.current.top + (-projected.y * 0.5 + 0.5) * size.height;
      const outside =
        x < origin.current.left - CULL_MARGIN_PX ||
        x > origin.current.left + size.width + CULL_MARGIN_PX ||
        y < origin.current.top - CULL_MARGIN_PX ||
        y > origin.current.top + size.height + CULL_MARGIN_PX;

      for (const entry of nodes) {
        if (behind || outside) {
          cull(entry);
          continue;
        }

        const depthScale = distance > 1e-3 ? REFERENCE_DISTANCE_M / distance : MAX_SCALE;
        const scale = Math.min(MAX_SCALE, Math.max(entry.minScale, depthScale));

        if (!entry.placed) {
          entry.x = x;
          entry.y = y;
          entry.scale = scale;
          entry.placed = true;
        } else {
          // Smoothed, so the handheld sway does not shiver the text. The camera
          // is allowed to breathe; the label attached to it is not.
          entry.x += (x - entry.x) * follow;
          entry.y += (y - entry.y) * follow;
          entry.scale += (scale - entry.scale) * follow;
        }

        if (entry.culled) {
          entry.culled = false;
          entry.element.hidden = false;
          entry.element.inert = false;
        }

        entry.element.style.transform = `translate3d(${entry.x.toFixed(2)}px, ${entry.y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${entry.scale.toFixed(4)})`;
      }
    }
  });

  return null;
}

/**
 * Takes a node out of the frame and out of the tab order.
 *
 * Both, together, always. `hidden` alone still leaves a focusable descendant
 * reachable in some engines when the element is display-overridden, and `inert`
 * alone leaves a visible control that does nothing. Guarded on the previous
 * state so a culled node is not written to on every one of the frames it spends
 * off screen.
 */
function cull(entry: AnchoredNode): void {
  if (entry.culled) return;
  entry.culled = true;
  entry.placed = false;
  entry.element.hidden = true;
  entry.element.inert = true;
}
