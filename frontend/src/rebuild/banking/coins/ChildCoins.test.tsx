import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { fakeTransport, ok, refuse, type Answer } from '../../family/console/consoleFixtures';
import { accountWire, T } from '../../family/tasks/moneyFixtures';
import { ChildCoins } from './ChildCoins';
import type { PendingCredit } from './coinsApi';
import type { WalletActions, WalletPart } from '../CoinAccount';

/*
 * W2F.2 F5-K: the child's wallet. The S07.6 coin account leads; allowance
 * coins wait to be split (held while frozen, D.1); the child changes their
 * card's name and colour in a dialog and the account re-reads; the register
 * is declared for the Copy Budget; a linked teen reads "Family wallet" (OD-28).
 */

const copy = rebuildNamespaceCopy['en-US'].family;
const en = copy.childCoins;

const BASE: Record<string, Answer> = {
  'GET /banking/account': ok({ account: accountWire() }),
  'GET /banking/wallet/pending-credits': ok({ credits: [{ id: 'credit-1', amount: 10, source: 'allowance', createdAt: T }] }),
  'GET /banking/register': ok({ register: 'young' }),
  'GET /tasks/wallet': ok({ balances: { save: 30, spend: 12, share: 3 } }),
  'GET /tasks/goals': ok({ goals: [{ id: 'goal-1', title: 'Bike', target: 50, status: 'active', saved: 10 }] }),
  'GET /banking/allowance': ok({ rule: { amount: 10, frequency: 'weekly', anchorDay: 5, active: true, nextRunAt: '2099-01-01T00:00:00.000Z' } }),
  'GET /banking/allowance-request': ok({ request: null }),
};

function setup(routes: Record<string, Answer> = {}, familyCoins = false) {
  const transport = fakeTransport({ ...BASE, ...routes });
  const onNavigate = vi.fn();
  // The real account is a slot; this one only exposes what the wallet hands it: the actions and the line under the balance.
  const account = vi.fn((version: number, part: WalletPart, actions: WalletActions) => <div data-family-slot={part}>
    <p data-copy-role="data" data-slot={`account-${part}`}>{`account:${part}:${version}`}</p>
    {part === 'overview' ? <>
      <button type="button" onClick={actions.onCustomize}>customize</button>
      <button type="button" onClick={actions.onMove}>move</button>
      <button type="button" onClick={actions.onShare}>give</button>
      <button type="button" onClick={actions.onNewGoal}>new goal</button>
      {actions.heroExtra}
    </> : null}
  </div>);
  const split = vi.fn((credit: PendingCredit, frozen: boolean) => <p data-copy-role="data" data-slot="split">{`split:${credit.id}:${frozen}`}</p>);
  const slot = (name: string) => <p data-copy-role="data" data-slot={name}>{name}</p>;
  const view = render(<ChildCoins copy={en} colours={copy.coinCard} locale="en-US" dark={false} transport={transport} onNavigate={onNavigate} familyCoins={familyCoins}
    slots={{ account, split, usualSplit: slot('usual'), bonus: slot('bonus'), share: slot('share'), goals: (_version, options) => <div data-slot="goals" data-compact={options.compact}
      data-adding={options.adding}><span data-copy-role="data">goals</span>{options.headingAction}</div>, history: slot('history'), bridge: slot('bridge'), research: slot('research') }} />);
  return { transport, onNavigate, account, split, view };
}

