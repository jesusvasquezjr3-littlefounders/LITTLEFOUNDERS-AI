import { describe, expect, it } from 'vitest';
import type { AgeBand } from '../../design/copyBudget';
import { MILESTONES } from '../../design/milestones';
import en from '../../../i18n/en-US/rebuild-mentor.json';
import es from '../../../i18n/es-MX/rebuild-mentor.json';
import pt from '../../../i18n/pt-BR/rebuild-mentor.json';
import {
  animationLevelFor, CLOSING_SCRIPTS, lessonStateFor, MENTOR_STAGE_POSES, MENTOR_STAGE_STATES, resolveMentorPose,
} from '../stageStates';

const BANDS: AgeBand[] = ['6-9', '10-12', '13-17', 'adult'];

describe('Mentor stage states (Frontend Bible 08 §3)', () => {
  it('names the eight states of 08 §3 and the lesson reaction of 08 §11, nothing else', () => {
    expect([...MENTOR_STAGE_STATES]).toEqual([
      'idle', 'listening', 'thinking', 'speaking', 'demonstrating', 'encouraging', 'celebrating', 'closing', 'acknowledging',
    ]);
  });

  it('names every state in all three locales, for the accessible name of the stage', () => {
    for (const copy of [en, es, pt]) expect(Object.keys(copy.mentorStage.states).sort()).toEqual([...MENTOR_STAGE_STATES].sort());
  });

  it('maps every state to a catalogue pose for every age band', () => {
    for (const ageBand of BANDS) for (const state of MENTOR_STAGE_STATES) {
      const { pose } = resolveMentorPose({ state, ageBand, milestone: 'lesson-complete' });
      expect(MENTOR_STAGE_POSES, `${ageBand} ${state}`).toContainEqual(pose);
    }
  });

  it('reads the animation level from the register policy (B.23)', () => {
    expect(BANDS.map(animationLevelFor)).toEqual(['lively', 'moderate', 'calm', 'calm']);
  });

  it('thinks with a thinking pose, never with typing dots', () => {
    for (const ageBand of BANDS) expect(resolveMentorPose({ state: 'thinking', ageBand }).pose.emotion).toBe('thinking');
  });

  it('points toward the board while demonstrating', () => {
    for (const ageBand of BANDS) expect(resolveMentorPose({ state: 'demonstrating', ageBand }).pose.action).toBe('point');
  });

  it('encourages warmly and never shows disappointment (B.26)', () => {
    for (const ageBand of BANDS) {
      const { pose } = resolveMentorPose({ state: 'encouraging', ageBand });
      expect(pose.emotion).toBe('encouraging');
      expect(['shake', 'celebrate', 'dance', 'jump']).not.toContain(pose.action);
    }
  });

  it('keeps a teen or adult Mentor calmer: no looping thought, no gesture for a miss, no celebrate loop (08 §9)', () => {
    for (const ageBand of ['13-17', 'adult'] as const) {
      expect(resolveMentorPose({ state: 'thinking', ageBand }).pose.action).toBe('idle');
      expect(resolveMentorPose({ state: 'encouraging', ageBand }).pose.action).toBe('idle');
      expect(resolveMentorPose({ state: 'celebrating', ageBand, milestone: 'badge-earned' }).pose.action).not.toBe('celebrate');
    }
  });

  it('celebrates only for a D7 milestone, and shows idle rather than a fake celebration otherwise (OD-7)', () => {
    for (const ageBand of BANDS) {
      for (const milestone of MILESTONES) {
        expect(resolveMentorPose({ state: 'celebrating', ageBand, milestone }).state).toBe('celebrating');
      }
      for (const milestone of [null, undefined, 'correct-answer', 'streak-8'] as never[]) {
        const refused = resolveMentorPose({ state: 'celebrating', ageBand, milestone });
        expect(refused.state).toBe('idle');
        expect(refused.pose.id).toBe('ambient.idle');
      }
    }
  });

  it('never plays a celebration pose from any state but a milestone celebration', () => {
    const celebrationIds = new Set(['celebrate.with', 'celebrate.applaud']);
    for (const ageBand of BANDS) for (const state of MENTOR_STAGE_STATES) {
      if (state === 'celebrating') continue;
      const { pose } = resolveMentorPose({ state, ageBand });
      expect(celebrationIds.has(pose.id), `${ageBand} ${state}`).toBe(false);
      expect(pose.action, `${ageBand} ${state}`).not.toBe('celebrate');
    }
  });

  it('closes with a gesture matched to how the session ended (C.16)', () => {
    const closing = Object.fromEntries(CLOSING_SCRIPTS.map((script) => [script, resolveMentorPose({ state: 'closing', ageBand: '6-9', closing: script }).pose.id]));
    expect(closing).toEqual({
      completed: 'transition.close.warm', interrupted: 'transition.exit', learner_left: 'transition.exit', safety_stop: 'transition.pause',
    });
    // A safety stop is calm: no praise, no warmth performed at the learner.
    expect(resolveMentorPose({ state: 'closing', ageBand: '6-9', closing: 'safety_stop' }).pose.emotion).toBe('neutral');
    // An unknown script is treated as a completed session, never as a crash.
    expect(resolveMentorPose({ state: 'closing', ageBand: '6-9', closing: 'mystery' as never }).pose.id).toBe('transition.close.warm');
    expect(resolveMentorPose({ state: 'closing', ageBand: '6-9' }).pose.id).toBe('transition.close.warm');
  });

  it('reacts to a lesson verdict with encouragement or a neutral acknowledgment, never a celebration (08 §11)', () => {
    expect(lessonStateFor(null)).toBe('idle');
    expect(lessonStateFor('met')).toBe('acknowledging');
    for (const miss of ['review', 'incomplete', 'invalid'] as const) expect(lessonStateFor(miss)).toBe('encouraging');
  });
});
