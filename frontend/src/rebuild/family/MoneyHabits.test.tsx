import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../i18n/en-US/moneyHabits.json';
import { GoalNextStep } from './GoalNextStep';
import { GoalProgress } from './GoalProgress';
import { SavingsGoals } from './SavingsGoals';
import { ShareDestinations } from './ShareDestinations';
import { ShareGiving } from './ShareGiving';
import { SplitChooser } from './SplitChooser';
import { UsualSplit } from './UsualSplit';
import {
  allocateTask, createHabitGoal, fetchHabitGoals, fetchShare, fetchUsualSplit, pledgeGift, saveUsualSplit, settleKidGift, splitCoins,
  type Destination, type Gift, type HabitGoal, type ShareView,
} from './moneyHabitsApi';
import type { Session, TransportResult } from './familyHubApi';

/*
 * S07.4 rebuilt surfaces (D.13-D.16): the payout arrives pre-split by the
 * child's own usual split and keeping it is one tap; the usual split is shown
 * out of 10, never as a percentage; every goal bar shows its provenance; a
 * reached goal celebrates only when the server says it is the first view and
 * carries "what's your next goal?"; the Share pocket has real places and a
 * Tutor's note. Every text node declares its copy role.
 */

const GOAL = '11111111-1111-4111-8111-111111111111';
const DEST = '22222222-2222-4222-8222-222222222222';
const GIFT = '33333333-3333-4333-8333-333333333333';
const T = '2026-09-24T00:00:00.000Z';

function everyTextHasARole(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}

const goal = (over: Partial<HabitGoal> = {}): HabitGoal => ({
  id: GOAL, title: 'Bike', target: 50, icon: 'bike', status: 'active', reachedAt: null, followsGoalId: null, saved: 20,
  progress: { own: 20, bonus: 0, family: 0, total: 20 }, nextStep: null, ...over,
});
const USUAL = { save: 50, spend: 40, share: 10 };
const splitCopy = en.split;

describe('splitCoins (D.13 parity with the database)', () => {
  it('gives the same coins as wallet_split_coins() for every fixture case', () => {
    const fixture = JSON.parse(readFileSync(join(process.cwd(), '../database/scripts/fixtures/split-coins.json'), 'utf8')) as {
      cases: { amount: number; pct: typeof USUAL; coins: typeof USUAL }[];
    };
    expect(fixture.cases.length).toBeGreaterThanOrEqual(200);
    for (const c of fixture.cases) expect(splitCoins(c.amount, c.pct), JSON.stringify(c)).toEqual(c.coins);
  });
});

describe('SplitChooser (D.13)', () => {
  it('offers the payout pre-split by the usual split and keeps it with one tap', () => {
    const onSubmit = vi.fn();
    const view = render(<SplitChooser copy={splitCopy} locale="en-US" dark={false} amount={12} usual={USUAL} goals={[]} busy={false} notice={null} onSubmit={onSubmit} />);
    const pockets = view.container.querySelectorAll('[data-pocket]');
    expect([...pockets].map((p) => p.textContent)).toEqual(['Save6', 'Spend5', 'Share1']);
    fireEvent.click(screen.getByRole('button', { name: splitCopy.use }));
    expect(onSubmit).toHaveBeenCalledWith({ save: 6, spend: 5, share: 1 }, null);
    everyTextHasARole(view.container);
  });

  it('lets the child change any pocket, refuses a split that does not place every coin, and accepts everything in one pocket', () => {
    const onSubmit = vi.fn();
    render(<SplitChooser copy={splitCopy} locale="en-US" dark={false} amount={10} usual={USUAL} goals={[]} busy={false} notice={null} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: splitCopy.change }));
    fireEvent.change(screen.getByLabelText('Save'), { target: { value: '0' } });
    expect(screen.getByText('5 left to place')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: splitCopy.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent('Place all 10 coins first.');
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Spend'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Take from Share' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Spend' }));
    expect(screen.getByText(splitCopy.placed)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: splitCopy.submit }));
    expect(onSubmit).toHaveBeenCalledWith({ save: 0, spend: 10, share: 0 }, null);
  });

  it('puts the Save part toward an active goal only when chosen', () => {
    const onSubmit = vi.fn();
    render(<SplitChooser copy={splitCopy} locale="en-US" dark={false} amount={10} usual={USUAL} goals={[goal(), goal({ id: DEST, status: 'reached', title: 'Old' })]} busy={false} notice={null} onSubmit={onSubmit} />);
    const select = screen.getByLabelText(splitCopy.toGoal);
    expect(within(select).queryByText('Old')).toBeNull();
    fireEvent.change(select, { target: { value: GOAL } });
    fireEvent.click(screen.getByRole('button', { name: splitCopy.use }));
    expect(onSubmit).toHaveBeenCalledWith({ save: 5, spend: 4, share: 1 }, GOAL);
  });
});

