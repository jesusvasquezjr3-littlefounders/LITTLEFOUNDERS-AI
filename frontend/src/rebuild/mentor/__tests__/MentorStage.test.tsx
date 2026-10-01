import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultStageShot, MentorStage } from '../MentorStage';
import { CompactMentorStage } from '../../learning/CompactMentorStage';

/*
 * The stage's contract (Frontend Bible 08 §7) with the renderer replaced: the
 * device probe decides the mode, the TutorStage double records what the stage
 * asks the real renderer to play, and its callbacks are driven by hand.
 */
type StageProps = {
  character?: string; scene?: string; emotion?: string; action?: string; actionKey?: number; shot?: string;
  characterSpeaking?: boolean; speechUrl?: string | null; companion?: string | null;
  onReady?: () => void; onStats?: (stats: { fps: number; tier: string }) => void;
};
const harness = vi.hoisted(() => ({
  probe: { cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false },
  tier: 'medium',
  crash: false,
  last: null as null | StageProps,
  /** Gap-fix round 8: a rendered sequence to offer in place of the manifest's (undefined keeps the real lookup). */
  sequence: undefined as undefined | null | { id: string; path: string; poseId: string; durationMs: number; endFrame: string },
}));

vi.mock('../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => harness.probe,
  pickInitialTier: () => harness.tier,
}));
vi.mock('../stageStills', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stageStills')>();
  return {
    ...actual,
    findStageSequence: (...args: Parameters<typeof actual.findStageSequence>) => {
      if (harness.sequence === undefined) return actual.findStageSequence(...args);
      return harness.sequence && args[1] === harness.sequence.poseId && args[1] !== 'ambient.idle' ? harness.sequence : null;
    },
  };
});
vi.mock('../../../tutor-scene/TutorStage', () => ({
  TutorStage: (props: StageProps) => {
    if (harness.crash) throw new Error('WebGL context lost');
    harness.last = props;
    return <div data-testid="tutor-stage" data-character={props.character} data-emotion={props.emotion} data-action={props.action} />;
  },
}));

const stage = () => document.querySelector<HTMLElement>('.lf-mentor-stage')!;

beforeEach(() => {
  harness.probe = { ...harness.probe, webgl: 'webgl2', prefersReducedMotion: false };
  harness.tier = 'medium';
  harness.crash = false;
  harness.last = null;
  harness.sequence = null;
});
afterEach(() => vi.useRealTimers());

async function paintStill(image = document.querySelector<HTMLImageElement>('.lf-mentor-stage-still')!) {
  Object.defineProperties(image, { complete: { configurable: true, value: true }, naturalWidth: { configurable: true, value: 375 } });
  fireEvent.load(image);
  if (vi.isFakeTimers()) await act(async () => { await vi.advanceTimersByTimeAsync(48); });
  else await waitFor(() => expect(stage().dataset.visualReady).toBe('true'));
}
async function rendererAfterStill() {
  await paintStill();
  return screen.findByTestId('tutor-stage');
}

