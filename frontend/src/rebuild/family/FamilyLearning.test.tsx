import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type CopyRole, type Locale } from '../design/copyBudget';
import { LearningBridges, learningBridgesCopy } from './LearningBridges';
import { LearningNarrative, learningNarrativeCopy } from './LearningNarrative';
import { actOnKidBridge, dismissKidBridge, fetchKidBridges, fetchKidNarrative, narrativeEntrySchema, type BridgeResult, type FamilyLearningTransport } from './familyLearning';
import { bridgesFixture, narrativeFixture, narrativePreviewStates } from './familyLearningFixtures';

const locales: Locale[] = ['en-US', 'es-MX', 'pt-BR'];
const FORBIDDEN = /\bbot\b|assistant|asistente|assistente|\blives?\b|\bvidas?\b|\bmoney\b|\bdinero\b|\bdinheiro\b|\bjob\b|streak freeze|\baccept/i;

function strings(copy: Record<string, unknown>): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(copy)) {
    if (typeof value === 'string') out.push([key, value]);
    else if (typeof value === 'function') out.push([key, (value as (a: number, b: number) => string)(12, 34)], [`${key}.one`, (value as (a: number, b: number) => string)(1, 1)]);
    else if (value && typeof value === 'object') for (const [sub, text] of Object.entries(value as Record<string, string>)) out.push([`${key}.${sub}`, text]);
  }
  return out;
}

describe('family learning copy (B.10, B.13)', () => {
  const narrativeRole = (key: string): CopyRole => (['open', 'close', 'retry', 'more'].includes(key) ? 'action' : key === 'title' ? 'heading' : 'body');
  const bridgeRole = (key: string): CopyRole => {
    if (['setUp', 'notNow', 'cancel', 'createGoal', 'createTask', 'retry', 'once', 'weekly'].includes(key)) return 'action';
    if (key === 'title') return 'heading';
    return 'body';
  };
  it.each(locales)('every string meets the adult Copy Budget in %s, uses the glossary, and never names the AI a Tutor', (locale) => {
    for (const [key, text] of strings(learningNarrativeCopy[locale])) {
      expect(checkCopy(text, narrativeRole(key.split('.')[0]!), { locale, ageBand: 'adult', surface: 'app' }), `${locale} ${key}: ${text}`).toEqual([]);
      expect(text, key).not.toMatch(FORBIDDEN);
    }
    for (const [key, text] of strings(learningBridgesCopy[locale])) {
      expect(checkCopy(text, bridgeRole(key.split('.')[0]!), { locale, ageBand: 'adult', surface: 'app' }), `${locale} ${key}: ${text}`).toEqual([]);
      expect(text, key).not.toMatch(FORBIDDEN);
    }
    // Coins, never money.
    expect(learningBridgesCopy[locale].rewardHint).toMatch(/coins|monedas|moedas/);
  });
});

