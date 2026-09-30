import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allocationPilotDocument, donutPilotDocument, wafflePilotDocument } from './AllocationBoard';
import { growthPilotDocument } from './GrowthBoard';
import { ratioTablePilotDocument } from './RatioTableBoard';
import { numberLinePilotDocument } from './NumberLineBoard';
import { LessonDocumentView, type NumberLineGradeAnswer } from './LessonDocumentView';
import { sequencePilotDocument } from './sequencePilotDocument';
import { goalBulletPilotDocument } from './GoalBulletBoard';
import { percentGridPilotDocument } from './PercentGridBoard';
import { placeValuePilotDocument } from './PlaceValueBoard';
import { savingsRulePilotDocument } from './SavingsRuleBoard';
import { growthComparisonPilotDocument } from './GrowthComparisonBoard';
import { taxBracketPilotDocument } from './TaxBracketBoard';
import { fractionNumberLinePilotDocument } from './FractionNumberLineBoard';
import { fractionAreaPilotDocument } from './FractionAreaBoard';
import { barModelPilotDocument } from './BarModelBoard';
import { schemaDiagramPilotDocument } from './SchemaDiagramBoard';
import { workedExamplePilotDocument } from './WorkedExampleBoard';
import { functionMachinePilotDocument } from './FunctionMachineBoard';
import { cpaFadingPilotDocument } from './CpaFadingBoard';
import { PREVIEW_MENTOR_STAGE } from '../preview/Preview';

/* The Mentor stage renders its live 3D only where the renderer's device probe finds WebGL (Bible 08 §7). */
vi.mock('../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../tutor-scene/TutorStage', () => ({
  TutorStage: (props: { scene?: string; character?: string }) => (
    <div data-testid="tutor-stage" data-scene={props.scene} data-character={props.character} />
  ),
}));

type Pilot = ReturnType<typeof allocationPilotDocument> & { title: string; segments: [{ prompt: string; payload: { total: number; step: number } }] };
const pilot = () => structuredClone(allocationPilotDocument('en-US', '6-9')) as Pilot;
const noop = () => {};

