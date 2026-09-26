import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, firstViewLimit, wordCount, type AgeBand, type Locale } from '../design/copyBudget';
import {
  LEARNER_REGISTERS, REGISTERS, UNIVERSAL_FORBIDDEN, findLexicons, forbiddenLexicons, type LearnerRegister,
} from '../design/learnerRegisterPolicy.generated';
import { mentorReaction } from './CompactMentorStage';
import { GuidedReviewOffer, guidedReviewCopy, guidedReviewOfferSchema, guidedReviewVoice } from './GuidedReviewOffer';
import { LessonResultView } from './LessonResultView';
import { RegisterGraduationView, registerGraduationCopy } from './RegisterGraduationView';
import { acknowledgeGraduation, fetchLearnerRegister, registerOf, type RegisterTransport } from './learnerRegister';
import { milestoneReceipt } from './motivationFixtures';

/*
 * S05.3f in the rebuilt UI: B.23 (the register policy drives the Mentor's
 * presence, the reward framing and the graduation moment), B.26 and OD-1 (the
 * guided-review offer: named skill, the learner's own Mentor, declining is
 * neutral, never a lock), with the register policy's lexicons applied to every
 * string these surfaces can show, in three locales.
 */

const LOCALES: Locale[] = ['en-US', 'es-MX', 'pt-BR'];
const OFFER = { skill_key: 'financial-education/saving-goal', skill: 'Saving toward a goal', misses: 3, character: 'dina' as const };

function textNodesHaveRoles(container: HTMLElement): void {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.trim()) expect(node.parentElement!.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}

function budgetIssues(container: HTMLElement, locale: Locale, ageBand: AgeBand): string[] {
  const issues: string[] = [];
  for (const element of container.querySelectorAll<HTMLElement>('[data-copy-role]')) {
    const role = element.dataset.copyRole as Parameters<typeof checkCopy>[1];
    for (const issue of checkCopy(element.textContent ?? '', role, { locale, ageBand, surface: 'app' })) issues.push(`${issue}: ${element.textContent}`);
  }
  const limit = firstViewLimit({ locale, ageBand, surface: 'app' });
  const words = [...container.querySelectorAll<HTMLElement>('[data-copy-role]:not([data-copy-role="data"])')].reduce((sum, element) => sum + wordCount(element.textContent ?? ''), 0);
  if (limit !== null && words > limit) issues.push(`first view ${words} > ${limit}`);
  return issues;
}

describe('B.23: one register policy, read by the UI', () => {
  it('the UI copy is byte-identical to Core\'s canonical policy', () => {
    const root = resolve(__dirname, '../../../..');
    const canonical = readFileSync(resolve(root, 'backend/src/services/learnerRegisterPolicy.ts'), 'utf8');
    const copy = readFileSync(resolve(root, 'frontend/src/rebuild/design/learnerRegisterPolicy.generated.ts'), 'utf8');
    expect(copy.endsWith(canonical)).toBe(true);
  });

  it('the compact stage shrinks with age, reacts to a miss with encouragement only, and never celebrates an answer', () => {
    const bands: AgeBand[] = ['6-9', '10-12', '13-17', 'adult'];
    const sizes = bands.map((band) => mentorReaction(band, null).mentor.stageBandPx);
    expect(sizes).toEqual([110, 96, 80, 80]);
    for (const band of bands) {
      for (const verdict of ['review', 'incomplete', 'invalid'] as const) {
        expect(mentorReaction(band, verdict).emotion, `${band} ${verdict}`).toBe('encouraging');
      }
      expect(['happy', 'neutral']).toContain(mentorReaction(band, 'met').emotion);
      expect(['celebrate', 'jump', 'dance']).not.toContain(mentorReaction(band, 'met').action);
    }
    expect(mentorReaction('13-17', 'review').action).toBe('idle');
    expect(mentorReaction('6-9', 'review').action).toBe('nod');
  });

  it('the result screen frames the reward per register: a tally and a medal for the youngest, capability data for teens', () => {
    const receipt = { ...milestoneReceipt('en-US'), celebrations: ['lesson-complete'], streak: undefined, pace: undefined };
    const young = render(<LessonResultView rawReceipt={receipt} locale="en-US" onContinue={() => {}} fixture register="young" />);
    expect(young.container.querySelector('.lf-result-medal')).not.toBeNull();
    expect(young.getByRole('heading', { level: 1 }).textContent).toBe('Lesson complete!');
    expect(young.container.querySelector('.lf-result-figured')!.textContent).toBe('You worked out: Saving toward a goal.');
    expect(young.container.querySelector('.lf-result-stat > span')!.textContent).toBe('XP earned');
    young.unmount();
    const teen = render(<LessonResultView rawReceipt={receipt} locale="en-US" onContinue={() => {}} fixture register="teen" />);
    expect(teen.container.querySelector('.lf-result-medal')).toBeNull();
    expect(teen.getByRole('heading', { level: 1 }).textContent).toBe('Lesson complete');
    expect(teen.container.querySelector('.lf-result-figured')!.textContent).toBe('Skill built: Saving toward a goal.');
    expect(teen.container.querySelector('.lf-result-stat > span')!.textContent).toBe('First-try accuracy');
    expect(teen.container.querySelector('main')!.dataset.register).toBe('teen');
  });

  it.each(LOCALES)('%s: every register\'s result copy is clean, roled and within its band\'s budget', (locale) => {
    for (const register of LEARNER_REGISTERS) {
      const receipt = { ...milestoneReceipt(locale), celebrations: ['lesson-complete'], streak: undefined, pace: undefined };
      const { container, unmount } = render(<LessonResultView rawReceipt={receipt} locale={locale} onContinue={() => {}} register={register} />);
      textNodesHaveRoles(container);
      expect(findLexicons(container.textContent ?? '', forbiddenLexicons(register)), register).toEqual([]);
      expect(budgetIssues(container, locale, REGISTERS[register].copyBand).filter((issue) => !issue.startsWith('first view')), register).toEqual([]);
      unmount();
    }
  });
});

