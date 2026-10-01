import { selectOption } from '../test/selectOption';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeenWallet } from './TeenWallet';
import type { Session, TransportResult } from './walletApi';
import en from '@/i18n/en-US/teenWallet.json';
import habits from '@/i18n/en-US/moneyHabits.json';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';

/*
 * S07.2 rebuilt surface (D.3, OD-3 Option B): the teen's own wallet renders
 * only what the server returned, logs income and its split in one request
 * (never naming a holder: Core takes the caller), shows a refusal as a
 * refusal, keeps Tasks locked until a parent is linked, and lets the teen
 * confirm a parent who accepted the teen's own invite. Every text node
 * declares its copy role; no celebration is rendered.
 */

const GOAL = '11111111-1111-4111-8111-111111111111';
const REWARD = '22222222-2222-4222-8222-222222222222';
const ACTION = '33333333-3333-4333-8333-333333333333';
const LINK = '44444444-4444-4444-8444-444444444444';

interface Call { path: string; method: string; body: unknown }
type Answer = TransportResult | ((body: unknown) => TransportResult);

function fakeSession(overrides: Record<string, Answer> = {}) {
  const calls: Call[] = [];
  const base: Record<string, Answer> = {
    'GET /wallet/access': { data: { holder: 'teen', familyChild: false }, error: null },
    'GET /tasks/wallet': { data: { balances: { save: 10, spend: 6, share: 4 } }, error: null },
    'GET /tasks/goals': { data: { goals: [{ id: GOAL, title: 'Headphones', target: 20, icon: 'star', status: 'active', reachedAt: null, followsGoalId: null, saved: 10,
      progress: { own: 10, bonus: 0, family: 0, total: 10 }, nextStep: null }] }, error: null },
    'GET /tasks/wallet/split': { data: { usual: { save: 50, spend: 40, share: 10 }, custom: false, recommended: { save: 50, spend: 40, share: 10 } }, error: null },
    'GET /tasks/share': { data: { destinations: [], gifts: [] }, error: null },
    'GET /wallet/rewards': { data: { rewards: [{ id: REWARD, title: 'Movie night', cost: 5, status: 'active', createdAt: '2026-09-24T00:00:00Z', archivedAt: null }] }, error: null },
    'GET /tasks/wallet/ledger': { data: { entries: [
      { id: 2, bucket: 'spend', amount: -5, reason: 'personal_reward', note: null, source: null, rewardTitle: 'Movie night', createdAt: '2026-09-24T00:00:00Z' },
      { id: 1, bucket: 'save', amount: 10, reason: 'self_income', note: null, source: 'earned', rewardTitle: null, createdAt: '2026-09-23T00:00:00Z' },
    ] }, error: null },
    'GET /wallet/guardians': { data: { guardians: [] }, error: null },
    'POST /wallet/income': { data: { actionId: ACTION, goal: null }, error: null },
  };
  const answers = { ...base, ...overrides };
  const session: Session = {
    token: 'session',
    transport: vi.fn(async (path: string, options: { method?: string; body?: unknown }) => {
      const method = options.method ?? 'GET';
      calls.push({ path, method, body: options.body });
      const answer = answers[`${method} ${path}`];
      if (!answer) return { data: null, error: { code: 'NOT_STUBBED' } };
      return typeof answer === 'function' ? answer(options.body) : answer;
    }),
  };
  return { session, calls };
}

function renderWallet(session: Session, extra: Partial<Parameters<typeof TeenWallet>[0]> = {}) {
  const props = {
    copy: en, habits, locale: 'en-US', dark: false, session, tasksHref: '/tasks', onOpenTasks: vi.fn(),
    inviteLinkFor: (token: string) => `https://app.test/family?join=${token}`, copyText: vi.fn(async () => true), onAccessChanged: vi.fn(), ...extra,
  };
  return { props, view: render(<TeenWallet {...props} />) };
}

function everyTextHasARole(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}

async function ready() {
  await screen.findByText('20 coins');
}

