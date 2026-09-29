import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy } from '../design/copyBudget';
import { familyCopy, familyCopyRoles } from './familyCopy';
import { LessonDocumentView } from './LessonDocumentView';
import { loadLessonClientDocument } from './lessonDocument';

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

describe('general v2 player', () => {
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
    render(<LessonDocumentView raw={mixed([euler], ['visual.euler.v1', 'operation.place-in-region.v1', 'operation.move-menu.v1'])} locale="en-US" ageBand="6-9" onBack={noop} onGradeAny={onGradeAny} />);
    // A subset has no "only Dogs" region.
    expect(screen.queryByRole('radio', { name: 'Only Dogs' })).toBeNull();
    fireEvent.click(screen.getAllByRole('radio', { name: 'Dogs' })[0]!);
    fireEvent.click(screen.getAllByRole('radio', { name: 'In neither' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ placements: { 'item-rex': 'both', 'item-car': 'neither' } }, 'euler-01', expect.anything()));
    expect(await screen.findByText('Not yet. Check how you set it up.')).toBeTruthy();
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
