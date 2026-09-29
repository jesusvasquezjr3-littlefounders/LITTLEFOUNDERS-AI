import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuidedReviewOffer } from './GuidedReviewOffer';
import { LessonDocumentView } from './LessonDocumentView';
import { LESSON_STAGE_INTRO_MS, LessonStageProvider, LessonStageRequestHost, LessonStageSlot, useLessonStageRequest } from './lessonStage';
import { LessonPlayerProvider, NarrationControl } from './segmentKit';
import { StepReplay } from './StepReplay';
import { workedExamplePilotDocument } from './WorkedExampleBoard';

/*
 * GAP-FIX-R5 (Bible 08 §11 "the same states as section 3": the compact Mentor
 * introduces the question, reacts to answers and demonstrates beside the
 * board; 08 §3 encouraging while offering a guided review; B.8). The stage
 * used to follow the verdict alone.
 */
vi.mock('../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const STAGE = { character: 'dina', scene: 'diorama-a' } as const;
const OFFER = { skill_key: 'financial-education/saving-goal', skill: 'Saving toward a goal', misses: 3, character: 'dina' } as const;
const state = () => document.querySelector('.lf-mentor-band')?.getAttribute('data-mentor-state');
const afterIntro = () => act(() => { vi.advanceTimersByTime(LESSON_STAGE_INTRO_MS + 10); });

function Requester({ request, on = true }: { request: 'speaking' | 'demonstrating' | 'encouraging'; on?: boolean }) {
  useLessonStageRequest(request, on);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the lesson compact stage follows the lesson, not only the verdict (GAP-FIX-R5, 08 §11)', () => {
  it('introduces a new segment by speaking, then rests', () => {
    render(<LessonStageProvider stage={STAGE} ageBand="6-9" theme="light"><LessonStageSlot /></LessonStageProvider>);
    expect(state()).toBe('speaking');
    afterIntro();
    expect(state()).toBe('idle');
  });

  it('lets a verdict reaction win over the introduction, and never celebrates', () => {
    const view = render(<LessonStageProvider stage={STAGE} ageBand="6-9" theme="light"><LessonStageSlot verdict="met" /></LessonStageProvider>);
    expect(state()).toBe('acknowledging');
    view.rerender(<LessonStageProvider stage={STAGE} ageBand="6-9" theme="light"><Requester request="speaking" /><LessonStageSlot verdict="review" /></LessonStageProvider>);
    expect(state()).toBe('encouraging');
    expect(document.querySelector('[data-mentor-state="celebrating"]')).toBeNull();
  });

  it('demonstrates while a step replay is on screen, and stops when it leaves', () => {
    const labels = { previous: 'Previous', next: 'Next', play: 'Play', pause: 'Pause', step: 'Step' };
    const view = render(<LessonStageProvider stage={STAGE} ageBand="10-12" theme="light">
      <LessonStageSlot /><StepReplay steps={3} index={0} onChange={() => {}} labels={labels} />
    </LessonStageProvider>);
    afterIntro();
    expect(state()).toBe('demonstrating');
    view.rerender(<LessonStageProvider stage={STAGE} ageBand="10-12" theme="light"><LessonStageSlot /></LessonStageProvider>);
    expect(state()).toBe('idle');
  });

  it('demonstrates beside a worked example (the board mounts its own request)', () => {
    render(<LessonDocumentView raw={workedExamplePilotDocument('en-US', 0)} locale="en-US" ageBand="10-12" onBack={() => {}}
      onGradeWorkedExample={() => 'review'} mentorStage={STAGE} />);
    expect(state()).toBe('speaking');
    afterIntro();
    expect(state()).toBe('demonstrating');
  });

  it('speaks for exactly as long as the narration plays', () => {
    const played: { onended: (() => void) | null }[] = [];
    class FakeAudio {
      onended: (() => void) | null = null;
      constructor() { played.push(this); }
      play() { return Promise.resolve(); }
      pause() {}
    }
    vi.stubGlobal('Audio', FakeAudio);
    render(<LessonStageProvider stage={STAGE} ageBand="6-9" theme="light">
      <LessonPlayerProvider stage={STAGE} theme="light" narrationAudio={{ s1: '/narration/s1.mp3' }}>
        <LessonStageSlot /><NarrationControl segmentId="s1" locale="en-US" />
      </LessonPlayerProvider>
    </LessonStageProvider>);
    afterIntro();
    expect(state()).toBe('idle');
    fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
    expect(state()).toBe('speaking');
    act(() => { played[0]?.onended?.(); });
    expect(state()).toBe('idle');
  });

  it('encourages while the guided-review offer is open beside the lesson (the offer is the lesson layer\'s sibling of the board)', () => {
    const lesson = <LessonStageProvider stage={STAGE} ageBand="6-9" theme="light"><LessonStageSlot /></LessonStageProvider>;
    const view = render(<LessonStageRequestHost>{lesson}
      <GuidedReviewOffer offer={OFFER} locale="en-US" register="young" dark={false} onReview={() => {}} onDecline={() => {}} />
    </LessonStageRequestHost>);
    expect(state()).toBe('encouraging');
    view.rerender(<LessonStageRequestHost>{lesson}</LessonStageRequestHost>);
    afterIntro();
    expect(state()).toBe('idle');
  });

  it('counts requests, so one requester leaving never cancels another', () => {
    const view = render(<LessonStageProvider stage={STAGE} ageBand="6-9" theme="light">
      <LessonStageSlot /><Requester request="demonstrating" /><Requester request="demonstrating" />
    </LessonStageProvider>);
    afterIntro();
    view.rerender(<LessonStageProvider stage={STAGE} ageBand="6-9" theme="light">
      <LessonStageSlot /><Requester request="demonstrating" /><Requester request="demonstrating" on={false} />
    </LessonStageProvider>);
    expect(state()).toBe('demonstrating');
  });
});
