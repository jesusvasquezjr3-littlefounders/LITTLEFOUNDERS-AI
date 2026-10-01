import { enterDate } from '../test/dateParts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../i18n/en-US/familyAutonomy.json';
import governance from '../../i18n/en-US/familyGovernance.json';
import { AutonomyLadder } from './AutonomyLadder';
import { ChoreDone } from './ChoreDone';
import { DecisionNotes } from './DecisionNotes';
import { DecisionQueue } from './DecisionQueue';
import { MyLevel } from './MyLevel';
import { NotYetForm } from './NotYetForm';
import { RewardAsk } from './RewardAsk';
import {
  askForReward, decideReward, fetchDecisionQueue, fetchMyAutonomy, isAutonomy, isDecision, markChoreDone, reasonActionable, revisitInRange,
  sendBackChore, TASK_REASON_CODES, type Autonomy, type MyDecision, type Queue,
} from './familyAutonomyApi';
import type { Session, TransportResult } from './familyHubApi';

/*
 * S07.5 rebuilt surfaces (D.17, D.18): a "not yet" never leaves without a
 * reason code and an actionable reason (checked before anything is sent, and
 * again by the server); the child's own words sit next to every request the
 * Tutor decides; the ladder shows the documented rule with the child's own
 * numbers and never offers a move the rule refuses; the child asks for the
 * next level, steps down, and asks to talk. Nothing celebrates. Every text
 * node declares its copy role.
 */

const KID = '11111111-1111-4111-8111-111111111111';
const TASK = '22222222-2222-4222-8222-222222222222';
const RED = '33333333-3333-4333-8333-333333333333';
const DEC = '44444444-4444-4444-8444-444444444444';
const REQ = '55555555-5555-4555-8555-555555555555';
const NUDGE = '66666666-6666-4666-8666-666666666666';
const T = '2026-09-24T00:00:00.000Z';
const GOOD = 'Rinse the cups in the sink too, then mark it again.';

function everyTextHasARole(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}

function session(answer: (path: string, options: { method?: string; body?: unknown }) => TransportResult) {
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  const s: Session = { token: 't', transport: (path, options) => { calls.push({ path, method: options.method, body: options.body }); return Promise.resolve(answer(path, options)); } };
  return { s, calls };
}

const autonomy = (over: Partial<Autonomy> = {}): Autonomy => ({
  inFamily: true, level: 1, storedLevel: 1, levelSince: null, preapprovedLimit: 0, preapprovedCap: 0,
  unlocks: { selfLogContributions: false, selfLogMaxCoins: null },
  next: { level: 2, eligible: false, age: { value: 9, min: 8, ok: true }, approved: { value: 7, min: 10 }, notApproved: { value: 1, maxPct: 25, ok: true }, daysAtLevel: { value: 0, min: 0, ok: true }, windowDays: 60 },
  request: null, ...over,
});

const decision = (over: Partial<MyDecision> = {}): MyDecision => ({
  id: DEC, subject: 'task', subjectId: TASK, title: 'Dishes', outcome: 'sent_back', by: 'tutor', byMe: false, reasonCode: 'redo', reason: GOOD,
  revisitOn: null, reviewsDecisionId: null, createdAt: T, notYet: true, talk: null, ...over,
});

const queue = (over: Partial<Queue> = {}): Queue => ({
  chores: [{ id: TASK, assignedTo: KID, title: 'Dishes', rewardCoins: 3, kind: 'bonus', status: 'done', hasEvidence: false, requiresEvidence: false, childNote: 'I also dried them' }],
  openChores: [],
  rewards: [{ id: RED, kidUserId: KID, title: 'Cinema', cost: 10, childReasonKind: 'saved_for_it', childNote: 'Three weeks of saving', createdAt: T }],
  reviews: [], nudges: [], levelRequests: [], ...over,
});

