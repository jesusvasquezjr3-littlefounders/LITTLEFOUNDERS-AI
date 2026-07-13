// Character Control — unified emotion/action vocabulary over the four canonical
// characters (LESSON_ENGINE.md §9). Appearance is NON-NEGOTIABLE: this layer only
// maps to each character's existing prop surface and adds wrapper/rig animation.

export const CHARACTER_IDS = ['dina', 'dino', 'rho', 'zara'] as const
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

/** Native prop mapping. Each character keeps its own union — we translate. */
export const EMOTION_TO_NATIVE = {
  dina: {
    neutral: 'neutral',
    happy: 'happy',
    excited: 'happy',
    thinking: 'neutral',
    surprised: 'surprised',
    encouraging: 'wink',
    proud: 'happy',
  },
  dino: {
    neutral: 'happy',
    happy: 'happy',
    excited: 'excited',
    thinking: 'thinking',
    surprised: 'shocked',
    encouraging: 'happy',
    proud: 'excited',
  },
  rho: {
    neutral: 'neutral',
    happy: 'wise',
    excited: 'explaining',
    thinking: 'mysterious',
    surprised: 'surprised',
    encouraging: 'explaining',
    proud: 'wise',
  },
  zara: {
    neutral: 'neutral',
    happy: 'happy',
    excited: 'excited',
    thinking: 'curious',
    surprised: 'curious',
    encouraging: 'happy',
    proud: 'flirty',
  },
} as const satisfies Record<CharacterId, Record<CharacterEmotion, string>>

/** One-shot action durations (ms) — the actor auto-returns to idle after these. */
export const ACTION_DURATION_MS: Record<CharacterAction, number> = {
  idle: 0,
  jump: 700,
  hop: 500,
  wave: 900,
  point: 800,
  celebrate: 1100,
  nod: 600,
  shake: 600,
  think: 1000,
  dance: 1200,
  peek: 900,
  bow: 900,
}

/** Actions that may loop while a celebration overlay is up. */
export const LOOPABLE_ACTIONS: ReadonlySet<CharacterAction> = new Set(['celebrate', 'dance'])
