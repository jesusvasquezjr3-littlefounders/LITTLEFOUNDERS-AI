import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Locale } from '../design/copyBudget';
import type { MentorCharacter } from '../design/controls';
import type { LearnLinks } from './learnCopy';
import { usePlacementFlow, type PlacementTransport } from './placementFlow';
import { PlacementFlowView } from './PlacementFlowView';

/*
 * W2L.2 (L4): the rebuilt placement flow against Core's contract
 * (backend/src/routes/placement.ts), every behaviour the legacy page had kept
 * (the whole answer history on each step, "I don't know yet" as an answer
 * that can never be right, going back one answer, nothing written until a
 * start is chosen, starting from the beginning, moving a start earlier, the
 * 12+ opener and its prior), plus B.1's identical retry and B.15's frame.
 */

const links: LearnLinks = {
  home: '/learn', course: (slug) => `/learn/${slug}`, lesson: (id) => `/learn/lesson/${id}`, placement: (slug) => `/learn/${slug}/placement`,
  territory: (slug) => `/learn/${slug}/territory`, rhythm: '/learn/rhythm', journal: '/learn/journal',
};

type Reply = { data: unknown; error: { code: string } | null };
const ok = (data: unknown): Reply => ({ data, error: null });
const refuse = (code: string): Reply => ({ data: null, error: { code } });

const ask = (topicId: string, prompt: string, questionNumber = 1, phase: 'search' | 'confirm' = 'search') =>
  ok({ kind: 'ask', probe: { topicId, prompt, options: ['Wrong', 'Right'] }, questionNumber, questionsRemaining: 3, phase });
const frame = (start: 'beginning' | 'further_in', path = 'adaptive_quiz') =>
  ({ path, start, basis: 'prior_exposure', learner_chosen: path === 'learner_chose_start' || path === 'learner_adjusted' });
const done = (frontier: number, extra: Record<string, unknown> = {}) => ok({ kind: 'done', result: {
  frontier, startTopicId: 't', startLessonId: 'lesson-7', creditedLessonCount: frontier, creditedTopicCount: frontier, totalTopicCount: 200,
  method: 'adaptive_quiz', cappedByPrerequisite: false, framing: frame(frontier > 0 ? 'further_in' : 'beginning'), ...extra } });

/** A scripted Core: `steps` answer POST /step in order; `commits` answer POST /commit in order. */
function core({ intake = ok({ ageAlreadyKnown: true, conversationalIntakeAvailable: false }), steps = [] as Reply[], commits = [ok({ frontier: 0, startLessonId: 'lesson-7', cappedByPrerequisite: false, framing: frame('beginning') })],
  intakeReply = ok({ available: false, priorFraction: null, reflection: null }) } = {}) {
  const calls: { path: string; method: string; body: unknown }[] = [];
  const stepQueue = [...steps], commitQueue = [...commits];
  const transport: PlacementTransport = vi.fn(async (path, init) => {
    calls.push({ path, method: init?.method ?? 'GET', body: init?.body });
    if (path.endsWith('/intake')) return init?.method === 'POST' ? intakeReply : intake;
    if (path.endsWith('/step')) return stepQueue.shift() ?? refuse('INTERNAL');
    if (path.endsWith('/commit')) return commitQueue.shift() ?? refuse('INTERNAL');
    return refuse('NOT_FOUND');
  });
  return { transport, calls, bodies: (suffix: string) => calls.filter((call) => call.path.endsWith(suffix)).map((call) => call.body) };
}

function Harness({ transport, onPlaced, locale = 'en-US', mentor = 'zara', onNavigate = vi.fn() }: {
  transport: PlacementTransport; onPlaced: (id: string | null) => void; locale?: Locale; mentor?: MentorCharacter | null; onNavigate?: () => void;
}) {
  const flow = usePlacementFlow({ slug: 'money-basics', transport, neutralReflection: 'Good to know.', onPlaced });
  return <main><PlacementFlowView flow={flow} slug="money-basics" locale={locale} dark={false} ageBand="10-12" mentor={mentor} links={links} onNavigate={onNavigate} /></main>;
}

