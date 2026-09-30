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

/** The "Move to…" menu (Bible 05 §4, GAP-FIX-R4): open an item's menu, choose a region or bin. */
async function moveTo(item: string, target: string) {
  fireEvent.click(screen.getByRole('button', { name: item }));
  fireEvent.click(screen.getByRole('button', { name: `${item}: Move to` }));
  fireEvent.click(await screen.findByRole('menuitem', { name: target }));
}

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

describe('Reset on every manipulable board (Bible 05 §3)', () => {
  it('bar model: empties the board the learner built and clears a review', async () => {
    const grade = vi.fn(() => 'review' as const);
    render(<LessonDocumentView raw={barModelPilotDocument('en-US')} locale="en-US" ageBand="10-12" onBack={noop} onGradeBarModel={grade} />);
    expect(reset()).toBeDisabled();
    await buildPilotBars();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('Not yet. Decide which bar is longer, then add the parts.')).toBeTruthy();
    fireEvent.click(reset());
    expect(screen.getByRole('button', { name: 'Compare two bars' })).toBeTruthy();
    expect(screen.queryByText('Not yet. Decide which bar is longer, then add the parts.')).toBeNull();
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

/*
 * GAP-FIX-R4 (Bible 05 §3): the boards built on BoardShell - the family, build
 * and concept boards - carry the same Reset in their control strip. The
 * concept boards are covered in conceptBoards.test.tsx; these are the family
 * and build boards.
 */
function familyLesson(segment: Record<string, unknown>, capabilities: string[], band: '6-9' | '10-12' | '13-17' = '10-12') {
  const eligibility = band === '6-9' ? { minimum_age: 7, maximum_age: 9 } : band === '10-12' ? { minimum_age: 10, maximum_age: 12 } : { minimum_age: 13, maximum_age: 17 };
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'boards', lesson_id: 'family-lesson', version_id: 'rev-1',
    locale: 'en-US', age_band: band, eligibility, knowledge_component_ids: ['kc-boards'], adventure_scene_id: 'diorama-a', title: 'Boards',
    required_capabilities: capabilities, segments: [segment],
  };
}

describe('Reset on the family and build boards (GAP-FIX-R4, Bible 05 §3)', () => {
  it('rule cards: unturns every card', () => {
    const cards = { id: 'cards-01', type: 'logic.rule-checker.v2', grading: 'server', prompt: 'Turn the cards.', visual: { type: 'rule-cards' },
      payload: { rule: 'If even, then red.', cards: [{ id: 'card-a', face: '8' }, { id: 'card-b', face: '5' }, { id: 'card-c', face: 'Red' }] } };
    render(<LessonDocumentView raw={familyLesson(cards, ['visual.rule-cards.v1', 'operation.flip-card.v1'])} locale="en-US" ageBand="10-12" onBack={noop} onGradeAny={vi.fn()} />);
    expect(reset()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(screen.getByRole('button', { name: '8' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(reset());
    expect(screen.getByRole('button', { name: '8' }).getAttribute('aria-pressed')).toBe('false');
    // The cards are drawn by the shared Pizarrón text cards (B.7).
    expect(document.querySelector('[data-pizarron="text-cards"]')).not.toBeNull();
  });

  it('sort bins: empties every bin and reason', async () => {
    const sort = { id: 'sort-01', type: 'money.needs-wants.v2', grading: 'server', prompt: 'Sort them.', visual: { type: 'sort-bins' },
      payload: { bins: [{ id: 'bin-need', label: 'Need' }, { id: 'bin-want', label: 'Want' }], items: [{ id: 'i-bread', label: 'Bread' }, { id: 'i-toy', label: 'Toy' }],
        reasons: [{ id: 'why-a', label: 'Every day' }, { id: 'why-b', label: 'For fun' }] } };
    render(<LessonDocumentView raw={familyLesson(sort, ['visual.sort-bins.v1', 'operation.sort-to-bin.v1', 'operation.move-menu.v1', 'operation.justify-choice.v1'])} locale="en-US" ageBand="10-12" onBack={noop} onGradeAny={vi.fn()} />);
    await moveTo('Bread', 'Need');
    expect(document.querySelector('[data-drop-target="bin-need"]')!.textContent).toContain('Bread');
    fireEvent.click(reset());
    expect(document.querySelector('[data-drop-target="bin-need"]')!.textContent).not.toContain('Bread');
    expect(reset()).toBeDisabled();
  });

  it('messages: clears every flag', () => {
    const scam = { id: 'msg-01', type: 'money.scam-check.v2', grading: 'server', prompt: 'Which is a trick?', visual: { type: 'message-list' },
      payload: { messages: [{ id: 'm-a', sender: 'Prize Club', text: 'Pay to win.' }, { id: 'm-b', sender: 'Teacher', text: 'Bring a book.' }, { id: 'm-c', sender: 'Sam', text: 'Play later?' }] } };
    render(<LessonDocumentView raw={familyLesson(scam, ['visual.message-list.v1', 'operation.flag-item.v1'])} locale="en-US" ageBand="10-12" onBack={noop} onGradeAny={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('radio', { name: 'Scam' })[0]!);
    expect(reset()).toBeEnabled();
    fireEvent.click(reset());
    expect(reset()).toBeDisabled();
  });

  it('coin tray: the tray draws reward coins and notes that fill as the steppers change, then Reset empties it (Bible 05 §2)', () => {
    const tray = { id: 'coins-01', type: 'money.coin-tray.v2', grading: 'server', prompt: 'Pay 17 coins.', visual: { type: 'coin-tray' },
      payload: { currency: 'coins', denominations: [{ value_minor: 10, kind: 'bill', available: 3 }, { value_minor: 5, kind: 'coin', available: 3 }, { value_minor: 1, kind: 'coin', available: 6 }] } };
    render(<LessonDocumentView raw={familyLesson(tray, ['visual.coin-tray.v1', 'operation.count-money.v1'], '6-9')} locale="en-US" ageBand="6-9" onBack={noop} onGradeAny={vi.fn()} />);
    const pictured = () => document.querySelector('[data-pizarron="coin-groups"]')!;
    expect(pictured().querySelectorAll('.lf-pz-coin, .lf-pz-coin-bill')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '10: More' }));
    fireEvent.click(screen.getByRole('button', { name: '5: More' }));
    fireEvent.click(screen.getByRole('button', { name: '1: More' }));
    fireEvent.click(screen.getByRole('button', { name: '1: More' }));
    expect(pictured().querySelectorAll('.lf-pz-coin-bill')).toHaveLength(1);
    expect(pictured().querySelectorAll('.lf-pz-coin')).toHaveLength(3);
    fireEvent.click(reset());
    expect(pictured().querySelectorAll('.lf-pz-coin, .lf-pz-coin-bill')).toHaveLength(0);
    expect(reset()).toBeDisabled();
  });

  it('unit price: clears the typed unit prices and the choice', () => {
    const offers = { id: 'unit-01', type: 'money.unit-price.v2', grading: 'server', prompt: 'Which is the better buy?', visual: { type: 'ratio-table' },
      payload: { currency: 'coins', unitLabel: 'apple', offers: [{ id: 'off-a', label: 'Bag A', quantity: 4, price_minor: 8 }, { id: 'off-b', label: 'Bag B', quantity: 6, price_minor: 9 }] } };
    render(<LessonDocumentView raw={familyLesson(offers, ['visual.ratio-table.v1', 'operation.number-input.v1', 'operation.choose-option.v1'])} locale="en-US" ageBand="10-12" onBack={noop} onGradeAny={vi.fn()} />);
    const field = screen.getAllByRole('textbox')[0]!;
    fireEvent.change(field, { target: { value: '2' } });
    expect(reset()).toBeEnabled();
    fireEvent.click(reset());
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('');
  });
});
