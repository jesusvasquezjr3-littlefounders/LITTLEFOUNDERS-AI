import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { FAMILY, fakeTransport, ok, refuse, type Answer } from '../console/consoleFixtures';
import type { ConsoleLocale } from '../console/consoleParts';
import { TutorTasks } from './TutorTasks';
import { fakePhotos, REWARD, REWARD_PAUSED, REWARDS, requestWire, rewardWire, TASK_CANCELLED, TASK_DONE, TASKS } from './moneyFixtures';
import { glance, toTask } from './tasksApi';

/*
 * W2F.2 F4-P: the Tutor's Tasks board. The glance numbers come from what Core
 * returned; the decisions and the composer are the wave-1 slots (the list
 * decides nothing); a reward is offered or paused only once Core confirms;
 * every page state (loading, failure, offline, verification, no children)
 * is reachable; every text node carries a copy role.
 */

const en = rebuildNamespaceCopy['en-US'].family.familyTasks;

function everyTextHasARole(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}

const BOARD: Record<string, Answer> = {
  'GET /family/kids': ok({ kids: FAMILY }),
  'GET /tasks': ok({ tasks: TASKS }),
  'GET /tasks/catalog': ok({ items: REWARDS }),
  'GET /tasks/redemptions': ok({ redemptions: [requestWire(), requestWire({ id: 'x', status: 'approved' })] }),
};

function setup(routes: Record<string, Answer> = {}, { locale = 'en-US' as ConsoleLocale, refreshKey = 0 } = {}) {
  const transport = fakeTransport({ ...BOARD, ...routes });
  const photos = fakePhotos();
  const onNavigate = vi.fn();
  const composer = vi.fn((_children: unknown[]) => <p data-copy-role="data" data-slot="composer">composer</p>);
  const queue = vi.fn((_children: unknown[]) => <p data-copy-role="data" data-slot="queue">queue</p>);
  const props = {
    copy: rebuildNamespaceCopy[locale].family.familyTasks, locale, dark: false, transport, photos, onNavigate,
    slots: { tip: <p data-copy-role="data" data-slot="tip">tip</p>, queue, composer },
  };
  const view = render(<TutorTasks {...props} refreshKey={refreshKey} />);
  return { transport, photos, onNavigate, composer, queue, view, rerender: (key: number) => view.rerender(<TutorTasks {...props} refreshKey={key} />) };
}

