import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy } from '../design/copyBudget';
import { familyCopy, familyCopyRoles } from './familyCopy';
import { LessonDocumentView } from './LessonDocumentView';
import { loadLessonClientDocument } from './lessonDocument';
import { loadNarrationAudio } from './AuthenticatedLessonDocument';

/*
 * GAP-FIX-R1 learning: the general ordered-segment player (OD-17, B.7), the
 * first-release families (Appendix P Part 8), the Mentor prompt label and
 * help ladder (Bible 08 §11), the adventure scene band (B.8) and the B.4
 * update-required screen.
 */

vi.mock('../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const noop = () => {};
const intro = { id: 'intro-01', type: 'voice.mentor-turn.v2', grading: 'none', prompt: 'Meet your goal.', visual: { type: 'speech-plate' },
  payload: { role: 'intro', line: 'Let us save for a kite together.' } };
const cards = { id: 'cards-01', type: 'logic.rule-checker.v2', grading: 'server', prompt: 'Which cards must you turn?', visual: { type: 'rule-cards' },
  help: ['Look for a card that could break the rule.', 'A red card could hide an odd number.'],
  payload: { rule: 'If a card is even, its back is red.', cards: [{ id: 'card-even', face: '8' }, { id: 'card-odd', face: '5' }, { id: 'card-red', face: 'Red' }, { id: 'card-blue', face: 'Blue' }] } };
const story = { id: 'story-01', type: 'story.branch.v2', grading: 'server', prompt: 'What do you do?', visual: { type: 'story-scene' },
  payload: { scene: 'You have 12 coins. Save or spend?', options: [{ id: 'opt-save', label: 'Save 4 coins' }, { id: 'opt-spend', label: 'Spend all now' }] } };

function mixed(segments: unknown[], capabilities: string[]) {
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'saving-basics', lesson_id: 'mixed-lesson',
    version_id: 'rev-1', locale: 'en-US', age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 }, knowledge_component_ids: ['kc-saving-goal'],
    adventure_scene_id: 'diorama-a', title: 'Save for a kite', required_capabilities: capabilities, segments,
  };
}
const lessonDoc = () => mixed(structuredClone([intro, cards, story]), ['visual.speech-plate.v1', 'visual.rule-cards.v1', 'operation.flip-card.v1', 'visual.story-scene.v1', 'operation.choose-option.v1']);

/** The "Move to…" menu (Bible 05 §4, GAP-FIX-R4): open an item's menu, choose a region or bin. */
async function moveTo(item: string, target: string) {
  fireEvent.click(screen.getByRole('button', { name: item }));
  fireEvent.click(screen.getByRole('button', { name: `${item}: Move to` }));
  fireEvent.click(await screen.findByRole('menuitem', { name: target }));
}