describe('UsualSplit (D.13)', () => {
  const copy = { ...en.usualSplit, save: 'Save', spend: 'Spend', share: 'Share', more: splitCopy.more, less: splitCopy.less };
  const value = { usual: { save: 60, spend: 30, share: 10 }, custom: true, recommended: USUAL };

  it('shows the split out of 10, never as a percentage, and saves the change as percent', () => {
    const onSave = vi.fn();
    const view = render(<UsualSplit copy={copy} locale="en-US" dark={false} open loading={false} failed={false} value={value} busy={false} notice={null} onToggle={vi.fn()} onRetry={vi.fn()} onSave={onSave} />);
    expect(view.container.textContent).toContain('6 of 10');
    expect(view.container.textContent).not.toMatch(/%/);
    expect(screen.getByRole('button', { name: copy.submit })).toBeDisabled();
    // Each pocket is a shared Stepper: its buttons are named "<pocket>: <action>".
    fireEvent.click(screen.getByRole('button', { name: 'Save: Take from Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.mustBe10);
    fireEvent.click(screen.getByRole('button', { name: 'Share: Add to Share' }));
    fireEvent.click(screen.getByRole('button', { name: copy.submit }));
    expect(onSave).toHaveBeenCalledWith({ save: 50, spend: 30, share: 20 });
    everyTextHasARole(view.container);
  });

  it('brings back the suggested split with one tap', () => {
    const onSave = vi.fn();
    render(<UsualSplit copy={copy} locale="en-US" dark={false} open loading={false} failed={false} value={value} busy={false} notice={null} onToggle={vi.fn()} onRetry={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: copy.suggested }));
    fireEvent.click(screen.getByRole('button', { name: copy.submit }));
    expect(onSave).toHaveBeenCalledWith(USUAL);
  });
});

describe('GoalProgress (D.16)', () => {
  it('says "all yours" when every coin is the child\'s own', () => {
    const view = render(<GoalProgress copy={en.goalProgress} title="Bike" target={50} progress={{ own: 20, bonus: 0, family: 0, total: 20 }} />);
    expect(screen.getByRole('img', { name: 'Bike: 20 of 50. All yours' })).toBeVisible();
    expect(view.container.querySelectorAll('.lf-goal-progress-part')).toHaveLength(1);
    everyTextHasARole(view.container);
  });

  it('never folds bonus or Tutor coins into the child\'s own: separate segments, each named with its number', () => {
    const view = render(<GoalProgress copy={en.goalProgress} title="Bike" target={50} progress={{ own: 30, bonus: 6, family: 4, total: 40 }} />);
    const parts = [...view.container.querySelectorAll('.lf-goal-progress-bar [data-part]')].map((p) => [p.getAttribute('data-part'), (p as HTMLElement).style.inlineSize]);
    expect(parts).toEqual([['own', '60%'], ['bonus', '12%'], ['family', '8%']]);
    expect(screen.getByText('Yours: 30')).toBeVisible();
    expect(screen.getByText('Bonus: 6')).toBeVisible();
    expect(screen.getByText('From your Tutor: 4')).toBeVisible();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Bike: 40 of 50. Yours: 30. Bonus: 6. From your Tutor: 4');
    const root = view.container.querySelector('[data-goal-progress]')!;
    expect([root.getAttribute('data-own'), root.getAttribute('data-bonus'), root.getAttribute('data-family')]).toEqual(['30', '6', '4']);
  });
});

describe('GoalNextStep (D.15)', () => {
  const copy = en.nextGoal;

  it('celebrates only when the server says this is the first view, and asks for the next goal in the same card', async () => {
    const onSeen = vi.fn().mockResolvedValue(true);
    const view = render(<GoalNextStep copy={copy} goal={goal({ status: 'reached' })} busy={false} notice={null} onSeen={onSeen} onStart={vi.fn()} onNotNow={vi.fn()} />);
    expect(await screen.findByText('You reached Bike!')).toBeVisible();
    expect(view.container.querySelector('[data-milestone="savings-goal-reached"]')).not.toBeNull();
    expect(screen.getByText(copy.prompt)).toBeVisible();
    expect(onSeen).toHaveBeenCalledTimes(1);
    everyTextHasARole(view.container);
  });

  it('shows no celebration on a later view, validates, then starts the next goal or respects "not now"', async () => {
    const onStart = vi.fn();
    const onNotNow = vi.fn();
    const view = render(<GoalNextStep copy={copy} goal={goal({ status: 'reached' })} busy={false} notice={null} onSeen={vi.fn().mockResolvedValue(false)} onStart={onStart} onNotNow={onNotNow} />);
    await act(async () => {});
    expect(view.container.querySelector('[data-milestone]')).toBeNull();
    expect(screen.getByText('Bike is reached.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: copy.start }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.invalid);
    fireEvent.change(screen.getByLabelText(copy.name), { target: { value: 'Skates' } });
    fireEvent.change(screen.getByLabelText(copy.target), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: copy.start }));
    expect(onStart).toHaveBeenCalledWith({ title: 'Skates', target: 80 });
    fireEvent.click(screen.getByRole('button', { name: copy.notNow }));
    expect(onNotNow).toHaveBeenCalled();
  });
});

describe('SavingsGoals', () => {
  const props = {
    copy: en.goals, progressCopy: en.goalProgress, nextCopy: en.nextGoal, locale: 'en-US', dark: false, loading: false, failed: false, busy: false,
    notice: null, nextNotice: null, onRetry: vi.fn(), onCreate: vi.fn(), onArchive: vi.fn(), onSeen: vi.fn().mockResolvedValue(false), onStartNext: vi.fn(), onNotNow: vi.fn(),
  };

  it('shows the next-goal card only for a reached goal whose next step is still due', () => {
    const view = render(<SavingsGoals {...props} goals={[
      goal(), goal({ id: DEST, title: 'Book', status: 'reached', nextStep: { state: 'pending', nextGoalId: null }, progress: { own: 50, bonus: 0, family: 0, total: 50 }, saved: 50 }),
      goal({ id: GIFT, title: 'Kite', status: 'reached', nextStep: { state: 'declined', nextGoalId: null }, progress: { own: 50, bonus: 0, family: 0, total: 50 }, saved: 50 }),
    ]} />);
    expect(view.container.querySelectorAll('[data-money-habits="next-goal"]')).toHaveLength(1);
    expect(view.container.querySelector('[data-money-habits="next-goal"]')!.getAttribute('data-goal-id')).toBe(DEST);
    expect(view.container.querySelectorAll('[data-goal-progress]')).toHaveLength(3);
  });

  it('asks before putting a goal away', () => {
    const onArchive = vi.fn();
    render(<SavingsGoals {...props} onArchive={onArchive} goals={[goal()]} />);
    fireEvent.click(screen.getByRole('button', { name: en.goals.archive }));
    expect(screen.getByText(en.goals.archiveConfirm)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: en.goals.keep }));
    expect(onArchive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.goals.archive }));
    fireEvent.click(screen.getAllByRole('button', { name: en.goals.archive })[0]!);
    expect(onArchive).toHaveBeenCalledWith(expect.objectContaining({ id: GOAL }));
  });
});

