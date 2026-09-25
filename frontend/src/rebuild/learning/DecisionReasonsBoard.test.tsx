import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type AgeBand, type Locale } from '../design/copyBudget';
import { scoreV2Judgment, scoreV2Visual } from './v2VisualScorer.generated';
import { DECIDE_JUSTIFY_PILOT_RUBRIC, decideJustifyPilotDocument, decisionReasonsCopy, type ReasoningGrade } from './DecisionReasonsBoard';
import { LessonDocumentView } from './LessonDocumentView';
import { loadLessonClientDocument } from './lessonDocument';

const locales: Locale[] = ['en-US', 'es-MX', 'pt-BR'];
const bands: AgeBand[] = ['6-9', '10-12', '13-17', 'adult'];

describe('B.12 decide-and-justify board', () => {
  it('accepts the pilot in every locale and band, and the public document carries no rubric', () => {
    for (const locale of locales) for (const band of bands) {
      const loaded = loadLessonClientDocument(decideJustifyPilotDocument(locale, band));
      expect(loaded.status, `${locale} ${band}`).toBe('ready');
      expect(JSON.stringify(decideJustifyPilotDocument(locale, band))).not.toMatch(/sound|unsupported|acceptable/);
    }
  });

  it('refuses a document whose choices and reasons share an id', () => {
    const document = decideJustifyPilotDocument('en-US', '10-12') as { segments: { payload: { reasons: { id: string; label: string }[] } }[] };
    document.segments[0]!.payload.reasons[2] = { id: 'save-first', label: 'Copy' };
    expect(loadLessonClientDocument(document).status).not.toBe('ready');
  });

  it('fits the youngest Copy Budget in every locale', () => {
    for (const locale of locales) {
      const t = decisionReasonsCopy[locale];
      for (const key of ['back', 'check', 'continue'] as const) expect(checkCopy(t[key], 'action', { locale, ageBand: '6-9', surface: 'app' }), key).toEqual([]);
      for (const key of ['board', 'choice'] as const) expect(checkCopy(t[key], 'heading', { locale, ageBand: '6-9', surface: 'app' }), key).toEqual([]);
      for (const key of ['met', 'review', 'sound', 'partial', 'unsupported', 'unavailable'] as const) {
        expect(checkCopy(t[key], 'body', { locale, ageBand: '6-9', surface: 'app' }), key).toEqual([]);
      }
      const pilot = decideJustifyPilotDocument(locale, '6-9') as { title: string; segments: { prompt: string; payload: { reasonPrompt: string; choices: { label: string }[]; reasons: { label: string }[] } }[] };
      const segment = pilot.segments[0]!;
      expect(checkCopy(pilot.title, 'heading', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
      for (const text of [segment.prompt, segment.payload.reasonPrompt]) expect(checkCopy(text, 'prompt', { locale, ageBand: '6-9', surface: 'app' }), text).toEqual([]);
      for (const option of [...segment.payload.choices, ...segment.payload.reasons]) {
        expect(checkCopy(option.label, 'option', { locale, ageBand: '6-9', surface: 'app' }), option.label).toEqual([]);
      }
    }
  });

  it('needs a decision and a reason, then shows the verdict and the reason quality as separate lines', async () => {
    const grade = vi.fn(async (answer: { choice: string; reason: string }): Promise<ReasoningGrade> => {
      const payload = { choiceIds: ['save-first', 'spend-all'], reasonIds: ['reason-goal', 'reason-feel', 'reason-lucky'] };
      const verdict = scoreV2Visual('reasoning.decide-justify.v2', payload, answer, DECIDE_JUSTIFY_PILOT_RUBRIC);
      const judgment = scoreV2Judgment('reasoning.decide-justify.v2', payload, answer, DECIDE_JUSTIFY_PILOT_RUBRIC);
      return { verdict: verdict === 'met' || verdict === 'review' ? verdict : 'invalid', ...(judgment !== 'invalid' ? { judgment } : {}) };
    });
    render(<LessonDocumentView raw={decideJustifyPilotDocument('en-US', '10-12')} locale="en-US" ageBand="10-12" onBack={() => {}}
      onGradeReasoning={(answer) => grade(answer)} onComplete={async () => true} />);
    const check = screen.getByRole('button', { name: 'Check' });
    expect(check).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Spend all now' }));
    expect(check).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'It gets me closer' }));
    fireEvent.click(check);
    expect(await screen.findByText('Look again at what matters most.')).toBeInTheDocument();
    // Sound reasoning behind a choice that does not work: Law 4 sees both.
    expect(screen.getByText('Your reason explains it well.')).toBeInTheDocument();
    expect(grade).toHaveBeenLastCalledWith({ choice: 'spend-all', reason: 'reason-goal' });

    fireEvent.click(screen.getByRole('button', { name: 'Save 4 coins' }));
    fireEvent.click(screen.getByRole('button', { name: 'I just picked one' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('That choice works.')).toBeInTheDocument();
    expect(screen.getByText('Try a reason that explains your choice.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save 4 coins' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Finish lesson' })).toBeInTheDocument();
  });

  it('shows a neutral retry state when grading fails, and refuses to render without a reasoning grader', async () => {
    const { unmount } = render(<LessonDocumentView raw={decideJustifyPilotDocument('es-MX', '6-9')} locale="es-MX" ageBand="6-9" onBack={() => {}}
      onGradeReasoning={async () => { throw new Error('offline'); }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar 4 monedas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Me acerca a la meta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    await waitFor(() => expect(screen.getByText('No pudimos comprobarlo. Intenta otra vez.')).toBeInTheDocument());
    unmount();
    render(<LessonDocumentView raw={decideJustifyPilotDocument('en-US', '10-12')} locale="en-US" ageBand="10-12" onBack={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
  });
});
