import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type CopyRole, type Locale } from '../design/copyBudget';
import { DecisionJournalView, SelfBridgeList, decisionJournalCopy, selfGoalFrom } from './DecisionJournalView';
import { NarrativeRecallView, narrativeRecallCopy } from './NarrativeRecallView';
import { LearnerNarrativeShortcut } from './LearnerNarrativeShortcut';
import { answerSelfBridge, clearJournal, fetchJournal, fetchSelfBridges, parseNarrativeRecall, type BridgeAnswer, type NarrativeTransport } from './narrative';
import { journalFixture, journalPreviewStates, recallFixture, selfBridgesFixture } from './narrativeFixtures';

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
    if (['back', 'retry', 'more', 'clear', 'clearYes', 'clearNo', 'tryIt', 'notNow', 'createGoal', 'planOnly'].includes(key)) return 'action';
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
      // OD-27 (3): `tutorSees` names the verified parent, the one thing the glossary calls Tutor; the AI never.
      if (key === 'tutorSees') {
        expect(text).toMatch(/\bTutor\b/);
        expect(text.replace(/\bTutor\b/, '')).not.toMatch(FORBIDDEN);
      } else expect(text, key).not.toMatch(FORBIDDEN);
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
    // OD-28 (L-12): the teen's own goal travels on the act call; a wallet that does not admit them is its own outcome.
    expect(await answerSelfBridge(ok, 'g', 'act', { title: '  Headphones ', target: 300 })).toBe('done');
    expect(ok).toHaveBeenLastCalledWith('/learn/bridges/g/act', { method: 'POST', body: { title: 'Headphones', target: 300 } });
    expect(await answerSelfBridge(ok, 'g', 'dismiss', { title: 'x', target: 1 })).toBe('done');
    expect(ok).toHaveBeenLastCalledWith('/learn/bridges/g/dismiss', { method: 'POST', body: {} });
    expect(await answerSelfBridge(vi.fn<NarrativeTransport>(async () => ({ data: null, error: { code: 'WALLET_UNAVAILABLE' } })), 'g', 'act', { title: 'x', target: 1 })).toBe('no_wallet');
  });
});

describe('an independent teen turns a savings prompt into their own goal (OD-28, L-12)', () => {
  const savings = selfBridgesFixture();
  const earning = [{ ...savings[0]!, id: 'bridge-2', action: 'earning_task' as const }];

  it('"I will try" opens the goal; a valid name and coins create it in the Wallet', async () => {
    const onBridge = vi.fn(async () => 'done' as const);
    render(<SelfBridgeList bridges={savings} locale="en-US" onBridge={onBridge} />);
    fireEvent.click(screen.getByRole('button', { name: 'I will try' }));
    expect(onBridge).not.toHaveBeenCalled();
    const create = screen.getByRole('button', { name: 'Create goal' });
    expect((create as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('What will you save for?'), { target: { value: 'Headphones' } });
    fireEvent.change(screen.getByLabelText('Coins to save'), { target: { value: '0' } });
    expect((create as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Coins to save'), { target: { value: '300' } });
    fireEvent.click(create);
    expect(await screen.findByText('Goal added to your Wallet.')).toBeTruthy();
    expect(onBridge).toHaveBeenCalledWith('bridge-1', 'act', { title: 'Headphones', target: 300 });
  });

  it('"Just a plan" keeps the commitment alone, and a closed Wallet is said with the form kept', async () => {
    const onBridge = vi.fn<BridgeAnswer>(async (_id, _answer, goal) => (goal ? 'no_wallet' : 'done'));
    render(<SelfBridgeList bridges={savings} locale="es-MX" onBridge={onBridge} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lo intentaré' }));
    fireEvent.change(screen.getByLabelText('¿Para qué vas a ahorrar?'), { target: { value: 'Bici' } });
    fireEvent.change(screen.getByLabelText('Monedas por ahorrar'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear meta' }));
    expect(await screen.findByText('Tu Cartera no está abierta.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Solo un plan' }));
    expect(await screen.findByText('Guardado como tu plan.')).toBeTruthy();
    expect(onBridge).toHaveBeenLastCalledWith('bridge-1', 'act', undefined);
  });

  it('an earning prompt records the plan at once and never asks for a goal (tasks stay guardian-only)', async () => {
    const onBridge = vi.fn(async () => 'done' as const);
    render(<SelfBridgeList bridges={earning} locale="pt-BR" onBridge={onBridge} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vou tentar' }));
    expect(await screen.findByText('Salvo como seu plano.')).toBeTruthy();
    expect(onBridge).toHaveBeenCalledWith('bridge-2', 'act', undefined);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('refuses a goal outside the limits Core and the database enforce', () => {
    expect(selfGoalFrom(' Bike ', '10')).toEqual({ title: 'Bike', target: 10 });
    for (const [title, target] of [['', '10'], ['x'.repeat(81), '10'], ['Bike', '0'], ['Bike', '100001'], ['Bike', '2.5'], ['Bike', 'ten']]) {
      expect(selfGoalFrom(title!, target!), `${title}/${target}`).toBeNull();
    }
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
    expect(screen.getAllByText('You chose')).toHaveLength(2);
    const first = screen.getAllByRole('button', { name: 'What happened' })[0]!;
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
    // A savings prompt offers the teen's own goal first (OD-28, L-12); the plan alone is one press away.
    fireEvent.click(within(card).getByRole('button', { name: 'Just a plan' }));
    await screen.findByText('Saved as your plan.');
    expect(onBridge).toHaveBeenCalledWith('bridge-1', 'act', undefined);
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

  it('an independent teen answers the prompt where they already are; the client creates nothing itself', async () => {
    const onBridge = vi.fn(async () => 'done' as const);
    const { container } = render(<LearnerNarrativeShortcut bridges={teenBridges()} locale="pt-BR" dark onOpenJournal={() => {}} onBridge={onBridge} />);
    const card = screen.getByRole('article', { name: 'Tente de verdade' });
    fireEvent.click(within(card).getByRole('button', { name: 'Vou tentar' }));
    for (const el of container.querySelectorAll('h2, p, span, button, label')) {
      if (el.children.length === 0 && el.textContent?.trim()) expect(el.closest('[data-copy-role]'), el.textContent).not.toBeNull();
    }
    fireEvent.click(within(card).getByRole('button', { name: 'Só um plano' }));
    await screen.findByText('Salvo como seu plano.');
    expect(onBridge).toHaveBeenCalledWith('bridge-1', 'act', undefined);
    for (const el of container.querySelectorAll('h2, p, span, button')) {
      if (el.children.length === 0 && el.textContent?.trim()) expect(el.closest('[data-copy-role]'), el.textContent).not.toBeNull();
    }
    expect(container.querySelector('[data-theme="dark"]')).not.toBeNull();
  });
});
