import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MentorStage } from '../MentorStage';
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
}));

vi.mock('../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => harness.probe,
  pickInitialTier: () => harness.tier,
}));
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
});
afterEach(() => vi.useRealTimers());

describe('MentorStage: live 3D', () => {
  it('asks the real renderer for the catalogue pose of the requested state, alone on its Diorama', async () => {
    render(<MentorStage character="zara" state="thinking" ageBand="6-9" theme="light" scene="diorama-b" />);
    const renderer = await screen.findByTestId('tutor-stage');
    expect(renderer.dataset.character).toBe('zara');
    expect(harness.last).toMatchObject({ scene: 'diorama-b', emotion: 'thinking', action: 'think', companion: null, shot: 'closeup' });
    expect(stage().dataset.renderMode).toBe('live');
    expect(stage().dataset.mentorPose).toBe('think.ponder');
    expect(stage().dataset.mentorState).toBe('thinking');
  });

  it('shows the character still until the model is ready, then reports ready inside the budget', async () => {
    const onReady = vi.fn();
    render(<MentorStage character="rho" state="idle" ageBand="10-12" theme="dark" onReady={onReady} />);
    await screen.findByTestId('tutor-stage');
    expect(document.querySelector('.lf-mentor-stage-still')?.getAttribute('src')).toBe('/rebuild/mentor-avatars/rho-dark.png');
    expect(stage().dataset.ready).toBe('false');
    act(() => harness.last!.onReady!());
    expect(stage().dataset.ready).toBe('true');
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ mode: 'live', fallback: null, withinBudget: true }));
    expect(Number(stage().dataset.firstRenderMs)).toBeGreaterThanOrEqual(0);
  });

  it('drives the speaking animation only while speaking, and forwards the voice clip', async () => {
    const { rerender } = render(<MentorStage character="dina" state="listening" ageBand="6-9" theme="light" />);
    await screen.findByTestId('tutor-stage');
    expect(harness.last?.characterSpeaking).toBe(false);
    rerender(<MentorStage character="dina" state="speaking" ageBand="6-9" theme="light" speechUrl="https://depot.example/turn.mp3" />);
    expect(harness.last).toMatchObject({ characterSpeaking: true, speechUrl: 'https://depot.example/turn.mp3' });
  });

  it('replays a gesture for a new beat of the same state', async () => {
    const { rerender } = render(<MentorStage character="liruf" state="encouraging" ageBand="6-9" theme="light" beat={1} />);
    await screen.findByTestId('tutor-stage');
    rerender(<MentorStage character="liruf" state="encouraging" ageBand="6-9" theme="light" beat={2} />);
    expect(harness.last?.actionKey).toBe(2);
  });

  it('refuses a celebration without a D7 milestone and shows idle instead (OD-7)', async () => {
    render(<MentorStage character="zara" state="celebrating" ageBand="6-9" theme="light" />);
    await screen.findByTestId('tutor-stage');
    expect(stage().dataset.mentorState).toBe('idle');
    expect(stage().dataset.mentorRequestedState).toBe('celebrating');
    expect(harness.last?.action).not.toBe('celebrate');
  });

  it('celebrates a milestone the session reached', async () => {
    render(<MentorStage character="zara" state="celebrating" milestone="lesson-complete" ageBand="6-9" theme="light" />);
    await screen.findByTestId('tutor-stage');
    expect(stage().dataset.mentorState).toBe('celebrating');
    expect(harness.last?.action).toBe('celebrate');
  });

  it('claims the hero idle slot while live, and only then (02 §9.4)', async () => {
    render(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" />);
    await screen.findByTestId('tutor-stage');
    expect(stage().dataset.idleMotion).toBe('hero');
  });

  it('falls back to its still at the lowest tier when the device stays under 30 fps', async () => {
    const onReady = vi.fn();
    render(<MentorStage character="zara" state="idle" ageBand="6-9" theme="light" onReady={onReady} />);
    await screen.findByTestId('tutor-stage');
    act(() => { for (let i = 0; i < 3; i++) harness.last!.onStats!({ fps: 22, tier: 'low' }); });
    expect(stage().dataset.renderMode).toBe('still');
    expect(stage().dataset.fallback).toBe('frame-rate');
    expect(screen.queryByTestId('tutor-stage')).toBeNull();
    fireEvent.load(document.querySelector('.lf-mentor-stage-still')!);
    expect(onReady).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'still', fallback: 'frame-rate' }));
  });

  it('turns a renderer failure into the still fallback and an error event, never a blank stage', async () => {
    harness.crash = true;
    const onError = vi.fn();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<MentorStage character="rho" state="idle" ageBand="adult" theme="light" onError={onError} />);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith({ reason: 'render-error' }));
    quiet.mockRestore();
    expect(stage().dataset.renderMode).toBe('still');
    expect(stage().dataset.fallback).toBe('render-error');
    expect(document.querySelector('.lf-mentor-stage-still')?.getAttribute('src')).toBe('/rebuild/mentor-avatars/rho-light.png');
  });
});