describe('the actionable-reason rule (D.18 parity with the database and Core)', () => {
  it('agrees with family_reason_actionable() on every fixture case', () => {
    const fixture = JSON.parse(readFileSync(join(process.cwd(), '../database/scripts/fixtures/denial-reasons.json'), 'utf8')) as { cases: { text: string; actionable: boolean }[] };
    expect(fixture.cases.length).toBeGreaterThanOrEqual(50);
    for (const c of fixture.cases) expect(reasonActionable(c.text), JSON.stringify(c.text)).toBe(c.actionable);
  });

  it('accepts a "later" date only from tomorrow to 90 days ahead', () => {
    const today = new Date(2026, 8, 24);
    expect(revisitInRange('2026-09-24', today)).toBe(false);
    expect(revisitInRange('2026-09-25', today)).toBe(true);
    expect(revisitInRange('2026-12-23', today)).toBe(true);
    expect(revisitInRange('2026-12-24', today)).toBe(false);
    expect(revisitInRange('not a date', today)).toBe(false);
  });
});

describe('the API layer refuses what the server did not say', () => {
  it('refuses an "eligible" that contradicts its own conditions, and a pre-approved amount over the cap', () => {
    expect(isAutonomy(autonomy())).toBe(true);
    expect(isAutonomy(autonomy({ next: { ...autonomy().next!, eligible: true } }))).toBe(false);
    expect(isAutonomy(autonomy({ preapprovedLimit: 30, preapprovedCap: 20 }))).toBe(false);
  });

  it('refuses a "not yet" decision without its reason', () => {
    expect(isDecision(decision())).toBe(true);
    expect(isDecision(decision({ reason: null }))).toBe(false);
    expect(isDecision(decision({ reasonCode: null }))).toBe(false);
    expect(isDecision(decision({ outcome: 'approved', reasonCode: null, reason: null }))).toBe(true);
  });

  it('sends the exact bodies and rejects a surprising answer', async () => {
    const send = session(() => ({ data: { task: { id: TASK, status: 'open' } }, error: null }));
    expect((await sendBackChore(TASK, { reasonCode: 'redo', reason: GOOD, reflection: 'written' }, send.s)).ok).toBe(true);
    expect(send.calls[0]).toEqual({ path: `/tasks/${TASK}/send-back`, method: 'POST', body: { reasonCode: 'redo', reason: GOOD, reflection: 'written' } });
    const wrong = session(() => ({ data: { task: { id: TASK, status: 'approved' } }, error: null }));
    expect(await sendBackChore(TASK, { reasonCode: 'redo', reason: GOOD, reflection: 'skipped' }, wrong.s)).toEqual({ ok: false, code: 'INVALID_RESPONSE' });
    const deny = session(() => ({ data: { decided: true, status: 'denied' }, error: null }));
    await decideReward(RED, { approve: false, reasonCode: 'later_date', reason: 'Let us wait until after your test.', revisitOn: '2026-10-01', reflection: 'skipped' }, deny.s);
    expect(deny.calls[0]!.body).toEqual({ approve: false, reasonCode: 'later_date', reason: 'Let us wait until after your test.', revisitOn: '2026-10-01', reflection: 'skipped' });
    const done = session(() => ({ data: { task: { status: 'approved' }, selfLogged: true }, error: null }));
    expect((await markChoreDone(TASK, { localDate: '2026-09-24', note: 'Dried them' }, done.s)).ok).toBe(true);
    expect(done.calls[0]!.body).toEqual({ localDate: '2026-09-24', note: 'Dried them' });
    const lie = session(() => ({ data: { task: { status: 'done' }, selfLogged: true }, error: null }));
    expect((await markChoreDone(TASK, { localDate: '2026-09-24', note: null }, lie.s)).ok).toBe(false);
    const ask = session(() => ({ data: { redemption: { status: 'requested' }, preapproved: false }, error: null }));
    await askForReward(RED, { reasonKind: 'treat', note: null }, ask.s);
    expect(ask.calls[0]!.body).toEqual({ catalogId: RED, reasonKind: 'treat' });
    const q = session(() => ({ data: { ...queue(), rewards: [{ ...queue().rewards[0], childReasonKind: 'because' }] }, error: null }));
    expect((await fetchDecisionQueue(q.s)).ok).toBe(false);
    const a = session(() => ({ data: { autonomy: { ...autonomy(), level: 4 }, changes: [] }, error: null }));
    expect((await fetchMyAutonomy(a.s)).ok).toBe(false);
  });
});

