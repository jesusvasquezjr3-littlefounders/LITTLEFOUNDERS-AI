import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AudioLipSync } from './audioLipSync';
import { EXPRESSIONS, GESTURES, type ExpressionName, type GestureName } from './expressions';
import { AvatarRig, NEUTRAL_FRAME, type Frame, type RigSpec } from './rig';
import { VISEMES, speechLength, visemesFromText, type MouthPose, type SpeechLanguage, type VisemeEvent } from './visemes';

/*
 * A character avatar: the head and shoulders of Rho, Zara, Liruf or Dina drawn as a light 2D vector, alive but cheap.
 * It blinks, breathes, glances around, holds one of nineteen expressions (the brows, lids, nose, mouth corners and
 * cheeks each move), reacts with gestures, follows the pointer, and speaks. No 3D, no video, no network after its own
 * small file loads.
 *
 *  - `expression` is the resting face; changing it springs from one to the other, with a little overshoot.
 *  - `gaze` is 'cursor' (the default), 'idle' (look around now and then), or a fixed point `{ x, y }` from -1 to 1.
 *    Following the pointer moves only the iris and pupil inside each eye; the face and head do not deform. Resting
 *    the pointer on the avatar makes it smile; clicking or tapping it makes it react (`interactive`, on by default).
 *  - `speak(text, { language, rate, duration })` moves the mouth from the words (English, Spanish or Portuguese;
 *    the page's language by default). Give `duration` (the length of a recording of the same text) to fit the words
 *    to the audio. `speakAudio(media, { text })` follows an audio element while it plays: with `text` it follows the
 *    words stretched to the real length, without it the mouth follows the sound itself. The timeline form of `speak`
 *    takes the timing of a generated voice.
 *  - `react(gesture)` plays a short gesture over the held face.
 *  - Decorative by default (hidden from assistive technology). Pass `label` (a translated string) when the avatar
 *    carries meaning, and then also provide the same words as text on the page.
 *  - With reduced motion it holds still: no blinking, breathing, gestures or following; the mouth still moves while
 *    speaking.
 */

export type Character = 'rho' | 'zara' | 'liruf' | 'dina';

export type Gaze = 'cursor' | 'idle' | { x: number; y: number };

export interface SpeakOptions {
  language?: SpeechLanguage;
  rate?: number;
  duration?: number;
}

export interface AvatarHandle {
  /** Moves the mouth for a phrase (or a prepared timeline). Resolves when the speech ends or is stopped. */
  speak: (input: string | VisemeEvent[], options?: SpeakOptions) => Promise<void>;
  /** Follows an audio element while it plays. Resolves when it ends or pauses. */
  speakAudio: (media: HTMLMediaElement, options?: { text?: string; language?: SpeechLanguage }) => Promise<void>;
  stop: () => void;
  /** A short gesture over the held face. */
  react: (gesture: GestureName) => void;
}

