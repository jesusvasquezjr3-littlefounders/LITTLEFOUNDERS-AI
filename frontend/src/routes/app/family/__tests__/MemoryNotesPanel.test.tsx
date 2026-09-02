import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryNotesPanel } from '../MemoryNotesPanel';
import { decideMemoryNote, getPendingMemoryNotes } from '@/tutor/tutorApi';

/*
 * THE PARENTAL APPROVAL GATE, as a surface (/ORACLE.md §20, migration 0068) —
 * the one item that document marked BLOCKING before real families could use
 * the Tutor.
 *
 * What these tests protect is not the layout. It is that a guardian is never
 * shown a decision that did not happen: the server refuses a stale note and an
 * already-decided one, and a panel that rendered "Approved" either time would
 * be telling a parent their child's record changed when it did not.
 */

vi.mock('@/tutor/tutorApi', () => ({
  getPendingMemoryNotes: vi.fn(),
  decideMemoryNote: vi.fn(),
}));

const NOTE = {
  id: 'note-1',
  proposed: 'Le gustan los caballos y los cuentos largos.',
  expectedBefore: 'Nota anterior.',
  sessionId: 's1',
  createdAt: '2026-09-01T10:00:00Z',
};

beforeEach(() => {
  vi.mocked(getPendingMemoryNotes).mockReset();
  vi.mocked(decideMemoryNote).mockReset();
});

function renderPanel() {
  render(<MemoryNotesPanel kidUserId="kid-1" token="tok" />);
}

describe('MemoryNotesPanel', () => {
  it('shows the proposed note AND the text it would replace', async () => {
    vi.mocked(getPendingMemoryNotes).mockResolvedValue({
      data: { proposals: [NOTE], current: 'Nota anterior.' },
      error: null,
    });
    renderPanel();

    expect(await screen.findByText(NOTE.proposed)).toBeInTheDocument();
    /*
     * A note is a full REPLACEMENT, not an addition, so approving one
     * discards whatever it replaced. A parent shown only the new paragraph is
     * approving a change they can see one half of.
     *
     * TWO occurrences on purpose: the note the tutor holds today (rendered at
     * the top of the panel) and the same text again as what THIS proposal
     * would replace. They are equal here precisely because this note is not
     * stale — the out-of-date test below is the case where they differ.
     */
    expect(screen.getAllByText('Nota anterior.')).toHaveLength(2);
    expect(screen.getByText(/this would replace/i)).toBeInTheDocument();
  });

  it('approves a note and reports the outcome the server actually gave', async () => {
    vi.mocked(getPendingMemoryNotes).mockResolvedValue({
      data: { proposals: [NOTE], current: 'Nota anterior.' },
      error: null,
    });
    vi.mocked(decideMemoryNote).mockResolvedValue({
      data: { outcome: 'written', applied: true },
      error: null,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(decideMemoryNote).toHaveBeenCalledWith('tok', 'note-1', 'approved');
    });
    expect(await screen.findByText(/the tutor will use this from now on/i)).toBeInTheDocument();
  });

  it('rejects a note without claiming it was applied', async () => {
    vi.mocked(getPendingMemoryNotes).mockResolvedValue({
      data: { proposals: [NOTE], current: 'Nota anterior.' },
      error: null,
    });
    vi.mocked(decideMemoryNote).mockResolvedValue({
      data: { outcome: 'rejected', applied: false },
      error: null,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /reject/i }));

    await waitFor(() => {
      expect(decideMemoryNote).toHaveBeenCalledWith('tok', 'note-1', 'rejected');
    });
    expect(await screen.findByText(/the note was not changed/i)).toBeInTheDocument();
  });

  /*
   * A stale note is marked BEFORE the guardian taps anything: `current` is
   * what the tutor holds right now and `expectedBefore` is what this note was
   * written against, so the two disagreeing IS the definition of stale. Being
   * told after pressing Approve is a worse product and an avoidable one.
   */
  it('marks a note whose base text has already moved as out of date', async () => {
    vi.mocked(getPendingMemoryNotes).mockResolvedValue({
      data: { proposals: [NOTE], current: 'Una nota más reciente, ya aprobada.' },
      error: null,
    });
    renderPanel();

    expect(await screen.findByText(/out of date/i)).toBeInTheDocument();
  });

  it('never reports a server REFUSAL as an approval', async () => {
    vi.mocked(getPendingMemoryNotes).mockResolvedValue({
      data: { proposals: [NOTE], current: 'Nota anterior.' },
      error: null,
    });
    vi.mocked(decideMemoryNote).mockResolvedValue({
      data: null,
      error: { code: 'NOTE_OUT_OF_DATE', message: 'stale' },
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /approve/i }));

    // The explanation, not a success message, and not a generic error either.
    expect(await screen.findByText(/it was not applied/i)).toBeInTheDocument();
    expect(screen.queryByText(/the tutor will use this from now on/i)).not.toBeInTheDocument();
  });

  it('treats “somebody already decided this” the same honest way', async () => {
    vi.mocked(getPendingMemoryNotes).mockResolvedValue({
      data: { proposals: [NOTE], current: 'Nota anterior.' },
      error: null,
    });
    vi.mocked(decideMemoryNote).mockResolvedValue({
      data: null,
      error: { code: 'ALREADY_DECIDED', message: 'decided' },
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /approve/i }));

    expect(await screen.findByText(/it was not applied/i)).toBeInTheDocument();
  });

  it('says a load failed instead of rendering an empty queue', async () => {
    vi.mocked(getPendingMemoryNotes).mockResolvedValue({
      data: null,
      error: { code: 'DATA_UNAVAILABLE', message: 'down' },
    });
    renderPanel();

    // "Nothing is waiting for you" and "we could not load this" are the same
    // screen with opposite meanings for a parent.
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t load/i);
    expect(screen.queryByText(/nothing is waiting for you/i)).not.toBeInTheDocument();
  });

  it('shows the current note even when nothing is waiting', async () => {
    vi.mocked(getPendingMemoryNotes).mockResolvedValue({
      data: { proposals: [], current: 'Le gusta contar monedas en voz alta.' },
      error: null,
    });
    renderPanel();

    expect(await screen.findByText('Le gusta contar monedas en voz alta.')).toBeInTheDocument();
    expect(screen.getByText(/nothing is waiting for you/i)).toBeInTheDocument();
  });
});
