import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { fakeTransport, ok, refuse, type Answer } from '../../family/console/consoleFixtures';
import { accountWire, T } from '../../family/tasks/moneyFixtures';
import { ChildCoins } from './ChildCoins';
import type { PendingCredit } from './coinsApi';

/*
 * W2F.2 F5-K: the child's wallet. The S07.6 coin account leads; allowance
 * coins wait to be split (held while frozen, D.1); the child changes their
 * card's name and colour in a dialog and the account re-reads; the register
 * is declared for the Copy Budget; a linked teen reads "Family coins".
 */

const copy = rebuildNamespaceCopy['en-US'].family;
const en = copy.childCoins;

const BASE: Record<string, Answer> = {
  'GET /banking/account': ok({ account: accountWire() }),
  'GET /banking/wallet/pending-credits': ok({ credits: [{ id: 'credit-1', amount: 10, source: 'allowance', createdAt: T }] }),
  'GET /banking/register': ok({ register: 'young' }),
};

function setup(routes: Record<string, Answer> = {}, familyCoins = false) {
  const transport = fakeTransport({ ...BASE, ...routes });
  const onNavigate = vi.fn();
  const account = vi.fn((version: number) => <p data-copy-role="data" data-slot="account">{`account:${version}`}</p>);
  const split = vi.fn((credit: PendingCredit, frozen: boolean) => <p data-copy-role="data" data-slot="split">{`split:${credit.id}:${frozen}`}</p>);
  const slot = (name: string) => <p data-copy-role="data" data-slot={name}>{name}</p>;
  const view = render(<ChildCoins copy={en} colours={copy.coinCard} locale="en-US" dark={false} transport={transport} onNavigate={onNavigate} familyCoins={familyCoins}
    slots={{ account, split, usualSplit: slot('usual'), bonus: slot('bonus'), goals: () => slot('goals'), history: slot('history'), bridge: slot('bridge'),
      research: slot('research') }} />);
  return { transport, onNavigate, account, split, view };
}

describe('ChildCoins (F5-K)', () => {
  it('leads with the coin account, then the coins to split, and never shows a card number', async () => {
    const { view } = setup();
    await screen.findByText('split:credit-1:false');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.title);
    const parts = [...view.container.querySelectorAll('[data-family-part]')].map((e) => e.getAttribute('data-family-part'));
    expect(parts.slice(0, 2)).toEqual(['account', 'payouts']);
    expect(view.container.textContent).not.toContain('LF-1234');
    expect(view.container.querySelector('[data-screen="child-coins"]')?.getAttribute('data-age-band')).toBe('6-9');
    for (const name of ['usual', 'bonus', 'goals', 'history', 'bridge', 'research']) expect(view.container.querySelector(`[data-slot="${name}"]`)).not.toBeNull();
  });

  it('tells a split its coins are held while the card is frozen', async () => {
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
    fireEvent.click(await screen.findByRole('button', { name: en.edit }));
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
    await screen.findByText('usual');
    expect(screen.queryByRole('button', { name: en.edit })).toBeNull();
  });

  it('titles a linked teen\'s page "Family coins"', async () => {
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
