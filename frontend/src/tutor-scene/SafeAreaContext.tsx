import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import type { HudRect } from './composition';

/*
 * Where the HUD actually is, measured, in a REF.
 *
 * The camera has to compose around the lesson plate and the sheet, which means
 * it needs their rectangles every frame. The obvious implementation — hold them
 * in state and let the camera read them as props — is the one thing this must
 * not do: a bottom sheet is DRAGGED, so a state-held rect would re-render the
 * entire stage subtree on every pointermove of the drag, at exactly the moment
 * the GPU is busiest. `SceneCanvas` already carries the note that a per-frame
 * React update costs more than the scene it is measuring, and a drag is a
 * per-frame update by definition.
 *
 * So measurement writes into a ref and bumps a version counter. Nothing
 * re-renders. `CameraDirector` reads the ref inside `useFrame` and only redoes
 * the arithmetic when the version moved.
 *
 * RECTS, NOT INSETS, are what this publishes. Reducing a rectangle to an edge
 * inset needs to know the size of the surface it is intruding into, and the
 * camera is the only thing that knows that — it is the canvas, not the window,
 * and on the scene lab those differ. `composition.insetsFromRects` does the
 * reduction where the answer is known.
 */

/**
 * The surfaces that can eat into the stage.
 *
 * Closed because each one has a different reason to exist and a different
 * behaviour when the keyboard opens; an open-ended registry would let anything
 * silently start pushing the camera around.
 *
 * ONLY VIEWPORT-ANCHORED SURFACES MAY BE IN THIS LIST, and that is a hard rule
 * rather than a convention. The camera answers a registered rect by moving the
 * subject away from it — so a WORLD-anchored surface, which is positioned by
 * projecting a point the camera is currently moving, would be pushed by its own
 * measurement: the aim lifts, the anchor it rides lifts with it, the published
 * rect lifts, the inset grows, and the aim lifts again. It converges on the
 * `MIN_FREE_FRACTION` clamp instead of diverging, which is worse than a runaway
 * because it looks like a slow deliberate drift rather than a bug. The three
 * slots below are exactly /DESIGN.md → Screen Recipes → Tutor's three
 * viewport-anchored elements' surfaces; the offer chips, the speech caption and
 * every rim pad ride the world and must never appear here.
 *
 * `caption` was in this union and is now gone for that reason: the caption rides
 * `lead.crown`, so registering it would have been the loop above, and having the
 * slot sitting there unused was an invitation to build it.
 */
export type SafeAreaSlot = 'lesson' | 'sheet' | 'mic';

export const SAFE_AREA_SLOTS = ['lesson', 'sheet', 'mic'] as const satisfies readonly SafeAreaSlot[];

/**
 * Every VIEWPORT-anchored surface the HUD paints, whether or not the camera
 * composes around it.
 *
 * The camera's list and the HUD's list are not the same list, and conflating
 * them is what left a whole class of collision unowned. `exit` — the way out at
 * the top-left — is chrome a world-anchored node absolutely must not land under,
 * and it is chrome the CAMERA must ignore: a 52x44 corner chip charged as a
 * 60 px top inset would push the subject down the frame in every phase to make
 * room for a back arrow, which is a framing change nobody asked for in exchange
 * for a collision the HUD can settle by itself for 22 px.
 *
 * So one registry, two readers. `rectsRef` carries the three the camera obeys
 * (`SAFE_AREA_SLOTS`); `chromeRef` carries all four, and is what the anchor
 * projector avoids and what `WorldChip` hides behind.
 *
 * Closed, and closed for the same reason the camera's list is: each entry has a
 * different reason to exist and a different behaviour when the keyboard opens.
 * /DESIGN.md → Screen Recipes → Tutor fixes the count of viewport-anchored
 * elements at three; a fourth is an owner decision, and `exit` is one of the
 * three, not a fourth.
 */
export type HudChromeSlot = SafeAreaSlot | 'exit';

export const HUD_CHROME_SLOTS = [
  'lesson',
  'sheet',
  'mic',
  'exit',
] as const satisfies readonly HudChromeSlot[];

/** The subset of the chrome the CAMERA composes around. */
const CAMERA_SLOTS: ReadonlySet<HudChromeSlot> = new Set<HudChromeSlot>(SAFE_AREA_SLOTS);