describe('MentorStage: live 3D', () => {
  it('recovers a broken progressive still with a live renderer without inventing visual readiness', async () => {
    const onReady = vi.fn();
    render(<MentorStage character="rho" state="idle" ageBand="6-9" theme="light" onReady={onReady} />);
    fireEvent.error(document.querySelector('.lf-mentor-stage-still')!);
    await screen.findByTestId('tutor-stage');
    expect(stage().dataset.visualReady).toBe('false');
    expect(stage().dataset.firstRenderMs).toBeUndefined();
    expect(onReady).not.toHaveBeenCalled();
    act(() => harness.last!.onReady!());
    expect(stage().dataset.visualReady).toBe('true');
    expect(stage().dataset.ready).toBe('true');
    expect(onReady).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'live' }));
  });

  it('paints the decoded approved still before constructing 3D, then keeps first visual and live readiness distinct', async () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    render(<MentorStage character="rho" state="idle" ageBand="10-12" theme="dark" onReady={onReady} />);
    expect(screen.queryByTestId('tutor-stage')).toBeNull();
    expect(stage().dataset.visualReady).toBe('false');
    const image = document.querySelector<HTMLImageElement>('.lf-mentor-stage-still')!;
    Object.defineProperties(image, { complete: { configurable: true, value: true }, naturalWidth: { configurable: true, value: 375 } });
    fireEvent.load(image);
    await act(async () => { await vi.advanceTimersByTimeAsync(16); });
    expect(screen.queryByTestId('tutor-stage')).toBeNull();
    expect(onReady).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(32); });
    expect(screen.getByTestId('tutor-stage')).toBeInTheDocument();
    expect(stage().dataset.visualReady).toBe('true');
    expect(stage().dataset.ready).toBe('false');
    expect(onReady).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'still', fallback: null, withinBudget: true }));
    const firstVisual = stage().dataset.firstRenderMs;
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); harness.last!.onReady!(); });
    expect(stage().dataset.ready).toBe('true');
    expect(stage().dataset.firstRenderMs).toBe(firstVisual);
    expect(Number(stage().dataset.liveReadyMs)).toBeGreaterThan(2500);
  });

  it('ignores a stale still paint and requires a new decoded still after a character or scene change', async () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const { rerender } = render(<MentorStage character="rho" state="idle" ageBand="6-9" theme="light" onReady={onReady} />);
    const oldImage = document.querySelector<HTMLImageElement>('.lf-mentor-stage-still')!;
    Object.defineProperties(oldImage, { complete: { configurable: true, value: true }, naturalWidth: { configurable: true, value: 375 } });
    fireEvent.load(oldImage);
    rerender(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" onReady={onReady} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(48); });
    expect(onReady).not.toHaveBeenCalled();
    expect(stage().dataset.visualReady).toBe('false');
    expect(screen.queryByTestId('tutor-stage')).toBeNull();
    await paintStill();
    expect(screen.getByTestId('tutor-stage')).toBeInTheDocument();
    act(() => harness.last!.onReady!());
    rerender(<MentorStage character="zara" scene="diorama-b" state="idle" ageBand="6-9" theme="light" onReady={onReady} />);
    expect(stage().dataset.ready).toBe('false');
    expect(stage().dataset.visualReady).toBe('false');
    expect(stage().dataset.firstRenderMs).toBeUndefined();
    expect(stage().dataset.liveReadyMs).toBeUndefined();
    expect(screen.queryByTestId('tutor-stage')).toBeNull();
    await paintStill();
    expect(screen.getByTestId('tutor-stage')).toBeInTheDocument();
    expect(harness.last?.scene).toBe('diorama-b');
  });

  it('asks the real renderer for the catalogue pose of the requested state, alone on its Diorama', async () => {
    render(<MentorStage character="zara" state="thinking" ageBand="6-9" theme="light" scene="diorama-b" />);
    const renderer = await rendererAfterStill();
    expect(renderer.dataset.character).toBe('zara');
    expect(harness.last).toMatchObject({ scene: 'diorama-b', emotion: 'thinking', action: 'think', companion: null, shot: 'closeup' });
    expect(stage().dataset.renderMode).toBe('live');
    expect(stage().dataset.mentorPose).toBe('think.ponder');
    expect(stage().dataset.mentorState).toBe('thinking');
  });

  it('frames Dina whole on diorama-a (the close-up is only her head there) and keeps every other default shot', async () => {
    expect(defaultStageShot('dina', 'diorama-a', 'full')).toBe('closeup-wide');
    expect(defaultStageShot('dina', 'diorama-b', 'full')).toBe('closeup');
    for (const character of ['rho', 'zara', 'liruf'] as const) {
      expect(defaultStageShot(character, 'diorama-a', 'full')).toBe('closeup');
      expect(defaultStageShot(character, 'diorama-b', 'full')).toBe('closeup');
    }
    expect(defaultStageShot('dina', 'diorama-b', 'compact')).toBe('closeup-wide');
    render(<MentorStage character="dina" state="idle" ageBand="6-9" theme="light" scene="diorama-a" />);
    await rendererAfterStill();
    expect(harness.last?.shot).toBe('closeup-wide');
  });

  it('shows the character still until the model is ready, then reports ready inside the budget', async () => {
    const onReady = vi.fn();
    render(<MentorStage character="rho" state="idle" ageBand="10-12" theme="dark" onReady={onReady} />);
    await rendererAfterStill();
    // W3M.1: the still of the same character AND pose covers the wait (08 §7).
    expect(document.querySelector('.lf-mentor-stage-still')?.getAttribute('src')).toBe('/rebuild/mentor-stage/rho-ambient-idle-dark.png');
    expect(stage().dataset.ready).toBe('false');
    act(() => harness.last!.onReady!());
    expect(stage().dataset.ready).toBe('true');
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ mode: 'live', fallback: null, withinBudget: true }));
    expect(Number(stage().dataset.firstRenderMs)).toBeGreaterThanOrEqual(0);
  });

  it('drives the speaking animation only while speaking, and forwards the voice clip', async () => {
    const { rerender } = render(<MentorStage character="dina" state="listening" ageBand="6-9" theme="light" />);
    await rendererAfterStill();
    expect(harness.last?.characterSpeaking).toBe(false);
    rerender(<MentorStage character="dina" state="speaking" ageBand="6-9" theme="light" speechUrl="https://depot.example/turn.mp3" />);
    expect(harness.last).toMatchObject({ characterSpeaking: true, speechUrl: 'https://depot.example/turn.mp3' });
  });

  it('replays a gesture for a new beat of the same state', async () => {
    const { rerender } = render(<MentorStage character="liruf" state="encouraging" ageBand="6-9" theme="light" beat={1} />);
    await rendererAfterStill();
    rerender(<MentorStage character="liruf" state="encouraging" ageBand="6-9" theme="light" beat={2} />);
    expect(harness.last?.actionKey).toBe(2);
  });

  it('refuses a celebration without a D7 milestone and shows idle instead (OD-7)', async () => {
    render(<MentorStage character="zara" state="celebrating" ageBand="6-9" theme="light" />);
    await rendererAfterStill();
    expect(stage().dataset.mentorState).toBe('idle');
    expect(stage().dataset.mentorRequestedState).toBe('celebrating');
    expect(harness.last?.action).not.toBe('celebrate');
  });

  it('celebrates a milestone the session reached', async () => {
    render(<MentorStage character="zara" state="celebrating" milestone="lesson-complete" ageBand="6-9" theme="light" />);
    await rendererAfterStill();
    expect(stage().dataset.mentorState).toBe('celebrating');
    expect(harness.last?.action).toBe('celebrate');
  });

  it('claims the hero idle slot while live, and only then (02 §9.4)', async () => {
    render(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" />);
    await rendererAfterStill();
    expect(stage().dataset.idleMotion).toBe('hero');
  });

  it('falls back to its still at the lowest tier when the device stays under 30 fps', async () => {
    const onReady = vi.fn();
    render(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" onReady={onReady} />);
    await rendererAfterStill();
    act(() => { for (let i = 0; i < 3; i++) harness.last!.onStats!({ fps: 22, tier: 'low' }); });
    expect(stage().dataset.renderMode).toBe('still');
    expect(stage().dataset.fallback).toBe('frame-rate');
    expect(screen.queryByTestId('tutor-stage')).toBeNull();
    await paintStill();
    expect(onReady).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'still', fallback: 'frame-rate' }));
  });

  it('turns a renderer failure into the still fallback and an error event, never a blank stage', async () => {
    harness.crash = true;
    const onError = vi.fn();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<MentorStage character="rho" state="idle" ageBand="adult" theme="light" onError={onError} />);
    await paintStill();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith({ reason: 'render-error' }));
    quiet.mockRestore();
    expect(stage().dataset.renderMode).toBe('still');
    expect(stage().dataset.fallback).toBe('render-error');
    expect(document.querySelector('.lf-mentor-stage-still')?.getAttribute('src')).toBe('/rebuild/mentor-stage/rho-ambient-idle-light.png');
  });
});