function start(setup: ReturnType<typeof core>, extra: Partial<Parameters<typeof Harness>[0]> = {}) {
  const onPlaced = vi.fn();
  render(<Harness transport={setup.transport} onPlaced={onPlaced} {...extra} />);
  return onPlaced;
}
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('placement flow: the adaptive questions', () => {
  it('asks one question at a time and sends the whole answer history with every step', async () => {
    const setup = core({ steps: [ask('t-50', 'Question 50'), ask('t-25', 'Question 25', 2), done(25)] });
    start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    fireEvent.click(await screen.findByRole('button', { name: /Right/ }));
    await screen.findByRole('heading', { level: 1, name: 'Question 25' });
    fireEvent.click(screen.getByRole('button', { name: /Wrong/ }));
    await screen.findByRole('heading', { level: 1, name: 'Your path starts further in' });
    expect(setup.bodies('/step')).toEqual([
      { signals: {}, answers: [] },
      { signals: {}, answers: [{ topicId: 't-50', selectedIndex: 1 }] },
      { signals: {}, answers: [{ topicId: 't-50', selectedIndex: 1 }, { topicId: 't-25', selectedIndex: 0 }] },
    ]);
    // B.15: the frame's words, never a score, a count of right answers or a comparison.
    expect(screen.getByText("This reflects what you've seen, not what you can do.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d+ (?:of|\/) ?\d+ (?:right|correct)|score|25/);
    // Nothing is written until a start is chosen.
    expect(setup.bodies('/commit')).toEqual([]);
  });

  it('offers "I don\'t know yet" as an answer whose index can never be right', async () => {
    const setup = core({ steps: [ask('t-9', 'Question 9'), done(0)] });
    start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    fireEvent.click(await screen.findByRole('button', { name: /I don't know yet/ }));
    await screen.findByRole('heading', { level: 1, name: 'Your path starts here' });
    expect(setup.bodies('/step')[1]).toEqual({ signals: {}, answers: [{ topicId: 't-9', selectedIndex: 2 }] });
  });

  it('lets the learner take back their last answer, and moves focus to each new question', async () => {
    const setup = core({ steps: [ask('t-1', 'First'), ask('t-2', 'Second', 2), ask('t-1', 'First')] });
    start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    fireEvent.click(await screen.findByRole('button', { name: /Right/ }));
    const second = await screen.findByRole('heading', { level: 1, name: 'Second' });
    await waitFor(() => expect(document.activeElement).toBe(second));
    press('Back');
    await screen.findByRole('heading', { level: 1, name: 'First' });
    expect(setup.bodies('/step').at(-1)).toEqual({ signals: {}, answers: [] });
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('says the confirming question is the last one', async () => {
    const setup = core({ steps: [ask('t-3', 'Confirm this', 3, 'confirm')] });
    start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    await screen.findByText('Last one.');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('Question 3 of about 6');
  });
});

describe('placement flow: the learner has the last word', () => {
  it('starts from the beginning without a single question', async () => {
    const setup = core();
    const onPlaced = start(setup);
    press(await screen.findByRole('button', { name: 'From the beginning' }).then((button) => button.textContent!));
    await waitFor(() => expect(onPlaced).toHaveBeenCalledWith('lesson-7'));
    expect(setup.bodies('/commit')).toEqual([{ signals: {}, answers: [], startFromBeginning: true }]);
    expect(setup.bodies('/step')).toEqual([]);
  });

  it('moves a start earlier, or back to the beginning, or keeps it', async () => {
    const setup = core({ steps: [ask('t-1', 'Q'), done(40)] });
    const onPlaced = start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    fireEvent.click(await screen.findByRole('button', { name: /Right/ }));
    press(await screen.findByRole('button', { name: 'Start earlier' }).then((button) => button.textContent!));
    await screen.findByRole('heading', { level: 1, name: 'Where do you want to start?' });
    expect(screen.getByText('You decide. Moving back is fine.')).toBeTruthy();
    press('Keep this start');
    await screen.findByRole('heading', { level: 1, name: 'Your path starts further in' });
    press('Start earlier');
    press(await screen.findByRole('button', { name: 'A bit earlier' }).then((button) => button.textContent!));
    await waitFor(() => expect(onPlaced).toHaveBeenCalledTimes(1));
    expect(setup.bodies('/commit')).toEqual([{ signals: {}, answers: [{ topicId: 't-1', selectedIndex: 1 }], chosenFrontier: 24, startFromBeginning: false }]);
  });

  it('offers no earlier start when the path already starts at the beginning, and names a prerequisite stop plainly', async () => {
    const setup = core({ steps: [done(0)] });
    start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    await screen.findByRole('heading', { level: 1, name: 'Your path starts here' });
    expect(screen.queryByRole('button', { name: 'Start earlier' })).toBeNull();

    const capped = core({ steps: [done(12, { cappedByPrerequisite: true })] });
    document.body.innerHTML = '';
    start(capped);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    await screen.findByText('The next topic needs a new skill.');
  });
});

describe('placement flow: the conversational opener (12+, Core decides)', () => {
  it('is offered when Core says so, and its prior and reflection ride into the questions', async () => {
    const setup = core({ intake: ok({ ageAlreadyKnown: true, conversationalIntakeAvailable: true }), steps: [ask('t-1', 'Q1')],
      intakeReply: ok({ available: true, priorFraction: 0.6, reflection: 'You already budget. We start past that.' }) });
    start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    fireEvent.change(await screen.findByLabelText('What I know'), { target: { value: '  I keep a budget  ' } });
    press('Continue');
    await screen.findByRole('heading', { level: 1, name: 'Q1' });
    expect(setup.calls.find((call) => call.method === 'POST' && call.path.endsWith('/intake'))?.body).toEqual({ learnerText: 'I keep a budget', neutralReflection: 'Good to know.' });
    expect(setup.bodies('/step')[0]).toEqual({ signals: { aiPriorFraction: 0.6 }, answers: [] });
    expect(screen.getByText('You already budget. We start past that.')).toBeTruthy();
  });

  it('is never offered below the floor, and an opener that fails is silent', async () => {
    const setup = core({ steps: [ask('t-1', 'Q1')] });
    start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    await screen.findByRole('heading', { level: 1, name: 'Q1' });
    expect(screen.queryByLabelText('What I know')).toBeNull();

    document.body.innerHTML = '';
    const failing = core({ intake: ok({ ageAlreadyKnown: true, conversationalIntakeAvailable: true }), steps: [ask('t-1', 'Q1')], intakeReply: refuse('INTERNAL') });
    start(failing);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    fireEvent.change(await screen.findByLabelText('What I know'), { target: { value: 'something' } });
    press('Continue');
    await screen.findByRole('heading', { level: 1, name: 'Q1' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(failing.bodies('/step')[0]).toEqual({ signals: {}, answers: [] });
  });

  it('can be skipped straight to the questions', async () => {
    const setup = core({ intake: ok({ ageAlreadyKnown: true, conversationalIntakeAvailable: true }), steps: [ask('t-1', 'Q1')] });
    start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    press(await screen.findByRole('button', { name: 'Ask me instead' }).then((button) => button.textContent!));
    await screen.findByRole('heading', { level: 1, name: 'Q1' });
  });
});

describe('placement flow: failures keep the learner where they were', () => {
  it('a step that fails is said, and the same answer sends the same answers again', async () => {
    const setup = core({ steps: [ask('t-1', 'Q1'), refuse('INTERNAL'), ask('t-2', 'Q2', 2)] });
    start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    fireEvent.click(await screen.findByRole('button', { name: /Right/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Not sent. Try again.');
    expect(screen.getByRole('heading', { level: 1, name: 'Q1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Right/ }));
    await screen.findByRole('heading', { level: 1, name: 'Q2' });
    const bodies = setup.bodies('/step');
    expect(bodies[2]).toEqual(bodies[1]);
  });

  it('B.1: a save whose answer was lost keeps the outcome, and pressing it again sends the identical body', async () => {
    const setup = core({ steps: [ask('t-1', 'Q1'), done(12)], commits: [refuse('NETWORK'), ok({ frontier: 12, startLessonId: 'lesson-12', cappedByPrerequisite: false, framing: frame('further_in') })] });
    const onPlaced = start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    fireEvent.click(await screen.findByRole('button', { name: /Right/ }));
    press(await screen.findByRole('button', { name: 'Start here' }).then((button) => button.textContent!));
    expect((await screen.findByRole('alert')).textContent).toContain('Offline. Try again.');
    expect(screen.getByRole('heading', { level: 1, name: 'Your path starts further in' })).toBeTruthy();
    // The outcome says only its basis while the notice needs the words (06 §3.1); the frame is still Core's.
    expect(screen.queryByText('You can go back anytime.')).toBeNull();
    press('Start here');
    await waitFor(() => expect(onPlaced).toHaveBeenCalledWith('lesson-12'));
    const [first, second] = setup.bodies('/commit');
    expect(second).toEqual(first);
  });

  it('a start already stored for this course sends the learner to the course', async () => {
    const setup = core({ commits: [refuse('PLACEMENT_ALREADY_COMPLETE')] });
    const onPlaced = start(setup);
    press(await screen.findByRole('button', { name: 'From the beginning' }).then((button) => button.textContent!));
    await waitFor(() => expect(onPlaced).toHaveBeenCalledWith(null));
  });

  it('the age safeguard ends the flow with a way back', async () => {
    const setup = core({ steps: [refuse('COURSE_AGE_RESTRICTED')] });
    start(setup);
    press(await screen.findByRole('button', { name: 'Start' }).then((button) => button.textContent!));
    await screen.findByRole('heading', { level: 1, name: 'Not open yet' });
    expect(screen.getByRole('link', { name: 'Courses' }).getAttribute('href')).toBe('/learn');
  });

  it('a flow that cannot open says why, and offers a retry when one can help', async () => {
    const notFound = core({ intake: refuse('NOT_FOUND') });
    start(notFound);
    await screen.findByRole('heading', { level: 1, name: 'Course not found' });
    document.body.innerHTML = '';
    const offline = core({ intake: refuse('NETWORK') });
    start(offline);
    await screen.findByRole('heading', { level: 1, name: 'You are offline' });
    await act(async () => { press('Try again'); });
    expect(offline.calls.filter((call) => call.path.endsWith('/intake'))).toHaveLength(2);
  });
});

describe('placement flow: accompaniment', () => {
  it("shows the learner's own Mentor, a real-model render, and no character before one is chosen", async () => {
    start(core());
    await screen.findByText("I'll ask a few questions. Tell me when you don't know.");
    expect(screen.getByText('Zara')).toBeTruthy();
    expect(document.querySelector('[data-slot="mentor-avatar"] img')?.getAttribute('data-character')).toBe('zara');
    document.body.innerHTML = '';
    start(core(), { mentor: null, locale: 'pt-BR' });
    await screen.findByText('Vou fazer algumas perguntas. Me diga quando não souber.');
    expect(document.querySelector('[data-slot="mentor-avatar"]')).toBeNull();
  });

  it('can always be left without storing anything', async () => {
    const onNavigate = vi.fn();
    const setup = core();
    start(setup, { onNavigate });
    press(await screen.findByRole('button', { name: 'Close' }).then(() => 'Close'));
    expect(onNavigate).toHaveBeenCalledWith('/learn/money-basics');
    expect(setup.bodies('/commit')).toEqual([]);
  });
});
