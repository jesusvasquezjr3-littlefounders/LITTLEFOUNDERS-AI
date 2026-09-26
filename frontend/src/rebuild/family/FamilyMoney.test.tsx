import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChoreComposer } from './ChoreComposer';
import { ChoreStreak } from './ChoreStreak';
import { StreakPauses, pauseIsValid } from './StreakPauses';
import { SavingsBonusSettings } from './SavingsBonusSettings';
import { SavingsBonusExplainer } from './SavingsBonusExplainer';
import { previewBonus, type ChoreStreak as Streak, type KidBonus, type OwnBonus } from './familyMoneyApi';
import type { Session, TransportResult } from './familyHubApi';
import en from '@/i18n/en-US/familyMoney.json';

/*
 * S07.3 rebuilt surfaces (D.2, D.10, D.11), rendered from server truth. The
 * composer makes the Tutor choose a kind (nothing preselected) and mirrors
 * the server's coin bounds; the streak never frames a lapse as a loss and
 * celebrates only the OD-7 milestones; the pause mirrors the server's
 * bounds; the bonus shows a fixed 1-per-10 to under-13s (never a percent)
 * and a worked example to 13-17s. Every rendered text node declares its
 * copy role.
 */

const KID = '22222222-2222-4222-8222-222222222222';
const KID_B = '33333333-3333-4333-8333-333333333333';

function everyTextHasARole(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}

function session(answer: (path: string, options: { method?: string; body?: unknown }) => TransportResult) {
  const transport = vi.fn(async (path: string, options: { token: string; method?: string; body?: unknown }) => answer(path, options));
  return { session: { token: 't', transport } as unknown as Session, transport };
}

// ── D.10 ────────────────────────────────────────────────────────────────────

