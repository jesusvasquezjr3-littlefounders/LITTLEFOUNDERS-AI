import { useEffect, useState } from 'react';

/*
 * Fullscreen and orientation for the phone (design §8, "Mobile"): the route is
 * standalone and fullscreen; after the learner's tap on Go the host asks for
 * fullscreen and a landscape lock where the browser offers them (Android
 * Chrome does; iOS Safari has neither, so the host shows its own rotate card
 * and the game keeps its own overlay as a fallback).
 *
 * BOTH CALLS NEED A USER GESTURE, so they run synchronously inside the Go
 * press, before anything is awaited. Every call is guarded: a refusal (a
 * desktop browser, an iframe policy, a lock the OS denies) is not an error, it
 * simply leaves the rotate card as the answer. Only touch-first devices are
 * asked: a desktop browser keeps its own window.
 */

interface OrientationLike { type?: string; lock?: (orientation: string) => Promise<void>; unlock?: () => void }

const orientation = (): OrientationLike | null => {
  try {
    return typeof screen === 'undefined' ? null : (screen as unknown as { orientation?: OrientationLike }).orientation ?? null;
  } catch {
    return null;
  }
};

function query(text: string): MediaQueryList | null {
  try {
    return typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? null : window.matchMedia(text);
  } catch {
    return null;
  }
}

/** True on a device whose main pointer is a finger: the only devices the host puts into fullscreen. */
export function isTouchFirst(): boolean {
  return query('(pointer: coarse)')?.matches === true;
}

/** Asks for fullscreen and a landscape lock. Call inside the press that starts the race. */
export function enterImmersive(): void {
  if (!isTouchFirst()) return;
  try {
    const request = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    void Promise.resolve(request)
      .then(() => orientation()?.lock?.('landscape'))
      .catch(() => { /* Unsupported or refused: the rotate card is the answer. */ });
  } catch {
    /* A browser that throws instead of rejecting. */
  }
}

/** Gives the screen back: leaves fullscreen and unlocks the orientation. Safe to call twice. */
export function leaveImmersive(): void {
  try {
    orientation()?.unlock?.();
  } catch {
    /* Nothing was locked. */
  }
  try {
    if (document.fullscreenElement) void document.exitFullscreen?.()?.catch(() => {});
  } catch {
    /* Already out. */
  }
}

/**
 * True when a touch device is held upright while `active`: the game cannot be raced portrait, so the host
 * shows its rotate card. Follows the device as it turns; desktop windows never trigger it.
 */
export function useRotatePrompt(active: boolean): boolean {
  const [upright, setUpright] = useState(false);
  useEffect(() => {
    const portrait = query('(orientation: portrait)');
    const touch = query('(pointer: coarse)');
    if (!active || !portrait || !touch) { setUpright(false); return undefined; }
    const read = () => setUpright(portrait.matches && touch.matches);
    read();
    portrait.addEventListener?.('change', read);
    return () => portrait.removeEventListener?.('change', read);
  }, [active]);
  return active && upright;
}