export interface SafeAreaValue {
  /**
   * The rects the CAMERA composes around, in VIEWPORT coordinates
   * (`getBoundingClientRect`). Consumers convert into whatever space they
   * compose in.
   */
  rectsRef: MutableRefObject<ReadonlyMap<SafeAreaSlot, HudRect>>;
  /** Bumped whenever any rect changed. The cheap "do I need to recompute" signal. */
  versionRef: MutableRefObject<number>;
  /**
   * EVERY viewport-anchored surface, including the ones the camera ignores.
   *
   * This is the "what space is taken" the world-anchored half of the HUD reads:
   * the projector moves an anchored node out of these rects, and `WorldChip`
   * hides a chip that has been painted over by one.
   */
  chromeRef: MutableRefObject<ReadonlyMap<HudChromeSlot, HudRect>>;
  /** Bumped whenever any chrome rect changed, camera slot or not. */
  chromeVersionRef: MutableRefObject<number>;
  /** A stable ref callback for a slot. Put it on the node you want measured. */
  measure: (slot: HudChromeSlot) => (node: HTMLElement | null) => void;
  /** True while the soft keyboard is covering part of the viewport. */
  keyboardOpenRef: MutableRefObject<boolean>;
  /**
   * Notified when the keyboard opens or closes, so a sheet can collapse itself
   * to PEEK. A callback rather than state for the same reason as everything else
   * here: the sheet is the only thing that needs to know.
   */
  subscribeKeyboard: (listener: (open: boolean) => void) => () => void;
}

const SafeAreaContext = createContext<SafeAreaValue | null>(null);

/**
 * How much of the viewport the visual viewport must lose before we call it a
 * keyboard.
 *
 * A URL bar collapsing on scroll also shrinks the visual viewport, by something
 * on the order of 60-90 px. Treating that as a keyboard would collapse the
 * lesson sheet every time a learner scrolled the transcript. Software keyboards
 * are far taller than that on every phone we support.
 */
const KEYBOARD_THRESHOLD_PX = 160;

