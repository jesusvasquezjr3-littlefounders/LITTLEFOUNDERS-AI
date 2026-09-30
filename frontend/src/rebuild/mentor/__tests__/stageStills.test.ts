import { describe, expect, it } from 'vitest';
import manifest from '../../assets/manifest.json';
import { MENTOR_CHARACTERS } from '../../design/assets';
import { findStageSequence, findStageStills, STAGE_SEQUENCE_SLOT, STAGE_STILL_SLOT, stageStillId } from '../stageStills';
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

  it('uses the lesson band stills in the requested pose, with the square for the wide layout (GAP-FIX-R2)', () => {
    const young = findStageStills({ character: 'dina', poseId: 'ambient.idle', theme: 'light', size: 'compact', band: 'young' })!;
    expect(young.base.path).toBe('/rebuild/mentor-stills/dina-young-ambient-idle-light.png');
    expect(young.base.fit).toBe('cover');
    expect(young.square?.path).toBe('/rebuild/mentor-stills/dina-square-ambient-idle-light.png');
    const teen = findStageStills({ character: 'dina', poseId: 'ambient.idle', theme: 'dark', size: 'compact', band: 'teen' })!;
    expect(teen.base.path).toBe('/rebuild/mentor-stills/dina-teen-ambient-idle-dark.png');
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

  it('never falls back to the avatar head crop in the compact band: every character has its Diorama band still (GAP-FIX-R2)', () => {
    const set = findStageStills({ character: 'rho', poseId: 'think.ponder', theme: 'dark', size: 'compact', band: 'young' })!;
    expect(set.base.path).toBe('/rebuild/mentor-stills/rho-young-think-ponder-dark.png');
    expect(set.base.fit).toBe('cover');
    expect(set.base.poseId).toBe('think.ponder');
  });

  it('refuses anything that is not one of the four characters', () => {
    expect(findStageStills({ character: 'mickey' as never, poseId: 'ambient.idle', theme: 'light', size: 'full', band: 'young' })).toBeNull();
  });
});

/*
 * GAP-FIX-R2 (Bible 08 §7, §11; 07 §4; B.8; 02 rule 21): every character's
 * compact lesson band has its own real-model stills on its Diorama, per band
 * shape, pose and colour mode, so the fallback keeps the band's layout and
 * shows the state the stage is in; never an avatar head crop.
 */
describe('findStageStills: the compact lesson band', () => {
  it.each(MENTOR_CHARACTERS)('serves %s its own band still, in the requested pose, with a square for the wide layout', (character) => {
    for (const theme of ['light', 'dark'] as const) {
      const young = findStageStills({ character, poseId: 'think.ponder', theme, size: 'compact', band: 'young' })!;
      expect(young.base).toMatchObject({ id: `lesson.${character}.young.think.ponder.${theme}`, poseId: 'think.ponder', fit: 'cover' });
      expect(young.square).toMatchObject({ id: `lesson.${character}.square.think.ponder.${theme}`, poseId: 'think.ponder' });
      const teen = findStageStills({ character, poseId: 'greet.nod', theme, size: 'compact', band: 'teen' })!;
      expect(teen.base.id).toBe(`lesson.${character}.teen.greet.nod.${theme}`);
      expect(teen.base.path).toMatch(new RegExp(`^/rebuild/mentor-stills/${character}-teen-greet-nod-${theme}\.png$`));
    }
  });

  it('falls back to the same band in the idle pose, never to the avatar head crop', () => {
    const still = findStageStills({ character: 'zara', poseId: 'celebrate.with', theme: 'light', size: 'compact', band: 'young' })!;
    expect(still.base).toMatchObject({ id: 'lesson.zara.young.ambient.idle.light', poseId: 'ambient.idle', fit: 'cover' });
  });

  it('covers every compact-stage state, including acknowledging, for both registers', () => {
    const young = ['ambient.idle', 'think.ponder', 'ambient.idle.happy', 'feedback.retry.gentle', 'teach.explain', 'feedback.correct.quiet'];
    const teen = ['ambient.idle', 'teach.aside', 'ambient.idle.happy', 'ambient.listen', 'teach.explain', 'greet.nod'];
    for (const character of MENTOR_CHARACTERS) {
      for (const pose of young) expect(findStageStills({ character, poseId: pose, theme: 'dark', size: 'compact', band: 'young' })!.base.poseId).toBe(pose);
      for (const pose of teen) expect(findStageStills({ character, poseId: pose, theme: 'dark', size: 'compact', band: 'teen' })!.base.poseId).toBe(pose);
    }
  });
});

describe('findStageStills: the full stage acknowledging state (08 §11)', () => {
  it.each(MENTOR_CHARACTERS)('has %s\'s quiet-happy and nod stills', (character) => {
    for (const pose of ['feedback.correct.quiet', 'greet.nod']) {
      const still = findStageStills({ character, poseId: pose, theme: 'light', size: 'full', band: 'young' })!;
      expect(still.base).toMatchObject({ id: `mentor.${character}.stage.${pose}.light`, poseId: pose, fit: 'cover' });
    }
  });

  it('GAP-FIX-R5 (08 §11): the compact band has a still of every state a lesson can request, in its register, for every character', () => {
    const lessonStates = ['idle', 'speaking', 'demonstrating', 'encouraging', 'acknowledging'] as const;
    for (const character of MENTOR_CHARACTERS) for (const theme of ['light', 'dark'] as const) {
      for (const [band, ageBand] of [['young', '6-9'], ['teen', '13-17']] as const) {
        for (const state of lessonStates) {
          const { pose } = resolveMentorPose({ state, ageBand });
          const set = findStageStills({ character, poseId: pose.id, theme, size: 'compact', band });
          expect(set?.base.poseId, `${character} ${theme} ${band} ${state}`).toBe(pose.id);
        }
      }
    }
  });
});

describe('stage sequences (gap-fix round 8, 08 §7, 07 §5)', () => {
  const rows = (manifest as { id: string; slot: string; type: string; character?: string; poseId?: string; modes: string; endFrame?: string }[])
    .filter((row) => row.slot === STAGE_SEQUENCE_SLOT);

  it('offers every registered sequence, each ending on the still of the same character, pose and mode', () => {
    for (const row of rows) {
      const theme = row.modes as 'light' | 'dark';
      const sequence = findStageSequence(row.character as (typeof MENTOR_CHARACTERS)[number], row.poseId!, theme);
      expect(sequence?.id, row.id).toBe(row.id);
      expect(sequence?.endFrame).toBe(stageStillId(row.character as (typeof MENTOR_CHARACTERS)[number], row.poseId!, theme));
      expect(row.type).toBe('sequence');
    }
  });

  it('never offers a sequence into idle: idle is a still', () => {
    for (const character of MENTOR_CHARACTERS) for (const theme of ['light', 'dark'] as const) {
      expect(findStageSequence(character, 'ambient.idle', theme)).toBeNull();
    }
  });
});
