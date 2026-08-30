import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { KidTutorPage } from '../KidTutorPage';
import { getKidTutorHistory, getTranscript } from '@/tutor/tutorApi';

/*
 * Found by adversarial review, 2026-08-30 (round 13, guardian visibility).
 * Three real gaps on the ONE page /AGENTS.md §1.9 exists to make an
 * invariant rather than a hope: `severity` was fetched and never rendered;
 * flags were shown in raw chronological order rather than severity-first,
 * so an old HIGH-severity flag could sit below a newer LOW one; and an
 * in-progress session always reported "0 messages" regardless of its real
 * transcript length, because `turn_count` is only written at close.
 */

vi.mock('@/tutor/tutorApi', () => ({
  getKidTutorHistory: vi.fn(),
  getTranscript: vi.fn(),
}));
/*
 * `getToken` must be the SAME function reference across renders, exactly as
 * the real `AuthContext` guarantees via `useCallback` — otherwise the fetch
 * effect's `[kidId, getToken]` dependency array looks "changed" on every
 * render even when `kidId` hasn't moved, and the effect re-fires forever
 * (each async resolution triggers a re-render, which creates a new mock
 * function, which re-triggers the effect...). A test that holds a fetch
 * pending across an assertion — as the kidId-switch test below does — turns
 * that into an unbounded microtask storm and OOMs the worker.
 */
