import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../i18n/en-US/familyGovernance.json';
import { CoachingNote } from './CoachingNote';
import { CoachingTip } from './CoachingTip';
import { DataPolicy } from './DataPolicy';
import { MyResearch } from './MyResearch';
import { ReflectionStep } from './ReflectionStep';
import { ResearchConsent } from './ResearchConsent';
import { SCOPE_NOT, SCOPE_TEACHES, ScopeStatement } from './ScopeStatement';
import { MoneyBridge } from '../wallet/MoneyBridge';
import {
  fetchBridge, fetchCoachingTip, fetchDataPolicy, isBridge, isPolicy, markBridge, markCoachingTip, setKidResearch, splitAmount, stopMyResearch,
  type BridgeState, type Research, type ResearchView,
} from './governanceApi';
import type { Session, TransportResult } from './familyHubApi';

/*
 * S07.7 rebuilt surfaces (D.19-D.23): the reflective prompt keeps the Tutor's
 * words in the browser unless they choose to send them; the monthly tip shows
 * its research basis as a finding, never a promise; the scope statement names
 * credit, debt, real compound interest and risk as out of scope; the data
 * policy shows only the periods Core serves; a research yes names the
 * disclosure it answers and a no deletes; the bridge shows nothing below the
 * database's age and its split tool sends nothing. Every text node declares
 * its copy role; nothing celebrates.
 */

const KID = '11111111-1111-4111-8111-111111111111';
const DELIVERY = '22222222-2222-4222-8222-222222222222';
const T = '2026-06-01T00:00:00.000Z';

function everyTextHasARole(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}

function noCelebration(container: HTMLElement) {
  expect(container.querySelector('[data-celebration], .lf-confetti, [data-milestone]')).toBeNull();
  expect(container.textContent).not.toMatch(/!/);
}

function session(answer: (path: string, options: { method?: string; body?: unknown }) => TransportResult) {
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  const s: Session = { token: 't', transport: (path, options) => { calls.push({ path, method: options.method, body: options.body }); return Promise.resolve(answer(path, options)); } };
  return { s, calls };
}

const research = (over: Partial<Research> = {}): Research => ({ participating: false, recording: false, grantor: null, since: null, disclosureVersion: 1, adult: false, months: 0, ...over });
const bridge = (over: Partial<BridgeState> = {}): BridgeState => ({
  eligible: true, minAge: 15,
  moments: [{ milestone: 'first_pay', arrived: true, steps: [2] }, { milestone: 'first_account', arrived: false, steps: [] }, { milestone: 'first_budget', arrived: false, steps: [] }],
  ...over,
});

