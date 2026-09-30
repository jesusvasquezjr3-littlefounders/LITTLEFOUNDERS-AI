import { act, fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { Locale } from '../design/copyBudget';
import { BarModelBoard, barModelPilotDocument } from './BarModelBoard';
import { clientScorerVerdict } from './clientScorerVerdict';
import { CpaFadingBoard, cpaFadingPilotDocument } from './CpaFadingBoard';
import { FunctionMachineBoard, functionMachinePilotDocument } from './FunctionMachineBoard';
import { loadLessonClientDocument, type LessonClientDocument } from './lessonDocument';
import { SchemaDiagramBoard, schemaDiagramPilotDocument } from './SchemaDiagramBoard';
import { NumberAnswer, playerCopy, readNumberAnswer } from './segmentKit';

/*
 * GAP-FIX-R7 learning (Frontend Bible 05 §5; Appendix P Part 5 "Number input"
 * and Part 8 Definition of Done): every graded board that takes a typed number
 * uses the shared locale-aware NumberAnswer. It uses inputmode="decimal", parses
 * for the lesson's locale, echoes the parsed value before Check and sends Core
 * the canonical string. Anything it refuses is refused out loud, never by a
 * silently disabled Check. The four older boards (M7 bar model, M8 schema answer,
 * M1 CPA count, M13 function machine) were the last raw numeric fields.
 */

const LOCALES: Locale[] = ['en-US', 'es-MX', 'pt-BR'];
const load = (raw: unknown): LessonClientDocument => {
  const loaded = loadLessonClientDocument(raw);
  if (loaded.status !== 'ready') throw new Error('pilot did not load');
  return loaded.document;
};
const segmentOf = (document: LessonClientDocument, type: string) => document.segments.find((segment) => segment.type === type)! as never;
const CHECK: Record<Locale, string> = { 'en-US': 'Check', 'es-MX': 'Comprobar', 'pt-BR': 'Conferir' };
const check = (locale: Locale) => screen.getByRole('button', { name: CHECK[locale] });

describe('readNumberAnswer (Appendix P Part 5)', () => {
  it('reads thousands and decimals for each locale, and refuses what is ambiguous', () => {
    expect(readNumberAnswer('1,000', 'en-US').canonical).toBe('1000');
    expect(readNumberAnswer('1,000', 'es-MX').canonical).toBe('1000');
    expect(readNumberAnswer('1.000', 'pt-BR').canonical).toBe('1000');
    // The same text is a decimal in en-US: it reads as 1, and the echo shows it before Check.
    expect(readNumberAnswer('1.000', 'en-US').canonical).toBe('1');
    expect(readNumberAnswer('1,5', 'pt-BR').canonical).toBe('1.5');
    expect(readNumberAnswer('15 ', 'en-US').canonical).toBe('15');
    expect(readNumberAnswer('1,00', 'en-US')).toEqual({ canonical: null, problem: 'notNumber' });
    expect(readNumberAnswer('   ', 'en-US')).toEqual({ canonical: null, problem: 'empty' });
  });

  it('holds a board to its domain and names the reason', () => {
    expect(readNumberAnswer('1,5', 'pt-BR', { whole: true })).toEqual({ canonical: null, problem: 'wholeNumber' });
    expect(readNumberAnswer('-3', 'en-US', { whole: true })).toEqual({ canonical: null, problem: 'wholeNumber' });
    expect(readNumberAnswer('1.000', 'pt-BR', { whole: true, max: 999 })).toEqual({ canonical: null, problem: 'tooBig' });
    expect(readNumberAnswer('0', 'en-US', { whole: true, min: 1 })).toEqual({ canonical: null, problem: 'tooSmall' });
    expect(readNumberAnswer('1.000', 'pt-BR', { whole: true, max: 1000 })).toEqual({ canonical: '1000', problem: null });
  });
});

describe('NumberAnswer echoes the parsed value in every locale (Bible 05 §5)', () => {
  const echoes: Record<Locale, [string, string]> = { 'en-US': ['1,000', 'Reads as 1,000'], 'es-MX': ['1,000', 'Se lee 1,000'], 'pt-BR': ['1.000', 'Lê-se 1.000'] };
  it.each(LOCALES)('%s: "reads as" the thousands the learner typed, with inputmode="decimal"', (locale) => {
    const onChange = vi.fn();
    render(<NumberAnswer label="Answer" locale={locale} onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Answer' });
    expect(field).toHaveAttribute('inputmode', 'decimal');
    fireEvent.change(field, { target: { value: echoes[locale][0] } });
    expect(screen.getByText(echoes[locale][1])).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith('1000');
  });

  it.each(LOCALES)('%s: says why a number outside the domain cannot be checked', (locale) => {
    const t = playerCopy(locale);
    const onChange = vi.fn();
    const { rerender } = render(<NumberAnswer label="Answer" locale={locale} onChange={onChange} whole max={20} value="2,5" />);
    const reason = (text: string) => screen.getByText(text);
    expect(reason(locale === 'pt-BR' ? t.wholeNumber : t.notNumber)).toBeTruthy();
    rerender(<NumberAnswer label="Answer" locale={locale} onChange={onChange} whole max={20} value="99" />);
    expect(reason(t.tooBig)).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Answer' })).toHaveAttribute('aria-invalid', 'true');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('the four older graded boards use NumberAnswer and send the canonical value (GAP-FIX-R7)', () => {
  it.each(LOCALES)('%s M7 bar model answer: "15 " reads as 15 and is sent as "15"; a thousands answer past the model is refused out loud', async (locale) => {
    const document = load(barModelPilotDocument(locale));
    const onGrade = vi.fn(() => 'review' as const);
    render(<BarModelBoard document={document} segment={segmentOf(document, 'math.bar-model.answer.v2')} onBack={() => {}} onGrade={onGrade} />);
    const t = playerCopy(locale);
    const field = screen.getByRole('textbox');
    expect(field).toHaveAttribute('inputmode', 'decimal');
    fireEvent.change(field, { target: { value: locale === 'pt-BR' ? '1.000' : '1,000' } });
    expect(screen.getByText(t.tooBig)).toBeTruthy();
    expect(check(locale)).toBeDisabled();
    fireEvent.change(field, { target: { value: '15 ' } });
    expect(screen.getByText(t.readsAs.replace('{value}', '15'))).toBeTruthy();
    await act(async () => { fireEvent.click(check(locale)); });
    expect(onGrade).toHaveBeenCalledWith({ value: '15' }, 'bar-answer-01');
  });

  it.each(LOCALES)('%s M8 schema answer: the locale thousands separator reads, echoes and sends the canonical value', async (locale) => {
    const document = load(schemaDiagramPilotDocument(locale));
    const onGrade = vi.fn(() => 'met' as const);
    render(<SchemaDiagramBoard document={document} segment={segmentOf(document, 'math.schema-diagram.answer.v2')} onBack={() => {}} onGrade={onGrade} />);
    const t = playerCopy(locale);
    const field = screen.getByRole('textbox');
    expect(field).toHaveAttribute('inputmode', 'decimal');
    // 24 and 9: the scorer's bound is 24 × 9 + 24 + 9 = 249.
    fireEvent.change(field, { target: { value: '250' } });
    expect(screen.getByText(t.tooBig)).toBeTruthy();
    fireEvent.change(field, { target: { value: ' 15' } });
    expect(screen.getByText(t.readsAs.replace('{value}', '15'))).toBeTruthy();
    await act(async () => { fireEvent.click(check(locale)); });
    expect(onGrade).toHaveBeenCalledWith({ value: '15' }, expect.any(String));
  });

  it.each(LOCALES)('%s M1 CPA count: a decimal is refused as "not a whole number", a whole count is echoed and sent', async (locale) => {
    const document = load(cpaFadingPilotDocument(locale));
    const onGrade = vi.fn(() => 'review' as const);
    const sequence = { index: 0, total: 3, onAdvance: vi.fn() };
    render(<CpaFadingBoard document={document} segment={document.segments[0] as never} onBack={() => {}} onGrade={onGrade} sequence={sequence} />);
    const t = playerCopy(locale);
    const field = screen.getByRole('textbox');
    expect(field).toHaveAttribute('inputmode', 'decimal');
    fireEvent.change(field, { target: { value: locale === 'pt-BR' ? '6,5' : '6.5' } });
    expect(screen.getByText(t.wholeNumber)).toBeTruthy();
    expect(check(locale)).toBeDisabled();
    fireEvent.change(field, { target: { value: '07' } });
    expect(screen.getByText(t.readsAs.replace('{value}', '7'))).toBeTruthy();
    await act(async () => { fireEvent.click(check(locale)); });
    expect(onGrade).toHaveBeenCalledWith({ value: '7' }, 'cpa-concrete-01');
  });

  it.each(LOCALES)('%s M13 function machine: both parts of the rule are read, bounded and sent canonically', async (locale) => {
    const document = load(functionMachinePilotDocument(locale));
    const onGrade = vi.fn(() => 'met' as const);
    render(<FunctionMachineBoard document={document} segment={document.segments[0] as never} onBack={() => {}} onGrade={onGrade} />);
    const t = playerCopy(locale);
    const [multiplier, offset] = screen.getAllByRole('textbox');
    for (const field of [multiplier!, offset!]) expect(field).toHaveAttribute('inputmode', 'decimal');
    fireEvent.click(screen.getAllByRole('button').find((button) => ['Run', 'Ejecutar', 'Executar'].includes(button.textContent ?? ''))!);
    fireEvent.change(multiplier!, { target: { value: '0' } });
    expect(screen.getByText(t.tooSmall)).toBeTruthy();
    fireEvent.change(multiplier!, { target: { value: '5 ' } });
    fireEvent.change(offset!, { target: { value: '10' } });
    expect(screen.getByText(t.readsAs.replace('{value}', '5'))).toBeTruthy();
    expect(screen.getByText(t.readsAs.replace('{value}', '10'))).toBeTruthy();
    const checkRule = screen.getAllByRole('button').find((button) => /regra|regla|rule/i.test(button.textContent ?? ''))!;
    await act(async () => { fireEvent.click(checkRule); });
    expect(onGrade).toHaveBeenCalledWith({ multiplier: '5', offset: '10' }, 'function-machine-01');
  });

  it('bounds each board exactly where the canonical scorer starts refusing', () => {
    const bar = load(barModelPilotDocument('en-US'));
    const barMax = 2 * (50 + 12);
    expect(clientScorerVerdict(bar, 'bar-answer-01', { value: String(barMax) })).toBe('valid');
    expect(clientScorerVerdict(bar, 'bar-answer-01', { value: String(barMax + 1) })).toBe('invalid');
    const schema = load(schemaDiagramPilotDocument('en-US'));
    const schemaAnswer = schema.segments.find((segment) => segment.type === 'math.schema-diagram.answer.v2')!.id;
    expect(clientScorerVerdict(schema, schemaAnswer, { value: '249' })).toBe('valid');
    expect(clientScorerVerdict(schema, schemaAnswer, { value: '250' })).toBe('invalid');
    const cpa = load(cpaFadingPilotDocument('en-US'));
    expect(clientScorerVerdict(cpa, 'cpa-concrete-01', { value: '7' })).toBe('valid');
    expect(clientScorerVerdict(cpa, 'cpa-concrete-01', { value: '8' })).toBe('invalid');
    const machine = load(functionMachinePilotDocument('en-US'));
    expect(clientScorerVerdict(machine, 'function-machine-01', { multiplier: '9', offset: '50' })).toBe('valid');
    expect(clientScorerVerdict(machine, 'function-machine-01', { multiplier: '10', offset: '0' })).toBe('invalid');
    expect(clientScorerVerdict(machine, 'function-machine-01', { multiplier: '0', offset: '0' })).toBe('invalid');
    expect(clientScorerVerdict(machine, 'function-machine-01', { multiplier: '1', offset: '51' })).toBe('invalid');
  });
});

/*
 * Static check over every rebuilt learning board: a typed number goes through
 * the shared NumberAnswer. No board keeps a raw numeric answer field
 * (inputMode="numeric", a digits-only pattern) that silently disables Check.
 * The worked-example board's faded steps are the one raw TextField: they take
 * a number or a word, and parse and echo the number themselves (inputMode="decimal").
 */
describe('static: every graded board takes a typed number through the shared kit', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const boards = [
    ...readdirSync(dir).filter((file) => /(Board|Boards|boards)\.tsx$/.test(file)),
    ...readdirSync(path.join(dir, 'operations')).filter((file) => file.endsWith('.tsx') && !file.includes('.test.')).map((file) => path.join('operations', file)),
  ];

  it('finds the boards, including the four that used raw fields', () => {
    expect(boards.length).toBeGreaterThanOrEqual(25);
    for (const file of ['BarModelBoard.tsx', 'SchemaDiagramBoard.tsx', 'CpaFadingBoard.tsx', 'FunctionMachineBoard.tsx']) expect(boards).toContain(file);
  });

  it('no board has an inputMode="numeric" or digits-only answer field, and only the worked example keeps its own TextField', () => {
    const offenders: string[] = [];
    const rawFields: string[] = [];
    for (const file of boards) {
      const source = readFileSync(path.join(dir, file), 'utf8');
      if (/inputMode=["{']*numeric/.test(source) || /pattern="\[0-9\]\*"/.test(source)) offenders.push(file);
      if (/<TextField\b/.test(source)) rawFields.push(file);
    }
    expect(offenders).toEqual([]);
    expect(rawFields).toEqual(['WorkedExampleBoard.tsx']);
    const worked = readFileSync(path.join(dir, 'WorkedExampleBoard.tsx'), 'utf8');
    expect(worked).toMatch(/inputMode="decimal"/);
    expect(worked).toMatch(/parseLocaleNumber\(/);
    for (const file of ['BarModelBoard.tsx', 'SchemaDiagramBoard.tsx', 'CpaFadingBoard.tsx', 'FunctionMachineBoard.tsx']) {
      expect(readFileSync(path.join(dir, file), 'utf8'), file).toMatch(/<NumberAnswer\b/);
    }
  });
});
