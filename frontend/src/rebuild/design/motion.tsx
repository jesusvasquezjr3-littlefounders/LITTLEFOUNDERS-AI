import {
  Children, cloneElement, Component, createContext, createRef, isValidElement, useContext, useEffect, useLayoutEffect, useRef, useState,
  type AnimationEvent as ReactAnimationEvent, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import { Glyph } from './glyphs';
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

/**
 * Busy motion (OD-28, owner review item V-04): the loading placeholder's
 * shimmer and the pending button's spinner. They are progress indicators, not
 * idle "the scene is alive" loops, so they take no slot of the three (02 §9.4)
 * and are budgeted separately by this contract:
 *
 *   - they run only while work is in flight: a shimmer only on the shared
 *     loading placeholder (`Skeleton`), a spinner only on a pending button
 *     (`aria-busy="true"`, beside its changed label), and each is gone the
 *     moment the request settles;
 *   - every busy loop is marked `data-busy-motion` with its kind, so the audit
 *     driver can tell it from an unbudgeted loop, and no other loop may carry
 *     the mark;
 *   - they are small and in place (no travel across the screen, 04 §3) and,
 *     like every animation here, exist only under
 *     `prefers-reduced-motion: no-preference`: with reduced motion the
 *     placeholder is still and the spinner is a still ring beside the label.
 */
export type BusyMotionKind = 'shimmer' | 'spinner';
export const BUSY_MOTION_KINDS: readonly BusyMotionKind[] = ['shimmer', 'spinner'];

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

/**
 * The shell's route entrance (02 rule 14; 04 §2, `--dur-transition` on
 * `--ease-enter`): replays the `data-route-enter` animation on <main> for a
 * real route change. The shell calls it from its route-focus effect, which
 * never runs on the first render or on an in-place re-render, and the mark is
 * removed when the entrance ends so nothing about it outlives the move. The
 * CSS lives under `prefers-reduced-motion: no-preference` (shells.css), so
 * with reduced motion the mark is set and nothing moves.
 */
export function replayRouteEntrance(element: HTMLElement | null) {
  noteRouteChange();
  if (!element) return;
  element.removeAttribute('data-route-enter');
  // Reading layout restarts the animation when two route changes come close together.
  void element.offsetWidth;
  element.setAttribute('data-route-enter', '');
  const done = (event: AnimationEvent) => {
    if (event.target !== element) return;
    element.removeAttribute('data-route-enter');
    element.removeEventListener('animationend', done);
  };
  element.addEventListener('animationend', done);
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
const CelebrationContext = createContext<CelebrationState | null>(null);

/**
 * The state of the milestone celebration around a component, or null outside
 * one. A celebration motion asset (`MotionAsset`) plays only while this is
 * `playing` and is refused outside a closed-list milestone (07 §5, OD-7).
 */
export function useCelebrationState(): CelebrationState | null {
  return useContext(CelebrationContext);
}

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
 * revisit get. The count runs only while the surrounding milestone
 * `Celebration` plays; there is deliberately no way to start it anywhere
 * else, because a counting reward is a celebration effect (D7, OD-7): outside
 * a playing celebration it always shows the final value.
 */
export function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  const play = useContext(CelebrationContext) === 'playing';
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

/* ---------------------------------------------------------------------------
 * Orchestrated patterns (Frontend Bible 04 §4.1-§4.4; 02 §9.9, rule 14).
 * The scene's own elements move: an exercise slides out as the next slides
 * in, an approved row is covered by a success panel that wipes away, the
 * streak strip's days rise in a wave and badge grids stagger in. None is a
 * celebration (no spring, no celebration duration; celebrationBudget.test.ts
 * lists them as non-celebration motion), every one lives in motion.css under
 * `prefers-reduced-motion: no-preference`, and with reduced motion the final
 * state is simply there.
 * ------------------------------------------------------------------------- */

/** The non-celebration orchestrated patterns, by keyframe name (the in-page motion audit reads the same list). */
export const ORCHESTRATED_MOTION = ['lf-route-enter', 'lf-sequence-in', 'lf-sequence-out', 'lf-success-wipe', 'lf-wave-rise', 'lf-stagger-rise', 'lf-press-ring'] as const;

let routeEpoch = 0;
const entered = new Map<string, number>();

/** A real route or screen change happened (the shells' route focus and the lesson layer call it). */
export function noteRouteChange() {
  routeEpoch += 1;
}

/** Test helper: forgets which surfaces have entered. */
export function resetRouteEntriesForTest() {
  routeEpoch = 0;
  entered.clear();
}

/**
 * True only on the first render of `key` after a route change (02 rule 14):
 * a surface that mounts on a new route enters; a re-render, or a remount on
 * the same route after an unrelated interaction, does not enter again. The
 * initialiser is pure (StrictMode runs it twice) and the entry is recorded
 * after commit.
 */
export function useRouteEntry(key: string): boolean {
  const [entry] = useState(() => entered.get(key) !== routeEpoch);
  useEffect(() => { entered.set(key, routeEpoch); }, [key]);
  return entry;
}

function indexed(children: ReactNode): ReactNode {
  let index = 0;
  return Children.map(children, (child) => {
    if (!isValidElement<{ style?: CSSProperties }>(child)) return child;
    const style = { ...(child.props.style ?? {}), '--lf-motion-index': index++ } as CSSProperties;
    return cloneElement(child, { style });
  });
}

type Collection = 'ul' | 'ol' | 'div';

/**
 * The streak strip's wave (04 §4.3): its days rise left to right, each
 * `index x 60ms` after the one before, on the enter easing, only on real
 * route entry. Reserved for the streak strip: a collection with no sequence
 * of its own uses `Stagger`.
 */
export function Wave({ entryKey, as: Tag = 'ol', className, children, ...rest }: {
  entryKey: string; as?: Collection; className?: string; children: ReactNode;
} & { [attribute: `aria-${string}` | `data-${string}`]: string | boolean | undefined }) {
  const entry = useRouteEntry(entryKey);
  return <Tag {...rest} className={className} data-wave={entry ? 'enter' : 'settled'}>{indexed(children)}</Tag>;
}

/**
 * A badge grid's staggered reveal (04 §4.4): each item fades and rises
 * `min(index, 10) x 45ms` after the first, only on real route entry.
 */
export function Stagger({ entryKey, as: Tag = 'ul', className, children, ...rest }: {
  entryKey: string; as?: Collection; className?: string; children: ReactNode;
} & { [attribute: `aria-${string}` | `data-${string}`]: string | boolean | undefined }) {
  const entry = useRouteEntry(entryKey);
  return <Tag {...rest} className={className} data-stagger={entry ? 'enter' : 'settled'}>{indexed(children)}</Tag>;
}

/**
 * The success wipe (04 §4.2): when `active` turns on, a solid success panel
 * with the check glyph and the item's own title covers the row from the top
 * edge, holds, then clears downwards, revealing the row already updated
 * underneath; `onDone` follows. Render it as the last child of the row. With reduced motion the panel never shows and
 * `onDone` runs at once. The words are the row's own title (data); the
 * outcome itself is announced by the surface's notice.
 */
export function SuccessWipe({ active, label, onDone }: { active: boolean; label: string; onDone?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!active) { setPlaying(false); return; }
    if (prefersMotion()) setPlaying(true);
    else done.current?.();
  }, [active]);
  const finish = (event: ReactAnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    setPlaying(false);
    done.current?.();
  };
  // The panel is the last child of the row it covers; the row becomes its positioned ancestor (motion.css).
  return playing ? <div className="lf-success-wipe" aria-hidden="true" onAnimationEnd={finish}>
    <Glyph name="check" /><span data-copy-role="data">{label}</span>
  </div> : null;
}

