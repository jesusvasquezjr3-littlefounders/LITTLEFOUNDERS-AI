import type { Frame } from './rig';

/*
 * The faces an avatar can hold, and the gestures it can make. Each expression is a set of targets for the rig; the
 * avatar springs toward them with a little overshoot, so a change reads as a reaction and not as a switch.
 *
 * They are built from the muscles that make a face read (brows and the line between them, the lids and the white of
 * the eye, the nose, the corners of the mouth, the cheeks) plus what the head does: tilting, turning away, leaning in,
 * rearing back. Values are in the units of `Frame` (rig.ts); only what differs from neutral is listed.
 */
export const EXPRESSIONS = {
  neutral: {},
  happy: { smile: 0.8, mouthOpen: 0.25, cheek: 0.6, eyeOpenL: 0.88, eyeOpenR: 0.88, browLiftL: 0.3, browLiftR: 0.3, tilt: 2 },
  laughing: { smile: 1, mouthOpen: 0.85, mouthWide: 1.12, cheek: 1, eyeOpenL: 0.5, eyeOpenR: 0.5, browLiftL: 0.5, browLiftR: 0.5, tilt: 4, lift: 0.8 },
  excited: { smile: 0.9, mouthOpen: 0.55, cheek: 0.6, eyeOpenL: 1.18, eyeOpenR: 1.18, pupil: 1.2, browLiftL: 0.8, browLiftR: 0.8, lean: 0.45, tilt: 3 },
  surprised: { browLiftL: 1, browLiftR: 1, eyeOpenL: 1.32, eyeOpenR: 1.32, pupil: 0.8, mouthOpen: 0.7, pucker: 0.6, lean: 0.3, lift: 0.3 },
  scared: { browLiftL: 0.8, browLiftR: 0.8, browTiltL: -0.6, browTiltR: -0.6, eyeOpenL: 1.26, eyeOpenR: 1.26, pupil: 0.62, mouthOpen: 0.5, mouthWide: 0.85, smile: -0.3, tilt: -3, lift: -0.2, turn: -0.2 },
  angry: { browSqueeze: 0.9, browTiltL: 0.95, browTiltR: 0.95, browLiftL: -0.4, browLiftR: -0.4, eyeOpenL: 0.76, eyeOpenR: 0.76, eyeTilt: 0.9, pupil: 0.85, press: 0.7, smile: -0.5, noseWrinkle: 0.55, cheek: 0.35, lean: 0.35 },
  disgusted: { noseWrinkle: 1, browSqueeze: 0.6, browTiltL: 0.5, browTiltR: 0.5, eyeOpenL: 0.7, eyeOpenR: 0.7, smile: -0.7, mouthOpen: 0.2, mouthWide: 0.8, tilt: -4, lift: 0.4, turn: 0.35 },
  sad: { browTiltL: -0.9, browTiltR: -0.9, browLiftL: 0.1, browLiftR: 0.1, eyeOpenL: 0.82, eyeOpenR: 0.82, eyeTilt: -0.7, smile: -0.85, mouthWide: 0.9, tilt: -4, lift: -0.5, lookY: 0.35 },
  worried: { browTiltL: -0.7, browTiltR: -0.7, browLiftL: 0.6, browLiftR: 0.6, eyeOpenL: 1.05, eyeOpenR: 1.05, smile: -0.35, press: 0.3, mouthOpen: 0.05, tilt: -3 },
  doubtful: { browLiftL: 0.9, browLiftR: -0.4, browTiltR: 0.5, eyeOpenL: 1.06, eyeOpenR: 0.8, smirk: -0.7, smile: -0.1, mouthWide: 0.9, tilt: 5, lookX: 0.5, lookY: -0.2, turn: 0.25 },
  thinking: { browLiftL: 0.6, browLiftR: 0.1, browTiltR: 0.3, eyeOpenL: 0.95, eyeOpenR: 0.95, press: 0.4, mouthWide: 0.8, tilt: -4, lookX: -0.5, lookY: -0.6, turn: -0.25 },
  confused: { browLiftL: 0.6, browLiftR: 0.6, browTiltL: -0.5, browTiltR: 0.5, eyeOpenL: 1.05, eyeOpenR: 1.05, smirk: 0.5, smile: -0.2, mouthOpen: 0.1, pucker: 0.2, tilt: -5, lookX: 0.3 },
  proud: { smile: 0.6, smirk: 0.3, browLiftL: 0.4, browLiftR: 0.4, eyeOpenL: 0.85, eyeOpenR: 0.85, cheek: 0.4, lift: 0.6, tilt: 2 },
  smug: { smirk: 0.9, smile: 0.3, browLiftL: 0.5, eyeOpenL: 0.72, eyeOpenR: 0.72, tilt: 3, lift: 0.3, turn: 0.15 },
  shy: { smile: 0.4, cheek: 1.2, eyeOpenL: 0.9, eyeOpenR: 0.9, lookY: 0.7, lookX: 0.35, browTiltL: -0.4, browTiltR: -0.4, tilt: 5, lift: -0.3, turn: 0.3 },
  sleepy: { eyeOpenL: 0.35, eyeOpenR: 0.35, browLiftL: -0.3, browLiftR: -0.3, mouthOpen: 0.12, smile: -0.1, tilt: 4, lift: -0.4 },
  encouraging: { smile: 0.6, mouthOpen: 0.2, browLiftL: 0.5, browLiftR: 0.5, eyeOpenL: 0.92, eyeOpenR: 0.92, tilt: 3, cheek: 0.4, lean: 0.15 },
  wink: { eyeOpenR: 0.06, smirk: 0.5, smile: 0.6, mouthOpen: 0.15, cheek: 0.5, tilt: -3, browLiftR: -0.3 },
} as const satisfies Record<string, Partial<Frame>>;

