import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotebookKeepButton } from '../NotebookKeepButton';

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));

describe('NotebookKeepButton — the learner keeps a board (Class V, migration 0069)', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('names only (sessionId, turnSeq), never the board content itself', async () => {
    mockApi.mockResolvedValue({ data: { kept: true }, error: null });
    render(<NotebookKeepButton token="tok" sessionId="sess-1" turnSeq={3} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/tutor/notebook', {
        method: 'POST',
        token: 'tok',
        body: { sessionId: 'sess-1', turnSeq: 3 },
      });
    });
  });

  it('shows "kept" and disables itself once the save lands', async () => {
    mockApi.mockResolvedValue({ data: { kept: true }, error: null });
    render(<NotebookKeepButton token="tok" sessionId="sess-1" turnSeq={3} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    expect(screen.getByRole('button')).toHaveTextContent(/Kept/);
  });

  it('reports failure and lets the learner try again, rather than silently doing nothing', async () => {
    mockApi.mockResolvedValue({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'x' } });
    render(<NotebookKeepButton token="tok" sessionId="sess-1" turnSeq={3} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled());
    expect(screen.getByRole('button')).toHaveTextContent(/try again/i);

    // A second tap retries — the failure did not permanently lock the control.
    mockApi.mockResolvedValue({ data: { kept: true }, error: null });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    expect(mockApi).toHaveBeenCalledTimes(2);
  });

  it('does nothing on a second click while the first request is still in flight', async () => {
    let resolve!: (v: unknown) => void;
    mockApi.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<NotebookKeepButton token="tok" sessionId="sess-1" turnSeq={3} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(mockApi).toHaveBeenCalledTimes(1);

    resolve({ data: { kept: true }, error: null });
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
  });
});