/** GAP-FIX-R3 (M7): builds the pilot's bars the way a learner does, slot by slot ("Ana has 12 more than Leo; together 50"). */
async function buildPilotBars() {
  fireEvent.click(screen.getByRole('button', { name: 'Compare two bars' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add the total' }));
  const pick = async (slot: string, item: string) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${slot}:`) }));
    fireEvent.click(await screen.findByRole('menuitem', { name: item }));
  };
  await pick('Shorter bar', '? Leo');
  await pick('Difference', '12 more: 12');
  await pick('Both together', 'Together: 50');
}
const PILOT_BUILD = { model: 'comparison', slots: { smaller: 'unknown', larger: null, difference: 'ana-more', total: 'together' } };

/** The lesson foot's feedback region; steppers' written values are status regions too, so it is found by its hook. */
const feedbackRegion = () => {
  const region = document.querySelector<HTMLElement>('.lf-learning-feedback');
  if (!region) throw new Error('feedback region missing');
  return region;
};

describe('versioned pilot document renderer', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('renders the validated client document and sends a response to the injected grader', async () => {
    const document = pilot();
    document.title = 'Choose a split';
    document.segments[0].prompt = 'Split two coins.';
    document.segments[0].payload.total = 2;
    const onGrade = vi.fn(() => 'met' as const);
    render(<LessonDocumentView raw={document} locale="en-US" ageBand="6-9" onBack={noop} onGrade={onGrade} />);
    expect(screen.getByRole('heading', { name: 'Choose a split' })).toBeTruthy();
    expect(screen.getByText('Split two coins.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save: Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save: Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGrade).toHaveBeenCalledWith({ save: 2, spend: 0, share: 0 }, 'allocate-01', expect.objectContaining({ version_id: 'rev-1' })));
    await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100'));
  });

  it('keeps the waffle, table and scorer on one ten-coin allocation', async () => {
    const onGrade = vi.fn(() => 'met' as const);
    render(<LessonDocumentView raw={wafflePilotDocument('en-US')} locale="en-US" ageBand="6-9"
      onBack={noop} onGrade={onGrade} />);
    const waffle = screen.getByRole('img', { name: /Waffle chart/ });
    expect(waffle.querySelectorAll('.lf-learning-waffle-cell')).toHaveLength(100);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Save: Add' }));
    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Spend: Add' }));
    expect(waffle.querySelectorAll('.lf-learning-waffle-cell--save')).toHaveLength(30);
    expect(waffle.querySelectorAll('.lf-learning-waffle-cell--spend')).toHaveLength(70);
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table').textContent).toContain('Save3 coins');
    expect(screen.getByRole('table').textContent).toContain('Spend7 coins');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGrade).toHaveBeenCalledWith({ save: 3, spend: 7, share: 0 },
      'allocate-waffle-01', expect.objectContaining({ lesson_id: 'pilot-waffle' })));
  });

  it('keeps the donut and scorer on the same tween allocation response', async () => {
    const onGrade = vi.fn(() => 'met' as const);
    render(<LessonDocumentView raw={donutPilotDocument('en-US')} locale="en-US" ageBand="10-12"
      onBack={noop} onGrade={onGrade} />);
    const donut = screen.getByRole('img', { name: /Budget donut chart/ });
    expect(donut.querySelectorAll('.lf-learning-donut-segment')).toHaveLength(3);
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Save: Add' }));
    for (let i = 0; i < 8; i++) fireEvent.click(screen.getByRole('button', { name: 'Spend: Add' }));
    expect(donut.getAttribute('aria-label')).toContain('Save 20 coins');
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table').textContent).toContain('Save20 coins');
    expect(screen.getByRole('table').textContent).toContain('Spend40 coins');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGrade).toHaveBeenCalledWith({ save: 20, spend: 40, share: 0 },
      'allocate-donut-01', expect.objectContaining({ lesson_id: 'pilot-donut' })));
  });

  it('renders the controlled ratio table only for its tween pathway', async () => {
    const document = ratioTablePilotDocument('en-US');
    const { rerender } = render(<LessonDocumentView raw={document} locale="en-US" ageBand="10-12" onBack={noop} />);
    expect(screen.getByRole('group', { name: /Linked number lines.*6 items; 30 coins/ })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /Packs/ })).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: 'Packs: +' }));
    expect(screen.getByRole('group', { name: /3 Packs: 9 items; 45 coins/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show as table/ }));
    expect(screen.getByRole('table', { name: 'Price table' })).toHaveTextContent('45 coins');
    rerender(<LessonDocumentView raw={document} locale="en-US" ageBand="13-17" onBack={noop} />);
    expect(screen.getByRole('heading')).toHaveTextContent('This lesson cannot open.');
  });

  it('refuses an unsupported or partial document without showing an activity', () => {
    const onGrade = vi.fn();
    const document = pilot();
    document.segments.push(structuredClone(document.segments[0]));
    const { rerender } = render(<LessonDocumentView raw={document} locale="en-US" ageBand="6-9" onBack={noop} onGrade={onGrade} />);
    expect(screen.getByText('This lesson cannot open.')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    rerender(<LessonDocumentView raw={{ ...pilot(), schema_version: 3 }} locale="en-US" ageBand="6-9" onBack={noop} onGrade={onGrade} />);
    expect(screen.getByText('Update the app')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    rerender(<LessonDocumentView raw={pilot()} locale="es-MX" ageBand="6-9" onBack={noop} onGrade={onGrade} />);
    expect(screen.getByText('Esta lección no se puede abrir.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    rerender(<LessonDocumentView raw={pilot()} locale="en-US" ageBand="adult" onBack={noop} onGrade={onGrade} />);
    expect(screen.getByText('This lesson cannot open.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    expect(onGrade).not.toHaveBeenCalled();
  });

  it('discards an old grading response after the learner revises the allocation', async () => {
    const document = pilot();
    document.segments[0].payload.total = 2;
    let resolveGrade!: (value: 'met') => void;
    const onGrade = vi.fn(() => new Promise<'met'>((resolve) => { resolveGrade = resolve; }));
    render(<LessonDocumentView raw={document} locale="en-US" ageBand="6-9" onBack={noop} onGrade={onGrade} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save: Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save: Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(onGrade).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save: Remove' }));
    await act(async () => resolveGrade('met'));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.queryByText('Your plan meets the goal.')).toBeNull();
  });

  it('keeps incomplete and failed checks out of completed progress', async () => {
    const document = pilot();
    document.segments[0].payload.total = 2;
    const onGrade = vi.fn(() => Promise.reject(new Error('offline')));
    render(<LessonDocumentView raw={document} locale="en-US" ageBand="6-9" onBack={noop} onGrade={onGrade} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(onGrade).not.toHaveBeenCalled();
    expect(screen.getByText('Allocate the rest first.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save: Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save: Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(screen.getByText('Could not check. Try again.')).toBeTruthy());
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('renders a validated exploratory chart and rejects a missing grader for scored work', () => {
    const growth = structuredClone(growthPilotDocument('en-US', '6-9')) as { title: string; segments: [{ prompt: string }] };
    growth.title = 'How savings grow';
    growth.segments[0].prompt = 'Move the weekly amount.';
    const { rerender } = render(<LessonDocumentView raw={growth} locale="en-US" ageBand="6-9" onBack={noop} />);
    expect(screen.getByRole('heading', { name: 'How savings grow' })).toBeTruthy();
    expect(screen.getByText('Move the weekly amount.')).toBeTruthy();
    expect(screen.getByRole('slider')).toBeTruthy();
    rerender(<LessonDocumentView raw={pilot()} locale="en-US" ageBand="6-9" onBack={noop} />);
    expect(screen.getByText('Update the app')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
  });

  it('replays a worked example freely, requires a prediction to reveal the next step, and fades the final value into an input', async () => {
    const document = workedExamplePilotDocument('en-US', 1);
    const onGradeWorkedExample = vi.fn(() => 'met' as const);
    render(<LessonDocumentView raw={document} locale="en-US" ageBand="10-12" onBack={noop} onGradeWorkedExample={onGradeWorkedExample} onComplete={async () => true} />);
    expect(screen.getByText('Result: 10')).toBeTruthy();
    const reveal = screen.getByRole('button', { name: 'Show next step' });
    expect(reveal).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Predict the next result' }), { target: { value: '40' } });
    fireEvent.click(reveal);
    expect(screen.getByText('Result: 40')).toBeTruthy();
    fireEvent.change(screen.getByRole('slider', { name: 'Step' }), { target: { value: '2' } });
    expect(screen.queryByRole('textbox', { name: 'Predict the next result' })).toBeNull();
    const blank = screen.getByRole('textbox', { name: 'Write the result: Sale price' });
    fireEvent.change(blank, { target: { value: '40' } });
    expect(blank).toHaveValue('40');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeWorkedExample).toHaveBeenCalledWith({ values: { 'discount-subtract': '40', 'sale-price': '40' } },
      'worked-example-01', expect.objectContaining({ version_id: 'rev-fade-1' })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeTruthy();
  });

  it('requires an M13 public trial before checking a semantic function rule', async () => {
    const grade = vi.fn(() => 'met' as const);
    const { rerender } = render(<LessonDocumentView raw={functionMachinePilotDocument('en-US')} locale="en-US" ageBand="10-12"
      onBack={noop} onGradeBarModel={grade} onComplete={async () => true} />);
    expect(screen.getByRole('img', { name: /Input: 1\. Output: \?/ })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Function machine' })).toHaveTextContent('InputOutput1?2?3?');
    fireEvent.change(screen.getByLabelText('Multiply by'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Then add'), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: 'Check rule' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(screen.getByRole('img', { name: /Input: 2\. Output: 20/ })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Function machine' })).toHaveTextContent('InputOutput1?2203?');
    fireEvent.click(screen.getByRole('button', { name: 'Check rule' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ multiplier: '5', offset: '10' }, 'function-machine-01', expect.anything()));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Your rule fits every input you tried.'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeTruthy();
    rerender(<LessonDocumentView raw={functionMachinePilotDocument('en-US')} locale="en-US" ageBand="13-17"
      onBack={noop} onGradeBarModel={grade} />);
    expect(screen.getByText('This lesson cannot open.')).toBeTruthy();
  });

  it('keeps the M1 response stable while its grade request is pending', async () => {
    let resolveGrade: (result: 'met') => void = () => {};
    const grade = vi.fn(() => new Promise<'met'>((resolve) => { resolveGrade = resolve; }));
    render(<LessonDocumentView raw={cpaFadingPilotDocument('en-US')} locale="en-US" ageBand="6-9" onBack={noop} onGradeNumberLine={grade} />);
    const answer = screen.getByRole('textbox', { name: 'Your answer' });
    fireEvent.change(answer, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(answer).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    await waitFor(() => expect(grade).toHaveBeenCalledTimes(1));
    await act(async () => { resolveGrade('met'); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('You counted both groups and named the total.')).toBeTruthy();
  });

  it('renders M1 as concrete, pictorial, then abstract while carrying one semantic answer', async () => {
    vi.useFakeTimers();
    const grade = vi.fn((answer: NumberLineGradeAnswer) => 'value' in answer && answer.value === '7' ? 'met' as const : 'review' as const);
    render(<LessonDocumentView raw={cpaFadingPilotDocument('en-US')} locale="en-US" ageBand="6-9" onBack={noop} onGradeNumberLine={grade} />);
    expect(screen.getByText('Build it')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'four plus three' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('You counted both groups and named the total.')).toBeTruthy();
    expect(document.querySelector('.lf-cpa-transition--leaving')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(document.querySelector('.lf-cpa-transition--leaving')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByText('See it')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(screen.getByText('Write it')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(grade).toHaveBeenCalledWith({ value: '7' }, 'cpa-pictorial-01', expect.anything());
    vi.useRealTimers();
  });

  it('allows an M1 review to fade forward and finishes only after the abstract response', async () => {
    vi.useFakeTimers();
    const grade = vi.fn((_answer: NumberLineGradeAnswer, segmentId: string) => segmentId === 'cpa-abstract-01' ? 'met' as const : 'review' as const);
    const onComplete = vi.fn(async () => true);
    render(<LessonDocumentView raw={cpaFadingPilotDocument('en-US')} locale="en-US" ageBand="6-9" onBack={noop}
      onGradeNumberLine={grade} onComplete={onComplete} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(screen.getByText('See it')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(screen.getByText('Write it')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(screen.getByRole('heading', { name: 'Lesson ready' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
      await Promise.resolve();
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('renders a bounded number line, checks a semantic point, and refuses a missing grader', async () => {
    const document = numberLinePilotDocument('en-US', '6-9');
    const onGradeNumberLine = vi.fn((answer: NumberLineGradeAnswer) => 'value' in answer && answer.value === '7' ? 'met' as const : 'review' as const);
    const { rerender } = render(<LessonDocumentView raw={document} locale="en-US" ageBand="6-9" onBack={noop} onGradeNumberLine={onGradeNumberLine} />);
    expect(screen.getByRole('slider')).toBeTruthy();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeNumberLine).toHaveBeenCalledWith({ value: '7' }, 'place-01', expect.objectContaining({ version_id: 'rev-1' })));
    await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100'));
    rerender(<LessonDocumentView raw={document} locale="en-US" ageBand="6-9" onBack={noop} />);
    expect(screen.getByText('Update the app')).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('keeps a multi-activity pilot in preview until each activity is completed', async () => {
    const document = sequencePilotDocument('en-US');
    const onGrade = vi.fn(() => 'met' as const);
    const { rerender } = render(<LessonDocumentView raw={document} locale="en-US" ageBand="6-9" onBack={noop} onGrade={onGrade} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    rerender(<LessonDocumentView raw={document} locale="en-US" ageBand="6-9" onBack={noop} onGrade={onGrade} previewSequence />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('2/2')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    expect(onGrade).not.toHaveBeenCalled();
    for (let i = 0; i < 12; i++) fireEvent.click(screen.getByRole('button', { name: 'Save: Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGrade).toHaveBeenCalledWith({ save: 12, spend: 0, share: 0 }, 'allocate-01', expect.objectContaining({ lesson_id: 'pilot-savings-sequence' })));
    await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Preview finished' })).toBeTruthy();
    expect(screen.getByText('Progress is not saved.')).toBeTruthy();
  });

  it('calls authenticated v2 completion only after the final sequence step', async () => {
    const document = sequencePilotDocument('en-US');
    const onGrade = vi.fn(() => 'met' as const);
    const onComplete = vi.fn(async () => true);
    render(<LessonDocumentView raw={document} locale="en-US" ageBand="6-9" onBack={noop} onGrade={onGrade} onComplete={onComplete} previewSequence />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    for (let i = 0; i < 12; i++) fireEvent.click(screen.getByRole('button', { name: 'Save: Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('renders the goal marker with synchronized table and slider exploration', () => {
    const document = goalBulletPilotDocument('en-US', '6-9');
    render(<LessonDocumentView raw={document} locale="en-US" ageBand="6-9" onBack={noop} />);
    expect(screen.getByRole('heading', { name: 'Reach a savings goal' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Goal chart/ })).toBeTruthy();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } });
    expect(screen.getByText('Goal met')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table').textContent).toContain('12 coins');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('4');
  });

  it('links the M15 percent grid, bar and price table while refusing other preview bands', () => {
    const document = percentGridPilotDocument('es-MX', '10-12');
    const { rerender } = render(<LessonDocumentView raw={document} locale="es-MX" ageBand="10-12" onBack={noop} />);
    expect(screen.getByRole('heading', { name: 'Mira un descuento' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Cuadrícula de 100 y barra/ })).toBeTruthy();
    expect(screen.getByRole('img').querySelectorAll('.lf-percent-cell--filled')).toHaveLength(20);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '50' } });
    expect(screen.getByRole('img').querySelectorAll('.lf-percent-cell--filled')).toHaveLength(50);
    fireEvent.click(screen.getByRole('button', { name: 'Ver tabla' }));
    expect(screen.getByRole('table').textContent).toContain('50%');
    expect(screen.getByRole('table').textContent).toContain('50 monedas');
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('20');
    rerender(<LessonDocumentView raw={percentGridPilotDocument('es-MX', '6-9')} locale="es-MX" ageBand="6-9" onBack={noop} />);
    expect(screen.getByText('Esta lección no se puede abrir.')).toBeTruthy();
  });

  it('links base-ten blocks, the place-value table and reversible exchange for the youngest pathway', () => {
    const document = placeValuePilotDocument('en-US');
    const { rerender } = render(<LessonDocumentView raw={document} locale="en-US" ageBand="6-9" onBack={noop} />);
    expect(screen.getByRole('img', { name: /0 Tens, 20 Ones/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Trade 10' }));
    expect(screen.getByRole('img', { name: /1 Tens, 10 Ones/ })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('10 ones = 1 ten');
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table').textContent).toContain('Tens1');
    expect(screen.getByRole('table').textContent).toContain('Ones10');
    fireEvent.click(screen.getByRole('button', { name: 'Trade 10' }));
    expect(screen.getByRole('table').textContent).toContain('Tens2');
    fireEvent.click(screen.getByRole('button', { name: 'Replay trades' }));
    expect(screen.getByRole('table').textContent).toContain('Ones20');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('table').textContent).toContain('Ones10');
    fireEvent.click(screen.getByRole('button', { name: 'Edit trades' }));
    expect(screen.getByRole('table').textContent).toContain('Tens2');
    fireEvent.click(screen.getByRole('button', { name: 'Undo trade' }));
    expect(screen.getByRole('table').textContent).toContain('Ones10');
    rerender(<LessonDocumentView raw={document} locale="en-US" ageBand="10-12" onBack={noop} />);
    expect(screen.getByText('This lesson cannot open.')).toBeTruthy();
  });

  it('shows all four savings-rule cases and changes the outcome when AND becomes OR', () => {
    const document = savingsRulePilotDocument('en-US');
    const { rerender } = render(<LessonDocumentView raw={document} locale="en-US" ageBand="10-12" onBack={noop} />);
    expect(screen.getByRole('img', { name: /Case 1/ })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Choose a link');
    fireEvent.click(screen.getByRole('radio', { name: 'AND' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('status').textContent).toBe('Rule says wait');
    fireEvent.click(screen.getByRole('radio', { name: 'OR' }));
    expect(screen.getByRole('status').textContent).toBe('Rule says ready');
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(4);
    rerender(<LessonDocumentView raw={document} locale="en-US" ageBand="adult" onBack={noop} />);
    expect(screen.getByText('This lesson cannot open.')).toBeTruthy();
  });

  it('commits a prediction before revealing the compound curve and table values', () => {
    const document = growthComparisonPilotDocument('en-US');
    const { rerender } = render(<LessonDocumentView raw={document} locale="en-US" ageBand="13-17" onBack={noop} />);
    expect(screen.getByRole('img', { name: /Compound line hidden until reveal/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(11);
    expect(screen.getByRole('table').querySelectorAll('tbody td:last-child')[10]?.textContent).toBe('Hidden');
    expect(screen.getByRole('button', { name: 'Reveal' }).hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByRole('slider', { name: /Your prediction/ }), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.getByRole('table').querySelectorAll('tbody td:last-child')[10]?.textContent).not.toBe('Hidden');
    fireEvent.change(screen.getByRole('slider', { name: /Annual rate/ }), { target: { value: '1000' } });
    expect(screen.getByRole('table').querySelectorAll('tbody td:last-child')[10]?.textContent).toBe('Hidden');
    fireEvent.click(screen.getByRole('radio', { name: '30 years' }));
    expect(screen.getByRole('radio', { name: '30 years' })).toBeChecked();
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(31);
    rerender(<LessonDocumentView raw={document} locale="en-US" ageBand="adult" onBack={noop} />);
    expect(screen.getByText('This lesson cannot open.')).toBeTruthy();
  });

  it('links the M20 income control, progressive stacked bar, and tax table for the exact teen policy', () => {
    const document = taxBracketPilotDocument('en-US');
    const { rerender } = render(<LessonDocumentView raw={document} locale="en-US" ageBand="13-17" onBack={noop} />);
    expect(screen.getByRole('img', { name: /Tax bracket stacked bar.*Income:/ })).toHaveAttribute('aria-label', expect.stringContaining('USD 300.00'));
    expect(screen.getByRole('img', { name: /Tax bracket stacked bar/ }).querySelectorAll('rect.lf-tax-slice')).toHaveLength(3);
    fireEvent.change(screen.getByRole('slider', { name: /Income/ }), { target: { value: '40000' } });
    expect(screen.getByRole('img', { name: /Income:/ })).toHaveAttribute('aria-label', expect.stringContaining('Tax: USD 80.00'));
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table', { name: 'Tax board' })).toHaveTextContent('USD 30.00');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('slider', { name: /Income/ })).toHaveValue('30000');
    rerender(<LessonDocumentView raw={document} locale="en-US" ageBand="adult" onBack={noop} />);
    expect(screen.getByText('This lesson cannot open.')).toBeTruthy();
  });

  it('links M3 equal parts and reveals the placed value only after its check', async () => {
    const document = fractionNumberLinePilotDocument('en-US');
    const grade = vi.fn(() => 'met' as const);
    const { rerender } = render(<LessonDocumentView raw={document} locale="en-US" ageBand="10-12" onBack={noop} onGradeNumberLine={grade} />);
    expect(screen.getByRole('img', { name: /Equal parts: 0\/4, 0/ })).toBeTruthy();
    expect(screen.getByText('Choose a place')).toBeTruthy();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } });
    expect(screen.getByRole('img', { name: /Equal parts: 3\/4, 0.75/ })).toBeTruthy();
    expect(screen.getAllByRole('img')[1]).toHaveAccessibleName(/Number line: 0–1; 3\/4, 0.75/);
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table', { name: 'Fraction board' })).toHaveTextContent('3/4 = 0.75');
    fireEvent.click(screen.getByRole('button', { name: 'Show board' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '3/4' }, 'fraction-01', expect.anything()));
    await waitFor(() => expect(screen.getByText('3/4 = 0.75')).toBeTruthy());
    expect(screen.getByRole('status')).toHaveTextContent('You placed 3/4 by counting equal steps.');
    rerender(<LessonDocumentView raw={document} locale="en-US" ageBand="13-17" onBack={noop} onGradeNumberLine={grade} />);
    expect(screen.getByText('This lesson cannot open.')).toBeTruthy();
  });

  it('lets an authenticated M3 result reach the lesson finish action without resubmitting its answer', async () => {
    const grade = vi.fn(() => 'met' as const);
    const complete = vi.fn(async () => true);
    render(<LessonDocumentView raw={fractionNumberLinePilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop}
      onGradeNumberLine={grade} onComplete={complete} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await screen.findByRole('button', { name: 'Continue' });
    expect(grade).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(grade).toHaveBeenCalledTimes(1);
  });

  it('keeps a server-gradeable board actionable when its grade request fails', async () => {
    const rejected = () => Promise.reject(new Error('offline'));
    const { rerender } = render(<LessonDocumentView raw={fractionAreaPilotDocument('en-US')} locale="en-US" ageBand="6-9" onBack={noop} onGradeFractionArea={rejected} />);
    fireEvent.click(screen.getByRole('button', { name: 'Shaded parts: More' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('We could not check that. Try again.')).toBeTruthy();
    expect(feedbackRegion()).toHaveClass('lf-learning-feedback--unavailable');

    rerender(<LessonDocumentView raw={fractionNumberLinePilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeNumberLine={rejected} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('We could not check that. Try again.')).toBeTruthy();

    rerender(<LessonDocumentView raw={barModelPilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeBarModel={rejected} />);
    await buildPilotBars();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('We could not check that. Try again.')).toBeTruthy();

    rerender(<LessonDocumentView raw={functionMachinePilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeBarModel={rejected} />);
    fireEvent.change(screen.getByLabelText('Multiply by'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Then add'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check rule' }));
    expect(await screen.findByText('We could not check that. Try again.')).toBeTruthy();

    rerender(<LessonDocumentView raw={schemaDiagramPilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeSchemaDiagram={rejected} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('We could not check that. Try again.')).toBeTruthy();

    rerender(<LessonDocumentView raw={workedExamplePilotDocument('en-US', 1)} locale="en-US" ageBand="10-12" onBack={noop} onGradeWorkedExample={rejected} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Predict the next result' }), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show next step' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Step' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Write the result: Sale price' }), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('We could not check that. Try again.')).toBeTruthy();
  });

  it('keeps M3 and M6 controls stable while one grade request is active', async () => {
    let resolveArea: (result: 'met') => void = () => {};
    const areaGrade = vi.fn(() => new Promise<'met'>((resolve) => { resolveArea = resolve; }));
    const { rerender } = render(<LessonDocumentView raw={fractionAreaPilotDocument('en-US')} locale="en-US" ageBand="6-9" onBack={noop} onGradeFractionArea={areaGrade} />);
    fireEvent.click(screen.getByRole('button', { name: 'Shaded parts: More' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Shaded parts: More' })).toBeDisabled();
    await waitFor(() => expect(areaGrade).toHaveBeenCalledTimes(1));
    await act(async () => { resolveArea('met'); await Promise.resolve(); await Promise.resolve(); });

    let resolveLine: (result: 'met') => void = () => {};
    const lineGrade = vi.fn(() => new Promise<'met'>((resolve) => { resolveLine = resolve; }));
    rerender(<LessonDocumentView raw={fractionNumberLinePilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeNumberLine={lineGrade} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(screen.getByRole('slider')).toBeDisabled();
    await waitFor(() => expect(lineGrade).toHaveBeenCalledTimes(1));
    await act(async () => { resolveLine('met'); await Promise.resolve(); await Promise.resolve(); });
  });

  it('keeps M7 and M8 response controls stable while one grade request is active', async () => {
    let resolveBar: (result: 'met') => void = () => {};
    const barGrade = vi.fn(() => new Promise<'met'>((resolve) => { resolveBar = resolve; }));
    const { rerender } = render(<LessonDocumentView raw={barModelPilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeBarModel={barGrade} />);
    await buildPilotBars();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Shorter bar:/ })).toBeDisabled();
    await waitFor(() => expect(barGrade).toHaveBeenCalledTimes(1));
    await act(async () => { resolveBar('met'); await Promise.resolve(); await Promise.resolve(); });

    let resolveSchema: (result: 'met') => void = () => {};
    const schemaGrade = vi.fn(() => new Promise<'met'>((resolve) => { resolveSchema = resolve; }));
    rerender(<LessonDocumentView raw={schemaDiagramPilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeSchemaDiagram={schemaGrade} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Change' })).toBeDisabled();
    await waitFor(() => expect(schemaGrade).toHaveBeenCalledTimes(1));
    await act(async () => { resolveSchema('met'); await Promise.resolve(); await Promise.resolve(); });
  });

  it('keeps M9/M10 and M13 answer inputs stable while one grade request is active', async () => {
    let resolveWorked: (result: 'met') => void = () => {};
    const workedGrade = vi.fn(() => new Promise<'met'>((resolve) => { resolveWorked = resolve; }));
    const { rerender } = render(<LessonDocumentView raw={workedExamplePilotDocument('en-US', 1)} locale="en-US" ageBand="10-12" onBack={noop} onGradeWorkedExample={workedGrade} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Predict the next result' }), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show next step' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Step' }), { target: { value: '2' } });
    const workedAnswer = screen.getByRole('textbox', { name: 'Write the result: Sale price' });
    fireEvent.change(workedAnswer, { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(workedAnswer).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    await waitFor(() => expect(workedGrade).toHaveBeenCalledTimes(1));
    await act(async () => { resolveWorked('met'); await Promise.resolve(); await Promise.resolve(); });

    let resolveFunction: (result: 'met') => void = () => {};
    const functionGrade = vi.fn(() => new Promise<'met'>((resolve) => { resolveFunction = resolve; }));
    rerender(<LessonDocumentView raw={functionMachinePilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeBarModel={functionGrade} />);
    fireEvent.change(screen.getByLabelText('Multiply by'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Then add'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check rule' }));
    expect(screen.getByLabelText('Multiply by')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check rule' })).toBeDisabled();
    await waitFor(() => expect(functionGrade).toHaveBeenCalledTimes(1));
    await act(async () => { resolveFunction('met'); await Promise.resolve(); await Promise.resolve(); });
  });

  it('builds an M6 equal-area fraction and sends a semantic equivalent response', async () => {
    const grade = vi.fn(() => 'met' as const);
    render(<LessonDocumentView raw={fractionAreaPilotDocument('en-US')} locale="en-US" ageBand="6-9" onBack={noop} onGradeFractionArea={grade} />);
    expect(screen.getByRole('img', { name: /Equal parts: 0 of 2/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table', { name: 'Equal parts' })).toHaveTextContent('Shaded parts0/2');
    fireEvent.click(screen.getByRole('button', { name: 'Show board' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shaded parts: More' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ n: 1, d: 2 }, 'fraction-area-01', expect.anything()));
    await waitFor(() => expect(feedbackRegion()).toHaveTextContent('You split the whole into 2 equal parts and shaded 1.'));
  });

  it('lets an authenticated M6 result reach the lesson finish action without a second grade', async () => {
    const grade = vi.fn(() => 'met' as const);
    const complete = vi.fn(async () => true);
    render(<LessonDocumentView raw={fractionAreaPilotDocument('en-US')} locale="en-US" ageBand="6-9" onBack={noop}
      onGradeFractionArea={grade} onComplete={complete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Shaded parts: More' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Lesson ready' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(grade).toHaveBeenCalledTimes(1);
  });

  it('keeps M7 arithmetic behind the separately graded structure the learner builds (GAP-FIX-R3)', async () => {
    const grade = vi.fn((answer: Record<string, unknown>, id: string) => id === 'bar-structure-01'
      ? JSON.stringify(answer) === JSON.stringify({ model: 'comparison', slots: { smaller: 'unknown', larger: null, difference: 'ana-more', total: 'together' } }) ? 'met' as const : 'review' as const
      : answer.value === '19' ? 'met' as const : 'review' as const);
    render(<LessonDocumentView raw={barModelPilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeBarModel={grade} />);
    expect(screen.getByRole('heading', { name: 'Build the model' })).toBeTruthy();
    // Bible 05 §7: the board starts empty and nothing is selected; Check waits for a complete build.
    expect(screen.getByText('Add bars to start.')).toBeTruthy();
    expect(document.querySelector('.lf-bar-model-row')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(screen.queryByLabelText('Your answer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Compare two bars' }));
    expect(document.querySelectorAll('.lf-bar-model-row')).toHaveLength(2);
    expect(document.querySelectorAll('.lf-pz-seg--empty').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    // A wrong but complete build is a structure review.
    fireEvent.click(screen.getByRole('button', { name: /^Shorter bar:/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '12 more: 12' }));
    fireEvent.click(screen.getByRole('button', { name: /^Longer bar:/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Together: 50' }));
    fireEvent.click(screen.getByRole('button', { name: /^Difference:/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '? Leo' }));
    expect(document.querySelector('.lf-pz-seg--unknown')?.textContent).toBe('?');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('Not yet. Decide which bar is longer, then add the parts.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await buildPilotBars();
    // Show as table lists every piece the learner built, and never an answer.
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table', { name: 'Build the model' })).toHaveTextContent('Shorter barLeo: ?');
    expect(screen.queryByText('19')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenNthCalledWith(2, PILOT_BUILD, 'bar-structure-01', expect.anything()));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Your bars show how the amounts in the story fit together.'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Solve the model')).toBeTruthy();
    // The arithmetic step draws the bars the learner built.
    expect(document.querySelectorAll('.lf-bar-model-row')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '19' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenNthCalledWith(3, { value: '19' }, 'bar-answer-01', expect.anything()));
  });

  it('M7 part-whole: one bar in parts, a third part, the whole as the unknown, keyboard pickers (GAP-FIX-R3)', async () => {
    const onGradeBarModel = vi.fn(() => 'met' as const);
    const raw = barModelPilotDocument('en-US') as { segments: Array<{ payload: unknown }> };
    const payload = { quantities: [{ id: 'saved-may', value: 18, label: 'May' }, { id: 'saved-june', value: 25, label: 'June' }, { id: 'saved-july', value: 7, label: 'July' }], unknownLabel: 'In all', spokenText: 'three months' };
    const lesson = { ...raw, segments: raw.segments.map((segment) => ({ ...segment, payload })) };
    render(<LessonDocumentView raw={lesson} locale="en-US" ageBand="10-12" onBack={noop} onGradeBarModel={onGradeBarModel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Split a bar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a part' }));
    const pick = async (slot: string, item: string) => {
      const trigger = screen.getByRole('button', { name: new RegExp(`^${slot}:`) });
      // 05 §4: Enter (or ArrowDown) on a slot opens its picker.
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      fireEvent.click(await screen.findByRole('menuitem', { name: item }));
    };
    await pick('Part 1', 'May: 18');
    await pick('Part 2', 'June: 25');
    await pick('Part 3', 'July: 7');
    await pick('Whole', '? In all');
    // The lengths follow the quantities placed: 18, 25 and 7 of 50.
    const widths = [...document.querySelectorAll<HTMLElement>('.lf-bar-model-track .lf-pz-seg')].map((node) => Math.round(parseFloat(node.style.inlineSize)));
    expect(widths).toEqual([36, 50, 14]);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeBarModel).toHaveBeenCalledWith({ model: 'part-whole', slots: { 'part-a': 'saved-may', 'part-b': 'saved-june', 'part-c': 'saved-july', whole: 'unknown' } },
      'bar-structure-01', expect.anything()));
  });

  it('keeps M8 schema choice, slots, and arithmetic in separate steps', async () => {
    const grade = vi.fn((answer: Record<string, unknown>, id: string) => id === 'schema-structure-01'
      ? answer.schema === 'change' ? 'met' as const : 'review' as const
      : id === 'schema-slots-01' ? answer.schema === 'change' && (answer.slots as Record<string, string>).start === 'earned' ? 'met' as const : 'review' as const
        : answer.value === '15' ? 'met' as const : 'review' as const);
    render(<LessonDocumentView raw={schemaDiagramPilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeSchemaDiagram={grade} />);
    expect(screen.getByRole('heading', { name: 'Choose the schema' })).toBeTruthy();
    // GAP-FIX-R2: the four M8 schemas are offered, and the document never says which one fits.
    for (const schema of ['Change', 'Group', 'Compare', 'Ratio']) expect(screen.getByRole('radio', { name: schema })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Start' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('You matched the story to the schema that fits it.'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Change' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Start' })).getByRole('radio', { name: 'Earned 24' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Change' })).getByRole('radio', { name: 'Spent 9' }));
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.click(within(screen.getByRole('group', { name: 'Result' })).getByRole('radio', { name: 'Left over' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenNthCalledWith(2, { schema: 'change', slots: { start: 'earned', change: 'spent', result: 'unknown' } }, 'schema-slots-01', expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenNthCalledWith(3, { value: '15' }, 'schema-answer-01', expect.anything()));
  });
});

describe('compact Mentor stage projection', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders the projected character on the projected scene, not any authored fixture', async () => {
    render(<LessonDocumentView raw={pilot()} locale="en-US" ageBand="6-9" onBack={noop} onGrade={vi.fn()}
      mentorStage={{ character: 'zara', scene: 'diorama-b' }} />);
    const band = document.querySelector('.lf-mentor-band');
    expect(band).toBeTruthy();
    // Decorative in a lesson (the prompt label carries the Mentor's name): no accessible name of its own.
    expect(band!.getAttribute('aria-hidden')).toBe('true');
    expect(band!.getAttribute('data-mentor-character')).toBe('zara');
    expect(band!.getAttribute('data-mentor-scene')).toBe('diorama-b');
    expect(await screen.findByTestId('tutor-stage')).toHaveAttribute('data-character', 'zara');
    expect(screen.getByTestId('tutor-stage')).toHaveAttribute('data-scene', 'diorama-b');
    expect(screen.getByRole('heading', { name: 'Split your money' })).toBeTruthy();
  });

  it('renders the lesson without a stage when the projection is absent', () => {
    render(<LessonDocumentView raw={pilot()} locale="en-US" ageBand="6-9" onBack={noop} onGrade={vi.fn()} />);
    expect(document.querySelector('.lf-mentor-band')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Split your money' })).toBeTruthy();
  });

  it('W2L.3 (B.8): places the stage on every board, not only the allocation pilot', () => {
    render(<LessonDocumentView raw={growthPilotDocument('en-US', '6-9')} locale="en-US" ageBand="6-9" onBack={noop}
      mentorStage={{ character: 'rho', scene: 'diorama-a' }} />);
    expect(document.querySelector('.lf-learning-inner > .lf-mentor-band')?.getAttribute('data-mentor-character')).toBe('rho');
    expect(screen.getByRole('slider')).toBeTruthy();
  });

  it('08 §11 (GAP-FIX-R3): with an adventure theme the scene is the band backdrop and the band stays the side-column child', () => {
    render(<LessonDocumentView raw={growthPilotDocument('en-US', '6-9')} locale="en-US" ageBand="6-9" onBack={noop}
      mentorStage={{ character: 'rho', scene: 'diorama-a' }} adventureTheme="archipelago" />);
    const band = document.querySelector('.lf-learning-inner > .lf-mentor-band');
    expect(band?.getAttribute('data-mentor-character')).toBe('rho');
    expect(band?.querySelector('.lf-mentor-stage-backdrop [data-asset-id="scene.archipelago.art"]')).toBeTruthy();
    // One band, no separate stripe: nothing else in the slot.
    expect(document.querySelectorAll('.lf-learning-inner > .lf-mentor-band')).toHaveLength(1);
    expect(document.querySelector('.lf-learning-scene-band, .lf-learning-stage-band')).toBeNull();
  });

  it('08 §11 (GAP-FIX-R3): with no stage projected, the scene alone keeps the band class contract and the register height', () => {
    render(<LessonDocumentView raw={growthPilotDocument('en-US', '6-9')} locale="en-US" ageBand="6-9" onBack={noop} adventureTheme="archipelago" />);
    const band = document.querySelector<HTMLElement>('.lf-learning-inner > .lf-mentor-band.lf-mentor-band--scene');
    expect(band?.style.getPropertyValue('--lf-mentor-band-size')).toBe('110px');
    expect(band?.querySelector('[data-asset-id="scene.archipelago.art"]')).toBeTruthy();
  });

  it('W2L.3: a board without a projection carries no stage', () => {
    render(<LessonDocumentView raw={growthPilotDocument('en-US', '6-9')} locale="en-US" ageBand="6-9" onBack={noop} />);
    expect(document.querySelector('.lf-mentor-band')).toBeNull();
  });

  it('keeps the controlled preview fixture fixed to Dina on diorama-a', () => {
    expect(PREVIEW_MENTOR_STAGE).toEqual({ character: 'dina', scene: 'diorama-a' });
  });
});