describe('general v2 player', () => {
  it('B.18 (GAP-FIX-R3): plays the differentiated narration on request, with the plate as caption; silent with the sound off or no audio', async () => {
    const played: string[] = [];
    class FakeAudio { src: string; onended: (() => void) | null = null; constructor(src: string) { this.src = src; played.push(src); } play() { return Promise.resolve(); } pause() {} }
    vi.stubGlobal('Audio', FakeAudio);
    const voiced = { ...intro, payload: { ...intro.payload, narration: { mode: 'differentiated', script: 'Today we plan how to save for a kite, one week at a time.', audio_ref: 'intro-01-voice' } } };
    const doc = mixed([voiced, story], ['visual.speech-plate.v1', 'visual.story-scene.v1', 'operation.choose-option.v1']);
    const { unmount } = render(<LessonDocumentView raw={doc} locale="en-US" ageBand="6-9" onBack={noop} onGradeAny={async () => ({ verdict: 'met' as const })}
      narrationAudio={{ 'intro-01': 'https://cdn.littlefounders.test/audio/intro-01.mp3' }} />);
    // The caption is the plate; nothing plays until the learner asks.
    expect(screen.getByText('Let us save for a kite together.')).toBeTruthy();
    expect(played).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
    expect(played).toEqual(['https://cdn.littlefounders.test/audio/intro-01.mp3']);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    unmount();
    // No resolvable audio: the text-only plate, no control.
    const { unmount: second } = render(<LessonDocumentView raw={doc} locale="en-US" ageBand="6-9" onBack={noop} onGradeAny={async () => ({ verdict: 'met' as const })} />);
    expect(screen.queryByRole('button', { name: 'Listen' })).toBeNull();
    second();
    // The sound off switch wins.
    window.localStorage.setItem('lf_sound_muted', '1');
    render(<LessonDocumentView raw={doc} locale="en-US" ageBand="6-9" onBack={noop} onGradeAny={async () => ({ verdict: 'met' as const })}
      narrationAudio={{ 'intro-01': 'https://cdn.littlefounders.test/audio/intro-01.mp3' }} />);
    expect(screen.queryByRole('button', { name: 'Listen' })).toBeNull();
    window.localStorage.removeItem('lf_sound_muted');
    vi.unstubAllGlobals();
    // Core's map is re-checked in the browser: only ids to https or same-origin paths survive.
    expect(loadNarrationAudio({ 'intro-01': 'https://a.test/x.mp3', 'wrap-01': '/audio/w.mp3', 'bad-01': 'javascript:alert(1)', 'x': 'https://a.test/y.mp3', 'num-01': 3 }))
      .toEqual({ 'intro-01': 'https://a.test/x.mp3', 'wrap-01': '/audio/w.mp3' });
    expect(loadNarrationAudio(['https://a.test/x.mp3'])).toEqual({});
  });

  it('parses a mixed document with the new families and refuses an unknown KC', () => {
    expect(loadLessonClientDocument(lessonDoc()).status).toBe('ready');
    const bad = lessonDoc();
    (bad.segments[1] as Record<string, unknown>).knowledge_component_id = 'kc-elsewhere';
    expect(loadLessonClientDocument(bad).status).toBe('invalid');
  });

  it('plays a Mentor turn, a graded logic board and a story choice in order, recording the viewed step with Core', async () => {
    const onView = vi.fn(async () => true);
    const onGradeAny = vi.fn(async () => ({ verdict: 'met' as const }));
    const onHelpUsed = vi.fn();
    const onComplete = vi.fn(async () => true);
    render(<LessonDocumentView raw={lessonDoc()} locale="en-US" ageBand="6-9" onBack={noop} onView={onView} onGradeAny={onGradeAny} onHelpUsed={onHelpUsed}
      onComplete={onComplete} mentorStage={{ character: 'dina', scene: 'diorama-a' }} adventureTheme="archipelago" />);
    // Bible 08 §11: the Mentor's name is the prompt label; the line sits in the speech plate.
    expect(screen.getAllByText('Dina asks').length).toBeGreaterThan(0);
    expect(screen.getByText('Let us save for a kite together.')).toBeTruthy();
    expect(screen.getByText('1 of 3')).toBeTruthy();
    // B.8 / 08 §11 (GAP-FIX-R3): the adventure scene is the backdrop of the one Mentor band, outside the board.
    expect(document.querySelector('.lf-learning-inner > .lf-mentor-band .lf-mentor-stage-backdrop [data-asset-id="scene.archipelago.art"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByText('2 of 3')).toBeTruthy());
    expect(onView).toHaveBeenCalledWith('intro-01', expect.objectContaining({ lesson_id: 'mixed-lesson' }));

    // Help on request: one speech-plate turn per ladder step, counted for the grade receipt.
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByText('Look for a card that could break the rule.')).toBeTruthy();
    expect(onHelpUsed).toHaveBeenLastCalledWith('cards-01', 1);
    fireEvent.click(screen.getByRole('button', { name: 'More help' }));
    expect(onHelpUsed).toHaveBeenLastCalledWith('cards-01', 2);

    fireEvent.click(screen.getByRole('button', { name: /8/ }));
    fireEvent.click(screen.getByRole('button', { name: /Blue/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ flipped: ['card-even', 'card-blue'] }, 'cards-01', expect.anything()));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    fireEvent.click(await screen.findByRole('button', { name: /Save 4 coins/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ choice: 'opt-save' }, 'story-01', expect.anything()));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it('keeps the learner on a viewed step when Core does not record it', async () => {
    const onView = vi.fn(async () => false);
    render(<LessonDocumentView raw={lessonDoc()} locale="en-US" ageBand="6-9" onBack={noop} onView={onView} onGradeAny={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Could not save this step. Try again.')).toBeTruthy();
    expect(screen.getByText('1 of 3')).toBeTruthy();
  });

  it('restores a resumed run past its viewed and met steps', () => {
    render(<LessonDocumentView raw={lessonDoc()} locale="en-US" ageBand="6-9" onBack={noop} onGradeAny={vi.fn()} onComplete={vi.fn()}
      viewedSegmentIds={['intro-01']} metSegmentIds={['cards-01']} />);
    expect(screen.getByText('3 of 3')).toBeTruthy();
  });

  it('asks the learner to update the app, with Reload first, when a graded family has no grader', () => {
    render(<LessonDocumentView raw={lessonDoc()} locale="en-US" ageBand="6-9" onBack={noop} />);
    expect(screen.getByRole('heading', { name: 'Update the app' })).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]!.textContent).toBe('Reload');
    expect(buttons[1]!.textContent).toBe('Go back');
  });

  it('shows a Euler board with a "Move to" choice per item and no impossible region', async () => {
    const euler = { id: 'euler-01', type: 'logic.euler.v2', grading: 'server', prompt: 'Place each animal.', visual: { type: 'euler' },
      payload: { relation: 'subset', sets: [{ id: 'set-dogs', label: 'Dogs' }, { id: 'set-pets', label: 'Pets' }], items: [{ id: 'item-rex', label: 'Rex' }, { id: 'item-car', label: 'Car' }] } };
    const onGradeAny = vi.fn(async () => ({ verdict: 'review' as const, diagnostic: 'structure' }));
    // GAP-FIX-R4 (Appendix P L5): nesting opens at 10, so the nested board is a 10-12 lesson.
    const tween = { ...mixed([euler], ['visual.euler.v1', 'operation.place-in-region.v1', 'operation.move-menu.v1']), age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 } };
    render(<LessonDocumentView raw={tween} locale="en-US" ageBand="10-12" onBack={noop} onGradeAny={onGradeAny} />);
    // A subset has no "only Dogs" region.
    fireEvent.click(screen.getByRole('button', { name: 'Rex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rex: Move to' }));
    expect(await screen.findByRole('menuitem', { name: 'Dogs' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Only Dogs' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Dogs' }));
    await moveTo('Car', 'In neither');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ placements: { 'item-rex': 'both', 'item-car': 'neither' } }, 'euler-01', expect.anything()));
    expect(await screen.findByText('Not yet. Check how you set it up.')).toBeTruthy();
  });

  it('GAP-FIX-R4: a 6-9 lesson may not nest circles; the browser refuses it the way Core does', () => {
    const nested = { id: 'euler-01', type: 'logic.euler.v2', grading: 'server', prompt: 'Place each animal.', visual: { type: 'euler' },
      payload: { relation: 'subset', sets: [{ id: 'set-dogs', label: 'Dogs' }, { id: 'set-pets', label: 'Pets' }], items: [{ id: 'item-rex', label: 'Rex' }, { id: 'item-car', label: 'Car' }] } };
    render(<LessonDocumentView raw={mixed([nested], ['visual.euler.v1', 'operation.place-in-region.v1', 'operation.move-menu.v1'])} locale="en-US" ageBand="6-9" onBack={noop} />);
    expect(screen.queryByRole('group', { name: 'Circle diagram' })).toBeNull();
  });

  it('GAP-FIX-R4 (L5): choose the diagram, drag or tap items into regions, flag the occupied ones, then Reset restores the board', async () => {
    const euler = { id: 'euler-02', type: 'logic.euler.v2', grading: 'server', prompt: 'Pick the picture, then place each kid.', visual: { type: 'euler' },
      payload: { choose_relation: true, sentence: 'No one saves all and spends all.', mark_occupancy: true,
        sets: [{ id: 'set-save', label: 'Saves all' }, { id: 'set-spend', label: 'Spends all' }], items: [{ id: 'item-ana', label: 'Ana' }, { id: 'item-leo', label: 'Leo' }] } };
    const onGradeAny = vi.fn(async () => ({ verdict: 'review' as const, diagnostic: 'occupancy' }));
    const tween = { ...mixed([euler], ['visual.euler.v1', 'operation.place-in-region.v1', 'operation.move-menu.v1']), age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 } };
    render(<LessonDocumentView raw={tween} locale="en-US" ageBand="10-12" onBack={noop} onGradeAny={onGradeAny} />);
    // No picture until the learner chooses the one that matches the sentence; the payload never says which.
    expect(screen.queryByRole('group', { name: 'Circle diagram' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Circles apart' }));
    const diagram = screen.getByRole('group', { name: 'Circle diagram' });
    // The interactive Euler board is the shared Pizarrón Venn, never role="img" (Bible 05 §6).
    expect(diagram.getAttribute('data-pizarron')).toBe('venn');
    expect(diagram.closest('[role="img"]')).toBeNull();
    // Circles apart have no "both" region to place into.
    expect(diagram.querySelector('[data-drop-target="both"]')).toBeNull();
    // Tap path: press the chip, then its region.
    fireEvent.click(screen.getByRole('button', { name: 'Ana' }));
    expect(screen.getByRole('button', { name: 'Ana' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(diagram.querySelector('[data-drop-target="first"]')!);
    expect(diagram.querySelector('[data-drop-target="first"]')!.textContent).toContain('Ana');
    // Keyboard path: the "Move to" menu.
    await moveTo('Leo', 'Only Spends all');
    fireEvent.click(screen.getByRole('button', { name: 'Only Saves all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ placements: { 'item-ana': 'first', 'item-leo': 'second' }, relation: 'disjoint', occupied: ['first'] },
      'euler-02', expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryByRole('group', { name: 'Circle diagram' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('GAP-FIX-R4 (L5): places an item by dragging it onto a region', async () => {
    // jsdom has no PointerEvent: a MouseEvent-based stand-in carries the coordinates the drag reads.
    const hadPointer = 'PointerEvent' in window;
    if (!hadPointer) Object.defineProperty(window, 'PointerEvent', { configurable: true, value: class extends MouseEvent { pointerId = 1; } });
    const euler = { id: 'euler-03', type: 'logic.euler.v2', grading: 'server', prompt: 'Place each thing.', visual: { type: 'euler' },
      payload: { relation: 'overlap', sets: [{ id: 'set-round', label: 'Round' }, { id: 'set-shiny', label: 'Shiny' }], items: [{ id: 'item-coin', label: 'Coin' }, { id: 'item-ball', label: 'Ball' }] } };
    render(<LessonDocumentView raw={mixed([euler], ['visual.euler.v1', 'operation.place-in-region.v1', 'operation.move-menu.v1'])} locale="en-US" ageBand="6-9" onBack={noop} onGradeAny={vi.fn()} />);
    const both = screen.getByRole('group', { name: 'Circle diagram' }).querySelector('[data-drop-target="both"]')!;
    const original = document.elementFromPoint;
    document.elementFromPoint = (() => both) as typeof document.elementFromPoint;
    try {
      const chip = screen.getByRole('button', { name: 'Coin' });
      fireEvent.pointerDown(chip, { clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(chip, { clientX: 40, clientY: 40, pointerId: 1 });
      expect(both.getAttribute('data-drop-selected')).toBe('true');
      fireEvent.pointerUp(chip, { clientX: 40, clientY: 40, pointerId: 1 });
      fireEvent.click(chip);
    } finally {
      document.elementFromPoint = original;
    }
    expect(both.textContent).toContain('Coin');
    // The drag did not also pick the chip up for a tap.
    expect(screen.getByRole('button', { name: 'Coin' }).getAttribute('aria-pressed')).toBe('false');
    if (!hadPointer) Reflect.deleteProperty(window, 'PointerEvent');
  });

  it('GAP-FIX-R4 (L10): the rule changes mid-task; the second rule and its bins appear once the first items are sorted', async () => {
    const sort = { id: 'sort-01', type: 'logic.sort-by-rule.v2', grading: 'server', prompt: 'Sort the piles.', visual: { type: 'sort-bins' },
      payload: { rule: 'Even or odd?', bins: [{ id: 'bin-even', label: 'Even' }, { id: 'bin-odd', label: 'Odd' }, { id: 'bin-depends', label: 'It depends' }], depends_bin_id: 'bin-depends',
        items: [{ id: 'i-4', label: '4 coins' }, { id: 'i-10', label: '10 coins' }], reasons: [{ id: 'why-a', label: 'Pairs' }, { id: 'why-b', label: 'Many' }],
        switch_after: 1, second_rule: 'Big or small?', second_bins: [{ id: 'bin-big', label: 'Big' }, { id: 'bin-small', label: 'Small' }] } };
    const onGradeAny = vi.fn(async () => ({ verdict: 'met' as const }));
    const tween = { ...mixed([sort], ['visual.sort-bins.v1', 'operation.sort-to-bin.v1', 'operation.move-menu.v1', 'operation.justify-choice.v1']),
      age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 } };
    render(<LessonDocumentView raw={tween} locale="en-US" ageBand="10-12" onBack={noop} onGradeAny={onGradeAny} />);
    expect(screen.queryByText('Big or small?')).toBeNull();
    await moveTo('4 coins', 'Even');
    fireEvent.click(screen.getByRole('radio', { name: 'Pairs' }));
    expect(screen.getByText('Big or small?')).toBeTruthy();
    // After the switch the item's bins are the new rule's only.
    fireEvent.click(screen.getByRole('button', { name: '10 coins' }));
    fireEvent.click(screen.getByRole('button', { name: '10 coins: Move to' }));
    expect(await screen.findByRole('menuitem', { name: 'Big' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Even' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Big' }));
    fireEvent.click(screen.getAllByRole('radio', { name: 'Many' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ placements: { 'i-4': { bin: 'bin-even', reason: 'why-a' }, 'i-10': { bin: 'bin-big', reason: 'why-b' } } },
      'sort-01', expect.anything()));
  });

  it('keeps the family board labels inside the youngest Copy Budget in three locales', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      for (const [key, role] of Object.entries(familyCopyRoles)) {
        const text = familyCopy[locale][key as keyof typeof familyCopyRoles].replace('{set}', 'Mascotas');
        if (role !== 'data') expect(checkCopy(text, role, { locale, ageBand: '6-9', surface: 'app' }), `${locale} ${key}`).toEqual([]);
        expect(text, key).not.toMatch(/\bTutor\b|\bbot\b|assistant|asistente|assistente|\blives?\b|\bvidas?\b|—/i);
      }
    }
  });
});
