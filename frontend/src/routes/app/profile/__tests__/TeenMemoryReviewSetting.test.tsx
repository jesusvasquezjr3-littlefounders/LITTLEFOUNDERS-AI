import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TeenMemoryReviewSetting } from '../TeenMemoryReviewSetting';
import en from '@/i18n/en-US/rebuild-profile.json';

const copy = en.memorySelfReview;

const mocks = vi.hoisted(() => ({
  getOwn: vi.fn(),
  decide: vi.fn(),
  getToken: vi.fn().mockResolvedValue('synthetic'),
  auth: { session: { user: { id: 'teen-1' } }, isGuest: false },
}));
vi.mock('@/rebuild/mentor/session/tutorApi', () => ({ getOwnPendingMemoryNotes: mocks.getOwn, decideMemoryNote: mocks.decide }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ ...mocks.auth, getToken: mocks.getToken }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { resolvedLanguage: 'en-US' } }) }));

const NOTE = {
  id: 'note-1',
  store: 'learner',
  proposed: 'Le gusta planear ahorros pequeños.',
  expectedBefore: 'Nota anterior.',
  sessionId: 's1',
  createdAt: '2026-09-24T10:00:00Z',
};
const queue = (proposals: Array<Omit<typeof NOTE, 'expectedBefore'> & { expectedBefore: string | null }> = [NOTE], current: string | null = 'Nota anterior.', pedagogy: string | null = null) => ({
  data: { proposals, current: { learner: current, pedagogy } },
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.session = { user: { id: 'teen-1' } };
  mocks.auth.isGuest = false;
  mocks.getToken.mockResolvedValue('synthetic');
});