export type ExpressionName = keyof typeof EXPRESSIONS;

export const EXPRESSION_NAMES = [
  'neutral', 'happy', 'laughing', 'excited', 'surprised', 'scared', 'angry', 'disgusted', 'sad', 'worried',
  'doubtful', 'thinking', 'confused', 'proud', 'smug', 'shy', 'sleepy', 'encouraging', 'wink',
] as const satisfies readonly ExpressionName[];

export interface Gesture {
  /** Seconds. */
  duration: number;
  /** What the gesture adds to the frame at progress `p`, from 0 to 1. */
  at: (p: number) => Partial<Frame>;
}

const pulse = (p: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, p)));

const fade = (p: number) => 1 - Math.min(1, Math.max(0, p));

/** Short movements that play over whatever face is held and then hand back to it. */
export const GESTURES = {
  nod: { duration: 0.55, at: (p) => ({ nod: pulse(p) }) },
  nodTwice: { duration: 0.95, at: (p) => ({ nod: Math.abs(Math.sin(p * Math.PI * 2)) * fade(p * 0.6) }) },
  shake: { duration: 0.9, at: (p) => ({ turn: Math.sin(p * Math.PI * 5) * 0.55 * fade(p), tilt: Math.sin(p * Math.PI * 5) * 2 * fade(p) }) },
  blink: { duration: 0.22, at: (p) => ({ blinkL: pulse(p), blinkR: pulse(p) }) },
  wink: { duration: 0.5, at: (p) => ({ blinkR: pulse(Math.min(1, p * 1.2)), smile: pulse(p) * 0.4, cheek: pulse(p) * 0.4, tilt: -pulse(p) * 3 }) },
  wiggle: { duration: 0.8, at: (p) => ({ tilt: Math.sin(p * Math.PI * 4) * 5 * fade(p) }) },
  jump: { duration: 0.6, at: (p) => ({ bounce: pulse(p), browLiftL: pulse(p) * 0.6, browLiftR: pulse(p) * 0.6 }) },
  leanIn: { duration: 0.9, at: (p) => ({ lean: pulse(p), browLiftL: pulse(p) * 0.4, browLiftR: pulse(p) * 0.4 }) },
  curious: { duration: 1.2, at: (p) => ({ tilt: pulse(p) * 8, browLiftL: pulse(p) * 0.7, browTiltR: pulse(p) * 0.4, lookX: pulse(p) * 0.4 }) },
  shrug: { duration: 0.9, at: (p) => ({ lift: pulse(p) * 0.6, browLiftL: pulse(p) * 0.7, browLiftR: pulse(p) * 0.7, smile: -pulse(p) * 0.3, tilt: pulse(p) * 3, bounce: pulse(p) * 0.3 }) },
  flinch: { duration: 0.5, at: (p) => ({ lean: -pulse(p) * 0.8, eyeOpenL: pulse(p) * 0.3, eyeOpenR: pulse(p) * 0.3, browLiftL: pulse(p), browLiftR: pulse(p), blinkL: pulse(Math.min(1, p * 2)) * 0.5, blinkR: pulse(Math.min(1, p * 2)) * 0.5 }) },
  giggle: { duration: 0.9, at: (p) => ({ bounce: Math.abs(Math.sin(p * Math.PI * 4)) * 0.4 * fade(p), smile: pulse(p) * 0.5, mouthOpen: pulse(p) * 0.4, cheek: pulse(p) * 0.8, eyeOpenL: -pulse(p) * 0.3, eyeOpenR: -pulse(p) * 0.3 }) },
} as const satisfies Record<string, Gesture>;

export type GestureName = keyof typeof GESTURES;

export const GESTURE_NAMES = ['nod', 'nodTwice', 'shake', 'blink', 'wink', 'wiggle', 'jump', 'leanIn', 'curious', 'shrug', 'flinch', 'giggle'] as const satisfies readonly GestureName[];
