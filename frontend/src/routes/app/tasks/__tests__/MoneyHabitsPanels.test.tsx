import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AllocationPanel } from '../AllocationPanel';
import { SavingsGoalsPanel } from '../SavingsGoalsPanel';
import { ShareGivingPanel } from '../ShareGivingPanel';
import { UsualSplitPanel } from '../UsualSplitPanel';
import { ShareDestinationsPanel } from '../../family/ShareDestinationsPanel';
import en from '@/i18n/en-US/moneyHabits.json';

/*
 * S07.4 data planes (D.13-D.16): each binds a rebuilt surface to Core through
 * the shared client, sends exactly the body Core expects (never a holder id),
 * re-reads after every write, and maps a refusal to honest copy.
 */

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { resolvedLanguage: 'en-US' } }) }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));

const KID = '11111111-1111-4111-8111-111111111111';
const TASK = '22222222-2222-4222-8222-222222222222';
const GOAL = '33333333-3333-4333-8333-333333333333';
const DEST = '44444444-4444-4444-8444-444444444444';
const GIFT = '55555555-5555-4555-8555-555555555555';
const T = '2026-09-24T00:00:00.000Z';
const USUAL = { usual: { save: 50, spend: 40, share: 10 }, custom: false, recommended: { save: 50, spend: 40, share: 10 } };
const goal = (over: Record<string, unknown> = {}) => ({
  id: GOAL, title: 'Bike', target: 50, icon: 'bike', status: 'active', reachedAt: null, followsGoalId: null, saved: 20,
  progress: { own: 20, bonus: 0, family: 0, total: 20 }, nextStep: null, ...over,
});

type Route = Record<string, unknown | ((body: unknown) => unknown)>;
function serve(routes: Route) {
  mockApi.mockImplementation(async (path: string, options: { method?: string; body?: unknown }) => {
    const key = `${options.method ?? 'GET'} ${path}`;
    const answer = routes[key];
    if (answer === undefined) return { data: null, error: { code: 'NOT_STUBBED' } };
    const data = typeof answer === 'function' ? (answer as (b: unknown) => unknown)(options.body) : answer;
    return data && typeof data === 'object' && 'error' in (data as object) ? data : { data, error: null };
  });
}
const posted = (path: string) => mockApi.mock.calls.filter(([p, o]) => p === path && (o as { method?: string }).method !== undefined && (o as { method?: string }).method !== 'GET');

beforeEach(() => { mockApi.mockReset(); });

describe('AllocationPanel (D.13)', () => {
  it('loads nothing until opened, then keeps the usual split with one tap and reports the goal it reached', async () => {
    const onDone = vi.fn();
    serve({ 'GET /tasks/wallet/split': USUAL, 'GET /tasks/goals': { goals: [goal()] },
      [`POST /tasks/${TASK}/allocate`]: { allocated: true, goal: goal({ status: 'reached', saved: 50, progress: { own: 50, bonus: 0, family: 0, total: 50 } }) } });
    render(<AllocationPanel token="t" kind="task" id={TASK} amount={10} title="Dishes" onDone={onDone} />);
    expect(mockApi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.split.splitNow }));
    fireEvent.click(await screen.findByRole('button', { name: en.split.use }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: GOAL, status: 'reached' })));
    expect(posted(`/tasks/${TASK}/allocate`)[0]![1]).toEqual({ token: 't', method: 'POST', body: { save: 5, spend: 4, share: 1, goalId: null } });
  });

  it('splits an allowance through the banking route and shows a freeze as a refusal', async () => {
    const onDone = vi.fn();
    serve({ 'GET /tasks/wallet/split': USUAL, 'GET /tasks/goals': { goals: [] },
      'POST /banking/wallet/pending-credits/c1/allocate': { error: { code: 'ACCOUNT_FROZEN' } } });
    render(<AllocationPanel token="t" kind="credit" id="c1" amount={20} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: en.split.splitNow }));
    fireEvent.click(await screen.findByRole('button', { name: en.split.use }));
    expect(await screen.findByText(en.split.frozen)).toBeVisible();
    expect(onDone).not.toHaveBeenCalled();
    expect(posted('/banking/wallet/pending-credits/c1/allocate')[0]![1]).toMatchObject({ body: { save: 10, spend: 8, share: 2, goalId: null } });
  });

  it('keeps the split control closed while the account is frozen', () => {
    render(<AllocationPanel token="t" kind="credit" id="c1" amount={20} frozen onDone={vi.fn()} />);
    expect(screen.getByRole('button', { name: en.split.splitNow })).toBeDisabled();
  });
});

