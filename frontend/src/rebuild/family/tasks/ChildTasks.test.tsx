import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { fakeTransport, ok, refuse, type Answer } from '../console/consoleFixtures';
import type { ConsoleLocale } from '../console/consoleParts';
import { ChildTasks } from './ChildTasks';
import { fakePhotos, REWARD, REWARD_PAUSED, requestWire, rewardWire, TASK_APPROVED, TASK_DONE, TASK_OPEN, TASKS } from './moneyFixtures';
import type { Reward, Task } from './tasksApi';

/*
 * W2F.2 F4-K: the child's Tasks board. Coins waiting to be split come first,
 * then the chores (to do, then waiting for approval), then the rewards; the
 * register comes from Core (young until it is known) and is declared for the
 * Copy Budget audit; the child's own words go through the wave-1 slots; a
 * refusal (no linked parent) explains itself instead of offering a retry.
 */

const en = rebuildNamespaceCopy['en-US'].family.childTasks;
const MINE = TASKS.slice(0, 3);

const BOARD: Record<string, Answer> = {
  'GET /tasks/mine': ok({ tasks: MINE }),
  'GET /tasks/wallet': ok({ balances: { save: 12, spend: 20, share: 3 } }),
  'GET /tasks/catalog/available': ok({ items: [rewardWire(), rewardWire({ id: REWARD_PAUSED, title: 'Late bedtime', cost: 40 })] }),
  'GET /tasks/redemptions/mine': ok({ redemptions: [] }),
  'GET /banking/register': ok({ register: 'transition' }),
};

function setup(routes: Record<string, Answer> = {}, { locale = 'en-US' as ConsoleLocale, photos = fakePhotos() } = {}) {
  const transport = fakeTransport({ ...BOARD, ...routes });
  const onNavigate = vi.fn();
  const done = vi.fn((task: Task, changed: () => void) => <button type="button" data-copy-role="action" onClick={changed}>{`done:${task.title}`}</button>);
  const split = vi.fn((task: Task) => <p data-copy-role="data">{`split:${task.id}`}</p>);
  const ask = vi.fn((reward: Reward, affordable: boolean) => <button type="button" data-copy-role="action" disabled={!affordable}>{`ask:${reward.title}`}</button>);
  const slot = (name: string) => <p data-copy-role="data" data-slot={name}>{name}</p>;
  const view = render(<ChildTasks copy={rebuildNamespaceCopy[locale].family.childTasks} locale={locale} dark={false} transport={transport} photos={photos}
    onNavigate={onNavigate} slots={{ streak: slot('streak'), level: slot('level'), notes: slot('notes'), usualSplit: slot('usual'), goals: slot('goals'),
      share: slot('share'), history: slot('history'), done, split, ask }} />);
  return { transport, onNavigate, done, split, ask, view, photos };
}