describe('ChoreComposer (D.10)', () => {
  const kids = [{ id: KID, name: 'Nico' }, { id: KID_B, name: 'Lu' }];

  function open(answer = (_: string, o: { body?: unknown }) => ({ data: { task: { id: '44444444-4444-4444-8444-444444444444', title: 'Set the table', assignedTo: KID, ...(o.body as object) } }, error: null } as TransportResult)) {
    const s = session(answer);
    const onCreated = vi.fn();
    const view = render(<ChoreComposer copy={en.choreComposer} locale="en-US" dark={false} kids={kids} session={s.session} onCreated={onCreated} />);
    fireEvent.click(screen.getByRole('button', { name: en.choreComposer.open }));
    return { ...s, onCreated, view };
  }

  it('offers both kinds as a deliberate choice, with neither preselected', () => {
    const { view } = open();
    expect(screen.getByText(en.choreComposer.choice)).toBeVisible();
    expect(view.container.querySelectorAll('[data-kind]')).toHaveLength(2);
    const kinds = within(screen.getByRole('group', { name: en.choreComposer.kindLegend })).getAllByRole('radio');
    expect(kinds).toHaveLength(2);
    for (const kind of kinds) expect(kind).not.toBeChecked();
    expect(screen.getByText(en.choreComposer.contributionHint)).toBeVisible();
    expect(screen.getByText(en.choreComposer.bonusHint)).toBeVisible();
    everyTextHasARole(view.container);
  });

  it('refuses to submit before a kind is chosen, without calling the server', async () => {
    const { transport } = open();
    fireEvent.change(screen.getByLabelText(en.choreComposer.title), { target: { value: 'Set the table' } });
    fireEvent.click(screen.getByRole('button', { name: en.choreComposer.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.choreComposer.needKind);
    expect(transport).not.toHaveBeenCalled();
  });

  it('creates an unpaid family contribution for the chosen child', async () => {
    const { transport, onCreated } = open();
    fireEvent.change(screen.getByLabelText(en.choreComposer.child), { target: { value: KID } });
    fireEvent.change(screen.getByLabelText(en.choreComposer.title), { target: { value: '  Set the table ' } });
    fireEvent.click(screen.getByRole('radio', { name: en.choreComposer.contribution }));
    expect(screen.getByRole('radio', { name: en.choreComposer.none })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: en.choreComposer.submit }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(transport).toHaveBeenCalledWith('/tasks', expect.objectContaining({
      method: 'POST',
      body: { assignedTo: KID, title: 'Set the table', kind: 'contribution', rewardCoins: 0, recurrence: 'once', requiresEvidence: false },
    }));
    expect(screen.getByRole('status')).toHaveTextContent('Added: Set the table');
  });

  it('never offers more than 2 token coins for a contribution, and bounds a bonus task to 1-500', async () => {
    const { transport } = open();
    fireEvent.change(screen.getByLabelText(en.choreComposer.title), { target: { value: 'Wash the car' } });
    fireEvent.click(screen.getByRole('radio', { name: en.choreComposer.contribution }));
    const tokens = within(screen.getByRole('group', { name: en.choreComposer.tokenCoins })).getAllByRole('radio');
    expect(tokens.map((radio) => radio.closest('label')?.textContent)).toEqual([en.choreComposer.none, '1', '2']);
    fireEvent.click(screen.getByRole('radio', { name: en.choreComposer.bonus }));
    fireEvent.change(screen.getByLabelText(en.choreComposer.coins), { target: { value: '501' } });
    fireEvent.click(screen.getByRole('button', { name: en.choreComposer.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.choreComposer.coinsRange);
    expect(transport).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(en.choreComposer.coins), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: en.choreComposer.submit }));
    await waitFor(() => expect(transport).toHaveBeenCalledWith('/tasks', expect.objectContaining({ body: expect.objectContaining({ kind: 'bonus', rewardCoins: 40 }) })));
  });

  it('reports a failed save and never claims the chore was added', async () => {
    open(() => ({ data: null, error: { code: 'DATA_UNAVAILABLE' } }));
    fireEvent.change(screen.getByLabelText(en.choreComposer.title), { target: { value: 'Rake' } });
    fireEvent.click(screen.getByRole('radio', { name: en.choreComposer.contribution }));
    fireEvent.click(screen.getByRole('button', { name: en.choreComposer.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.choreComposer.failed);
  });
});

// ── D.2 ─────────────────────────────────────────────────────────────────────

const streak = (over: Partial<Streak> = {}): Streak => ({
  status: 'alive', current: 4, best: 9, totalDays: 30, restDaysLeftThisWeek: 1, restDaysPerWeek: 2, pausedUntil: null, today: '2026-09-24', ...over,
});

describe('ChoreStreak (D.2)', () => {
  const renderStreak = (s: Streak | null, milestone: 'streak-7' | 'streak-30' | 'streak-100' | null = null) => render(
    <ChoreStreak copy={en.choreStreak} locale="en-US" dark={false} streak={s} loading={false} failed={false} milestone={milestone} onRetry={vi.fn()} />);

  it('shows the running streak, the best, the rest days left and the total', () => {
    const { container } = renderStreak(streak());
    expect(screen.getByText('4 days')).toBeVisible();
    expect(screen.getByText(en.choreStreak.alive)).toBeVisible();
    expect(screen.getByText('Best: 9 days')).toBeVisible();
    expect(screen.getByText('Rest days left this week: 1')).toBeVisible();
    expect(screen.getByText('Days with chores done: 30')).toBeVisible();
    expect(container.querySelector('[data-milestone]')).toBeNull();
    everyTextHasARole(container);
  });

  it('shows a lapse as "Streak resting" with the best still visible, never as a loss', () => {
    const { container } = renderStreak(streak({ status: 'resting', current: 0 }));
    expect(screen.getByText(en.choreStreak.resting)).toBeVisible();
    expect(screen.getByText('Best: 9 days')).toBeVisible();
    expect(container.textContent).not.toMatch(/lost|lose|0 days/i);
  });

  it('shows a holiday pause as plain status instead of rest days', () => {
    renderStreak(streak({ pausedUntil: '2026-09-30' }));
    expect(screen.getByText('Paused until Sep 30')).toBeVisible();
    expect(screen.queryByText(/Rest days left/)).toBeNull();
  });

  it('celebrates only an OD-7 milestone that matches the current streak', () => {
    const reached = renderStreak(streak({ status: 'practised_today', current: 7, best: 9 }), 'streak-7');
    expect(reached.container.querySelector('[data-milestone="streak-7"]')).not.toBeNull();
    expect(screen.getByText('7-day chore streak!')).toBeVisible();
    reached.unmount();
    const stale = renderStreak(streak({ status: 'practised_today', current: 8, best: 9 }), 'streak-7');
    expect(stale.container.querySelector('[data-milestone]')).toBeNull();
  });

  it('invites a first chore when there is no streak yet', () => {
    renderStreak(streak({ status: 'none', current: 0, best: 0, totalDays: 0 }));
    expect(screen.getByText(en.choreStreak.none)).toBeVisible();
  });
});

describe('StreakPauses (D.2, Bible 02 §9.6 rule 3)', () => {
  it('mirrors the server bounds: 1-21 days, starting up to 7 days back', () => {
    expect(pauseIsValid('2026-09-24', '2026-09-24', '2026-09-24')).toBe(true);
    expect(pauseIsValid('2026-09-17', '2026-10-07', '2026-09-24')).toBe(true);
    expect(pauseIsValid('2026-09-16', '2026-09-17', '2026-09-24')).toBe(false);
    expect(pauseIsValid('2026-09-24', '2026-10-15', '2026-09-24')).toBe(false);
    expect(pauseIsValid('2026-09-25', '2026-09-24', '2026-09-24')).toBe(false);
  });

  const props = () => ({
    copy: en.streakPauses, locale: 'en-US', dark: false, kidName: 'Nico', open: true, loading: false, failed: false, busy: false, notice: null,
    streak: streak(), pauses: [{ id: '55555555-5555-4555-8555-555555555555', startsOn: '2026-09-23', endsOn: '2026-09-28', state: 'running' as const },
      { id: '66666666-6666-4666-8666-666666666666', startsOn: '2026-10-10', endsOn: '2026-10-12', state: 'upcoming' as const }],
    onToggle: vi.fn(), onRetry: vi.fn(), onPause: vi.fn(), onEnd: vi.fn(),
  });

  it('lists running and upcoming pauses with the right action, and refuses an invalid range locally', () => {
    const p = props();
    const { container } = render(<StreakPauses {...p} />);
    const running = container.querySelector('[data-pause-state="running"]') as HTMLElement;
    fireEvent.click(within(running).getByRole('button', { name: en.streakPauses.end }));
    expect(p.onEnd).toHaveBeenCalledWith(p.pauses[0]);
    const upcoming = container.querySelector('[data-pause-state="upcoming"]') as HTMLElement;
    expect(within(upcoming).getByRole('button', { name: en.streakPauses.cancel })).toBeVisible();
    fireEvent.change(screen.getByLabelText(en.streakPauses.from), { target: { value: '2026-09-10' } });
    fireEvent.change(screen.getByLabelText(en.streakPauses.to), { target: { value: '2026-09-12' } });
    fireEvent.click(screen.getByRole('button', { name: en.streakPauses.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(en.streakPauses.invalid);
    expect(p.onPause).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(en.streakPauses.from), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText(en.streakPauses.to), { target: { value: '2026-10-05' } });
    fireEvent.click(screen.getByRole('button', { name: en.streakPauses.submit }));
    expect(p.onPause).toHaveBeenCalledWith({ startsOn: '2026-10-01', endsOn: '2026-10-05' });
    everyTextHasARole(container);
  });
});

// ── D.11 ────────────────────────────────────────────────────────────────────

describe('SavingsBonusSettings (D.11)', () => {
  const perTen: KidBonus = { framing: 'per_ten', perTen: { unit: 10, coins: 1 }, maxRateBp: null,
    rule: { rateBp: 1000, active: true, nextRunAt: '2026-10-01T00:00:00Z', reframedFromRateBp: 2000 } };
  const percent: KidBonus = { framing: 'percent', perTen: null, maxRateBp: 2000, rule: { rateBp: 1500, active: true, nextRunAt: '2026-10-01T00:00:00Z', reframedFromRateBp: null } };
  const renderSettings = (bonus: KidBonus, onSave = vi.fn()) => ({ onSave, view: render(<SavingsBonusSettings copy={en.bonusSettings} locale="en-US" dark={false}
    kidName="Nico" open loading={false} failed={false} busy={false} notice={null} bonus={bonus} onToggle={vi.fn()} onRetry={vi.fn()} onSave={onSave} />) });

  it('offers a younger child only the fixed 1-per-10 on or off, says what changed, and saves no rate', () => {
    const { onSave, view } = renderSettings(perTen);
    expect(screen.getByText(en.bonusSettings.perTenBody)).toBeVisible();
    expect(screen.queryByLabelText(en.bonusSettings.rate)).toBeNull();
    expect(screen.getByText('Changed from 20% to 1 coin for every 10 saved.')).toBeVisible();
    expect(screen.getByText('100 coins saved: 10 more next week')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: en.bonusSettings.save }));
    expect(onSave).toHaveBeenCalledWith({ active: true });
    everyTextHasARole(view.container);
  });

  it('tells the Tutor a low old rate was switched off until they agree', () => {
    renderSettings({ ...perTen, rule: { ...perTen.rule!, active: false, reframedFromRateBp: 500 } });
    expect(screen.getByText('Your 5% bonus is off now. The new rule needs your yes.')).toBeVisible();
  });

  it('offers a 13-17 child a whole percent from 0 to 20, previewed', () => {
    const { onSave } = renderSettings(percent);
    const rate = screen.getByLabelText(en.bonusSettings.rate);
    expect(rate).toHaveValue(15);
    expect(screen.getByText('100 coins saved: 15 more next week')).toBeVisible();
    fireEvent.change(rate, { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: en.bonusSettings.save }));
    expect(screen.getByRole('alert')).toHaveTextContent(en.bonusSettings.invalidRate);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(rate, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: en.bonusSettings.save }));
    expect(onSave).toHaveBeenCalledWith({ active: true, rateBp: 800 });
    expect(screen.getByText(en.bonusSettings.notInterest)).toBeVisible();
  });
});

