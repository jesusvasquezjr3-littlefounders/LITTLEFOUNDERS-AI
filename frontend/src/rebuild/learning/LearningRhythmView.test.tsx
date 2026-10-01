import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type Locale } from '../design/copyBudget';
import { LearningRhythmView, learningRhythmCopy } from './LearningRhythmView';
import { fetchRhythm, savePace, type MotivationTransport, type Pace } from './motivation';
import { rhythmPreviewStates } from './motivationFixtures';
import { streakPauseCopy } from '../family/StreakPauseControl';
import { StreakPauseControl } from '../family/StreakPauseControl';
import { endKidStreakPause, fetchKidStreak, pauseRangeValid, setKidStreakPause, type StreakPauseTransport } from '../family/streakPause';
import { streak as streakFixture, streakPausePreviewStates } from './motivationFixtures';
import { enterDate } from '../test/dateParts';

/*
 * S05.3e (B.21, B.24): the learner's rhythm and the guardian's holiday pause.
 * Shapes are validated at the client; Core authorizes (backend tests). Here:
 * every state renders, the no-loss and glossary rules hold in three locales,
 * the Copy Budget holds for the youngest band (the learner) and adults (the
 * guardian), and the pace choice is the learner's own action.
 */

const LOCALES: Locale[] = ['en-US', 'es-MX', 'pt-BR'];
const LOSS = /\b(lost|lose|broke|broken|reset|freeze|perdiste|perder|rota|reinici|congel|perdeu|perdeu|quebr|congela)\w*/i;
const noop = () => {};

function renderRhythm(state: keyof typeof rhythmPreviewStates, locale: Locale = 'en-US', onSavePace: (goal: 1 | 2 | 3) => Promise<Pace | null> = vi.fn(async () => null)) {
  return render(<LearningRhythmView state={rhythmPreviewStates[state]!} locale={locale} dark={false} onBack={noop} onRetry={noop}
    onSavePace={onSavePace} onOpenPath={noop} onOpenMentor={noop} />);
}

describe('B.21 learner rhythm: the streak reads without loss framing', () => {
  it.each(LOCALES)('%s: every state renders with a copy role on every text node, and never celebrates', (locale) => {
    for (const state of Object.keys(rhythmPreviewStates)) {
      const { container, unmount } = renderRhythm(state as keyof typeof rhythmPreviewStates, locale);
      expect(container.querySelectorAll('h1')).toHaveLength(1);
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent?.trim()) expect(node.parentElement!.closest('[data-copy-role]'), `${state}: ${node.textContent}`).not.toBeNull();
      }
      expect(container.querySelector('[data-celebrate], .lf-burst')).toBeNull();
      expect(container.textContent).not.toMatch(LOSS);
      expect(container.textContent).not.toMatch(/avatar|\bTutor\b|\bbot\b|lives?\b|vidas?\b/i);
      unmount();
    }
  });

  it('a resting run shows "Streak resting" and the best, never a zero streak', () => {
    const { container } = renderRhythm('resting');
    expect(screen.getByRole('heading', { name: 'Streak resting' })).toBeTruthy();
    expect(screen.getByText('Your best stays.')).toBeTruthy();
    expect(container.querySelector('.lf-rhythm-count')).toBeNull();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('states the rest-day rule and the rest days left, in the glossary\'s words', () => {
    renderRhythm('open', 'es-MX');
    expect(screen.getByText('Cada semana tiene 2 días de descanso.')).toBeTruthy();
    expect(screen.getByText('Días de descanso libres')).toBeTruthy();
    renderRhythm('paused', 'pt-BR');
    expect(screen.getByText(/Pausada até 3 de out/)).toBeTruthy();
  });
});

