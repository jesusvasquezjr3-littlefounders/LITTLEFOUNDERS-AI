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
        hasMore: false,
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
        hasMore: false,
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
        hasMore: false,
        safetyFlags: [],
      },
      error: null,
    });

    renderPage();

    await waitFor(() => screen.getByText(/6 messages/));
  });
});

/*
 * Found by adversarial review, round 54 (2026-08-30, MEDIUM): `closeReason`
 * reached this component on every session (`getKidTutorHistory`'s own
 * response, and `BASE_SESSION`'s own fixture already carries it) but was
 * never rendered anywhere — a session force-closed by an internal error, a
 * dropped-and-never-resumed connection, or a mid-session consent revocation
 * looked identical to an ordinary finished chat. Proven with 4 sessions
 * differing ONLY in `closeReason`, which produced byte-identical visible
 * text before this fix.
 */
describe('KidTutorPage — a session that did not end normally says so', () => {
  it('shows nothing extra for an ordinary completed session', async () => {
    vi.mocked(getKidTutorHistory).mockResolvedValue({
      data: {
        sessions: [{ ...BASE_SESSION, closeReason: 'completed', endedAt: '2026-08-30T10:05:00Z', turnCount: 6 }],
        hasMore: false,
        safetyFlags: [],
      },
      error: null,
    });

    renderPage();

    await waitFor(() => screen.getByText(/6 messages/));
    expect(screen.queryByText(/technical problem/i)).toBeNull();
  });

  it.each([
    ['error', /technical problem/i],
    ['consent_revoked', /microphone permission was turned off/i],
    ['learner_left', /left in the middle/i],
    ['abandoned', /connection dropped/i],
    ['soft_budget', /time limit/i],
    ['hard_budget', /time limit/i],
    ['safety_stop', /safety reason/i],
  ] as const)('shows a plain-language reason for closeReason "%s"', async (closeReason, expected) => {
    vi.mocked(getKidTutorHistory).mockResolvedValue({
      data: {
        sessions: [{ ...BASE_SESSION, closeReason, endedAt: '2026-08-30T10:05:00Z', turnCount: 6 }],
        hasMore: false,
        safetyFlags: [],
      },
      error: null,
    });

    renderPage();

    await waitFor(() => screen.getByText(expected));
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
            hasMore: false,
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
    resolveKidB!({ data: { sessions: [], hasMore: false, safetyFlags: [] }, error: null });

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
        hasMore: false,
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
          { id: 't1', seq: 2, speaker: 'tutor', text: 'How are you feeling today?', emotion: null, action: null, audio_path: null, source: 'model', created_at: '2026-08-20T09:00:00Z', whiteboard: null, demonstrate: null },
          { id: 't2', seq: 3, speaker: 'learner', text: 'the flagged words', emotion: null, action: null, audio_path: null, source: 'learner', created_at: '2026-08-20T09:00:01Z', whiteboard: null, demonstrate: null },
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

/*
 * Found by adversarial review, round 67 (2026-08-30, HIGH): `SessionTranscript
 * .segments` was fetched and typed and never once read anywhere in this file
 * — only `transcript.turns` was rendered. A guardian reading any session
 * transcript saw every word exchanged and NOTHING about the graded activities
 * served in between: no prompt, no score, no XP. `/ORACLE.md` §12 documents
 * segments as persisted precisely FOR this view.
 */
describe('KidTutorPage — a graded activity is part of the transcript, not invisible', () => {
  it('renders a segment’s prompt, score and XP, and never its answer key', async () => {
    vi.mocked(getKidTutorHistory).mockResolvedValue({
      data: {
        sessions: [{ ...BASE_SESSION }],
        hasMore: false,
        safetyFlags: [],
      },
      error: null,
    });
    vi.mocked(getTranscript).mockResolvedValue({
      data: {
        session: BASE_SESSION,
        turns: [
          { id: 't1', seq: 1, speaker: 'tutor', text: 'Let’s try one.', emotion: null, action: null, audio_path: null, source: 'model', created_at: '2026-08-30T10:00:00Z', whiteboard: null, demonstrate: null },
          { id: 't2', seq: 2, speaker: 'tutor', text: 'Nicely done.', emotion: null, action: null, audio_path: null, source: 'model', created_at: '2026-08-30T10:02:00Z', whiteboard: null, demonstrate: null },
        ],
        segments: [
          {
            segmentId: 'seg-1',
            seq: 1,
            origin: 'live',
            // `answer` should never reach the wire at all (/ORACLE.md §8,
            // migration 0047) — it is included here anyway, as if Core had
            // leaked it, so the test proves the RENDER path never surfaces
            // it even if the payload somehow carried it, not merely that the
            // type declares no such field.
            segment: { type: 'quiz_mcq', prompt_md: 'How much after 4 weeks?', answer: '100 pesos' },
            // Served and never answered — `score` is null, not zero.
            score: null,
            xpAwarded: 0,
            createdAt: '2026-08-30T10:01:00Z',
          },
        ],
      },
      error: null,
    });

    renderPage();
    await waitFor(() => screen.getByText(/2 messages/));

    fireEvent.click(screen.getByText('Read it'));

    // The prompt, the outcome and the XP all reach the screen now.
    await waitFor(() => screen.getByText('How much after 4 weeks?'));
    expect(screen.getByText(/didn.t answer this one/i)).toBeInTheDocument();

    // Never the answer key, even though this fixture's payload carries one.
    expect(screen.queryByText(/100 pesos/)).toBeNull();
  });

  it('shows a real score and XP for an answered activity', async () => {
    vi.mocked(getKidTutorHistory).mockResolvedValue({
      data: { sessions: [{ ...BASE_SESSION }], hasMore: false, safetyFlags: [] },
      error: null,
    });
    vi.mocked(getTranscript).mockResolvedValue({
      data: {
        session: BASE_SESSION,
        turns: [],
        segments: [
          {
            segmentId: 'seg-2',
            seq: 1,
            origin: 'catalog',
            segment: { type: 'number_input', prompt_md: 'How many coins?' },
            score: 100,
            xpAwarded: 20,
            createdAt: '2026-08-30T10:01:00Z',
          },
        ],
      },
      error: null,
    });

    renderPage();
    await waitFor(() => screen.getByText(/2 messages/));
    fireEvent.click(screen.getByText('Read it'));

    await waitFor(() => screen.getByText('How many coins?'));
    expect(screen.getByText(/scored 100 out of 100/i)).toBeInTheDocument();
    expect(screen.getByText(/20 XP/)).toBeInTheDocument();
  });
});

/*
 * Found by adversarial review sweep tutor-review-sweep-101
 * (guardian-dashboard-depth dimension), round 110 (2026-08-31, MEDIUM):
 * `getKidTutorHistory` always fetched exactly one, hardcoded page with no
 * "Load more" anywhere on this page — a guardian who accumulated more than
 * one page's worth of sessions since their last visit had NO way, from
 * here, to reach anything older. The server-side fix (`listTutorSessions`
 * pagination) is proven separately in `backend/src/__tests__/tutor.test.ts`
 * and `tutorData.test.ts`; this proves the CLIENT actually asks for the
 * next page and appends it rather than replacing what is already on screen.
 */
describe('KidTutorPage — paging past the first page of sessions', () => {
  const OLD_SESSION = { ...BASE_SESSION, id: 's31', startedAt: '2026-07-01T09:00:00Z' };

  it('shows "Load more" only while the server reports more, fetches the NEXT offset, and appends rather than replaces', async () => {
    vi.mocked(getKidTutorHistory).mockResolvedValueOnce({
      data: { sessions: [{ ...BASE_SESSION }], hasMore: true, safetyFlags: [] },
      error: null,
    });

    renderPage();

    await waitFor(() => screen.getByText(/2 messages/));
    const loadMore = await screen.findByText('Load older conversations');

    vi.mocked(getKidTutorHistory).mockResolvedValueOnce({
      data: { sessions: [OLD_SESSION], hasMore: false, safetyFlags: [] },
      error: null,
    });

    fireEvent.click(loadMore);

    // Asked for the NEXT page — offset is how many sessions are already on
    // screen — not the same first page again.
    await waitFor(() =>
      expect(getKidTutorHistory).toHaveBeenLastCalledWith('tok', 'kid-1', { offset: 1 }),
    );

    // Both sessions are now visible — the older one was APPENDED, not a
    // replacement of the first page — and the control disappears once the
    // server says there is nothing further.
    await waitFor(() => expect(screen.queryByText('Load older conversations')).toBeNull());
    expect(screen.getAllByText(/messages$/)).toHaveLength(2);
  });

  it('leaves the existing sessions on screen and offers a retry when the next page fails to load', async () => {
    vi.mocked(getKidTutorHistory).mockResolvedValueOnce({
      data: { sessions: [{ ...BASE_SESSION }], hasMore: true, safetyFlags: [] },
      error: null,
    });

    renderPage();
    await waitFor(() => screen.getByText(/2 messages/));
    const loadMore = await screen.findByText('Load older conversations');

    vi.mocked(getKidTutorHistory).mockResolvedValueOnce({
      data: null,
      error: { code: 'DATA_UNAVAILABLE', message: 'nope' },
    });

    fireEvent.click(loadMore);

    await waitFor(() => screen.getByText(/couldn.t load more conversations/i));
    // The first page's session is still right there — a failed page turn
    // must never blank out what was already successfully shown.
    expect(screen.getByText(/2 messages/)).toBeInTheDocument();
    // And the control is still there to retry, rather than stranding the
    // guardian on an incomplete list forever.
    expect(screen.getByText('Load older conversations')).toBeInTheDocument();
  });
});


/*
 * Confirmed HIGH finding from adversarial review sweep tutor-review-sweep-101
 * (guardian-dashboard-depth dimension): `beat.whiteboard` was computed by
 * `buildReplayScript` — the SAME function this file already trusts for the
 * activity beats above — and simply never read in the JSX. A parent could
 * read the tutor narrating a growth story with no board underneath it, while
 * the learner's own live and replay views (`ConversationView.tsx`,
 * `ReplayInWorld.tsx`) drew the exact same numbers with `TutorWhiteboard`.
 */
describe('KidTutorPage — a tutor turn that drew a whiteboard shows it to the parent too', () => {
  const WHITEBOARD_TURN = {
    id: 't-board',
    seq: 3,
    speaker: 'tutor' as const,
    text: 'Cada semana te dan 2 pesos más.',
    emotion: null,
    action: null,
    audio_path: null,
    source: 'model',
    created_at: '2026-08-31T10:00:00Z',
    whiteboard: {
      kind: 'sequence' as const,
      start: 10,
      steps: [{ op: 'add' as const, value: 2 }],
      unit: 'week' as const,
      values: [10, 12],
      label: 'Ahorros de Ana',
      currency: 'MXN' as const,
    },
    demonstrate: null,
  };

  it('renders the whiteboard beside the tutor line that drew it', async () => {
    vi.mocked(getKidTutorHistory).mockResolvedValue({
      data: { sessions: [{ ...BASE_SESSION }], safetyFlags: [], hasMore: false },
      error: null,
    });
    vi.mocked(getTranscript).mockResolvedValue({
      data: {
        session: BASE_SESSION,
        turns: [WHITEBOARD_TURN],
        segments: [],
      },
      error: null,
    });

    renderPage();
    await waitFor(() => screen.getByText(/2 messages/));

    fireEvent.click(screen.getByText('Read it'));

    await waitFor(() => screen.getByText('Cada semana te dan 2 pesos más.'));
    expect(document.querySelector('[data-tutor-whiteboard]')).not.toBeNull();
    expect(screen.getByText('Ahorros de Ana')).toBeInTheDocument();
  });

  it('renders no whiteboard well for a tutor turn that never drew one', async () => {
    vi.mocked(getKidTutorHistory).mockResolvedValue({
      data: { sessions: [{ ...BASE_SESSION }], safetyFlags: [], hasMore: false },
      error: null,
    });
    vi.mocked(getTranscript).mockResolvedValue({
      data: {
        session: BASE_SESSION,
        turns: [{ ...WHITEBOARD_TURN, id: 't-plain', seq: 4, whiteboard: null }],
        segments: [],
      },
      error: null,
    });

    renderPage();
    await waitFor(() => screen.getByText(/2 messages/));

    fireEvent.click(screen.getByText('Read it'));

    await waitFor(() => screen.getByText('Cada semana te dan 2 pesos más.'));
    expect(document.querySelector('[data-tutor-whiteboard]')).toBeNull();
  });
});
