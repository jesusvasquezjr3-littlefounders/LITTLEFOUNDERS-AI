import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup as cleanupAll, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import copyEn from '../../i18n/en-US/coinAccount.json';
import regEn from '../../i18n/en-US/moneyRegister.json';
import familyMoneyEn from '../../i18n/en-US/familyMoney.json';
import habitsEn from '../../i18n/en-US/moneyHabits.json';
import { CoinAccount, pocketPercents } from './CoinAccount';
import { TutorFreeze } from './TutorFreeze';
import {
  FREEZE_HOLDS, fetchCoinAccount, fetchCoinMonth, fetchTutorFreeze, shiftMonth, isCoinAccountView, isMonth, isSpendLimit, setOwnFreeze, type CoinAccountView,
} from './bankingApi';
import { fetchMoneyRegister, REGISTER_POLICY, registerCopy, type MoneyRegister } from '../family/moneyRegister';
import { GoalProgress } from '../family/GoalProgress';
import { UsualSplit } from '../family/UsualSplit';
import { SavingsBonusExplainer } from '../family/SavingsBonusExplainer';
import type { Session, TransportResult } from '../family/familyHubApi';

/*
 * S07.6 rebuilt surfaces (D.7, D.12).
 * D.7: the card is a declared practice card with no number; the freeze lists
 * only the holds the server declares; a child is never offered a way to lift
 * a Tutor's freeze; every control is registered (data-control).
 * D.12: the same components in three registers: numbers, tone and detail
 * follow the register the server sends, and the API layer refuses any answer
 * carrying numbers its register does not give. Every text node declares its
 * copy role; nothing celebrates.
 */

const REGISTRY = JSON.parse(readFileSync(join(process.cwd(), '../docs/operations/block-d-controls.json'), 'utf8')) as { controls: { id: string }[] };
const CONTROL_IDS = new Set(REGISTRY.controls.map((c) => c.id));

function everyTextHasARole(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}
function everyControlIsRegistered(container: HTMLElement) {
  for (const el of container.querySelectorAll('[data-control]')) expect(CONTROL_IDS.has(el.getAttribute('data-control')!), el.getAttribute('data-control')!).toBe(true);
}
function session(answer: (path: string, options: { method?: string; body?: unknown }) => TransportResult) {
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  const s: Session = { token: 't', transport: (path, options) => { calls.push({ path, method: options.method, body: options.body }); return Promise.resolve(answer(path, options)); } };
  return { s, calls };
}

const freeze = (frozen = false, by: 'you' | 'tutor' | null = null) => ({
  frozen, by, since: frozen ? '2026-09-20T00:00:00.000Z' : null, holds: [...FREEZE_HOLDS], canChange: !frozen || by === 'you',
});
const views: Record<MoneyRegister, CoinAccountView> = {
  young: {
    register: 'young', account: { nickname: 'Rocket', design: 'emerald', simulated: true, freeze: freeze() }, pockets: { save: 20, spend: 15, share: 5 },
    pendingCredits: 0, spendLimit: { configured: true, period: 'weekly', remaining: 5 }, statement: { month: '2026-09', earned: 30, spent: 10, saved: 20 },
  },
  transition: {
    register: 'transition', account: { nickname: 'Rocket', design: 'ocean', simulated: true, freeze: freeze() }, pockets: { save: 20, spend: 15, share: 5 },
    pendingCredits: 0, spendLimit: { configured: true, period: 'weekly', remaining: 5, cap: 20, used: 15 },
    statement: { month: '2026-09', earned: 30, spent: 10, saved: 20, given: 2, adjusted: 0 },
  },
  teen: {
    register: 'teen', account: { nickname: 'Rocket', design: 'violet', simulated: true, freeze: freeze() }, pockets: { save: 20, spend: 15, share: 5 },
    pendingCredits: 0, spendLimit: { configured: true, period: 'weekly', remaining: 5, cap: 20, used: 15, usedPercent: 75 },
    statement: { month: '2026-09', earned: 30, spent: 10, saved: 20, given: 2, adjusted: 1,
      lines: [{ id: 1, bucket: 'save', amount: 5, reason: 'task_approved', createdAt: '2026-09-20T00:00:00.000Z' },
        { id: 2, bucket: 'spend', amount: -4, reason: 'redemption', createdAt: '2026-09-21T00:00:00.000Z' }] },
  },
};