describe('the governance API layer', () => {
  it('refuses a tip it has no copy for, and a delivery that does not match', async () => {
    const good = session(() => ({ data: { tip: { deliveryId: DELIVERY, tipId: 'keep-promises', period: '2026-09', opened: false, dismissed: false } }, error: null }));
    expect((await fetchCoachingTip(good.s)).ok).toBe(true);
    const unknown = session(() => ({ data: { tip: { deliveryId: DELIVERY, tipId: 'buy-crypto', period: '2026-09', opened: false, dismissed: false } }, error: null }));
    expect(await fetchCoachingTip(unknown.s)).toEqual({ ok: false, code: 'INVALID_RESPONSE' });
    const mark = session(() => ({ data: { tip: { deliveryId: DELIVERY, tipId: 'keep-promises', period: '2026-09', opened: false, dismissed: false } }, error: null }));
    expect((await markCoachingTip(DELIVERY, 'opened', mark.s)).ok).toBe(false);
    expect(mark.calls[0]).toEqual({ path: `/family-hub/coaching/${DELIVERY}/opened`, method: 'POST', body: {} });
  });

  it('shows a period only where the rule is a period, and in the order the policy is written', async () => {
    const classes = [
      { id: 'photos', days: 30 }, { id: 'records', days: 400 }, { id: 'coins', days: null }, { id: 'insights', days: 400 },
      { id: 'research', days: 1100 }, { id: 'erasure', days: null }, { id: 'sharing', days: null },
    ];
    expect(isPolicy({ classes })).toBe(true);
    expect(isPolicy({ classes: classes.map((c) => (c.id === 'coins' ? { ...c, days: 5 } : c)) })).toBe(false);
    expect(isPolicy({ classes: classes.map((c) => (c.id === 'photos' ? { ...c, days: null } : c)) })).toBe(false);
    expect(isPolicy({ classes: classes.slice(1) })).toBe(false);
    expect((await fetchDataPolicy(session(() => ({ data: { classes }, error: null })).s)).ok).toBe(true);
  });

  it('sends a research yes with its version and accepts only the answer it asked for', async () => {
    const yes = session(() => ({ data: { research: research({ participating: true, recording: true, grantor: 'tutor', since: T }), currentVersion: 1 }, error: null }));
    expect((await setKidResearch(KID, { participate: true, disclosureVersion: 1 }, yes.s)).ok).toBe(true);
    expect(yes.calls[0]).toEqual({ path: `/family-hub/kids/${KID}/research`, method: 'PUT', body: { participate: true, disclosureVersion: 1 } });
    const lie = session(() => ({ data: { research: research(), currentVersion: 1 }, error: null }));
    expect((await setKidResearch(KID, { participate: true, disclosureVersion: 1 }, lie.s)).ok).toBe(false);
    const recordingWithoutYes = session(() => ({ data: { research: research({ recording: true }), currentVersion: 1 }, error: null }));
    expect((await stopMyResearch(recordingWithoutYes.s)).ok).toBe(false);
    const stopped = session(() => ({ data: { research: research(), currentVersion: 1 }, error: null }));
    expect((await stopMyResearch(stopped.s)).ok).toBe(true);
    expect(stopped.calls[0]).toEqual({ path: '/family-hub/research/me', method: 'PUT', body: { participate: false } });
  });

  it('refuses a bridge that lists moments for someone too young, and a step before its moment', async () => {
    expect(isBridge(bridge())).toBe(true);
    expect(isBridge({ eligible: false, minAge: 15, moments: bridge().moments })).toBe(false);
    expect(isBridge(bridge({ moments: [{ milestone: 'first_pay', arrived: false, steps: [1] }, ...bridge().moments.slice(1)] }))).toBe(false);
    expect((await fetchBridge(session(() => ({ data: { eligible: false, minAge: 15, moments: [] }, error: null })).s)).ok).toBe(true);
    const tick = session(() => ({ data: bridge(), error: null }));
    await markBridge({ milestone: 'first_pay', step: 1, done: true }, tick.s);
    expect(tick.calls[0]).toEqual({ path: '/family-hub/bridge', method: 'POST', body: { milestone: 'first_pay', step: 1, done: true } });
  });

  it('splits a real amount by the usual split in whole units that add up, and refuses nonsense', () => {
    expect(splitAmount(100, { save: 50, spend: 40, share: 10 })).toEqual({ save: 50, spend: 40, share: 10 });
    const odd = splitAmount(7, { save: 50, spend: 40, share: 10 })!;
    expect(odd.save + odd.spend + odd.share).toBe(7);
    expect(splitAmount(-5, { save: 50, spend: 40, share: 10 })).toBeNull();
    expect(splitAmount(Number.NaN, { save: 50, spend: 40, share: 10 })).toBeNull();
  });
});

