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
 */
export type SafeAreaSlot = 'lesson' | 'sheet' | 'mic' | 'caption';

export const SAFE_AREA_SLOTS = ['lesson', 'sheet', 'mic', 'caption'] as const satisfies readonly SafeAreaSlot[];

export interface SafeAreaValue {
  /**
   * Every measured rect, in VIEWPORT coordinates (`getBoundingClientRect`).
   * Consumers convert into whatever space they compose in.
   */
  rectsRef: MutableRefObject<ReadonlyMap<SafeAreaSlot, HudRect>>;
  /** Bumped whenever any rect changed. The cheap "do I need to recompute" signal. */
  versionRef: MutableRefObject<number>;
  /** A stable ref callback for a slot. Put it on the node you want measured. */
  measure: (slot: SafeAreaSlot) => (node: HTMLElement | null) => void;
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
  const observed = useRef(new Map<HTMLElement, SafeAreaSlot>());
  const callbacks = useRef(new Map<SafeAreaSlot, (node: HTMLElement | null) => void>());

  const publish = useCallback((slot: SafeAreaSlot, node: HTMLElement | null) => {
    const next = new Map(rects.current);
    if (!node) {
      if (!next.has(slot)) return;
      next.delete(slot);
    } else {
      const box = node.getBoundingClientRect();
      const previous = next.get(slot);
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
      next.set(slot, { left: box.left, top: box.top, width: box.width, height: box.height });
    }
    rects.current = next;
    version.current += 1;
  }, []);

  const measure = useCallback(
    (slot: SafeAreaSlot) => {
      const existing = callbacks.current.get(slot);
      /*
       * The SAME function identity for the life of the provider. React calls a
       * ref callback with null and then with the node whenever its identity
       * changes, so a freshly-created callback each render would detach and
       * re-observe the plate on every render of the component holding it.
       */
      if (existing) return existing;

      const callback = (node: HTMLElement | null) => {
        if (!observer.current && typeof ResizeObserver !== 'undefined') {
          observer.current = new ResizeObserver((entries) => {
            for (const entry of entries) {
              const target = entry.target;
              if (!(target instanceof HTMLElement)) continue;
              const owner = observed.current.get(target);
              if (owner) publish(owner, target);
            }
          });
        }

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
    [publish],
  );

  useEffect(() => {
    const currentObserver = observer;
    const currentObserved = observed;
    return () => {
      currentObserver.current?.disconnect();
      currentObserver.current = null;
      currentObserved.current.clear();
    };
  }, []);

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