describe('B.23: the graduation moment', () => {
  it.each(LOCALES)('%s: both graduations read in the new band, carry no celebration and meet the budget', (locale) => {
    for (const into of ['transition', 'teen'] as const) {
      const { container, unmount } = render(<RegisterGraduationView into={into} locale={locale} dark={false} onAcknowledge={async () => true} />);
      const section = container.querySelector('section')!;
      expect(section.dataset.ageBand).toBe(REGISTERS[into].copyBand);
      expect(container.querySelector('[data-celebrate], .lf-burst, img')).toBeNull();
      textNodesHaveRoles(container);
      expect(budgetIssues(container, locale, REGISTERS[into].copyBand)).toEqual([]);
      expect(findLexicons(container.textContent ?? '', forbiddenLexicons(into))).toEqual([]);
      expect(container.textContent).not.toMatch(/!|\bTutor\b|\bbot\b/);
      unmount();
    }
  });

  it('records the acknowledgement through the host and says so when it could not', async () => {
    const onAcknowledge = vi.fn(async () => false);
    render(<RegisterGraduationView into="transition" locale="en-US" dark={false} onAcknowledge={onAcknowledge} />);
    fireEvent.click(screen.getByRole('button', { name: registerGraduationCopy['en-US'].transition.action }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Could not save. Try again.'));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });
});

describe('B.26 and OD-1: the guided-review offer', () => {
  it.each(LOCALES)('%s: the Mentor offers in the learner\'s register, names the skill, never the learner', (locale) => {
    for (const register of LEARNER_REGISTERS) {
      for (const skill of [OFFER.skill, null]) {
        const { container, unmount } = render(<GuidedReviewOffer offer={{ ...OFFER, skill }} locale={locale} register={register} dark={false} onReview={() => {}} onDecline={() => {}} />);
        textNodesHaveRoles(container);
        expect(container.textContent).toContain('Dina');
        expect(budgetIssues(container, locale, REGISTERS[register].copyBand), `${register} ${skill}`).toEqual([]);
        expect(findLexicons(container.textContent ?? '', [...UNIVERSAL_FORBIDDEN, ...REGISTERS[register].tone.forbids])).toEqual([]);
        expect(container.textContent).not.toMatch(/lives?\b|vidas?\b|hearts?\b|\bTutor\b|fail|wrong|mistake|error|incorrect|falhou|errou|fallaste|equivoc/i);
        expect(container.querySelector('[role="dialog"], [aria-modal]')).toBeNull();
        unmount();
      }
    }
    expect(guidedReviewVoice('young')).toBe('warm');
    expect(guidedReviewVoice('teen')).toBe('direct');
    expect(guidedReviewCopy[locale].warm.line('x')).not.toBe(guidedReviewCopy[locale].direct.line('x'));
  });

  it('reviewing passes the skill key; declining (button or Escape) is neutral', () => {
    const onReview = vi.fn();
    const onDecline = vi.fn();
    render(<GuidedReviewOffer offer={OFFER} locale="en-US" register="young" dark={false} onReview={onReview} onDecline={onDecline} />);
    fireEvent.click(screen.getByRole('button', { name: 'Practice with Dina' }));
    expect(onReview).toHaveBeenCalledWith('financial-education/saving-goal');
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(onDecline).toHaveBeenCalledTimes(2);
  });

  it('accepts only Core\'s offer shape', () => {
    expect(guidedReviewOfferSchema.safeParse(OFFER).success).toBe(true);
    for (const bad of [{ ...OFFER, misses: 2 }, { ...OFFER, skill_key: '../admin' }, { ...OFFER, character: 'bot' }, { ...OFFER, lives: 3 }, null]) {
      expect(guidedReviewOfferSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('the register client', () => {
  const reply = (data: unknown, error: { code: string } | null = null): RegisterTransport => async () => ({ data, error });
  const ok = { register: 'transition', copy_band: '10-12', policy_version: '2026-09-24.1', graduation: { from: 'young', to: 'transition' } };

  it('reads Core\'s register and refuses a disagreeing or unknown payload', async () => {
    expect(await fetchLearnerRegister(reply(ok))).toEqual({ status: 'ready', value: ok });
    for (const bad of [{ ...ok, copy_band: '6-9' }, { ...ok, policy_version: '1999-01-01.0' }, { ...ok, register: 'baby' }, { ...ok, extra: 1 }]) {
      expect(await fetchLearnerRegister(reply(bad)), JSON.stringify(bad)).toEqual({ status: 'error' });
    }
    expect(await fetchLearnerRegister(reply(null, { code: 'DATA_UNAVAILABLE' }))).toEqual({ status: 'error' });
    expect(await fetchLearnerRegister(async () => { throw new Error('offline'); })).toEqual({ status: 'error' });
  });

  it('an unknown register reads as the youngest; an acknowledgement is only true when Core says so', async () => {
    expect(registerOf({ status: 'error' })).toBe<LearnerRegister>('young');
    expect(registerOf({ status: 'loading' })).toBe<LearnerRegister>('young');
    const calls: unknown[] = [];
    expect(await acknowledgeGraduation(async (path, init) => { calls.push([path, init]); return { data: { acknowledged: true, register: 'teen' }, error: null }; }, 'teen')).toBe(true);
    expect(calls).toEqual([['/learn/register/graduation', { method: 'POST', body: { register: 'teen' } }]]);
    expect(await acknowledgeGraduation(reply(null, { code: 'NO_GRADUATION' }), 'teen')).toBe(false);
  });
});