describe('MentorStage: reduced motion holds poses (08 §7)', () => {
  beforeEach(() => { harness.probe = { ...harness.probe, prefersReducedMotion: true }; });

  it('renders the same 3D with poses held, no idle loop, and switches poses behind a short fade', async () => {
    vi.useFakeTimers();
    const { rerender } = render(<MentorStage character="dina" state="idle" ageBand="6-9" theme="light" />);
    await paintStill();
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    expect(stage().dataset.renderMode).toBe('held');
    expect(stage().dataset.idleMotion).toBeUndefined();
    expect(harness.last?.action).toBe('idle');
    rerender(<MentorStage character="dina" state="demonstrating" ageBand="6-9" theme="light" />);
    // The scene fades down first; the renderer still holds the previous pose.
    expect(document.querySelector('.lf-mentor-stage-scene')?.getAttribute('data-swap')).toBe('out');
    expect(harness.last?.action).toBe('idle');
    act(() => { vi.advanceTimersByTime(150); });
    expect(document.querySelector('.lf-mentor-stage-scene')?.getAttribute('data-swap')).toBeNull();
    expect(harness.last).toMatchObject({ emotion: 'encouraging', action: 'point' });
  });
});

describe('MentorStage: stills fallback (08 §7)', () => {
  it('reports a broken permanent still without falsely reporting a visible stage', () => {
    harness.probe = { ...harness.probe, webgl: 'none' };
    const onReady = vi.fn(), onError = vi.fn();
    render(<MentorStage character="rho" state="idle" ageBand="6-9" theme="light" onReady={onReady} onError={onError} />);
    fireEvent.error(document.querySelector('.lf-mentor-stage-still')!);
    expect(onError).toHaveBeenCalledWith({ reason: 'no-still' });
    expect(onReady).not.toHaveBeenCalled();
    expect(stage().dataset.ready).toBe('false');
    expect(stage().dataset.visualReady).toBe('false');
    expect(screen.queryByTestId('tutor-stage')).toBeNull();
  });

  it('shows a still of the same character without WebGL, and never loads the renderer', async () => {
    harness.probe = { ...harness.probe, webgl: 'none' };
    const onReady = vi.fn();
    render(<MentorStage character="liruf" state="listening" ageBand="10-12" theme="dark" onReady={onReady} />);
    expect(stage().dataset.renderMode).toBe('still');
    expect(stage().dataset.fallback).toBe('no-webgl');
    expect(screen.queryByTestId('tutor-stage')).toBeNull();
    const still = document.querySelector<HTMLImageElement>('.lf-mentor-stage-still')!;
    // W3M.1: the still of the state the stage is in (08 §7), and the stage says which pose it shows.
    expect(still.getAttribute('src')).toBe('/rebuild/mentor-stage/liruf-ambient-listen-dark.png');
    expect(still.getAttribute('alt')).toBe('');
    expect(stage().dataset.stillPose).toBe('ambient.listen');
    await paintStill(still);
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ mode: 'still', fallback: 'no-webgl' }));
    expect(stage().dataset.ready).toBe('true');
  });

  it('W3M.1: a state change in the fallback fades to the next pose\'s still once and settles', () => {
    harness.probe = { ...harness.probe, webgl: 'none' };
    vi.useFakeTimers();
    try {
      const { rerender } = render(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" />);
      expect(stage().dataset.stillPose).toBe('ambient.idle');
      rerender(<MentorStage character="zara" state="thinking" ageBand="6-9" theme="light" />);
      expect(document.querySelector('.lf-mentor-stage-scene')?.getAttribute('data-swap')).toBe('out');
      expect(stage().dataset.stillPose).toBe('ambient.idle');
      act(() => { vi.advanceTimersByTime(150); });
      expect(document.querySelector('.lf-mentor-stage-scene')?.getAttribute('data-swap')).toBeNull();
      expect(stage().dataset.stillPose).toBe('think.ponder');
      expect(document.querySelector('.lf-mentor-stage-still')?.getAttribute('src')).toBe('/rebuild/mentor-stage/zara-think-ponder-light.png');
      // The calm register's thinking pose has its own still.
      rerender(<MentorStage character="zara" state="thinking" ageBand="13-17" theme="light" />);
      act(() => { vi.advanceTimersByTime(150); });
      expect(stage().dataset.stillPose).toBe('teach.aside');
    } finally { vi.useRealTimers(); }
  });

  it('still speaks in the still fallback: it plays the clip itself and reports its end and a blocked autoplay', async () => {
    harness.probe = { ...harness.probe, webgl: 'none' };
    const played: { src: string; audio: HTMLAudioElement }[] = [];
    let block = false;
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      played.push({ src: this.src, audio: this as HTMLAudioElement });
      return block ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve();
    });
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    try {
      const onSpeechEnd = vi.fn();
      const onSpeechBlocked = vi.fn();
      const { rerender } = render(<MentorStage character="dina" state="speaking" ageBand="6-9" theme="light"
        speechUrl="https://depot.test/turn-1.mp3" audioKey={1} onSpeechEnd={onSpeechEnd} onSpeechBlocked={onSpeechBlocked} />);
      expect(played.map((p) => p.src)).toEqual(['https://depot.test/turn-1.mp3']);
      await act(async () => { played[0]!.audio.onended?.(new Event('ended')); });
      expect(onSpeechEnd).toHaveBeenCalledTimes(1);
      block = true;
      rerender(<MentorStage character="dina" state="speaking" ageBand="6-9" theme="light"
        speechUrl="https://depot.test/turn-2.mp3" audioKey={2} onSpeechEnd={onSpeechEnd} onSpeechBlocked={onSpeechBlocked} />);
      await act(async () => { await Promise.resolve(); });
      expect(onSpeechBlocked).toHaveBeenLastCalledWith(true);
      expect(pause).toHaveBeenCalled();
    } finally {
      play.mockRestore();
      pause.mockRestore();
    }
  });

  it('falls back on a low-power device', () => {
    harness.tier = 'low';
    render(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" />);
    expect(stage().dataset.fallback).toBe('low-power');
  });

  it('falls back with data saver on', () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    try {
      render(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" />);
      expect(stage().dataset.fallback).toBe('data-saver');
    } finally {
      Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined });
    }
  });
});