describe('TeenWallet', () => {
  it('shows the server\'s balances with one simulation chip and keeps every section closed', async () => {
    const { session } = fakeSession();
    const { view } = renderWallet(session);
    await ready();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.page.title);
    expect(screen.getAllByText(en.page.simulation)).toHaveLength(1);
    const save = view.container.querySelector('[data-pocket="save"]') as HTMLElement;
    // The balance is a coin quantity: the coin mark, the number and the word (02 §9.5).
    expect(within(save).getByText('10 coins')).toBeVisible();
    expect(save.querySelector('img[data-asset-id="money.coin"]')).not.toBeNull();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(view.container.querySelector('[data-age-band="13-17"]')).not.toBeNull();
    everyTextHasARole(view.container);
  });

  it('refuses to render a wallet the server did not classify as a teen\'s', async () => {
    const { session } = fakeSession({ 'GET /wallet/access': { data: { holder: null, familyChild: false }, error: null } });
    renderWallet(session);
    expect(await screen.findByText(en.page.failed)).toBeVisible();
    expect(screen.queryByText('20 coins')).toBeNull();
  });

  it('logs income and its split in ONE request, naming no holder, with no approval step', async () => {
    const { session, calls } = fakeSession();
    renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.income.open }));
    fireEvent.change(screen.getByLabelText(en.income.amount), { target: { value: '12' } });
    // Where it came from is a pick-one choice: the shared SegmentedControl (S03.6), so the chosen source is a checked radio.
    fireEvent.click(screen.getByRole('radio', { name: en.income.gift }));
    expect(screen.getByRole('radio', { name: en.income.gift })).toBeChecked();
    fireEvent.change(screen.getByLabelText(en.page.save), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(en.page.spend), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(en.page.share), { target: { value: '2' } });
    expect(screen.getByText(en.income.done)).toBeVisible();
    selectOption(screen.getByLabelText(en.income.toGoal), 'Headphones');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.income.submit })); });
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toEqual([{ path: '/wallet/income', method: 'POST', body: { source: 'gift', save: 6, spend: 4, share: 2, goalId: GOAL } }]);
    // Bible 02 §9.2 / K18 (GAP-FIX-R4): the confirmation names where every coin went, as a status only (no celebration).
    expect(await screen.findByText('Added 12 coins: 6 to Save, 4 to Spend, 2 to Share.')).toBeVisible();
    expect(document.querySelector('[data-celebration]')).toBeNull();
  });

  it('draws the split bar under the income pockets, live, and marks every pocket with its own icon (02 §4.3)', async () => {
    const { session } = fakeSession();
    renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.income.open }));
    fireEvent.change(screen.getByLabelText(en.income.amount), { target: { value: '12' } });
    const bar = document.querySelector('[data-split-bar]') as HTMLElement;
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    const grow = () => [...bar.querySelectorAll<HTMLElement>('[data-split-segment]')].map((s) => `${s.dataset.splitSegment}:${s.style.flexGrow}`);
    expect(grow()).toEqual(['save:6', 'spend:5', 'share:1']);
    fireEvent.change(screen.getByLabelText(en.page.save), { target: { value: '2' } });
    expect(grow()).toEqual(['save:2', 'spend:5', 'share:1', 'left:4']);
    for (const pocket of document.querySelectorAll('[data-teen-wallet="root"] [data-pocket]')) {
      expect(pocket.querySelector(`img[data-asset-id="pocket.${pocket.getAttribute('data-pocket')}.icon"]`), pocket.outerHTML.slice(0, 80)).not.toBeNull();
    }
  });

  it('asks to split every coin before sending anything, and validates the amount', async () => {
    const { session, calls } = fakeSession();
    renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.income.open }));
    fireEvent.change(screen.getByLabelText(en.income.amount), { target: { value: '12' } });
    // S07.4 (D.13): the amount arrives pre-split by the usual split (50 / 40 / 10 -> 6 / 5 / 1).
    expect(screen.getByLabelText(en.page.save)).toHaveValue(6);
    expect(screen.getByLabelText(en.page.spend)).toHaveValue(5);
    expect(screen.getByLabelText(en.page.share)).toHaveValue(1);
    fireEvent.change(screen.getByLabelText(en.page.save), { target: { value: '2' } });
    expect(screen.getByText('4 coins left to split')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: en.income.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent('Split all 12 coins first.');
    fireEvent.change(screen.getByLabelText(en.income.amount), { target: { value: '1001' } });
    fireEvent.click(screen.getByRole('button', { name: en.income.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(en.income.invalidAmount);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('shows a freeze a linked parent placed as a refusal, never as added coins', async () => {
    const { session } = fakeSession({ 'POST /wallet/income': { data: null, error: { code: 'ACCOUNT_FROZEN' } } });
    renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.income.open }));
    fireEvent.change(screen.getByLabelText(en.income.amount), { target: { value: '3' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.income.submit })); });
    expect(screen.getByRole('alert')).toHaveTextContent(en.income.frozen);
    expect(screen.queryByText(/^Added 3 coins/)).toBeNull();
  });

  it('announces a goal the income reached in the income notice (the celebration belongs to the goal, once)', async () => {
    const { session } = fakeSession({ 'POST /wallet/income': { data: { actionId: ACTION, goal: { id: GOAL, title: 'Headphones', target: 20, status: 'reached', saved: 20 } }, error: null } });
    const { view } = renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.income.open }));
    fireEvent.change(screen.getByLabelText(en.income.amount), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(en.page.save), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(en.page.spend), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(en.page.share), { target: { value: '0' } });
    selectOption(screen.getByLabelText(en.income.toGoal), 'Headphones');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.income.submit })); });
    expect(await screen.findByRole('status')).toHaveTextContent('Goal reached: Headphones.');
    expect(view.container.querySelector('[data-celebration], canvas')).toBeNull();
  });

  it('uses a personal reward at once and shows "not enough coins" when the database refuses', async () => {
    const { session, calls } = fakeSession({
      [`POST /wallet/rewards/${REWARD}/claim`]: { data: null, error: { code: 'INSUFFICIENT_BALANCE' } },
    });
    renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.rewards.open }));
    expect(screen.getByText('Movie night')).toBeVisible();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.rewards.use })); });
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual([`/wallet/rewards/${REWARD}/claim`]);
    expect(screen.getByRole('alert')).toHaveTextContent(en.rewards.notEnough);
  });

  it('validates a new reward before sending it', async () => {
    const { session, calls } = fakeSession({ 'POST /wallet/rewards': { data: { rewardId: REWARD }, error: null } });
    renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.rewards.open }));
    fireEvent.change(screen.getByLabelText(en.rewards.name), { target: { value: 'Concert' } });
    fireEvent.change(screen.getByLabelText(en.rewards.cost), { target: { value: '501' } });
    fireEvent.click(screen.getByRole('button', { name: en.rewards.create }));
    expect(screen.getByRole('alert')).toHaveTextContent(en.rewards.invalid);
    fireEvent.change(screen.getByLabelText(en.rewards.cost), { target: { value: '40' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.rewards.create })); });
    expect(calls.filter((c) => c.method === 'POST')).toEqual([{ path: '/wallet/rewards', method: 'POST', body: { title: 'Concert', cost: 40 } }]);
  });

  it('moves coins out of the teen\'s own goal, and never more than it holds', async () => {
    const { session, calls } = fakeSession({ [`POST /wallet/goals/${GOAL}/release`]: { data: { actionId: ACTION }, error: null } });
    renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.goals.open }));
    // S07.4 (D.16): the bar names its provenance.
    expect(screen.getByRole('img', { name: 'Headphones: 10 of 20. All yours' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: en.goals.move }));
    fireEvent.change(screen.getByLabelText(en.goals.moveAmount), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: en.goals.confirmMove }));
    expect(screen.getByRole('alert')).toHaveTextContent('This goal holds 10 coins.');
    fireEvent.change(screen.getByLabelText(en.goals.moveAmount), { target: { value: '4' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.goals.confirmMove })); });
    expect(calls.filter((c) => c.method === 'POST')).toEqual([{ path: `/wallet/goals/${GOAL}/release`, method: 'POST', body: { amount: 4, destination: 'spend' } }]);
  });

  it('labels the teen\'s own history entries, with the reward they used and where income came from', async () => {
    const { session } = fakeSession();
    const { view } = renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.history.open }));
    const reward = view.container.querySelector('[data-ledger-reason="personal_reward"]') as HTMLElement;
    expect(within(reward).getByText(en.history.reward)).toBeVisible();
    expect(within(reward).getByText('Movie night')).toBeVisible();
    const income = view.container.querySelector('[data-ledger-reason="self_income"]') as HTMLElement;
    expect(within(income).getByText(en.history.earned)).toBeVisible();
    everyTextHasARole(view.container);
  });

  it('keeps Tasks locked until a parent is linked, and invites a parent with a copyable link', async () => {
    const { session } = fakeSession({ 'POST /wallet/guardian-invite': { data: { token: 'a'.repeat(32), expiresAt: '2026-10-01T00:00:00Z' }, error: null } });
    const { props } = renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.parents.open }));
    expect(screen.getByText(en.parents.tasksLocked)).toBeVisible();
    expect(screen.queryByText(en.parents.openTasks)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.parents.invite })); });
    expect(screen.getByText(`https://app.test/family?join=${'a'.repeat(32)}`)).toBeVisible();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.parents.copy })); });
    expect(props.copyText).toHaveBeenCalledWith(`https://app.test/family?join=${'a'.repeat(32)}`);
    expect(screen.getByRole('button', { name: en.parents.copied })).toBeVisible();
  });

  it('lets the teen confirm only a parent who accepted the teen\'s OWN invite, then refreshes access', async () => {
    const pending = { linkId: LINK, displayName: 'Ana', status: 'pending', since: '2026-09-24T00:00:00Z', decidedAt: null, awaitingMe: true };
    const other = { ...pending, linkId: '55555555-5555-4555-8555-555555555555', displayName: 'Rosa', awaitingMe: false };
    const { session, calls } = fakeSession({
      'GET /wallet/guardians': { data: { guardians: [pending, other] }, error: null },
      [`POST /wallet/guardians/${LINK}/decision`]: { data: { linkId: LINK, status: 'verified' }, error: null },
    });
    const { props, view } = renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.parents.open }));
    expect(screen.getAllByRole('button', { name: en.parents.confirm })).toHaveLength(1);
    expect(screen.getByText('Rosa: waiting')).toBeVisible();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.parents.confirm })); });
    expect(calls.filter((c) => c.method === 'POST')).toEqual([{ path: `/wallet/guardians/${LINK}/decision`, method: 'POST', body: { decision: 'confirm' } }]);
    await waitFor(() => expect(props.onAccessChanged).toHaveBeenCalledOnce());
    everyTextHasARole(view.container);
  });

  it('shows Tasks as on once a parent is linked', async () => {
    const { session } = fakeSession({ 'GET /wallet/access': { data: { holder: 'teen', familyChild: true }, error: null } });
    const { props } = renderWallet(session);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: en.parents.open }));
    fireEvent.click(screen.getByRole('link', { name: en.parents.openTasks }));
    expect(props.onOpenTasks).toHaveBeenCalledOnce();
  });

  it('renders in the dark theme with the same structure', async () => {
    const { session } = fakeSession();
    const { view } = renderWallet(session, { dark: true });
    await ready();
    expect(view.container.querySelector('.lf-teen-wallet')).toHaveAttribute('data-theme', 'dark');
  });
});

