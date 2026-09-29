import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from './LessonDocumentView';
import { barModelPilotDocument } from './BarModelBoard';
import { fractionAreaPilotDocument } from './FractionAreaBoard';
import { placeValuePilotDocument } from './PlaceValueBoard';
import { savingsRulePilotDocument } from './SavingsRuleBoard';
import { schemaDiagramPilotDocument } from './SchemaDiagramBoard';
import { functionMachinePilotDocument } from './FunctionMachineBoard';
import { cpaFadingPilotDocument } from './CpaFadingBoard';
import { workedExamplePilotDocument } from './WorkedExampleBoard';

/*
 * Bible 05 §3: every manipulable board's control strip has a Reset that
 * restores the authored initial state and clears the verdict. These eight
 * boards had none (S10 design-system gap fix).
 */

vi.mock('../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const noop = () => {};
const reset = () => screen.getByRole('button', { name: 'Reset' });

/** GAP-FIX-R3 (M7): builds the pilot's bars the way a learner does, slot by slot ("Ana has 12 more than Leo; together 50"). */
async function buildPilotBars() {
  fireEvent.click(screen.getByRole('button', { name: 'Two bars to compare' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add the total' }));
  const pick = async (slot: string, item: string) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${slot}:`) }));
    fireEvent.click(await screen.findByRole('menuitem', { name: item }));
  };
  await pick('Shorter bar', '? Leo');
  await pick('Difference', '12 more: 12');
  await pick('Both together', 'Together: 50');
}

describe('Reset on every manipulable board (Bible 05 §3)', () => {
  it('bar model: empties the board the learner built and clears a review', async () => {
    const grade = vi.fn(() => 'review' as const);
    render(<LessonDocumentView raw={barModelPilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeBarModel={grade} />);
    expect(reset()).toBeDisabled();
    await buildPilotBars();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('Look at the bars again.')).toBeTruthy();
    fireEvent.click(reset());
    expect(screen.getByRole('button', { name: 'Two bars to compare' })).toBeTruthy();
    expect(screen.queryByText('Look at the bars again.')).toBeNull();
    expect(reset()).toBeDisabled();
  });

  it('fraction area: restores the authored parts and shading', () => {
    render(<LessonDocumentView raw={fractionAreaPilotDocument('en-US')} locale="en-US" ageBand="6-9" onBack={noop} onGradeFractionArea={() => 'met'} />);
    expect(reset()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Shaded parts: More' }));
    expect(reset()).toBeEnabled();
    fireEvent.click(reset());
    expect(reset()).toBeDisabled();
  });

  it('place value: undoes every trade and leaves the replay', () => {
    render(<LessonDocumentView raw={placeValuePilotDocument('en-US')} locale="en-US" ageBand="6-9" onBack={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trade 10' }));
    expect(screen.getByRole('img', { name: /2 Tens, 0 Ones/ })).toBeTruthy();
    fireEvent.click(reset());
    expect(screen.getByRole('img', { name: /0 Tens, 20 Ones/ })).toBeTruthy();
    expect(reset()).toBeDisabled();
  });

  it('savings rule: clears the connective and returns to the first case', () => {
    render(<LessonDocumentView raw={savingsRulePilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} />);
    fireEvent.click(screen.getByRole('radio', { name: 'AND' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('img', { name: /Case 2/ })).toBeTruthy();
    fireEvent.click(reset());
    expect(screen.getByRole('img', { name: /Case 1/ })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Choose a link');
  });

  it('schema diagram: clears the chosen schema', () => {
    render(<LessonDocumentView raw={schemaDiagramPilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeSchemaDiagram={() => 'met'} />);
    expect(reset()).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Change' }));
    fireEvent.click(reset());
    expect(screen.getByRole('radio', { name: 'Change' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('function machine: returns to the first input, not yet run, with an empty rule', () => {
    render(<LessonDocumentView raw={functionMachinePilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeBarModel={() => 'met'} />);
    fireEvent.click(screen.getByRole('radio', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    fireEvent.change(screen.getByLabelText('Multiply by'), { target: { value: '5' } });
    expect(screen.getByRole('img', { name: /Input: 2\. Output: 20/ })).toBeTruthy();
    fireEvent.click(reset());
    expect(screen.getByRole('img', { name: /Input: 1\. Output: \?/ })).toBeTruthy();
    expect(screen.getByLabelText('Multiply by')).toHaveValue('');
  });

  it('CPA fading: empties the answer and clears a review', async () => {
    const grade = vi.fn(() => 'review' as const);
    render(<LessonDocumentView raw={cpaFadingPilotDocument('en-US')} locale="en-US" ageBand="6-9" onBack={noop} onGradeNumberLine={grade} />);
    const answer = screen.getByRole('textbox', { name: 'Your answer' });
    fireEvent.change(answer, { target: { value: '9' } });
    expect(reset()).toBeEnabled();
    fireEvent.click(reset());
    expect(answer).toHaveValue('');
    await waitFor(() => expect(reset()).toBeDisabled());
  });

  it('worked example: returns to the first step with no predictions or answers', () => {
    render(<LessonDocumentView raw={workedExamplePilotDocument('en-US', 1)} locale="en-US" ageBand="10-12" onBack={noop} onGradeWorkedExample={() => 'met'} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Predict the next result' }), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show next step' }));
    expect(screen.getByText('Result: 40')).toBeTruthy();
    fireEvent.click(reset());
    expect(screen.queryByText('Result: 40')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Predict the next result' })).toHaveValue('');
    expect(reset()).toBeDisabled();
  });
});
