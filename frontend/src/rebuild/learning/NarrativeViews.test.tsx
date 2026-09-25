import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type CopyRole, type Locale } from '../design/copyBudget';
import { DecisionJournalView, decisionJournalCopy } from './DecisionJournalView';
import { NarrativeRecallView, narrativeRecallCopy } from './NarrativeRecallView';
import { LearnerNarrativeShortcut } from './LearnerNarrativeShortcut';
import { answerSelfBridge, clearJournal, fetchJournal, fetchSelfBridges, parseNarrativeRecall, type NarrativeTransport } from './narrative';
import { journalFixture, journalPreviewStates, recallFixture } from './narrativeFixtures';

const locales: Locale[] = ['en-US', 'es-MX', 'pt-BR'];
const FORBIDDEN = /\bTutor\b|\bbot\b|assistant|asistente|assistente|\blives?\b|\bvidas?\b|\bmoney\b|\bdinero\b|\bdinheiro\b|streak freeze/i;

function strings(copy: Record<string, unknown>): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(copy)) {
    if (typeof value === 'string') out.push([key, value]);
    else if (value && typeof value === 'object') for (const [sub, text] of Object.entries(value as Record<string, string>)) out.push([`${key}.${sub}`, text]);
  }
  return out;
}

describe('narrative copy (B.9, B.13)', () => {
  const recallRole = (key: string): CopyRole => (['next', 'happened', 'hide'].includes(key) ? 'action' : key === 'heading' ? 'heading' : key === 'reflect' ? 'prompt' : 'body');
  const journalRole = (key: string): CopyRole => {
    if (['back', 'retry', 'more', 'clear', 'clearYes', 'clearNo', 'tryIt', 'notNow'].includes(key)) return 'action';
    if (['title', 'loading', 'errorTitle', 'emptyTitle', 'bridgeTitle'].includes(key)) return 'heading';
    return 'body';
  };

  it.each(locales)('every recall and journal string meets the youngest (6–9) Copy Budget in %s, with the glossary', (locale) => {
    for (const [key, text] of strings(narrativeRecallCopy[locale])) {
      expect(checkCopy(text, recallRole(key), { locale, ageBand: '6-9', surface: 'app' }), `${locale} ${key}: ${text}`).toEqual([]);
      expect(text, key).not.toMatch(FORBIDDEN);
    }
    for (const [key, text] of strings(decisionJournalCopy[locale])) {
      expect(checkCopy(text, journalRole(key.split('.')[0]!), { locale, ageBand: '6-9', surface: 'app' }), `${locale} ${key}: ${text}`).toEqual([]);
      expect(text, key).not.toMatch(FORBIDDEN);
    }
  });

  it.each(locales)('the fixture snapshots fit the narrative budget Core enforces in %s', (locale) => {
    const recall = recallFixture(locale);
    for (const text of [recall.situation, recall.choice, recall.first_choice!, recall.outcome!]) {
      expect(checkCopy(text, 'narrative', { locale, ageBand: '6-9', surface: 'app' }), text).toEqual([]);
    }
  });
});