describe('MentorStage: interface and accessibility', () => {
  it('is an image named for the character and the state it actually shows, and decorative without copy', async () => {
    const copy = { label: '{name}, {state}', states: { idle: 'waiting', listening: 'listening', thinking: 'thinking', speaking: 'talking',
      demonstrating: 'showing you', encouraging: 'cheering you on', celebrating: 'celebrating', closing: 'saying goodbye', acknowledging: 'smiling' } };
    const { unmount, rerender } = render(<MentorStage character="rho" state="listening" ageBand="6-9" theme="light" copy={copy} />);
    expect(screen.getByRole('img', { name: 'Dr. Rho, listening' })).toBe(stage());
    // A refused celebration is named for what is shown, not for what was asked.
    rerender(<MentorStage character="rho" state="celebrating" ageBand="6-9" theme="light" copy={copy} />);
    expect(screen.getByRole('img', { name: 'Dr. Rho, waiting' })).toBe(stage());
    unmount();
    render(<MentorStage character="dina" state="listening" ageBand="6-9" theme="light" />);
    expect(stage().getAttribute('aria-hidden')).toBe('true');
    expect(stage().getAttribute('role')).toBeNull();
    await rendererAfterStill();
  });

  it('tells the layout when the board is open', async () => {
    const { rerender } = render(<MentorStage character="rho" state="demonstrating" ageBand="10-12" theme="light" />);
    expect(stage().dataset.board).toBe('closed');
    rerender(<MentorStage character="rho" state="demonstrating" ageBand="10-12" theme="light" board />);
    expect(stage().dataset.board).toBe('open');
    await rendererAfterStill();
  });

  it('is the lesson compact stage too: the same component, band height from the register (08 §11, B.23)', async () => {
    const heights: string[] = [];
    for (const ageBand of ['6-9', '10-12', '13-17'] as const) {
      const { unmount } = render(<CompactMentorStage ageBand={ageBand} theme="light" verdict={null} character="zara" scene="diorama-a" />);
      expect(stage().classList.contains('lf-mentor-stage--compact')).toBe(true);
      expect(stage().classList.contains('lf-mentor-band')).toBe(true);
      heights.push(stage().style.getPropertyValue('--lf-mentor-band-size'));
      await rendererAfterStill();
      unmount();
    }
    expect(heights).toEqual(['110px', '96px', '80px']);
  });

  it('reacts to lesson verdicts through the stage states: encouraging for a miss, a quiet acknowledgment for a met answer', async () => {
    const { rerender } = render(<CompactMentorStage ageBand="6-9" theme="light" verdict="review" character="zara" scene="diorama-a" />);
    await rendererAfterStill();
    expect(stage().dataset.mentorState).toBe('encouraging');
    expect(harness.last).toMatchObject({ emotion: 'encouraging', action: 'nod' });
    rerender(<CompactMentorStage ageBand="6-9" theme="light" verdict="met" character="zara" scene="diorama-a" />);
    expect(stage().dataset.mentorState).toBe('acknowledging');
    expect(harness.last?.action).not.toBe('celebrate');
  });
});

