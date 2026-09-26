import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { AgeBand } from '../design/copyBudget';
import { MENTOR_NAMES, type MentorCharacter } from '../design/assets';
import type { Milestone } from '../design/milestones';
import { useIdleMotion } from '../design/controls';
import { REGISTERS, registerForCopyBand } from '../design/learnerRegisterPolicy.generated';
import { StaticThemeProvider } from '../../theme/useTheme';
import { getDeviceProbe, pickInitialTier } from '../../tutor-scene/quality';
import { resolveMentorPose, type MentorClosingScript, type MentorStageState } from './stageStates';
import { findStageStills } from './stageStills';
import {
  decideStageMode, FIRST_RENDER_BUDGET_MS, FRAME_RATE_STRIKES, frameRateStrikes,
  type MentorStageFailure, type MentorStageFallback, type MentorStageMode, type StageEnvironment,
} from './stageMode';
import type { MentorShot } from './session/vocabulary';
import '../design/tokens.css';
import '../design/system.css';
import './mentorStage.css';

/*
 * THE MENTOR STAGE: the one isolated component of Frontend Bible 08 §7.
 *
 * The chosen character, a real-time render of its real 3D model, standing on
 * its Diorama. The Mentor screen shows it full size (08 §2, §6) and the lesson
 * player shows the SAME component at its compact size (08 §11, B.8); nothing
 * else in the rebuilt frontend reaches the 3D engine (`npm run spec:check`
 * names this file and `learning/CompactMentorStage.tsx`, which wraps it).
 *
 * Documented interface (08 §7; the future mobile wrapper shares it, OD-12):
 *   inputs   character, state, board open or closed, age band; plus the size,
 *            the colour mode, the Diorama, the D7 milestone a celebration is
 *            for, the closing script, the accessible name and the voice clip;
 *   outputs  onReady (the stage is showing the character: which mode, why it
 *            is not live, how long the first render took against the 2.5 s
 *            budget) and onError (the renderer failed, or no still exists).
 *
 * The UI requests a state; `stageStates.ts` says which catalogue pose plays it.
 * The stage never fakes a state: a celebration without a closed-list milestone
 * is shown as idle (OD-7). How it renders on this device is `stageMode.ts`:
 * live 3D, the same 3D with poses held for reduced motion, or pre-rendered
 * stills (no WebGL, low power, data saver, under 30 fps at the lowest tier, or
 * a renderer error).
 */

/** The reduced-motion cross-fade's fade-down (--dur-micro, 150 ms): the held pose changes while the scene is faded. */
const HELD_SWITCH_MS = 150;

const TutorStage = lazy(() => import('../../tutor-scene/TutorStage').then((module) => ({ default: module.TutorStage })));

export type MentorStageSize = 'full' | 'compact';
export type MentorStageScene = 'diorama-a' | 'diorama-b';

export interface MentorStageReady {
  mode: MentorStageMode;
  fallback: MentorStageFallback | null;
  /** From mount to the character on screen (the live model, or the still in the fallback). */
  firstRenderMs: number;
  withinBudget: boolean;
}

export interface MentorStageError {
  /** `render-error`: the 3D renderer failed and the stage fell back to stills. `no-still`: nothing real to show in the fallback. */
  reason: 'render-error' | 'no-still';
}

export interface MentorStageCopy {
  /** `{name}, {state}` in the learner's language. */
  label: string;
  states: Readonly<Record<MentorStageState, string>>;
}

/** The stage's accessible name for the state it is actually showing. */
export function mentorStageLabel(copy: MentorStageCopy, character: MentorCharacter, state: MentorStageState): string {
  return copy.label.replace('{name}', MENTOR_NAMES[character]).replace('{state}', copy.states[state]);
}

export interface MentorStageProps {
  character: MentorCharacter;
  state: MentorStageState;
  /** The teaching board is open (08 §2 layer 4): on a phone-width stage the scene lifts so the character stays in view above it. */
  board?: boolean;
  ageBand: AgeBand;
  size?: MentorStageSize;
  theme: 'light' | 'dark';
  scene?: MentorStageScene;
  /** The D7 milestone a `celebrating` state is for. Without one the stage does not celebrate. */
  milestone?: Milestone | null;
  /** How the session ended, for `closing` (C.16). */
  closing?: MentorClosingScript | null;
  /** Bump to play the same state's gesture again (a second miss gets a second nod). */
  beat?: number;
  /**
   * The camera shot, from the session's phase (`session/phases.ts` `shotForPhase`).
   * Default: the close-up at full size (measured on both Dioramas: the face and
   * hands clear of every prop), the wide close-up in the compact lesson band.
   */
  shot?: MentorShot;
  /**
   * The copy for the stage's accessible name: the character's name and what it
   * is doing (`rebuild-mentor.json` `mentorStage`). Absent: the stage is
   * decorative, as in a lesson, where the prompt label carries the name.
   */
  copy?: MentorStageCopy;
  /** The Mentor's voice for the current turn, or null when silent. The mouth follows it. */
  speechUrl?: string | null;
  audioKey?: number;
  onSpeechEnd?: () => void;
  onSpeechBlocked?: (blocked: boolean) => void;
  onReady?: (event: MentorStageReady) => void;
  onError?: (event: MentorStageError) => void;
  className?: string;
}