describe('narrative client', () => {
  it('accepts a recall only in the exact shape Core sends, and treats anything else as no recall', () => {
    expect(parseNarrativeRecall(recallFixture('en-US'))).not.toBeNull();
    expect(parseNarrativeRecall(undefined)).toBeNull();
    expect(parseNarrativeRecall({ ...recallFixture('en-US'), situation: '' })).toBeNull();
    expect(parseNarrativeRecall({ ...recallFixture('en-US'), relevance: 'guess' })).toBeNull();
    expect(parseNarrativeRecall({ ...recallFixture('en-US'), choice: 'x'.repeat(281) })).toBeNull();
  });

  it('loads the journal and any self prompt, and a failed prompt read leaves the journal usable', async () => {
    const fixture = journalFixture('en-US', true);
    if (fixture.status !== 'ready') throw new Error('fixture');
    const request = vi.fn<NarrativeTransport>(async (path) => path.startsWith('/learn/journal')
      ? { data: { entries: fixture.entries, hasMore: true }, error: null }
      : { data: { prompts: fixture.bridges }, error: null });
    expect(await fetchJournal(request)).toMatchObject({ status: 'ready', hasMore: true, bridges: [{ id: 'bridge-1' }] });
    expect(request).toHaveBeenCalledWith('/learn/journal?limit=10&offset=0', undefined);
    const failingBridges = vi.fn<NarrativeTransport>(async (path) => path.startsWith('/learn/journal')
      ? { data: { entries: fixture.entries, hasMore: false }, error: null }
      : { data: null, error: { code: 'DATA_UNAVAILABLE' } });
    expect(await fetchJournal(failingBridges)).toMatchObject({ status: 'ready', bridges: [] });
    expect(await fetchJournal(vi.fn<NarrativeTransport>(async () => ({ data: { entries: [{ id: 'x' }], hasMore: false }, error: null })))).toEqual({ status: 'error' });
    expect(await fetchJournal(vi.fn<NarrativeTransport>(async () => { throw new Error('offline'); }))).toEqual({ status: 'error' });
  });

  it('clears and answers through Core, mapping a closed prompt apart from a failure', async () => {
    const ok = vi.fn<NarrativeTransport>(async () => ({ data: {}, error: null }));
    expect(await clearJournal(ok)).toBe(true);
    expect(ok).toHaveBeenCalledWith('/learn/journal', { method: 'DELETE' });
    expect(await answerSelfBridge(ok, 'a b', 'act')).toBe('done');
    expect(ok).toHaveBeenLastCalledWith('/learn/bridges/a%20b/act', { method: 'POST', body: {} });
    expect(await answerSelfBridge(vi.fn<NarrativeTransport>(async () => ({ data: null, error: { code: 'BRIDGE_CLOSED' } })), 'x', 'dismiss')).toBe('closed');
    expect(await answerSelfBridge(vi.fn<NarrativeTransport>(async () => ({ data: null, error: { code: 'DATA_UNAVAILABLE' } })), 'x', 'act')).toBe('error');
  });
});