/*
 * W2F.2: the /wallet screen's page states on the design system (offline,
 * refused, ours to fix, each with the right way forward) and the page's
 * companions beside the wallet.
 */
describe('TeenWallet on the /wallet screen (W2F.2)', () => {
  const screenCopy = rebuildNamespaceCopy['en-US'].family.teenWalletScreen;
  const screenProps = (onNavigate = vi.fn()) => ({ screen: { copy: screenCopy, learnHref: '/learn', onNavigate }, aside: <p data-copy-role="data">companions</p> });

  it('explains a refusal with the way back, never a retry', async () => {
    const onNavigate = vi.fn();
    const { session } = fakeSession({ 'GET /wallet/access': { data: { holder: null, familyChild: false }, error: null } });
    renderWallet(session, screenProps(onNavigate));
    await screen.findByRole('heading', { level: 2, name: screenCopy.refusedTitle });
    expect(screen.queryByRole('button', { name: screenCopy.retry })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: screenCopy.refusedAction }));
    expect(onNavigate).toHaveBeenCalledWith('/learn');
  });

  it('says "offline" for a network failure and loads on a retry', async () => {
    let offline = true;
    const { session } = fakeSession({ 'GET /tasks/wallet': () => offline ? { data: null, error: { code: 'NETWORK' } }
      : { data: { balances: { save: 10, spend: 6, share: 4 } }, error: null } });
    renderWallet(session, screenProps());
    expect(await screen.findByText(screenCopy.offlineBody)).toBeInTheDocument();
    offline = false;
    fireEvent.click(screen.getByRole('button', { name: screenCopy.retry }));
    await ready();
    expect(screen.getByText('companions')).toBeInTheDocument();
  });

  it('calls any other failure ours to fix', async () => {
    const { session } = fakeSession({ 'GET /wallet/rewards': { data: null, error: { code: 'DATA_UNAVAILABLE' } } });
    renderWallet(session, screenProps());
    expect(await screen.findByText(screenCopy.failedBody)).toBeInTheDocument();
  });
});
