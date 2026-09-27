import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeIdleMotion, AnswerChoice, Button, Celebration, celebrationPart, CountUp, isMilestone, LoadingState, useIdleMotion, type Milestone } from './controls';
import { BUSY_MOTION_KINDS, resetCelebrationsForTest } from './motion';
import { LessonResultView } from '../learning/LessonResultView';

/*
 * S03.7 motion patterns (Frontend Bible 02 §9.1, §9.2, §9.4; 04 §3; 07 §5).
 * CSS decides whether anything travels; these tests pin the states the
 * components expose, the idle budget and the closed celebration list.
 */

function preferMotion(allowed: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true, writable: true,
    value: (query: string) => ({
      matches: query.includes('no-preference') ? allowed : query.includes('reduce') ? !allowed : false,
      media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => { preferMotion(true); resetCelebrationsForTest(); });
afterEach(() => { Reflect.deleteProperty(window, 'matchMedia'); });

describe('armed bump (02 §9.1)', () => {
  it('bumps once when a disabled button becomes usable, never on first render', () => {
    const { rerender } = render(<Button variant="accent" disabled>Check</Button>);
    const button = screen.getByRole('button', { name: 'Check' });
    expect(button).not.toHaveClass('lf-button--armed');
    rerender(<Button variant="accent">Check</Button>);
    expect(button).toHaveClass('lf-button--armed');
    fireEvent.animationEnd(button, { animationName: 'lf-armed-bump' });
    expect(button).not.toHaveClass('lf-button--armed');
    rerender(<Button variant="accent" disabled>Check</Button>);
    rerender(<Button variant="accent">Check</Button>);
    expect(button).toHaveClass('lf-button--armed');
  });

  it('bumps when a pending request settles, and a usable button that stays usable never bumps', () => {
    const { rerender } = render(<Button variant="success" pending pendingLabel="Saving…">Save</Button>);
    rerender(<Button variant="success">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('lf-button--armed');
    const { container } = render(<Button>Back</Button>);
    expect(container.querySelector('.lf-button--armed')).toBeNull();
  });
});

describe('idle-motion budget (02 §9.4)', () => {
  it('lets exactly one accent call to action breathe and refuses a second one', () => {
    render(<><Button variant="accent" breathing>Continue</Button><Button variant="accent" breathing>Start</Button></>);
    const breathing = document.querySelectorAll('.lf-button--breathing');
    expect(breathing).toHaveLength(1);
    expect(breathing[0]).toHaveAttribute('data-idle-motion', 'breathing-cta');
    expect(activeIdleMotion()).toEqual(['breathing-cta']);
  });

  it('never lets a non-accent, disabled or pending button breathe', () => {
    render(<><Button variant="brand" breathing>Open</Button><Button variant="accent" breathing disabled>Check</Button>
      <Button variant="accent" breathing pending pendingLabel="Checking…">Check</Button></>);
    expect(document.querySelectorAll('.lf-button--breathing')).toHaveLength(0);
    expect(activeIdleMotion()).toEqual([]);
  });

  it('hands the slot to the next claimant when the holder leaves', () => {
    const { rerender } = render(<><Button key="a" variant="accent" breathing>First</Button></>);
    rerender(<><Button key="b" variant="accent" breathing>Second</Button></>);
    expect(screen.getByRole('button', { name: 'Second' })).toHaveClass('lf-button--breathing');
  });

  it('lets a refused call to action that stayed on screen breathe once the holder leaves', () => {
    const { rerender } = render(<><Button key="a" variant="accent" breathing>First</Button><Button key="b" variant="accent" breathing>Second</Button></>);
    expect(screen.getByRole('button', { name: 'Second' })).not.toHaveClass('lf-button--breathing');
    rerender(<><Button key="b" variant="accent" breathing>Second</Button></>);
    expect(screen.getByRole('button', { name: 'Second' })).toHaveClass('lf-button--breathing');
    expect(document.querySelectorAll('.lf-button--breathing')).toHaveLength(1);
  });

  it('counts busy motion apart from the three idle slots: a shimmer and a spinner claim none (OD-28, V-04)', () => {
    render(<><Button variant="accent" breathing>Continue</Button><Button variant="accent" pending pendingLabel="Saving…">Save</Button>
      <LoadingState label="Loading…" /></>);
    expect(activeIdleMotion()).toEqual(['breathing-cta']);
    const busy = [...document.querySelectorAll<HTMLElement>('[data-busy-motion]')].map((element) => element.dataset.busyMotion);
    expect(busy.sort()).toEqual([...BUSY_MOTION_KINDS].sort());
    // Busy motion is never also an idle slot, and only a pending button or a loading placeholder carries it.
    expect(document.querySelector('[data-busy-motion][data-idle-motion]')).toBeNull();
    expect(document.querySelector('[data-busy-motion="spinner"]')!.closest('.lf-button--pending[aria-busy="true"]')).not.toBeNull();
    expect(document.querySelector('[data-busy-motion="shimmer"]')).toHaveClass('lf-skeleton');
  });

  it('caps idle loops at three: one hero, one streak flame, one breathing call to action', () => {
    function Idle({ kind }: { kind: 'hero' | 'streak-flame' | 'breathing-cta' }) {
      const granted = useIdleMotion(kind);
      return <span data-kind={kind} data-granted={granted ? 'yes' : 'no'} />;
    }
    render(<>{(['hero', 'streak-flame', 'breathing-cta', 'hero', 'streak-flame', 'breathing-cta'] as const).map((kind, index) => <Idle key={index} kind={kind} />)}</>);
    expect(document.querySelectorAll('[data-granted="yes"]')).toHaveLength(3);
    expect(activeIdleMotion()).toEqual(['hero', 'streak-flame', 'breathing-cta']);
  });
});

describe('answer feedback grammar (02 §9.2)', () => {
  it('bumps on select, bumps again on correct and wobbles on not yet', () => {
    const { rerender } = render(<AnswerChoice label="Save" selected={false} onSelect={vi.fn()} />);
    const row = screen.getByRole('button', { name: /Save/ });
    expect(row.className).toBe('lf-choice');
    rerender(<AnswerChoice label="Save" selected onSelect={vi.fn()} />);
    expect(row).toHaveClass('lf-choice--bump');
    fireEvent.animationEnd(row, { animationName: 'lf-select-bump' });
    expect(row).not.toHaveClass('lf-choice--bump');
    rerender(<AnswerChoice label="Save" selected onSelect={vi.fn()} verdict="correct" />);
    expect(row).toHaveClass('lf-choice--bump');
    rerender(<AnswerChoice label="Spend" selected={false} onSelect={vi.fn()} />);
    rerender(<AnswerChoice label="Spend" selected onSelect={vi.fn()} verdict="retry" />);
    expect(row).toHaveClass('lf-choice--wobble');
    expect(row.className).not.toMatch(/celebrat/);
  });
});

describe('milestone-only celebration (D7, OD-7, 07 §5)', () => {
  it('knows only the closed milestone list', () => {
    for (const event of ['lesson-complete', 'course-complete', 'savings-goal-reached', 'badge-earned', 'streak-7', 'streak-30', 'streak-100']) expect(isMilestone(event)).toBe(true);
    for (const event of ['correct-answer', 'coin-split', 'streak-8', 'task-approved', 'login']) expect(isMilestone(event)).toBe(false);
  });

  it('celebrates a milestone once per moment and settles', () => {
    vi.useFakeTimers();
    try {
      const pop = celebrationPart('pop');
      const first = render(<Celebration milestone="lesson-complete" momentId="completion-1"><img alt="" className={pop.className} /></Celebration>);
      const root = first.container.querySelector('.lf-celebration')!;
      expect(root).toHaveAttribute('data-celebration', 'playing');
      expect(root).toHaveClass('lf-celebration--play');
      act(() => { vi.advanceTimersByTime(1300); });
      expect(root).toHaveAttribute('data-celebration', 'settled');
      expect(root).not.toHaveClass('lf-celebration--play');
      first.unmount();
      const again = render(<Celebration milestone="lesson-complete" momentId="completion-1"><span /></Celebration>);
      expect(again.container.querySelector('.lf-celebration')).toHaveAttribute('data-celebration', 'static');
    } finally { vi.useRealTimers(); }
  });

  it('shows the static final frame with reduced motion, and refuses anything off the list', () => {
    preferMotion(false);
    const { container } = render(<Celebration milestone="badge-earned" momentId="badge-1"><CountUp value={120} format={(value) => `+${value}`} /></Celebration>);
    expect(container.querySelector('.lf-celebration')).toHaveAttribute('data-celebration', 'static');
    expect(screen.getByText('+120')).toBeTruthy();
    preferMotion(true);
    const refused = render(<Celebration milestone={'correct-answer' as Milestone} momentId="x"><span>ok</span></Celebration>);
    const root = refused.container.querySelector('.lf-celebration')!;
    expect(root).toHaveAttribute('data-refused', 'true');
    expect(root).toHaveAttribute('data-celebration', 'refused');
    expect(root).not.toHaveClass('lf-celebration--play');
  });

  it('counts up from zero only while it plays, with a width reserved for the final value', () => {
    const { container } = render(<Celebration milestone="lesson-complete" momentId="completion-2"><CountUp value={75} format={(value) => `${value}%`} /></Celebration>);
    const counter = container.querySelector<HTMLElement>('.lf-count-up')!;
    expect(counter.textContent).toBe('0%');
    expect(counter.style.minInlineSize).toBe('3ch');
  });

  it('never counts outside a playing milestone celebration (a counting reward is a celebration effect)', () => {
    const alone = render(<CountUp value={40} format={(value) => `+${value}`} />);
    expect(alone.container.querySelector('.lf-count-up')!.textContent).toBe('+40');
    alone.unmount();
    const refused = render(<Celebration milestone={'correct-answer' as Milestone} momentId="y"><CountUp value={40} format={(value) => `+${value}`} /></Celebration>);
    expect(refused.container.querySelector('.lf-count-up')!.textContent).toBe('+40');
  });

  it('celebrates lesson complete on the result screen, and its continue action is the one breathing call to action', () => {
    const receipt = { schema_version: 2, completion_id: 'completion-3', lesson_id: 'lesson-1', version_id: 'rev-1', locale: 'en-US', first_try_correct: 3,
      graded_count: 4, awarded_xp: 30, duration_seconds: 95, previous_best_percent: 50, celebrations: ['lesson-complete'] };
    // B.20 (S05.3e): the screen celebrates only what Core named; without Core's list nothing plays.
    const plain = render(<LessonResultView rawReceipt={{ ...receipt, completion_id: 'completion-4', celebrations: undefined }} locale="en-US" onContinue={vi.fn()} />);
    expect(plain.container.querySelector('.lf-celebration, [class*="lf-celebration-"]')).toBeNull();
    plain.unmount();
    render(<LessonResultView rawReceipt={receipt} locale="en-US" onContinue={vi.fn()} />);
    const root = document.querySelector('.lf-celebration')!;
    expect(root).toHaveAttribute('data-milestone', 'lesson-complete');
    expect(root).toHaveAttribute('data-celebration', 'playing');
    expect(document.querySelectorAll('.lf-celebration-rise')).toHaveLength(4);
    expect(document.querySelector('.lf-result-medal')).toHaveClass('lf-celebration-pop');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('lf-button--breathing');
  });
});
