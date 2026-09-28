import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy } from '../design/copyBudget';
import { composeRule, runRule } from './buildBoards';
import { buildCopy, buildCopyRoles } from './buildCopy';
import { LessonDocumentView } from './LessonDocumentView';
import { loadLessonClientDocument } from './lessonDocument';
import { scoreV2Visual } from './v2VisualScorer.generated';

/*
 * GAP-FIX-R2 learning: $6 unit prices, the L2 rule builder and the L6/$9
 * built flowchart. The boards send only ids and canonical numbers, the same
 * shape Core's canonical scorer grades (scorer parity on the answer shape).
 */

vi.mock('../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const noop = () => {};
function doc(band: '6-9' | '10-12' | '13-17', segment: Record<string, unknown>, capabilities: string[]) {
  const ages = { '6-9': [8, 9], '10-12': [10, 12], '13-17': [13, 17] }[band];
  return { schema_version: 2, course_id: 'financial-education', pathway_id: `financial-${band}`, chapter_id: 'build-and-test', lesson_id: 'build-lesson',
    version_id: 'rev-1', locale: 'en-US', age_band: band, eligibility: { minimum_age: ages[0], maximum_age: ages[1] }, knowledge_component_ids: ['kc-build'],
    adventure_scene_id: 'diorama-a', title: 'Build and test', required_capabilities: capabilities, segments: [segment] };
}
const unitPrice = { id: 'unit-01', type: 'money.unit-price.v2', grading: 'server', prompt: 'Find each price per sticker.', visual: { type: 'ratio-table' },
  payload: { currency: 'coins', unit: 'sticker', offers: [{ id: 'small', label: 'Pack of 3', quantity: 3, price_minor: 45 }, { id: 'big', label: 'Pack of 5', quantity: 5, price_minor: 70 }] } };
const unitCaps = ['visual.ratio-table.v1', 'operation.number-input.v1', 'operation.choose-option.v1'];
const rule = (level: string) => ({ id: 'rule-01', type: 'logic.rule-builder.v2', grading: 'server', prompt: 'Build the rule.', visual: { type: 'rule-builder' },
  payload: { level, conditions: [{ id: 'enough', label: 'Enough coins' }, { id: 'want', label: 'Really want it' }],
    actions: [{ id: 'buy', label: 'Buy it' }, { id: 'wait', label: 'Wait a week' }],
    practice: [{ id: 'card-a', label: 'Enough, wanted', facts: { enough: true, want: true } }] } });
const ruleCaps = ['visual.rule-builder.v1', 'operation.build-rule.v1', 'operation.case-step.v1'];
const build = { id: 'flow-01', type: 'money.spend-decision.v2', grading: 'server', prompt: 'Build your chart.', visual: { type: 'decision-tree' },
  payload: { mode: 'build', questions: [{ id: 'need', label: 'Need it?' }], outcomes: [{ id: 'buy', label: 'Buy now' }, { id: 'skip', label: 'Skip it' }],
    practice: [{ id: 'case-a', label: 'Winter coat', answers: { need: true } }] } };
const buildCaps = ['visual.decision-tree.v1', 'operation.step-flowchart.v1', 'operation.build-flowchart.v1'];

describe('build-and-test boards (GAP-FIX-R2)', () => {
  it('opens each kind only where Appendix P allows it', () => {
    expect(loadLessonClientDocument(doc('10-12', unitPrice, unitCaps)).status).toBe('ready');
    expect(loadLessonClientDocument(doc('6-9', unitPrice, unitCaps)).status).toBe('invalid');
    expect(loadLessonClientDocument(doc('10-12', { ...unitPrice, payload: { ...unitPrice.payload, currency: 'local' } }, unitCaps)).status).toBe('invalid');
    expect(loadLessonClientDocument(doc('6-9', rule('single'), ruleCaps)).status).toBe('ready');
    expect(loadLessonClientDocument(doc('6-9', rule('connective'), ruleCaps)).status).toBe('invalid');
    expect(loadLessonClientDocument(doc('10-12', rule('nested'), ruleCaps)).status).toBe('invalid');
    expect(loadLessonClientDocument(doc('13-17', rule('nested'), ruleCaps)).status).toBe('ready');
    expect(loadLessonClientDocument(doc('13-17', build, buildCaps)).status).toBe('ready');
    expect(loadLessonClientDocument(doc('10-12', build, buildCaps)).status).toBe('invalid');
    expect(loadLessonClientDocument(doc('13-17', build, buildCaps.slice(0, 2))).status).toBe('invalid');
  });

  it('$6 sends each unit price and the better choice, with the unit always shown', async () => {
    const onGradeAny = vi.fn(async () => ({ verdict: 'met' as const }));
    render(<LessonDocumentView raw={doc('10-12', unitPrice, unitCaps)} locale="en-US" ageBand="10-12" onBack={noop} onGradeAny={onGradeAny} />);
    fireEvent.change(screen.getByLabelText('Pack of 3: per sticker'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Pack of 5: per sticker'), { target: { value: '14' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Better buy' })).getByRole('radio', { name: 'Pack of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    const answer = { unit_prices: { small: '15', big: '14' }, choice: 'big' };
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith(answer, 'unit-01', expect.anything()));
    expect(scoreV2Visual('money.unit-price.v2', { scale: 1, offers: [{ id: 'small', quantity: 3, price: 45 }, { id: 'big', quantity: 5, price: 70 }] }, answer,
      { unit_prices: { small: '15', big: '14' }, better_id: 'big' })).toBe('met');
  });

  it('L2 compiles the tiles into a rule and runs it on the practice cards', async () => {
    const onGradeAny = vi.fn(async () => ({ verdict: 'met' as const }));
    render(<LessonDocumentView raw={doc('10-12', rule('connective'), ruleCaps)} locale="en-US" ageBand="10-12" onBack={noop} onGradeAny={onGradeAny} />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Condition 1' })).getByRole('radio', { name: 'Enough coins' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Link' })).getByRole('radio', { name: 'AND' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Condition 2' })).getByRole('radio', { name: 'Really want it' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Then do' })).getByRole('radio', { name: 'Buy it' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Else do' })).getByRole('radio', { name: 'Wait a week' }));
    expect(screen.getByText('IF (Enough coins AND Really want it) THEN Buy it ELSE Wait a week'.replace(/[()]/g, ''))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Run the rule' }));
    expect(screen.getByText('Rule says: Buy it')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ rule: { if: { and: [{ c: 'enough' }, { c: 'want' }] }, then: 'buy', else: 'wait' } }, 'rule-01', expect.anything()));
  });

  it('composes nested rules left to right and evaluates NOT', () => {
    const expr = composeRule([{ cond: 'a', not: false }, { cond: 'b', not: true }, { cond: 'c', not: false }], ['and', 'or']);
    expect(expr).toEqual({ or: [{ and: [{ c: 'a' }, { not: { c: 'b' } }] }, { c: 'c' }] });
    expect(runRule(expr!, { a: true, b: false, c: false })).toBe(true);
    expect(runRule(expr!, { a: true, b: true, c: false })).toBe(false);
    expect(composeRule([{ cond: 'a', not: false }, { cond: null, not: false }], ['and'])).toBeNull();
  });

  it('L6/$9 builds a chart from tiles and tests it on the practice case', async () => {
    const onGradeAny = vi.fn(async () => ({ verdict: 'met' as const }));
    render(<LessonDocumentView raw={doc('13-17', build, buildCaps)} locale="en-US" ageBand="13-17" onBack={noop} onGradeAny={onGradeAny} />);
    fireEvent.click(within(screen.getByRole('group', { name: 'First step: Put here' })).getByRole('radio', { name: 'Need it?' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Need it? If yes: Put here' })).getByRole('radio', { name: 'Buy now' }));
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.click(within(screen.getByRole('group', { name: 'Need it? If no: Put here' })).getByRole('radio', { name: 'Skip it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Test the chart' }));
    expect(screen.getByText('Rule says: Buy now')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ tree: { q: 'need', yes: { o: 'buy' }, no: { o: 'skip' } } }, 'flow-01', expect.anything()));
  });

  it('keeps the board labels inside the Copy Budget in three locales', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      for (const [key, role] of Object.entries(buildCopyRoles)) {
        const text = buildCopy[locale][key as keyof typeof buildCopyRoles];
        if (role !== 'data') expect(checkCopy(text, role, { locale, ageBand: '6-9', surface: 'app' }), `${locale} ${key}`).toEqual([]);
        expect(text, key).not.toMatch(/\bTutor\b|\bbot\b|assistant|asistente|assistente|\blives?\b|\bvidas?\b|—/i);
      }
    }
  });
});