const tutorPlace: Destination = { id: DEST, title: 'Food bank', kind: 'charity', chosenBy: 'tutor', status: 'active', createdAt: T };
const pledged: Gift = { id: GIFT, destinationId: DEST, amount: 4, status: 'pledged', pledgedAt: T, settledAt: null, settledBy: null, note: null };

describe('ShareGiving (D.14)', () => {
  const base = {
    copy: en.share, teenCopy: en.shareTeen, locale: 'en-US', dark: false, loading: false, failed: false, busy: false, notice: null, selfDirected: false,
    onRetry: vi.fn(), onPledge: vi.fn(), onTakeBack: vi.fn(), onAddPlace: vi.fn(), onRemovePlace: vi.fn(), onMarkGiven: vi.fn(),
  };

  it('tells a child with no place yet to ask their Tutor, and says honestly that coins stay in the app', () => {
    const view = render(<ShareGiving {...base} available={6} view={{ destinations: [], gifts: [] }} />);
    expect(screen.getByText(en.share.empty)).toBeVisible();
    expect(screen.getByText(en.share.honest)).toBeVisible();
    expect(screen.queryByLabelText(en.shareTeen.placeName)).toBeNull();
    everyTextHasARole(view.container);
  });

  it('pledges to a chosen place, refuses more than the Share pocket holds, and shows what the Tutor did', () => {
    const onPledge = vi.fn();
    const onTakeBack = vi.fn();
    const view: ShareView = { destinations: [tutorPlace], gifts: [pledged, { ...pledged, id: DEST, status: 'given', settledAt: T, settledBy: 'tutor', note: 'We took rice to the food bank' }] };
    render(<ShareGiving {...base} available={6} view={view} onPledge={onPledge} onTakeBack={onTakeBack} />);
    fireEvent.change(screen.getByLabelText(en.share.amount), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Food bank' }));
    fireEvent.click(screen.getByRole('button', { name: en.share.give }));
    expect(screen.getByRole('alert')).toHaveTextContent(en.share.invalid);
    fireEvent.change(screen.getByLabelText(en.share.amount), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: en.share.give }));
    expect(onPledge).toHaveBeenCalledWith(DEST, 6);
    expect(screen.getByText('What happened: We took rice to the food bank')).toBeVisible();
    expect(screen.queryByRole('button', { name: en.shareTeen.markGiven })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.share.takeBack }));
    expect(onTakeBack).toHaveBeenCalledWith(pledged);
  });

  it('lets a teen add their own place and log what they did, with a required note', () => {
    const onAddPlace = vi.fn();
    const onMarkGiven = vi.fn();
    const own: Destination = { ...tutorPlace, chosenBy: 'holder', title: 'Animal shelter' };
    render(<ShareGiving {...base} selfDirected available={3} view={{ destinations: [own], gifts: [pledged] }} onAddPlace={onAddPlace} onMarkGiven={onMarkGiven} />);
    expect(screen.getByText(en.shareTeen.honest)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: en.shareTeen.add }));
    expect(screen.getByRole('alert')).toHaveTextContent(en.shareTeen.invalidPlace);
    fireEvent.change(screen.getByLabelText(en.shareTeen.placeName), { target: { value: 'Park cleanup' } });
    fireEvent.click(screen.getByRole('radio', { name: en.share.community }));
    fireEvent.click(screen.getByRole('button', { name: en.shareTeen.add }));
    expect(onAddPlace).toHaveBeenCalledWith({ title: 'Park cleanup', kind: 'community' });
    fireEvent.click(screen.getByRole('button', { name: en.shareTeen.markGiven }));
    fireEvent.click(screen.getByRole('button', { name: en.shareTeen.saveGiven }));
    expect(screen.getByRole('alert')).toHaveTextContent(en.shareTeen.noteRequired);
    fireEvent.change(screen.getByLabelText(en.shareTeen.whatHappened), { target: { value: 'Bought dog food' } });
    fireEvent.click(screen.getByRole('button', { name: en.shareTeen.saveGiven }));
    expect(onMarkGiven).toHaveBeenCalledWith(pledged, 'Bought dog food');
  });
});