describe('NotYetForm (D.18)', () => {
  it('sends nothing without a reason code, a specific reason, and a date for "later"; nothing is preselected', () => {
    const onSubmit = vi.fn();
    const { container } = render(<NotYetForm copy={en.notYet} codes={['save_more', 'later_date', 'not_suitable', 'talk_first']} busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(container.querySelectorAll('input:checked')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: en.notYet.send }));
    expect(screen.getByRole('status').textContent).toContain(en.notYet.pickCode);
    // A missing answer is a retry, never the error hue (SH-02).
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: en.notYet.later_date }));
    fireEvent.change(screen.getByLabelText(en.notYet.reason), { target: { value: 'Not now' } });
    fireEvent.click(screen.getByRole('button', { name: en.notYet.send }));
    expect(screen.getByRole('status').textContent).toContain(en.notYet.tooVague);
    fireEvent.change(screen.getByLabelText(en.notYet.reason), { target: { value: 'Let us wait until after your test on Friday.' } });
    fireEvent.click(screen.getByRole('button', { name: en.notYet.send }));
    expect(screen.getByRole('status').textContent).toContain(en.notYet.revisitInvalid);
    expect(onSubmit).not.toHaveBeenCalled();
    const day = new Date(Date.now() + 5 * 86_400_000);
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    enterDate(en.notYet.revisit, iso);
    fireEvent.click(screen.getByRole('button', { name: en.notYet.send }));
    expect(onSubmit).toHaveBeenCalledWith({ reasonCode: 'later_date', reason: 'Let us wait until after your test on Friday.', revisitOn: iso });
    everyTextHasARole(container);
  });
});

