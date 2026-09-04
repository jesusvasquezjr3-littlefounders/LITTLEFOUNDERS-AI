import type { CharacterAction, CharacterEmotion } from '@/components/characters/control/types';

/*
 * Class III / S17 `roleplay` (TUTOR_INSTRUMENTS.md §3.4): "Two characters act
 * a transaction with their own cloned voices while the learner decides."
 *
 * PRE-AUTHORED, not model-generated, and that is a deliberate scope decision
 * recorded here rather than a shortcut. The model picks a scene BY ID —
 * the same "id names content that exists" posture `skillKey` already has in
 * `oracle/src/tutor/prompt.ts` — never composes the two characters' lines
 * itself. Three reasons: (1) freeform dual-character dialogue would need its
 * own moderation pass PER LINE PER CHARACTER, doubling the exact per-turn
 * safety surface /ORACLE.md §7 already treats as expensive and careful;
 * (2) a small, pre-moderated catalog can be reviewed once, like the
 * `oracle/skills/moves/` markdown files already are, rather than trusted
 * live; (3) it
 * keeps roleplay's OWN turn-schema footprint to one closed enum field
 * (§4.1's "17-file tax," paid once, for a fixed id set) instead of a new
 * multi-speaker dialogue shape.
 *
 * SPOKEN AUDIO IS DELIBERATELY NOT WIRED YET. `speakLine`/`SpeechScope`
 * (oracle/src/voice/speech.ts) bind exactly one character's voice per
 * session today; giving both characters a live Inworld voice needs that
 * contract loosened AND a new paid-API cost pattern this catalog's own S17
 * acceptance bar calls out by name ("voice-second cost measured before and
 * after") — the same kind of decision `/TUTOR_INSTRUMENTS.md` §8.2's D2 got
 * explicit owner sign-off for before any DashScope spend happened. Shipping
 * this captioned, honestly, now — rather than either leaving the whole
 * capability unbuilt or spending real, unmeasured API money on my own
 * initiative — is the same call this project already made once before.
 *
 * Every line is an i18n KEY (`/AGENTS.md` §1.8 — no hardcoded user-facing
 * strings), resolved in all three locales' `tutor.json` (frontend/src/i18n/)
 * under `roleplay.scenes.<id>`.
 */

export interface RoleplayBeat {
  speaker: 'lead' | 'companion';
  /** i18n key under `tutor.json`'s `roleplay.scenes.<sceneId>.beats`. */
  textKey: string;
  emotion: CharacterEmotion;
  action: CharacterAction;
  /** How long this beat holds before the next one begins. */
  durationMs: number;
}

export interface RoleplayScene {
  id: string;
  /** i18n key for the scene's own short title, shown above the exchange. */
  titleKey: string;
  beats: readonly RoleplayBeat[];
}

const LEMONADE_CHANGE: RoleplayScene = {
  id: 'lemonade_change',
  titleKey: 'tutor.roleplay.scenes.lemonade_change.title',
  beats: [
    {
      speaker: 'companion',
      textKey: 'tutor.roleplay.scenes.lemonade_change.beat1',
      emotion: 'happy',
      action: 'wave',
      durationMs: 2600,
    },
    {
      speaker: 'lead',
      textKey: 'tutor.roleplay.scenes.lemonade_change.beat2',
      emotion: 'neutral',
      action: 'point',
      durationMs: 2600,
    },
    {
      speaker: 'companion',
      textKey: 'tutor.roleplay.scenes.lemonade_change.beat3',
      emotion: 'thinking',
      action: 'think',
      durationMs: 2800,
    },
    {
      speaker: 'lead',
      textKey: 'tutor.roleplay.scenes.lemonade_change.beat4',
      emotion: 'encouraging',
      action: 'nod',
      durationMs: 2600,
    },
  ],
};

/**
 * The full catalog, keyed by id — a small, fixed set the model may name
 * (never invent). ONE scene to start, matching this session's "coarse but
 * real" posture for the rest of Class III: proving the whole mechanism —
 * schema, per-character broadcast, captions, hand-off to a normal graded
 * activity — end to end with real content, rather than a bigger, unproven
 * catalog. Adding a second scene is pure content once this one is verified.
 */
export const ROLEPLAY_SCENES = {
  lemonade_change: LEMONADE_CHANGE,
} satisfies Readonly<Record<string, RoleplayScene>>;

export type RoleplaySceneId = keyof typeof ROLEPLAY_SCENES;

export function isRoleplaySceneId(value: string): value is RoleplaySceneId {
  return value in ROLEPLAY_SCENES;
}
