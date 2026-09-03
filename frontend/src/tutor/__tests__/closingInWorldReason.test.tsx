import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClosingInWorld } from '../ClosingInWorld';

/*
 * Found by adversarial review, round 33, 2026-08-30 (MEDIUM/HIGH): this
 * component ignored WHY the session ended, so a session the safety
 * classifier stopped — the tutor's own last line just told the child "I am
 * stopping our lesson here so you can [go tell a grown-up]" — was followed
 * by the IDENTICAL cheerful "See you soon! Saved. You can listen again any
 * time." as an ordinary satisfied completion. No test existed for this
 * component before this file.
 */

vi.mock('../stage/StageShell', () => ({ useStageDock: () => null }));
vi.mock('../SessionHistory', () => ({ SessionHistory: () => null }));

const NOOP = () => {};

describe('ClosingInWorld says something different for a safety stop', () => {
  it('never shows the cheerful goodbye when the session was safety-stopped', () => {
    render(<ClosingInWorld onStartAnother={NOOP} token="tok" onReplay={NOOP} closedReason="safety_stop" />);

    expect(screen.queryByText('See you soon!')).toBeNull();
    expect(screen.queryByText('Saved. You can listen again any time.')).toBeNull();
    expect(screen.getByText('We stopped here')).toBeInTheDocument();
    expect(screen.getByText('Go find that grown-up now.')).toBeInTheDocument();
  });

  it('still shows the ordinary cheerful goodbye for a completed session', () => {
    render(<ClosingInWorld onStartAnother={NOOP} token="tok" onReplay={NOOP} closedReason="completed" />);

    expect(screen.getByText('See you soon!')).toBeInTheDocument();
    expect(screen.getByText('Saved. You can listen again any time.')).toBeInTheDocument();
    expect(screen.queryByText('We stopped here')).toBeNull();
  });

  it('still shows the ordinary cheerful goodbye when no reason has arrived yet', () => {
    render(<ClosingInWorld onStartAnother={NOOP} token="tok" onReplay={NOOP} closedReason={null} />);

    expect(screen.getByText('See you soon!')).toBeInTheDocument();
  });

  it('still shows the ordinary cheerful goodbye for a budget close — only a safety stop changes the tone', () => {
    render(<ClosingInWorld onStartAnother={NOOP} token="tok" onReplay={NOOP} closedReason="hard_budget" />);

    expect(screen.getByText('See you soon!')).toBeInTheDocument();
  });
});

/*
 * Class V (migration 0069): the goodbye's second archive slot, mirroring
 * `OfferChips.tsx`'s own "Past conversations" / "My progress" pair and the
 * SAME mutual-exclusion wiring — unexercised here until now.
 */
describe('ClosingInWorld — the "My progress" chip added alongside "Past conversations"', () => {
  it('opens the plan/notebook panel (not the history list) and closes the other toggle', () => {
    render(<ClosingInWorld onStartAnother={NOOP} token="tok" onReplay={NOOP} closedReason="completed" />);

    const history = screen.getByRole('button', { name: 'Past conversations' });
    const planner = screen.getByRole('button', { name: 'My progress' });
    expect(planner).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      history.click();
    });
    expect(history).toHaveAttribute('aria-expanded', 'true');

    act(() => {
      planner.click();
    });
    expect(planner).toHaveAttribute('aria-expanded', 'true');
    expect(history).toHaveAttribute('aria-expanded', 'false');
    // The history sheet's own static heading is gone: the OTHER branch of
    // the `historyOpen ? ... : <PlanNotebookPanel />` ternary rendered.
    expect(screen.queryByText('Your past conversations')).toBeNull();

    act(() => {
      history.click();
    });
    expect(history).toHaveAttribute('aria-expanded', 'true');
    expect(planner).toHaveAttribute('aria-expanded', 'false');
  });

  it('offers neither toggle when there is no token — the archive is not offered broken', () => {
    render(<ClosingInWorld onStartAnother={NOOP} token={null} onReplay={NOOP} closedReason="completed" />);

    expect(screen.queryByRole('button', { name: 'Past conversations' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'My progress' })).toBeNull();
  });
});
