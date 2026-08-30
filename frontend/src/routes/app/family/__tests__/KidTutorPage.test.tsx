import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { KidTutorPage } from '../KidTutorPage';
import { getKidTutorHistory } from '@/tutor/tutorApi';

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
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: vi.fn().mockResolvedValue('tok') }) }));

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
  closeReason: null,
  segmentCount: 0,
  xpAwarded: 0,
};

beforeEach(() => {
  vi.mocked(getKidTutorHistory).mockReset();
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
