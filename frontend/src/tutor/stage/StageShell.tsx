import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useStageAnnouncement } from './useStageAnnouncement';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui';
import { APP_HOME } from '@/routes/app/navConfig';
import { TutorStage, type TutorStageProps } from '@/tutor-scene/TutorStage';
import { AnchorProvider } from '@/tutor-scene/ScreenAnchor';
import { SafeAreaProvider, useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { atmosphereFor } from '@/tutor-scene/atmosphere';
import type { QualitySettings } from '@/tutor-scene/quality';
import { HudPlate } from '@/tutor/hud/HudPlate';
import { MicOrb, type MicBlockedReason, type MicOrbState } from '@/tutor/hud/MicOrb';
import type { CharacterCue } from '@/lesson-engine/core/types';
import type { Microphone } from '@/tutor/useMicrophone';
import type { StagePhase } from './phases';
import type { ReplayDirector } from '@/tutor/replay/useReplayDirector';
import type {
  SessionSummary,
  StartedSession,
  TutorCatalog,
  TutorOffers,
  TutorPreferences,
} from '@/tutor/types';
import type { StartSessionInput } from '@/tutor/tutorApi';
import type { TutorSocket } from '@/tutor/useTutorSocket';

/*
 * The Tutor's continuous shell: ONE canvas, mounted once, for the whole route.
 *
 * THE STAGE IS THE PAGE (/DESIGN.md → Screen Recipes → Tutor). This layer is
 * `fixed inset-0`, outside the app shell and outside `mx-auto max-w-container`,
 * because a 3D stage rendered inside a 1200 px reading column is a picture of a
 * stage rather than a place — which is exactly what the first Tutor shipped as
 * and exactly what was rejected.
 *
 * ONE MOUNT, NEVER A REMOUNT. The experience above used to return a different
 * tree per phase, so moving from personalize to a conversation unmounted the
 * canvas and mounted a new one: the island refetched through a Suspense
 * fallback and the learner watched their own world blink at every phase
 * boundary. A place that blinks is not a place. So the phase changes exactly
 * two things — the SHOT the camera travels to, and which HUD layer is on top —
 * and the scene underneath is continuous from the first frame to the last.
 *
 * WHAT THIS FILE OWNS, and deliberately nothing else: the full-bleed layer, the
 * single `TutorStage`, the two providers the HUD needs (anchors and safe area),
 * the first-frame veil, and the one control that leaves the route. Everything a
 * learner reads or presses belongs to a HUD layer passed in as `children`. The
 * seams those layers build against are the prop types at the bottom of this
 * file.
 */

/*
 * The phase vocabulary and the shot mapping live in `./phases`, which imports
 * nothing, and are re-exported here so product code still has one import site.
 * The split exists so the mapping can be unit-tested without booting a
 * renderer; this file cannot be, because it mounts one.
 */
export { shotForPhase, STAGE_PHASES } from './phases';
export type { StagePhase, StageShotInput } from './phases';

// ── The microphone, and the dock it stands on ───────────────────────────────

/**
 * Everything the ONE microphone needs, whichever phase the route is in.
 *
 * THE ORB IS A PROPERTY OF THE STAGE, NOT OF A LAYER, and that is the fix
 * rather than a refactor. It was mounted in exactly two layers, so the four
 * other phases — including the first screen a new learner ever sees — had no
 * microphone at all. Two owners also meant two `useMicrophone` calls, two
 * blocked-reason narrowings and two sets of positioning classes, which is three
 * chances for the hero control to disagree with itself. It is mounted here,
 * once, for the whole route; `stage/micForPhase.ts` decides what it is doing.
 */
export interface StageMicProps {
  /**
   * Whether the orb is mounted in this phase at all.
   *
   * REQUIRED, and required on purpose: the whole reason the orb moved here was
   * that four phases had silently forgotten to mount one, and an optional flag
   * defaulting to `true` would let the next phase forget just as silently in the
   * other direction. `stage/micForPhase.ts` decides it, per phase, in one place.
   *
   * It is `false` in exactly one phase today — `closing`, where the microphone
   * was sitting on top of the button the learner needs. The reasoning, and the
   * measurements, are on `StageMicPlan.present`.
   */
  present: boolean;
  state: MicOrbState;
  microphone: Microphone;
  /** Core's reason, when Core is the one refusing. */
  blockedReason?: MicBlockedReason | null;
  /** A phase's own reason, already translated. Wins over `blockedReason`. */
  blockedCopy?: string | null;
  /** What the orb says at rest, when "Hold to talk" would be a lie. */
  idleCopy?: string;
  /** True when the browser itself refused; shown as a line beside the orb. */
  denied?: boolean;
  onClip: (clip: Blob | null) => void;
  onInterrupt?: () => void;
}

/**
 * The bottom cluster, and the two places a layer may add a row to it.
 *
 * The orb, the composer, a refusal and an adaptation question all have to stack
 * in one column above one bottom edge — an edge the lesson sheet moves on every
 * frame of a drag. Only one element can own that edge, so the shell owns it and
 * layers contribute rows through a portal: their state stays local (a keystroke
 * in the composer must not re-render the island), while the DOM order and the
 * measured rect stay in one place.
 */
export interface StageDockValue {
  /** Rows that ride ABOVE the orb: a question, a refusal. */
  above: HTMLElement | null;
  /** Rows that ride BELOW it: the composer. */
  below: HTMLElement | null;
  /**
   * Keep the dock clear of a surface this many pixels tall, measured from the
   * bottom of the viewport.
   *
   * Imperative, and called on EVERY frame of a sheet drag, so it writes a style
   * and never calls `setState`. Zero hands the resting inset back to the class.
   */
  setFootprint: (px: number) => void;
  /**
   * The same thing for a surface that simply HAS a height rather than
   * publishing one: a ref callback that observes the node and keeps the dock
   * above it. Pass null to release it.
   */
  keepClearOf: (node: HTMLElement | null) => void;
  /**
   * Whether a large plate is holding the bottom-RIGHT corner at this instant,
   * so the dock centres itself in the width that is LEFT rather than under a
   * plate.
   *
   * PUBLISHED BY THE PLATE, NEVER GUESSED FROM THE PHASE. It used to be
   * `phase === 'conversing' || phase === 'personalizing'`, and that constant
   * went stale the moment the lesson plate learned to stand down for an
   * adaptation question: an offer is still the `conversing` phase, the plate is
   * `display: none` with a footprint of zero, and the dock went on clearing
   * 480 px of empty island. Measured on `/dev/tutor-lab` at 1280x800 — the
   * question, its two answers and the microphone were all centred on x = 400
   * against a viewport centre of 640, on the one screen /DESIGN.md describes as
   * "one character putting a question to another in front of the learner".
   *
   * It is a low-frequency boolean — at most one change per phase or breakpoint
   * — so unlike `setFootprint` it is allowed to be state and to re-render the
   * shell. Pass `false` on unmount; the last publisher wins, exactly as with
   * the footprint.
   */
  setCornerPlate: (occupied: boolean) => void;
}

const StageDockContext = createContext<StageDockValue | null>(null);

/** The dock, or null where no shell is mounted (the lab, a unit test). */
export function useStageDock(): StageDockValue | null {
  return useContext(StageDockContext);
}

/**
 * Breathing room between the top of a bottom surface and the dock above it.
 *
 * Exported (not imported elsewhere on purpose — see `LessonPlate.tsx`'s
 * `MIC_DOCK_GAP_PX`, which mirrors this number rather than importing it, so
 * that file's tests never have to load this one's three.js stage graph): the
 * dock rides `bottom: sheetFootprint + DOCK_GAP_PX` with nothing clamping how
 * far up that can push it, so `LessonPlate`'s own ceiling arithmetic has to
 * know this number too. Found by adversarial review, round 91 (2026-08-31,
 * HIGH): a landscape phone's FULL detent could grow tall enough that this
 * offset pushed the mic orb and composer entirely off the top of the
 * viewport — not an overlap with the sheet (this gap is exactly what
 * prevents that), but off-screen above it, which is worse.
 */
export const DOCK_GAP_PX = 12;

// ── The shell ───────────────────────────────────────────────────────────────

/*
 * THE SHELL NO LONGER TAKES A PHASE, and its absence is the point.
 *
 * It used to, "for exactly one thing: whether the dock sits centred or beside
 * the corner plate" — and that one thing was the wrong owner for the fact. A
 * phase cannot see whether the plate is in its desktop form, and it cannot see
 * whether the plate has stood down for an adaptation question, which is a state
 * inside the `conversing` phase. Both facts belong to the plate, and the plate
 * publishes them now (`StageDockValue.setCornerPlate`). The shot was never
 * computed here either, so with the corner claim published the shell has no use
 * for the phase at all: a prop nothing reads is a second source of truth
 * waiting for somebody to trust it.
 */
/*
 * `onQuality` is omitted deliberately: the shell OWNS it. The tier decides
 * whether the HUD's material keeps its blur (/DESIGN.md §Lumen → The blur,
 * profiled), and the shell is the only element that both hears the scene and
 * contains every plate — so a caller supplying its own handler would either be
 * ignored or would fight the one that matters.
 */
export interface StageShellProps extends Omit<TutorStageProps, 'className' | 'onQuality'> {
  /** The one microphone. Never optional: absence is the bug this closed. */
  mic: StageMicProps;
  /**
   * What the bottom cluster IS, in this phase, for a screen reader.
   *
   * The dock is a landmark group, and its name was the constant "Talk to your
   * tutor" — which is true in the four phases the orb stands in and a plain lie
   * in the two it does not. /DESIGN.md already says the dock is "the phase's
   * bottom cluster whether or not the orb is in it"; a learner on a screen
   * reader hearing "Talk to your tutor" around a play button and a "back to the
   * tutor" chip is being told the opposite of what the phase is for.
   *
   * Optional, defaulting to the microphone's own name, so the phases that
   * really are about talking say nothing new.
   */
  dockLabel?: string;
  /**
   * The HUD. One layer per phase, rendered over the same canvas, never instead
   * of it. Layers are ordinary DOM: the mesh is the delightful path and the DOM
   * is the guaranteed one, and this is the guaranteed one.
   */
  children?: ReactNode;
  /**
   * The veil opened on the deadline, not a real frame — see
   * `useStageAnnouncement`'s own comment on why the gate cannot wait forever.
   *
   * Found live in this environment, 2026-09-01: `ready` (below, on every
   * layer) going true on the timeout correctly lifts the VEIL (the thing this
   * flag was built for) but says nothing to the ANCHOR PROJECTOR
   * (`ScreenAnchor.tsx`), which is a separate, `useFrame`-driven system that
   * starts every node `hidden`/`inert` and only ever un-hides one from
   * INSIDE a render callback that, on a timeout, never once fires. A learner
   * whose stage times out — no WebGL, a backgrounded tab, a slow device —
   * got a lifted veil over a caption that stayed invisible for the entire
   * session: the exact "tutor cannot speak" class /AGENTS.md §1.0 names as
   * the worst outcome here, just on the TEXT channel instead of audio, which
   * this flag's own sibling (the speech gate) already defends. A layer that
   * positions anything via the anchor system must treat `ready && !timedOut`
   * as its real "safe to project" signal, and fall back to the same
   * no-projection rendering it already uses for `ready === false`.
   */
  onTimedOut?: () => void;
}

/**
 * How long the veil may cover a stage that has not reported a first frame.
 *
 * There are real, reachable states in which the frame never arrives: a device
 * with no WebGL at all renders an honest "this device cannot show 3D" line
 * INSTEAD of a canvas, and the scene deliberately does not render while its tab
 * is in the background. In both cases `onReady` is never called, and a veil that
 * waits for it forever covers the very message that explains what happened. So
 * it lifts on a timer as well, and what is underneath is then whatever is
 * actually true.
 *
 * INVESTIGATED, NOT CHANGED. RUNBOOK.md Round 111 flagged this deadline as
 * a risk without reproducing why it was ever needed, and the leading
 * hypothesis chased here was that `TutorScene` renders its diorama and its
 * two principals as three unwrapped `useLoader` calls — siblings across
 * nested Suspense boundaries — and that React abandons a boundary's
 * not-yet-reached siblings the instant an earlier one throws, which would
 * serialize three assets that could load at once. A faithful,
 * nested reproduction of that exact shape
 * (`tutor-scene/__tests__/suspenseLoadOrdering.test.tsx`) disproves it:
 * React 18 discovers every pending suspend in ONE synchronous pass
 * regardless of nesting, so all three fetches already start together today,
 * and staggering their delays showed no duplicate fetch and no
 * re-triggering either. There is therefore no confirmed architectural
 * reason to shrink this number — what is left is ordinary network/decode
 * latency for real .glb + KTX2 assets on a slow connection or a cold cache,
 * which is not a code defect, and this codebase has no production
 * telemetry (the Tutor's event vocabulary is closed by design, /ORACLE.md
 * §13) on how often 8s is actually needed versus merely available. Changing
 * it without either would be a guess wearing a number.
 */
const VEIL_TIMEOUT_MS = 8000;

/**
 * "Your browser has muted this page — tap to let the tutor speak."
 *
 * Deliberately a chip and not a dialog. The conversation is fully usable
 * without sound (every line is captioned, §16), so blocking the stage behind a
 * modal would punish the learner for a decision their browser made. Tapping it
 * IS a user gesture, which is what `armAudioUnlock` is waiting for, so the
 * control fixes the thing it is complaining about simply by being pressed.
 */
function SoundBlockedNotice({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-40 flex justify-center px-4">
      <button
        type="button"
        onClick={onDismiss}
        className="lf-lumen pointer-events-auto flex max-w-[min(92vw,26rem)] items-center gap-2 rounded-full px-4 py-2 text-left"
      >
        <Icon name="volume_off" className="shrink-0 text-[18px] text-content-muted" aria-hidden />
        <span className="lf-caption text-content">{t('tutor.stage.soundBlocked')}</span>
      </button>
    </div>
  );
}

export function StageShell(props: StageShellProps) {
  /*
   * Both providers sit ABOVE the canvas so the HUD and the scene share one
   * registry. `TutorScene` mounts its own anchor provider only when it cannot
   * find an inherited one, so hoisting here is what lets a chip outside the
   * canvas ride a point inside it.
   *
   * The shell itself is a CHILD of them rather than the component that renders
   * them, because it is now a consumer too: the dock publishes its own rect on
   * the `mic` safe-area slot so the camera composes the character into the band
   * above it, and a component cannot read a context it renders.
   */
  return (
    <SafeAreaProvider>
      <AnchorProvider>
        <StageShellInner {...props} />
      </AnchorProvider>
    </SafeAreaProvider>
  );
}

function StageShellInner({
  children,
  mic,
  dockLabel,
  onReady,
  onTimedOut,
  onSpeechBlocked,
  ...stage
}: StageShellProps) {
  /*
   * THE BROWSER REFUSED TO MAKE A SOUND, AND THE LEARNER IS TOLD.
   *
   * The Tutor speaks before anyone has touched the page, which every autoplay
   * policy blocks. The rejection used to vanish into a `.catch()`: the mouth
   * closed, nothing was heard, and the product looked broken with no way for
   * the learner to fix it. `audioUnlock` earns the permission back on the first
   * gesture; this is what happens when even that is refused.
   */
  const [soundBlocked, setSoundBlocked] = useState(false);
  const handleSpeechBlocked = useCallback(
    (blocked: boolean) => {
      setSoundBlocked(blocked);
      onSpeechBlocked?.(blocked);
    },
    [onSpeechBlocked],
  );
  const { t } = useTranslation();
  const navigate = useNavigate();
  const safeArea = useSafeArea();

  /*
   * Memoised on the one thing that can change it. Without this the style object
   * is a new identity on every re-render of the shell, React writes the four
   * properties again, and the browser invalidates style on the whole HUD for a
   * value that did not move.
   *
   * `auto` publishes nothing and lets the stylesheet's own light/dark defaults
   * stand, which is also why the stage needs no ThemeProvider to render.
   */
  const atmosphere = useMemo(() => atmosphereFor(stage.backdrop ?? 'auto'), [stage.backdrop]);

  /*
   * The veil is state and the projection is a ref, and the difference is not
   * arbitrary: this flips exactly once per route, whereas an anchored node
   * moves every frame. One re-render at the moment the island appears is free;
   * sixty a second would cost more than the scene.
   */
  /*
   * The veil AND the speech gate, with a deadline on the gate. See
   * `useStageAnnouncement` for why the gate cannot wait on the first frame
   * forever — a tutor that is silent for a whole session, and a microphone that
   * opens at the wrong moment because of it, was the cost of that wait.
   *
   * `ready` NEVER GOES BACK TO FALSE ONCE TRUE, and that is what makes this
   * ONE hook call safe for the whole route rather than only for the first
   * mount. RUNBOOK.md Round 111 flagged a hypothetical: a mid-conversation
   * stage remount (a character-cue swap) reopening the veil for up to
   * `VEIL_TIMEOUT_MS`. Reading `TutorScene.tsx` end to end finds no such
   * path today — a swap only ever suspends the ONE new character's own
   * Suspense boundary (TUTOR_3D.md §5.2), never the shared one `Reveal`
   * sits in, and `PrincipalModels` stops rendering entirely once `ready` is
   * true. The one REAL remount this codebase has (`SceneCanvas`'s `<Canvas
   * key={contextEpoch}>`, recreated after a lost WebGL context) would
   * produce a brand-new `Reveal` calling `onFirstFrame` a SECOND time into
   * this SAME, never-remounted instance — proved harmless, not assumed so,
   * in `tutor/__tests__/stageAnnouncement.test.ts`'s "a second first-frame
   * signal" cases.
   */
  const { ready, onFirstFrame: handleReady, timedOut } = useStageAnnouncement(onReady, VEIL_TIMEOUT_MS);

  /*
   * `timedOut` is reported to the caller the instant it flips, same shape as
   * `onReady` above — a plain effect rather than folding this into
   * `useStageAnnouncement` itself, because that hook's own job stops at
   * deciding the fact; ANNOUNCING it outward (so a layer can stop trusting
   * the anchor system — see `onTimedOut`'s own comment) belongs to whoever
   * consumes the fact, the same separation `onReady`/`handleReady` already
   * draw.
   */
  useEffect(() => {
    if (timedOut) onTimedOut?.();
  }, [timedOut, onTimedOut]);

  /*
   * WHETHER THE MATERIAL KEEPS ITS BLUR, decided by the same governor that
   * already decides the pixel ratio, the antialiasing, the shadows and the
   * ambient motion (`tutor-scene/quality.ts` → `QualitySettings.lumenBlur`).
   *
   * It has to be published HERE rather than applied in the renderer because
   * Lumen is DOM: `backdrop-filter` is the one quality setting that costs the
   * COMPOSITOR, on surfaces that are siblings of the canvas rather than
   * children of it. The shell is the only element that hears the scene and
   * contains every plate, and custom properties inherit, so one attribute on
   * this node reaches all of them.
   *
   * Profiled 2026-08-22 on the target Intel UHD at a phone's pixel count
   * (/DESIGN.md §Lumen → The blur, profiled): ~0.5 ms of presented frame time
   * and up to three extra compositor render passes. Cheap where it could be measured
   * — which is exactly not the device class `low` exists for, and the reason
   * this is wired rather than waved through.
   *
   * State, not a ref: it flips a handful of times a session at most, and a
   * re-render is how the attribute reaches the DOM at all.
   */
  const [lumenBlur, setLumenBlur] = useState(true);
  const handleQuality = useCallback((settings: QualitySettings) => {
    setLumenBlur(settings.lumenBlur);
  }, []);



  /*
   * THE DOCK'S BOTTOM EDGE, written imperatively.
   *
   * The lesson sheet's height changes on every frame of a drag. Feeding that
   * back through state would re-render the live exercise sixty times a second
   * while the learner's thumb is down and the GPU is drawing an island. So the
   * surface below publishes a number, this writes one inline `bottom`, and
   * nothing re-renders.
   *
   * INLINE, not a Tailwind arbitrary `calc()` reading a custom property. The
   * class version was written first and MEASURED WRONG in a real browser: the
   * sheet correctly published a 381 px footprint, the property was correctly
   * set, and the computed `bottom` stayed at 12 px — so the microphone sat on
   * top of the sheet instead of above it.
   */
  const dockRef = useRef<HTMLDivElement | null>(null);
  const footprintRef = useRef(0);
  const [above, setAbove] = useState<HTMLElement | null>(null);
  const [below, setBelow] = useState<HTMLElement | null>(null);

  /*
   * AND THE DOCK RE-PUBLISHES ITS OWN RECTANGLE AS IT MOVES, which is the half
   * that was missing and the reason a whole screen came apart.
   *
   * The dock is measured through `SafeAreaContext`, and the only thing watching
   * it is a `ResizeObserver`. Riding above a bottom surface changes the dock's
   * POSITION and not its size, so the observer never fires and the published
   * rectangle stays wherever the dock was when it last changed shape — at the
   * bottom of the screen, which is exactly where it no longer is.
   *
   * Two things read that rectangle and both were reading a lie. `WorldChip`
   * hides a chip painted over by fixed chrome, so the candidates' name plates
   * did not hide; and the CAMERA composes around the same slot, so it framed
   * the cast into a band the microphone was no longer standing in. Measured on
   * `/dev/tutor-lab` at 375x812 with the personalization list open: the dock had
   * risen to the middle of the island and five world plates — Dina, Dr. Rho,
   * Zara Vex, the island chip and the sun — were sitting under it, clipped and
   * still in the tab order, while the island was squeezed into a strip of palm
   * tops at the top of the frame.
   *
   * Re-published from here rather than from a second observer because this is
   * the one place the move happens. `publish` skips an identical measurement, so
   * the steady state costs one `getBoundingClientRect`; a sheet drag pays one
   * per frame, on one fixed-position element, which is the same order as the
   * measurement the sheet's own observer is already taking beside it.
   */
  const measureMicRef = useRef<((node: HTMLElement | null) => void) | null>(null);

  const setFootprint = useCallback((px: number) => {
    footprintRef.current = px;
    const node = dockRef.current;
    if (!node) return;
    node.style.bottom = px > 0 ? `${px + DOCK_GAP_PX}px` : '';
    measureMicRef.current?.(node);
  }, []);

  /*
   * One observer, for the surfaces that merely have a height.
   *
   * The lesson sheet computes its own and calls `setFootprint`; the
   * personalization plate does not know how tall it is until its disclosure
   * opens, and asking it to measure itself would be a second copy of this. A
   * ResizeObserver is also the only thing that catches the panel expanding,
   * which is exactly when the plate would otherwise slide under the orb.
   */
  const clearedRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const keepClearOf = useCallback(
    (node: HTMLElement | null) => {
      const previous = clearedRef.current;
      if (previous) observerRef.current?.unobserve(previous);
      clearedRef.current = node;

      if (!node) {
        setFootprint(0);
        return;
      }

      if (!observerRef.current && typeof ResizeObserver !== 'undefined') {
        observerRef.current = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (entry.target !== clearedRef.current) continue;
            const box = entry.target.getBoundingClientRect();
            // The gap under the surface counts too: it sits inset from the
            // bottom edge, and the dock has to clear the whole thing.
            setFootprint(box.height + (window.innerHeight - box.bottom));
          }
        });
      }
      observerRef.current?.observe(node);
      // Measure immediately as well: ResizeObserver's first callback lands on
      // the next frame, and one frame of the orb sitting on top of the plate is
      // one frame too many on the screen this bug was reported about.
      const box = node.getBoundingClientRect();
      setFootprint(box.height + (window.innerHeight - box.bottom));
    },
    [setFootprint],
  );

  useEffect(() => {
    const observer = observerRef;
    return () => {
      observer.current?.disconnect();
      observer.current = null;
    };
  }, []);

  const measureMic = safeArea?.measure('mic');
  measureMicRef.current = measureMic ?? null;
  const attachDock = useCallback(
    (node: HTMLDivElement | null) => {
      dockRef.current = node;
      // Re-apply on attach: the sheet publishes its footprint from an effect,
      // and a dock mounted after that would otherwise sit at its resting inset,
      // on top of the sheet, until the next drag.
      if (node && footprintRef.current > 0) node.style.bottom = `${footprintRef.current + DOCK_GAP_PX}px`;
      measureMic?.(node);
    },
    [measureMic],
  );

  /*
   * The two portal targets are STATE, not refs, and they have to be: a layer
   * renders into them, so it must re-render once when they attach. That is one
   * extra render per route, not per frame.
   */
  const attachAbove = useCallback((node: HTMLDivElement | null) => setAbove(node), []);
  const attachBelow = useCallback((node: HTMLDivElement | null) => setBelow(node), []);

  /*
   * Whether a large plate is holding the bottom-right corner right now.
   *
   * Both the lesson plate and the personalization plate take that corner from
   * `lg:` up, and while one of them is there the dock moves into the free width
   * to the LEFT of it, so the orb is centred in the space the learner can
   * actually see rather than centred under a plate.
   *
   * THE PLATE SAYS SO; THE SHELL DOES NOT GUESS (see `setCornerPlate`). Both
   * publishers already know the two facts the phase could never see — whether
   * they are in their desktop form at all, and whether they have stood down.
   */
  const [cornerPlate, setCornerPlate] = useState(false);
  const besidePlate = cornerPlate;

  const dock = useMemo<StageDockValue>(
    () => ({ above, below, setFootprint, keepClearOf, setCornerPlate }),
    [above, below, setFootprint, keepClearOf],
  );

  return (
    <StageDockContext.Provider value={dock}>
      <div
        data-tutor-stage=""
        /*
         * THE ONE QUALITY DECISION THE RENDERER CANNOT MAKE, published where
         * the material can read it. `off` swaps Lumen for its blur-less form —
         * the same one a browser without `backdrop-filter` gets, defined once
         * in `index.css` — rather than removing the material from the plates.
         * Absent (not `"on"`) while the blur is kept, so the default costs no
         * attribute and the selector has nothing to match.
         */
        data-lumen-blur={lumenBlur ? undefined : 'off'}
        /*
         * `fixed inset-0`, the Lesson Player's own layer precedent
         * (/DESIGN.md → layout.immersive.stage). `bg-base` is what the first
         * frame and the no-WebGL fallback are seen against; without it the
         * page behind would show through the canvas's alpha.
         *
         * NO TRANSFORM ON THIS ELEMENT, EVER. A transformed ancestor becomes
         * the containing block for `position: fixed` descendants, and every
         * anchored chip is fixed — the whole HUD would silently drift by this
         * element's offset.
         */
        /*
         * THE ATMOSPHERE, PUBLISHED ONCE PER HOUR OF THE DAY.
         *
         * Four custom properties describing the light the island is standing
         * in, read from the same palette `SceneLighting` points its lights
         * with (`tutor-scene/atmosphere.ts`). Everything on this layer that is
         * made of Lumen inherits them, so a plate's fill leans toward the sky,
         * its lip is the key light's colour and its shadow lengthens as the sun
         * drops — and `lf-stage-ground` turns the alpha the canvas does not
         * paint into that same sky instead of one flat token, which is what
         * used to make every screenshot of this route look like a cutout on a
         * blank page.
         *
         * It is a STYLE ATTRIBUTE, not a frame-loop write. A custom-property
         * write invalidates style on everything that inherits it; at 60 Hz that
         * would cost more than drawing the island, and none of it needs to move
         * faster than the light does.
         */
        style={atmosphere}
        className="lf-stage-ground fixed inset-0 z-50 overflow-hidden bg-base text-content"
      >
        {/*
         * THE ONE MOUNT. Everything else in this file renders over it, and
         * nothing in the tree above may key or conditionally render it: a
         * remount is a refetched island, and the learner sees their world
         * blink.
         */}
        {/*
         * `h-full w-full`, NOT `absolute inset-0`, and that is not a style
         * preference. `SceneCanvas`'s own root already carries `relative`,
         * `cn` is a plain string join with no conflict resolution, and
         * Tailwind emits `relative` after `absolute` — so an `absolute
         * inset-0` here loses the cascade, the element stays in flow, and its
         * height collapses to the canvas's 300x150 intrinsic default. The
         * stage renders, correctly, into a postage stamp in the corner of a
         * full-screen layer, which is a very persuasive impression of the bug
         * this whole rebuild exists to remove. Filling a sized parent has no
         * such conflict.
         */}
        <TutorStage
          {...stage}
          className="h-full w-full"
          onReady={handleReady}
          onQuality={handleQuality}
          onSpeechBlocked={handleSpeechBlocked}
        />

        {/*
         * One line, in the world's own material, only when it is true. It is
         * not a modal and not a toast: the tutor keeps talking in captions
         * while it is up, because the session must never depend on sound.
         */}
        {soundBlocked && <SoundBlockedNotice onDismiss={() => setSoundBlocked(false)} />}

        {/*
         * THE WAY OUT. Always visible, always focusable, first in the tab
         * order, and anchored to the VIEWPORT rather than to the world.
         *
         * It used to be two half-controls and neither of them worked. One was
         * a world rune on `sky.mark.4`, which is culled the moment the camera
         * turns away from that point — i.e. for most of a conversation, since
         * the close-up does not frame the sky. The other was an `sr-only`
         * button revealed by focus, which is the platform's skip-link grammar
         * and is exactly right for a skip link and exactly wrong here: it is
         * revealed by a key a pointer user never presses. A learner on a
         * phone, mid-session, therefore had the browser back button and
         * nothing else, on a route that deliberately has no sidebar and no tab
         * bar.
         *
         * This makes it the THIRD viewport-anchored element on the route,
         * after the mic orb and the lesson plate, and /DESIGN.md's Tutor
         * recipe said there were exactly two. The recipe was changed in the
         * same commit rather than worked around, because the reason it named
         * two was to stop the HUD accreting floating panels — and the way out
         * is not a panel, it is the navigation the immersive exception took
         * away. It is named there now.
         *
         * `z-50` puts it over the loading veil as well. A stage that never
         * reports a first frame is the state a learner most needs to leave.
         */}
        {/*
         * IT PUBLISHES ITS RECTANGLE, and that is the second half of the fix.
         * Fixed chrome is laid out by CSS against the window and anchored chrome
         * is laid out by the camera, so neither could see the other and both
         * claimed this corner: at 375 px the greeting caption measured
         * (54, 31, 266, 68) against this chip's (16, 16, 155, 44). The chip goes
         * into the shared chrome registry (`SafeAreaContext`), the caption
         * escapes it (`ScreenAnchor`'s `avoid`), and neither of them has to know
         * the other exists.
         *
         * `exit` is deliberately NOT one of the camera's slots. A 52x44 corner
         * chip charged as a 60 px top inset would push the subject down the
         * frame in every phase of every session to make room for a back arrow.
         */}
        <HudPlate
          ref={safeArea?.measure('exit')}
          as="button"
          shape="chip"
          /*
           * The name is on the button rather than only in the span, because the
           * span is not always rendered — see below — and the accessible name of
           * the only navigation on the route may not depend on a breakpoint.
           */
          aria-label={t('tutor.stage.leave')}
          onClick={() => navigate(APP_HOME)}
          className="fixed left-4 top-4 z-50 md:left-6 md:top-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="arrow_back" />
          {/*
            THE LINE IS DESKTOP-ONLY, and this is a measurement rather than a
            tidy-up. At 375 px the labelled chip is 155 px wide, which spans the
            caption's only horizontal escape route: a 266 px caption pushed clear
            of it to the right runs off a 375 px screen, so the solver's only
            remaining move is 37 px straight DOWN — the greeting laid across
            Dr. Rho's forehead. Without the line the chip is ~52 px, the escape
            is 22 px sideways, and nobody ever notices it happened. A back arrow
            in the top-left corner is the one icon that needs no gloss, the tap
            target is unchanged (`min-h-11 min-w-11`), and the name above is what
            a screen reader reads at every width.
          */}
          <span className="lf-action hidden md:inline">{t('tutor.stage.leave')}</span>
        </HudPlate>

        <div className="pointer-events-none absolute inset-0 z-30">{children}</div>

        {/*
          THE MICROPHONE, AND IT IS HERE IN EVERY PHASE.

          Viewport-anchored for a physical reason: a thumb does not move with
          the camera. The two slots either side of it are portal targets, so a
          layer can put a question above the orb and a composer beside it while
          the shell keeps owning the one bottom edge all three share.

          `empty:hidden` on both, because an empty flex row still spends the
          column's `gap-2`: without it the orb drifts 8 px up the screen on
          every phase that contributes no rows, which is most of them.

          ON A PHONE THE ORB AND THE COMPOSER SHARE ONE ROW, and that is a
          measurement rather than a rearrangement for its own sake. Stacked, the
          cluster measured 192 px on a 375x812 phone (`/dev/tutor-lab`): 96 for
          the orb, 32 for its status line, 48 for the composer and 16 of gaps —
          a quarter of the screen of chrome above a sheet that had already taken
          45% of it. The orb is the hero and keeps every pixel of its 96;
          what stops claiming a row of its own is the text field beside it,
          which needs 48 px of a row the orb has already paid 96 for. The
          cluster measures 136 px that way, and the 56 px go back to the island.

          It stays a COLUMN from `lg:` up, where height is not the scarce
          dimension and the recipe's centred orb over the bottom safe area is
          simply the better arrangement (/DESIGN.md → Screen Recipes → Tutor).
          The DOM order is the same at both: orb, then composer. A row that
          reversed them visually would put the tab order and the reading order
          in disagreement over which control comes first.
        */}
        <div
          ref={attachDock}
          role="group"
          aria-label={dockLabel ?? t('tutor.stage.controlsLabel')}
          className={cn(
            /*
             * `pointer-events-none` ON THE DOCK ITSELF, not `-auto` — every
             * interactive surface inside it (the orb, the composer, the
             * secondary/archive chips, the goodbye's own controls) already
             * opts back in explicitly, the same "wrapper is none, each
             * control is auto" contract line 673's `{children}` layer uses.
             *
             * It used to be `-auto` on this container, which is `flex-col`
             * and therefore no taller than the sum of its own children — but
             * a long `microphoneBlockedBy` reason (a full safety-explanation
             * sentence beside the 96 px orb) can make that sum tall enough to
             * geometrically reach into the world-anchored offer chips above
             * it, and a `pointer-events-auto` CONTAINER claims every pixel of
             * its own empty padding for itself regardless of what is painted
             * there — including a pixel that paints nothing but a world chip
             * sitting one z-layer down. Confirmed live with `elementFromPoint`
             * at a short viewport (~864x342, a long blocked-reason sentence):
             * a point inside "Ask me anything" — a real, on-screen, correctly
             * `pointer-events-auto` chip one layer below the dock — resolved
             * to THIS container instead, at a pixel where the dock painted
             * nothing at all. The chip was not merely covered; no click of it
             * could ever land.
             *
             * MADE SAFE ONLY BY AUDITING EVERY CONSUMER OF `above`/`below`
             * FIRST: `OfferChips.tsx` and `ConversationView.tsx` already mark
             * every control `pointer-events-auto` (the composer, the
             * adaptation answers, restart/exit, secondary/archive), and
             * `ReplayInWorld.tsx`'s transport does too (`LeaveChip` carries
             * its own). `ClosingInWorld.tsx` did not — its three controls
             * relied ENTIRELY on inheriting this container's `-auto`, so this
             * change ships together with theirs (see that file) rather than
             * silently taking "Start another session" out of the click path.
             */
            'pointer-events-none fixed inset-x-0 z-30 mx-auto flex w-full max-w-[min(30rem,92vw)] flex-col items-stretch gap-2 px-1',
            // The resting inset. A bottom surface overrides it inline, above.
            'bottom-3 lg:bottom-6',
            'motion-safe:transition-[bottom] motion-safe:duration-300 motion-safe:ease-[var(--lf-ease)]',
            /*
              The reservation is the PANEL'S OWN width formula, not a constant.
              It was 30rem (480 px) "to clear the 420 px corner plate" — but
              the docked panel is min(27.5rem, 34vw), which at exactly 1024 px
              is 348 px: the dock shifted 480 px to clear 348, sitting
              off-centre by ~130 px against nothing. Reserving exactly what
              the panel occupies keeps the dock centred in the space that is
              actually left, at every width, without a second number to keep
              in sync.
            */
            besidePlate && 'lg:right-[min(27.5rem,34vw)] lg:max-w-[min(30rem,100%)]',
          )}
        >
          <div ref={attachAbove} className="flex w-full flex-col items-center gap-2 empty:hidden" />

          {/*
            THE ORB, IN EVERY PHASE THAT HAS ONE — and `closing` does not.
            `mic.present` is decided per phase by `stage/micForPhase.ts`, never
            here; the browser's own refusal line goes with it, because a "the
            microphone was blocked" plate floating over a goodbye with no
            microphone beside it is chrome about a control that is not there.

            The two portal slots stay mounted either way. A layer renders into
            them, so a target that disappeared with the orb would silently drop
            whatever a future phase contributed to the dock.

            This row carries no `pointer-events` class of its own on purpose:
            it inherits `none` from the dock above (see that container's own
            comment), and `MicOrb`'s orb button and the composer each opt back
            in explicitly, so nothing here needs its own override.
          */}
          <div className="flex w-full items-center justify-center gap-3 lg:flex-col lg:gap-2">
            {mic.present && (
              <MicOrb
                state={mic.state}
                microphone={mic.microphone}
                blockedReason={mic.blockedReason ?? null}
                blockedCopy={mic.blockedCopy ?? null}
                idleCopy={mic.idleCopy}
                /*
                 * THE BROWSER'S OWN REFUSAL, ON THE ORB RATHER THAN BESIDE IT.
                 * It used to be a plate of its own in this column — a second
                 * surface about a control that was standing right next to it,
                 * and the worse half of that arrangement was that the orb kept
                 * looking perfectly usable while a separate plate said it was
                 * not. `MicOrb` prints it inside its own surface now, by the
                 * same mechanism the blocked reason uses.
                 */
                notice={mic.denied ? t('tutor.conversation.micDenied') : null}
                onClip={mic.onClip}
                onInterrupt={mic.onInterrupt}
              />
            )}

            {/*
              `flex-none` from `lg:` up: the slot goes back to being a
              full-width row under the orb rather than the space beside it,
              where `lg:w-full` claims the whole column regardless of this
              min-width.

              `min-w-[9.5rem]` is a FLOOR, not the old `min-w-0` — found live:
              with an unbounded-shrink composer sharing a row with `MicOrb`'s
              blocked-reason plate (a full sentence, up to `86vw` on its own),
              the plate did not lose gracefully. The composer measured 10 px
              wide, its input unusable, on a real "voice unavailable" session.
              `MicOrb` now shrinks its plate instead of demanding that width
              (see MicOrb.tsx); this floor is the second half of the fix, so
              the composer keeps enough room for its input AND send button
              even in a blocked-mic state neither of us has seen yet.
            */}
            <div
              ref={attachBelow}
              className="flex min-w-[9.5rem] flex-1 flex-col gap-2 empty:hidden lg:w-full lg:flex-none"
            />
          </div>
        </div>

        {/*
         * LOADING IS PART OF THE WORLD, not a spinner on a blank page. The
         * veil is the base colour the island fades up out of, and it carries
         * one line rather than a progress indicator, because nothing here can
         * honestly report progress: the .glb fetch, the decode and the first
         * frame are three different waits.
         *
         * It also stops being interactive the instant it is invisible — a
         * transparent full-screen div left over the stage swallows every tap
         * on the island, and that failure looks like a dead scene rather than
         * like a leftover overlay.
         */}
        <div
          aria-hidden={ready}
          /*
           * Named so a measurement can subtract it. The veil is a deliberate
           * full-screen cover, so while it is up it overlaps every surface on
           * the stage by design — counting that as a collision would bury the
           * real ones under seven false positives per phase.
           */
          data-tutor-veil=""
          className={cn(
            'absolute inset-0 z-40 flex items-center justify-center bg-base motion-safe:transition-opacity motion-safe:duration-300',
            ready ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
        >
          {/*
            One line, at full ink. `text-content-muted` was here and it was
            doing nothing but expressing an intention: the material neutralises
            muted ink inside chrome (/DESIGN.md §Lumen), because at 32%
            transmission there is no legible quieter tone to demote a line into.
            The class is gone rather than left to imply a hierarchy the
            stylesheet refuses to draw.
          */}
          {/*
            THE RING, ALONGSIDE THE LINE. Text alone reads identically whether
            the stage is loading or has simply stopped — the exact ambiguity
            AGENTS.md §1.14 calls out generally ("a taps-do-nothing period"
            indistinguishable from a frozen app). Same markup as the only other
            bare spinner in the product (`AuthCallbackPage.tsx`), not a new
            component: one ring, this route does not need a second. Decorative
            (`aria-hidden`) because the adjacent `role="status"` line already
            carries the announcement, and plain `animate-spin` with no
            `motion-safe:` guard because it reports PROGRESS rather than
            performing decoration — the same reasoning a native browser spinner
            is not suppressed under reduced motion.
          */}
          <HudPlate shape="plate">
            <span
              aria-hidden="true"
              className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-outline border-t-primary"
            />
            <span className="lf-body" role="status">
              {t('tutor.page.loading')}
            </span>
          </HudPlate>
        </div>
      </div>
    </StageDockContext.Provider>
  );
}

// ── The HUD band ────────────────────────────────────────────────────────────

/**
 * How a layer's own DOM panels sit in the frame.
 *
 * `world` is the one to reach for: the layer renders nothing but anchored
 * chrome, so the island stays tappable everywhere and the composition is
 * decided by the camera. `bottom` and `fill` exist for the surfaces that still
 * carry a column of panels while they are being rebuilt in-scene, and for the
 * no-WebGL fallback, where anchoring has no camera to project against.
 */
export type StagePlacement = 'world' | 'bottom' | 'fill';

export interface StageLayerProps {
  /**
   * The layer's accessible name. It is a landmark, because with the app shell
   * gone this is the only structure a screen reader has to move between the
   * scene and the controls over it.
   */
  label: string;
  placement?: StagePlacement;
  children: ReactNode;
  className?: string;
}

export function StageLayer({ label, placement = 'world', children, className }: StageLayerProps) {
  const dock = useStageDock();
  const keepClearOf = dock?.keepClearOf;

  /*
   * A `bottom` LAYER AND THE DOCK CANNOT BOTH OWN THE BOTTOM EDGE.
   *
   * This is the fixed-versus-fixed half of the same bug the anchored HUD has
   * against the way out, and it is what turned the goodbye into a four-way
   * pileup: the `closing` layer stacks its plate, its indigo button and its
   * replays chip against the bottom of the viewport, and the dock is `fixed
   * bottom-3` in the very same place. Nothing arbitrated, so at 375 px a
   * disabled microphone landed on all three.
   *
   * The dock already knows how to ride above a surface — the lesson sheet
   * publishes a footprint on every frame of a drag — so a bottom layer simply
   * uses the same channel. It is registered here rather than by each layer so
   * the NEXT bottom layer inherits it without having to know the dock exists.
   *
   * Only for `bottom`: `world` occupies nothing and `fill` is the no-WebGL
   * fallback, where a scrolling column owns the screen and there is no
   * composition left to protect.
   */
  const attachBottom = useCallback(
    (node: HTMLDivElement | null) => {
      keepClearOf?.(node);
    },
    [keepClearOf],
  );

  if (placement === 'world') {
    /*
     * A full-size box that catches nothing. The island underneath is a control
     * surface — tapping a character IS how a character is chosen (/ORACLE.md
     * §10) — so this layer must not swallow a single tap; `pointer-events-none`
     * here with `pointer-events-auto` on each chip's own plate is what gives
     * the scene back every pixel the HUD is not actually occupying.
     *
     * It is a real element rather than `display: contents` on purpose: a
     * landmark with `display: contents` is dropped from the accessibility tree
     * in engines that still implement the old behaviour, and this landmark is
     * the only structure a screen reader has now that the app shell is gone.
     */
    return (
      <section aria-label={label} className={cn('pointer-events-none absolute inset-0', className)}>
        {children}
      </section>
    );
  }

  return (
    <section
      aria-label={label}
      /*
       * Scrolls INSIDE itself, never the document. A full-bleed fixed layer with
       * a scrolling body is how a stage ends up with a horizontal scrollbar at
       * 375 px, which §1.11 forbids outright; `overscroll-contain` keeps a
       * flick at the end of this list from scrolling the page behind it.
       */
      className={cn(
        'pointer-events-none absolute inset-0 flex overflow-y-auto overscroll-contain p-4 md:p-6',
        placement === 'bottom' ? 'items-end' : 'items-stretch',
        className,
      )}
    >
      <div
        ref={placement === 'bottom' ? attachBottom : undefined}
        className={cn(
          'pointer-events-auto mx-auto flex w-full max-w-[min(48rem,100%)] flex-col gap-4',
          placement === 'fill' && 'min-h-full',
        )}
      >
        {children}
      </div>
    </section>
  );
}

// ── The seams the next three surfaces build against ─────────────────────────

/*
 * Each of the three product surfaces is a HUD layer over this shell's canvas.
 * None of them mounts a scene, none of them owns the camera, and none of them
 * may reintroduce a page: they receive the props below, render chrome, and call
 * back. The shapes are fixed here on purpose — three surfaces are built against
 * them in parallel, so renegotiating one of them silently breaks the other two.
 */

/** What every layer gets, whichever phase it belongs to. */
export interface StageLayerCommonProps {
  /** The phase this layer is the chrome for. */
  phase: StagePhase;
  /**
   * True once the veil has lifted — EITHER the island and cast are actually
   * on screen, OR `useStageAnnouncement`'s deadline gave up waiting for
   * them. The two are not the same fact: a layer that only needs to know
   * whether it may show its OWN chrome (offer chips, the mic orb, an
   * activity plate — anything DOM-positioned in the ordinary way) can treat
   * this as "go." A layer that POSITIONS something via the anchor projector
   * (`ScreenAnchor.tsx`'s `useAnchorSlot`, e.g. the speech caption above the
   * speaker's crown) must additionally check `!timedOut` (below) before
   * trusting a projected position — see `timedOut`'s own comment for why.
   */
  ready: boolean;
  /**
   * True when `ready` above came from the deadline, not a real frame — see
   * `StageShellProps.onTimedOut`'s comment for the full story. The anchor
   * projector never ran a single tick in this case (no frame, no
   * `useFrame`), so every anchored node is still in its initial
   * `hidden`/`inert` state and will STAY that way — there is no later event
   * that will ever un-hide it. A layer using the anchor system must fall
   * back to its own non-anchored rendering here, the same fallback it
   * already owns for `ready === false`, rather than trusting a projection
   * that will never arrive.
   */
  timedOut: boolean;
}

/**
 * The personalize layer (/ORACLE.md §10).
 *
 * Every axis is picked by touching the thing it changes, and `onSave` applies
 * OPTIMISTICALLY upstream — the preference reaches the live scene on the same
 * tick, so the island changes under the learner's finger rather than after a
 * round trip. A picker whose result you cannot see is indistinguishable from a
 * picker whose result does not exist.
 */
export interface PersonalizeLayerProps extends StageLayerCommonProps {
  preferences: TutorPreferences;
  /** Server-driven; a new island or character can ship without a frontend release. */
  catalog: TutorCatalog;
  /** True while a patch is in flight. Never blocks the picker. */
  saving: boolean;
  /**
   * Resolves to whether the save actually succeeded. Found by adversarial
   * review, round 38 (2026-08-30, HIGH): this used to return nothing, so a
   * server-rejected save (a nickname the backend correctly refuses as the
   * learner's own real name) was indistinguishable from a successful one —
   * `commitNickname` in `PersonalizeInWorld.tsx` declared success and closed
   * the picker the instant `onSave` was CALLED, never once it actually
   * landed.
   */
  onSave: (patch: Partial<TutorPreferences>) => Promise<boolean>;
  /** Done making the place theirs. Moves the camera to the introduce shot. */
  onDone: () => void;
}

/**
 * The offer layer (/ORACLE.md §9.2).
 *
 * ONE button starts a conversation, and nothing before that press requires
 * reading beyond one line. The openings are a closed set of at most five and
 * belong at the tutor's chest as chips, spoken as they arrive, never as a grid
 * of cards with a title, a paragraph and a button that repeats the title.
 */
export interface OfferLayerProps extends StageLayerCommonProps {
  offers: TutorOffers;
  /** True while a start is in flight, or while Oracle cannot serve at all. */
  starting: boolean;
  /**
   * The last failure's error CODE, never a wire message. Render it through
   * `tutor.startError.<code>`; an untranslated server string on a child's
   * screen is both an i18n violation and a leak of internal wording.
   */
  startError: string | null;
  /**
   * The daily-cap reset instant, present only alongside `startError ===
   * 'SESSION_LIMIT'` (§1.9 clarity — a bare "come back tomorrow" cannot tell
   * a child whether the wait is ten minutes or nearly a day). An ISO string
   * from the SERVER's own computed local midnight, never guessed client-side
   * — client and server clocks/timezones can disagree.
   */
  startErrorResetAt: string | null;
  onStart: (input: StartSessionInput) => void;
  /** Back to picking, in the world. */
  onPersonalize: () => void;
  /** The learner's access token, for the replay list. */
  token: string;
  /**
   * Perform a saved conversation on this island.
   *
   * The archive lives on this layer because a learner who has just arrived is
   * the one who asks for it, but the PERFORMANCE is a phase of the stage, so
   * the list can only hand a session upward. This is that hand-off.
   */
  onReplay: (session: SessionSummary) => void;
}

/**
 * The conversation layer (/ORACLE.md §9.3).
 *
 * IT DOES NOT DRIVE THE SCENE. Emotion, action, speech and the shot are derived
 * from this same socket one level up and handed to the single canvas there, so
 * that a conversation ending cannot take the island down with it. This layer
 * renders the caption above the speaker's head, the 2D bubble and the floating
 * lesson plate. It does NOT render the microphone: the orb belongs to the stage
 * and is mounted once for the whole route, and this layer contributes the rows
 * that ride above and below it through `useStageDock`.
 *
 * THE CAPTION IS NOT NEGOTIABLE, and neither is the bubble. The same line
 * appears above the head AND in the bubble with the 2D animated head, because
 * they are two channels for two learners and for `liruf` and `dina` the bubble
 * is the only working articulation channel.
 */
export interface ConversationLayerProps extends StageLayerCommonProps {
  session: StartedSession;
  socket: TutorSocket;
  token: string;
  /**
   * True while the tutor's audio is actually playing.
   *
   * Supplied rather than inferred: only the shell knows whether the clip
   * started, since `play()` is rejected until the browser has seen a gesture
   * and a rejected clip must not leave a mouth open over silence.
   */
  speaking: boolean;
  /**
   * The stage's own `<audio>` element, for word-highlighting — the SAME
   * object `TutorStage`'s `useLipSync` drives the mouth from.
   *
   * Supplied for the same reason `speaking` is: playback lives in the stage,
   * and a caption that wants to read `.currentTime` needs the real element
   * rather than a second copy of it (there is no second copy to have — see
   * `TutorStageProps.onAudioElementReady`). `null` until the stage has
   * mounted one, which this layer must treat exactly like "no timing yet",
   * never as an error.
   */
  audioElement: HTMLAudioElement | null;
  /*
   * `onInterrupt` is deliberately NOT here. Pressing the microphone while the
   * tutor is still talking has to stop the clip, and the only control that can
   * ask for that is the orb — which belongs to the stage now. It travels on
   * `StageMicProps` instead, straight from the component that owns `speechUrl`
   * and the one audio element it feeds.
   */
  /**
   * True while a turn has been sent and the tutor has not answered.
   *
   * Owned upstream rather than here, because the orb and this layer both show
   * it and there is only one orb now. Two copies of "am I waiting" is how the
   * spinner on the plate and the ring on the microphone come to disagree.
   */
  awaitingReply: boolean;
  /** The learner just sent something. Starts the wait above. */
  onAwaitReply: () => void;
  /**
   * True while the composer holds unsent text — found live: hands-free
   * listening opens the microphone the instant the tutor's turn ends,
   * completely unaware of whether the learner is typing instead of
   * speaking. Ambient noise crossing the silence detector's threshold
   * while a learner is mid-sentence in the composer submitted a garbled
   * voice transcript ("El.") in place of what they had actually typed,
   * and the tutor reacted to it as if it were a real answer. This flows
   * up so the hands-free hook can stay disabled — never so it can discard
   * a clip after the fact, which would still have spent the capture and
   * the STT call.
   */
  onDraftChange: (hasDraft: boolean) => void;
  /**
   * Bubbled straight up from `LiveSegmentPanel`, unread here — see this
   * file's own "IT DOES NOT DRIVE THE SCENE" rule above the layer's props.
   * A `story` family segment (`story_dialogue`, `story_scene`, `eavesdrop`)
   * has no `CharacterLayerProvider` of its own on this route, so it fires
   * this cue instead of drawing its own character; the caller one level up
   * (`TutorExperience.tsx`, which already owns `character`/`emotion`/
   * `action` for the single canvas) is the only place allowed to act on it.
   */
  onCharacterCue: (cue: CharacterCue | null) => void;
  /**
   * True while a dropped connection is being resumed with a fresh token. The
   * layer says so in place, because a silent gap between "the socket died" and
   * "the conversation came back" reads as the tutor freezing mid-sentence.
   */
  resuming: boolean;
  /**
   * The reply outran the learner's patience (~25 s with no turn). The spinner
   * has already been stopped upstream; the layer says what to do next.
   */
  replyTimedOut: boolean;
  /**
   * Start over: end this conversation and return to the openings. It counts
   * against the daily session cap exactly as any fresh start does — restarting
   * is starting, not a loophole.
   */
  onRestart: () => void;
  /** End the session. The close is a camera move, not a screen. */
  onExit: () => void;
}

/**
 * The replay layer (/ORACLE.md §12).
 *
 * A SAVED CONVERSATION IS A PHASE OF THIS STAGE, not a list on top of it. The
 * layer renders the transport, the learner's half of the conversation and the
 * reading plate; the DIRECTOR one level up decides which beat is on, and
 * `TutorExperience` turns that into the same four scene props a live session
 * fills — emotion, action, speech URL, shot. That is the same division every
 * other layer observes, and here it also buys the thing that makes replay
 * possible at all: the canvas never unmounts, so a replay opens on the island
 * the learner is already looking at rather than reloading it.
 *
 * IT CARRIES NO TOKEN AND MAKES NO REQUEST. The transcript is fetched once,
 * upstream, and handed down as a finished script — a layer that could refetch
 * is a layer that can restart a performance halfway through it.
 */
export interface ReplayLayerProps extends StageLayerCommonProps {
  /**
   * The performance, or null while the transcript is still in flight or after
   * it failed. Null and `loading` and `error` are three different screens, and
   * the layer says three different things.
   */
  director: ReplayDirector | null;
  loading: boolean;
  /** The last failure's error CODE, never a wire message. */
  error: string | null;
  /** Leave the replay. Lands on the introduction, one press from a real one. */
  onDone: () => void;
}
