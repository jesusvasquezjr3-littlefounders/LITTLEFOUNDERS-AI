import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LiveSegmentState } from '../../session/useTutorSocket';
import { LiveActivity, type ActivityGrade } from '../LiveActivity';
import { activityView, answerOf, emptyDraft, parseNumber, plainText, traySum, type ActivityDraft } from '../liveActivityModel';
import { mentorCopy } from '../MentorRoute';

/*
 * W2M.4 (T1c): the live activity on the Mentor screen. The model reads the
 * segment types the Mentor serves into the grader's own answer shapes
 * (backend/src/lesson-contract/families/*); the component grades through Core,
 * keeps a first miss as "not yet", closes on the second attempt, and lets the
 * Mentor's demonstration move the open tray.
 */
const copy = mentorCopy('en-US').mentorScreen.activityUi;

const live = (segment: Record<string, unknown>, overrides: Partial<LiveSegmentState> = {}): LiveSegmentState =>
  ({ segmentId: 'seg-1', seq: 4, origin: 'catalog', segment, scoresXp: true, framing: '', ...overrides });

const grade = (overrides: Partial<ActivityGrade> = {}): ActivityGrade =>
  ({ correct: true, score: 100, feedback: null, xpAwarded: 10, scoresXp: true, pedagogy: { echo: 'signed' }, ...overrides });

afterEach(() => { vi.useRealTimers(); });

describe('the activity model reads what the Mentor serves, in the grader’s shapes', () => {
  const answer = (segment: Record<string, unknown>, draft: Partial<ActivityDraft>) => {
    const view = activityView(segment)!;
    return answerOf(view, { ...emptyDraft(view), ...draft } as ActivityDraft);
  };

  it('choices answer with the id the grader reads for their type', () => {
    const options = [{ id: 'a', text_md: 'Save **half**' }, { id: 'b', text_md: 'Spend it' }];
    expect(activityView({ type: 'quiz_mcq', payload: { options } })).toMatchObject({ kind: 'choose', options: [{ id: 'a', label: 'Save half' }, { id: 'b', label: 'Spend it' }] });
    expect(answer({ type: 'quiz_mcq', payload: { options } }, { id: 'a' })).toEqual({ option_id: 'a' });
    expect(answer({ type: 'best_decision', payload: { scenario_md: 'You have $10.', options: options.map((o) => ({ ...o, rationale_md: 'x' })) } }, { id: 'b' })).toEqual({ option_id: 'b' });
    expect(answer({ type: 'odd_one_out', payload: { items: [...options, { id: 'c', text_md: 'Share' }] } }, { id: 'c' })).toEqual({ item_id: 'c' });
    expect(answer({ type: 'price_compare', payload: { currency: 'USD', offers: [{ id: 'x', label: 'Small', qty: 1, unit: 'bottle', price: 2 }, { id: 'y', label: 'Big', qty: 3, unit: 'bottles', price: 5 }] } }, { id: 'y' })).toEqual({ offer_id: 'y' });
    expect(answer({ type: 'true_false', payload: { statement_md: 'Saving is spending.' } }, { value: false } as never)).toEqual({ is_true: false });
  });

  it('numbers, words, sliders and the count answer with a value', () => {
    expect(answer({ type: 'number_input', payload: { unit: 'pesos' } }, { text: '12,5' } as never)).toEqual({ value: 12.5 });
    expect(answer({ type: 'count_objects', payload: { scene: [{ icon: 'x', label: 'coins', count: 3 }], ask_icon: 'x', ask_label: 'coins' } }, { text: '3' } as never)).toEqual({ value: 3 });
    expect(answer({ type: 'type_answer', payload: { max_chars: 20 } }, { text: '  budget ' } as never)).toEqual({ text: 'budget' });
    expect(answer({ type: 'estimate_slider', payload: { min: 0, max: 100, step: 5, scale: 'linear' } }, { value: 35 } as never)).toEqual({ value: 35 });
    expect(parseNumber('1 200')).toBe(1200);
    expect(parseNumber('abc')).toBeNull();
  });

  it('an order, a pick, the tray, the blanks and the weeks answer in their grader’s shape, and only when complete', () => {
    const items = [{ id: 'a', text_md: 'Plan' }, { id: 'b', text_md: 'Save' }, { id: 'c', text_md: 'Buy' }];
    expect(answer({ type: 'order_steps', payload: { items } }, { order: ['a', 'b'] } as never)).toBeNull();
    expect(answer({ type: 'order_steps', payload: { items } }, { order: ['a', 'b', 'c'] } as never)).toEqual({ order: ['a', 'b', 'c'] });
    expect(answer({ type: 'timeline_order', payload: { events: items } }, { order: ['c', 'b', 'a'] } as never)).toEqual({ order: ['c', 'b', 'a'] });
    expect(answer({ type: 'needs_wants', payload: { items: [...items, { id: 'd', text_md: 'Toy' }] } }, { ids: ['a'] } as never)).toEqual({ needs_ids: ['a'] });
    expect(answer({ type: 'budget_fit', payload: { budget: 10, currency: 'USD', items: items.map((i) => ({ id: i.id, label: i.text_md, icon: 'x', price: 3 })) } }, { ids: ['a', 'b'] } as never)).toEqual({ selected_ids: ['a', 'b'] });
    expect(answer({ type: 'coin_count', payload: { currency: 'MXN', denominations: [5, 1, 2], target: 8 } }, { picked: [5, 2, 1] } as never)).toEqual({ picked: [5, 2, 1] });
    expect(activityView({ type: 'make_change', payload: { currency: 'MXN', denominations: [1, 5], price: 7, paid_with: 10 } })).toMatchObject({ kind: 'tray', price: 7, paidWith: 10, denominations: [1, 5] });
    const blanks = { type: 'fill_blank', payload: { text_md: 'Money you keep is {{1}}; money you use is {{2}}.', mode: 'typed' } };
    expect(answer(blanks, { gaps: { 1: 'saving' } } as never)).toBeNull();
    expect(answer(blanks, { gaps: { 1: 'saving', 2: ' spending ' } } as never)).toEqual({ gaps: { 1: 'saving', 2: 'spending' } });
    expect(answer({ type: 'savings_goal', payload: { goal: 20, currency: 'USD', weekly_options: [5, 10] } }, { weeks: { 5: '4', 10: '2' } } as never)).toEqual({ weeks: { 5: 4, 10: 2 } });
    expect(traySum([0.1, 0.2])).toBe(0.3);
  });

  it('returns null for a type it does not draw, so the learner answers in words', () => {
    expect(activityView({ type: 'memory_flip', payload: { pairs: [] } })).toBeNull();
    expect(activityView({ type: 'true_false', payload: { statement_md: 'x', justifications: [{ id: 'a', text_md: 'y' }, { id: 'b', text_md: 'z' }] } })).toBeNull();
    expect(activityView({ type: 'quiz_mcq' })).toBeNull();
    expect(plainText('[a link](https://x) and `code`')).toBe('a link and code');
  });
});