export interface AvatarProps {
  character: Character;
  expression?: ExpressionName;
  gaze?: Gaze;
  /** Reacts to the pointer resting on it and to taps; on by default. */
  interactive?: boolean;
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

interface Speech {
  events: VisemeEvent[];
  length: number;
  clock: () => number;
  finished: () => boolean;
  audio: AudioLipSync | null;
  done: () => void;
}

interface Playing { name: GestureName; start: number }

interface Control {
  expression: ExpressionName;
  gaze: Gaze;
  speech: Speech | null;
  gestures: Playing[];
  hover: boolean;
  kick: (() => void) | null;
}

/** Every number of a frame, which the springs move one by one. */
const KEYS: readonly (keyof Frame)[] = [
  'lookX', 'lookY', 'turn', 'blinkL', 'blinkR', 'eyeOpenL', 'eyeOpenR', 'eyeTilt', 'pupil', 'browLiftL', 'browLiftR',
  'browTiltL', 'browTiltR', 'browSqueeze', 'noseWrinkle', 'mouthOpen', 'mouthWide', 'smile', 'smirk', 'pucker', 'press',
  'cheek', 'tilt', 'breath', 'nod', 'lean', 'bounce', 'lift',
];

/** Numbers that are computed each frame (blinking, breathing, gaze, nods), not sprung toward an expression. */
const COMPUTED: ReadonlySet<keyof Frame> = new Set(['blinkL', 'blinkR', 'breath', 'nod', 'bounce', 'lookX', 'lookY']);

const TAPS: readonly GestureName[] = ['jump', 'giggle', 'nod', 'wiggle', 'curious'];

const STIFFNESS = 210;

const DAMPING = 17;

function springStep(value: number, velocity: number, target: number, dt: number): [number, number] {
  let x = value;
  let v = velocity;
  const steps = Math.max(1, Math.ceil(dt / 0.008));
  const h = dt / steps;

  for (let i = 0; i < steps; i++) {
    v += (STIFFNESS * (target - x) - DAMPING * v) * h;
    x += v * h;
  }

  return [x, v];
}

const mix = (a: MouthPose, b: MouthPose, t: number): MouthPose => ({
  open: a.open + (b.open - a.open) * t,
  wide: a.wide + (b.wide - a.wide) * t,
  pucker: a.pucker + (b.pucker - a.pucker) * t,
  press: a.press + (b.press - a.press) * t,
});

/** The mouth shape of a timeline at time `at`, looking a little ahead so lips close before the sound arrives. */
function poseAt(events: VisemeEvent[], at: number): MouthPose {
  let index = 0;

  for (let i = 0; i < events.length; i++) { if ((events[i]?.at ?? 0) <= at) index = i; else break; }

  const current = VISEMES[events[index]?.viseme ?? 'rest'];
  const next = events[index + 1];

  if (!next) return current;

  const ahead = next.at - at;

  return ahead < 0.05 ? mix(current, VISEMES[next.viseme], (1 - ahead / 0.05) * 0.6) : current;
}

export const Avatar = forwardRef<AvatarHandle, AvatarProps>(function Avatar({ character, expression = 'neutral', gaze = 'cursor', interactive = true, label, className }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const control = useRef<Control>({ expression, gaze, speech: null, gestures: [], hover: false, kick: null });

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
      const events = Array.isArray(input) ? input : visemesFromText(input, options);
      const origin = performance.now() / 1000;

      control.current.speech?.done();

      return new Promise<void>((resolve) => {
        const length = speechLength(events);
        const clock = () => performance.now() / 1000 - origin;

        control.current.speech = { events, length, clock, finished: () => clock() >= length + 0.15, audio: null, done: resolve };
        control.current.kick?.();
      });
    },
    speakAudio(media, options) {
      control.current.speech?.done();

      return new Promise<void>((resolve) => {
        const audio = AudioLipSync.of(media);
        let events: VisemeEvent[] = [];
        let over = false;
        const end = () => { over = true; media.removeEventListener('ended', end); media.removeEventListener('pause', end); };

        media.addEventListener('ended', end);
        media.addEventListener('pause', end);
        void audio.resume();

        const arm = () => {
          if (options?.text) events = visemesFromText(options.text, { language: options.language, duration: Number.isFinite(media.duration) ? media.duration : undefined });

          if (control.current.speech) control.current.speech.events = events;
        };

        control.current.speech = { events, length: Infinity, clock: () => media.currentTime, finished: () => over, audio, done: resolve };
        arm();
        media.addEventListener('loadedmetadata', arm, { once: true });
        control.current.kick?.();
      });
    },
    stop() {
      control.current.speech?.done();
      control.current.speech = null;
    },
    react(gesture) {
      if (prefersReducedMotion()) return;

      control.current.gestures.push({ name: gesture, start: performance.now() / 1000 });
      control.current.kick?.();
    },
  }), []);

  useEffect(() => {
    const element = host.current;
    const svg = element?.querySelector('svg');

    if (!loaded || !element || !svg) return;

    const box = element;
    const rig = new AvatarRig(svg, loaded.spec);
    const reduced = prefersReducedMotion();
    const state: Frame = { ...NEUTRAL_FRAME };
    const velocity: Frame = { ...NEUTRAL_FRAME };
    const look = { x: 0, y: 0 };
    const hover = { amount: 0 };
    const talk = { mix: 0, pose: mix(VISEMES.rest, VISEMES.rest, 0) };
    const pointer = { x: 0, y: 0, seen: -10 };
    const idle = { x: 0, y: 0, next: 1 };
    const blink = { next: 1.5 + Math.random() * 2, start: -1, twice: false };
    let visible = true;
    let frameRequest = 0;
    let last = performance.now() / 1000;
    let settled = 0;

    for (const key of KEYS) velocity[key] = 0;

    const onPointer = (event: PointerEvent) => { pointer.x = event.clientX; pointer.y = event.clientY; pointer.seen = performance.now() / 1000; };

    const onEnter = () => { control.current.hover = true; schedule(); };

    const onLeave = () => { control.current.hover = false; };

    const onTap = () => { control.current.gestures.push({ name: TAPS[Math.floor(Math.random() * TAPS.length)] ?? 'nod', start: performance.now() / 1000 }); schedule(); };

    const watch = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true;

 if (visible) schedule(); }, { threshold: 0 }) : null;

    if (!reduced) {
      window.addEventListener('pointermove', onPointer, { passive: true });

      if (interactive) {
        box.addEventListener('pointerenter', onEnter);
        box.addEventListener('pointerleave', onLeave);
        box.addEventListener('pointerdown', onTap);
      }
    }

    watch?.observe(box);

    function tick() {
      frameRequest = 0;

      if (!visible || document.hidden) return;

      const { expression: name, gaze: mode, speech } = control.current;
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - last);

      last = now;

      const target: Frame = { ...NEUTRAL_FRAME, ...loaded?.spec.baseline, ...EXPRESSIONS[name] };

      // the expression: every number springs to its target (instantly when motion is reduced)
      for (const key of KEYS) {
        if (COMPUTED.has(key)) continue;

        if (reduced) { state[key] = target[key]; continue; }

        const [x, v] = springStep(state[key], velocity[key], target[key], dt);

        state[key] = x;
        velocity[key] = v;
      }

      // where to look: the pointer, a glance, or a fixed point
      let wantX = 0;
      let wantY = 0;

      if (!reduced) {
        if (mode !== 'cursor' && mode !== 'idle') { wantX = mode.x; wantY = mode.y; }
        else if (mode === 'cursor' && now - pointer.seen < 4) {
          const rect = box.getBoundingClientRect();
          const dx = pointer.x - (rect.left + rect.width / 2);
          const dy = pointer.y - (rect.top + rect.height * 0.42);
          const distance = Math.hypot(dx, dy) || 1;
          const strength = Math.min(1, distance / 260);

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

      // the eyes lead and the head follows a moment later
      look.x += (wantX - look.x) * (reduced ? 1 : 1 - Math.exp(-dt * 11));
      look.y += (wantY - look.y) * (reduced ? 1 : 1 - Math.exp(-dt * 11));
      state.lookX = look.x;
      state.lookY = look.y;

      hover.amount += ((control.current.hover ? 1 : 0) - hover.amount) * (1 - Math.exp(-dt * 7));

      // blinking and breathing
      let blinkNow = 0;

      if (!reduced) {
        if (blink.start < 0 && now > blink.next) { blink.start = now; blink.twice = Math.random() < 0.15; }

        if (blink.start >= 0) {
          const p = (now - blink.start) / 0.2;

          blinkNow = p < 0.4 ? p / 0.4 : Math.max(0, 1 - (p - 0.4) / 0.6);

          if (p >= 1) { blinkNow = 0; blink.start = blink.twice ? now + 0.05 : -1; blink.next = now + 2.4 + Math.random() * 3.2; blink.twice = false; }
        }

        state.breath = Math.sin(now * 1.7);
      } else { state.breath = 0; }

      // gestures add to the frame while they play, then hand back to the held face
      const add: Frame = { ...NEUTRAL_FRAME };

      for (const key of KEYS) add[key] = 0;

      control.current.gestures = control.current.gestures.filter((play) => {
        const gesture = GESTURES[play.name];
        const p = (now - play.start) / gesture.duration;

        if (p >= 1) return false;

        const values: Partial<Frame> = gesture.at(p);

        for (const key of KEYS) add[key] += values[key] ?? 0;

        return true;
      });

      const moving = control.current.speech !== null || control.current.gestures.length > 0 || hover.amount > 0.01 || talk.mix > 0.01;

      // speech: the mouth follows the timeline, or the sound itself, and the face joins in a little
      let spoken: MouthPose = VISEMES.rest;

      if (speech) {
        if (speech.finished()) { speech.done(); control.current.speech = null; }
        else if (speech.audio && speech.events.length === 0) spoken = speech.audio.sample();
        else spoken = poseAt(speech.events, speech.clock());
      }

      const talking = control.current.speech !== null;

      talk.mix += ((talking ? 1 : 0) - talk.mix) * (1 - Math.exp(-dt * 12));
      talk.pose = mix(talk.pose, spoken, 1 - Math.exp(-dt * (reduced ? 60 : 30)));

      const out: Frame = { ...state };

      for (const key of KEYS) out[key] += add[key];

      out.mouthOpen = state.mouthOpen * (1 - 0.5 * talk.mix) + talk.pose.open;
      out.mouthWide = state.mouthWide * (1 + (talk.pose.wide - 1) * talk.mix);
      out.pucker = state.pucker + talk.pose.pucker;
      out.press = Math.min(1, state.press + talk.pose.press);
      out.smile = state.smile * (1 - 0.35 * talk.mix) + hover.amount * 0.4;
      out.cheek = state.cheek + hover.amount * 0.3;
      out.lean = state.lean + add.lean + hover.amount * 0.3;
      out.blinkL = Math.max(blinkNow, add.blinkL);
      out.blinkR = Math.max(blinkNow, add.blinkR);
      out.nod = add.nod + talk.pose.open * 0.1 * talk.mix;
      out.bounce = add.bounce;
      out.browLiftL += talk.pose.open * 0.16 * talk.mix;
      out.browLiftR += talk.pose.open * 0.16 * talk.mix;
      out.turn = state.turn + add.turn;
      out.tilt = state.tilt + add.tilt;
      out.lift = state.lift + add.lift;

      rig.apply(out);

      const stillSettling = KEYS.some((key) => !COMPUTED.has(key) && Math.abs(state[key] - target[key]) > 0.002);

      settled = moving || stillSettling ? 0 : settled + 1;

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
      box.removeEventListener('pointerenter', onEnter);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('pointerdown', onTap);
      document.removeEventListener('visibilitychange', wake);
      watch?.disconnect();
      control.current.kick = null;
    };
  }, [loaded, interactive]);

  // a new expression wakes the loop, which stops by itself when motion is reduced and nothing is changing
  useEffect(() => { control.current.kick?.(); }, [expression, gaze]);

  const ratio = loaded ? loaded.spec.viewBox[2] / loaded.spec.viewBox[3] : 1;
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };

  return <div ref={host} className={className} style={{ aspectRatio: String(ratio) }} {...a11y} dangerouslySetInnerHTML={markup} />;
});
