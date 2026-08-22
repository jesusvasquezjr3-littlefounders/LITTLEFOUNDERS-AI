import { Profiler } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MicOrb } from '../MicOrb';
import type { MicOrbState } from '../MicOrb';
import type { MicLevelListener, Microphone } from '../../useMicrophone';

/*
 * The orb exists because of one sentence in the rejection: the microphone was
 * nowhere to be seen. It was rendered behind `{socket.microphone && (...)}`,
 * so it vanished in exactly the configuration everyone has actually run.
 *
 * So the tests here are about PRESENCE and HONESTY first — it is in the DOM in
 * all five states, and when it cannot be used it says why in a translated line
 * — and about the level meter costing nothing second.
 */

/** A microphone whose level channel the test drives by hand. */
function makeMicrophone(overrides: Partial<Microphone> = {}): Microphone & {
  emit: (level: number, fraction?: number) => void;
} {
  const listeners = new Set<MicLevelListener>();
  const levelRef = { current: 0 };
  const holdBytesRef = { current: 0 };
  const holdMsRef = { current: 0 };
  const holdFractionRef = { current: 0 };

  return {
    permission: 'granted',
    recording: false,
    levelRef,
    holdBytesRef,
    holdMsRef,
    holdFractionRef,
    subscribe: (listener: MicLevelListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => null),
    release: vi.fn(),
    ...overrides,
    emit(level: number, fraction = 0) {
      levelRef.current = level;
      holdFractionRef.current = fraction;
      for (const listener of listeners) listener(level);
    },
  };
}

const ALL_STATES: MicOrbState[] = ['unavailable', 'idle', 'listening', 'thinking', 'speaking'];

/**
 * The orb plays a cue on press and on release. jsdom has no media stack, so a
 * real `Audio` would print "Not implemented" through the virtual console on
 * every hold — noise that trains everyone to stop reading test output.
 */
class SilentAudio {
  volume = 1;
  currentTime = 0;
  loop = false;
  preload = '';
  paused = true;