describe('family learning client', () => {
  it('refuses a narrative entry that carries anything beyond the agreed fields, such as a child\'s choice', () => {
    const entry = (narrativeFixture('en-US') as Extract<ReturnType<typeof narrativeFixture>, { status: 'ready' }>).entries[0]!;
    expect(narrativeEntrySchema.safeParse(entry).success).toBe(true);
    expect(narrativeEntrySchema.safeParse({ ...entry, choice: '10 coins' }).success).toBe(false);
    expect(narrativeEntrySchema.safeParse({ ...entry, skills: ['a', 'b', 'c'] }).success).toBe(false);
  });

  it('maps every refusal to its own state and never shows a partial list', async () => {
    const reply = (value: Awaited<ReturnType<FamilyLearningTransport>>) => vi.fn<FamilyLearningTransport>(async () => value);
    const ready = narrativeFixture('en-US') as Extract<ReturnType<typeof narrativeFixture>, { status: 'ready' }>;
    const ok = reply({ data: { locale: 'en-US', week: ready.week, entries: ready.entries, hasMore: false }, error: null });
    expect((await fetchKidNarrative(ok, 'kid 1', 5)).status).toBe('ready');
    expect(ok).toHaveBeenCalledWith('/family/learning/kids/kid%201/narrative?limit=5&offset=5', undefined);
    expect(await fetchKidNarrative(reply({ data: null, error: { code: 'NOT_FOUND' } }), 'k')).toEqual({ status: 'no-access' });
    expect(await fetchKidNarrative(reply({ data: null, error: { code: 'PARENT_VERIFICATION_REQUIRED' } }), 'k')).toEqual({ status: 'no-access' });
    expect(await fetchKidNarrative(reply({ data: null, error: { code: 'DATA_UNAVAILABLE' } }), 'k')).toEqual({ status: 'error' });
    expect(await fetchKidNarrative(reply({ data: { entries: 'x' }, error: null }), 'k')).toEqual({ status: 'error' });
    expect(await fetchKidBridges(reply({ data: { prompts: [{ id: 'p', action: 'buy_stock' }] }, error: null }), 'k')).toEqual({ status: 'error' });
    expect(await fetchKidBridges(vi.fn<FamilyLearningTransport>(async () => { throw new Error('offline'); }), 'k')).toEqual({ status: 'error' });
  });

  it('sends exactly the details the existing goal and task flows take', async () => {
    const ok = vi.fn<FamilyLearningTransport>(async () => ({ data: { status: 'acted' }, error: null }));
    expect(await actOnKidBridge(ok, 'k', 'p', { action: 'savings_goal', title: 'Bike', target: 120, icon: 'bike' })).toBe('created');
    expect(ok).toHaveBeenCalledWith('/family/learning/kids/k/bridges/p/act', { method: 'POST', body: { action: 'savings_goal', title: 'Bike', target: 120, icon: 'bike' } });
    expect(await dismissKidBridge(ok, 'k', 'p')).toBe('dismissed');
    expect(await actOnKidBridge(vi.fn<FamilyLearningTransport>(async () => ({ data: null, error: { code: 'BRIDGE_CLOSED' } })), 'k', 'p', { action: 'earning_task', title: 'x', rewardCoins: 1, recurrence: 'once' })).toBe('closed');
    expect(await actOnKidBridge(vi.fn<FamilyLearningTransport>(async () => ({ data: null, error: { code: 'VALIDATION_ERROR' } })), 'k', 'p', { action: 'earning_task', title: 'x', rewardCoins: 1, recurrence: 'once' })).toBe('invalid');
  });
});

