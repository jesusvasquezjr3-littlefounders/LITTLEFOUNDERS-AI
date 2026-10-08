import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { GamesClient } from './api';
import { PlayController, type ExitDestination, type PlaySnapshot } from './controller';
import { browserStorage } from './selection';
import type { Mentor } from './protocol';

/*
 * The hook that gives a React route one KartRush visit: a controller created
 * once, kept in sync with the render's dependencies, started on mount and
 * stopped (the Core session closed, the game told to free the GPU) on unmount.
 *
 * It owns the three things only the browser knows, and passes them to the
 * controller as an environment: whether the tab is in front, whether the
 * game's iframe holds keyboard focus, and the learner's reduced-motion setting.
 */

export interface KartRushOptions {
  client: GamesClient;
  locale: 'en-US' | 'es-MX' | 'pt-BR';
  /** The label the game puts on its Start target (1..24 characters). */
  startLabel: string;
  chosenMentor: Mentor | null;
  onExit: (destination: ExitDestination) => void;
}

export interface KartRush {
  snapshot: PlaySnapshot;
  controller: PlayController;
  /** The iframe's ref callback: stable, so React does not detach and reattach the frame on a render. */
  frameRef: (frame: HTMLIFrameElement | null) => void;
  /** Gives the game the keyboard (after Go, and whenever an overlay closes). */
  focusFrame: () => void;
}

export function useKartRush(options: KartRushOptions): KartRush {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const controllerRef = useRef<PlayController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new PlayController({
      client: options.client, locale: options.locale, startLabel: options.startLabel, chosenMentor: options.chosenMentor,
      storage: browserStorage(), onExit: options.onExit,
      environment: {
        visible: () => document.visibilityState !== 'hidden',
        // The window must hold focus too: a focused element inside a blurred window is not a learner at the controls.
        frameFocused: () => document.hasFocus() && frame.current !== null && document.activeElement === frame.current,
        reducedMotion: () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      },
    });
  }
  const controller = controllerRef.current;
  // Every render's dependencies (a refreshed transport, a language change, the Mentor arriving late) reach the controller.
  useEffect(() => {
    controller.update({ client: options.client, locale: options.locale, startLabel: options.startLabel, chosenMentor: options.chosenMentor, onExit: options.onExit });
  });
  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const frameRef = useCallback((element: HTMLIFrameElement | null) => {
    frame.current = element;
    controller.attachFrame(element);
  }, [controller]);
  const focusFrame = useCallback(() => {
    const element = frame.current;
    if (!element) return;
    try {
      element.focus({ preventScroll: true });
      element.contentWindow?.focus();
    } catch {
      /* A cross-origin window may refuse; the iframe element itself already holds focus. */
    }
  }, []);
  return { snapshot, controller, frameRef, focusFrame };
}