export function SafeAreaProvider({ children }: { children: ReactNode }) {
  const rects = useRef<ReadonlyMap<SafeAreaSlot, HudRect>>(new Map());
  const version = useRef(0);
  const chrome = useRef<ReadonlyMap<HudChromeSlot, HudRect>>(new Map());
  const chromeVersion = useRef(0);
  const keyboardOpen = useRef(false);
  const keyboardListeners = useRef(new Set<(open: boolean) => void>());

  /*
   * ONE observer for every slot, created lazily.
   *
   * ResizeObserver reports the observed element, so a single instance can serve
   * all four; one observer per node would mean four objects, four callbacks and
   * four chances to leak one when a slot unmounts mid-drag.
   */
  const observer = useRef<ResizeObserver | null>(null);
  const observed = useRef(new Map<HTMLElement, HudChromeSlot>());
  const callbacks = useRef(new Map<HudChromeSlot, (node: HTMLElement | null) => void>());

  const publish = useCallback((slot: HudChromeSlot, node: HTMLElement | null) => {
    const previous = chrome.current.get(slot);
    let measured: HudRect | null = null;

    if (node) {
      const box = node.getBoundingClientRect();
      /*
       * Skip identical measurements. ResizeObserver fires on observe() and
       * again on every layout pass, and a version bump the camera acts on is a
       * fresh round of trigonometry — cheap, but not free, and pointless when
       * nothing moved.
       */
      if (
        previous &&
        previous.left === box.left &&
        previous.top === box.top &&
        previous.width === box.width &&
        previous.height === box.height
      ) {
        return;
      }
      measured = { left: box.left, top: box.top, width: box.width, height: box.height };
    } else if (!previous) {
      return;
    }

    const nextChrome = new Map(chrome.current);
    if (measured) nextChrome.set(slot, measured);
    else nextChrome.delete(slot);
    chrome.current = nextChrome;
    chromeVersion.current += 1;

    // The camera's view of the HUD is a SUBSET, and stays one: a chip the camera
    // must ignore is published here and nowhere the composition solver reads.
    if (!CAMERA_SLOTS.has(slot)) return;
    const nextRects = new Map(rects.current);
    if (measured) nextRects.set(slot as SafeAreaSlot, measured);
    else nextRects.delete(slot as SafeAreaSlot);
    rects.current = nextRects;
    version.current += 1;
  }, []);

  /**
   * The one observer, created on demand.
   *
   * A function rather than inline code in the ref callback, because the effect
   * below has to be able to build it too: after a StrictMode remount the ref
   * callbacks do not run again, and whoever re-attaches the observer has to be
   * able to create one first.
   */
  const ensureObserver = useCallback(() => {
    if (observer.current || typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target;
        if (!(target instanceof HTMLElement)) continue;
        const owner = observed.current.get(target);
        if (owner) publish(owner, target);
      }
    });
  }, [publish]);

  const measure = useCallback(
    (slot: HudChromeSlot) => {
      const existing = callbacks.current.get(slot);
      /*
       * The SAME function identity for the life of the provider. React calls a
       * ref callback with null and then with the node whenever its identity
       * changes, so a freshly-created callback each render would detach and
       * re-observe the plate on every render of the component holding it.
       */
      if (existing) return existing;

      const callback = (node: HTMLElement | null) => {
        ensureObserver();

        for (const [element, owner] of observed.current) {
          if (owner !== slot) continue;
          observer.current?.unobserve(element);
          observed.current.delete(element);
        }

        if (!node) {
          publish(slot, null);
          return;
        }

        observed.current.set(node, slot);
        observer.current?.observe(node);
        // Measure immediately as well: ResizeObserver's first callback lands on
        // the next frame, and a camera that composes around a plate one frame
        // late lurches when the plate appears.
        publish(slot, node);
      };

      callbacks.current.set(slot, callback);
      return callback;
    },
    [publish, ensureObserver],
  );

  /*
   * THE OBSERVER HAS TO SURVIVE A STRICTMODE REMOUNT, and the version that did
   * not was silently disabling this whole registry in development.
   *
   * React 18 StrictMode mounts, unmounts and remounts every effect. The teardown
   * here used to `disconnect()` the observer AND clear the map of observed
   * nodes — and the ref callbacks that filled that map do not run a second time,
   * so after the remount there was no observer, nothing observed, and
   * `remeasure` below iterated an empty map. Every rect stayed frozen at its
   * very first measurement for the life of the page: measured live in a headless
   * browser at 375 px and then resized to 430 px, the dock kept reporting the
   * 345 px width it had had at mount. The camera composed around a HUD that was
   * no longer there, and the anchored HUD avoided chrome that had moved.
   *
   * It never showed up in production, where StrictMode does not double-invoke —
   * which is exactly why it survived: the one build where anybody LOOKS at this
   * route is the one build where it was broken.
   *
   * So the setup re-attaches whatever is already registered, and the teardown
   * drops the observer without forgetting the nodes.
   */
  useEffect(() => {
    ensureObserver();
    for (const [element, slot] of observed.current) {
      observer.current?.observe(element);
      publish(slot, element);
    }
    return () => {
      observer.current?.disconnect();
      observer.current = null;
    };
  }, [ensureObserver, publish]);

  /*
   * A rect measured in viewport coordinates goes stale when the viewport itself
   * changes, and nothing about the NODE changed — so ResizeObserver stays quiet.
   * Scrolling does the same on the scene lab, where the stage is not fixed.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const remeasure = () => {
      for (const [element, slot] of observed.current) publish(slot, element);
    };
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
    };
  }, [publish]);

  /*
   * The soft keyboard.
   *
   * At 375 px an open keyboard plus a half-height sheet leaves the caption no
   * room at all — the tutor is speaking somewhere behind the composer. The sheet
   * collapses to PEEK instead. `visualViewport` is the only signal that reports
   * this; `window.innerHeight` does not move on iOS when the keyboard opens.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const visual = window.visualViewport;
    if (!visual) return;

    const onViewport = () => {
      const covered = window.innerHeight - visual.height;
      const open = covered > KEYBOARD_THRESHOLD_PX;
      if (open === keyboardOpen.current) return;
      keyboardOpen.current = open;
      for (const listener of keyboardListeners.current) listener(open);
    };

    visual.addEventListener('resize', onViewport);
    onViewport();
    return () => visual.removeEventListener('resize', onViewport);
  }, []);

  const subscribeKeyboard = useCallback((listener: (open: boolean) => void) => {
    keyboardListeners.current.add(listener);
    return () => {
      keyboardListeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<SafeAreaValue>(
    () => ({
      rectsRef: rects,
      versionRef: version,
      chromeRef: chrome,
      chromeVersionRef: chromeVersion,
      measure,
      keyboardOpenRef: keyboardOpen,
      subscribeKeyboard,
    }),
    [measure, subscribeKeyboard],
  );

  return <SafeAreaContext.Provider value={value}>{children}</SafeAreaContext.Provider>;
}

/**
 * The safe area, or null where no provider is mounted.
 *
 * Optional on purpose. The scene lab renders the stage with no HUD at all, and
 * the camera must compose perfectly well against nothing — a throwing hook would
 * make the lab, which is the only place this rebuild can be verified today,
 * the one place it cannot run.
 */
export function useSafeArea(): SafeAreaValue | null {
  return useContext(SafeAreaContext);
}