describe('DecisionQueue (D.18, D.17)', () => {
  const names = { 1: en.levels.name1, 2: en.levels.name2, 3: en.levels.name3 } as const;
  const draw = (q: Queue, onAction = vi.fn()) => render(<DecisionQueue copy={en.queue} notYetCopy={en.notYet} reflectionCopy={governance.reflection} levelNames={names} kidName={() => 'Ana'} locale="en-US"
    dark={false} queue={q} loading={false} failed={false} busy={false} notice={null} onRetry={vi.fn()} onAction={onAction} />);

  it("shows the child's own words next to each request, and a yes follows the reflective prompt (D.23)", () => {
    const onAction = vi.fn();
    const { container } = draw(queue(), onAction);
    const chores = container.querySelector('[data-queue="chores"]') as HTMLElement;
    expect(within(chores).getByText('Ana says: I also dried them')).toBeTruthy();
    const rewards = container.querySelector('[data-queue="rewards"]') as HTMLElement;
    expect(within(rewards).getByText('Ana: Saved for it')).toBeTruthy();
    expect(within(rewards).getByText('Ana says: Three weeks of saving')).toBeTruthy();
    fireEvent.click(within(chores).getByRole('button', { name: en.queue.approve }));
    expect(onAction).not.toHaveBeenCalled();
    expect(within(chores).getByLabelText('What would you tell Ana about this?')).toBeTruthy();
    everyTextHasARole(container);
    fireEvent.click(within(chores).getByRole('button', { name: governance.reflection.continue }));
    expect(onAction).toHaveBeenCalledWith({ kind: 'approveChore', chore: queue().chores[0], reflection: 'skipped', note: null });
  });

  it('opens the reason form for every "not yet" and sends it only with a reason', () => {
    const onAction = vi.fn();
    const { container } = draw(queue(), onAction);
    const chores = container.querySelector('[data-queue="chores"]') as HTMLElement;
    fireEvent.click(within(chores).getByRole('button', { name: en.queue.sendBack }));
    expect(chores.querySelector('[data-not-yet="form"]')).toBeNull();
    fireEvent.change(within(chores).getByLabelText('What would you tell Ana about this?'), { target: { value: 'She tried hard today' } });
    fireEvent.click(within(chores).getByRole('button', { name: governance.reflection.continue }));
    const form = chores.querySelector('[data-not-yet="form"]') as HTMLElement;
    expect((within(form).getByLabelText(en.notYet.reason) as HTMLTextAreaElement).value).toBe('');
    expect([...form.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map((radio) => radio.value)).toEqual([...TASK_REASON_CODES]);
    fireEvent.click(within(form).getByRole('button', { name: en.notYet.send }));
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(within(form).getByRole('radio', { name: en.notYet.redo }));
    fireEvent.change(within(form).getByLabelText(en.notYet.reason), { target: { value: GOOD } });
    fireEvent.click(within(form).getByRole('button', { name: en.notYet.send }));
    expect(onAction).toHaveBeenCalledWith({ kind: 'sendBack', chore: queue().chores[0], notYet: { reasonCode: 'redo', reason: GOOD, revisitOn: null }, reflection: 'written' });
  });

  it('keeps a photo-required chore from a yes until the photo is in', () => {
    const { container } = draw(queue({ chores: [{ ...queue().chores[0]!, requiresEvidence: true, hasEvidence: false }] }));
    expect((within(container.querySelector('[data-queue="chores"]') as HTMLElement).getByRole('button', { name: en.queue.approve }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists what the level let through to look at afterwards, the talk nudge and the level ask', () => {
    const onAction = vi.fn();
    const { container } = draw(queue({
      chores: [], rewards: [],
      reviews: [{ ...decision({ outcome: 'self_logged', by: 'child', reasonCode: null, reason: null }), kidUserId: KID }],
      nudges: [{ id: NUDGE, kidUserId: KID, origin: 'pattern', denials: 3, decision: null, createdAt: T }],
      levelRequests: [{ id: REQ, kidUserId: KID, level: 2, note: 'I did every chore', createdAt: T }],
    }), onAction);
    expect(container.querySelector('[data-queue="reviews"]')?.textContent).toContain('Ana counted Dishes');
    expect(container.querySelector('[data-queue="talk"]')?.textContent).toContain('3 not-yets for Ana in two weeks.');
    expect(container.querySelector('[data-queue="levels"]')?.textContent).toContain(`Ana asks for ${en.levels.name2}.`);
    fireEvent.click(screen.getByRole('button', { name: en.queue.talked }));
    expect(onAction).toHaveBeenCalledWith({ kind: 'closeNudge', nudgeId: NUDGE, outcome: 'talked' });
    fireEvent.click(screen.getByRole('button', { name: en.queue.looksGood }));
    fireEvent.click(screen.getByRole('button', { name: governance.reflection.continue }));
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'confirm', reflection: 'skipped' }));
    everyTextHasARole(container);
  });
});

describe('AutonomyLadder (D.17)', () => {
  const levels = { ...en.levelsTutor, name1: en.levels.name1, name2: en.levels.name2, name3: en.levels.name3, label: en.levels.label };
  const draw = (a: Autonomy, onSet = vi.fn()) => render(<AutonomyLadder copy={en.ladder} levels={levels} notYetCopy={en.notYet} kidName="Ana" locale="en-US" dark
    open view={{ autonomy: a, changes: [{ id: DEC, fromLevel: 2, toLevel: 1, fromLimit: 10, toLimit: 0, by: 'system', byMe: false, reasonCode: 'questioned_pattern', reason: null, createdAt: T }] }}
    loading={false} failed={false} busy={false} notice={null} onToggle={vi.fn()} onRetry={vi.fn()} onSet={onSet} />);

  it('shows the rule with the child\'s own numbers and never offers a move the rule refuses', () => {
    const { container } = draw(autonomy());
    const next = container.querySelector('[data-autonomy-part="next"]') as HTMLElement;
    expect(next.getAttribute('data-eligible')).toBe('false');
    expect(next.textContent).toContain('7 of 10 approved in 60 days');
    expect(next.textContent).toContain('At most 1 in 4 not approved');
    expect((within(next).getByRole('button', { name: en.ladder.moveUp }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-change-by="system"]')?.textContent).toContain(en.ladder.bySystem);
    everyTextHasARole(container);
  });

  it('moves up when eligible, sets the amount within the cap, and moves down only with a reason', () => {
    const onSet = vi.fn();
    const eligible = autonomy({ next: { ...autonomy().next!, eligible: true, approved: { value: 12, min: 10 } } });
    const first = draw(eligible, onSet);
    fireEvent.click(within(first.container.querySelector('[data-autonomy-part="next"]') as HTMLElement).getByRole('button', { name: en.ladder.moveUp }));
    expect(onSet).toHaveBeenCalledWith({ level: 2, preapprovedLimit: 0 });
    first.unmount();
    const onSet2 = vi.fn();
    const two = draw(autonomy({ level: 2, storedLevel: 2, preapprovedLimit: 15, preapprovedCap: 20, unlocks: { selfLogContributions: true, selfLogMaxCoins: null }, next: null }), onSet2);
    fireEvent.click(screen.getByRole('button', { name: `${en.ladder.limit}: ${en.ladder.more}` }));
    expect((screen.getByRole('button', { name: `${en.ladder.limit}: ${en.ladder.more}` }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: en.ladder.saveLimit }));
    expect(onSet2).toHaveBeenCalledWith({ level: 2, preapprovedLimit: 20 });
    fireEvent.click(screen.getByRole('button', { name: en.ladder.moveDown }));
    const form = two.container.querySelector('[data-not-yet="form"]') as HTMLElement;
    fireEvent.click(within(form).getByRole('button', { name: en.notYet.send }));
    expect(onSet2).toHaveBeenCalledTimes(1);
    fireEvent.click(within(form).getByRole('radio', { name: en.notYet.practice_more }));
    fireEvent.change(within(form).getByLabelText(en.notYet.reason), { target: { value: 'Let us practise saving before the next step.' } });
    fireEvent.click(within(form).getByRole('button', { name: en.notYet.send }));
    expect(onSet2).toHaveBeenLastCalledWith({ level: 1, preapprovedLimit: 0, reasonCode: 'practice_more', reason: 'Let us practise saving before the next step.' });
  });
});

describe("the child's side (D.17, D.18)", () => {
  it('shows my level and my progress, asks for the next one in my words, and steps down only after a confirm', () => {
    const onAsk = vi.fn();
    const onStepDown = vi.fn();
    const { container } = render(<MyLevel copy={en.myLevel} levels={en.levels} locale="en-US" dark={false}
      view={{ autonomy: autonomy({ level: 2, storedLevel: 2, preapprovedLimit: 10, preapprovedCap: 20, unlocks: { selfLogContributions: true, selfLogMaxCoins: null },
        next: { ...autonomy().next!, level: 3, daysAtLevel: { value: 20, min: 28, ok: false } } }), changes: [] }}
      loading={false} failed={false} busy={false} notice={null} onRetry={vi.fn()} onAsk={onAsk} onStepDown={onStepDown} />);
    expect(container.textContent).toContain('Level 2: Small steps');
    expect(container.textContent).toContain('Rewards up to 10 coins need no asking.');
    expect(container.textContent).toContain('7 of 10 to Trusted');
    expect(container.textContent).toContain('8 more days on this level.');
    fireEvent.click(screen.getByRole('button', { name: en.myLevel.ask }));
    fireEvent.change(screen.getByLabelText(en.myLevel.why), { target: { value: 'I did every chore' } });
    fireEvent.click(screen.getByRole('button', { name: en.myLevel.send }));
    expect(onAsk).toHaveBeenCalledWith('I did every chore');
    fireEvent.click(screen.getByRole('button', { name: en.myLevel.stepDown }));
    expect(onStepDown).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.myLevel.confirm }));
    expect(onStepDown).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-celebration], .lf-confetti')).toBeNull();
    everyTextHasARole(container);
  });

  it('tells the child who lowered the level and why', () => {
    const { container } = render(<MyLevel copy={en.myLevel} levels={en.levels} locale="en-US" dark={false}
      view={{ autonomy: autonomy(), changes: [{ id: DEC, fromLevel: 2, toLevel: 1, fromLimit: 10, toLimit: 0, by: 'tutor', byMe: false, reasonCode: 'practice_more', reason: 'Let us practise saving first.', createdAt: T }] }}
      loading={false} failed={false} busy={false} notice={null} onRetry={vi.fn()} onAsk={vi.fn()} onStepDown={vi.fn()} />);
    const last = container.querySelector('[data-last-change="tutor"]') as HTMLElement;
    expect(last.textContent).toContain('Your Tutor moved you to Ask first.');
    expect(last.textContent).toContain('Let us practise saving first.');
  });

  it("shows each \"not yet\" with its reason and date, and lets the child ask to talk once", () => {
    const onTalk = vi.fn();
    const { container, rerender } = render(<DecisionNotes copy={en.notes} codes={en.childCodes} locale="en-US" dark={false}
      decisions={[decision({ revisitOn: '2026-10-01', reasonCode: 'later_date', subject: 'redemption', outcome: 'denied', title: 'Cinema' }), decision({ id: REQ, outcome: 'self_logged', notYet: false, reasonCode: null, reason: null })]}
      loading={false} failed={false} busy={false} onRetry={vi.fn()} onTalk={onTalk} />);
    const denied = container.querySelector('[data-outcome="denied"]') as HTMLElement;
    expect(denied.textContent).toContain('Not yet');
    expect(denied.textContent).toContain('Later');
    expect(denied.textContent).toContain('Ask again on October 1.');
    expect(container.querySelector('[data-outcome="self_logged"]')?.textContent).toContain('Counted on your own');
    fireEvent.click(within(denied).getByRole('button', { name: en.notes.talk }));
    expect(onTalk).toHaveBeenCalledWith(expect.objectContaining({ id: DEC }));
    rerender(<DecisionNotes copy={en.notes} codes={en.childCodes} locale="en-US" dark={false} decisions={[decision({ talk: 'open' })]}
      loading={false} failed={false} busy={false} onRetry={vi.fn()} onTalk={onTalk} />);
    expect(container.textContent).toContain(en.notes.talkAsked);
    expect(screen.queryByRole('button', { name: en.notes.talk })).toBeNull();
    everyTextHasARole(container);
  });

  it('asks for a reward only with a reason picked, nothing preselected, and reports the server\'s answer', () => {
    const onAsk = vi.fn();
    const { container, rerender } = render(<RewardAsk copy={en.rewardAsk} title="Cinema" locale="en-US" dark={false} busy={false} disabled={false} result={null} onAsk={onAsk} />);
    fireEvent.click(screen.getByRole('button', { name: en.rewardAsk.ask }));
    expect(container.querySelectorAll('input:checked')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: en.rewardAsk.send }));
    expect(screen.getByRole('status').textContent).toContain(en.rewardAsk.pickOne);
    fireEvent.click(screen.getByRole('radio', { name: en.rewardAsk.saved_for_it }));
    fireEvent.change(screen.getByLabelText(en.rewardAsk.note), { target: { value: 'Three weeks' } });
    fireEvent.click(screen.getByRole('button', { name: en.rewardAsk.send }));
    expect(onAsk).toHaveBeenCalledWith({ reasonKind: 'saved_for_it', note: 'Three weeks' });
    rerender(<RewardAsk copy={en.rewardAsk} title="Cinema" locale="en-US" dark={false} busy={false} disabled={false} result="approved" onAsk={onAsk} />);
    expect(container.textContent).toContain(en.rewardAsk.approved);
    rerender(<RewardAsk copy={en.rewardAsk} title="Cinema" locale="en-US" dark={false} busy={false} disabled={false} result="limit" onAsk={onAsk} />);
    // A limit is information, not an error (SH-02): announced politely, never in the error hue.
    expect(screen.getByRole('status').textContent).toContain(en.rewardAsk.limit);
    expect(screen.queryByRole('alert')).toBeNull();
    everyTextHasARole(container);
  });

  it('marks a chore done in one tap or with a note, and says whether it counted', () => {
    const onDone = vi.fn();
    const { container, rerender } = render(<ChoreDone copy={en.choreDone} title="Dishes" locale="en-US" dark={false} busy={false} result={null} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: en.choreDone.addNote }));
    fireEvent.change(screen.getByLabelText(en.choreDone.notePrompt), { target: { value: 'I also dried them' } });
    fireEvent.click(screen.getByRole('button', { name: en.choreDone.markDone }));
    expect(onDone).toHaveBeenCalledWith('I also dried them');
    rerender(<ChoreDone copy={en.choreDone} title="Dishes" locale="en-US" dark={false} busy={false} result="counted" onDone={onDone} />);
    expect(container.textContent).toContain(en.choreDone.counted);
    everyTextHasARole(container);
  });
});