describe('SavingsBonusExplainer (D.11)', () => {
  const young: OwnBonus = { framing: 'per_ten', perTen: { unit: 10, coins: 1 }, maxRateBp: null, rule: { rateBp: 1000, active: true, nextRunAt: '2026-10-01T00:00:00Z' },
    saved: 57, nextBonus: 5, example: null };
  const teen: OwnBonus = { framing: 'percent', perTen: null, maxRateBp: 2000, rule: { rateBp: 1500, active: true, nextRunAt: '2026-10-01T00:00:00Z' },
    saved: 57, nextBonus: 8, example: { shown: false, completed: false } };
  const renderExplainer = (bonus: OwnBonus, onAnswer: (input: { exampleSaved: number; answer: number }) => Promise<boolean | null> = vi.fn(async () => true), onExampleShown = vi.fn()) => ({
    onAnswer, onExampleShown,
    view: render(<SavingsBonusExplainer young={en.bonusYoung} teen={en.bonusTeen} locale="en-US" dark={false} bonus={bonus} loading={false} failed={false}
      onRetry={vi.fn()} onExampleShown={onExampleShown} onAnswer={onAnswer} />),
  });

  it('shows a younger child their own coins in groups of ten, each earning one, and never a percent', () => {
    const { view } = renderExplainer(young);
    expect(screen.getByText(en.bonusYoung.rule)).toBeVisible();
    expect(screen.getByText('You have 57 coins saved.')).toBeVisible();
    expect(view.container.querySelectorAll('[data-group="ten"]')).toHaveLength(5);
    expect(view.container.querySelector('[data-group="rest"]')).toHaveTextContent('7');
    expect(screen.getByText('Next week: 5 more coins.')).toBeVisible();
    expect(view.container.textContent).not.toMatch(/%/);
    expect(screen.queryByRole('button')).toBeNull();
    everyTextHasARole(view.container);
  });

  it('says so when no bonus is on', () => {
    renderExplainer({ ...young, rule: { ...young.rule!, active: false }, nextBonus: 0 });
    expect(screen.getByText(en.bonusYoung.off)).toBeVisible();
  });

  it('gives a teen the percent, why it grows, the honest disclaimer and a worked example checked by the server', async () => {
    const onAnswer = vi.fn(async ({ answer }: { exampleSaved: number; answer: number }) => answer === 30);
    const { view, onExampleShown } = renderExplainer(teen, onAnswer);
    expect(screen.getByText('Your family adds 15% of your Save pocket each week.')).toBeVisible();
    expect(screen.getByText('57 coins saved: 8 more next week')).toBeVisible();
    expect(screen.getByText(en.bonusTeen.compounding)).toBeVisible();
    expect(screen.getByText(en.bonusTeen.notInterest)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: en.bonusTeen.open }));
    expect(onExampleShown).toHaveBeenCalledOnce();
    expect(screen.getByText('With 200 coins saved at 15%, how many bonus coins would you get?')).toBeVisible();
    fireEvent.change(screen.getByLabelText(en.bonusTeen.answer), { target: { value: '20' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.bonusTeen.check })); });
    // A wrong answer is a "not yet" in the retry tone (announced as status), never the error hue (Bible 02 §4.2).
    expect(screen.getByRole('status')).toHaveTextContent(en.bonusTeen.wrong);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.change(screen.getByLabelText(en.bonusTeen.answer), { target: { value: '30' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.bonusTeen.check })); });
    expect(onAnswer).toHaveBeenLastCalledWith({ exampleSaved: 200, answer: 30 });
    expect(screen.getByRole('status')).toHaveTextContent('Right: 200 × 15 ÷ 100 = 30');
    expect(view.container.querySelector('[data-milestone]')).toBeNull();
    everyTextHasARole(view.container);
  });

  it('never uses the teen\'s own balance as the example (the answer is already on screen)', () => {
    renderExplainer({ ...teen, saved: 200, nextBonus: 30 });
    fireEvent.click(screen.getByRole('button', { name: en.bonusTeen.open }));
    expect(screen.getByText('With 300 coins saved at 15%, how many bonus coins would you get?')).toBeVisible();
  });

  it('computes previews with the credit\'s own arithmetic', () => {
    expect(previewBonus('per_ten', 57, 2000)).toBe(5);
    expect(previewBonus('per_ten', 9, 1000)).toBe(0);
    expect(previewBonus('percent', 57, 1500)).toBe(8);
    expect(previewBonus('percent', -4, 1500)).toBe(0);
  });
});
