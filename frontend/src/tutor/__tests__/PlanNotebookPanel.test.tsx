import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanNotebookPanel } from '../PlanNotebookPanel';
import { getKidNotebook, getKidPlan, getNotebook, getPlan, getTranscript, listSessions } from '../tutorApi';

/*
 * Class V (/TUTOR_INSTRUMENTS.md §3.6, migration 0069), SHARED between the
 * two audiences the catalog names: a `kidUserId` is the guardian's view of a
 * specific child; its absence is the learner's own view of themselves,
 * which is also the only one that computes `recap` (see the component's own
 * header for why).
 */

vi.mock('../tutorApi', () => ({
  getKidPlan: vi.fn(),
  getKidNotebook: vi.fn(),
  getPlan: vi.fn(),
  getNotebook: vi.fn(),
  listSessions: vi.fn(),
  getTranscript: vi.fn(),
}));

const PLAN_BOARD = {
  kind: 'sequence' as const,
  start: 10,
  steps: [{ op: 'add' as const, value: 5 }],
  unit: 'week' as const,
  values: [10, 15],
  label: 'Meta de ahorro',
  currency: 'MXN' as const,
};

const NOTEBOOK_BOARD = {
  kind: 'sequence' as const,
  start: 0,
  steps: [{ op: 'add' as const, value: 2 }],
  unit: 'week' as const,
  values: [0, 2],
  label: 'Ahorro semanal',
  currency: null,
};

beforeEach(() => {
  vi.mocked(getKidPlan).mockReset();
  vi.mocked(getKidNotebook).mockReset();
  vi.mocked(getPlan).mockReset().mockResolvedValue({ data: { plan: null }, error: null });
  vi.mocked(getNotebook).mockReset().mockResolvedValue({ data: { entries: [] }, error: null });
  vi.mocked(listSessions).mockReset().mockResolvedValue({ data: { sessions: [] }, error: null });
  vi.mocked(getTranscript).mockReset();
});

