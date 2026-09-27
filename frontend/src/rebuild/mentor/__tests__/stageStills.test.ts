import { describe, expect, it } from 'vitest';
import manifest from '../../assets/manifest.json';
import { MENTOR_CHARACTERS } from '../../design/assets';
import { findStageStills, STAGE_STILL_SLOT, stageStillId } from '../stageStills';
import { CLOSING_SCRIPTS, MENTOR_STAGE_STATES, resolveMentorPose } from '../stageStates';

/** The catalogue poses the full stage can play (`stageStates.ts`), each with its own still (render-mentor-stage-stills.mjs). */
const FULL_STAGE_POSES = [
  'ambient.idle', 'ambient.listen', 'think.ponder', 'teach.aside', 'ambient.idle.happy', 'teach.explain', 'feedback.retry.gentle',
  'celebrate.with', 'celebrate.applaud', 'transition.close.warm', 'transition.exit', 'transition.pause',
];

type Row = { id: string; path: string; character?: string; poseId?: string; sourceModel?: string; slot: string };
const rows = manifest as unknown as Row[];

describe('Mentor stage stills (Frontend Bible 08 §7, 07 §4)', () => {
  it('has a real-model still of every character in both colour modes, at both sizes', () => {
    for (const character of MENTOR_CHARACTERS) for (const theme of ['light', 'dark'] as const) for (const size of ['full', 'compact'] as const) {
      const set = findStageStills({ character, poseId: 'ambient.idle', theme, size, band: 'young' });
      expect(set, `${character} ${theme} ${size}`).not.toBeNull();
      const row = rows.find((entry) => entry.id === set!.base.id)!;
      // Only ever the same character's own model, in a catalogue pose (02 rule 21).
      expect(row.character).toBe(character);
      expect(row.sourceModel).toBe(`/scenes/${character}.glb`);
      expect(row.poseId).toBe(set!.base.poseId);
      expect(row.path).toBe(set!.base.path);
    }
  });

  it('uses the lesson band stills where they exist, with the square for the wide layout', () => {
    const young = findStageStills({ character: 'dina', poseId: 'ambient.idle', theme: 'light', size: 'compact', band: 'young' })!;
    expect(young.base.path).toBe('/rebuild/mentor-stills/dina-young-light.png');
    expect(young.base.fit).toBe('cover');
    expect(young.square?.path).toBe('/rebuild/mentor-stills/dina-square-light.png');
    const teen = findStageStills({ character: 'dina', poseId: 'ambient.idle', theme: 'dark', size: 'compact', band: 'teen' })!;
    expect(teen.base.path).toBe('/rebuild/mentor-stills/dina-teen-dark.png');
  });

  it('W3M.1: the full stage has a still of every pose it can play, per character and colour mode (08 §7)', () => {
    for (const character of MENTOR_CHARACTERS) for (const theme of ['light', 'dark'] as const) for (const pose of FULL_STAGE_POSES) {
      const set = findStageStills({ character, poseId: pose, theme, size: 'full', band: 'young' });
      expect(set?.base.id, `${character} ${pose} ${theme}`).toBe(stageStillId(character, pose, theme));
      expect(set!.base.poseId).toBe(pose);
      expect(set!.base.fit).toBe('cover');
      const row = rows.find((entry) => entry.id === set!.base.id)!;
      expect(row.slot).toBe(STAGE_STILL_SLOT);
      expect(row.sourceModel).toBe(`/scenes/${character}.glb`);
    }
  });

  it('W3M.1: every state of 08 §3, in every register and closing, resolves to a pose with a full-stage still', () => {
    for (const state of MENTOR_STAGE_STATES) for (const ageBand of ['6-9', '10-12', '13-17', 'adult'] as const) for (const closing of CLOSING_SCRIPTS) {
      if (state === 'acknowledging') continue; // the lesson's neutral reaction (08 §11): the compact band only
      const { pose } = resolveMentorPose({ state, ageBand, closing, milestone: 'lesson-complete' });
      expect(FULL_STAGE_POSES, `${state} ${ageBand} ${closing}`).toContain(pose.id);
    }
  });

  it('keeps the per-pose stills off the compact lesson band, which has its own band-shaped stills', () => {
    const set = findStageStills({ character: 'rho', poseId: 'think.ponder', theme: 'light', size: 'compact', band: 'young' })!;
    expect(set.base.id).not.toBe(stageStillId('rho', 'think.ponder', 'light'));
  });

  it('falls back to the transparent avatar render in the compact band, contained on the scene colour', () => {
    const set = findStageStills({ character: 'rho', poseId: 'think.ponder', theme: 'dark', size: 'compact', band: 'young' })!;
    expect(set.base.path).toBe('/rebuild/mentor-avatars/rho-dark.png');
    expect(set.base.fit).toBe('contain');
    expect(set.base.poseId).toBe('ambient.idle');
  });

  it('refuses anything that is not one of the four characters', () => {
    expect(findStageStills({ character: 'mickey' as never, poseId: 'ambient.idle', theme: 'light', size: 'full', band: 'young' })).toBeNull();
  });
});
