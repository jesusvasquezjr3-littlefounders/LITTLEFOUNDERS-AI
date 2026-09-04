import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReplayInWorld } from '../ReplayInWorld';
import { buildReplayScript, type ReplayScript } from '../replayScript';
import type { ReplayDirector } from '../useReplayDirector';
import type { SessionSummary, SessionTranscript, TranscriptTurn } from '../../types';

/*
 * The replay's layer, tested at the places a mistake is a LEARNER's problem.
 *
 * The composition is verified by looking at it — 375 and 1280, light and dark,
 * four moments of the performance — because that is the only thing that has
 * ever caught a defect on this route. What runs here is everything that must
 * hold with no camera at all:
 *
 *   1. THE HONESTY. A replay is a recording and the interface has to say so.
 *      There are four statements and three of them are structural (the absent
 *      microphone, the transport standing in its place, the chip that offers
 *      the live conversation instead); this asserts the two that are TEXT, and
 *      that the one on the sheet's resting row exists at all — on a phone the
 *      plate's body is not mounted, so it is the only sentence a screen reader
 *      ever gets.
 *   2. THE LEARNER IS IN THE STORY. Their own turns are half the conversation,
 *      they have no body on the island, and if the dock does not carry them
 *      they are simply missing from their own memory.
 *   3. RANDOM ACCESS. Every line in the log is a button that plays from there.
 *      That is the whole navigation of the phase for a long conversation, and a
 *      row that renders without an accessible name of its own is eighteen
 *      identical controls to anybody navigating by name.
 *
 * The stage's own `ready` is false throughout, which is the no-WebGL
 * arrangement /ORACLE.md §12 requires: with no projector the caption is an
 * unanchored plate rather than a node nothing will ever position.
 */

const SESSION: SessionSummary = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  locale: 'en-US',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  intent: 'weak_skill',
  startedAt: '2026-08-14T16:20:00.000Z',
  endedAt: '2026-08-14T16:38:00.000Z',
  closeReason: 'completed',
  turnCount: 3,
  segmentCount: 1,
  xpAwarded: 20,
};

function turn(over: Pick<TranscriptTurn, 'id' | 'seq' | 'speaker' | 'text'> & Partial<TranscriptTurn>): TranscriptTurn {
  return {
    emotion: null,
    action: null,
    audio_path: null,
    source: 'model',
    created_at: `2026-08-14T16:2${over.seq}:00.000Z`,
    whiteboard: null,
    demonstrate: null,
    roleplay_scene: null,
    ...over,
  };
}

const TRANSCRIPT: SessionTranscript = {
  session: SESSION,
  turns: [
    turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'What shall we work on?' }),
    turn({ id: 't2', seq: 2, speaker: 'learner', text: 'saving for a bike' }),
    turn({ id: 't3', seq: 3, speaker: 'tutor', text: 'How much does it cost?' }),
  ],
  segments: [
    {
      segmentId: 'b1d5f8a2-6c14-4f0e-9a3b-0d2e5c7f4a18',
      seq: 0,
      origin: 'live',
      segment: { prompt_md: 'Save $5 a week. How much after 4 weeks?' },
      score: 100,
      xpAwarded: 20,
      createdAt: '2026-08-14T16:24:00.000Z',
    },
  ],
};

/**
 * A director frozen on one beat.
 *
 * The real hook is tested against a controlled clock next door; what this file
 * asks about is what the LAYER draws for a given state, so the state is
 * supplied rather than played into existence.
 */
function directorAt(script: ReplayScript, index: number, over: Partial<ReplayDirector> = {}): ReplayDirector {
  return {
    script,
    index,
    beat: script.beats[index] ?? null,
    playing: false,
    finished: false,
    progress: (index + 1) / script.beats.length,
    speechUrl: null,
    beatKey: index + 1,
    play: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    jumpTo: vi.fn(),
    restart: vi.fn(),
    handleSpeechEnd: vi.fn(),
    ...over,
  };
}

function renderReplay(director: ReplayDirector | null, over: { loading?: boolean; error?: string | null } = {}) {
  return render(
    <ReplayInWorld
      phase="replaying"
      ready={false}
      timedOut={false}
      director={director}
      loading={over.loading ?? false}
      error={over.error ?? null}
      onDone={vi.fn()}
    />,
  );
}