describe('ReflectionStep (D.23)', () => {
  it('keeps the Tutor\'s words here unless they choose to send them', () => {
    const onContinue = vi.fn();
    const { container } = render(<ReflectionStep copy={en.reflection} name="Ana" heading="Dishes" notYet={false} noteAllowed busy={false} onContinue={onContinue} onBack={vi.fn()} />);
    expect(screen.getByLabelText('What would you tell Ana about this?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.reflection.share })).toBeNull();
    fireEvent.change(screen.getByLabelText('What would you tell Ana about this?'), { target: { value: 'I am proud of the effort' } });
    fireEvent.click(screen.getByRole('button', { name: en.reflection.continue }));
    expect(onContinue).toHaveBeenLastCalledWith('written', null);
    fireEvent.click(screen.getByRole('button', { name: en.reflection.share }));
    expect(onContinue).toHaveBeenLastCalledWith('shared', 'I am proud of the effort');
    everyTextHasARole(container);
    noCelebration(container);
  });

  it('reports a skipped step with no words, and offers the words as the reason before a "not yet"', () => {
    const onContinue = vi.fn();
    render(<ReflectionStep copy={en.reflection} name="Ana" notYet noteAllowed={false} busy={false} onContinue={onContinue} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: en.reflection.continue }));
    expect(onContinue).toHaveBeenLastCalledWith('skipped', null);
    fireEvent.change(screen.getByLabelText('What would you tell Ana about this?'), { target: { value: 'Finish the plates first, then we talk' } });
    fireEvent.click(screen.getByRole('button', { name: en.reflection.useAsReason }));
    expect(onContinue).toHaveBeenLastCalledWith('shared', 'Finish the plates first, then we talk');
  });

  it('offers no note on a decision that cannot carry one', () => {
    render(<ReflectionStep copy={en.reflection} name="Ana" notYet={false} noteAllowed={false} busy={false} onContinue={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('What would you tell Ana about this?'), { target: { value: 'Well done' } });
    expect(screen.queryByRole('button', { name: en.reflection.share })).toBeNull();
  });
});

describe('CoachingTip (D.23)', () => {
  const tip = { deliveryId: DELIVERY, tipId: 'keep-promises' as const, period: '2026-09', opened: false, dismissed: false };

  it('shows the tip, layers its research basis as a finding, and records opening once', () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    const { container } = render(<CoachingTip copy={en.coaching} tips={en.tips} locale="en-US" dark={false} tip={tip} failed={false} busy={false} onOpen={onOpen} onDismiss={onDismiss} />);
    expect(screen.getByRole('heading', { name: en.tips['keep-promises'].title })).toBeTruthy();
    expect(container.querySelector('[data-governance-part="why"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.coaching.why }));
    expect(container.querySelector('[data-governance-part="why"]')?.textContent).toContain(en.coaching.whyNote);
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: en.coaching.dismiss }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    everyTextHasARole(container);
    noCelebration(container);
  });

  it('shows nothing without a reviewed tip or once hidden, and an honest failure', () => {
    expect(render(<CoachingTip copy={en.coaching} tips={en.tips} locale="en-US" dark tip={null} failed={false} busy={false} onOpen={vi.fn()} onDismiss={vi.fn()} />).container.innerHTML).toBe('');
    expect(render(<CoachingTip copy={en.coaching} tips={en.tips} locale="en-US" dark tip={{ ...tip, dismissed: true }} failed={false} busy={false} onOpen={vi.fn()} onDismiss={vi.fn()} />).container.innerHTML).toBe('');
    render(<CoachingTip copy={en.coaching} tips={en.tips} locale="en-US" dark tip={null} failed busy={false} onOpen={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain(en.coaching.failed);
  });

  it('has copy for every tip id the API accepts, and never claims proof', () => {
    for (const [id, text] of Object.entries(en.tips)) {
      expect(text.title, id).toBeTruthy();
      expect(`${text.body} ${text.why}`, id).not.toMatch(/\b(proven|prove|guarantee|always works|scientifically)\b/i);
    }
  });
});

describe('CoachingNote (D.23)', () => {
  it('keeps pricing guidance one tap away inside the control it is about', () => {
    const { container } = render(<CoachingNote name="pricing" label={en.pricing.open} close={en.pricing.close} lines={[en.pricing.contribution, en.pricing.bonus, en.pricing.promise]}
      locale="en-US" dark={false} />);
    expect(container.querySelector('[data-coaching-lines]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.pricing.open }));
    expect(container.querySelectorAll('[data-coaching-lines="pricing"] li')).toHaveLength(3);
    expect(screen.getByRole('button', { name: en.pricing.close }).getAttribute('aria-expanded')).toBe('true');
    everyTextHasARole(container);
  });
});

describe('ScopeStatement (D.20)', () => {
  it('names what it practises and, explicitly, credit, debt, real compound interest and risk as not taught', () => {
    const { container } = render(<ScopeStatement copy={en.scope} locale="en-US" dark={false} />);
    expect(container.textContent).toContain(en.scope.intro);
    fireEvent.click(screen.getByRole('button', { name: en.scope.open }));
    expect([...container.querySelectorAll('[data-lines="teaches"] [data-scope]')].map((li) => li.getAttribute('data-scope'))).toEqual([...SCOPE_TEACHES]);
    expect([...container.querySelectorAll('[data-lines="not"] [data-scope]')].map((li) => li.getAttribute('data-scope'))).toEqual([...SCOPE_NOT]);
    const not = (container.querySelector('[data-lines="not"]') as HTMLElement).textContent!;
    expect(not).toMatch(/credit/i);
    expect(not).toMatch(/debt/i);
    expect(not).toMatch(/compound interest/i);
    expect(not).toMatch(/risk/i);
    everyTextHasARole(container);
    noCelebration(container);
  });
});

describe('DataPolicy (D.21)', () => {
  it('shows the periods Core served, and an honest failure', () => {
    const lines = [{ id: 'photos' as const, days: 30 }, { id: 'records' as const, days: 400 }, { id: 'coins' as const, days: null }, { id: 'insights' as const, days: 400 },
      { id: 'research' as const, days: 1100 }, { id: 'erasure' as const, days: null }, { id: 'sharing' as const, days: null }];
    const { container, rerender } = render(<DataPolicy copy={en.dataPolicy} locale="en-US" dark={false} open lines={lines} failed={false} onToggle={vi.fn()} />);
    expect(container.querySelector('[data-policy="photos"]')?.textContent).toBe('Chore photos: 30 days after your decision.');
    expect(container.querySelector('[data-policy="research"]')?.textContent).toContain('1,100 days');
    expect(container.querySelector('[data-policy="coins"]')?.textContent).not.toMatch(/\d/);
    everyTextHasARole(container);
    rerender(<DataPolicy copy={en.dataPolicy} locale="en-US" dark={false} open lines={null} failed onToggle={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain(en.dataPolicy.failed);
  });
});

describe('ResearchConsent and MyResearch (D.22)', () => {
  const view = (r: Research): ResearchView => ({ research: r, currentVersion: 1 });

  it('shows the whole disclosure before a yes, preselects nothing, and names the version it answers', () => {
    const onAnswer = vi.fn();
    const { container } = render(<ResearchConsent copy={en.research} kidName="Ana" locale="en-US" dark={false} open view={view(research())} loading={false} failed={false} busy={false}
      notice={null} onToggle={vi.fn()} onAnswer={onAnswer} />);
    const disclosure = container.querySelector('[data-research="disclosure"]') as HTMLElement;
    expect(disclosure.textContent).toContain(en.research.how);
    expect(disclosure.textContent).toContain('No experiments on children. Nothing changes for Ana.');
    expect(container.querySelectorAll('[aria-pressed="true"], input:checked')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Include Ana' }));
    expect(onAnswer).toHaveBeenCalledWith({ participate: true, disclosureVersion: 1 });
    everyTextHasARole(container);
    noCelebration(container);
  });

  it('asks once before stopping, then deletes; a paused consent says so', () => {
    const onAnswer = vi.fn();
    const { container, rerender } = render(<ResearchConsent copy={en.research} kidName="Ana" locale="en-US" dark={false} open
      view={view(research({ participating: true, recording: true, grantor: 'tutor', since: T, months: 3 }))} loading={false} failed={false} busy={false}
      notice={null} onToggle={vi.fn()} onAnswer={onAnswer} />);
    expect(container.textContent).toContain('Months recorded: 3.');
    fireEvent.click(screen.getByRole('button', { name: en.research.stopButton }));
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.research.confirmYes }));
    expect(onAnswer).toHaveBeenCalledWith({ participate: false });
    rerender(<ResearchConsent copy={en.research} kidName="Ana" locale="en-US" dark={false} open
      view={view(research({ participating: true, recording: false, grantor: 'tutor', since: T, months: 3 }))} loading={false} failed={false} busy={false}
      notice={null} onToggle={vi.fn()} onAnswer={onAnswer} />);
    expect(container.textContent).toContain(en.research.paused);
  });

  it('lets a participating child say no themselves, and shows nothing to a child who is not taking part', () => {
    const onStop = vi.fn();
    const { container } = render(<MyResearch copy={en.myResearch} locale="en-US" dark={false} research={research({ participating: true, recording: true, grantor: 'tutor', since: T })}
      busy={false} notice={null} onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: en.myResearch.button }));
    fireEvent.click(screen.getByRole('button', { name: en.myResearch.yes }));
    expect(onStop).toHaveBeenCalledTimes(1);
    everyTextHasARole(container);
    expect(render(<MyResearch copy={en.myResearch} locale="en-US" dark={false} research={research()} busy={false} notice={null} onStop={vi.fn()} />).container.innerHTML).toBe('');
  });
});

describe('MoneyBridge (D.19)', () => {
  it('shows nothing below the database\'s age', () => {
    expect(render(<MoneyBridge copy={en.bridge} locale="en-US" dark={false} state={{ eligible: false, minAge: 15, moments: [] }} split={null} busy={false} notice={null} onMark={vi.fn()} />)
      .container.innerHTML).toBe('');
  });

  it('opens a moment\'s checklist only when it arrived, and ticks one step at a time', () => {
    const onMark = vi.fn();
    const { container } = render(<MoneyBridge copy={en.bridge} locale="en-US" dark={false} state={bridge()} split={{ save: 50, spend: 40, share: 10 }} busy={false} notice={null} onMark={onMark} />);
    const pay = container.querySelector('[data-moment="first_pay"]') as HTMLElement;
    const account = container.querySelector('[data-moment="first_account"]') as HTMLElement;
    expect(pay.querySelectorAll('[data-step]')).toHaveLength(3);
    expect(account.querySelectorAll('[data-step]')).toHaveLength(0);
    expect((pay.querySelector('[data-step="2"] input') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(pay.querySelector('[data-step="1"] input') as HTMLInputElement);
    expect(onMark).toHaveBeenLastCalledWith({ milestone: 'first_pay', step: 1, done: true });
    fireEvent.click(within(account).getByRole('button', { name: en.bridge.arrived }));
    expect(onMark).toHaveBeenLastCalledWith({ milestone: 'first_account', step: 0, done: true });
    everyTextHasARole(container);
    noCelebration(container);
  });

  it('applies the usual split to a real amount without sending anything', () => {
    const onMark = vi.fn();
    const { container } = render(<MoneyBridge copy={en.bridge} locale="en-US" dark={false} state={bridge()} split={{ save: 50, spend: 40, share: 10 }} busy={false} notice={null} onMark={onMark} />);
    fireEvent.change(screen.getByLabelText(en.bridge.amount), { target: { value: '250' } });
    expect(container.querySelector('output')?.textContent).toBe('Save 125, spend 100, share 25');
    expect(onMark).not.toHaveBeenCalled();
    expect(container.textContent).toContain(en.bridge.splitNote);
  });
});
