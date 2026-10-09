import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import './motion.css';

/*
 * Motion patterns. Every animation lives in `motion.css` inside a
 * `prefers-reduced-motion: no-preference` query, so reduced motion keeps every
 * state change and removes only the travel.
 */

/**
 * The idle-motion slots. At most one component holds each slot at a time, so
 * at most one breathing call to action, one hero and one flame move at once.
 */
export type IdleMotionKind = 'hero' | 'streak-flame' | 'breathing-cta';

const holders = new Map<IdleMotionKind, symbol>();
/** Refused claimants, woken when a slot frees so the next one in line can take it. */
const waiting = new Set<() => void>();

function claimIdleMotion(kind: IdleMotionKind, holder: symbol): boolean {
  const current = holders.get(kind);
  if (current && current !== holder) return false;
  holders.set(kind, holder);
  return true;
}

function releaseIdleMotion(kind: IdleMotionKind, holder: symbol) {
  if (holders.get(kind) !== holder) return;
  holders.delete(kind);
  for (const wake of [...waiting]) wake();
}

/**
 * Asks for one idle loop. It returns true only while this component holds the
 * slot. A refused claimant waits and takes the slot when its holder leaves.
 */
export function useIdleMotion(kind: IdleMotionKind, wanted = true): boolean {
  const holder = useRef<symbol>(Symbol(kind));
  const [granted, setGranted] = useState(false);
  useLayoutEffect(() => {
    if (!wanted) { setGranted(false); return undefined; }
    const token = holder.current;
    const attempt = () => {
      const won = claimIdleMotion(kind, token);
      setGranted(won);
      if (won) waiting.delete(attempt); else waiting.add(attempt);
    };
    attempt();
    return () => { waiting.delete(attempt); releaseIdleMotion(kind, token); };
  }, [kind, wanted]);
  return granted && wanted;
}

/**
 * A one-shot state bump: true from the moment `trigger` changes to a new truthy
 * value (never on the first render) until the animation ends or `trigger`
 * becomes falsy again. Callers put a class on while it is true and clear it on
 * `animationend`, so the same bump can play again next time.
 */
export function useOneShot(trigger: string | false | null | undefined): [boolean, () => void] {
  const previous = useRef(trigger);
  const [active, setActive] = useState(false);
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = trigger;
    if (!trigger) { setActive(false); return; }
    if (trigger !== before) setActive(true);
  }, [trigger]);
  return [active, () => setActive(false)];
}

function prefersMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: no-preference)').matches; } catch { return false; }
}

/* ---------------------------------------------------------------------------
 * Press feedback: a soft ring ripples from the touch point and a
 * haptic tick plays where supported. The scale press itself is CSS
 * (`--press-scale`).
 * ------------------------------------------------------------------------- */

/** The "sound off" switch also silences the haptic tick. */
function hapticsOff() {
  try { return window.localStorage.getItem('lf_sound_muted') === '1'; } catch { return false; }
}

/**
 * One press: a haptic tick unless sound and haptics are switched off, and,
 * with motion allowed, a ring in the control's own on-* colour (`currentColor`)
 * that scales out from the pointer over `--dur-micro` on `--ease-standard`.
 * With reduced motion only the colour state change remains. A disabled or
 * pending control gives no feedback.
 */
function pressFeedback(event: ReactPointerEvent<HTMLElement>) {
  const control = event.currentTarget;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (control.matches(':disabled, [aria-disabled="true"]')) return;
  if (control.querySelector(':scope > input:disabled') || control.closest('fieldset[disabled]')) return;
  if (!hapticsOff()) {
    try { navigator.vibrate?.(8); } catch { /* not supported, or refused */ }
  }
  if (!prefersMotion()) return;
  const box = control.getBoundingClientRect();
  const rtl = getComputedStyle(control).direction === 'rtl';
  const x = rtl ? box.right - event.clientX : event.clientX - box.left;
  const y = event.clientY - box.top;
  const reach = Math.max(Math.hypot(x, y), Math.hypot(box.width - x, y), Math.hypot(x, box.height - y), Math.hypot(box.width - x, box.height - y));
  const ring = document.createElement('span');
  ring.className = 'lf-press-ring';
  ring.setAttribute('aria-hidden', 'true');
  ring.style.setProperty('--lf-press-x', `${x}px`);
  ring.style.setProperty('--lf-press-y', `${y}px`);
  ring.style.setProperty('--lf-press-size', `${Math.ceil(reach * 2)}px`);
  control.append(ring);
  const clear = () => ring.remove();
  ring.addEventListener('animationend', clear, { once: true });
  window.setTimeout(clear, 600);
}

/** `onPointerDown` for a pressable: the shared press feedback, then the caller's own handler. */
export function withPressFeedback<T extends HTMLElement>(handler?: (event: ReactPointerEvent<T>) => void) {
  return (event: ReactPointerEvent<T>) => {
    pressFeedback(event as ReactPointerEvent<HTMLElement>);
    handler?.(event);
  };
}
