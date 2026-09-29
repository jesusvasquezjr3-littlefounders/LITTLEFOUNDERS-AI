import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type Locale } from '../design/copyBudget';
import { loadLessonClientDocument, type LessonClientDocument } from './lessonDocument';
import { NumberLineBoard, numberLinePilotDocument } from './NumberLineBoard';
import { FractionNumberLineBoard, fractionNumberLinePilotDocument } from './FractionNumberLineBoard';
import { TaxBracketBoard, taxBracketPilotDocument } from './TaxBracketBoard';
import { fractionName, formatLineNumber } from './fractionName';
import { scoreV2Visual } from './v2VisualScorer.generated';
import { v2ScorerPayload } from './v2ScorerPayload.generated';

/*
 * GAP-FIX-R5 learning (Appendix P M2, M3, M20; Part 7.3 "one scorer, two
 * places"; Bible 05 §6): each board sends the answer shape Core now grades,
 * and the browser's copy of the canonical scorer reads that exact answer as
 * valid on the same semantic payload Core scores (scorer parity).
 */
const ready = (raw: unknown): LessonClientDocument => {
  const loaded = loadLessonClientDocument(raw);
  if (loaded.status !== 'ready') throw new Error(`document did not load: ${JSON.stringify(loaded)}`);
  return loaded.document;
};
const parity = (document: LessonClientDocument, answer: unknown) => {
  const segment = document.segments[0]!;
  return scoreV2Visual(segment.type as never, v2ScorerPayload(segment as never), answer);
};

describe('M2 ordered items on a bounded line', () => {
  const itemsDocument = () => {
    const raw = numberLinePilotDocument('en-US', '6-9') as { segments: Array<{ payload: Record<string, unknown>; prompt: string }> };
    raw.segments[0]!.payload = { minimum: 0, maximum: 100, step: 1, initial: 0, items: [{ id: 'coins-dina', label: 'Dina' }, { id: 'coins-zara', label: 'Zara' }] };
    raw.segments[0]!.prompt = 'Dina has 20 coins, Zara 45. Place each one.';
    return ready(raw);
  };

  it('places each labelled item in turn and sends every placement; the browser scorer reads it as valid', async () => {
    const document = itemsDocument();
    const onGrade = vi.fn(() => 'met' as const);
    render(<NumberLineBoard document={document} segment={document.segments[0] as never} onBack={() => {}} onGrade={onGrade} />);
    const check = screen.getByRole('button', { name: 'Check' });
    expect(check).toBeDisabled();
    fireEvent.change(screen.getByRole('slider', { name: 'Place the point: Dina' }), { target: { value: '22' } });
    expect(check).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Zara' }));
    const slider = screen.getByRole('slider', { name: 'Place the point: Zara' });
    fireEvent.change(slider, { target: { value: '44' } });
    expect(slider).toHaveAttribute('aria-valuetext', 'Zara: 44');
    await act(async () => { fireEvent.click(check); });
    const answer = { placements: { 'coins-dina': '22', 'coins-zara': '44' } };
    expect(onGrade).toHaveBeenCalledWith(answer, document.segments[0]!.id);
    expect(parity(document, answer)).toBe('valid');
  });

  it('the browser contract refuses an unbounded line (0-20) like Core and Forge', () => {
    const raw = numberLinePilotDocument('en-US', '6-9') as { segments: Array<{ payload: Record<string, unknown> }> };
    raw.segments[0]!.payload = { minimum: 0, maximum: 20, step: 1, initial: 0 };
    expect(loadLessonClientDocument(raw).status).not.toBe('ready');
  });
});

