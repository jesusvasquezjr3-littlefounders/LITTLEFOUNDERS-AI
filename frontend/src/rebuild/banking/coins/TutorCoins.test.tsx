import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { FAMILY, fakeTransport, KID_A, KID_B, ok, refuse, type Answer } from '../../family/console/consoleFixtures';
import type { Child } from '../../family/console/consoleApi';
import { accountWire, allowanceWire } from '../../family/tasks/moneyFixtures';
import { TutorCoins } from './TutorCoins';

/*
 * W2F.2 F5-P: the Tutor's coin cards, one child at a time. The card never
 * shows the legacy number (D.7); a child with no card is offered one; the
 * allowance and the limit send exactly Core's bodies and show Core's
 * refusals; a response for one child never lands on another; every page
 * state is reachable.
 */

const copy = rebuildNamespaceCopy['en-US'].family;
const en = copy.familyCoins;

const SETUP = (kid: string): Record<string, Answer> => ({
  [`GET /banking/accounts/${kid}`]: ok({ account: accountWire({ nickname: kid === KID_A ? 'Rocket Fund' : 'Bike Fund' }) }),
  [`GET /banking/allowance/${kid}`]: ok({ rule: allowanceWire() }),
  [`GET /banking/spend-limit/${kid}`]: ok({ status: { configured: true, period: 'weekly', cap: 50, used: 20, remaining: 30 } }),
  // GAP-FIX-R6: the child's pockets, read for the Tutor under the freeze card.
  [`GET /tasks/${kid}/wallet`]: ok({ balances: kid === KID_A ? { save: 12, spend: 20, share: 3 } : { save: 1, spend: 2, share: 3 } }),
});

function setup(routes: Record<string, Answer> = {}, selectedId: string | null = null) {
  const transport = fakeTransport({ 'GET /family/kids': ok({ kids: FAMILY }), ...SETUP(KID_A), ...SETUP(KID_B), ...routes });
  const onSelect = vi.fn();
  const onNavigate = vi.fn();
  const changes: (() => void)[] = [];
  const slots = vi.fn((child: Child, changed: () => void) => { changes.push(changed); return {
    freeze: <p data-copy-role="data" data-slot="freeze">{`freeze:${child.userId}`}</p>,
    coaching: <p data-copy-role="data">coaching</p>,
    bonus: <p data-copy-role="data" data-slot="bonus">bonus</p>,
    corrections: <p data-copy-role="data" data-slot="corrections">corrections</p>,
    share: <p data-copy-role="data" data-slot="share">share</p>,
  }; });
  const props = { copy: en, colours: copy.coinCard, locale: 'en-US' as const, dark: false, transport, onSelect, onNavigate, childSlots: slots,
    aside: <p data-copy-role="data">aside</p> };
  const view = render(<TutorCoins {...props} selectedId={selectedId} />);
  return { transport, onSelect, onNavigate, slots, view, changes, rerender: (id: string | null) => view.rerender(<TutorCoins {...props} selectedId={id} />) };
}