describe('PlanNotebookPanel — guardian view (kidUserId set)', () => {
  it("calls the KID endpoints, never the caller's own, and never fetches a recap", async () => {
    vi.mocked(getKidPlan).mockResolvedValue({ data: { plan: null }, error: null });
    vi.mocked(getKidNotebook).mockResolvedValue({ data: { entries: [] }, error: null });
    render(<PlanNotebookPanel kidUserId="kid-1" token="tok" />);

    await waitFor(() => expect(getKidPlan).toHaveBeenCalledWith('tok', 'kid-1'));
    expect(getPlan).not.toHaveBeenCalled();
    expect(listSessions).not.toHaveBeenCalled();
  });

  it('shows the plan board when one exists', async () => {
    vi.mocked(getKidPlan).mockResolvedValue({
      data: { plan: { content: PLAN_BOARD, sessionId: 's1', updatedAt: '2026-09-03T10:00:00Z' } },
      error: null,
    });
    vi.mocked(getKidNotebook).mockResolvedValue({ data: { entries: [] }, error: null });
    render(<PlanNotebookPanel kidUserId="kid-1" token="tok" />);

    expect(await screen.findByText('Meta de ahorro')).toBeInTheDocument();
  });

  it('renders nothing at all when there is neither a plan nor a kept board', async () => {
    vi.mocked(getKidPlan).mockResolvedValue({ data: { plan: null }, error: null });
    vi.mocked(getKidNotebook).mockResolvedValue({ data: { entries: [] }, error: null });
    const { container } = render(<PlanNotebookPanel kidUserId="kid-1" token="tok" />);

    await waitFor(() => expect(getKidPlan).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('says the load failed rather than rendering nothing, on a real error', async () => {
    vi.mocked(getKidPlan).mockResolvedValue({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'x' } });
    vi.mocked(getKidNotebook).mockResolvedValue({ data: { entries: [] }, error: null });
    render(<PlanNotebookPanel kidUserId="kid-1" token="tok" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load/i);
  });
});

describe('PlanNotebookPanel — the learner’s own view (no kidUserId)', () => {
  it("calls the caller's OWN endpoints, never the kid ones", async () => {
    render(<PlanNotebookPanel token="tok" />);

    await waitFor(() => expect(getPlan).toHaveBeenCalledWith('tok'));
    expect(getKidPlan).not.toHaveBeenCalled();
    expect(getKidNotebook).not.toHaveBeenCalled();
  });

  it("shows a recap of the learner's most recently ENDED session, with its LAST board — not necessarily its last turn", async () => {
    vi.mocked(listSessions).mockResolvedValue({
      data: { sessions: [{ id: 's1', startedAt: '2026-09-03T10:00:00Z', endedAt: '2026-09-03T10:12:00Z', xpAwarded: 40 } as never] },
      error: null,
    });
    vi.mocked(getTranscript).mockResolvedValue({
      data: {
        session: { id: 's1' } as never,
        segments: [],
        turns: [
          { id: 't1', seq: 1, speaker: 'tutor', text: 'a', whiteboard: NOTEBOOK_BOARD } as never,
          { id: 't2', seq: 2, speaker: 'learner', text: 'b', whiteboard: null } as never,
          { id: 't3', seq: 3, speaker: 'tutor', text: 'c', whiteboard: null } as never,
        ],
      },
      error: null,
    });
    render(<PlanNotebookPanel token="tok" />);

    expect(await screen.findByText('Ahorro semanal')).toBeInTheDocument();
    expect(screen.getByText(/12 min/)).toBeInTheDocument();
    expect(screen.getByText(/40 XP/)).toBeInTheDocument();
  });

  it('shows no recap for a session still in progress (no endedAt) — nothing to summarize yet', async () => {
    vi.mocked(listSessions).mockResolvedValue({
      data: { sessions: [{ id: 's1', startedAt: '2026-09-03T10:00:00Z', endedAt: null, xpAwarded: 0 } as never] },
      error: null,
    });
    const { container } = render(<PlanNotebookPanel token="tok" />);

    await waitFor(() => expect(listSessions).toHaveBeenCalled());
    expect(getTranscript).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('a failed transcript read leaves recap absent rather than failing the whole panel', async () => {
    vi.mocked(getPlan).mockResolvedValue({
      data: { plan: { content: PLAN_BOARD, sessionId: 's1', updatedAt: '2026-09-03T10:00:00Z' } },
      error: null,
    });
    vi.mocked(listSessions).mockResolvedValue({
      data: { sessions: [{ id: 's1', startedAt: '2026-09-03T10:00:00Z', endedAt: '2026-09-03T10:12:00Z', xpAwarded: 40 } as never] },
      error: null,
    });
    vi.mocked(getTranscript).mockResolvedValue({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'x' } });
    render(<PlanNotebookPanel token="tok" />);

    // The plan still renders; the recap section (minutes/XP line) does not.
    expect(await screen.findByText('Meta de ahorro')).toBeInTheDocument();
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
  });

  it('renders nothing at all when there is no plan, no kept board and no ended session', async () => {
    const { container } = render(<PlanNotebookPanel token="tok" />);

    await waitFor(() => expect(getPlan).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  /*
   * Regression: the wrapping element used to be defined AS A COMPONENT
   * inside `PlanNotebookPanel`'s own render body — a fresh function identity
   * every render, which React treats as a different component type at that
   * position and therefore unmounts and remounts everything below it. Every
   * `TutorWhiteboard` in this panel plays a mount-time reveal sound and
   * re-runs its own bar-growth animation from a `useState` initializer, so a
   * remount on every unrelated re-render (this panel's parents — especially
   * `OfferChips.tsx` — re-render for reasons that have nothing to do with
   * plan/notebook data, e.g. mic state, live captions) would have replayed
   * that chime for as long as the panel stayed open. A DOM node reference
   * captured before and after a same-props re-render is the precise,
   * mechanical proof: identical reference means React reconciled in place
   * rather than tearing the subtree down.
   */
  it('keeps its DOM identity across a re-render, so a whiteboard inside it never remounts', async () => {
    vi.mocked(getPlan).mockResolvedValue({
      data: { plan: { content: PLAN_BOARD, sessionId: 's1', updatedAt: '2026-09-03T10:00:00Z' } },
      error: null,
    });
    const { rerender } = render(<PlanNotebookPanel token="tok" />);
    const before = await screen.findByText('Meta de ahorro');

    rerender(<PlanNotebookPanel token="tok" />);
    const after = screen.getByText('Meta de ahorro');

    expect(after).toBe(before);
  });
});