  constructor(public src: string) {}

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

beforeEach(() => {
  vi.stubGlobal('Audio', SilentAudio);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-21T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Presence ────────────────────────────────────────────────────────────────

describe('MicOrb presence', () => {
  it.each(ALL_STATES)('is in the DOM with an accessible name in state "%s"', (state) => {
    render(
      <MicOrb
        state={state}
        microphone={makeMicrophone()}
        blockedReason="VOICE_UNAVAILABLE"
        onClip={vi.fn()}
      />,
    );

    const orb = screen.getByRole('button');
    expect(orb).toBeInTheDocument();
    expect(orb.getAttribute('aria-label')?.trim()).toBeTruthy();
  });

  it('is the largest control on screen at both breakpoints', () => {
    render(<MicOrb state="idle" microphone={makeMicrophone()} onClip={vi.fn()} />);
    const orb = screen.getByRole('button');
    // 96px at 375px, 112px from the lg breakpoint up. Written as tokens so a
    // future restyle cannot quietly shrink the one control that must not shrink.
    expect(orb.className).toContain('h-24');
    expect(orb.className).toContain('w-24');
    expect(orb.className).toContain('lg:h-28');
    expect(orb.className).toContain('lg:w-28');
  });

  it('stays pressable while the tutor is speaking, so a learner can jump in', () => {
    const microphone = makeMicrophone();
    render(<MicOrb state="speaking" microphone={microphone} onClip={vi.fn()} />);

    const orb = screen.getByRole('button');
    expect(orb).not.toHaveAttribute('aria-disabled');
    fireEvent.pointerDown(orb, { pointerId: 1 });
    expect(microphone.start).toHaveBeenCalled();
  });

  /*
   * `idleCopy` exists for exactly one screen: the introduction, where no socket
   * has been opened yet, so the press cannot record and instead CREATES the
   * conversation. "Hold to talk" there asks a child to hold a button with
   * nothing behind it.
   *
   * The name and the printed line are asserted TOGETHER on purpose. They are
   * one string precisely so they cannot drift, and a control whose spoken name
   * disagrees with its visible label is worse than either wording alone.
   */
  it('lets one screen override the resting wording, name and line together', () => {
    render(
      <MicOrb
        state="idle"
        microphone={makeMicrophone()}
        onClip={vi.fn()}
        idleCopy="Start talking with your tutor"
      />,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Start talking with your tutor');
    expect(screen.getByText('Start talking with your tutor')).toBeInTheDocument();
    expect(screen.queryByText(/hold to talk/i)).not.toBeInTheDocument();
  });

  it('says "hold to talk" everywhere else, because everywhere else that is true', () => {
    render(<MicOrb state="idle" microphone={makeMicrophone()} onClip={vi.fn()} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/hold to talk/i);
  });
});

// ── Honesty ─────────────────────────────────────────────────────────────────

describe('MicOrb when the microphone is blocked', () => {
  const REASONS = [
    // These three are already computed by Core and already translated; the orb
    // renders them rather than inventing a fourth, vaguer sentence.
    ['POLICY_BLOCKED', 'tutor.offers.voicePolicyBlocked'],
    ['CONSENT_REQUIRED', 'tutor.offers.voiceNeedsConsent'],
    ['VOICE_UNAVAILABLE', 'tutor.offers.voiceUnavailable'],
  ] as const;

  it.each(REASONS)('says why for %s, in one translated line', (reason) => {
    render(
      <MicOrb state="unavailable" microphone={makeMicrophone()} blockedReason={reason} onClip={vi.fn()} />,
    );

    const orb = screen.getByRole('button');
    expect(orb).toHaveAttribute('aria-disabled', 'true');

    const line = screen.getByRole('status').textContent?.trim() ?? '';
    expect(line.length).toBeGreaterThan(0);
    // A translated sentence, not a raw i18n key leaking to a child.
    expect(line).not.toContain('tutor.offers.');
  });

  /*
   * A PHASE IS A NARROWER TRUTH THAN A POLICY, so it wins.
   *
   * The orb belongs to the stage now and is therefore on screen during arrival,
   * personalization and the goodbye — phases where there is no socket, so
   * nothing could be recorded even with every permission granted. Falling back
   * to `VOICE_UNAVAILABLE` there would tell a child that no voice provider is
   * configured, which is not what happened and is exactly the kind of confident
   * wrong sentence they have no way to check.
   */
  it('prefers a phase’s own reason over one of Core’s three', () => {
    render(
      <MicOrb
        state="unavailable"
        microphone={makeMicrophone()}
        blockedReason="VOICE_UNAVAILABLE"
        blockedCopy="We can talk once the conversation starts."
        onClip={vi.fn()}
      />,
    );
    const line = screen.getByRole('status').textContent?.trim() ?? '';
    expect(line).toBe('We can talk once the conversation starts.');
  });

  it('still falls back to Core’s reason when the phase has nothing to add', () => {
    render(
      <MicOrb
        state="unavailable"
        microphone={makeMicrophone()}
        blockedReason="CONSENT_REQUIRED"
        blockedCopy={null}
        onClip={vi.fn()}
      />,
    );
    const line = screen.getByRole('status').textContent?.trim() ?? '';
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toContain('tutor.offers.');
  });

  it('gives each reason its OWN sentence, not one shared apology', () => {
    const lines = REASONS.map(([reason]) => {
      const view = render(
        <MicOrb
          state="unavailable"
          microphone={makeMicrophone()}
          blockedReason={reason}
          onClip={vi.fn()}
        />,
      );
      const text = screen.getByRole('status').textContent ?? '';
      view.unmount();
      return text;
    });

    expect(new Set(lines).size).toBe(REASONS.length);
  });

  it('stays focusable while blocked, so a screen reader can find it and hear why', () => {
    render(
      <MicOrb
        state="unavailable"
        microphone={makeMicrophone()}
        blockedReason="CONSENT_REQUIRED"
        onClip={vi.fn()}
      />,
    );
    // aria-disabled, never the `disabled` attribute: a disabled button is
    // skipped by the tab order, which is how the reason becomes unreachable.
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('records nothing when it is pressed anyway', () => {
    const microphone = makeMicrophone();
    render(
      <MicOrb
        state="unavailable"
        microphone={microphone}
        blockedReason="POLICY_BLOCKED"
        onClip={vi.fn()}
      />,
    );

    fireEvent.pointerDown(screen.getByRole('button'), { pointerId: 1 });
    fireEvent.keyDown(screen.getByRole('button'), { code: 'Space' });
    expect(microphone.start).not.toHaveBeenCalled();
  });
});

// ── The meter costs nothing ─────────────────────────────────────────────────

describe('MicOrb level meter', () => {
  it('takes sixty level updates without re-rendering', () => {
    const microphone = makeMicrophone({ recording: true });
    let commits = 0;

    const { container } = render(
      <Profiler id="orb" onRender={() => (commits += 1)}>
        <MicOrb state="listening" microphone={microphone} onClip={vi.fn()} />
      </Profiler>,
    );

    const levelRing = container.querySelector('circle[stroke-width="5"]');
    expect(levelRing).not.toBeNull();

    const commitsBefore = commits;
    const offsets = new Set<string>();

    act(() => {
      for (let i = 0; i < 60; i += 1) {
        microphone.emit((i % 20) / 20, i / 60);
        offsets.add(levelRing?.getAttribute('stroke-dashoffset') ?? '');
      }
    });

    // The updates genuinely landed — otherwise "no re-render" would be true of
    // a meter that had simply stopped working.
    expect(offsets.size).toBeGreaterThan(1);
    expect(commits).toBe(commitsBefore);
  });

  it('fills the outer ring on the BYTE fraction, so what fills is what limits', () => {
    const microphone = makeMicrophone({ recording: true });
    const { container } = render(
      <MicOrb state="listening" microphone={microphone} onClip={vi.fn()} />,
    );

    const capRing = container.querySelector('circle[stroke-width="2"][stroke-linecap="round"]');
    const circumference = Number(capRing?.getAttribute('stroke-dasharray'));

    act(() => microphone.emit(0, 0.5));

    expect(Number(capRing?.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.5, 3);
  });
});

// ── Holding it ──────────────────────────────────────────────────────────────

describe('MicOrb hold', () => {
  it('starts on pointer down and sends the clip on pointer up', async () => {
    const clip = new Blob(['audio']);
    const onClip = vi.fn();
    const idle = makeMicrophone();
    const view = render(<MicOrb state="idle" microphone={idle} onClip={onClip} />);

    fireEvent.pointerDown(screen.getByRole('button'), { pointerId: 1 });
    expect(idle.start).toHaveBeenCalledTimes(1);

    const live = makeMicrophone({ recording: true, stop: vi.fn(async () => clip) });
    view.rerender(<MicOrb state="listening" microphone={live} onClip={onClip} />);

    await act(async () => {
      fireEvent.pointerUp(screen.getByRole('button'), { pointerId: 1 });
    });

    expect(live.stop).toHaveBeenCalledTimes(1);
    expect(onClip).toHaveBeenCalledWith(clip);
  });

  it('ends the hold when the pointer is cancelled, so the mic never stays open', async () => {
    const live = makeMicrophone({ recording: true });
    render(<MicOrb state="listening" microphone={live} onClip={vi.fn()} />);

    await act(async () => {
      fireEvent.pointerCancel(screen.getByRole('button'), { pointerId: 1 });
    });

    expect(live.stop).toHaveBeenCalledTimes(1);
  });

  it('stops local playback before recording over the tutor', () => {
    const onInterrupt = vi.fn();
    render(
      <MicOrb
        state="speaking"
        microphone={makeMicrophone()}
        onClip={vi.fn()}
        onInterrupt={onInterrupt}
      />,
    );

    fireEvent.pointerDown(screen.getByRole('button'), { pointerId: 1 });
    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });
});

describe('MicOrb keyboard', () => {
  it('holds to talk on the space bar and releases on key up', async () => {
    const onClip = vi.fn();
    const idle = makeMicrophone();
    const view = render(<MicOrb state="idle" microphone={idle} onClip={onClip} />);

    fireEvent.keyDown(screen.getByRole('button'), { code: 'Space' });
    expect(idle.start).toHaveBeenCalledTimes(1);

    const live = makeMicrophone({ recording: true });
    view.rerender(<MicOrb state="listening" microphone={live} onClip={onClip} />);

    // A real hold: long enough that letting go clearly means "I have finished".
    vi.setSystemTime(new Date(Date.now() + 1_200));
    await act(async () => {
      fireEvent.keyUp(screen.getByRole('button'), { code: 'Space' });
    });

    expect(live.stop).toHaveBeenCalledTimes(1);
  });

  it('LATCHES on a quick tap, so the control does not require holding a key', async () => {
    const idle = makeMicrophone();
    const view = render(<MicOrb state="idle" microphone={idle} onClip={vi.fn()} />);

    fireEvent.keyDown(screen.getByRole('button'), { code: 'Space' });

    const live = makeMicrophone({ recording: true });
    view.rerender(<MicOrb state="listening" microphone={live} onClip={vi.fn()} />);

    // Released almost immediately. Hold-to-talk is unusable with switch access
    // or sticky keys, so a tap latches the hold open instead of ending it.
    vi.setSystemTime(new Date(Date.now() + 40));
    await act(async () => {
      fireEvent.keyUp(screen.getByRole('button'), { code: 'Space' });
    });
    expect(live.stop).not.toHaveBeenCalled();

    // The next press is what ends it.
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('button'), { code: 'Space' });
    });
    expect(live.stop).toHaveBeenCalledTimes(1);
  });

  it('ignores auto-repeat while a key is held down', () => {
    const idle = makeMicrophone();
    render(<MicOrb state="idle" microphone={idle} onClip={vi.fn()} />);

    const orb = screen.getByRole('button');
    fireEvent.keyDown(orb, { code: 'Space' });
    fireEvent.keyDown(orb, { code: 'Space', repeat: true });
    fireEvent.keyDown(orb, { code: 'Space', repeat: true });

    expect(idle.start).toHaveBeenCalledTimes(1);
  });

  it('closes a latched hold when focus leaves the orb', async () => {
    const live = makeMicrophone({ recording: true });
    render(<MicOrb state="listening" microphone={live} onClip={vi.fn()} />);

    await act(async () => {
      fireEvent.blur(screen.getByRole('button'));
    });

    // An open microphone with no visible owner is the exact thing push-to-talk
    // exists to prevent.
    expect(live.stop).toHaveBeenCalledTimes(1);
  });

  it('describes how the keyboard works, for people who cannot use the pointer path', () => {
    render(<MicOrb state="idle" microphone={makeMicrophone()} onClip={vi.fn()} />);
    const described = screen.getByRole('button').getAttribute('aria-describedby');
    expect(described?.split(' ').length).toBe(2);
  });
});
