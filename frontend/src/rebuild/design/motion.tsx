import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { isMilestone, type Milestone } from './milestones';
import './motion.css';

/*
 * Motion patterns of the rebuilt frontend (Frontend Bible 02 §9.1, §9.2, §9.4;
 * 04 §2–§3; 07 §5; S03.7). Every animation lives in `motion.css` inside a
 * `prefers-reduced-motion: no-preference` query, so reduced motion keeps every
 * state change and removes only the travel. The celebration curve and duration
 * (`--ease-spring`, `--dur-celebration`) exist only under `.lf-celebration`,
 * and `Celebration` renders only for an OD-7 milestone.
 */

/**
 * The three idle-motion slots of 02 §9.4. `hero` is the hero object's float or,
 * on a screen with the Mentor stage, the character's catalogue idle loop (08
 * §3): one of the three, never a fourth.
 */
export type IdleMotionKind = 'hero' | 'streak-flame' | 'breathing-cta';
export const IDLE_MOTION_KINDS: readonly IdleMotionKind[] = ['hero', 'streak-flame', 'breathing-cta'];

const holders = new Map<IdleMotionKind, symbol>();
/** Refused claimants, woken when a slot frees so the next one in line can take it. */
const waiting = new Set<() => void>();

/** Claims one idle slot for the whole document. A second claimant of the same slot is refused and stays still. */
export function claimIdleMotion(kind: IdleMotionKind, holder: symbol): boolean {
  const current = holders.get(kind);
  if (current && current !== holder) return false;
  holders.set(kind, holder);
  return true;
}

export function releaseIdleMotion(kind: IdleMotionKind, holder: symbol) {
  if (holders.get(kind) !== holder) return;
  holders.delete(kind);
  for (const wake of [...waiting]) wake();
}

/** The slots in use right now (tests and the audit driver read this). */
export function activeIdleMotion(): IdleMotionKind[] {
  return IDLE_MOTION_KINDS.filter((kind) => holders.has(kind));
}

/**
 * Asks for one idle loop. It returns true only while this component holds the
 * slot, so at most one breathing call to action, one hero and one flame move at
 * once: three things, the budget (02 §9.4). A refused claimant waits and takes
 * the slot when its holder leaves.
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

const played = new Set<string>();
const storageKey = (key: string) => `littlefounders.celebrated:${key}`;
function alreadyCelebrated(key: string) {
  if (played.has(key)) return true;
  try { return window.sessionStorage.getItem(storageKey(key)) === '1'; } catch { return false; }
}
function markCelebrated(key: string) {
  played.add(key);
  try { window.sessionStorage.setItem(storageKey(key), '1'); } catch { /* storage may be unavailable; the in-memory set still holds */ }
}

/** Test helper: forgets which moments have celebrated. */
export function resetCelebrationsForTest() {
  played.clear();
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith('littlefounders.celebrated:')) window.sessionStorage.removeItem(key);
    }
  } catch { /* nothing stored */ }
}

export type CelebrationState = 'playing' | 'settled' | 'static' | 'refused';
const CelebrationContext = createContext<CelebrationState>('static');

/**
 * The only celebration in the rebuilt frontend (02 §9.2, D7, OD-7): a milestone
 * on the closed list celebrates once per moment. Children mark their parts with
 * `celebrationPart(...)`: the medal pops on the spring curve, tiles rise in
 * sequence and bars fill. Anything that is not a milestone, a moment that has
 * already celebrated and reduced motion all render the settled final frame, the
 * designated static frame of 07 §5, with every value already in place.
 */
export function Celebration({ milestone, momentId, children, className, onStateChange }: {
  milestone: Milestone; momentId: string; children: ReactNode; className?: string;
  onStateChange?: (state: CelebrationState) => void;
}) {
  const allowed = isMilestone(milestone);
  const key = `${milestone}:${momentId}`;
  const [state, setState] = useState<CelebrationState>(() => {
    if (!allowed) return 'refused';
    if (alreadyCelebrated(key) || !prefersMotion()) return 'static';
    return 'playing';
  });
  useEffect(() => {
    if (state === 'playing') markCelebrated(key);
    onStateChange?.(state);
  }, [key, state, onStateChange]);
  useEffect(() => {
    if (state !== 'playing') return undefined;
    // The celebration budget is 700 ms plus the stagger of at most five parts;
    // settle on a timer as well as on animationend, so a hidden tab still settles.
    const timer = window.setTimeout(() => setState('settled'), 1200);
    return () => window.clearTimeout(timer);
  }, [state]);
  return <div className={`lf-celebration${state === 'playing' ? ' lf-celebration--play' : ''}${className ? ` ${className}` : ''}`}
    data-milestone={allowed ? milestone : undefined} data-celebration={state} data-refused={allowed ? undefined : 'true'}>
    <CelebrationContext.Provider value={state}>{children}</CelebrationContext.Provider>
  </div>;
}

export type CelebrationPart = 'pop' | 'rise' | 'fill';
/** Marks an element as one part of the celebration around it; `order` staggers rising tiles. */
export function celebrationPart(part: CelebrationPart, order = 0): { className: string; style?: CSSProperties } {
  return { className: `lf-celebration-${part}`, style: order ? ({ '--lf-celebration-order': order } as CSSProperties) : undefined };
}

/**
 * Counts a number up during a celebration with fixed-width digits, so nothing
 * reflows (02 §9.2). The final value is what reduced motion, tests and a
 * revisit get; the count runs only while the surrounding celebration plays
 * (inside `Celebration`, `play` follows it).
 */
export function CountUp({ value, format, play }: { value: number; format: (value: number) => string; play?: boolean }) {
  const celebration = useContext(CelebrationContext);
  play = play ?? celebration === 'playing';
  const final = format(value);
  const [shown, setShown] = useState(final);
  useLayoutEffect(() => {
    if (!play || !prefersMotion() || value === 0) { setShown(final); return undefined; }
    let frame = 0;
    const start = performance.now();
    const duration = 700; // --dur-celebration
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // Standard deceleration: fast first, settling on the exact value.
      const eased = 1 - (1 - progress) ** 3;
      setShown(progress >= 1 ? final : format(Math.round(value * eased)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    setShown(format(0));
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // `format` is a pure presentation function; restarting on its identity would replay the count.
  }, [play, value, final]);
  return <span className="lf-count-up" style={{ minInlineSize: `${final.length}ch` }}>{shown}</span>;
}