describe('TutorTasks (F4-P)', () => {
  it('shows the glance, the decision queue and composer slots, the chores by state and the reward list', async () => {
    const { view, composer, queue } = setup();
    expect(screen.getByRole('status')).toHaveTextContent(en.loading);
    await screen.findByRole('heading', { level: 2, name: en.glance });
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([en.title]);
    const numbers = Object.fromEntries([...view.container.querySelectorAll('[data-glance]')].map((e) => [e.getAttribute('data-glance'), e.querySelector('dd')?.textContent]));
    // One chore waiting, one reward asked (the approved one is not), 10 coins given for the approved chore.
    expect(numbers).toEqual({ toApprove: '1', toDecide: '1', coinsGiven: '10' });
    expect(queue).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ displayName: 'Sofía' })]));
    expect(composer.mock.calls.at(-1)![0]).toHaveLength(2);
    // Waiting first, then to do, then done lately; the child is named, never an id.
    const groups = [...view.container.querySelectorAll('[data-chores]')].map((g) => g.getAttribute('data-chores'));
    expect(groups).toEqual(['waiting', 'open', 'recent']);
    const waiting = view.container.querySelector(`[data-task-id="${TASK_DONE}"]`) as HTMLElement;
    expect(within(waiting).getByText('Sofía')).toBeInTheDocument();
    expect(within(waiting).getByText(en.statusDone)).toBeInTheDocument();
    expect(within(waiting).getByText(en.bonus)).toBeInTheDocument();
    expect(within(waiting).getByText('20 coins')).toBeInTheDocument();
    expect(within(waiting).getByText(en.weekly)).toBeInTheDocument();
    expect(within(waiting).getByText('I did the wheels too')).toBeInTheDocument();
    // The list decides nothing (D.18: every decision goes through the queue's reasons).
    expect(within(waiting).queryByRole('button', { name: /approve/i })).toBeNull();
    const cancelled = view.container.querySelector(`[data-task-id="${TASK_CANCELLED}"]`) as HTMLElement;
    expect(within(cancelled).getByText('Mateo')).toBeInTheDocument();
    expect(within(cancelled).getByText('We did it together instead')).toBeInTheDocument();
    expect(view.container.querySelector(`[data-reward-id="${REWARD_PAUSED}"]`)?.textContent).toContain(en.paused);
    expect(screen.getByText('tip')).toBeInTheDocument();
    everyTextHasARole(view.container);
  });

  it('opens the photo through the port and frees it when closed', async () => {
    const { photos } = setup();
    fireEvent.click(await screen.findByRole('button', { name: en.seePhoto }));
    const img = await screen.findByRole('img');
    expect(img.getAttribute('src')).toBe(`blob:photo-${TASK_DONE}`);
    fireEvent.click(screen.getByRole('button', { name: en.photoClose }));
    await waitFor(() => expect(photos.released).toEqual([`blob:photo-${TASK_DONE}`]));
  });

  it('pauses a reward only once Core confirms, and keeps it offered on a failure', async () => {
    let fail = true;
    const { transport, view } = setup({
      [`PATCH /tasks/catalog/${REWARD}`]: (body) => fail ? refuse('DATA_UNAVAILABLE') : ok({ item: rewardWire({ active: (body as { active: boolean }).active }) }),
    });
    await screen.findByText('Pick dinner');
    const row = view.container.querySelector(`[data-reward-id="${REWARD}"]`) as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: en.pause }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.toggleFailed);
    expect(row.getAttribute('data-offered')).toBe('true');
    fail = false;
    fireEvent.click(within(row).getByRole('button', { name: en.pause }));
    await waitFor(() => expect(view.container.querySelector(`[data-reward-id="${REWARD}"]`)?.getAttribute('data-offered')).toBe('false'));
    expect(transport.calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ active: false }, { active: false }]);
  });

  it('adds a reward with the exact body, refusing a cost outside 1 to 500 locally', async () => {
    const { transport, view } = setup({ 'POST /tasks/catalog': (body) => ok({ item: rewardWire({ id: 'new', ...(body as object) }) }) });
    fireEvent.click(await screen.findByRole('button', { name: en.addReward }));
    fireEvent.change(screen.getByLabelText(en.rewardName), { target: { value: '  Movie night ' } });
    fireEvent.change(screen.getByLabelText(en.rewardCost), { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: en.create }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.invalid);
    expect(transport.calls.some((c) => c.method === 'POST')).toBe(false);
    fireEvent.change(screen.getByLabelText(en.rewardCost), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: en.create }));
    await screen.findByText(en.added);
    expect(transport.calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Movie night', cost: 25 });
    expect(view.container.querySelector('[data-reward-id="new"]')).not.toBeNull();
  });

  it('re-reads the board when a decision or a new chore bumps refreshKey', async () => {
    const { transport, rerender } = setup();
    await screen.findByRole('heading', { level: 2, name: en.glance });
    const before = transport.calls.filter((c) => c.path === '/tasks').length;
    rerender(1);
    await waitFor(() => expect(transport.calls.filter((c) => c.path === '/tasks').length).toBe(before + 1));
  });

  it('asks a Tutor who is not verified yet to verify, with the way there', async () => {
    const { onNavigate } = setup({ 'GET /family/kids': refuse('PARENT_VERIFICATION_REQUIRED') });
    await screen.findByRole('heading', { level: 2, name: en.verifyTitle });
    fireEvent.click(screen.getByRole('link', { name: en.verifyAction }));
    expect(onNavigate).toHaveBeenCalledWith('/verify-parent');
  });

  it('sends a Tutor with no children to Family', async () => {
    const { onNavigate, queue } = setup({ 'GET /family/kids': ok({ kids: [] }), 'GET /tasks': ok({ tasks: [] }) });
    await screen.findByRole('heading', { level: 2, name: en.emptyTitle });
    fireEvent.click(screen.getByRole('link', { name: en.emptyAction }));
    expect(onNavigate).toHaveBeenCalledWith('/family');
    expect(queue).not.toHaveBeenCalled();
  });

  it('says "offline" for a network failure and loads on a retry', async () => {
    let offline = true;
    setup({ 'GET /tasks': () => offline ? refuse('NETWORK') : ok({ tasks: TASKS }) });
    expect(await screen.findByText(en.offlineBody)).toBeInTheDocument();
    offline = false;
    fireEvent.click(screen.getByRole('button', { name: en.retry }));
    await screen.findByRole('heading', { level: 2, name: en.glance });
  });

  it('refuses a chore the server did not describe completely', () => {
    expect(toTask({ ...TASKS[0], kind: 'job' })).toBeNull();
    expect(toTask({ ...TASKS[0], rewardCoins: -1 })).toBeNull();
    expect(glance({ tasks: [], rewards: [], requests: [] })).toEqual({ toApprove: 0, asked: 0, coinsGiven: 0 });
  });
});