const stableGetToken = vi.fn().mockResolvedValue('tok');
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: stableGetToken }) }));

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/family/kid-1/tutor']}>
      <Routes>
        <Route path="/family/:kidId/tutor" element={<KidTutorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const BASE_SESSION = {
  id: 's1',
  locale: 'es-MX',
  character: 'rho' as const,
  companion: null,
  diorama: 'diorama-a',
  intent: 'open' as const,
  startedAt: '2026-08-30T10:00:00Z',
  endedAt: '2026-08-30T10:05:00Z',
  closeReason: null,
  turnCount: 2,
  segmentCount: 0,
  xpAwarded: 0,
};

beforeEach(() => {
  vi.mocked(getKidTutorHistory).mockReset();
  vi.mocked(getTranscript).mockReset();
});

describe('KidTutorPage — safety flags are severity-first, not just chronological', () => {
  it('shows the newer LOW flag below the older HIGH one, with severity labelled on both', async () => {
    vi.mocked(getKidTutorHistory).mockResolvedValue({
      data: {
        sessions: [],
        safetyFlags: [
          {
            id: 'flag-low-newer',
            session_id: 's1',
            turn_seq: 4,
            category: 'model_output_blocked',
            severity: 'low',
            handled: 'turn_blocked',
            created_at: '2026-08-30T12:00:00Z',
          },
          {
            id: 'flag-high-older',
            session_id: 's0',
            turn_seq: 2,
            category: 'self_harm',
            severity: 'high',
            handled: 'session_stopped',
            created_at: '2026-08-29T09:00:00Z',
          },
        ],
      },
      error: null,
    });

    renderPage();

    const items = await waitFor(() => screen.getAllByRole('listitem'));
    // The older HIGH flag renders FIRST despite being chronologically second.
    expect(items[0]).toHaveTextContent('Your child said something about hurting themselves');
    expect(items[0]).toHaveTextContent('Urgent');
    expect(items[1]).toHaveTextContent('Low priority');
  });
});

describe('KidTutorPage — an in-progress session is not reported as 0 messages', () => {
  it('says the conversation is still going, not "0 messages"', async () => {
    vi.mocked(getKidTutorHistory).mockResolvedValue({
      data: {
        sessions: [{ ...BASE_SESSION, endedAt: null, turnCount: 0 }],
        safetyFlags: [],
      },
      error: null,
    });

    renderPage();

    await waitFor(() => screen.getByText(/Still talking with the tutor/));
    expect(screen.queryByText(/0 messages/)).toBeNull();
  });

  it('still reports the real count once the session has actually ended', async () => {
    vi.mocked(getKidTutorHistory).mockResolvedValue({
      data: {
        sessions: [{ ...BASE_SESSION, endedAt: '2026-08-30T10:05:00Z', turnCount: 6 }],
        safetyFlags: [],
      },
      error: null,
    });

    renderPage();

    await waitFor(() => screen.getByText(/6 messages/));
  });
});

/*
 * Found by adversarial review, round 31 (2026-08-30, MEDIUM): the route
 * `family/:kidId/tutor` (App.tsx) has no `key={kidId}`, so navigating from
 * one kid's page to another's does NOT remount `KidTutorPage` — it reuses
 * the same instance. Before the fix, `state` was only initialized once, at
 * mount, and the fetch effect never reset it back to `loading` when `kidId`
 * changed — so kid A's safety flags (self-harm, abuse) stayed on screen,
 * under a URL that already named kid B, for as long as kid B's fetch took
 * to resolve. Not reachable through today's shipped navigation (there is no
 * direct kid-to-kid link yet), but a real defect in the component itself.
 */
function NavigateOnClick({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      switch-kid
    </button>
  );
}

describe('KidTutorPage — switching kidId without a remount does not leak the previous kid', () => {
  it('drops the outgoing kid’s safety flags off screen before the new kid’s data arrives', async () => {
    let resolveKidB: ((value: Awaited<ReturnType<typeof getKidTutorHistory>>) => void) | null = null;
    vi.mocked(getKidTutorHistory).mockImplementation((_token, kidId) => {
      if (kidId === 'kid-a') {
        return Promise.resolve({
          data: {
            sessions: [],
            safetyFlags: [
              {
                id: 'flag-a',
                session_id: 's-a',
                turn_seq: 1,
                category: 'self_harm',
                severity: 'high' as const,
                handled: 'session_stopped' as const,
                created_at: '2026-08-29T00:00:00Z',
              },
            ],
          },
          error: null,
        });
      }
      return new Promise((resolve) => {
        resolveKidB = resolve;
      });
    });

    render(
      <MemoryRouter initialEntries={['/family/kid-a/tutor']}>
        <Routes>
          <Route
            path="/family/:kidId/tutor"
            element={
              <>
                <NavigateOnClick to="/family/kid-b/tutor" />
                <KidTutorPage />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByText(/hurting themselves/));

    fireEvent.click(screen.getByText('switch-kid'));

    // Kid B's fetch is still pending — the page must show loading, not kid A's flag.
    expect(screen.queryByText(/hurting themselves/)).toBeNull();
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    // The switch triggers `getToken()` first, so kid B's actual fetch call
    // (and its resolver) only exists a tick later — wait for it rather than
    // racing it, or this resolves a stale placeholder and hangs forever.
    await waitFor(() => expect(resolveKidB).not.toBeNull());
    resolveKidB!({ data: { sessions: [], safetyFlags: [] }, error: null });

    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
    expect(screen.queryByText(/hurting themselves/)).toBeNull();
  });
});

/*
 * Found by adversarial review, round 41 (2026-08-30, HIGH): a flag carried
 * `session_id`/`turn_seq` on the wire and this page never read either —
 * "the words are in the transcript, where they belong in context" (this
 * file's own header comment) was a promise with no control behind it. A
 * parent saw "Self-harm — Urgent" with no way to reach what was actually
 * said.
 */
describe('KidTutorPage — a safety flag opens the exact transcript it happened in', () => {
  it('reads a flag whose session is NOT among the recent sessions shown below', async () => {
    vi.mocked(getKidTutorHistory).mockResolvedValue({
      data: {
        // The flagged session is deliberately absent from `sessions` — an
        // older incident outside the capped "recent sessions" list, exactly
        // the orphaned-reference scenario the review proved is real.
        sessions: [],
        safetyFlags: [
          {
            id: 'flag-1',
            session_id: 'old-session',
            turn_seq: 3,
            category: 'self_harm',
            severity: 'high',
            handled: 'session_stopped',
            created_at: '2026-08-20T09:00:00Z',
          },
        ],
      },
      error: null,
    });
    vi.mocked(getTranscript).mockResolvedValue({
      data: {
        session: { ...BASE_SESSION, id: 'old-session' },
        turns: [
          { id: 't1', seq: 2, speaker: 'tutor', text: 'How are you feeling today?', emotion: null, action: null, audio_path: null, source: 'model', created_at: '2026-08-20T09:00:00Z', whiteboard: null },
          { id: 't2', seq: 3, speaker: 'learner', text: 'the flagged words', emotion: null, action: null, audio_path: null, source: 'learner', created_at: '2026-08-20T09:00:01Z', whiteboard: null },
        ],
        segments: [],
      },
      error: null,
    });

    renderPage();
    await waitFor(() => screen.getByText(/hurting themselves/));

    fireEvent.click(screen.getByText('Read it'));

    await waitFor(() => screen.getByText('the flagged words'));
    expect(getTranscript).toHaveBeenCalledWith('tok', 'old-session');
    expect(screen.getByText('How are you feeling today?')).toBeInTheDocument();

    // The exact turn `turn_seq` names is visibly distinguished — not merely
    // present somewhere in a wall of text a parent has to search themselves.
    expect(screen.getByText('the flagged words').className).toContain('ring-warning');
    expect(screen.getByText('How are you feeling today?').className).not.toContain('ring-warning');
  });
});