describe('ChildCoins (F5-K)', () => {
  it('leads with the seeds waiting to be split, then the account, and never shows a card number', async () => {
    const { view } = setup();
    await screen.findByText('split:credit-1:false');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.title);
    // What needs doing first (coins waiting to be split), then what you have and can do, then the goals and the latest activity.
    const parts = [...view.container.querySelectorAll('[data-family-part]')].map((e) => e.getAttribute('data-family-part'));
    expect(parts.slice(0, 4)).toEqual(['payouts', 'account', 'goals', 'recent']);
    expect(view.container.textContent).not.toContain('LF-1234');
    expect(view.container.querySelector('[data-screen="child-coins"]')?.getAttribute('data-age-band')).toBe('6-9');
    expect(view.container.querySelector('[data-slot="goals"]')?.getAttribute('data-compact')).toBe('true');
  });

  it('keeps each part of the wallet on its own tab: home, goals, activity and card', async () => {
    const { view } = setup();
    await screen.findByText('goals');
    const tab = (name: string) => fireEvent.click(screen.getByRole('radio', { name }));
    const slots = () => [...view.container.querySelectorAll('[data-slot]')].map((e) => e.getAttribute('data-slot'));
    expect(slots()).not.toContain('usual');
    tab(en.tabs.goals);
    expect(slots()).toEqual(expect.arrayContaining(['goals', 'usual', 'bonus']));
    expect(view.container.querySelector('[data-slot="goals"]')?.getAttribute('data-compact')).toBe('false');
    tab(en.tabs.activity);
    expect(slots()).toEqual(expect.arrayContaining(['account-activity', 'history']));
    tab(en.tabs.card);
    expect(slots()).toEqual(expect.arrayContaining(['account-card', 'bridge', 'research']));
    expect(screen.queryByRole('radio', { name: copy.coinCard.violet })).toBeNull();
  });

  it('opens Share from the Share action, not from a tab, and comes back', async () => {
    const { view } = setup();
    await screen.findByText('goals');
    expect(screen.queryByRole('radio', { name: en.tabs.share })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'give' }));
    expect(view.container.querySelector('[data-slot="share"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.tabs.overview }));
    expect(view.container.querySelector('[data-slot="share"]')).toBeNull();
  });

  it('moves seeds from the wallet: plain Save, a destination, a count, and what moved is said', async () => {
    const { transport } = setup({ 'POST /tasks/wallet/moves': ok({ moveId: 'move-1' }) });
    await screen.findByText('goals');
    fireEvent.click(screen.getByRole('button', { name: 'move' }));
    const dialog = await screen.findByRole('dialog');
    // Save is 30 but 10 of it is tied to the goal: only 20 is free to move.
    expect(await within(dialog).findByRole('button', { name: 'Save · no goal · 20' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Spend · 12' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    fireEvent.click(within(dialog).getByRole('button', { name: en.move.all }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move 12 seeds' }));
    expect(await screen.findByText('Done: 12 seeds, from Spend to Save.')).toBeInTheDocument();
    expect(transport.calls.find((c) => c.method === 'POST' && c.path === '/tasks/wallet/moves')?.body).toEqual({ from: 'spend', to: 'save', amount: 12 });
  });

  it('shows when the allowance arrives and lets the child ask for more', async () => {
    let asked: unknown = null;
    setup({ 'POST /banking/allowance-request': (body) => { asked = body; return ok({ request: { id: 'r1', kidUserId: 'k', fromAmount: 10, amount: 11, reasonKind: 'saving_goal', note: null, status: 'requested',
      createdAt: T, decidedAt: null, decisionCode: null, decisionReason: null, revisitOn: null } }); } });
    fireEvent.click(await screen.findByRole('button', { name: en.ask.open }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: en.ask.send })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('radio', { name: en.ask.reasons.saving_goal }));
    fireEvent.click(within(dialog).getByRole('button', { name: en.ask.send }));
    expect(await screen.findByText(en.ask.sent)).toBeInTheDocument();
    expect(asked).toEqual({ amount: 11, reasonKind: 'saving_goal' });
  });

  it('tells a split its seeds are held while the card is frozen', async () => {
    setup({ 'GET /banking/account': ok({ account: accountWire({ frozen: true, frozenBy: 'parent' }) }) });
    expect(await screen.findByText('split:credit-1:true')).toBeInTheDocument();
  });

  it('changes the name and colour with exactly Core\'s body, then the account re-reads', async () => {
    // The card re-reads after the save (Core now holds the new name): the notice stays.
    let saved: Record<string, unknown> | null = null;
    const { transport, account } = setup({
      'PATCH /banking/account': (body) => { saved = body as Record<string, unknown>; return ok({ account: accountWire({ nickname: saved.nickname }) }); },
      'GET /banking/account': () => ok({ account: accountWire(saved ? { nickname: saved.nickname, cardDesign: saved.cardDesign } : {}) }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'customize' }));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText(en.cardName) as HTMLInputElement;
    expect(name.value).toBe('Rocket Fund');
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: en.save }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(en.nameMissing);
    fireEvent.change(name, { target: { value: 'Star jar' } });
    fireEvent.click(within(dialog).getByRole('button', { name: copy.coinCard.violet }));
    fireEvent.click(within(dialog).getByRole('button', { name: en.save }));
    await screen.findByText(en.saved);
    expect(transport.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ nickname: 'Star jar', cardDesign: 'violet' });
    await waitFor(() => expect(account.mock.calls.at(-1)![0]).toBeGreaterThan(0));
    await waitFor(() => expect(transport.calls.filter((c) => c.path === '/banking/account' && c.method === 'GET').length).toBe(2));
    expect(screen.getByText(en.saved)).toBeInTheDocument();
  });

  it('offers no card change when there is no card yet', async () => {
    setup({ 'GET /banking/account': ok({ account: null }), 'GET /banking/wallet/pending-credits': ok({ credits: [] }) });
    await screen.findByText('goals');
    fireEvent.click(screen.getByRole('button', { name: 'customize' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('titles a linked teen\'s page "Family wallet"', async () => {
    setup({}, true);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(en.titleFamily);
  });

  it('explains a refusal and says "offline" for a network failure', async () => {
    const refused = setup({ 'GET /banking/account': refuse('GUARDIAN_LINK_REQUIRED') });
    expect(await screen.findByRole('heading', { level: 2, name: en.refusedTitle })).toBeInTheDocument();
    refused.view.unmount();
    setup({ 'GET /banking/account': refuse('NETWORK') });
    expect(await screen.findByText(en.offlineBody)).toBeInTheDocument();
  });
});