describe('TutorCoins (F5-P)', () => {
  it('shows the child in view: the freeze card, allowance, limit and the wave-1 surfaces, never a card number', async () => {
    const { view, onSelect } = setup();
    await screen.findByText('freeze:' + KID_A);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([en.title]);
    for (const slot of ['bonus', 'corrections', 'share']) expect(view.container.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
    expect(view.container.textContent).not.toContain('LF-1234');
    expect(screen.getByRole('progressbar', { name: en.usedLabel })).toHaveAttribute('aria-valuetext', '20 of 50');
    expect((screen.getByLabelText(en.amount) as HTMLInputElement).value).toBe('10');
    fireEvent.click(screen.getByRole('button', { name: 'Mateo' }));
    expect(onSelect).toHaveBeenCalledWith(KID_B);
  });

  it('saves the allowance with exactly Core\'s body, keeping the day valid for the schedule', async () => {
    // Core computes a new next date on every save: the form stays, with its notice.
    const { transport } = setup({ [`PUT /banking/allowance/${KID_A}`]: (body) => ok({ rule: allowanceWire({ ...(body as Record<string, unknown>), nextRunAt: '2026-10-01T00:00:00.000Z' }) }) });
    await screen.findByLabelText(en.amount);
    fireEvent.change(screen.getByLabelText(en.amount), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('radio', { name: en.monthly }));
    const form = screen.getByLabelText(en.monthday).closest('form') as HTMLFormElement;
    fireEvent.click(within(form).getByRole('button', { name: en.save }));
    await within(form).findByText(en.saved);
    // A weekday is not a date: moving to a monthly schedule starts on the 1st.
    expect(transport.calls.find((c) => c.method === 'PUT')?.body).toEqual({ amount: 25, frequency: 'monthly', anchorDay: 1, active: true });
  });

  it('refuses an allowance outside 1 to 1,000 locally and names Core\'s refusal', async () => {
    const { transport } = setup({ [`PUT /banking/allowance/${KID_A}`]: refuse('CONFLICT') });
    await screen.findByLabelText(en.amount);
    const form = screen.getByLabelText(en.amount).closest('form') as HTMLFormElement;
    fireEvent.change(screen.getByLabelText(en.amount), { target: { value: '5000' } });
    fireEvent.click(within(form).getByRole('button', { name: en.save }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(en.invalid);
    expect(transport.calls.some((c) => c.method === 'PUT')).toBe(false);
    fireEvent.change(screen.getByLabelText(en.amount), { target: { value: '15' } });
    fireEvent.click(within(form).getByRole('button', { name: en.save }));
    await waitFor(() => expect(within(form).getByRole('alert')).toHaveTextContent(en.needsCard));
  });

  it('turns the spending limit off with the body Core requires', async () => {
    const { transport } = setup({ [`PUT /banking/spend-limit/${KID_A}`]: ok({ status: { configured: false } }) });
    const box = await screen.findByLabelText(en.limitSwitch);
    fireEvent.click(box);
    const form = box.closest('form') as HTMLFormElement;
    fireEvent.click(within(form).getByRole('button', { name: en.save }));
    await within(form).findByText(en.saved);
    expect(transport.calls.find((c) => c.method === 'PUT')?.body).toEqual({ period: 'weekly', cap: 50, active: false });
    expect(screen.queryByRole('progressbar', { name: en.usedLabel })).toBeNull();
  });

  it('offers a child with no card a new one: a name and a colour, no number', async () => {
    const { transport, view } = setup({
      [`GET /banking/accounts/${KID_A}`]: ok({ account: null }),
      [`POST /banking/accounts/${KID_A}`]: (body) => ok({ account: accountWire({ nickname: (body as { nickname: string }).nickname }) }),
    });
    await screen.findByRole('heading', { name: en.openTitle });
    expect(view.container.querySelector('[data-slot="freeze"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.open }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.nameMissing);
    fireEvent.change(screen.getByLabelText(en.cardName), { target: { value: 'Moon jar' } });
    fireEvent.click(screen.getByRole('button', { name: copy.coinCard.emerald }));
    fireEvent.click(screen.getByRole('button', { name: en.open }));
    await screen.findByText('freeze:' + KID_A);
    expect(transport.calls.find((c) => c.method === 'POST')?.body).toEqual({ nickname: 'Moon jar', cardDesign: 'emerald' });
  });

  it('never lands a slow answer for one child on another', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const slow = new Promise((resolve) => { finish = resolve; });
    const { rerender } = setup({ [`GET /banking/allowance/${KID_A}`]: async () => { await slow; return ok({ rule: allowanceWire({ amount: 99 }) }); } });
    await screen.findByRole('status');
    rerender(KID_B);
    await screen.findByText('freeze:' + KID_B);
    await act(async () => finish(null));
    expect((screen.getByLabelText(en.amount) as HTMLInputElement).value).toBe('10');
  });

  it('shows a child\'s failed card with a retry, and the family states', async () => {
    setup({ [`GET /banking/spend-limit/${KID_A}`]: refuse('DATA_UNAVAILABLE') });
    await screen.findByRole('heading', { name: en.childFailed });
  });

  it('asks an unverified Tutor to verify', async () => {
    const { onNavigate } = setup({ 'GET /family/kids': refuse('PARENT_VERIFICATION_REQUIRED') });
    fireEvent.click(await screen.findByRole('link', { name: en.verifyAction }));
    expect(onNavigate).toHaveBeenCalledWith('/verify-parent');
  });

  // GAP-FIX-R6 (OD-3 §2, Law 5): the child's pockets under the freeze card, with or without a coin card; a slot's coin movement re-reads them.
  it("shows the child's pockets right after the freeze card and re-reads them when a slot moved coins", async () => {
    const { view, transport, changes } = setup();
    await screen.findByRole('heading', { name: "Sofía's coins" });
    const parts = [...view.container.querySelectorAll('[data-family-part]')].map((el) => el.getAttribute('data-family-part'));
    expect(parts.slice(0, 2)).toEqual(['freeze', 'child-coins']);
    const reads = () => transport.calls.filter((c) => c.path === `/tasks/${KID_A}/wallet`).length;
    expect(reads()).toBe(1);
    await act(async () => changes.at(-1)?.());
    await waitFor(() => expect(reads()).toBe(2));
  });

  it('shows the pockets of a child with no coin card yet, beside the offer to open one', async () => {
    setup({ [`GET /banking/accounts/${KID_A}`]: ok({ account: null }) });
    await screen.findByRole('heading', { name: en.openTitle });
    expect(await screen.findByRole('heading', { name: "Sofía's coins" })).toBeInTheDocument();
  });

  it('sends a Tutor with no children to Family', async () => {
    setup({ 'GET /family/kids': ok({ kids: [] }) });
    expect(await screen.findByRole('link', { name: en.emptyAction })).toHaveAttribute('href', '/family');
  });
});