describe('TeenMemoryReviewSetting', () => {
  it('renders nothing for a guest account and never asks the server', () => {
    mocks.auth.isGuest = true;
    const view = render(<TeenMemoryReviewSetting />);
    expect(view.container).toBeEmptyDOMElement();
    expect(mocks.getOwn).not.toHaveBeenCalled();
  });

  it('renders nothing when the server says these notes are not self-reviewed', async () => {
    mocks.getOwn.mockResolvedValue({ data: null, error: { code: 'FORBIDDEN', message: 'Not self-reviewed' } });
    const view = render(<TeenMemoryReviewSetting />);
    await waitFor(() => expect(view.container).toBeEmptyDOMElement());
    expect(mocks.getOwn).toHaveBeenCalledWith('synthetic');
  });

  it('loads the queue from the own-memory endpoint and shows each proposal', async () => {
    mocks.getOwn.mockResolvedValue(queue());
    render(<TeenMemoryReviewSetting />);
    expect(await screen.findByText(NOTE.proposed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.approve })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.delete })).toBeInTheDocument();
    expect(screen.getAllByText(copy.currentLabel)).toHaveLength(2);
    expect(mocks.getOwn).toHaveBeenCalledWith('synthetic');
  });

  it('shows a loading status, then the queue, without ever painting an empty queue first', async () => {
    let finish!: (value: ReturnType<typeof queue>) => void;
    mocks.getOwn.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<TeenMemoryReviewSetting />);
    expect(screen.getByRole('status')).toHaveTextContent(copy.loading);
    expect(screen.queryByText(copy.empty)).toBeNull();
    await act(async () => finish(queue()));
    expect(await screen.findByText(NOTE.proposed)).toBeInTheDocument();
  });

  it('reports a failed read with a retry that loads the queue, never an empty queue', async () => {
    mocks.getOwn.mockResolvedValueOnce({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'down' } }).mockResolvedValueOnce(queue());
    render(<TeenMemoryReviewSetting />);
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.loadFailed);
    expect(screen.queryByText(copy.empty)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    expect(await screen.findByText(NOTE.proposed)).toBeInTheDocument();
    expect(mocks.getOwn).toHaveBeenCalledTimes(2);
  });

  it('treats a malformed queue payload as a failed read, not an empty queue', async () => {
    mocks.getOwn.mockResolvedValue({ data: { proposals: [{ id: 'note-1' }], current: { learner: null, pedagogy: null } }, error: null });
    render(<TeenMemoryReviewSetting />);
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.loadFailed);
    expect(screen.queryByText(copy.empty)).toBeNull();
  });

  it('approves a note with the approved verdict and reports what the server applied', async () => {
    mocks.getOwn.mockResolvedValue(queue());
    mocks.decide.mockResolvedValue({ data: { outcome: 'written', applied: true }, error: null });
    const view = render(<TeenMemoryReviewSetting />);
    fireEvent.click(await screen.findByRole('button', { name: copy.approve }));
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith('synthetic', 'note-1', 'approved'));
    expect(await screen.findByText(copy.kept)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.approve })).toBeNull();
    // An applied approval becomes the note the Mentor holds now.
    expect(view.container.querySelector('.lf-memory-current')).toHaveTextContent(NOTE.proposed);
  });

  it('deletes a note with the rejected verdict without claiming it was applied', async () => {
    mocks.getOwn.mockResolvedValue(queue());
    mocks.decide.mockResolvedValue({ data: { outcome: 'rejected', applied: false }, error: null });
    render(<TeenMemoryReviewSetting />);
    fireEvent.click(await screen.findByRole('button', { name: copy.delete }));
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith('synthetic', 'note-1', 'rejected'));
    expect(await screen.findByText(copy.deleted)).toBeInTheDocument();
    expect(screen.queryByText(copy.kept)).toBeNull();
  });

  it('disables both actions and announces the decision while it is in flight', async () => {
    mocks.getOwn.mockResolvedValue(queue());
    let finish!: (value: { data: { outcome: string; applied: boolean }; error: null }) => void;
    mocks.decide.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<TeenMemoryReviewSetting />);
    fireEvent.click(await screen.findByRole('button', { name: copy.approve }));
    expect(screen.getByRole('button', { name: copy.approve })).toBeDisabled();
    expect(screen.getByRole('button', { name: copy.delete })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(copy.deciding);
    fireEvent.click(screen.getByRole('button', { name: copy.approve }));
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledTimes(1));
    await act(async () => finish({ data: { outcome: 'written', applied: true }, error: null }));
    expect(await screen.findByText(copy.kept)).toBeInTheDocument();
  });

  it('refreshes the queue on an out-of-date conflict without claiming the decision landed', async () => {
    mocks.getOwn.mockResolvedValueOnce(queue()).mockResolvedValueOnce(queue([], 'Una nota nueva, ya aprobada.'));
    mocks.decide.mockResolvedValue({ data: null, error: { code: 'NOTE_OUT_OF_DATE', message: 'stale' } });
    render(<TeenMemoryReviewSetting />);
    fireEvent.click(await screen.findByRole('button', { name: copy.approve }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.changed);
    expect(await screen.findByText(copy.empty)).toBeInTheDocument();
    expect(screen.getByText('Una nota nueva, ya aprobada.')).toBeInTheDocument();
    expect(screen.queryByText(copy.kept)).toBeNull();
    expect(mocks.getOwn).toHaveBeenCalledTimes(2);
  });

  it('refreshes the queue when the note was already decided', async () => {
    mocks.getOwn.mockResolvedValueOnce(queue()).mockResolvedValueOnce(queue([]));
    mocks.decide.mockResolvedValue({ data: null, error: { code: 'ALREADY_DECIDED', message: 'decided' } });
    render(<TeenMemoryReviewSetting />);
    fireEvent.click(await screen.findByRole('button', { name: copy.approve }));
    expect(await screen.findByText(copy.empty)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(copy.changed);
    expect(screen.queryByText(copy.kept)).toBeNull();
  });

  it('keeps the note actionable after an ordinary decision failure', async () => {
    mocks.getOwn.mockResolvedValue(queue());
    mocks.decide.mockResolvedValue({ data: null, error: { code: 'INTERNAL', message: 'down' } });
    render(<TeenMemoryReviewSetting />);
    fireEvent.click(await screen.findByRole('button', { name: copy.approve }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.decisionFailed);
    expect(screen.getByRole('button', { name: copy.approve })).toBeEnabled();
    expect(screen.getByText(NOTE.proposed)).toBeInTheDocument();
  });

  it('re-confirms eligibility from the server when a decision is refused, and hides if refused again', async () => {
    mocks.getOwn.mockResolvedValueOnce(queue()).mockResolvedValueOnce({ data: null, error: { code: 'FORBIDDEN', message: 'Not self-reviewed' } });
    mocks.decide.mockResolvedValue({ data: null, error: { code: 'FORBIDDEN', message: 'Not your note' } });
    const view = render(<TeenMemoryReviewSetting />);
    fireEvent.click(await screen.findByRole('button', { name: copy.approve }));
    await waitFor(() => expect(view.container).toBeEmptyDOMElement());
    expect(mocks.getOwn).toHaveBeenCalledTimes(2);
  });

  it('applies an approved pedagogy note to the pedagogy store only, and refuses a legacy string current', async () => {
    const pedagogyNote = { ...NOTE, id: 'note-p', store: 'pedagogy', proposed: 'Un dibujo primero ayuda.', expectedBefore: null as string | null };
    mocks.getOwn.mockResolvedValue(queue([pedagogyNote], 'Nota anterior.'));
    mocks.decide.mockResolvedValue({ data: { outcome: 'written', applied: true, store: 'pedagogy' }, error: null });
    const view = render(<TeenMemoryReviewSetting />);
    fireEvent.click(await screen.findByRole('button', { name: copy.approve }));
    await screen.findByText(copy.kept);
    expect(mocks.decide).toHaveBeenCalledWith('synthetic', 'note-p', 'approved');
    expect(view.container.querySelector('[data-memory-store="pedagogy"] .lf-memory-current')).toHaveTextContent(pedagogyNote.proposed);
    expect(view.container.querySelector('[data-memory-store="learner"] .lf-memory-current')).toHaveTextContent('Nota anterior.');
    view.unmount();
    mocks.getOwn.mockResolvedValue({ data: { proposals: [], current: 'Nota anterior.' }, error: null });
    render(<TeenMemoryReviewSetting />);
    expect(await screen.findByText(copy.loadFailed)).toBeInTheDocument();
  });
});
