import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TutorPlanNotebookPanel } from '../TutorPlanNotebookPanel';
import { getKidNotebook, getKidPlan } from '@/tutor/tutorApi';

/*
 * Class V, as a guardian surface (/TUTOR_INSTRUMENTS.md §3.6, migration
 * 0069). Unlike the memory-notes panel above it, this one is deliberately
 * ABSENT rather than empty when there is nothing to show — the behavior
 * these tests protect is that absence, not a rendered layout.
 */

vi.mock('@/tutor/tutorApi', () => ({
  getKidPlan: vi.fn(),
  getKidNotebook: vi.fn(),
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
});

function renderPanel() {
  render(<TutorPlanNotebookPanel kidUserId="kid-1" token="tok" />);
}

describe('TutorPlanNotebookPanel', () => {
  it('renders nothing at all when there is neither a plan nor a kept board', async () => {
    vi.mocked(getKidPlan).mockResolvedValue({ data: { plan: null }, error: null });
    vi.mocked(getKidNotebook).mockResolvedValue({ data: { entries: [] }, error: null });
    const { container } = render(<TutorPlanNotebookPanel kidUserId="kid-1" token="tok" />);

    await waitFor(() => expect(getKidPlan).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the plan board when one exists', async () => {
    vi.mocked(getKidPlan).mockResolvedValue({
      data: { plan: { content: PLAN_BOARD, sessionId: 's1', updatedAt: '2026-09-03T10:00:00Z' } },
      error: null,
    });
    vi.mocked(getKidNotebook).mockResolvedValue({ data: { entries: [] }, error: null });
    renderPanel();

    expect(await screen.findByText('Meta de ahorro')).toBeInTheDocument();
  });

  it('shows every kept board, newest first as the server already ordered them', async () => {
    vi.mocked(getKidPlan).mockResolvedValue({ data: { plan: null }, error: null });
    vi.mocked(getKidNotebook).mockResolvedValue({
      data: {
        entries: [
          { id: 'n1', whiteboard: NOTEBOOK_BOARD, sessionId: 's1', turnSeq: 3, keptAt: '2026-09-03T10:05:00Z' },
        ],
      },
      error: null,
    });
    renderPanel();

    expect(await screen.findByText('Ahorro semanal')).toBeInTheDocument();
  });

  it('says the load failed rather than rendering nothing, on a real error', async () => {
    vi.mocked(getKidPlan).mockResolvedValue({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'x' } });
    vi.mocked(getKidNotebook).mockResolvedValue({ data: { entries: [] }, error: null });
    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load/i);
  });
});