describe('MentorStage: rendered sequences in the fallback (gap-fix round 8, 08 §7, 07 §5)', () => {
  const SEQUENCE = { id: 'mentor.zara.sequence.think.ponder.light', path: '/rebuild/mentor-sequence/zara-think-ponder-light.webp', poseId: 'think.ponder', durationMs: 380, endFrame: 'mentor.zara.stage.think.ponder.light' };
  let requests: { url: string; init?: RequestInit }[] = [];
  beforeEach(() => {
    harness.probe = { ...harness.probe, webgl: 'none' };
    harness.sequence = SEQUENCE;
    requests = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return { ok: true, blob: async () => new Blob(['webp']) } as unknown as Response;
    }));
    let n = 0;
    Object.assign(URL, { createObjectURL: () => `blob:seq-${++n}`, revokeObjectURL: () => undefined });
    vi.useFakeTimers();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  const sequenceImage = () => document.querySelector<HTMLImageElement>('.lf-mentor-stage-sequence');

  it('plays the pose sequence once on a state change and settles on that pose still', async () => {
    const { rerender } = render(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" />);
    expect(sequenceImage()).toBeNull();
    rerender(<MentorStage character="zara" state="thinking" ageBand="6-9" theme="light" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(requests.map((r) => r.url)).toEqual([SEQUENCE.path]);
    expect(stage().dataset.stillSequence).toBe(SEQUENCE.id);
    expect(stage().dataset.stillPose).toBe('think.ponder');
    // The still under it is already the pose's own end frame.
    expect(document.querySelector('.lf-mentor-stage-still:not(.lf-mentor-stage-sequence)')?.getAttribute('src')).toBe('/rebuild/mentor-stage/zara-think-ponder-light.png');
    fireEvent.load(sequenceImage()!);
    await act(async () => { await vi.advanceTimersByTimeAsync(SEQUENCE.durationMs); });
    // Played once: gone, and the still stays.
    expect(sequenceImage()).toBeNull();
    expect(stage().dataset.stillSequence).toBeUndefined();
    expect(document.querySelector('.lf-mentor-stage-still')?.getAttribute('src')).toBe('/rebuild/mentor-stage/zara-think-ponder-light.png');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(requests).toHaveLength(1);
  });

  it('never plays a sequence into idle: idle is a still', async () => {
    const { rerender } = render(<MentorStage character="zara" state="thinking" ageBand="6-9" theme="light" />);
    rerender(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(requests).toHaveLength(0);
    expect(sequenceImage()).toBeNull();
    expect(stage().dataset.stillPose).toBe('ambient.idle');
  });

  it('never plays a sequence under reduced motion: the still comes in under the fade', async () => {
    harness.probe = { ...harness.probe, prefersReducedMotion: true };
    const { rerender } = render(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" />);
    rerender(<MentorStage character="zara" state="thinking" ageBand="6-9" theme="light" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(requests).toHaveLength(0);
    expect(sequenceImage()).toBeNull();
    expect(stage().dataset.stillPose).toBe('think.ponder');
  });

  it('with data saver on, asks only for a copy the browser already holds, and settles on the still without one', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      throw new TypeError('not cached');
    }));
    harness.probe = { ...harness.probe, webgl: 'webgl2' };
    const { rerender } = render(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" environment={{ saveData: true }} />);
    expect(stage().dataset.fallback).toBe('data-saver');
    rerender(<MentorStage character="zara" state="thinking" ageBand="6-9" theme="light" environment={{ saveData: true }} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(requests[0]?.init).toMatchObject({ cache: 'only-if-cached' });
    expect(sequenceImage()).toBeNull();
    expect(stage().dataset.stillPose).toBe('think.ponder');
  });

  it('settles on the still when the sequence is late', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    const { rerender } = render(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" />);
    rerender(<MentorStage character="zara" state="thinking" ageBand="6-9" theme="light" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(sequenceImage()).toBeNull();
    expect(stage().dataset.stillPose).toBe('think.ponder');
  });
});