describe('ChildTasks (F4-K)', () => {
  it('orders what to do first: coins to split, chores, rewards; then the pockets and the wave-1 surfaces', async () => {
    const { view, split, done } = setup();
    await screen.findByRole('heading', { level: 2, name: en.choresTitle });
    const parts = [...view.container.querySelectorAll('[data-family-part]')].map((e) => e.getAttribute('data-family-part'));
    expect(parts.slice(0, 4)).toEqual(['payouts', 'chores', 'rewards', 'pockets']);
    // An approved chore with coins waits to be split; a family chore with 0 coins never does (D.10).
    expect(split.mock.calls.map(([task]) => task.id)).toEqual([TASK_APPROVED]);
    // To do first, then waiting; only the open one can be marked done.
    const rows = [...view.container.querySelectorAll('[data-family-part="chores"] [data-task-id]')].map((e) => e.getAttribute('data-task-id'));
    expect(rows).toEqual([TASK_OPEN, TASK_DONE]);
    expect(done.mock.calls.map(([task]) => task.id)).toEqual([TASK_OPEN]);
    const open = view.container.querySelector(`[data-task-id="${TASK_OPEN}"]`) as HTMLElement;
    expect(within(open).getByText(en.contribution)).toBeInTheDocument();
    expect(within(open).queryByText(/coins?$/)).toBeNull();
    const waiting = view.container.querySelector(`[data-task-id="${TASK_DONE}"]`) as HTMLElement;
    expect(within(waiting).getByText(en.statusDone)).toBeInTheDocument();
    expect(within(waiting).getByRole('button', { name: en.newPhoto })).toBeInTheDocument();
    const pockets = view.container.querySelector('[data-family-part="pockets"]') as HTMLElement;
    expect(within(pockets).getByText('20 coins')).toBeInTheDocument();
    expect(pockets.querySelectorAll('img[data-asset-id="money.coin"]').length).toBe(3);
    expect(pockets.querySelectorAll('img[data-asset-id^="pocket."]').length).toBe(3);
    for (const name of ['streak', 'level', 'notes', 'usual', 'goals', 'share', 'history']) expect(view.container.querySelector(`[data-slot="${name}"]`)).not.toBeNull();
  });

  it('declares the register Core returned for the Copy Budget, young until it is known', async () => {
    let answer: (value: unknown) => void = () => undefined;
    const register = new Promise((resolve) => { answer = resolve; });
    const { view } = setup({ 'GET /banking/register': async () => ok(await register) });
    const root = () => view.container.querySelector('[data-screen="child-tasks"]') as HTMLElement;
    await screen.findByRole('heading', { level: 2, name: en.choresTitle });
    expect(root().getAttribute('data-age-band')).toBe('6-9');
    answer({ register: 'teen' });
    await waitFor(() => expect(root().getAttribute('data-age-band')).toBe('13-17'));
  });

  it('offers a reward the Spend pocket cannot cover yet with the reason, and shows one already asked', async () => {
    const { view, ask } = setup({ 'GET /tasks/redemptions/mine': ok({ redemptions: [requestWire({ catalogId: REWARD })] }) });
    await screen.findByText('Late bedtime');
    expect(ask.mock.calls.map(([reward, affordable]) => [reward.id, affordable])).toEqual([[REWARD_PAUSED, false]]);
    expect(within(view.container.querySelector(`[data-reward-id="${REWARD}"]`) as HTMLElement).getByText(en.asked)).toBeInTheDocument();
    expect(within(view.container.querySelector(`[data-reward-id="${REWARD_PAUSED}"]`) as HTMLElement).getByText(en.notEnough)).toBeInTheDocument();
  });

  it('keeps a chore\'s "done" control after it is marked, and re-reads the board', async () => {
    let marked = false;
    const { transport } = setup({ 'GET /tasks/mine': () => ok({ tasks: MINE.map((t) => t.id === TASK_OPEN && marked ? { ...t, status: 'done' } : t) }) });
    const button = await screen.findByRole('button', { name: 'done:Set the table' });
    marked = true;
    fireEvent.click(button);
    await waitFor(() => expect(transport.calls.filter((c) => c.path === '/tasks/mine').length).toBe(2));
    expect(screen.getByRole('button', { name: 'done:Set the table' })).toBeInTheDocument();
  });

  it('uploads a photo through the port and says when it is too big', async () => {
    const photos = fakePhotos({ upload: 'PAYLOAD_TOO_LARGE' });
    const { view } = setup({}, { photos });
    await screen.findByRole('heading', { level: 2, name: en.choresTitle });
    fireEvent.click(within(view.container.querySelector(`[data-task-id="${TASK_OPEN}"]`) as HTMLElement).getByRole('button', { name: en.addPhoto }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.photoTooBig);
    expect(photos.uploads).toEqual([TASK_OPEN]);
  });

  it('explains a refusal (no linked parent) with the way back, never a retry', async () => {
    const { onNavigate } = setup({ 'GET /tasks/mine': refuse('GUARDIAN_LINK_REQUIRED') });
    await screen.findByRole('heading', { level: 2, name: en.refusedTitle });
    expect(screen.queryByRole('button', { name: en.retry })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: en.refusedAction }));
    expect(onNavigate).toHaveBeenCalledWith('/learn');
  });

  it('says "offline" and loads on a retry', async () => {
    let offline = true;
    setup({ 'GET /tasks/wallet': () => offline ? refuse('NETWORK') : ok({ balances: { save: 1, spend: 2, share: 3 } }) });
    expect(await screen.findByText(en.offlineBody)).toBeInTheDocument();
    offline = false;
    fireEvent.click(screen.getByRole('button', { name: en.retry }));
    await screen.findByRole('heading', { level: 2, name: en.choresTitle });
  });

  it('writes every string of its own in es-MX and pt-BR without a masculine-only word for the child', () => {
    const text = (locale: ConsoleLocale) => JSON.stringify([rebuildNamespaceCopy[locale].family.childTasks, rebuildNamespaceCopy[locale].family.familyTasks,
      rebuildNamespaceCopy[locale].family.familyCoins, rebuildNamespaceCopy[locale].family.childCoins]);
    expect(text('es-MX')).not.toMatch(/\bun hijo\b(?! o)|\btu hijo\b(?! o)/);
    expect(text('pt-BR')).not.toMatch(/\bum filho\b|\bdele\b|\bseu filho\b/);
  });
});