describe('the recall screen', () => {
  it('leads with the situation and the choice; what happened and a changed mind are one tap away; then continues', () => {
    const onContinue = vi.fn();
    render(<NarrativeRecallView recall={recallFixture('en-US')} locale="en-US" dark={false} onContinue={onContinue} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Remember this?' })).toBeTruthy();
    expect(screen.getByText('What price brings me closer to the guitar?')).toBeTruthy();
    expect(screen.getByText('10 coins, double the price')).toBeTruthy();
    expect(screen.queryByText('5 coins, the usual price')).toBeNull();
    const more = screen.getByRole('button', { name: 'What happened' });
    fireEvent.click(more);
    expect(screen.getByRole('button', { name: 'Hide it' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('5 coins, the usual price')).toBeTruthy();
    expect(screen.getByText('Two neighbors buy. Liruf earns 16 coins toward the guitar.')).toBeTruthy();
    expect(screen.getByText('The lemonade stand')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('declares a copy role on every text node, and never shows a score', () => {
    const { container } = render(<NarrativeRecallView recall={recallFixture('pt-BR', false)} locale="pt-BR" dark onContinue={() => {}} />);
    for (const el of container.querySelectorAll('h1, p, span, button')) {
      if (el.children.length === 0 && el.textContent?.trim()) expect(el.closest('[data-copy-role]'), el.textContent).not.toBeNull();
    }
    expect(container.textContent).not.toMatch(/\d+ ?%|score|puntos|pontos/i);
    expect(screen.queryByText('Na primeira vez')).toBeNull();
  });
});

describe('the decision journal', () => {
  const noopClear = async () => true;
  const noopBridge = async () => 'done' as const;

  it('lists decisions with what happened and a changed mind, and pages on request', () => {
    const onMore = vi.fn();
    render(<DecisionJournalView state={journalFixture('en-US', false)} locale="en-US" dark={false} onBack={() => {}} onMore={onMore} onClear={noopClear} onBridge={noopBridge} />);
    expect(screen.getByRole('heading', { level: 1, name: 'My decisions' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('Two neighbors buy. Liruf earns 16 coins toward the guitar.')).toBeNull();
    const first = screen.getAllByRole('button', { name: /You chose/ })[0]!;
    fireEvent.click(first);
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('What price brings me closer to the guitar?')).toBeTruthy();
    expect(screen.getByText('Two neighbors buy. Liruf earns 16 coins toward the guitar.')).toBeTruthy();
    expect(screen.getByText('5 coins, the usual price')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Try it for real' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(onMore).toHaveBeenCalledOnce();
  });

  it('clears only after a confirmation, and says so', async () => {
    const onClear = vi.fn(async () => true);
    render(<DecisionJournalView state={journalFixture('en-US', false)} locale="en-US" dark={false} onBack={() => {}} onClear={onClear} onBridge={noopBridge} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear journal' }));
    expect(onClear).not.toHaveBeenCalled();
    expect(screen.getByText('This removes your saved choices. Your progress stays.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear journal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, clear' }));
    await screen.findByText('Your journal is empty now.');
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('keeps the entries and reports a failed clear', async () => {
    render(<DecisionJournalView state={journalFixture('en-US', false)} locale="en-US" dark={false} onBack={() => {}} onClear={async () => false} onBridge={noopBridge} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear journal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, clear' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not clear it. Try again.');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('an independent teen answers "try it for real": a plan, a dismissal, or a closed idea', async () => {
    const onBridge = vi.fn(async (_id: string, answer: 'act' | 'dismiss') => (answer === 'act' ? 'done' as const : 'done' as const));
    const { unmount } = render(<DecisionJournalView state={journalFixture('en-US', true)} locale="en-US" dark={false} onBack={() => {}} onClear={noopClear} onBridge={onBridge} />);
    const card = screen.getByRole('article', { name: 'Try it for real' });
    expect(within(card).getByText('Saving toward a goal')).toBeTruthy();
    expect(within(card).getByText('Pick something real to save for this month.')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'I will try' }));
    await screen.findByText('Saved as your plan.');
    expect(onBridge).toHaveBeenCalledWith('bridge-1', 'act');
    unmount();
    render(<DecisionJournalView state={journalFixture('en-US', true)} locale="en-US" dark={false} onBack={() => {}} onClear={noopClear} onBridge={onBridge} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Try it for real' })).toBeNull());
  });

  it('has an empty state, a loading state and a retry only on error', () => {
    const states = journalPreviewStates('es-MX');
    const onRetry = vi.fn();
    const { rerender } = render(<DecisionJournalView state={states.empty!} locale="es-MX" dark={false} onBack={() => {}} onRetry={onRetry} onClear={noopClear} onBridge={noopBridge} />);
    expect(screen.getByRole('heading', { name: 'Aún no hay decisiones' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Borrar diario' })).toBeNull();
    rerender(<DecisionJournalView state={states.loading!} locale="es-MX" dark={false} onBack={() => {}} onRetry={onRetry} onClear={noopClear} onBridge={noopBridge} />);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    rerender(<DecisionJournalView state={states.error!} locale="es-MX" dark={false} onBack={() => {}} onRetry={onRetry} onClear={noopClear} onBridge={noopBridge} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('the learner shortcut (B.9 entry, B.13 Option B)', () => {
  const teenBridges = () => {
    const fixture = journalFixture('en-US', true);
    if (fixture.status !== 'ready') throw new Error('fixture');
    return fixture.bridges;
  };

  it('reads only the self prompts, and an unavailable or malformed read is no prompt, never an error', async () => {
    const ok = vi.fn<NarrativeTransport>(async () => ({ data: { prompts: teenBridges() }, error: null }));
    expect(await fetchSelfBridges(ok)).toHaveLength(1);
    expect(ok).toHaveBeenCalledWith('/learn/bridges', undefined);
    expect(await fetchSelfBridges(vi.fn<NarrativeTransport>(async () => ({ data: null, error: { code: 'DATA_UNAVAILABLE' } })))).toEqual([]);
    expect(await fetchSelfBridges(vi.fn<NarrativeTransport>(async () => ({ data: { prompts: [{ id: 'x', action: 'buy_now' }] }, error: null })))).toEqual([]);
    expect(await fetchSelfBridges(vi.fn<NarrativeTransport>(async () => { throw new Error('offline'); }))).toEqual([]);
  });

  it('any learner without a prompt sees only the link to their journal', () => {
    const onOpen = vi.fn();
    render(<LearnerNarrativeShortcut bridges={[]} locale="es-MX" dark={false} onOpenJournal={onOpen} onBridge={async () => 'done'} />);
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mis decisiones' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('an independent teen answers the prompt where they already are; the answer creates nothing on the client', async () => {
    const onBridge = vi.fn(async () => 'done' as const);
    const { container } = render(<LearnerNarrativeShortcut bridges={teenBridges()} locale="pt-BR" dark onOpenJournal={() => {}} onBridge={onBridge} />);
    const card = screen.getByRole('article', { name: 'Tente de verdade' });
    fireEvent.click(within(card).getByRole('button', { name: 'Vou tentar' }));
    await screen.findByText('Salvo como seu plano.');
    expect(onBridge).toHaveBeenCalledWith('bridge-1', 'act');
    for (const el of container.querySelectorAll('h2, p, span, button')) {
      if (el.children.length === 0 && el.textContent?.trim()) expect(el.closest('[data-copy-role]'), el.textContent).not.toBeNull();
    }
    expect(container.querySelector('[data-theme="dark"]')).not.toBeNull();
  });
});
