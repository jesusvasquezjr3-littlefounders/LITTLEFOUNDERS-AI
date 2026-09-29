import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type CopyRole, type Locale } from '../design/copyBudget';
import { ChildDecisionsPanel, ChildDecisionsView, childDecisionsCopy } from './ChildDecisionsPanel';
import { fetchChildDecisions, type ChildDecisionsTransport } from './childDecisions';
import { DecisionJournalView, decisionJournalCopy } from './DecisionJournalView';
import { journalFixture } from './narrativeFixtures';

/* OD-27 (3), L-13: the verified Tutor sees an under-13 child's chosen options; a teen's journal stays private. */
const KID = '00000000-0000-4000-8000-000000000101';
const entry = { id: 'e1', courseTitle: 'Money basics', lessonTitle: 'The lemonade stand', situation: 'What price brings me closer to the guitar?',
  choice: '10 coins, double the price', recordedAt: '2026-09-20T10:00:00.000Z' };
const locales: Locale[] = ['en-US', 'es-MX', 'pt-BR'];

describe('the Tutor panel of a child\'s story choices', () => {
  it('reads one page from Core and maps a private journal, a lost link and a lapsed verification to nothing', async () => {
    const request = vi.fn<ChildDecisionsTransport>(async () => ({ data: { locale: 'en-US', entries: [entry], hasMore: true }, error: null }));
    expect(await fetchChildDecisions(request, KID, 10)).toEqual({ status: 'ready', entries: [entry], hasMore: true });
    expect(request).toHaveBeenCalledWith(`/family/learning/kids/${KID}/decisions?limit=10&offset=10`);
    for (const code of ['JOURNAL_PRIVATE', 'NOT_FOUND', 'PARENT_VERIFICATION_REQUIRED', 'FORBIDDEN']) {
      expect(await fetchChildDecisions(async () => ({ data: null, error: { code } }), KID)).toEqual({ status: 'private' });
    }
    expect(await fetchChildDecisions(async () => ({ data: null, error: { code: 'DATA_UNAVAILABLE' } }), KID)).toEqual({ status: 'error' });
    // Anything beyond the minimised entry (an outcome, a first choice) is refused as malformed.
    expect(await fetchChildDecisions(async () => ({ data: { locale: 'en-US', entries: [{ ...entry, outcome: 'x' }], hasMore: false }, error: null }), KID)).toEqual({ status: 'error' });
    expect(await fetchChildDecisions(async () => { throw new Error('offline'); }, KID)).toEqual({ status: 'error' });
  });

  it('shows the choices one press away; a private journal renders nothing at all', async () => {
    const request = vi.fn<ChildDecisionsTransport>(async () => ({ data: { locale: 'en-US', entries: [entry], hasMore: false }, error: null }));
    const { unmount } = render(<ChildDecisionsPanel kidId={KID} locale="en-US" dark={false} transport={request} />);
    const toggle = await screen.findByRole('button', { name: 'See choices' });
    expect(screen.queryByText(entry.choice)).toBeNull();
    fireEvent.click(toggle);
    expect(await screen.findByText(entry.choice)).toBeTruthy();
    expect(screen.getByText(entry.situation)).toBeTruthy();
    expect(screen.getByText('Chose')).toBeTruthy();
    unmount();
    const { container } = render(<ChildDecisionsPanel kidId={KID} locale="en-US" dark transport={async () => ({ data: null, error: { code: 'JOURNAL_PRIVATE' } })} />);
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('declares a copy role on every text and fits the adult budget in every locale', () => {
    const role = (key: string): CopyRole => (['open', 'close', 'retry', 'more'].includes(key) ? 'action' : key === 'title' ? 'heading' : 'body');
    for (const locale of locales) {
      for (const [key, text] of Object.entries(childDecisionsCopy[locale])) {
        expect(checkCopy(text, role(key), { locale, ageBand: 'adult', surface: 'app' }), `${locale} ${key}: ${text}`).toEqual([]);
        expect(text).not.toMatch(/\bbot\b|assistant|asistente|assistente|\bmoney\b|dinero|dinheiro/i);
      }
      const { container, unmount } = render(<ChildDecisionsView state={{ status: 'ready', entries: [entry], hasMore: true }} locale={locale} dark={false} open
        onToggle={() => {}} onRetry={() => {}} onMore={() => {}} />);
      for (const el of container.querySelectorAll('h2, p, span, button')) {
        if (el.children.length === 0 && el.textContent?.trim()) expect(el.closest('[data-copy-role]'), el.textContent).not.toBeNull();
      }
      unmount();
    }
  });
});

describe('the child is told on their own journal', () => {
  it('says the Tutor can see the choices only when Core says so, within the youngest budget', () => {
    const shared = { ...journalFixture('en-US', false), sharedWithTutor: true } as const;
    const { rerender } = render(<DecisionJournalView state={shared} locale="en-US" dark={false} onBack={() => {}} onClear={async () => true} onBridge={async () => 'done'} />);
    expect(screen.getByText('Your Tutor sees your choices.')).toBeTruthy();
    rerender(<DecisionJournalView state={journalFixture('en-US', false)} locale="en-US" dark={false} onBack={() => {}} onClear={async () => true} onBridge={async () => 'done'} />);
    expect(screen.queryByText('Your Tutor sees your choices.')).toBeNull();
    for (const locale of locales) {
      expect(checkCopy(decisionJournalCopy[locale].tutorSees, 'body', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
    }
  });
});
