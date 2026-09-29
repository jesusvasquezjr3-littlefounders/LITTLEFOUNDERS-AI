import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy } from '../design/copyBudget';
import { LessonDocumentView } from './LessonDocumentView';
import { loadLessonClientDocument } from './lessonDocument';
import en from '../../i18n/en-US/rebuild-learn.json';
import es from '../../i18n/es-MX/rebuild-learn.json';
import pt from '../../i18n/pt-BR/rebuild-learn.json';

/*
 * GAP-FIX-R5 learning (Product 10 Block B "Age-band registers" autonomy
 * column; B.24): from 10-12 a lesson may offer equally valid strategies. The
 * player plays the steps before the chains, asks "Choose how to practice",
 * pins the pick with Core and plays only the chosen chain.
 */

vi.mock('../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const noop = () => {};
const intro = { id: 'intro-01', type: 'voice.mentor-turn.v2', grading: 'none', prompt: 'Two ways to plan.', visual: { type: 'speech-plate' },
  payload: { role: 'intro', line: 'Pick the way you like to practice.' } };
const story = (id: string, scene: string, save: string) => ({ id, type: 'story.branch.v2', grading: 'server', prompt: 'What do you do?', visual: { type: 'story-scene' },
  payload: { scene, options: [{ id: 'opt-save', label: save }, { id: 'opt-spend', label: 'Spend all now' }] } });

function doc(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'saving-basics', lesson_id: 'approach-lesson',
    version_id: 'rev-1', locale: 'en-US', age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-saving-goal'],
    adventure_scene_id: 'diorama-a', title: 'Plan your saving', required_capabilities: ['visual.speech-plate.v1', 'visual.story-scene.v1', 'operation.choose-option.v1'],
    segments: [intro, story('story-a', 'List what you need first.', 'List it'), story('story-b', 'Split coins into jars.', 'Fill the jars')],
    approaches: { options: [{ id: 'approach-list', label: 'Make a list', segment_ids: ['story-a'] }, { id: 'approach-jars', label: 'Use jars', segment_ids: ['story-b'] }] },
    ...overrides,
  };
}

describe('the approach choice in the v2 player', () => {
  it('parses a 10-12 lesson with approaches and refuses one for 6-9 or with a chain that is not graded', () => {
    expect(loadLessonClientDocument(doc()).status).toBe('ready');
    expect(loadLessonClientDocument(doc({ age_band: '6-9', pathway_id: 'financial-young', eligibility: { minimum_age: 6, maximum_age: 9 } })).status).toBe('invalid');
    expect(loadLessonClientDocument(doc({ approaches: { options: [{ id: 'approach-talk', label: 'Talk', segment_ids: ['intro-01'] }, { id: 'approach-jars', label: 'Use jars', segment_ids: ['story-b'] }] } })).status).toBe('invalid');
  });

  it('plays the intro, asks how to practice, pins the pick with Core and plays only the chosen chain', async () => {
    const onView = vi.fn(async () => true);
    const onGradeAny = vi.fn(async () => ({ verdict: 'met' as const }));
    const onChooseApproach = vi.fn(async (id: string) => id);
    const onComplete = vi.fn(async () => true);
    render(<LessonDocumentView raw={doc()} locale="en-US" ageBand="10-12" onBack={noop} onView={onView} onGradeAny={onGradeAny}
      onChooseApproach={onChooseApproach} onComplete={onComplete} approachId={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Choose how to practice.')).toBeTruthy();
    const start = screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    // Both strategies are offered as equals: no option is marked right.
    expect(screen.getByRole('button', { name: /Make a list/ }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Use jars/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(onChooseApproach).toHaveBeenCalledWith('approach-jars', expect.objectContaining({ lesson_id: 'approach-lesson' })));
    expect(await screen.findByText('Split coins into jars.')).toBeTruthy();
    expect(screen.queryByText('List what you need first.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Fill the jars/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ choice: 'opt-save' }, 'story-b', expect.anything()));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finish lesson' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onGradeAny).not.toHaveBeenCalledWith(expect.anything(), 'story-a', expect.anything());
  });

  it('stays on the choice and says so when Core could not save it; a resumed run goes straight to its pinned chain', async () => {
    const refused = vi.fn(async () => null);
    const { unmount } = render(<LessonDocumentView raw={doc({ locale: 'es-MX' })} locale="es-MX" ageBand="10-12" onBack={noop} onView={vi.fn(async () => true)} onGradeAny={vi.fn()}
      onChooseApproach={refused} onComplete={vi.fn()} approachId={null} viewedSegmentIds={['intro-01']} />);
    expect(screen.getByText('Elige cómo practicar.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Make a list/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(await screen.findByText('No se pudo guardar tu elección. Intenta otra vez.')).toBeTruthy();
    expect(screen.getByText('Elige cómo practicar.')).toBeTruthy();
    unmount();
    render(<LessonDocumentView raw={doc()} locale="en-US" ageBand="10-12" onBack={noop} onView={vi.fn(async () => true)} onGradeAny={vi.fn()}
      onChooseApproach={vi.fn()} onComplete={vi.fn()} approachId="approach-list" viewedSegmentIds={['intro-01']} />);
    expect(screen.getByText('List what you need first.')).toBeTruthy();
    expect(screen.queryByText('Choose how to practice.')).toBeNull();
  });

  it('the choice copy fits the Copy Budget in every locale', () => {
    for (const [locale, copy] of [['en-US', en], ['es-MX', es], ['pt-BR', pt]] as const) {
      for (const ageBand of ['10-12', '13-17', 'adult'] as const) {
        const context = { locale, ageBand, surface: 'app' as const };
        expect(checkCopy(copy.player.approachPrompt, 'prompt', context), locale).toEqual([]);
        expect(checkCopy(copy.player.approachStart, 'action', context), locale).toEqual([]);
        expect(checkCopy(copy.player.approachFailed, 'body', context), locale).toEqual([]);
        expect(checkCopy(copy.course.exploreNote, 'body', context), locale).toEqual([]);
        expect(checkCopy(copy.course.exploreTitle, 'heading', context), locale).toEqual([]);
      }
      const young = { locale, ageBand: '6-9' as const, surface: 'app' as const };
      expect(checkCopy(copy.course.pickTitle, 'heading', young), locale).toEqual([]);
    }
  });
});
