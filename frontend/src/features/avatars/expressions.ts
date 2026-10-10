import type { Frame } from './rig';

/*
 * The named expressions an avatar can hold. Each one is a set of target values for the rig; the avatar eases toward
 * them, so changing expression is a short transition and never a jump. Expressions set the resting face: speech
 * (mouth), blinking, breathing and gaze are layered on top of it by `useAvatarMotion`.
 *
 * This is the first small catalog (docs/design/CHARACTER-AVATARS.md): enough to react to an answer, to think and to
 * encourage. A full catalog follows once these are approved on the four characters.
 */
export const EXPRESSIONS = {
  neutral: {},
  happy: { browLift: 0.35, eyeOpen: 0.9, mouthOpen: 0.3, mouthWide: 1.12, cheek: 0.5, tilt: 1.5 },
  surprised: { browLift: 1, eyeOpen: 1.14, mouthOpen: 0.75, mouthWide: 0.78, tilt: 0 },
  thinking: { browLift: 0.25, browTilt: 0.6, eyeOpen: 0.95, mouthOpen: 0.05, mouthWide: 0.85, tilt: -3, lookX: -0.45, lookY: -0.55 },
  sad: { browLift: -0.2, browTilt: -0.8, eyeOpen: 0.82, mouthOpen: 0, mouthWide: 0.9, tilt: -2, lookY: 0.3 },
  encouraging: { browLift: 0.5, eyeOpen: 0.95, mouthOpen: 0.35, mouthWide: 1.08, cheek: 0.4, tilt: 3 },
} as const satisfies Record<string, Partial<Frame>>;

export type ExpressionName = keyof typeof EXPRESSIONS;

export const EXPRESSION_NAMES = ['neutral', 'happy', 'surprised', 'thinking', 'sad', 'encouraging'] as const satisfies readonly ExpressionName[];
