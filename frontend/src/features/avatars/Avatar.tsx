import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { EXPRESSIONS, type ExpressionName } from './expressions';
import { AvatarRig, NEUTRAL_FRAME, type Frame, type RigSpec } from './rig';
import { VISEMES, speechLength, visemesFromText, type VisemeEvent } from './visemes';

/*
 * A character avatar: the head and shoulders of Rho, Zara, Liruf or Dina drawn as a light 2D vector, alive but cheap.
 * It blinks, breathes, follows the pointer with its eyes and a small head turn, holds an expression, and moves its
 * mouth when it speaks. No 3D, no video, no network after its own small file loads (about 5 to 13 KB).
 *
 *  - `expression` is the resting face; changing it eases from one to the other.
 *  - `gaze` is 'cursor' (follow the pointer, the default), 'idle' (look around now and then), or a fixed point
 *    `{ x, y }` from -1 to 1.
 *  - `speak(text | timeline)` moves the mouth and resolves when it ends. The timeline form is for the generated
 *    voice, whose timing replaces the text-based guess.
 *  - Decorative by default (hidden from assistive technology). Pass `label` (a translated string) when the avatar
 *    carries meaning, and then also provide the same words as text on the page.
 *  - With reduced motion it holds still: no blinking, breathing or following; the mouth still moves while speaking.
 */

export type Character = 'rho' | 'zara' | 'liruf' | 'dina';

export type Gaze = 'cursor' | 'idle' | { x: number; y: number };

export interface AvatarHandle {
  /** Moves the mouth for a phrase (or a prepared timeline). Resolves when the speech ends or is stopped. */
  speak: (input: string | VisemeEvent[], options?: { rate?: number }) => Promise<void>;
  stop: () => void;
  /** A small reaction: a nod, a blink, or a happy wiggle. */
  react: (kind: 'nod' | 'blink' | 'wiggle') => void;
}

export interface AvatarProps {
  character: Character;
  expression?: ExpressionName;
  gaze?: Gaze;
  label?: string;
  className?: string;
}

const SVGS = import.meta.glob<string>('./assets/*.svg', { query: '?raw', import: 'default' });

const RIGS = import.meta.glob<RigSpec>('./assets/*.rig.json', { import: 'default' });

interface Loaded { markup: string; spec: RigSpec }

const cache = new Map<Character, Promise<Loaded>>();