function renderAccount(register: MoneyRegister, view: CoinAccountView = views[register], onFreeze = vi.fn()) {
  const result = render(<CoinAccount copy={copyEn[register]} register={register} locale="en-US" dark={false} view={view} loading={false} failed={false}
    busy={false} notice={null} onRetry={() => undefined} onFreeze={onFreeze} />);
  return { ...result, onFreeze };
}

describe('CoinAccount (D.7, D.12)', () => {
  for (const register of ['young', 'transition', 'teen'] as const) {
    it(`is a declared practice card with no card number, in the ${register} register`, () => {
      const { container } = renderAccount(register);
      const card = container.querySelector('[data-control="simulation"]')!;
      expect(within(card as HTMLElement).getByText('Practice card')).toBeInTheDocument();
      expect(screen.getByText(copyEn[register].coinsOnly)).toBeInTheDocument();
      expect(container.textContent).not.toMatch(/LF-\d{4}|\d{4}\s\d{4}/);
      expect(container.querySelector('[data-register]')!.getAttribute('data-register')).toBe(register);
      everyTextHasARole(container);
      everyControlIsRegistered(container);
      expect(container.querySelector('[data-celebration], .lf-confetti')).toBeNull();
    });
  }

  it('frames numbers per register: young reads what is left and no percentage', () => {
    const { container } = renderAccount('young');
    expect(screen.getByText('You can spend 5 more coins for now.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/%|of 20|of your/);
    expect(container.querySelector('.lf-coin-meter')).toBeNull();
    expect(container.querySelector('.lf-coin-lines')).toBeNull();
  });

  it('frames numbers per register: transition reads used of the cap and "of your" totals, never a percentage', () => {
    const { container } = renderAccount('transition');
    expect(screen.getByText('15 of 20 coins spent in the last 7 days. 5 left.')).toBeInTheDocument();
    expect(screen.getByText('20 of your 40')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/%/);
    expect(container.querySelector('.lf-coin-meter')).not.toBeNull();
  });

  it('frames numbers per register: teen reads percentages and the latest lines', () => {
    const { container } = renderAccount('teen');
    expect(screen.getByText('15 of 20 spent in the last 7 days (75%). 5 left.')).toBeInTheDocument();
    expect(screen.getByText('50% of 40')).toBeInTheDocument();
    const lines = container.querySelector('.lf-coin-lines')!;
    expect(within(lines as HTMLElement).getByText('Chore')).toBeInTheDocument();
    expect(within(lines as HTMLElement).getByText('-4')).toBeInTheDocument();
  });

  it('teen pocket percentages always add up to 100', () => {
    for (const pockets of [{ save: 20, spend: 15, share: 5 }, { save: 1, spend: 1, share: 1 }, { save: 7, spend: 0, share: 0 }, { save: 0, spend: 0, share: 0 }]) {
      const p = pocketPercents(pockets);
      expect(p.save + p.spend + p.share, JSON.stringify(pockets)).toBe(pockets.save + pockets.spend + pockets.share === 0 ? 0 : 100);
    }
    renderAccount('teen');
    expect(screen.getByText('38% of 40')).toBeInTheDocument();
    expect(screen.getByText('12% of 40')).toBeInTheDocument();
  });

  it('lists only the holds the server declares, and says nothing is lost', () => {
    const view = { ...views.young, account: { ...views.young.account!, freeze: { ...freeze(), holds: ['rewards' as const] } } };
    const { container } = renderAccount('young', view);
    expect(container.querySelectorAll('[data-hold]')).toHaveLength(1);
    expect(screen.getByText('Rewards')).toBeInTheDocument();
    expect(screen.queryByText('Share gifts')).toBeNull();
    expect(screen.getByText('Nothing is lost.')).toBeInTheDocument();
  });

  it('offers the child "Unfreeze" only for their own freeze', () => {
    const own = renderAccount('young', { ...views.young, account: { ...views.young.account!, freeze: freeze(true, 'you') } });
    fireEvent.click(screen.getByRole('button', { name: 'Unfreeze' }));
    expect(own.onFreeze).toHaveBeenCalledWith(false);
    own.unmount();
    const tutor = renderAccount('young', { ...views.young, account: { ...views.young.account!, freeze: freeze(true, 'tutor') } });
    expect(screen.queryByRole('button', { name: 'Unfreeze' })).toBeNull();
    expect(screen.getByText('Only your Tutor can unfreeze it.')).toBeInTheDocument();
    expect(screen.getByText('Your Tutor froze it.')).toBeInTheDocument();
    expect(tutor.onFreeze).not.toHaveBeenCalled();
  });

  // GAP-FIX-R5 (06 §3.1, §4.4; D.7): the frozen first view fits the 6-9 budget; "Why?" opens who froze it, what pauses and who can lift it.
  it('keeps a Tutor freeze\'s details one press away and never offers the child a way to lift it', () => {
    const view = { ...views.young, pendingCredits: 1, account: { ...views.young.account!, freeze: freeze(true, 'tutor') } };
    const { container } = renderAccount('young', view);
    expect(within(container.querySelector('[data-control="simulation"]') as HTMLElement).getByText('Frozen')).toBeInTheDocument();
    const why = screen.getByRole('button', { name: 'Why?' });
    const panel = document.getElementById(why.getAttribute('aria-controls')!)!;
    expect(why).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toBeVisible();
    expect(within(panel).getByText('Your Tutor froze it.')).toBeInTheDocument();
    expect(within(panel).getByText(copyEn.young.onlyTutor)).toHaveAttribute('data-control', 'freeze.owner');
    expect(within(panel).getByText(copyEn.young.waitingFrozen)).toBeInTheDocument();
    expect(panel.querySelectorAll('[data-hold]')).toHaveLength(FREEZE_HOLDS.length);
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Unfreeze' })).toBeNull();
    everyTextHasARole(container);
    everyControlIsRegistered(container);
  });

  it('does not say what is left to spend while a freeze holds reward requests, and says it again once it does not', () => {
    const frozen = renderAccount('young', { ...views.young, account: { ...views.young.account!, freeze: freeze(true, 'you') } });
    expect(frozen.container.querySelector('[data-control="spend_limit"]')).toBeNull();
    expect(screen.queryByText('You can spend 5 more coins for now.')).toBeNull();
    frozen.unmount();
    const partial = { ...freeze(true, 'you'), holds: FREEZE_HOLDS.filter((h) => h !== 'rewards') };
    renderAccount('young', { ...views.young, account: { ...views.young.account!, freeze: partial } });
    expect(screen.getByText('You can spend 5 more coins for now.')).toBeInTheDocument();
  });

  it('asks before nothing: a child freezes in one tap and the page re-reads', () => {
    const { onFreeze } = renderAccount('transition');
    fireEvent.click(screen.getByRole('button', { name: 'Freeze' }));
    expect(onFreeze).toHaveBeenCalledWith(true);
  });

  it('says there is no card yet, and still shows the pockets', () => {
    renderAccount('young', { ...views.young, account: null });
    expect(screen.getByText('Your Tutor has not opened your card yet.')).toBeInTheDocument();
    expect(screen.getByText('20 coins')).toBeInTheDocument();
  });
});

describe('Another month of the statement (F5-K, W2F.3)', () => {
  const pageable = (month: Parameters<typeof CoinAccount>[0]['month'] = null) => {
    const onMonth = vi.fn();
    const view = render(<CoinAccount copy={copyEn.young} register="young" locale="en-US" dark={false} view={views.young} loading={false} failed={false}
      busy={false} notice={null} onRetry={() => {}} onFreeze={() => {}} month={month} onMonth={onMonth} />);
    return { onMonth, view };
  };

  it('this month offers only the month before (two words on the first view), never a month ahead', () => {
    const { onMonth, view } = pageable();
    expect(screen.getByRole('heading', { name: copyEn.young.monthHeading })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copyEn.young.nextMonth })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: copyEn.young.prevMonth }));
    expect(onMonth).toHaveBeenCalledWith('2026-08');
    everyTextHasARole(view.container);
  });

  it('shows another month by name with its own totals, and "Next month" returns to this month', () => {
    const { onMonth } = pageable({ statement: { month: '2026-08', earned: 7, spent: 3, saved: 4 }, loading: false, failed: false });
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
    const month = screen.getByRole('heading', { name: 'August 2026' }).closest('section')!;
    expect(within(month).getByText('7')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copyEn.young.nextMonth }));
    expect(onMonth).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: copyEn.young.prevMonth }));
    expect(onMonth).toHaveBeenCalledWith('2026-07');
  });

  it('stops at the oldest month Core serves, and says a month failed without inventing one', () => {
    pageable({ statement: { month: shiftMonth('2026-09', -23), earned: 0, spent: 0, saved: 0 }, loading: false, failed: false });
    expect(screen.queryByRole('button', { name: copyEn.young.prevMonth })).toBeNull();
    cleanupAll();
    pageable({ statement: null, loading: false, failed: true });
    expect(screen.getByText(copyEn.young.monthFailed)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: copyEn.young.monthHeading })).toBeInTheDocument();
  });

  it('offers no paging where the page gives no way to read a month', () => {
    render(<CoinAccount copy={copyEn.young} register="young" locale="en-US" dark={false} view={views.young} loading={false} failed={false}
      busy={false} notice={null} onRetry={() => {}} onFreeze={() => {}} />);
    expect(screen.queryByRole('button', { name: copyEn.young.prevMonth })).toBeNull();
  });

  it('refuses a month whose numbers exceed the register Core declared with it', async () => {
    const young = session(() => ({ data: { register: 'young', statement: { month: '2026-08', earned: 1, spent: 0, saved: 1 } }, error: null }));
    expect(await fetchCoinMonth('2026-08', young.s)).toEqual({ ok: true, data: { register: 'young', statement: { month: '2026-08', earned: 1, spent: 0, saved: 1 } } });
    expect(young.calls[0]!.path).toBe('/banking/overview/month?month=2026-08');
    const leaky = session(() => ({ data: { register: 'young', statement: { month: '2026-08', earned: 1, spent: 0, saved: 1, given: 0, adjusted: 0 } }, error: null }));
    expect((await fetchCoinMonth('2026-08', leaky.s)).ok).toBe(false);
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
  });
});

