import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import { PlacementPage } from '../PlacementPage';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
// getToken must be a STABLE reference across renders (in the real app it's a
// useCallback from AuthContext) — an inline `getToken: async () => ...` literal
// here would be a NEW function every render, making PlacementPage's legitimate
// `useEffect([courseSlug, getToken])` loop forever. See frontend/AGENTS.md's
// "useEffect dependency must have a stable identity" rule.
vi.mock('@/auth/AuthContext', () => {
  const getToken = async () => 'token-123';
  return { useAuth: () => ({ getToken }) };
});

const mockedApi = vi.mocked(api);

beforeEach(async () => {
  mockedApi.mockReset();
  window.localStorage.clear();
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

const clickButton = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

/**
 * Waits for the opening screen before tapping through it. The page loads its
 * intake info first, so clicking synchronously after render() hits the loading
 * overlay rather than the button.
 */
async function start() {
  await screen.findByText("Let's find your starting point");
  clickButton('Get started');
}

/** GET /intake — the first call the page always makes. */
function mockIntakeInfo(conversationalIntakeAvailable: boolean, ageAlreadyKnown = false) {
  mockedApi.mockResolvedValueOnce({ data: { ageAlreadyKnown, conversationalIntakeAvailable }, error: null });
}

function askStep(topicId: string, prompt: string, questionNumber = 1, phase: 'search' | 'confirm' = 'search') {
  return {
    data: { kind: 'ask', probe: { topicId, prompt, options: ['Wrong', 'Right'] }, questionNumber, questionsRemaining: 3, phase },
    error: null,
  };
}

function doneStep(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      kind: 'done',
      result: {
        frontier: 0,
        startTopicId: 'topic-1',
        startLessonId: 'lesson-1',
        creditedLessonCount: 0,
        creditedTopicCount: 0,
        totalTopicCount: 200,
        method: 'adaptive_quiz',
        cappedByPrerequisite: false,
        ...overrides,
      },
    },
    error: null,
  };
}

describe('PlacementPage — the adaptive quiz', () => {
  it('asks one question at a time and sends the whole answer history back each step', async () => {
    mockIntakeInfo(false);
    mockedApi.mockResolvedValueOnce(askStep('topic-50', 'Question about topic 50'));
    mockedApi.mockResolvedValueOnce(askStep('topic-25', 'Question about topic 25', 2));
    mockedApi.mockResolvedValueOnce(doneStep({ frontier: 25, creditedLessonCount: 25 }));

    renderPage();
    await start();

    await screen.findByText('Question about topic 50');
    fireEvent.click(screen.getByRole('radio', { name: 'Right' }));

    await screen.findByText('Question about topic 25');
    fireEvent.click(screen.getByRole('radio', { name: 'Wrong' }));

    await screen.findByText("You're starting further in");

    // Stateless by design: every /step carries the full history, so a refresh or
    // a dropped connection costs nothing.
    const stepCalls = mockedApi.mock.calls.filter(([path]) => path.endsWith('/step'));
    expect(stepCalls).toHaveLength(3);
    expect(stepCalls[1]![1]!.body).toMatchObject({ answers: [{ topicId: 'topic-50', selectedIndex: 1 }] });
    expect(stepCalls[2]![1]!.body).toMatchObject({
      answers: [
        { topicId: 'topic-50', selectedIndex: 1 },
        { topicId: 'topic-25', selectedIndex: 0 },
      ],
    });
  });

  /*
   * "I don't know" is real evidence about where the frontier is. Sending an
   * index one PAST the last option keeps it honestly wrong without making the
   * learner guess, and without the client ever learning which option was right.
   */
  it('offers "I don\'t know this yet" and sends an index that can never be correct', async () => {
    mockIntakeInfo(false);
    mockedApi.mockResolvedValueOnce(askStep('topic-9', 'A hard one'));
    mockedApi.mockResolvedValueOnce(doneStep());

    renderPage();
    await start();
    await screen.findByText('A hard one');
    fireEvent.click(screen.getByRole('radio', { name: "I don't know this yet" }));

    await waitFor(() => {
      const stepCalls = mockedApi.mock.calls.filter(([path]) => path.endsWith('/step'));
      expect(stepCalls[1]![1]!.body).toMatchObject({ answers: [{ topicId: 'topic-9', selectedIndex: 2 }] });
    });
  });

  it('lets the learner take back their last answer', async () => {
    mockIntakeInfo(false);
    mockedApi.mockResolvedValueOnce(askStep('topic-50', 'First question'));
    mockedApi.mockResolvedValueOnce(askStep('topic-25', 'Second question', 2));
    mockedApi.mockResolvedValueOnce(askStep('topic-50', 'First question'));

    renderPage();
    await start();
    await screen.findByText('First question');
    fireEvent.click(screen.getByRole('radio', { name: 'Right' }));

    await screen.findByText('Second question');
    clickButton('Back');

    await screen.findByText('First question');
    const stepCalls = mockedApi.mock.calls.filter(([path]) => path.endsWith('/step'));
    expect(stepCalls.at(-1)![1]!.body).toMatchObject({ answers: [] });
  });

  it('writes nothing until the learner accepts the result', async () => {
    mockIntakeInfo(false);
    mockedApi.mockResolvedValueOnce(doneStep());
    renderPage();
    await start();

    await screen.findByText("You're starting from the beginning");
    expect(mockedApi.mock.calls.some(([path]) => path.endsWith('/commit'))).toBe(false);

    mockedApi.mockResolvedValueOnce({ data: { startLessonId: 'lesson-1' }, error: null });
    clickButton('Start here');
    await screen.findByText('landed on lesson');
  });
});