describe('the live activity on the stage (T1c)', () => {
  const quiz = { type: 'quiz_mcq', prompt_md: 'What is saving?', payload: { options: [{ id: 'a', text_md: 'Keeping money' }, { id: 'b', text_md: 'Spending money' }] } };

  it('grades through Core and finishes on a right answer', async () => {
    const onDone = vi.fn();
    const check = vi.fn(async () => grade());
    render(<LiveActivity live={live(quiz)} copy={copy} locale="en-US" headingId="h" grade={check} onDone={onDone} demo={null} />);
    expect(screen.getByRole('heading', { name: copy.heading })).toBeInTheDocument();
    expect(screen.getByText('What is saving?')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: copy.check });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Keeping money/u }));
    fireEvent.click(submit);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ segmentId: 'seg-1', attempt: 1, correct: true, score: 100 })));
    expect(check).toHaveBeenCalledWith('seg-1', { option_id: 'a' }, 1);
  });

  it('keeps a first miss as "not yet" with Core’s reason, and closes on the second attempt either way', async () => {
    const onDone = vi.fn();
    const check = vi.fn(async () => grade({ correct: false, score: 0, feedback: 'Spending is using it.' }));
    render(<LiveActivity live={live(quiz)} copy={copy} locale="en-US" headingId="h" grade={check} onDone={onDone} demo={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Spending money/u }));
    fireEvent.click(screen.getByRole('button', { name: copy.check }));
    expect(await screen.findByText(`${copy.notYet} Spending is using it.`)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: copy.check }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ attempt: 2, correct: false })));
    expect(check).toHaveBeenLastCalledWith('seg-1', { option_id: 'b' }, 2);
  });

  it('a failed check keeps the answer and says so; it is never a wrong answer', async () => {
    const onDone = vi.fn();
    render(<LiveActivity live={live(quiz)} copy={copy} locale="en-US" headingId="h" grade={async () => null} onDone={onDone} demo={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Keeping money/u }));
    fireEvent.click(screen.getByRole('button', { name: copy.check }));
    expect(await screen.findByText(copy.failed)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Keeping money/u })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says "practice only" before answering when Core cannot pay XP for it', () => {
    render(<LiveActivity live={live(quiz, { scoresXp: false })} copy={copy} locale="en-US" headingId="h" grade={async () => null} onDone={vi.fn()} demo={null} />);
    expect(screen.getByText(copy.practiceOnly)).toBeInTheDocument();
  });

  it('builds the tray with add and take back, and the Mentor’s demonstration moves it while input is locked', async () => {
    vi.useFakeTimers();
    const tray = { type: 'coin_count', prompt_md: 'Make 8 pesos.', payload: { currency: 'MXN', denominations: [1, 2, 5], target: 8 } };
    const check = vi.fn(async () => grade());
    const { rerender } = render(<LiveActivity live={live(tray)} copy={copy} locale="en-US" headingId="h" grade={check} onDone={vi.fn()} demo={null} />);
    const add = (label: string) => screen.getByRole('button', { name: copy.add.replace('{amount}', label) });
    fireEvent.click(add('MX$5'));
    fireEvent.click(add('MX$2'));
    fireEvent.click(add('MX$2'));
    expect(screen.getByText(copy.inTray.replace('{amount}', 'MX$9'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copy.takeBack.replace('{item}', 'MX$2') }));
    expect(screen.getByText(copy.inTray.replace('{amount}', 'MX$7'))).toBeInTheDocument();

    rerender(<LiveActivity live={live(tray)} copy={copy} locale="en-US" headingId="h" grade={check} onDone={vi.fn()}
      demo={{ seq: 5, steps: [{ kind: 'add', denomination: 1 }, { kind: 'add', denomination: 50 }] }} />);
    expect(screen.getByText(copy.demo)).toBeInTheDocument();
    expect(add('MX$1')).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    // The step naming a coin the tray does not offer is dropped, never applied.
    expect(screen.getByText(copy.inTray.replace('{amount}', 'MX$8'))).toBeInTheDocument();
    expect(add('MX$1')).not.toBeDisabled();
  });

  it('orders by placing each item, and moves a placed one', async () => {
    const order = { type: 'order_steps', payload: { items: [{ id: 'a', text_md: 'Plan' }, { id: 'b', text_md: 'Save' }, { id: 'c', text_md: 'Buy' }] } };
    const check = vi.fn(async () => grade());
    render(<LiveActivity live={live(order)} copy={copy} locale="en-US" headingId="h" grade={check} onDone={vi.fn()} demo={null} />);
    for (const item of ['Save', 'Plan', 'Buy']) fireEvent.click(screen.getByRole('button', { name: copy.place.replace('{item}', item) }));
    fireEvent.click(screen.getByRole('button', { name: copy.moveUp.replace('{item}', 'Plan') }));
    fireEvent.click(screen.getByRole('button', { name: copy.check }));
    await waitFor(() => expect(check).toHaveBeenCalledWith('seg-1', { order: ['a', 'b', 'c'] }, 1));
    await waitFor(() => expect(screen.getByRole('button', { name: copy.check })).not.toHaveAttribute('aria-busy', 'true'));
  });

  it('shows an activity it does not draw as its prompt, answered in words', () => {
    render(<LiveActivity live={live({ type: 'memory_flip', prompt_md: 'Find the pairs.' })} copy={copy} locale="en-US" headingId="h" grade={async () => null} onDone={vi.fn()} demo={null} />);
    expect(screen.getByText('Find the pairs.')).toBeInTheDocument();
    expect(screen.getByText(copy.answer)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.check })).toBeNull();
  });
});
