import type { CharacterAction, CharacterEmotion, CharacterId } from './vocabulary';
import ROLEPLAY_VOICES from './roleplayVoices.generated.json';

/*
 * Class III `roleplay` (TUTOR_INSTRUMENTS.md §3.4): a short scene two
 * characters act out while the learner watches, then decides something
 * themselves. The model names a scene BY ID (`turn.roleplayScene`); it never
 * writes the lines. Oracle's `oracle/src/tutor/roleplayScenes.ts` holds what
 * each beat SAYS (and what its pre-generated voice clips say); this table
 * holds how each beat is ACTED (who speaks, the catalogue emotion and action,
 * how long it holds). The rebuilt captions live in `rebuild-mentor.json`
 * `mentorRoleplay.scenes.<id>.beats`, one per beat, in order.
 *
 * `npm run roleplay-voices:check` (agent/tools/check-roleplay-voice-parity.mjs)
 * keeps the three agreeing: the speakers here against Oracle's, and every
 * rebuilt caption's words against the words Oracle's clip speaks (punctuation
 * may differ: the rebuilt copy follows the Copy Budget's style, an em dash
 * becomes a comma, the voice says the same words).
 *
 * The voice clips were generated once, ahead of time (`roleplayVoices.generated.json`,
 * written by `npm run roleplay-voices:generate`): playing a scene calls no
 * provider and spends nothing (OD-23). A clip that does not resolve is silent,
 * never a stand-in: the caption still carries the line.
 */

export interface RoleplayBeat {
  speaker: 'lead' | 'companion';
  emotion: CharacterEmotion;
  action: CharacterAction;
  /** How long the beat holds without a clip; with a clip, the clip's end moves the scene on. */
  durationMs: number;
}

const LEMONADE_CHANGE: readonly RoleplayBeat[] = [
  { speaker: 'companion', emotion: 'happy', action: 'wave', durationMs: 2600 },
  { speaker: 'lead', emotion: 'neutral', action: 'point', durationMs: 2600 },
  { speaker: 'companion', emotion: 'thinking', action: 'think', durationMs: 2800 },
  { speaker: 'lead', emotion: 'encouraging', action: 'nod', durationMs: 2600 },
];

/** The closed set of scenes Oracle may name (`ROLEPLAY_SCENE_IDS` in `oracle/src/tutor/turnSchema.ts`). */
export const ROLEPLAY_BEATS = { lemonade_change: LEMONADE_CHANGE } as const satisfies Readonly<Record<string, readonly RoleplayBeat[]>>;
export type RoleplaySceneId = keyof typeof ROLEPLAY_BEATS;

export function isRoleplayScene(value: unknown): value is RoleplaySceneId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ROLEPLAY_BEATS, value);
}

type VoiceManifest = Record<string, Record<string, Record<string, Record<string, string>>>>;

/** The pre-generated clip of one beat in one character's voice, or null (silent). */
export function roleplayClip(scene: RoleplaySceneId, beat: number, character: CharacterId | null, locale: string): string | null {
  if (!character) return null;
  const voices = (ROLEPLAY_VOICES as { voices: VoiceManifest }).voices;
  return voices[scene]?.[String(beat)]?.[character]?.[locale] ?? null;
}
