import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TutorStage } from '../TutorStage';

/*
 * The scene itself is WebGL and has no place in a jsdom test. What is worth
 * testing here is the seam the conversational layer will actually use: does a
 * speech URL start audio, does the stage close in while it plays, and does it
 * go back when the clip ends.
 */
vi.mock('../TutorScene', () => ({
  TutorScene: (props: Record<string, unknown>) => (
    <div
      data-testid="scene"
      data-framing={String(props.framing)}
      data-viseme={String(props.viseme)}
      data-emotion={String(props.emotion)}
      data-action={String(props.action)}
      data-hasready={String(typeof props.onReady === 'function')}
    />
  ),
}));

vi.mock('../useLipSync', () => ({ useLipSync: () => 3 }));

let played: number;
let paused: number;

beforeEach(() => {
  played = 0;
  paused = 0;
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => {
    played += 1;
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {
    paused += 1;
  });
});

afterEach(() => vi.restoreAllMocks());

describe('TutorStage', () => {
  it('stays on the establishing shot with a shut mouth when silent', () => {
    render(<TutorStage />);
    const scene = screen.getByTestId('scene');
    expect(scene.dataset.framing).toBe('vignette');
    expect(scene.dataset.viseme).toBe('0');
    expect(played).toBe(0);
  });

  it('closes in and plays when given speech', () => {
    render(<TutorStage speechUrl="/speech/hello.mp3" />);
    const scene = screen.getByTestId('scene');
    // Lip-sync is meaningless at the island framing — the mouth is 2.4 px
    // there — so speaking has to move the camera, not just the mouth.
    expect(scene.dataset.framing).toBe('conversation');
    expect(scene.dataset.viseme).toBe('3');
    expect(played).toBe(1);
  });

  it('returns to the establishing shot and reports when the clip ends', () => {
    const onSpeechEnd = vi.fn();
    render(<TutorStage speechUrl="/speech/hello.mp3" onSpeechEnd={onSpeechEnd} />);
    const audio = document.querySelector('audio')!;
    act(() => {
      audio.dispatchEvent(new Event('ended'));
    });
    expect(onSpeechEnd).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('scene').dataset.framing).toBe('vignette');
    expect(screen.getByTestId('scene').dataset.viseme).toBe('0');
  });

  it('treats a new URL as an interruption rather than a queue', () => {
    // A tutor that finishes its sentence after the child has moved on is worse
    // than one that stops mid-word.
    const { rerender } = render(<TutorStage speechUrl="/speech/one.mp3" />);
    rerender(<TutorStage speechUrl="/speech/two.mp3" />);
    expect(played).toBe(2);
  });

  it('stops speaking when the URL is cleared', () => {
    const { rerender } = render(<TutorStage speechUrl="/speech/one.mp3" />);
    rerender(<TutorStage speechUrl={null} />);
    expect(paused).toBeGreaterThan(0);
    expect(screen.getByTestId('scene').dataset.framing).toBe('vignette');
  });

  it('shuts the mouth when playback is blocked instead of miming over silence', async () => {
    // Autoplay before a user gesture is a NORMAL first-load state, not an
    // error — but a mouth left moving over silence is a visible lie.
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('gesture required'));
    render(<TutorStage speechUrl="/speech/hello.mp3" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('scene').dataset.viseme).toBe('0');
  });

  it('hands its readiness callback down to the scene', () => {
    /*
     * The conversational layer has no other way to know whether anyone is on
     * screen yet. Speech handed over while the assets are still resolving plays
     * audio at a blank canvas — the tutor talking to an empty island.
     */
    render(<TutorStage onReady={() => undefined} />);
    expect(screen.getByTestId('scene').dataset.hasready).toBe('true');
  });

  it('passes emotion and action straight through', () => {
    render(<TutorStage emotion="proud" action="wave" />);
    const scene = screen.getByTestId('scene');
    expect(scene.dataset.emotion).toBe('proud');
    expect(scene.dataset.action).toBe('wave');
  });
});