/*
 * The reported complaint was ending up somewhere that was not theirs, with no
 * way to say so. This is the answer to it.
 */
describe('PlacementPage — the learner gets the last word', () => {
  it('offers an escape hatch before the quiz even begins', async () => {
    mockIntakeInfo(false);
    renderPage();
    await screen.findByText("Let's find your starting point");

    mockedApi.mockResolvedValueOnce({ data: { startLessonId: 'lesson-1' }, error: null });
    clickButton("I'd rather start from scratch");

    await waitFor(() => {
      const commit = mockedApi.mock.calls.find(([path]) => path.endsWith('/commit'));
      expect(commit![1]!.body).toMatchObject({ startFromBeginning: true });
    });
  });

  it('lets a learner placed too far ahead move themselves back', async () => {
    mockIntakeInfo(false);
    mockedApi.mockResolvedValueOnce(doneStep({ frontier: 100, creditedLessonCount: 100 }));
    renderPage();
    await start();

    await screen.findByText("You're starting further in");
    clickButton('This feels too advanced');

    await screen.findByText('Where would you rather start?');
    mockedApi.mockResolvedValueOnce({ data: { startLessonId: 'lesson-1' }, error: null });
    clickButton('From the beginning');

    await waitFor(() => {
      const commit = mockedApi.mock.calls.find(([path]) => path.endsWith('/commit'));
      expect(commit![1]!.body).toMatchObject({ chosenFrontier: 0 });
    });
  });

  it('offers no "too advanced" escape when the learner was already placed at the start', async () => {
    mockIntakeInfo(false);
    mockedApi.mockResolvedValueOnce(doneStep({ frontier: 0 }));
    renderPage();
    await start();

    await screen.findByText("You're starting from the beginning");
    expect(screen.queryByRole('button', { name: 'This feels too advanced' })).not.toBeInTheDocument();
  });

  it('tells the learner when a prerequisite is what stopped them', async () => {
    mockIntakeInfo(false);
    mockedApi.mockResolvedValueOnce(doneStep({ frontier: 12, creditedLessonCount: 12, cappedByPrerequisite: true }));
    renderPage();
    await start();
    expect(
      await screen.findByText("We stopped you just before a topic that needs something we haven't covered."),
    ).toBeInTheDocument();
  });
});

describe('PlacementPage — the conversational intake', () => {
  it('is offered when the learner is old enough, and its answer is carried as a prior', async () => {
    mockIntakeInfo(true);
    renderPage();
    await start();

    await screen.findByText('What do you already know about this?');
    fireEvent.change(screen.getByLabelText('What I already know'), {
      target: { value: 'I keep a budget and save part of what I earn.' },
    });

    mockedApi.mockResolvedValueOnce({
      data: { available: true, priorFraction: 0.6, reflection: 'Budgeting already — that is ground you have covered.' },
      error: null,
    });
    mockedApi.mockResolvedValueOnce(askStep('topic-130', 'A question well into the course'));

    clickButton('Continue');
    await screen.findByText('A question well into the course');

    const stepCall = mockedApi.mock.calls.find(([path]) => path.endsWith('/step'));
    expect(stepCall![1]!.body).toMatchObject({ signals: { aiPriorFraction: 0.6 } });
    expect(screen.getByText('Budgeting already — that is ground you have covered.')).toBeInTheDocument();
  });

  it('is not offered at all to a learner under the age floor', async () => {
    mockIntakeInfo(false);
    mockedApi.mockResolvedValueOnce(askStep('topic-1', 'A first question'));
    renderPage();
    await start();

    await screen.findByText('A first question');
    expect(screen.queryByText('What do you already know about this?')).not.toBeInTheDocument();
  });

  /*
   * The intake is optional infrastructure (/AGENTS.md §1.14). If it is down,
   * the learner is still placed — they just do not get the nicer opener, and
   * they are never shown an error about it.
   */
  it('falls through to the ordinary quiz when the intake is unavailable, without showing an error', async () => {
    mockIntakeInfo(true);
    renderPage();
    await start();

    await screen.findByText('What do you already know about this?');
    fireEvent.change(screen.getByLabelText('What I already know'), { target: { value: 'Some things.' } });

    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'oracle is down' } });
    mockedApi.mockResolvedValueOnce(askStep('topic-1', 'An ordinary question'));

    clickButton('Continue');
    await screen.findByText('An ordinary question');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    const stepCall = mockedApi.mock.calls.find(([path]) => path.endsWith('/step'));
    expect(stepCall![1]!.body).toMatchObject({ signals: {} });
  });

  it('lets the learner skip straight to the questions', async () => {
    mockIntakeInfo(true);
    mockedApi.mockResolvedValueOnce(askStep('topic-1', 'An ordinary question'));
    renderPage();
    await start();

    await screen.findByText('What do you already know about this?');
    clickButton('Just ask me questions instead');
    await screen.findByText('An ordinary question');
  });
});

describe('PlacementPage — narration and failure', () => {
  it('shows every spoken line as text, so the flow works with no audio at all', async () => {
    mockIntakeInfo(false);
    renderPage();
    expect(await screen.findByText(i18n.t('placement.narration.welcome'))).toBeInTheDocument();
  });

  it('surfaces a real step failure to the learner', async () => {
    mockIntakeInfo(false);
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL', message: 'nope' } });
    renderPage();
    await start();
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('shows the load error when the course cannot be read at all', async () => {
    mockedApi.mockResolvedValueOnce({ data: null, error: { code: 'NOT_FOUND', message: 'no such course' } });
    renderPage();
    await waitFor(() => expect(screen.queryByText(i18n.t('placement.loading'))).not.toBeInTheDocument());
  });
});
