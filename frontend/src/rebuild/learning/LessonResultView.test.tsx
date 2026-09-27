import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonResultView, lessonCompletionReceiptSchema, lessonResultCopy } from './LessonResultView';
import { milestoneReceipt } from './motivationFixtures';
import { checkCopy } from '../design/copyBudget';

const receipt = {
  schema_version: 2, completion_id: 'sample-completion-1', lesson_id: 'pilot-savings-sequence', version_id: 'rev-1',
  locale: 'es-MX', first_try_correct: 3, graded_count: 4, awarded_xp: 40, duration_seconds: 200, previous_best_percent: 60,
};

describe('lesson result receipt boundary', () => {
  it('renders result statistics from a valid receipt and identifies a preview fixture', () => {
    const onContinue = vi.fn();
    render(<LessonResultView rawReceipt={receipt} locale="es-MX" onContinue={onContinue} fixture />);
    expect(screen.getByRole('heading', { name: '¡Lección terminada!' })).toBeTruthy();
    expect(screen.getByText('Resultado de ejemplo')).toBeTruthy();
    expect(screen.getByText('3/4 al primer intento.')).toBeTruthy();
    expect(screen.getAllByText('75%')).toHaveLength(3);
    expect(screen.getByText('3:20')).toBeTruthy();
    expect(screen.getByText('Nueva mejor marca')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Hoy' }).getAttribute('aria-valuenow')).toBe('75');
    expect(screen.getByRole('progressbar', { name: 'Mejor' }).getAttribute('aria-valuenow')).toBe('75');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('refuses malformed, inconsistent, answer-bearing and wrong-locale receipts', () => {
    for (const value of [{ ...receipt, graded_count: 2 }, { ...receipt, answer_key: '7' }, { ...receipt, awarded_xp: -1 },
      { ...receipt, schema_version: 3 }, { ...receipt, locale: 'en-US' }]) {
      const { unmount } = render(<LessonResultView rawReceipt={value} locale="es-MX" onContinue={() => {}} />);
      expect(screen.getByRole('heading', { name: 'Resultado no disponible' })).toBeTruthy();
      expect(screen.queryByText('XP ganados')).toBeNull();
      unmount();
    }
    expect(lessonCompletionReceiptSchema.safeParse(receipt).success).toBe(true);
  });

  it.each([
    ['en-US', 'Your saved best is still 100%. This was practice.'],
    ['es-MX', 'Tu mejor marca sigue en 100%. Fue práctica.'],
    ['pt-BR', 'Seu recorde salvo continua 100%. Foi prática.'],
  ] as const)('explains preserved progress after a lower %s replay', (locale, message) => {
    const { unmount } = render(<LessonResultView rawReceipt={{ ...receipt, locale, first_try_correct: 2, previous_best_percent: 100 }}
      locale={locale} onContinue={() => {}} />);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText(/2\/4/)).toBeNull();
    expect(screen.getByRole('progressbar', { name: locale === 'en-US' ? 'Best' : locale === 'es-MX' ? 'Mejor' : 'Recorde' })
      .getAttribute('aria-valuenow')).toBe('100');
    unmount();
  });

  it('B.5: follows the Core replay notice, reports it once, and never reports from a fixture', () => {
    const onNoticeShown = vi.fn();
    const kept = { ...receipt, locale: 'en-US', first_try_correct: 2, previous_best_percent: 100,
      replay: { kind: 'replay', notice: 'best_kept', best_score_kept: true, xp_policy: 'improvement_only' } };
    const { rerender, unmount } = render(<LessonResultView rawReceipt={kept} locale="en-US" onContinue={() => {}} onNoticeShown={onNoticeShown} dark={false} />);
    expect(screen.getByText('Your saved best is still 100%. This was practice.')).toBeTruthy();
    expect(screen.getByRole('main').className).toContain('lf-rebuild');
    rerender(<LessonResultView rawReceipt={kept} locale="en-US" onContinue={() => {}} onNoticeShown={onNoticeShown} dark={false} />);
    expect(onNoticeShown).toHaveBeenCalledTimes(1);
    unmount();

    const preview = vi.fn();
    render(<LessonResultView rawReceipt={kept} locale="en-US" onContinue={() => {}} onNoticeShown={preview} fixture />);
    expect(preview).not.toHaveBeenCalled();
  });

  it('B.5: a server "none" notice shows no saved-best line, and a "new_best" marks the new best', () => {
    const none = { ...receipt, locale: 'en-US', replay: { kind: 'first', notice: 'none', best_score_kept: false, xp_policy: 'improvement_only' } };
    const { unmount } = render(<LessonResultView rawReceipt={none} locale="en-US" onContinue={() => {}} />);
    expect(screen.queryByText(/saved best/)).toBeNull();
    expect(screen.queryByText('New best')).toBeNull();
    unmount();
    render(<LessonResultView rawReceipt={{ ...none, replay: { ...none.replay, kind: 'replay', notice: 'new_best' } }} locale="en-US" onContinue={() => {}} />);
    expect(screen.getByText('New best')).toBeTruthy();
  });

  it('B.12: shows the judgment count beside the score, never inside it, and refuses inconsistent counts', () => {
    const judged = { ...receipt, locale: 'en-US', judgment: { assessed: 2, sound: 1, partial: 1, unsupported: 0 } };
    const { unmount } = render(<LessonResultView rawReceipt={judged} locale="en-US" onContinue={() => {}} />);
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByText('Well-explained choices')).toBeTruthy();
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
    unmount();
    for (const bad of [{ ...judged, judgment: { assessed: 2, sound: 2, partial: 1, unsupported: 0 } },
      { ...judged, judgment: { assessed: 5, sound: 5, partial: 0, unsupported: 0 } },
      { ...judged, replay: { kind: 'replay', notice: 'best_kept', best_score_kept: false, xp_policy: 'improvement_only' } },
      { ...judged, replay: { kind: 'replay', notice: 'none', best_score_kept: false, xp_policy: 'pay_every_run' } }]) {
      expect(lessonCompletionReceiptSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('B.20 / OD-7 (S05.3e): motion only for what Core put on the closed list, and the skill behind the XP leads', () => {
    const { container, unmount } = render(<LessonResultView rawReceipt={milestoneReceipt('en-US')} locale="en-US" onContinue={() => {}} />);
    expect(container.querySelector('.lf-result-medal')?.getAttribute('data-celebrate')).toBe('lesson-complete');
    expect(container.querySelector('.lf-result-streak')?.getAttribute('data-celebrate')).toBe('streak-7');
    expect(screen.getByText('7-day streak')).toBeTruthy();
    expect(screen.getByText('You worked out: Saving toward a goal.')).toBeTruthy();
    expect(screen.queryByText('3/4 on first try.')).toBeNull();
    // B.24: meeting one's own plan is a plain status, never a celebration.
    expect(screen.getByRole('status').textContent).toBe("Today's plan is done.");
    // A first completion has no earlier best to compare with.
    expect(screen.queryByRole('progressbar')).toBeNull();
    unmount();
  });

  it('OD-28 (V-12): the confetti burst is part of the lesson-complete moment only, decorative, and above the heading', () => {
    const base = milestoneReceipt('en-US');
    for (const [celebrations, shown] of [[['lesson-complete'], true], [['streak-7'], false], [[], false], [undefined, false]] as const) {
      const { container, unmount } = render(<LessonResultView rawReceipt={{ ...base, celebrations }} locale="en-US" onContinue={() => {}} />);
      const confetti = container.querySelector('.lf-result-confetti');
      expect(Boolean(confetti)).toBe(shown);
      if (confetti) {
        expect(confetti.getAttribute('aria-hidden')).toBe('true');
        expect(confetti.getAttribute('data-celebrate')).toBe('lesson-complete');
        expect(confetti.textContent).toBe('');
        expect(confetti.closest('[data-milestone="lesson-complete"]')).toBeTruthy();
        // The registered motion asset (07 §5): without motion it shows its designated static frame, decorative.
        const asset = confetti.querySelector('[data-asset-id="celebration.lesson-complete.confetti"]');
        expect(asset).not.toBeNull();
        const still = asset!.querySelector('img');
        expect(still?.getAttribute('src')).toBe('/rebuild/motion/lesson-confetti-still.svg');
        expect(still?.getAttribute('alt')).toBe('');
      }
      unmount();
    }
  });

  it("B.20: no celebration without Core's list; a milestone Core did not name, or an unknown value, moves nothing", () => {
    const base = milestoneReceipt('en-US');
    for (const celebrations of [undefined, [], ['lesson-complete'], ['correct-answer', 'coin-split', 'streak-8']]) {
      const { container, unmount } = render(<LessonResultView rawReceipt={{ ...base, celebrations }} locale="en-US" onContinue={() => {}} />);
      expect(container.querySelector('.lf-result-streak')).toBeNull();
      if (!celebrations?.includes('lesson-complete')) expect(container.querySelector('[data-celebrate]')).toBeNull();
      unmount();
    }
    expect(lessonCompletionReceiptSchema.safeParse({ ...base, recognition: { skills: [] } }).success).toBe(false);
    expect(lessonCompletionReceiptSchema.safeParse({ ...base, streak: { days: 8, milestone: 8, rest_days_bridged: 0 } }).success).toBe(false);
    expect(lessonCompletionReceiptSchema.safeParse({ ...base, pace: { goal: 4, passed_today: 1, goal_met: false } }).success).toBe(false);
  });

  it.each(['en-US', 'es-MX', 'pt-BR'] as const)('S05.3e copy fits the youngest band in %s', (locale) => {
    const t = lessonResultCopy[locale];
    for (const text of [t.figured('Saving toward a goal'), t.streak(30), t.paceDone]) {
      expect(checkCopy(text, 'body', { locale, ageBand: '6-9', surface: 'app' }), text).toEqual([]);
    }
  });
});
