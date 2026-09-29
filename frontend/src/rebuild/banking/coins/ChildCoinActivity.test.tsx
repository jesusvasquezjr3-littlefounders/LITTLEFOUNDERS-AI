import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { childWire, fakeTransport, KID_A, ok, refuse, type Answer } from '../../family/console/consoleFixtures';
import type { Child } from '../../family/console/consoleApi';
import { ChildCoinActivity } from './ChildCoinActivity';
import { fetchChildMonth, monthInWindow } from './coinsApi';

/*
 * GAP-FIX-R6 (OD-3 §2, Law 5, Block D monthly statements, H-06): the Tutor
 * reads one child's pockets, month summary and latest history on the Wallet
 * screen. A linked teen's self-directed entries are there after the fact,
 * marked; paging never leaves Core's window; a malformed answer is refused,
 * never rendered; a coin movement elsewhere on the screen re-reads.
 */

const en = rebuildNamespaceCopy['en-US'].family.familyCoins;
const child = childWire() as unknown as Child;
const T = '2026-09-20T10:00:00.000Z';
const line = (id: number, reason: string, amount: number, over: Record<string, unknown> = {}) =>
  ({ id, bucket: 'spend', amount, reason, taskId: null, goalId: null, note: null, createdAt: T, ...over });
const month = (m: string, entries: unknown[] = []) => ok({ statement: { month: m, earned: 30, spent: 4, adjusted: -2, given: 0, saved: 10, entries } });
const MONTH_LINES = [
  line(5, 'self_income', 12),
  line(4, 'personal_reward', -4),
  line(3, 'goal_release', 3, { bucket: 'save' }),
  line(2, 'manual_adjustment', -2, { note: 'Lost game fee' }),
  line(1, 'task_approved', 10, { bucket: 'save' }),
];

function setup(routes: Record<string, Answer> = {}, refreshKey = 0) {
  const transport = fakeTransport({
    [`GET /tasks/${KID_A}/wallet`]: ok({ balances: { save: 12, spend: 20, share: 3 } }),
    [`GET /banking/statement/${KID_A}`]: month('2026-09', MONTH_LINES),
    [`GET /banking/statement/${KID_A}?month=2026-08`]: month('2026-08'),
    [`GET /tasks/${KID_A}/wallet/ledger`]: ok({ entries: Array.from({ length: 14 }, (_, n) => line(100 - n, n % 2 ? 'allowance' : 'self_income', 5)) }),
    ...routes,
  });
  const view = render(<div className="lf-family-money"><ChildCoinActivity child={child} copy={en} locale="en-US" transport={transport} refreshKey={refreshKey} /></div>);
  return { transport, view, rerender: (key: number) => view.rerender(<div className="lf-family-money">
    <ChildCoinActivity child={child} copy={en} locale="en-US" transport={transport} refreshKey={key} /></div>) };
}

function findPart(container: HTMLElement, part: 'month' | 'history') {
  return waitFor(() => {
    const found = container.querySelector<HTMLElement>(`[data-coins-part="${part}"]`);
    if (!found) throw new Error(`no ${part} yet`);
    return found;
  });
}

function everyTextHasARole(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}