function load(character: Character): Promise<Loaded> {
  let found = cache.get(character);

  if (!found) {
    const svg = SVGS[`./assets/${character}.svg`];
    const rig = RIGS[`./assets/${character}.rig.json`];

    found = Promise.all([svg?.(), rig?.()]).then(([markup, spec]) => {
      if (markup === undefined || !spec) throw new Error(`No avatar named ${character}`);

      return { markup, spec };
    });
    cache.set(character, found);
  }

  return found;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const ease = (current: number, target: number, dt: number, rate: number) => current + (target - current) * (1 - Math.exp(-dt * rate));

interface Control {
  expression: ExpressionName;
  gaze: Gaze;
  speech: Speech | null;
  nodAt: number;
  blinkAt: number;
  wiggleAt: number;
  kick: (() => void) | null;
}

interface Speech { events: VisemeEvent[]; length: number; start: number; done: () => void }

export const Avatar = forwardRef<AvatarHandle, AvatarProps>(function Avatar({ character, expression = 'neutral', gaze = 'cursor', label, className }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const control = useRef<Control>({ expression, gaze, speech: null, nodAt: -1, blinkAt: -1, wiggleAt: -1, kick: null });

  control.current.expression = expression;
  control.current.gaze = gaze;

  useEffect(() => {
    let live = true;

    setLoaded(null);
    void load(character).then((value) => { if (live) setLoaded(value); }, () => {});

    return () => { live = false; };
  }, [character]);

  const markup = useMemo(() => ({ __html: loaded?.markup ?? '' }), [loaded]);

  useImperativeHandle(ref, () => ({
    speak(input, options) {
      const events = Array.isArray(input) ? input : visemesFromText(input, options?.rate);

      control.current.speech?.done();

      return new Promise<void>((resolve) => {
        control.current.speech = { events, length: speechLength(events), start: performance.now() / 1000, done: resolve };
        control.current.kick?.();
      });
    },
    stop() {
      control.current.speech?.done();
      control.current.speech = null;
    },
    react(kind) {
      const now = performance.now() / 1000;

      if (kind === 'nod') control.current.nodAt = now;
      else if (kind === 'blink') control.current.blinkAt = now;
      else control.current.wiggleAt = now;

      control.current.kick?.();
    },
  }), []);

  useEffect(() => {
    const element = host.current;
    const svg = element?.querySelector('svg');

    if (!loaded || !element || !svg) return;

    const rig = new AvatarRig(svg, loaded.spec);
    const reduced = prefersReducedMotion();
    const state = { ...NEUTRAL_FRAME };
    const look = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0, seen: -10 };
    const idle = { x: 0, y: 0, next: 1 };
    const blink = { next: 1.5 + Math.random() * 2, start: -1, twice: false };
    let visible = true;
    let frameRequest = 0;
    let last = performance.now() / 1000;
    let settled = 0;

    const onPointer = (event: PointerEvent) => { pointer.x = event.clientX; pointer.y = event.clientY; pointer.seen = performance.now() / 1000; };

    const watch = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true;

 if (visible) schedule(); }, { threshold: 0 }) : null;

    if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });

    watch?.observe(element);

    function tick() {
      frameRequest = 0;

      if (!visible || document.hidden) return;

      const { expression: name, gaze: mode, speech } = control.current;
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - last);

      last = now;

      const target: Frame = { ...NEUTRAL_FRAME, ...EXPRESSIONS[name] };
      const speed = reduced ? 60 : 9;

      for (const key of ['browLift', 'browTilt', 'eyeOpen', 'mouthOpen', 'mouthWide', 'cheek', 'tilt'] as const) state[key] = ease(state[key], target[key], dt, speed);

      // gaze
      let wantX = 0;
      let wantY = 0;

      if (!reduced) {
        if (mode !== 'cursor' && mode !== 'idle') { wantX = mode.x; wantY = mode.y; }
        else if (mode === 'cursor' && now - pointer.seen < 4) {
          const box = element!.getBoundingClientRect();
          const dx = pointer.x - (box.left + box.width / 2);
          const dy = pointer.y - (box.top + box.height * 0.42);
          const distance = Math.hypot(dx, dy) || 1;
          const strength = Math.min(1, distance / 320);

          wantX = (dx / distance) * strength;
          wantY = (dy / distance) * strength;
        } else {
          if (now > idle.next) { idle.x = (Math.random() - 0.5) * 1.1; idle.y = (Math.random() - 0.5) * 0.7; idle.next = now + 1.2 + Math.random() * 2.6; }

          wantX = idle.x;
          wantY = idle.y;
        }
      }

      wantX = Math.max(-1, Math.min(1, wantX + target.lookX));
      wantY = Math.max(-1, Math.min(1, wantY + target.lookY));
      look.x = ease(look.x, wantX, dt, reduced ? 60 : 8);
      look.y = ease(look.y, wantY, dt, reduced ? 60 : 8);
      state.lookX = look.x;
      state.lookY = look.y;

      // blinking and breathing
      if (!reduced) {
        if (control.current.blinkAt > 0) { blink.start = control.current.blinkAt; control.current.blinkAt = -1; }
        else if (now > blink.next && blink.start < 0) { blink.start = now; blink.twice = Math.random() < 0.15; }

        if (blink.start >= 0) {
          const p = (now - blink.start) / 0.2;

          state.blink = p < 0.4 ? p / 0.4 : Math.max(0, 1 - (p - 0.4) / 0.6);

          if (p >= 1) { state.blink = 0; blink.start = blink.twice ? now + 0.05 : -1; blink.next = now + 2.4 + Math.random() * 3.2; blink.twice = false; }
        }

        state.breath = Math.sin(now * 1.7);
      } else { state.blink = 0; state.breath = 0; }

      // a nod, and a wiggle that is a quick tilt
      const nodP = control.current.nodAt > 0 ? (now - control.current.nodAt) / 0.5 : 2;

      state.nod = nodP < 1 ? Math.sin(nodP * Math.PI) : 0;

      const wiggleP = control.current.wiggleAt > 0 ? (now - control.current.wiggleAt) / 0.7 : 2;
      const wiggle = wiggleP < 1 ? Math.sin(wiggleP * Math.PI * 3) * (1 - wiggleP) * 4 : 0;

      // speech
      let open = state.mouthOpen;
      let wide = state.mouthWide;

      if (speech) {
        const at = now - speech.start;

        if (at >= speech.length + 0.15) { speech.done(); control.current.speech = null; }
        else {
          let current = speech.events[0];

          for (const event of speech.events) { if (event.at <= at) current = event; else break; }

          const mouthLook = VISEMES[current?.viseme ?? 'rest'];

          open = Math.max(open * 0.5, mouthLook.open);
          wide = mouthLook.wide * state.mouthWide;
        }
      }

      const out: Frame = { ...state, mouthOpen: open, mouthWide: wide, tilt: state.tilt + wiggle };

      rig.apply(out);

      const moving = !reduced || control.current.speech !== null || nodP < 1 || wiggleP < 1;

      settled = moving ? 0 : settled + 1;

      if (!reduced || settled < 8) schedule();
    }

    function schedule() {
      if (!frameRequest) { last = performance.now() / 1000; frameRequest = requestAnimationFrame(tick); }
    }

    control.current.kick = schedule;
    schedule();

    const wake = () => schedule();

    document.addEventListener('visibilitychange', wake);

    return () => {
      cancelAnimationFrame(frameRequest);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', wake);
      watch?.disconnect();
      control.current.kick = null;
    };
  }, [loaded]);

  // a new expression wakes the loop, which stops by itself when motion is reduced and nothing is changing
  useEffect(() => { control.current.kick?.(); }, [expression, gaze]);

  const ratio = loaded ? loaded.spec.viewBox[2] / loaded.spec.viewBox[3] : 1;
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };

  return <div ref={host} className={className} style={{ aspectRatio: String(ratio) }} {...a11y} dangerouslySetInnerHTML={markup} />;
});