describe('SavingsGoalsPanel (D.15, D.16)', () => {
  it('celebrates a reached goal once, then starts the next goal that follows it and re-reads', async () => {
    let reads = 0;
    serve({
      'GET /tasks/goals': () => { reads++; return { goals: [goal({ status: 'reached', saved: 50, progress: { own: 45, bonus: 5, family: 0, total: 50 }, nextStep: reads > 1 ? { state: 'set', nextGoalId: DEST } : { state: 'pending', nextGoalId: null } })] }; },
      [`POST /tasks/goals/${GOAL}/next-step/seen`]: { celebrate: true },
      'POST /tasks/goals': { goal: goal({ id: DEST, title: 'Skates', followsGoalId: GOAL, saved: 0, progress: { own: 0, bonus: 0, family: 0, total: 0 } }) },
    });
    const view = render(<SavingsGoalsPanel token="t" refreshKey={0} />);
    expect(await screen.findByText('You reached Bike!')).toBeVisible();
    expect(screen.getByText('Yours: 45')).toBeVisible();
    expect(screen.getByText('Bonus: 5')).toBeVisible();
    fireEvent.change(screen.getAllByLabelText(en.nextGoal.name)[0]!, { target: { value: 'Skates' } });
    fireEvent.change(screen.getAllByLabelText(en.nextGoal.target)[0]!, { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: en.nextGoal.start }));
    expect(await screen.findByText(en.nextGoal.started)).toBeVisible();
    expect(posted('/tasks/goals')[0]![1]).toEqual({ token: 't', method: 'POST', body: { title: 'Skates', target: 80, followsGoalId: GOAL } });
    await waitFor(() => expect(view.container.querySelector('[data-money-habits="next-goal"]')).toBeNull());
  });

  it('shows the failure copy rather than a goal without its provenance', async () => {
    serve({ 'GET /tasks/goals': { goals: [{ ...goal(), progress: undefined }] } });
    render(<SavingsGoalsPanel token="t" refreshKey={0} />);
    expect(await screen.findByText(en.goals.failed)).toBeVisible();
  });
});

describe('ShareGivingPanel (D.14)', () => {
  it('pledges to a place with the Share balance as the limit, then re-reads', async () => {
    const onChanged = vi.fn();
    serve({
      'GET /tasks/share': { destinations: [{ id: DEST, title: 'Food bank', kind: 'charity', chosenBy: 'tutor', status: 'active', createdAt: T }], gifts: [] },
      'GET /tasks/wallet': { balances: { save: 5, spend: 2, share: 6 } },
      'POST /tasks/share/gifts': { giftId: GIFT },
    });
    render(<ShareGivingPanel token="t" refreshKey={0} onChanged={onChanged} />);
    expect(await screen.findByText('6 coins in Share')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Food bank' }));
    fireEvent.change(screen.getByLabelText(en.share.amount), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: en.share.give }));
    expect(await screen.findByText(en.share.pledged)).toBeVisible();
    expect(posted('/tasks/share/gifts')[0]![1]).toEqual({ token: 't', method: 'POST', body: { destinationId: DEST, amount: 4 } });
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('UsualSplitPanel (D.13)', () => {
  it('saves the child\'s own split as percent through PUT', async () => {
    serve({ 'GET /tasks/wallet/split': USUAL, 'PUT /tasks/wallet/split': { usual: { save: 40, spend: 40, share: 20 }, custom: true, recommended: USUAL.recommended } });
    render(<UsualSplitPanel token="t" />);
    fireEvent.click(screen.getByRole('button', { name: en.usualSplit.open }));
    fireEvent.click(await screen.findByRole('button', { name: 'Take from Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Share' }));
    fireEvent.click(screen.getByRole('button', { name: en.usualSplit.submit }));
    expect(await screen.findByText(en.usualSplit.saved)).toBeVisible();
    expect(posted('/tasks/wallet/split')[0]![1]).toEqual({ token: 't', method: 'PUT', body: { save: 40, spend: 40, share: 20 } });
  });
});

describe('ShareDestinationsPanel (D.14, Tutor)', () => {
  it('records what the family did for a pledge, with the note, and names the child in the confirmation', async () => {
    serve({
      [`GET /tasks/${KID}/share`]: { destinations: [{ id: DEST, title: 'Food bank', kind: 'charity', chosenBy: 'tutor', status: 'active', createdAt: T }],
        gifts: [{ id: GIFT, destinationId: DEST, amount: 4, status: 'pledged', pledgedAt: T, settledAt: null, settledBy: null, note: null }] },
      [`GET /tasks/${KID}/wallet/split`]: USUAL,
      [`POST /tasks/${KID}/share/gifts/${GIFT}/settle`]: { outcome: 'given' },
    });
    render(<ShareDestinationsPanel kidUserId={KID} kidName="Nico" token="t" />);
    expect(mockApi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.destinations.open }));
    fireEvent.click(await screen.findByRole('button', { name: en.destinations.markGiven }));
    fireEvent.change(screen.getByLabelText(en.destinations.whatHappened), { target: { value: 'We bought rice together' } });
    fireEvent.click(screen.getByRole('button', { name: en.destinations.confirm }));
    expect(await screen.findByText('Done. Nico will see your note.')).toBeVisible();
    expect(posted(`/tasks/${KID}/share/gifts/${GIFT}/settle`)[0]![1]).toEqual({ token: 't', method: 'POST', body: { outcome: 'given', note: 'We bought rice together' } });
  });

  it('explains the ten-place limit honestly', async () => {
    serve({
      [`GET /tasks/${KID}/share`]: { destinations: [], gifts: [] },
      [`GET /tasks/${KID}/wallet/split`]: USUAL,
      [`POST /tasks/${KID}/share/destinations`]: { error: { code: 'SHARE_DESTINATION_LIMIT' } },
    });
    render(<ShareDestinationsPanel kidUserId={KID} kidName="Nico" token="t" />);
    fireEvent.click(screen.getByRole('button', { name: en.destinations.open }));
    fireEvent.change(await screen.findByLabelText(en.destinations.placeName), { target: { value: 'Park' } });
    fireEvent.click(screen.getByRole('button', { name: en.destinations.community }));
    fireEvent.click(screen.getByRole('button', { name: en.destinations.add }));
    expect(await screen.findByText(en.destinations.limit)).toBeVisible();
  });
});