describe('ShareDestinations (D.14, Tutor)', () => {
  const base = {
    copy: en.destinations, kidName: 'Nico', locale: 'en-US', dark: false, open: true, usual: USUAL, loading: false, failed: false, busy: false, notice: null,
    onToggle: vi.fn(), onRetry: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn(), onSettle: vi.fn(),
  };

  it("shows the child's usual split out of 10 and requires a note to mark a pledge done or return it", () => {
    const onSettle = vi.fn();
    const view = render(<ShareDestinations {...base} view={{ destinations: [tutorPlace], gifts: [pledged] }} onSettle={onSettle} />);
    expect(screen.getByText('Usual split, out of 10: 5 Save, 4 Spend, 1 Share')).toBeVisible();
    expect(screen.getByText('4 coins for Food bank')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: en.destinations.markGiven }));
    fireEvent.click(screen.getByRole('button', { name: en.destinations.confirm }));
    expect(screen.getByRole('alert')).toHaveTextContent(en.destinations.noteRequired);
    fireEvent.change(screen.getByLabelText(en.destinations.whatHappened), { target: { value: 'We bought rice together' } });
    fireEvent.click(screen.getByRole('button', { name: en.destinations.confirm }));
    expect(onSettle).toHaveBeenCalledWith(pledged, 'given', 'We bought rice together');
    fireEvent.click(screen.getByRole('button', { name: en.destinations.giveBack }));
    expect(screen.getByLabelText(en.destinations.whyBack)).toBeVisible();
    everyTextHasARole(view.container);
  });

  it('adds a place only with a name and a kind', () => {
    const onAdd = vi.fn();
    render(<ShareDestinations {...base} view={{ destinations: [], gifts: [] }} onAdd={onAdd} />);
    expect(screen.getByText(en.destinations.empty)).toBeVisible();
    fireEvent.change(screen.getByLabelText(en.destinations.placeName), { target: { value: 'Grandma' } });
    fireEvent.click(screen.getByRole('button', { name: en.destinations.add }));
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: en.destinations.gift }));
    fireEvent.click(screen.getByRole('button', { name: en.destinations.add }));
    expect(onAdd).toHaveBeenCalledWith({ title: 'Grandma', kind: 'gift' });
  });
});