describe('TutorFreeze (D.7)', () => {
  const tutorView = (frozen: boolean, by: 'you' | 'tutor' | 'child' | null) => ({
    register: 'transition' as const,
    account: { nickname: 'Rocket', design: 'indigo' as const, simulated: true as const, freeze: { ...freeze(frozen, null), by, canChange: true } },
  });

  it('confirms before freezing, names who froze it and which view the child reads', () => {
    const onFreeze = vi.fn();
    const { container, rerender } = render(<TutorFreeze copy={copyEn.tutor} name="Ana" locale="en-US" dark view={tutorView(false, null)} loading={false} failed={false}
      busy={false} notice={null} onRetry={() => undefined} onFreeze={onFreeze} />);
    expect(screen.getByText('Ana sees the ages 10-12 view.')).toBeInTheDocument();
    expect(container.querySelector('.lf-coin-holds')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Freeze' }));
    expect(onFreeze).not.toHaveBeenCalled();
    expect(container.querySelector('.lf-coin-holds')).toBeVisible();
    fireEvent.click(within(screen.getByRole('group')).getByRole('button', { name: 'Freeze' }));
    expect(onFreeze).toHaveBeenCalledWith(true);
    rerender(<TutorFreeze copy={copyEn.tutor} name="Ana" locale="en-US" dark view={tutorView(true, 'child')} loading={false} failed={false}
      busy={false} notice={null} onRetry={() => undefined} onFreeze={onFreeze} />);
    expect(screen.getByText('Ana froze it.')).toBeInTheDocument();
    expect(screen.getByText('A freeze moves no coins.')).toBeInTheDocument();
    // GAP-FIX-R5 (06 §3.1): while frozen, what a freeze holds is one press away; it is shown at the confirmation (the point of action).
    const holds = screen.getByRole('button', { name: 'What it holds' });
    expect(document.getElementById(holds.getAttribute('aria-controls')!)).not.toBeVisible();
    fireEvent.click(holds);
    expect(document.getElementById(holds.getAttribute('aria-controls')!)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Unfreeze' }));
    expect(onFreeze).toHaveBeenLastCalledWith(false);
    everyTextHasARole(container);
    everyControlIsRegistered(container);
  });
});

describe('bankingApi shape checks (D.7, D.12)', () => {
  it('accepts each register\'s own shape', () => {
    for (const register of ['young', 'transition', 'teen'] as const) expect(isCoinAccountView(views[register]), register).toBe(true);
  });

  it('refuses numbers a register is not given', () => {
    expect(isSpendLimit({ configured: true, period: 'weekly', remaining: 5, cap: 20, used: 15 }, 'young')).toBe(false);
    expect(isSpendLimit({ configured: true, period: 'weekly', remaining: 5, cap: 20, used: 15, usedPercent: 75 }, 'transition')).toBe(false);
    expect(isSpendLimit({ configured: true, period: 'weekly', remaining: 9, cap: 20, used: 15 }, 'transition')).toBe(false);
    expect(isMonth({ month: '2026-09', earned: 1, spent: 1, saved: 1, given: 0, adjusted: 0 }, 'young')).toBe(false);
    expect(isMonth({ ...views.transition.statement, lines: [] }, 'transition')).toBe(false);
    expect(isCoinAccountView({ ...views.young, register: 'adult' })).toBe(false);
  });

  it('refuses a card that is not a declared simulation, carries a number, or claims a hold nobody enforces', () => {
    const card = views.young.account!;
    expect(isCoinAccountView({ ...views.young, account: { ...card, simulated: false } })).toBe(false);
    expect(isCoinAccountView({ ...views.young, account: { ...card, displayNumber: 'LF-1234-5678' } })).toBe(false);
    expect(isCoinAccountView({ ...views.young, account: { ...card, freeze: { ...card.freeze, holds: ['rewards', 'withdrawals'] } } })).toBe(false);
    expect(isCoinAccountView({ ...views.young, account: { ...card, freeze: { ...card.freeze, holds: [] } } })).toBe(false);
    expect(isCoinAccountView({ ...views.young, account: { ...card, freeze: { ...freeze(true, null) } } })).toBe(false);
    expect(isCoinAccountView({ ...views.young, account: { ...card, freeze: { ...freeze(true, 'tutor'), canChange: true } } })).toBe(false);
    expect(isCoinAccountView({ ...views.young, account: { ...card, freeze: { ...freeze(false), by: 'tutor' } } })).toBe(false);
  });

  it('reads the account and the register from Core, and re-reads after a freeze', async () => {
    const { s, calls } = session((path, options) => {
      if (path === '/banking/overview') return { data: views.teen, error: null };
      if (path === '/banking/register') return { data: { register: 'teen' }, error: null };
      if (path === '/banking/account/freeze' && options.method === 'POST') return { data: { account: { frozen: true } }, error: null };
      return { data: null, error: { code: 'NOT_FOUND' } };
    });
    expect(await fetchCoinAccount(s)).toEqual({ ok: true, data: views.teen });
    expect(await fetchMoneyRegister(s)).toEqual({ ok: true, data: 'teen' });
    expect((await setOwnFreeze(true, s)).ok).toBe(true);
    expect(calls.at(-1)).toEqual({ path: '/banking/account/freeze', method: 'POST', body: { frozen: true } });
    // A write that answers the wrong state is not reported as done.
    expect((await setOwnFreeze(false, s)).ok).toBe(false);
  });

  it('refuses an unknown register and a Tutor view with a stray field', async () => {
    const { s } = session((path) => path === '/banking/register'
      ? { data: { register: 'grownup' }, error: null }
      : { data: { register: 'young', account: null, extra: 1 }, error: null });
    expect(await fetchMoneyRegister(s)).toEqual({ ok: false, code: 'INVALID_RESPONSE' });
    expect(await fetchTutorFreeze('kid', s)).toEqual({ ok: false, code: 'INVALID_RESPONSE' });
  });
});

describe('Existing money surfaces in each register (D.12)', () => {
  const split = { ...habitsEn.usualSplit, save: 'Save', spend: 'Spend', share: 'Share', more: 'Add to {pocket}', less: 'Take from {pocket}' };
  const usual = { usual: { save: 50, spend: 40, share: 10 }, recommended: { save: 50, spend: 40, share: 10 }, custom: false };

  it('UsualSplit reads "5 of 10", then "of 100", then a percentage', () => {
    const cases: [MoneyRegister, string][] = [['young', '5 of 10'], ['transition', 'so 50 of 100'], ['teen', '50%']];
    for (const [register, text] of cases) {
      const { unmount, container } = render(<UsualSplit register={register} copy={registerCopy(split, regEn.usualSplit, register)} locale="en-US" dark={false} open
        loading={false} failed={false} value={usual} busy={false} notice={null} onToggle={() => undefined} onRetry={() => undefined} onSave={() => undefined} />);
      expect(screen.getByText(text), register).toBeInTheDocument();
      if (register !== 'teen') expect(container.textContent).not.toMatch(/%/);
      unmount();
    }
  });

  it('GoalProgress reads coins, then coins to go, then a percentage; provenance is unchanged', () => {
    const progress = { total: 12, own: 10, bonus: 2, family: 0 };
    const cases: [MoneyRegister, string][] = [['young', '12 of 30 coins'], ['transition', '12 of 30 coins, 18 to go'], ['teen', '12 of 30 coins (40%)']];
    for (const [register, text] of cases) {
      const { unmount, container } = render(<GoalProgress copy={registerCopy(habitsEn.goalProgress, regEn.goalProgress, register)} title="Bike" target={30} progress={progress} />);
      expect(screen.getByText(text), register).toBeInTheDocument();
      expect(container.querySelector('[data-goal-progress="provenance"]')!.getAttribute('data-bonus')).toBe('2');
      unmount();
    }
  });

  it('the per-ten bonus gains the "out of 100" bridge only in the transition register', () => {
    const bonus = { rule: { rateBp: 1000, active: true, nextRunAt: '2026-09-27T00:00:00.000Z' }, framing: 'per_ten' as const, perTen: { unit: 10, coins: 1 },
      maxRateBp: null, saved: 30, nextBonus: 3, example: null };
    const props = { young: familyMoneyEn.bonusYoung, teen: familyMoneyEn.bonusTeen, locale: 'en-US', dark: false, bonus, loading: false, failed: false,
      onRetry: () => undefined, onExampleShown: () => undefined, onAnswer: async () => null };
    const { rerender } = render(<SavingsBonusExplainer {...props} scaffold={regEn.bonus.transition.scaffold} />);
    expect(screen.getByText(regEn.bonus.transition.scaffold)).toBeInTheDocument();
    rerender(<SavingsBonusExplainer {...props} scaffold={null} />);
    expect(screen.queryByText(regEn.bonus.transition.scaffold)).toBeNull();
  });
});

describe('Register policy (D.12)', () => {
  it('every child-facing component in rebuild/family and rebuild/banking declares a register policy', () => {
    const components = ['family', 'banking', 'wallet'].flatMap((dir) => readdirSync(join(process.cwd(), 'src/rebuild', dir))
      .filter((f) => /^[A-Z]\w+\.tsx$/.test(f) && !f.endsWith('.test.tsx')).map((f) => f.replace('.tsx', '')));
    for (const name of components) expect(REGISTER_POLICY[name], name).toBeDefined();
    for (const name of Object.keys(REGISTER_POLICY)) expect(components, name).toContain(name);
  });

  it('every register-aware component really takes the register', () => {
    for (const [name, { policy }] of Object.entries(REGISTER_POLICY)) {
      if (policy !== 'register') continue;
      const dir = ['family', 'banking', 'wallet'].find((d) => readdirSync(join(process.cwd(), 'src/rebuild', d)).includes(`${name}.tsx`))!;
      const source = readFileSync(join(process.cwd(), 'src/rebuild', dir, `${name}.tsx`), 'utf8');
      expect(source, name).toMatch(/register|GoalProgress|scaffold|pct/);
    }
  });
});