describe('MentorStage: reduced motion holds poses (08 §7)', () => {
  beforeEach(() => { harness.probe = { ...harness.probe, prefersReducedMotion: true }; });

  it('renders the same 3D with poses held, no idle loop, and switches poses behind a short fade', async () => {
    vi.useFakeTimers();
    const { rerender } = render(<MentorStage character="dina" state="idle" ageBand="6-9" theme="light" />);
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
  it('shows a still of the same character without WebGL, and never loads the renderer', () => {
    harness.probe = { ...harness.probe, webgl: 'none' };
    const onReady = vi.fn();
    render(<MentorStage character="liruf" state="listening" ageBand="10-12" theme="dark" onReady={onReady} />);
    expect(stage().dataset.renderMode).toBe('still');
    expect(stage().dataset.fallback).toBe('no-webgl');
    expect(screen.queryByTestId('tutor-stage')).toBeNull();
    const still = document.querySelector<HTMLImageElement>('.lf-mentor-stage-still')!;
    expect(still.getAttribute('src')).toBe('/rebuild/mentor-avatars/liruf-dark.png');
    expect(still.getAttribute('alt')).toBe('');
    // The still shows the idle render, and the stage says so rather than claiming "listening".
    expect(stage().dataset.stillPose).toBe('ambient.idle');
    fireEvent.load(still);
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ mode: 'still', fallback: 'no-webgl' }));
    expect(stage().dataset.ready).toBe('true');
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
    await screen.findByTestId('tutor-stage');
  });

  it('tells the layout when the board is open', async () => {
    const { rerender } = render(<MentorStage character="rho" state="demonstrating" ageBand="10-12" theme="light" />);
    expect(stage().dataset.board).toBe('closed');
    rerender(<MentorStage character="rho" state="demonstrating" ageBand="10-12" theme="light" board />);
    expect(stage().dataset.board).toBe('open');
    await screen.findByTestId('tutor-stage');
  });

  it('is the lesson compact stage too: the same component, band height from the register (08 §11, B.23)', async () => {
    const heights: string[] = [];
    for (const ageBand of ['6-9', '10-12', '13-17'] as const) {
      const { unmount } = render(<CompactMentorStage ageBand={ageBand} theme="light" verdict={null} character="zara" scene="diorama-a" />);
      expect(stage().classList.contains('lf-mentor-stage--compact')).toBe(true);
      expect(stage().classList.contains('lf-mentor-band')).toBe(true);
      heights.push(stage().style.getPropertyValue('--lf-mentor-band-size'));
      await screen.findByTestId('tutor-stage');
      unmount();
    }
    expect(heights).toEqual(['110px', '96px', '80px']);
  });

  it('reacts to lesson verdicts through the stage states: encouraging for a miss, a quiet acknowledgment for a met answer', async () => {
    const { rerender } = render(<CompactMentorStage ageBand="6-9" theme="light" verdict="review" character="zara" scene="diorama-a" />);
    await screen.findByTestId('tutor-stage');
    expect(stage().dataset.mentorState).toBe('encouraging');
    expect(harness.last).toMatchObject({ emotion: 'encouraging', action: 'nod' });
    rerender(<CompactMentorStage ageBand="6-9" theme="light" verdict="met" character="zara" scene="diorama-a" />);
    expect(stage().dataset.mentorState).toBe('acknowledging');
    expect(harness.last?.action).not.toBe('celebrate');
  });
});
