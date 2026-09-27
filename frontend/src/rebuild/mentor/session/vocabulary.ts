/*
 * The character vocabulary the Mentor session speaks on the wire and hands to
 * the stage: which character, which emotion, which action, which camera shot.
 *
 * The rebuilt frontend imports nothing from the legacy UI (Frontend Bible 02
 * rule 23; `npm run spec:check`), so the unions the session logic used to take
 * from `components/characters/control/types.ts` and `tutor-scene/shots.ts` are
 * written out here. They are the SAME vocabulary, not a second one:
 * `tutor-scene/__tests__/rebuildMentorParity.test.ts` compares every list with
 * the engine's own, and the stage bridge (`MentorStage.tsx`) hands these values
 * to the renderer, so a drift in either direction fails to compile or test.
 */

/** The four Mentor characters (OD-6). The same ids as the 3D engine's `CharacterId`. */
export const CHARACTER_IDS = ['dina', 'liruf', 'rho', 'zara'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

/** The seven emotions both character renderers speak. */
export const CHARACTER_EMOTIONS = ['neutral', 'happy', 'excited', 'thinking', 'surprised', 'encouraging', 'proud'] as const;
export type CharacterEmotion = (typeof CHARACTER_EMOTIONS)[number];

/** The twelve actions both character renderers speak. */
export const CHARACTER_ACTIONS = ['idle', 'jump', 'hop', 'wave', 'point', 'celebrate', 'nod', 'shake', 'think', 'dance', 'peek', 'bow'] as const;
export type CharacterAction = (typeof CHARACTER_ACTIONS)[number];

/**
 * The camera shots the session's phases choose from: the engine's shot
 * vocabulary (`tutor-scene/shots.ts` `SHOT_IDS`), which the parity test checks.
 */
export const MENTOR_SHOTS = ['establishing', 'approach', 'closeup', 'closeup-wide', 'two-shot'] as const;
export type MentorShot = (typeof MENTOR_SHOTS)[number];
