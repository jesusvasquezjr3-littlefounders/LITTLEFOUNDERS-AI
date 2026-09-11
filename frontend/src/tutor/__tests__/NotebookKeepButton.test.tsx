import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotebookKeepButton } from '../NotebookKeepButton';

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));

describe('NotebookKeepButton — the learner keeps a board (Class V, migration 0069)', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  // The auto-retry (#4) leaves a 600ms timer in flight; unmounting between
  // tests stops a straggling retry from a settled test bleeding a call into
  // the next one. Every test below also waits for its own final state, so no
  // timer is actually pending by the time this runs.
  afterEach(() => cleanup());

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

  it('silently auto-retries ONE transient failure, so the learner never sees an error', async () => {
    // The exact live failure (2026-09-10): fails on the first attempt, succeeds
    // on the retry. The learner just sees it save.
    mockApi
      .mockResolvedValueOnce({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'x' } })
      .mockResolvedValueOnce({ data: { kept: true }, error: null });
    render(<NotebookKeepButton token="tok" sessionId="sess-1" turnSeq={3} />);

    fireEvent.click(screen.getByRole('button'));

    // Wait for the FINAL "kept" text, not merely `disabled` — the button is
    // also disabled during the "Keeping…" beat between the two attempts.
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent(/Kept/), { timeout: 2000 });
    // Two attempts: the failed one and its silent retry. No error was ever shown.
    expect(mockApi).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/try again/i)).toBeNull();
  });

  it('surfaces the error only when BOTH attempts fail, and a manual retry still works', async () => {
    // A persistent failure: the first attempt AND its silent retry both fail.
    mockApi.mockResolvedValue({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'x' } });
    render(<NotebookKeepButton token="tok" sessionId="sess-1" turnSeq={3} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled(), { timeout: 2000 });
    expect(screen.getByRole('button')).toHaveTextContent(/try again/i);
    expect(mockApi).toHaveBeenCalledTimes(2); // the attempt and its retry

    // A manual tap retries — the failure did not permanently lock the control.
    mockApi.mockResolvedValue({ data: { kept: true }, error: null });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    expect(mockApi).toHaveBeenCalledTimes(3); // this success needed no retry
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