type Snapshot = { clone: HTMLElement; top: number; left: number; width: number; height: number } | null;

/**
 * The exercise slide (04 §4.1): when `step` changes, the outgoing card (the
 * element matched by `selector`, `.lf-learning-content` by default) is cloned
 * before the swap and slides out 14% of the track on the exit easing while the
 * incoming card slides in from 18% on the enter easing, both over
 * `--dur-transition`, overlapping by about 22%. The clone is inert and hidden
 * from assistive technology, and it carries the old foot, so the foot
 * cross-fades with the cards instead of snapping. A surface whose card already
 * has its own stage transition (`.lf-cpa-transition`) keeps it. With reduced
 * motion nothing is cloned: the new card is simply there.
 */
export class SequenceTransition extends Component<{ step: string; selector?: string; children: ReactNode }> {
  private host = createRef<HTMLDivElement>();
  private timers: number[] = [];

  private card(): HTMLElement | null {
    const card = this.host.current?.querySelector<HTMLElement>(this.props.selector ?? '.lf-learning-content') ?? null;
    return card && !card.classList.contains('lf-cpa-transition') ? card : null;
  }

  getSnapshotBeforeUpdate(previous: Readonly<{ step: string }>): Snapshot {
    if (previous.step === this.props.step || !prefersMotion() || !this.host.current) return null;
    const outgoing = this.card();
    if (!outgoing) return null;
    const box = outgoing.getBoundingClientRect(), frame = this.host.current.getBoundingClientRect();
    const clone = outgoing.cloneNode(true) as HTMLElement;
    return { clone, top: box.top - frame.top, left: box.left - frame.left, width: box.width, height: box.height };
  }