describe('ChildCoinActivity (GAP-FIX-R6)', () => {
  it("shows the child's three pockets with their art and the split bar, and reads nothing else until asked", async () => {
    const { transport, view } = setup();
    await screen.findByRole('heading', { name: "Sofía's coins" });
    const pockets = view.container.querySelector('[data-family-part="pockets"]') as HTMLElement;
    expect([...pockets.querySelectorAll('li')].map((li) => [li.dataset.pocket, li.textContent])).toEqual([
      ['save', 'Save12 coins'], ['spend', 'Spend20 coins'], ['share', 'Share3 coins'],
    ]);
    expect(pockets.querySelectorAll('[data-pocket-mark]')).toHaveLength(3);
    expect(pockets.querySelectorAll('[data-split-segment]')).toHaveLength(3);
    expect(transport.calls.map((c) => c.path)).toEqual([`/tasks/${KID_A}/wallet`]);
    everyTextHasARole(view.container);
  });

  it("opens the month: the totals, every line with its reason, a linked teen's own entries marked", async () => {
    const { view } = setup();
    fireEvent.click(await screen.findByRole('button', { name: en.monthTitle }));
    const part = await findPart(view.container, 'month');
    expect(part.dataset.month).toBe('2026-09');
    expect(within(part).getByText('September 2026')).toBeInTheDocument();
    const totals = [...part.querySelectorAll('dl div')].map((d) => d.textContent);
    expect(totals).toEqual(['Earned30', 'Spent4', 'Added to Save10', 'Tutor corrections-2']);
    const own = [...part.querySelectorAll('li[data-self-directed="true"]')].map((li) => li.getAttribute('data-ledger-reason'));
    expect(own).toEqual(['self_income', 'personal_reward', 'goal_release']);
    expect(within(part).getAllByText(en.onOwn)).toHaveLength(3);
    expect(within(part).getByText('Why: Lost game fee')).toBeInTheDocument();
    expect(within(part).getByText(en.reasons.task_approved)).toBeInTheDocument();
    everyTextHasARole(view.container);
  });

  it("pages back inside Core's window and returns to this month without a month parameter", async () => {
    const { transport, view } = setup();
    fireEvent.click(await screen.findByRole('button', { name: en.monthTitle }));
    await screen.findByText('September 2026');
    // This month is the newest: there is no next month.
    expect(screen.queryByRole('button', { name: en.nextMonth })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.prevMonth }));
    await screen.findByText('August 2026');
    expect(within(view.container.querySelector('[data-coins-part="month"]') as HTMLElement).getByText(en.monthEmpty)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.nextMonth }));
    await screen.findByText('September 2026');
    expect(transport.calls.filter((c) => c.path.startsWith('/banking/statement')).map((c) => c.path)).toEqual([
      `/banking/statement/${KID_A}`, `/banking/statement/${KID_A}?month=2026-08`, `/banking/statement/${KID_A}`,
    ]);
  });

  it('opens the latest history ten lines at a time', async () => {
    const { view } = setup();
    fireEvent.click(await screen.findByRole('button', { name: en.historyTitle }));
    const part = await findPart(view.container, 'history');
    expect(part.querySelectorAll('li')).toHaveLength(10);
    fireEvent.click(within(part).getByRole('button', { name: en.showMore }));
    expect(part.querySelectorAll('li')).toHaveLength(14);
    expect(within(part).queryByRole('button', { name: en.showMore })).toBeNull();
  });

  it('refuses a malformed month and offers a retry, and says when the pockets did not load', async () => {
    setup({ [`GET /banking/statement/${KID_A}`]: ok({ statement: { month: '2026-09', earned: -1, spent: 0, adjusted: 0, given: 0, saved: 0, entries: [] } }) });
    fireEvent.click(await screen.findByRole('button', { name: en.monthTitle }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.readFailed);
    expect(screen.getByRole('button', { name: en.retry })).toBeInTheDocument();
  });

  it('shows a retry when the pockets did not load', async () => {
    const { transport } = setup({ [`GET /tasks/${KID_A}/wallet`]: refuse('DATA_UNAVAILABLE') });
    expect(await screen.findByRole('alert')).toHaveTextContent(en.coinsFailed);
    fireEvent.click(screen.getByRole('button', { name: en.retry }));
    await waitFor(() => expect(transport.calls.filter((c) => c.path === `/tasks/${KID_A}/wallet`)).toHaveLength(2));
  });

  it('re-reads the pockets and the open parts after a coin movement elsewhere on the screen', async () => {
    const { transport, rerender } = setup();
    fireEvent.click(await screen.findByRole('button', { name: en.historyTitle }));
    await screen.findAllByText(en.reasons.allowance);
    await act(async () => rerender(1));
    await waitFor(() => expect(transport.calls.filter((c) => c.path === `/tasks/${KID_A}/wallet/ledger`)).toHaveLength(2));
    expect(transport.calls.filter((c) => c.path === `/tasks/${KID_A}/wallet`)).toHaveLength(2);
    // The month was never opened: it is still never read.
    expect(transport.calls.some((c) => c.path.startsWith('/banking/statement'))).toBe(false);
  });
});

describe('coinsApi: the Tutor month and its window', () => {
  it("mirrors Core's paging window: this month and 23 before it, never a later one", () => {
    expect(monthInWindow('2026-09', '2026-09')).toBe(true);
    expect(monthInWindow('2024-10', '2026-09')).toBe(true);
    expect(monthInWindow('2024-09', '2026-09')).toBe(false);
    expect(monthInWindow('2026-10', '2026-09')).toBe(false);
    expect(monthInWindow('2026-13', '2026-09')).toBe(false);
  });

  it.each([
    ['a guardian correction without its reason', { entries: [line(1, 'manual_adjustment', -2)] }],
    ['an unknown reason', { entries: [line(1, 'bank_transfer', 2)] }],
    ['no such month', { month: '2026-13' }],
    ['a fractional total', { spent: 1.5 }],
  ])('refuses %s', async (_label, over) => {
    const transport = fakeTransport({ [`GET /banking/statement/${KID_A}`]: ok({ statement: { month: '2026-09', earned: 1, spent: 0, adjusted: 0, given: 0, saved: 1, entries: [], ...over } }) });
    expect(await fetchChildMonth(transport, KID_A, null)).toEqual({ ok: false, code: 'INVALID_RESPONSE' });
  });
});