describe('B.24 learner rhythm: pace, path and Mentor are the learner\'s choices', () => {
  it('choosing a pace saves it through the host and marks it checked; a failure says so', async () => {
    const onSavePace = vi.fn(async (goal: 1 | 2 | 3) => ({ goal, chosen: true, passedToday: 1, goalMet: goal === 1 }));
    renderRhythm('open', 'en-US', onSavePace);
    // Layered: the streak tab opens first; the choices are one tap away.
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Choices' }));
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    fireEvent.click(radios[2]!);
    await waitFor(() => expect(screen.getByText('Saved.')).toBeTruthy());
    expect(onSavePace).toHaveBeenCalledWith(3);
    expect(screen.getAllByRole('radio')[2]!.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Today: 1 of 3.')).toBeTruthy();

    const failing = vi.fn(async () => null);
    const { container } = renderRhythm('open', 'en-US', failing);
    fireEvent.click(container.querySelector<HTMLButtonElement>('[role=tab]:last-child')!);
    fireEvent.click(container.querySelectorAll<HTMLButtonElement>('[role=radio]')[0]!);
    await waitFor(() => expect(screen.getByText('Could not save. Try again.')).toBeTruthy());
  });

  it('a met plan reads as done, with no celebration', () => {
    const { container } = renderRhythm('today');
    fireEvent.click(screen.getByRole('tab', { name: 'Choices' }));
    expect(screen.getByText('Today\'s plan is done.')).toBeTruthy();
    expect(container.querySelector('[data-celebrate]')).toBeNull();
  });

  it('offers the path and the Mentor, and names the chosen Mentor', () => {
    const onOpenPath = vi.fn();
    const onOpenMentor = vi.fn();
    render(<LearningRhythmView state={rhythmPreviewStates.open!} locale="en-US" dark onBack={noop} onRetry={noop}
      onSavePace={async () => null} onOpenPath={onOpenPath} onOpenMentor={onOpenMentor} />);
    const tab = screen.getByRole('tab', { name: 'Streak' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Choices' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Your Mentor: Zara')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pick a lesson' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change Mentor' }));
    expect(onOpenPath).toHaveBeenCalledTimes(1);
    expect(onOpenMentor).toHaveBeenCalledTimes(1);
  });
});

describe('S05.3e Copy Budget, three locales', () => {
  const learner = (locale: Locale) => {
    const t = learningRhythmCopy[locale];
    return [
      [t.title, 'heading'], [t.streak, 'action'], [t.choices, 'action'], [t.resting, 'heading'], [t.pace, 'heading'], [t.errorTitle, 'heading'],
      [t.back, 'action'], [t.retry, 'action'], [t.path, 'action'], [t.changeMentor, 'action'],
      [t.loading, 'body'], [t.errorBody, 'body'], [t.days(5), 'body'], [t.days(1), 'body'], [t.restingBody, 'body'], [t.none, 'body'], [t.today, 'body'],
      [t.paused('3 Oct'), 'body'], [t.best, 'body'], [t.practiced, 'body'], [t.restLeft, 'body'], [t.rule, 'body'], [t.tabs, 'body'],
      [t.paceToday(1, 2), 'body'], [t.paceDone, 'body'], [t.saved, 'body'], [t.saveFailed, 'body'], [t.mentor('Dr. Rho'), 'body'],
    ] as const;
  };
  it.each(LOCALES)('%s: the learner\'s strings fit the youngest band', (locale) => {
    for (const [text, role] of learner(locale)) expect(checkCopy(text, role, { locale, ageBand: '6-9', surface: 'app' }), text).toEqual([]);
  });
  it.each(LOCALES)('%s: the guardian\'s strings fit the adult band', (locale) => {
    const t = streakPauseCopy[locale];
    const strings = [[t.title, 'heading'], [t.save, 'action'], [t.end, 'action'], [t.retry, 'action'],
      ...[t.intro, t.rule, t.from, t.to, t.active('3 Oct', '9 Oct'), t.summary(4, 12, false), t.summary(0, 12, true), t.saved, t.ended, t.invalid,
        t.failed, t.noAccess, t.loadFailed, t.loading].map((text) => [text, 'body'])] as const;
    for (const [text, role] of strings) expect(checkCopy(text, role as 'body', { locale, ageBand: 'adult', surface: 'app' }), text).toEqual([]);
  });
  it('uses the glossary: rest day, never a streak freeze', () => {
    const all = JSON.stringify([learningRhythmCopy, streakPauseCopy]);
    expect(all).not.toMatch(/freeze|congel/i);
    expect(learningRhythmCopy['en-US'].restLeft).toMatch(/rest day/i);
    expect(learningRhythmCopy['es-MX'].restLeft).toMatch(/días de descanso/i);
    expect(learningRhythmCopy['pt-BR'].restLeft).toMatch(/dias de descanso/i);
  });
});