describe('M3 fraction line: spoken names, typed decimals, comparison and equivalents', () => {
  it('names the fraction in each language (Bible 05 §6)', () => {
    expect(fractionName(3, 4, 'en-US')).toBe('three quarters');
    expect(fractionName(3, 4, 'es-MX')).toBe('tres cuartos');
    expect(fractionName(3, 4, 'pt-BR')).toBe('três quartos');
    expect(fractionName(1, 2, 'es-MX')).toBe('un medio');
    expect(fractionName(2, 4, 'en-US')).toBe('two quarters');
    expect(fractionName(5, 4, 'en-US')).toBe('one and one quarter');
    expect(fractionName(7, 12, 'pt-BR')).toBe('sete doze avos');
    expect(fractionName(4, 4, 'es-MX')).toBe('uno');
    expect(fractionName(0, 4, 'pt-BR')).toBe('zero');
    expect(fractionName(8, 4, 'en-US')).toBe('two');
    expect(formatLineNumber('0.6', 'pt-BR')).toBe('0,6');
    expect(formatLineNumber('3/5', 'pt-BR')).toBe('3/5');
  });

  it.each([['en-US', 'three quarters, 0.75'], ['es-MX', 'tres cuartos, 0.75'], ['pt-BR', 'três quartos, 0,75']] as Array<[Locale, string]>)(
    '%s: the slider speaks the fraction, not "3/4"', (locale, spoken) => {
      const document = ready(fractionNumberLinePilotDocument(locale));
      render(<FractionNumberLineBoard document={document} segment={document.segments[0] as never} onBack={() => {}} onGrade={() => 'met'} />);
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '3' } });
      expect(slider).toHaveAttribute('aria-valuetext', spoken);
    });

  it('a decimal typed in the locale is parsed, moves the point and is what Core receives', async () => {
    const document = ready(fractionNumberLinePilotDocument('pt-BR'));
    const onGrade = vi.fn(() => 'met' as const);
    render(<FractionNumberLineBoard document={document} segment={document.segments[0] as never} onBack={() => {}} onGrade={onGrade} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Ou digite o número' }), { target: { value: '0,75' } });
    expect(screen.getByRole('slider')).toHaveValue('3');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Conferir' })); });
    expect(onGrade).toHaveBeenCalledWith({ value: '0.75' }, 'fraction-01');
    expect(parity(document, { value: '0.75' })).toBe('valid');
  });

  const pairDocument = (payload: Record<string, unknown>) => {
    const raw = fractionNumberLinePilotDocument('en-US') as { segments: Array<{ payload: Record<string, unknown> }> };
    raw.segments[0]!.payload = { maximumWhole: 1, divisions: 10, initialUnits: 0, spokenText: 'two fifths and zero point five', ...payload };
    return ready(raw);
  };

  it('a comparison places both numbers, then asks which is larger; the answer is valid for the browser scorer', async () => {
    const document = pairDocument({ compare_values: ['2/5', '0.5'] });
    const onGrade = vi.fn(() => 'met' as const);
    render(<FractionNumberLineBoard document={document} segment={document.segments[0] as never} onBack={() => {}} onGrade={onGrade} />);
    const check = screen.getByRole('button', { name: 'Check' });
    expect(check).toBeDisabled();
    fireEvent.change(screen.getByRole('slider', { name: 'Place the fraction: 2/5' }), { target: { value: '4' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Point to move' })).getByRole('radio', { name: '0.5' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Place the fraction: 0.5' }), { target: { value: '5' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Which is larger?' })).getByRole('radio', { name: '0.5' }));
    expect(check).toBeEnabled();
    await act(async () => { fireEvent.click(check); });
    const answer = { placements: { first: '4/10', second: '5/10' }, choice: 'second' };
    expect(onGrade).toHaveBeenCalledWith(answer, 'fraction-01');
    expect(parity(document, answer)).toBe('valid');
  });

  it('equivalents place two forms of one number and send both points', async () => {
    const document = pairDocument({ equivalent_values: ['3/5', '0.6'], spokenText: 'three fifths and zero point six' });
    const onGrade = vi.fn(() => 'review' as const);
    render(<FractionNumberLineBoard document={document} segment={document.segments[0] as never} onBack={() => {}} onGrade={onGrade} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Place the fraction: 3/5' }), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('radio', { name: '0.6' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Place the fraction: 0.6' }), { target: { value: '6' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check' })); });
    expect(onGrade).toHaveBeenCalledWith({ placements: { first: '6/10', second: '6/10' } }, 'fraction-01');
    expect(parity(document, { placements: { first: '6/10', second: '6/10' } })).toBe('valid');
  });

  it('keeps the new labels inside the Copy Budget in every locale', () => {
    const labels: Record<Locale, string[]> = {
      'en-US': ['Or type the number', 'Point to move', 'Which is larger?', 'Same size', 'Place each one', 'Average rate (%)'],
      'es-MX': ['O escribe el número', 'Punto que mueves', '¿Cuál es mayor?', 'Mismo tamaño', 'Coloca cada uno', 'Tasa promedio (%)'],
      'pt-BR': ['Ou digite o número', 'Ponto que você move', 'Qual é maior?', 'Mesmo tamanho', 'Coloque cada um', 'Alíquota média (%)'],
    };
    for (const locale of Object.keys(labels) as Locale[]) {
      for (const label of labels[locale]) expect(checkCopy(label, 'body', { locale, ageBand: '10-12', surface: 'app' }), label).toEqual([]);
    }
  });
});

describe('M20 asks the average rate', () => {
  it('sends tax, marginal and average (basis points); the browser scorer reads it as valid', async () => {
    const raw = taxBracketPilotDocument('en-US') as { segments: Array<{ grading: string }> };
    raw.segments[0]!.grading = 'server';
    const document = ready(raw);
    const onGrade = vi.fn(() => ({ verdict: 'met' as const }));
    render(<TaxBracketBoard document={document} segment={document.segments[0] as never} onBack={() => {}} onGrade={onGrade} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Tax' }), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('radio', { name: '20%' }));
    const check = screen.getByRole('button', { name: 'Check' });
    expect(check).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Average rate (%)' }), { target: { value: '16.67' } });
    await act(async () => { fireEvent.click(check); });
    const answer = { incomeMinor: 30_000, taxMinor: '5000', marginalBps: 2_000, averageBps: 1_667 };
    expect(onGrade).toHaveBeenCalledWith(answer, 'tax-01');
    expect(parity(document, answer)).toBe('valid');
    expect(parity(document, { incomeMinor: 30_000, taxMinor: '5000', marginalBps: 2_000 })).toBe('invalid');
  });
});