beforeEach(() => {
  // jsdom ships no media pipeline and `LessonPlate` measures itself on mount.
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReplayInWorld', () => {
  const script = buildReplayScript(TRANSCRIPT);

  it('says in words that this already happened, and offers the live thing instead', () => {
    renderReplay(directorAt(script, 0));

    // The sentence, on the one reading surface of the phase.
    expect(screen.getAllByText(/recording of your conversation/i).length).toBeGreaterThan(0);
    // The way out is an OFFER, never a refusal. Nothing on this phase says
    // "you can't" — the thing you cannot do here is offered as the way out.
    expect(screen.getByRole('button', { name: /Talk to Dr\. Rho/ })).toBeInTheDocument();
    expect(screen.queryByText(/can.t talk/i)).toBeNull();
  });

  it('carries the learner’s own turns, and says whose they are', () => {
    renderReplay(directorAt(script, 1));
    expect(screen.getByText('You said')).toBeInTheDocument();
    expect(screen.getAllByText('saving for a bike').length).toBeGreaterThan(0);
  });

  it('replays an activity as its question and its outcome, and never as an exercise', () => {
    const activity = script.beats.findIndex((beat) => beat.kind === 'activity');
    renderReplay(directorAt(script, activity));

    expect(screen.getAllByText(/You scored 100 out of 100/).length).toBeGreaterThan(0);
    /*
     * NOTHING TO ANSWER. A replayed exercise a learner can answer again is a
     * second attempt at a graded segment posted to a route that pays XP. The
     * only buttons on this phase are the transport, the transcript rows and the
     * way out — never a "Check" and never an option to pick.
     */
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
  });

  /*
   * Found by adversarial review, round 35 (2026-08-30, HIGH): a tutor turn
   * that drew a V4 whiteboard live had no path into replay at all — the
   * board simply never rendered, silently, even once the transcript row
   * itself started carrying it (migration 0058).
   */
  it('draws the stored whiteboard on the tutor beat that recorded one', () => {
    const boarded: SessionTranscript = {
      session: SESSION,
      turns: [
        turn({
          id: 'tb1',
          seq: 1,
          speaker: 'tutor',
          text: 'Imaginemos que guardas 10 pesos.',
          whiteboard: {
            kind: 'sequence',
            start: 10,
            steps: [{ op: 'add', value: 2 }],
            unit: 'day',
            values: [10, 12],
            label: 'Cada día te dan 2 más',
            currency: 'MXN',
          },
        }),
      ],
      segments: [],
    };
    const boardScript = buildReplayScript(boarded);
    renderReplay(directorAt(boardScript, 0));

    expect(screen.getByText('Cada día te dan 2 más')).toBeInTheDocument();
  });

  it('draws no board for a beat that never recorded one', () => {
    renderReplay(directorAt(script, 0));
    expect(document.querySelector('[data-tutor-whiteboard]')).toBeNull();
  });

  /*
   * Found while investigating ORACLE.md §19.5's "replaying `demonstrate`
   * animations" backlog item, 2026-09-01 — the identical gap round 35 found
   * for the whiteboard above, on the tutor's OTHER v3 visual field: a tutor
   * turn that demonstrated on the money tray live had no path into replay
   * at all, silently, even once the transcript row started carrying it
   * (migration 0067).
   */
  it('summarizes the stored demonstration steps on the tutor beat that recorded them', () => {
    const demoed: SessionTranscript = {
      session: SESSION,
      turns: [
        turn({
          id: 'td1',
          seq: 1,
          speaker: 'tutor',
          text: 'Mira, si agrego esta moneda de 10 y esta de 5…',
          demonstrate: [
            { kind: 'add', denomination: 10 },
            { kind: 'add', denomination: 5 },
          ],
        }),
      ],
      segments: [],
    };
    const demoScript = buildReplayScript(demoed);
    renderReplay(directorAt(demoScript, 0));

    expect(screen.getByText(/\+10/)).toBeInTheDocument();
    expect(screen.getByText(/\+5/)).toBeInTheDocument();
  });

  it('draws no demonstration summary for a beat that never recorded one', () => {
    renderReplay(directorAt(script, 0));
    expect(screen.queryByText(/The tutor showed/i)).toBeNull();
  });

  it('gives every transport control a name, and the play button the name of what it does', () => {
    const { rerender } = renderReplay(directorAt(script, 0));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous line' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next line' })).toBeInTheDocument();

    // An icon-only control whose name says "play" while it shows a pause glyph
    // is the accessibility bug that is also a usability bug for everybody.
    rerender(
      <ReplayInWorld
        phase="replaying"
        ready={false}
        timedOut={false}
        director={directorAt(script, 0, { playing: true })}
        loading={false}
        error={null}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  /*
   * THE LOG LIVES INSIDE THE LESSON PLATE, and on a phone that plate rests at
   * PEEK with its body not mounted at all — /DESIGN.md's "nothing may raise the
   * sheet except the learner", which binds here exactly as it does in a live
   * session. So the transcript is opened the way a learner opens it, by the one
   * control that moves the sheet. The transport's own arrows are what a phone
   * navigates by, and they are on screen at every detent.
   */
  function openThePlate() {
    fireEvent.click(screen.getByRole('button', { name: /Resize this panel/ }));
  }

  it('makes every line of the conversation a way back into it', () => {
    const director = directorAt(script, 0);
    renderReplay(director);
    openThePlate();

    /*
     * The whole sentence is in the accessible name after the action, because
     * "Play from here" on eighteen adjacent rows is eighteen identical controls
     * to anybody navigating by name. This is also the phase's only random
     * access: a scrubber for eighteen beats gives each one 19 px.
     */
    const row = screen.getByRole('button', { name: /Play from here: You\. saving for a bike/ });
    fireEvent.click(row);
    expect(director.jumpTo).toHaveBeenCalledWith(1);
  });

  it('marks where the performance currently is', () => {
    renderReplay(directorAt(script, 2));
    expect(screen.getByText('Line 3 of 4')).toBeInTheDocument();

    openThePlate();
    const current = screen.getByRole('button', { current: true });
    expect(current).toHaveAttribute('aria-label', expect.stringContaining('How much does it cost?'));
  });

  it('states a soundless recording once, as a fact about the recording', () => {
    // Every clip in this transcript is gone, which is what every conversation
    // looks like after the 90-day sweep. It is said once, not per line.
    renderReplay(directorAt(script, 0));
    expect(screen.getAllByText(/saved without sound/i).length).toBe(1);
    expect(screen.queryByText(/sound for this line/i)).toBeNull();
  });

  it('does not mount a transport for a conversation that has no lines', () => {
    const empty = buildReplayScript({ session: SESSION, turns: [], segments: [] });
    renderReplay(directorAt(empty, 0));
    expect(screen.getByText(/Nothing was saved/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('tells the three not-yet-a-performance states apart', () => {
    const loading = renderReplay(null, { loading: true });
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    loading.unmount();

    renderReplay(null, { error: 'DATA_UNAVAILABLE' });
    expect(screen.getByText(/couldn.t load that conversation/i)).toBeInTheDocument();
  });
});