describe('S05.3e clients: shapes are validated, refusals are mapped', () => {
  const reply = (data: unknown, code?: string): MotivationTransport => async () => ({ data, error: code ? { code } : null });

  it('fetchRhythm refuses a malformed or impossible payload', async () => {
    const good = (rhythmPreviewStates.open as { rhythm: unknown }).rhythm;
    expect((await fetchRhythm(reply(good), '2026-09-24')).status).toBe('ready');
    expect((await fetchRhythm(reply({ ...(good as object), streak: { ...((good as { streak: object }).streak), status: 'resting', current: 4 } }))).status).toBe('error');
    expect((await fetchRhythm(reply(null, 'DATA_UNAVAILABLE'))).status).toBe('error');
    expect((await fetchRhythm(async () => { throw new Error('offline'); })).status).toBe('error');
  });

  it('savePace sends only the goal and the learner\'s date', async () => {
    const transport = vi.fn<MotivationTransport>(async () => ({ data: { pace: { goal: 2, chosen: true, passedToday: 0, goalMet: false } }, error: null }));
    expect(await savePace(transport, 2, '2026-09-24')).toEqual({ goal: 2, chosen: true, passedToday: 0, goalMet: false });
    expect(transport).toHaveBeenCalledWith('/learn/pace', { method: 'PUT', body: { daily_lesson_goal: 2, local_date: '2026-09-24' } });
    expect(await savePace(async () => ({ data: null, error: { code: 'VALIDATION_ERROR' } }), 2)).toBeNull();
  });

  it('the guardian client maps refusals and repeats the range rule', async () => {
    const streak = (streakPausePreviewStates.active as { streak: unknown }).streak;
    const ok: StreakPauseTransport = async () => ({ data: { streak }, error: null });
    expect((await fetchKidStreak(ok, 'kid', '2026-09-24')).status).toBe('ready');
    expect((await fetchKidStreak(async () => ({ data: null, error: { code: 'NOT_FOUND' } }), 'kid', '2026-09-24')).status).toBe('no-access');
    expect((await setKidStreakPause(async () => ({ data: null, error: { code: 'STREAK_PAUSE_INVALID' } }), 'kid', '2026-09-24', '2026-09-30', '2026-09-24')).status).toBe('invalid');
    expect((await setKidStreakPause(async () => ({ data: null, error: { code: 'PARENT_VERIFICATION_REQUIRED' } }), 'kid', '2026-09-24', '2026-09-30', '2026-09-24')).status).toBe('no-access');
    expect((await endKidStreakPause(ok, 'kid', '2026-09-24')).status).toBe('ended');
    expect(pauseRangeValid('2026-09-24', '2026-10-14', '2026-09-24')).toBe(true);
    expect(pauseRangeValid('2026-09-24', '2026-10-15', '2026-09-24')).toBe(false);
    expect(pauseRangeValid('2026-09-16', '2026-09-20', '2026-09-24')).toBe(false);
    expect(pauseRangeValid('2026-09-30', '2026-09-29', '2026-09-24')).toBe(false);
  });
});

describe('B.21 guardian holiday pause control', () => {
  it('refuses an out-of-policy range before sending, then saves a valid one', async () => {
    const onPause = vi.fn(async (startsOn: string, endsOn: string) => ({ status: 'saved' as const,
      streak: streakFixture({ status: 'paused', pause: { startsOn, endsOn } }) }));
    render(<StreakPauseControl state={streakPausePreviewStates.ready!} locale="en-US" dark={false} today="2026-09-24"
      onPause={onPause} onEnd={async () => ({ status: 'failed' })} onRetry={noop} />);
    enterDate('Last day', '2026-10-20');
    fireEvent.click(screen.getByRole('button', { name: 'Pause streak' }));
    expect(screen.getByText('Pick up to 21 days, starting within the last week.')).toBeTruthy();
    expect(onPause).not.toHaveBeenCalled();
    enterDate('Last day', '2026-09-30');
    fireEvent.click(screen.getByRole('button', { name: 'Pause streak' }));
    await waitFor(() => expect(screen.getByText('Pause saved.')).toBeTruthy());
    expect(onPause).toHaveBeenCalledWith('2026-09-24', '2026-09-30');
    expect(screen.getByRole('button', { name: 'End pause' })).toBeTruthy();
  });

  it('shows an active pause with its end action, and a lost link as no access', async () => {
    const onEnd = vi.fn(async () => ({ status: 'ended' as const, streak: streakFixture({}) }));
    const { unmount } = render(<StreakPauseControl state={streakPausePreviewStates.active!} locale="es-MX" dark today="2026-09-24"
      onPause={async () => ({ status: 'failed' })} onEnd={onEnd} onRetry={noop} />);
    expect(screen.getByText(/En pausa del 22 sep/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Terminar pausa' }));
    await waitFor(() => expect(screen.getByText('Pausa terminada.')).toBeTruthy());
    unmount();
    render(<StreakPauseControl state={{ status: 'no-access' }} locale="en-US" dark={false} today="2026-09-24"
      onPause={async () => ({ status: 'failed' })} onEnd={async () => ({ status: 'failed' })} onRetry={noop} />);
    expect(screen.getByText('This child is no longer linked to you.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pause streak' })).toBeNull();
  });
});
