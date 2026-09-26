import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import enPlacement from '../../i18n/en-US/placement.json';
import esPlacement from '../../i18n/es-MX/placement.json';
import ptPlacement from '../../i18n/pt-BR/placement.json';
import { checkCopy, type Locale } from '../design/copyBudget';
import { PENDING_NARRATION_REFRAME, placementFrameSchema, placementOutcomeCopy, placementOutcomeLines, verdictWords } from './placementOutcome';
import { PlacementOutcomeView } from './PlacementOutcomeView';

const locales: Locale[] = ['en-US', 'es-MX', 'pt-BR'];
const paths = ['adaptive_quiz', 'learner_chose_start', 'learner_adjusted', 'no_probe_content_fallback'] as const;
const frames = paths.flatMap((path) => (['beginning', 'further_in'] as const).map((start) => ({
  path, start, basis: 'prior_exposure' as const, learner_chosen: path === 'learner_chose_start' || path === 'learner_adjusted',
})));
const live = { 'en-US': enPlacement, 'es-MX': esPlacement, 'pt-BR': ptPlacement };

describe('B.15 placement outcome framing', () => {
  it('frames every outcome, in every locale, as prior exposure with growth language and no verdict words', () => {
    for (const locale of locales) for (const frame of frames) {
      const { title, lines } = placementOutcomeLines(frame, locale);
      expect(lines[0]).toBe(placementOutcomeCopy[locale].basis);
      expect(verdictWords(title, locale), `${locale} ${title}`).toEqual([]);
      for (const line of lines) expect(verdictWords(line, locale), `${locale} ${line}`).toEqual([]);
      expect(checkCopy(title, 'heading', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
      for (const line of lines) expect(checkCopy(line, 'body', { locale, ageBand: '6-9', surface: 'app' }), line).toEqual([]);
    }
  });

  it('keeps ability, ranking and failure language out of the live placement result', () => {
    for (const locale of locales) {
      for (const text of Object.values(live[locale].result)) expect(verdictWords(text, locale), `${locale}: ${text}`).toEqual([]);
    }
    // The live "from the beginning" outcome states the same prior-exposure basis as the rebuilt frame.
    expect(enPlacement.result.creditedNone).toBe(placementOutcomeCopy['en-US'].basis);
  });

  it('pins the two narrated lines awaiting paid clip regeneration, and their reframed replacements pass the gate', () => {
    for (const locale of locales) {
      for (const [key, line] of Object.entries(PENDING_NARRATION_REFRAME[locale]) as [('resultAhead' | 'resultStart'), { current: string; proposed: string }][]) {
        // When the owner approves regeneration, the live text becomes `proposed` and this entry is removed.
        expect(live[locale].narration[key], `${locale} ${key}`).toBe(line.current);
        expect(verdictWords(line.proposed, locale), `${locale} ${line.proposed}`).toEqual([]);
        expect(checkCopy(line.proposed, 'mentor', { locale, ageBand: '10-12', surface: 'app' }), line.proposed).toEqual([]);
      }
    }
  });

  it('catches the verdict phrases the old copy used', () => {
    expect(verdictWords('Look at that! You already knew a good chunk', 'en-US')).not.toEqual([]);
    expect(verdictWords('This feels too advanced', 'en-US')).not.toEqual([]);
    expect(verdictWords('Nos saltamos 3 lecciones que ya dominas.', 'es-MX')).not.toEqual([]);
    expect(verdictWords('A gente vai pular 1 lição que você já domina.', 'pt-BR')).not.toEqual([]);
  });

  it('accepts only the closed frame: no score, count or comparison can ride along', () => {
    expect(placementFrameSchema.safeParse(frames[0]).success).toBe(true);
    for (const bad of [{ ...frames[0], score: 40 }, { ...frames[0], percentile: 10 }, { ...frames[0], basis: 'ability' },
      { ...frames[0], learner_chosen: true }]) {
      expect(placementFrameSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('renders the frame, offers an earlier start only when the quiz chose a further start, and fails closed', () => {
    const onStart = vi.fn();
    const onEarlier = vi.fn();
    const quizAhead = { path: 'adaptive_quiz', start: 'further_in', basis: 'prior_exposure', learner_chosen: false };
    const { unmount } = render(<PlacementOutcomeView rawFrame={quizAhead} locale="pt-BR" dark onStart={onStart} onEarlier={onEarlier} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Seu caminho começa mais à frente' })).toBeTruthy();
    expect(screen.getByText(placementOutcomeCopy['pt-BR'].basis)).toBeTruthy();
    expect(screen.getByRole('main').getAttribute('data-theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Começar antes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar aqui' }));
    expect(onEarlier).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledTimes(1);
    unmount();
    const chosen = render(<PlacementOutcomeView rawFrame={{ ...quizAhead, path: 'learner_adjusted', learner_chosen: true }} locale="en-US" dark={false}
      onStart={onStart} onEarlier={onEarlier} />);
    expect(screen.getByText('You chose this start. You can change it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start earlier' })).toBeNull();
    chosen.unmount();
    render(<PlacementOutcomeView rawFrame={{ ...quizAhead, score: 12 }} locale="en-US" dark={false} onStart={onStart} />);
    expect(screen.getByRole('heading', { name: 'Start point unavailable' })).toBeTruthy();
    expect(screen.queryByText(/12/)).toBeNull();
  });
});