describe('moneyHabitsApi shape checks', () => {
  function session(answer: TransportResult): Session { return { token: 't', transport: vi.fn().mockResolvedValue(answer) }; }

  it('refuses a goal list whose provenance does not add up, a usual split not summing to 100, and a gift shown given without its note', async () => {
    const mixed = { ...goal(), progress: { own: 20, bonus: 5, family: 0, total: 20 } };
    expect((await fetchHabitGoals(session({ data: { goals: [mixed] }, error: null }))).ok).toBe(false);
    expect((await fetchHabitGoals(session({ data: { goals: [{ ...goal(), progress: undefined }] }, error: null }))).ok).toBe(false);
    expect((await fetchHabitGoals(session({ data: { goals: [goal()] }, error: null }))).ok).toBe(true);
    expect((await fetchUsualSplit(session({ data: { usual: { save: 50, spend: 40, share: 5 }, custom: true, recommended: USUAL }, error: null }))).ok).toBe(false);
    expect((await fetchShare(session({ data: { destinations: [tutorPlace], gifts: [{ ...pledged, status: 'given', settledAt: T, note: null }] }, error: null }))).ok).toBe(false);
  });

  it('sends exactly the bodies Core expects, never naming a holder', async () => {
    const s = session({ data: { allocated: true, goal: null }, error: null });
    await allocateTask(GOAL, { save: 5, spend: 4, share: 1 }, null, s);
    expect(s.transport).toHaveBeenCalledWith(`/tasks/${GOAL}/allocate`, { token: 't', method: 'POST', body: { save: 5, spend: 4, share: 1, goalId: null } });
    const p = session({ data: { giftId: GIFT }, error: null });
    await pledgeGift(DEST, 3, p);
    expect(p.transport).toHaveBeenCalledWith('/tasks/share/gifts', { token: 't', method: 'POST', body: { destinationId: DEST, amount: 3 } });
    const u = session({ data: { usual: USUAL, custom: true, recommended: USUAL }, error: null });
    expect((await saveUsualSplit(USUAL, u)).ok).toBe(true);
    expect(u.transport).toHaveBeenCalledWith('/tasks/wallet/split', { token: 't', method: 'PUT', body: USUAL });
    const g = session({ data: { goal: goal({ followsGoalId: DEST }) }, error: null });
    expect((await createHabitGoal({ title: ' Skates ', target: 80, followsGoalId: DEST }, g)).ok).toBe(true);
    expect(g.transport).toHaveBeenCalledWith('/tasks/goals', { token: 't', method: 'POST', body: { title: 'Skates', target: 80, followsGoalId: DEST } });
    const k = session({ data: { outcome: 'given' }, error: null });
    await settleKidGift(GOAL, GIFT, 'given', ' Done ', k);
    expect(k.transport).toHaveBeenCalledWith(`/tasks/${GOAL}/share/gifts/${GIFT}/settle`, { token: 't', method: 'POST', body: { outcome: 'given', note: 'Done' } });
  });
});
