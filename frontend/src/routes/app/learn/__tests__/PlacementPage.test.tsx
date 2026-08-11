import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import { PlacementPage } from '../PlacementPage';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
// getToken must be a STABLE reference across renders (in the real app it's a
// useCallback from AuthContext) — an inline `getToken: async () => ...`
// literal here would be a NEW function every render, making PlacementPage's
// legitimate `useEffect([courseSlug, getToken])` loop forever. See
// frontend/AGENTS.md's "useEffect dependency must have a stable identity" rule.
vi.mock('@/auth/AuthContext', () => {
  const getToken = async () => 'token-123';
  return { useAuth: () => ({ getToken }) };
});

const mockedApi = vi.mocked(api);

beforeEach(async () => {
  mockedApi.mockReset();
  await i18n.changeLanguage('en-US');
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/learn/money-basics/placement']}>
      <Routes>
        <Route path="/learn/:courseSlug/placement" element={<PlacementPage />} />
        <Route path="/learn/lesson/:lessonId" element={<div>landed on lesson</div>} />
        <Route path="/learn/:courseSlug" element={<div>landed on course</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PlacementPage', () => {
  it('walks level -> education -> age (unknown) -> quiz -> submit, posting the graded answers and routing to the returned starting lesson', async () => {
    mockedApi.mockResolvedValueOnce({
      data: {
        probes: [{ topicId: 'topic-1', prompt: 'What is money?', options: ['Used to trade', 'A toy'] }],
        ageAlreadyKnown: false,
      },
      error: null,
    });
    renderPage();

    await screen.findByText('How much do you already know about this?');
    fireEvent.click(screen.getByRole('radio', { name: /I know a little/ }));

    await screen.findByText("What's your current level of schooling?");
    fireEvent.click(screen.getByRole('radio', { name: 'Middle school' }));

    await screen.findByText('How old are you?');
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    await screen.findByText('What is money?');
    fireEvent.click(screen.getByRole('radio', { name: 'Used to trade' }));

    await screen.findByText('Ready to find your starting point?');
    mockedApi.mockResolvedValueOnce({ data: { startLessonId: 'lesson-42', creditedLessonCount: 1 }, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Get my placement' }));

    await waitFor(() => expect(screen.getByText('landed on lesson')).toBeInTheDocument());

    expect(mockedApi).toHaveBeenCalledTimes(2);
    const [path, options] = mockedApi.mock.calls[1]!;
    expect(path).toBe('/placement/money-basics/complete');
    expect(options).toMatchObject({
      body: {
        claimedLevel: 'some',
        educationLevel: 'middle',
        birthDate: undefined,
        quizAnswers: [{ topicId: 'topic-1', selectedIndex: 0 }],
      },
    });
  });

  it('skips the age step entirely when ageAlreadyKnown is true', async () => {
    mockedApi.mockResolvedValueOnce({ data: { probes: [], ageAlreadyKnown: true }, error: null });
    renderPage();

    await screen.findByText('How much do you already know about this?');
    fireEvent.click(screen.getByRole('radio', { name: /This is all new to me/ }));

    await screen.findByText("What's your current level of schooling?");
    fireEvent.click(screen.getByRole('radio', { name: 'Elementary school' }));

    // Age known + "new" skips the quiz too -> straight to submit.
    await screen.findByText('Ready to find your starting point?');
  });

  it('"new" skips the quiz even when probes exist, and never navigates to a course page fallback when startLessonId is null', async () => {
    mockedApi.mockResolvedValueOnce({
      data: { probes: [{ topicId: 'topic-1', prompt: 'What is money?', options: ['a', 'b'] }], ageAlreadyKnown: true },
      error: null,
    });
    renderPage();

    await screen.findByText('How much do you already know about this?');
    fireEvent.click(screen.getByRole('radio', { name: /This is all new to me/ }));
    await screen.findByText("What's your current level of schooling?");
    fireEvent.click(screen.getByRole('radio', { name: 'Preschool' }));

    // No age step (known), no quiz step (claimedLevel === 'new') -> submit directly.
    await screen.findByText('Ready to find your starting point?');
    mockedApi.mockResolvedValueOnce({ data: { startLessonId: null, creditedLessonCount: 0 }, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Get my placement' }));

    await waitFor(() => expect(screen.getByText('landed on course')).toBeInTheDocument());
    const [, options] = mockedApi.mock.calls[1]!;
    expect(options).toMatchObject({ body: { claimedLevel: 'new', quizAnswers: [] } });
  });

  it('shows an inline error and stays on the submit step when the API call fails', async () => {
    mockedApi.mockResolvedValueOnce({ data: { probes: [], ageAlreadyKnown: true }, error: null });
    renderPage();

    await screen.findByText('How much do you already know about this?');
    fireEvent.click(screen.getByRole('radio', { name: /This is all new to me/ }));
    await screen.findByText("What's your current level of schooling?");
    fireEvent.click(screen.getByRole('radio', { name: 'Adult' }));
    await screen.findByText('Ready to find your starting point?');

    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'boom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get my placement' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong, please try again.'));
    expect(screen.getByText('Ready to find your starting point?')).toBeInTheDocument();
  });
});
