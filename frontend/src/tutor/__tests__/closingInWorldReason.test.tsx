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
 * ONE ARCHIVE, TWO SECTIONS (2026-09-12).
 *
 * This used to be two chips — "Past conversations" and "My progress" — sharing
 * one sheet and clearing each other's boolean by hand, the same arrangement
 * `OfferChips` had in a second place. What these tests asserted was that the
 * hand-wiring worked.
 *
 * The invariant they were protecting is now STRUCTURAL rather than coordinated:
 * there is one disclosure holding both lists as sections, so "only one archive
 * surface is open" cannot be false. What is worth testing at this call site is
 * what remains a decision — that the door exists, opens, and is not offered at
 * all without a token.
 */
describe('ClosingInWorld — the archive', () => {
  it('opens one panel holding both the conversations and the progress notebook', () => {
    render(<ClosingInWorld onStartAnother={NOOP} token="tok" onReplay={NOOP} closedReason="completed" />);

    const archive = screen.getByRole('button', { name: 'What we did' });
    expect(archive).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      archive.click();
    });

    expect(archive).toHaveAttribute('aria-expanded', 'true');
    // Both sections, at once, with nothing to choose between them.
    expect(screen.getByRole('heading', { name: 'Your past conversations' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My progress' })).toBeInTheDocument();
  });

  it('offers neither toggle when there is no token — the archive is not offered broken', () => {
    render(<ClosingInWorld onStartAnother={NOOP} token={null} onReplay={NOOP} closedReason="completed" />);

    expect(screen.queryByRole('button', { name: 'What we did' })).toBeNull();
  });
});
