// Character Control — the emotion/action vocabulary the 3D character layer and
// the pose catalogue speak for the four Mentor characters (LESSON_ENGINE.md §9).
// A character is only ever drawn from its real 3D model or a registered still of
// it (Frontend Bible 02 rule 21); the legacy 2D rig this file once mapped to is gone.

export const CHARACTER_IDS = ['dina', 'liruf', 'rho', 'zara'] as const
export type CharacterId = (typeof CHARACTER_IDS)[number]

export const CHARACTER_EMOTIONS = [
  'neutral',
  'happy',
  'excited',
  'thinking',
  'surprised',
  'encouraging',
  'proud',
] as const
export type CharacterEmotion = (typeof CHARACTER_EMOTIONS)[number]

export const CHARACTER_ACTIONS = [
  'idle',
  'jump',
  'hop',
  'wave',
  'point',
  'celebrate',
  'nod',
  'shake',
  'think',
  'dance',
  'peek',
  'bow',
] as const
export type CharacterAction = (typeof CHARACTER_ACTIONS)[number]

/**
 * Actions a catalogue pose may loop (`poseLibrary.ts` `loop`): the actions every
 * renderer and capture path loops, pinned against the 3D layer's own table.
 */
export const LOOPABLE_ACTIONS: ReadonlySet<CharacterAction> = new Set(['celebrate', 'dance'])