  componentDidUpdate(_previous: unknown, _state: unknown, snapshot: Snapshot) {
    if (!snapshot || !this.host.current) return;
    const incoming = this.card();
    if (!incoming) return;
    const { clone } = snapshot;
    for (const node of [clone, ...clone.querySelectorAll<HTMLElement>('[id]')]) node.removeAttribute('id');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    clone.classList.add('lf-sequence-leaving');
    Object.assign(clone.style, { insetBlockStart: `${snapshot.top}px`, insetInlineStart: `${snapshot.left}px`, inlineSize: `${snapshot.width}px`, blockSize: `${snapshot.height}px` });
    this.host.current.append(clone);
    incoming.classList.add('lf-sequence-entering');
    const clear = () => { clone.remove(); incoming.classList.remove('lf-sequence-entering'); };
    clone.addEventListener('animationend', () => clone.remove(), { once: true });
    incoming.addEventListener('animationend', (event) => { if (event.target === incoming) incoming.classList.remove('lf-sequence-entering'); });
    // A hidden tab runs no animation: clear on a timer as well (transition + its delay, with room).
    this.timers.push(window.setTimeout(clear, 1200));
  }

  componentWillUnmount() {
    this.timers.forEach((timer) => window.clearTimeout(timer));
  }

  render() {
    return <div ref={this.host} className="lf-sequence" data-sequence-step={this.props.step}>{this.props.children}</div>;
  }
}

/* ---------------------------------------------------------------------------
 * Press feedback (02 §9.1): a soft ring ripples from the touch point and a
 * haptic tick plays where supported. The scale press itself is CSS
 * (`--press-scale`).
 * ------------------------------------------------------------------------- */

/** The platform's sound off switch (lib/sound.ts `lf_sound_muted`) also silences the haptic tick. */
function hapticsOff() {
  try { return window.localStorage.getItem('lf_sound_muted') === '1'; } catch { return false; }
}

/**
 * One press: a haptic tick unless the platform's sound and haptics are
 * switched off, and, with motion allowed, a ring in the control's own on-*
 * colour (`currentColor`) that scales out from the pointer over `--dur-micro`
 * on `--ease-standard`. With reduced motion only the colour state change
 * remains. A disabled or pending control gives no feedback.
 */
export function pressFeedback(event: ReactPointerEvent<HTMLElement>) {
  const control = event.currentTarget;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (control.matches(':disabled, [aria-disabled="true"]')) return;
  // A label-wrapped control (the picture option) is as disabled as its input.
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
  // A control whose own box must not clip (the picture option's check badge sits on its corner) names a
  // clipping layer with [data-press-host]; the ring is drawn there, with the same coordinates.
  (control.querySelector(':scope > [data-press-host]') ?? control).append(ring);
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
