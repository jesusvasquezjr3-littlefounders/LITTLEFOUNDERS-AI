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
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui';
import { APP_HOME } from '@/routes/app/navConfig';
import { TutorStage, type TutorStageProps } from '@/tutor-scene/TutorStage';
import { AnchorProvider } from '@/tutor-scene/ScreenAnchor';
import { SafeAreaProvider, useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { HudPlate } from '@/tutor/hud/HudPlate';
import { MicOrb, type MicBlockedReason, type MicOrbState } from '@/tutor/hud/MicOrb';
import type { Microphone } from '@/tutor/useMicrophone';
import type { StagePhase } from './phases';
import type { StartedSession, TutorCatalog, TutorOffers, TutorPreferences } from '@/tutor/types';
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
}

const StageDockContext = createContext<StageDockValue | null>(null);

/** The dock, or null where no shell is mounted (the lab, a unit test). */
export function useStageDock(): StageDockValue | null {
  return useContext(StageDockContext);
}

/** Breathing room between the top of a bottom surface and the dock above it. */
const DOCK_GAP_PX = 12;

// ── The shell ───────────────────────────────────────────────────────────────

export interface StageShellProps extends Omit<TutorStageProps, 'className'> {
  /**
   * Which phase the route is in.
   *
   * The shell needs it for exactly one thing: whether the dock sits centred or
   * beside the corner plate. It is not a second source of truth for the shot,
   * which is still computed upstream and passed in.
   */
  phase: StagePhase;
  /** The one microphone. Never optional: absence is the bug this closed. */
  mic: StageMicProps;
  /**
   * The HUD. One layer per phase, rendered over the same canvas, never instead
   * of it. Layers are ordinary DOM: the mesh is the delightful path and the DOM
   * is the guaranteed one, and this is the guaranteed one.
   */
  children?: ReactNode;
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
 */
const VEIL_TIMEOUT_MS = 8000;

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

function StageShellInner({ children, phase, mic, onReady, ...stage }: StageShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const safeArea = useSafeArea();

  /*
   * The veil is state and the projection is a ref, and the difference is not
   * arbitrary: this flips exactly once per route, whereas an anchored node
   * moves every frame. One re-render at the moment the island appears is free;
   * sixty a second would cost more than the scene.
   */
  const [ready, setReady] = useState(false);

  const handleReady = useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);

  /*
   * The timer lifts the VEIL only. It deliberately does not call `onReady`,
   * because that callback is the speech gate: telling the conversation layer
   * that the cast is on screen when it is not plays the tutor's first line at a
   * blank canvas, which is the exact failure the gate exists to prevent.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), VEIL_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
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

  const setFootprint = useCallback((px: number) => {
    footprintRef.current = px;
    const node = dockRef.current;
    if (!node) return;
    node.style.bottom = px > 0 ? `${px + DOCK_GAP_PX}px` : '';
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

  const dock = useMemo<StageDockValue>(
    () => ({ above, below, setFootprint, keepClearOf }),
    [above, below, setFootprint, keepClearOf],
  );

  /*
   * Whether a large opaque plate is in the bottom-right corner right now.
   *
   * Both the lesson plate and the personalization plate take that corner from
   * `lg:` up, and on those two phases the dock moves into the free width to the
   * LEFT of it, so the orb is centred in the space the learner can actually see
   * rather than centred under a plate.
   */
  const besidePlate = phase === 'conversing' || phase === 'personalizing';

  return (
    <StageDockContext.Provider value={dock}>
      <div
        data-tutor-stage=""
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
        className="fixed inset-0 z-50 overflow-hidden bg-base text-content"
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
        <TutorStage {...stage} className="h-full w-full" onReady={handleReady} />

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
        <HudPlate
          as="button"
          shape="chip"
          floor="surface"
          onClick={() => navigate(APP_HOME)}
          className="fixed left-4 top-4 z-50 md:left-6 md:top-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="arrow_back" />
          <span className="lf-label">{t('tutor.stage.leave')}</span>
        </HudPlate>

        <div className="pointer-events-none absolute inset-0 z-30">{children}</div>

        {/*
          THE MICROPHONE, AND IT IS HERE IN EVERY PHASE.

          Viewport-anchored for a physical reason: a thumb does not move with
          the camera. The two slots either side of it are portal targets, so a
          layer can put a question above the orb and a composer under it while
          the shell keeps owning the one bottom edge all three share.

          `empty:hidden` on both, because an empty flex row still spends the
          column's `gap-2`: without it the orb drifts 8 px up the screen on
          every phase that contributes no rows, which is most of them.
        */}
        <div
          ref={attachDock}
          role="group"
          aria-label={t('tutor.stage.controlsLabel')}
          className={cn(
            'pointer-events-auto fixed inset-x-0 z-30 mx-auto flex w-full max-w-[min(30rem,92vw)] flex-col items-stretch gap-2 px-1',
            // The resting inset. A bottom surface overrides it inline, above.
            'bottom-3 lg:bottom-6',
            'motion-safe:transition-[bottom] motion-safe:duration-300 motion-safe:ease-[var(--lf-ease)]',
            // 480 px clears the 420 px corner plate plus its 24 px inset plus
            // a real gap, so the two never crowd each other at 1024 px either.
            besidePlate && 'lg:right-[30rem] lg:max-w-[min(30rem,100%)]',
          )}
        >
          <div ref={attachAbove} className="flex w-full flex-col items-center gap-2 empty:hidden" />

          {mic.denied && (
            <HudPlate shape="plate" floor="sunken" role="status" className="pointer-events-none self-center">
              <span className="lf-caption">{t('tutor.conversation.micDenied')}</span>
            </HudPlate>
          )}

          <MicOrb
            state={mic.state}
            microphone={mic.microphone}
            blockedReason={mic.blockedReason ?? null}
            blockedCopy={mic.blockedCopy ?? null}
            idleCopy={mic.idleCopy}
            onClip={mic.onClip}
            onInterrupt={mic.onInterrupt}
            className="self-center"
          />

          <div ref={attachBelow} className="flex w-full flex-col gap-2 empty:hidden" />
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
          className={cn(
            'absolute inset-0 z-40 flex items-center justify-center bg-base motion-safe:transition-opacity motion-safe:duration-300',
            ready ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
        >
          <HudPlate shape="plate" floor="surface">
            <span className="lf-body text-content-muted" role="status">
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
   * True once the island AND the cast are actually on screen.
   *
   * Anything that speaks, animates or points at the scene waits for this.
   * Handing over a line while the assets are still resolving plays audio at a
   * blank canvas (/ORACLE.md §9.1).
   */
  ready: boolean;
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
  onSave: (patch: Partial<TutorPreferences>) => void;
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
  onStart: (input: StartSessionInput) => void;
  /** Back to picking, in the world. */
  onPersonalize: () => void;
  /** The learner's access token, for the replay list. */
  token: string;
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
  /** End the session. The close is a camera move, not a screen. */
  onExit: () => void;
}