function readEnvironment(): StageEnvironment {
  const probe = getDeviceProbe();
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return {
    webgl: probe.webgl !== 'none',
    lowPower: pickInitialTier(probe) === 'low',
    saveData: connection?.saveData === true,
    /*
     * From the renderer's own probe, read once per page like the renderer reads
     * it: a stage that switched to held poses while the engine kept animating
     * would claim a mode it is not in. A changed preference applies on reload.
     */
    reducedMotion: probe.prefersReducedMotion,
  };
}

/** A failed renderer becomes the still fallback, never a blank or crashed screen. */
class RendererBoundary extends Component<{ onFailure: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function MentorStage({
  character, state, board = false, ageBand, size = 'full', theme, scene = 'diorama-a', milestone = null, closing = null,
  beat = 0, shot, copy, speechUrl = null, audioKey = 0, onSpeechEnd, onSpeechBlocked, onReady, onError, className,
}: MentorStageProps) {
  const [environment] = useState<StageEnvironment>(readEnvironment);
  const [failure, setFailure] = useState<MentorStageFailure | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [stillGone, setStillGone] = useState(false);
  const mountedAt = useRef(typeof performance === 'undefined' ? 0 : performance.now());
  const [firstRenderMs, setFirstRenderMs] = useState<number | null>(null);
  const strikes = useRef(0);
  const reported = useRef<string | null>(null);

  const { mode, fallback } = decideStageMode(environment, failure);
  const { state: shown, pose } = resolveMentorPose({ state, ageBand, milestone, closing });
  const mentor = REGISTERS[registerForCopyBand(ageBand)].mentor;
  const band = ageBand === '13-17' || ageBand === 'adult' ? 'teen' : 'young';
  const stills = findStageStills({ character, poseId: pose.id, theme, size, band });
  const rendered3d = mode !== 'still';

  // A new character, Diorama or render mode loads again: the still covers the wait.
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    const key = `${character}:${scene}:${mode}`;
    // The first render is timed from mount; a later change is timed from the change.
    if (loaded.current !== null && loaded.current !== key) mountedAt.current = typeof performance === 'undefined' ? 0 : performance.now();
    loaded.current = key;
    setLiveReady(false); setStillGone(false); strikes.current = 0;
  }, [character, scene, mode]);
  useEffect(() => {
    if (!liveReady) return undefined;
    const timer = window.setTimeout(() => setStillGone(true), 400);
    return () => window.clearTimeout(timer);
  }, [liveReady]);

  const report = useCallback((ready: MentorStageMode) => {
    const key = `${ready}:${character}:${scene}`;
    if (reported.current === key) return;
    reported.current = key;
    const elapsed = Math.round((typeof performance === 'undefined' ? 0 : performance.now()) - mountedAt.current);
    setFirstRenderMs((current) => current ?? elapsed);
    onReady?.({ mode: ready, fallback, firstRenderMs: elapsed, withinBudget: elapsed <= FIRST_RENDER_BUDGET_MS });
  }, [character, scene, fallback, onReady]);

  const stillMissing = stills === null;
  useEffect(() => {
    if (mode === 'still' && stillMissing) onError?.({ reason: 'no-still' });
  }, [mode, stillMissing, onError]);

  const fail = useCallback((reason: MentorStageFailure) => {
    setFailure((current) => current ?? reason);
    if (reason === 'render-error') onError?.({ reason });
  }, [onError]);

  // The catalogue idle loop takes the hero object's idle slot (02 §9.4, 08 §3): one of the three, and only while live.
  const idle = useIdleMotion('hero', mode === 'live');
  /*
   * Reduced motion: a pose change is a short cross-fade, not a movement (08 §7).
   * The scene fades down, the held pose switches while it is faded, and the
   * scene fades back up. A repeated state (a second miss) fades the same way.
   */
  const [heldPose, setHeldPose] = useState(pose);
  const [swapping, setSwapping] = useState(false);
  const firstPose = useRef(true);
  useEffect(() => {
    if (firstPose.current || mode !== 'held') { firstPose.current = false; setHeldPose(pose); setSwapping(false); return undefined; }
    setSwapping(true);
    const timer = window.setTimeout(() => { setHeldPose(pose); setSwapping(false); }, HELD_SWITCH_MS);
    return () => window.clearTimeout(timer);
    // `pose` is a constant row of the catalogue table, so its id is its identity.
  }, [mode, pose.id, beat]);
  const played = mode === 'held' ? heldPose : pose;

  /*
   * In the still fallback there is no renderer to own the voice, so the stage
   * plays the clip itself: a learner on a low-power phone still hears the
   * Mentor, and a blocked autoplay is reported like the renderer reports it.
   */
  const speechEnd = useRef(onSpeechEnd);
  speechEnd.current = onSpeechEnd;
  const speechBlocked = useRef(onSpeechBlocked);
  speechBlocked.current = onSpeechBlocked;
  useEffect(() => {
    if (mode !== 'still' || !speechUrl || typeof Audio === 'undefined') return undefined;
    const audio = new Audio(speechUrl);
    let current = true;
    audio.onended = () => { if (current) speechEnd.current?.(); };
    try {
      const played = audio.play() as Promise<void> | undefined;
      if (played && typeof played.then === 'function') {
        played.then(() => { if (current) speechBlocked.current?.(false); }, () => { if (current) speechBlocked.current?.(true); });
      }
    } catch { speechBlocked.current?.(true); }
    return () => { current = false; audio.pause(); audio.removeAttribute('src'); };
  }, [mode, speechUrl, audioKey]);

  const showStill = !!stills && (mode === 'still' || !stillGone);
  const stillVisible = showStill && (mode === 'still' || !liveReady);
  const compact = size === 'compact';
  const style = compact ? ({ '--lf-mentor-band-size': `${mentor.stageBandPx}px` } as CSSProperties) : undefined;
  const classes = ['lf-mentor-stage', `lf-mentor-stage--${size}`, compact ? `lf-mentor-band lf-mentor-band--${ageBand}` : '', className ?? '']
    .filter(Boolean).join(' ');

  return <div className={classes} style={style}
    {...(copy ? { role: 'img', 'aria-label': mentorStageLabel(copy, character, shown) } : { 'aria-hidden': true })}
    data-mentor-stage={size} data-render-mode={mode} data-fallback={fallback ?? undefined}
    data-mentor-state={shown} data-mentor-requested-state={state !== shown ? state : undefined}
    data-mentor-pose={pose.id} data-mentor-emotion={pose.emotion} data-mentor-action={pose.action}
    data-mentor-character={character} data-mentor-scene={scene} data-mentor-presence={mentor.presence}
    data-board={board ? 'open' : 'closed'} data-idle-motion={idle ? 'hero' : undefined}
    data-ready={(mode === 'still' ? firstRenderMs !== null : liveReady) ? 'true' : 'false'}
    data-first-render-ms={firstRenderMs ?? undefined}
    data-still-pose={stillVisible ? stills?.base.poseId : undefined}>
    <div className="lf-mentor-stage-scene" data-swap={swapping ? 'out' : undefined}>
      {showStill && stills ? <picture key={`${stills.base.id}:${mode}`}>
        {stills.square ? <source media="(min-width: 640px)" srcSet={stills.square.path} /> : null}
        <img className={`lf-mentor-stage-still lf-mentor-stage-still--${stills.base.fit}`}
          src={stills.base.path} alt="" data-leaving={mode !== 'still' && liveReady ? 'true' : undefined}
          onLoad={() => { if (mode === 'still') report('still'); }} />
      </picture> : null}
      {rendered3d ? <div className="lf-mentor-stage-live" data-visible={liveReady ? 'true' : 'false'}>
        <RendererBoundary key={`${character}:${scene}:${mode}`} onFailure={() => fail('render-error')}>
          <StaticThemeProvider isDark={theme === 'dark'}>
            <Suspense fallback={null}>
              <TutorStage className="lf-mentor-stage-canvas" scene={scene}
                character={character} companion={null} shot={shot ?? (compact ? 'closeup-wide' : 'closeup')} emotion={played.emotion} action={played.action} actionKey={beat}
                characterSpeaking={shown === 'speaking'} speechUrl={speechUrl} audioKey={audioKey}
                onSpeechEnd={onSpeechEnd} onSpeechBlocked={onSpeechBlocked}
                onReady={() => { setLiveReady(true); report(mode); }}
                onStats={(stats) => {
                  strikes.current = frameRateStrikes(strikes.current, stats);
                  if (strikes.current >= FRAME_RATE_STRIKES) fail('frame-rate');
                }} />
            </Suspense>
          </StaticThemeProvider>
        </RendererBoundary>
      </div> : null}
    </div>
  </div>;
}
