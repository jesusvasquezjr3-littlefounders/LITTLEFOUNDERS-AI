import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import autonomy from '@/i18n/en-US/familyAutonomy.json';
import { fakeTransport, ok, refuse, type Answer } from '../../family/console/consoleFixtures';
import { T } from '../../family/tasks/moneyFixtures';
import { AllowanceRequests } from './AllowanceRequests';

/*
 * The Tutor's side of "ask for a bigger allowance": the request in the child's own words, a yes that sets the
 * new allowance, and a "not yet" that always carries a reason code, a reason that says what the child can do next,
 * and a date when the answer is "later" (D.18). Nothing here celebrates; a refusal is a notice, not a retry loop.
 */

const en = rebuildNamespaceCopy['en-US'].family.familyCoins.requests;
const KID = '33333333-3333-4333-8333-333333333333';
const REQ = '44444444-4444-4444-8444-444444444444';
const wire = (over: Record<string, unknown> = {}) => ({ id: REQ, kidUserId: KID, fromAmount: 10, amount: 15, reasonKind: 'saving_goal', note: 'for a bike', status: 'requested',
  createdAt: T, decidedAt: null, decisionCode: null, decisionReason: null, revisitOn: null, ...over });

function setup(routes: Record<string, Answer> = {}, requests: unknown[] = [wire()]) {
  const transport = fakeTransport({ [`GET /banking/allowance-requests/${KID}`]: ok({ requests }), ...routes });
  const onAnswered = vi.fn();
  const view = render(<AllowanceRequests copy={en} notYetCopy={autonomy.notYet} kidId={KID} kidName="Ana" locale="en-US" frequency="weekly" transport={transport} onAnswered={onAnswered} />);
  return { transport, onAnswered, view };
}

describe('AllowanceRequests (Tutor)', () => {
  it('shows the request in the child\'s words: how much, how often, why', async () => {
    setup();
    expect(await screen.findByText('Ana asks for 15 each week (now 10).')).toBeVisible();
    expect(screen.getByText('To save for a goal: for a bike')).toBeVisible();
  });

  it('says yes with exactly one body, says what the allowance is now, and tells the page to re-read', async () => {
    const { transport, onAnswered } = setup({ [`POST /banking/allowance-requests/${REQ}/decide`]: ok({ outcome: 'approved' }) });
    fireEvent.click(await screen.findByRole('button', { name: en.yes }));
    expect(await screen.findByText('Done. The allowance is now 15.')).toBeVisible();
    expect(transport.calls.find((c) => c.method === 'POST')?.body).toEqual({ approve: true });
    await waitFor(() => expect(onAnswered).toHaveBeenCalledTimes(1));
  });

  it('never sends a "not yet" without a code and a reason that says what to do next, and asks for a date only for "later"', async () => {
    const { transport } = setup({ [`POST /banking/allowance-requests/${REQ}/decide`]: ok({ outcome: 'denied' }) });
    fireEvent.click(await screen.findByRole('button', { name: en.notYet }));
    fireEvent.click(screen.getByRole('button', { name: autonomy.notYet.send }));
    expect(await screen.findByText(autonomy.notYet.pickCode)).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: autonomy.notYet.later_date }));
    fireEvent.change(screen.getByLabelText(autonomy.notYet.reason), { target: { value: 'Not now' } });
    fireEvent.click(screen.getByRole('button', { name: autonomy.notYet.send }));
    expect(await screen.findByText(autonomy.notYet.tooVague)).toBeVisible();
    fireEvent.change(screen.getByLabelText(autonomy.notYet.reason), { target: { value: 'Save two more weeks and ask again' } });
    fireEvent.click(screen.getByRole('button', { name: autonomy.notYet.send }));
    expect(await screen.findByText(autonomy.notYet.revisitInvalid)).toBeVisible();
    expect(transport.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    const day = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    // The date is three plain parts the child's Tutor types: day, month, year.
    const [year, month, dayOfMonth] = day.split('-');
    fireEvent.change(screen.getByLabelText(`${autonomy.notYet.revisit}: Day`), { target: { value: String(Number(dayOfMonth)) } });
    fireEvent.change(screen.getByLabelText(`${autonomy.notYet.revisit}: Month`), { target: { value: String(Number(month)) } });
    fireEvent.change(screen.getByLabelText(`${autonomy.notYet.revisit}: Year`), { target: { value: year } });
    fireEvent.click(screen.getByRole('button', { name: autonomy.notYet.send }));
    await waitFor(() => expect(transport.calls.some((c) => c.method === 'POST')).toBe(true));

    expect(await screen.findByText(en.denied)).toBeVisible();
    expect(transport.calls.find((c) => c.method === 'POST')?.body).toEqual({ approve: false, reasonCode: 'later_date', reason: 'Save two more weeks and ask again', revisitOn: day });
  });

  it('shows a failed answer as a notice and keeps the request waiting', async () => {
    setup({ [`POST /banking/allowance-requests/${REQ}/decide`]: refuse('ALLOWANCE_REQUEST_DECIDED') });
    fireEvent.click(await screen.findByRole('button', { name: en.yes }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.failed);
    expect(screen.getByRole('button', { name: en.yes })).toBeVisible();
  });

  it('takes no space when there is nothing to answer, and shows the last answer when there is one', async () => {
    const empty = setup({}, []);
    await waitFor(() => expect(empty.transport.calls.length).toBeGreaterThan(0));
    await waitFor(() => expect(empty.view.container.querySelector('[data-family-part="allowance-requests"]')).toBeNull());
    empty.view.unmount();
    setup({}, [wire({ status: 'denied', decidedAt: T, decisionCode: 'talk_first', decisionReason: 'Let us talk about it on Sunday' })]);
    const card = (await screen.findByText('Not yet: Let us talk about it on Sunday')).closest('[data-family-part="allowance-requests"]') as HTMLElement;
    expect(within(card).queryByRole('button', { name: en.yes })).toBeNull();
  });
});
