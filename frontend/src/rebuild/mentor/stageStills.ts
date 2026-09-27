import manifest from '../assets/manifest.json';
import { MENTOR_CHARACTERS, type MentorCharacter } from '../design/assets';

/*
 * The pre-rendered stills the Mentor stage shows while the live model loads,
 * and instead of it on a low-power device, without WebGL or with data saver on
 * (Frontend Bible 08 §7, 07 §4). A still is only ever a manifest-registered
 * render of the SAME character's real model in a catalogue pose; there is no
 * letter, glyph or look-alike fallback (02 rule 21). When a character has no
 * still, the stage shows its empty scene colour and says so (`onError`).
 *
 * Preference order for one request:
 *   1. a stage still of this character in the requested pose (`mentor.stageStill`);
 *   2. for the compact lesson stage, the character's lesson band still (`lesson.compactMentorStill`);
 *   3. for the full stage, the character standing on its Diorama (`mentor.chooserStill`, the idle pose);
 *   4. the character's avatar render (`mentor.avatar`: the idle pose, square, transparent).
 * The pose the still actually shows is returned, so the stage can expose it
 * (`data-still-pose`) and never claim a state it is not showing.
 */

interface StillRow {
  id: string; class: string; type: string; path: string; slot: string; aspect?: string; modes: string;
  character?: string; poseId?: string; sourceModel?: string; reviewStatus: string;
}

export const STAGE_STILL_SLOT = 'mentor.stageStill';
export const LESSON_STILL_SLOT = 'lesson.compactMentorStill';
export const AVATAR_SLOT = 'mentor.avatar';
export const CHOOSER_STILL_SLOT = 'mentor.chooserStill';

export interface StageStill {
  id: string;
  path: string;
  poseId: string;
  /** How the image fills the stage: a scene still covers it, a transparent avatar sits inside it. */
  fit: 'cover' | 'contain';
}

export interface StageStillSet {
  /** The still for the phone band or the full stage. */
  base: StageStill;
  /** A square variant for the compact stage's wide (side column) layout, when one exists. */
  square: StageStill | null;
}

const rows = (manifest as readonly StillRow[]).filter((row) => row.class === 'B' && row.type === 'render' && row.reviewStatus !== 'retired');

function isRealRender(row: StillRow, character: MentorCharacter): boolean {
  return row.character === character && row.sourceModel === `/scenes/${character}.glb` && typeof row.poseId === 'string' && row.poseId.length > 0;
}

function pick(slot: string, character: MentorCharacter, theme: 'light' | 'dark', test: (row: StillRow) => boolean = () => true): StillRow | null {
  return rows.find((row) => row.slot === slot && isRealRender(row, character) && (row.modes === theme || row.modes === 'both') && test(row)) ?? null;
}

const still = (row: StillRow, fit: StageStill['fit']): StageStill => ({ id: row.id, path: row.path, poseId: row.poseId as string, fit });

/**
 * The stills for one character, pose, colour mode and stage size, or null when
 * the manifest holds no render of that character at all.
 */
export function findStageStills({ character, poseId, theme, size, band }: {
  character: MentorCharacter;
  poseId: string;
  theme: 'light' | 'dark';
  size: 'full' | 'compact';
  /** The compact band variant: the young band is taller than the teen one (B.23). */
  band: 'young' | 'teen';
}): StageStillSet | null {
  if (!MENTOR_CHARACTERS.includes(character)) return null;
  const exact = pick(STAGE_STILL_SLOT, character, theme, (row) => row.poseId === poseId);
  if (exact) return { base: still(exact, 'cover'), square: null };
  // The lesson band stills (scene included, per band and mode). Only Dina's are authored so far; another
  // character's band stills join here when they are rendered and registered.
  if (size === 'compact' && character === 'dina') {
    const bandRow = pick(LESSON_STILL_SLOT, character, theme, (row) => row.id === `lesson.dina.${band}.${theme}`);
    if (bandRow) {
      const square = pick(LESSON_STILL_SLOT, character, theme, (row) => row.id === `lesson.dina.square.${theme}`);
      return { base: still(bandRow, 'cover'), square: square ? still(square, 'cover') : null };
    }
  }
  // The full stage: the character standing on its Diorama (the chooser's render, W2M.3) before the avatar's head crop,
  // which read as a very large head on a full-size stage. It shows the idle pose, on the Diorama it was rendered on.
  if (size === 'full') {
    const scene = pick(CHOOSER_STILL_SLOT, character, theme, (row) => row.id === `mentor.${character}.chooser.${theme}`);
    if (scene) return { base: still(scene, 'cover'), square: null };
  }
  const avatar = pick(AVATAR_SLOT, character, theme);
  return avatar ? { base: still(avatar, 'contain'), square: null } : null;
}


/**
 * The chooser's picture of one character (08 §8: the four real characters on
 * the Diorama): a render of the character's real model standing on its
 * Diorama, per colour mode, or null when none is registered (the chooser then
 * shows the character's avatar render; never a stand-in).
 */
export function findChooserStill(character: MentorCharacter, theme: 'light' | 'dark'): StageStill | null {
  if (!MENTOR_CHARACTERS.includes(character)) return null;
  const row = pick(CHOOSER_STILL_SLOT, character, theme, (entry) => entry.id === `mentor.${character}.chooser.${theme}`);
  return row ? still(row, 'cover') : null;
}