describe('the guardian narrative', () => {
  it('opens on request with the week in two numbers, the skill, the struggle and a conversation starter', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<LearningNarrative state={{ status: 'loading' }} locale="en-US" dark={false} open={false} onToggle={onToggle} onRetry={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'See learning' }));
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<LearningNarrative state={narrativeFixture('en-US')} locale="en-US" dark={false} open onToggle={onToggle} onRetry={() => {}} onMore={() => {}} />);
    expect(screen.getByRole('button', { name: 'Hide learning' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('This week: 3 lessons, 1 topic finished.')).toBeTruthy();
    const first = screen.getAllByRole('listitem')[0]!;
    expect(within(first).getByText('Found it tricky, then got it.')).toBeTruthy();
    expect(within(first).getByText('Used a hint.')).toBeTruthy();
    expect(within(first).getByText('Made 2 story choices.')).toBeTruthy();
    expect(within(first).getByText('Ask what they chose, and why.')).toBeTruthy();
    expect(within(first).getByText('Topic finished')).toBeTruthy();
    const second = screen.getAllByRole('listitem')[1]!;
    expect(within(second).getByText('Saving toward a goal, Math of a saving plan')).toBeTruthy();
    expect(within(second).getByText('Ask them to explain it in their own words.')).toBeTruthy();
    expect(within(screen.getAllByRole('listitem')[2]!).getByText('Still working on it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
  });

  it('shows an empty week plainly, and a retry only on error', () => {
    const onRetry = vi.fn();
    const states = narrativePreviewStates('pt-BR');
    const { rerender } = render(<LearningNarrative state={states.empty!} locale="pt-BR" dark open onToggle={() => {}} onRetry={onRetry} />);
    expect(screen.getByText('Nenhuma lição terminada ainda.')).toBeTruthy();
    rerender(<LearningNarrative state={states.error!} locale="pt-BR" dark open onToggle={() => {}} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalledOnce();
    rerender(<LearningNarrative state={{ status: 'no-access' }} locale="pt-BR" dark open onToggle={() => {}} onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toBe('Esta criança não está mais vinculada a você.');
  });
});

describe('the guardian bridge prompts', () => {
  it('are absent when there is nothing to suggest', () => {
    const { container } = render(<LearningBridges state={{ status: 'ready', prompts: [] }} locale="en-US" dark={false} onAct={vi.fn()} onDismiss={vi.fn()} onRetry={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('create a real savings goal only with valid details, in coins', async () => {
    const onAct = vi.fn(async (): Promise<BridgeResult> => 'created');
    render(<LearningBridges state={bridgesFixture('en-US')} locale="en-US" dark={false} onAct={onAct} onDismiss={vi.fn()} onRetry={() => {}} />);
    const goal = screen.getAllByRole('article')[0]!;
    expect(within(goal).getByText('Create a real savings goal together?')).toBeTruthy();
    fireEvent.click(within(goal).getByRole('button', { name: 'Set it up' }));
    fireEvent.click(within(goal).getByRole('button', { name: 'Create goal' }));
    expect(onAct).not.toHaveBeenCalled();
    expect(within(goal).getByLabelText('Goal name').getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(within(goal).getByLabelText('Goal name'), { target: { value: '  New bike ' } });
    fireEvent.change(within(goal).getByLabelText('Coins to save'), { target: { value: '12a0' } });
    fireEvent.change(within(goal).getByLabelText('Picture'), { target: { value: 'bike' } });
    fireEvent.click(within(goal).getByRole('button', { name: 'Create goal' }));
    await screen.findByText('Goal created. It is in their wallet.');
    expect(onAct).toHaveBeenCalledWith('p1', { action: 'savings_goal', title: 'New bike', target: 120, icon: 'bike' });
  });

  it('create a real weekly task, or step away with "Not now"', async () => {
    const onAct = vi.fn(async (): Promise<BridgeResult> => 'created');
    const onDismiss = vi.fn(async (): Promise<BridgeResult> => 'dismissed');
    render(<LearningBridges state={bridgesFixture('es-MX')} locale="es-MX" dark={false} onAct={onAct} onDismiss={onDismiss} onRetry={() => {}} />);
    const task = screen.getAllByRole('article')[1]!;
    fireEvent.click(within(task).getByRole('button', { name: 'Prepararlo' }));
    fireEvent.change(within(task).getByLabelText('Nombre de la tarea'), { target: { value: 'Regar las plantas' } });
    fireEvent.change(within(task).getByLabelText('Premio en monedas'), { target: { value: '900' } });
    fireEvent.click(within(task).getByRole('button', { name: 'Cada semana' }));
    expect(within(task).getByRole('button', { name: 'Cada semana' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(task).getByRole('button', { name: 'Crear tarea' }));
    expect(onAct).not.toHaveBeenCalled();
    fireEvent.change(within(task).getByLabelText('Premio en monedas'), { target: { value: '10' } });
    fireEvent.click(within(task).getByRole('button', { name: 'Crear tarea' }));
    await screen.findByText('Tarea creada. Está en sus tareas.');
    expect(onAct).toHaveBeenCalledWith('p2', { action: 'earning_task', title: 'Regar las plantas', rewardCoins: 10, recurrence: 'weekly' });
    const goal = screen.getAllByRole('article')[0]!;
    fireEvent.click(within(goal).getByRole('button', { name: 'Ahora no' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(onDismiss).toHaveBeenCalledWith('p1');
  });

  it('says so when a suggestion has closed or a save fails', async () => {
    render(<LearningBridges state={bridgesFixture('en-US')} locale="en-US" dark={false} onAct={vi.fn(async (): Promise<BridgeResult> => 'error')} onDismiss={vi.fn(async (): Promise<BridgeResult> => 'closed')} onRetry={() => {}} />);
    const [goal, task] = screen.getAllByRole('article');
    fireEvent.click(within(task!).getByRole('button', { name: 'Not now' }));
    await screen.findByText('This suggestion has closed.');
    fireEvent.click(within(goal!).getByRole('button', { name: 'Set it up' }));
    fireEvent.change(within(goal!).getByLabelText('Goal name'), { target: { value: 'Bike' } });
    fireEvent.change(within(goal!).getByLabelText('Coins to save'), { target: { value: '50' } });
    fireEvent.click(within(goal!).getByRole('button', { name: 'Create goal' }));
    expect((await within(goal!).findByRole('alert')).textContent).toBe('Could not save. Try again.');
  });

  it('declares a copy role on every text node', () => {
    const { container } = render(<>
      <LearningBridges state={bridgesFixture('en-US')} locale="en-US" dark={false} onAct={vi.fn()} onDismiss={vi.fn()} onRetry={() => {}} />
      <LearningNarrative state={narrativeFixture('en-US')} locale="en-US" dark={false} open onToggle={() => {}} onRetry={() => {}} />
    </>);
    for (const el of container.querySelectorAll('h2, h3, p, span, button, label, legend')) {
      if (el.children.length === 0 && el.textContent?.trim()) expect(el.closest('[data-copy-role]'), el.textContent).not.toBeNull();
    }
  });
});
