import { describe, expect, it } from 'vitest';
import manifest from '../../assets/manifest.json';
import { MENTOR_CHARACTERS } from '../../design/assets';
import { findStageStills } from '../stageStills';

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

  it('shows the full stage the character standing on its Diorama, and reports the pose it shows', () => {
    for (const character of MENTOR_CHARACTERS) for (const theme of ['light', 'dark'] as const) {
      const set = findStageStills({ character, poseId: 'think.ponder', theme, size: 'full', band: 'young' })!;
      expect(set.base.path).toBe(`/rebuild/mentor-chooser/${character}-${theme}.png`);
      expect(set.base.fit).toBe('cover');
      // It shows the idle pose, not the requested one: the stage exposes that rather than claiming the state.
      expect(set.base.poseId).toBe('ambient.idle');
    }
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
