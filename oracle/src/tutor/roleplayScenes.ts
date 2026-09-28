import { CHARACTER_IDS, LOCALES, type Locale } from '../context/schema.js';
import { ROLEPLAY_SCENE_IDS } from './turnSchema.js';
import type { ScriptedLine } from './scripted.js';

type RoleplaySceneId = (typeof ROLEPLAY_SCENE_IDS)[number];

/*
 * Class III / S17 `roleplay`, voice added afterward (owner request,
 * 2026-09-03): the ORACLE-SIDE mirror of the rebuilt Mentor's scene captions
 * (`frontend/src/rebuild/mentor/session/roleplay.ts`, `rebuild-mentor.json`)'s beat text, which oracle otherwise has no reason to know at
 * all — the scene id crosses the wire (`roleplayScene`, migration `0070`),
 * never the dialogue.
 *
 * WHY A MIRROR RATHER THAN A SHARED IMPORT. This codebase's own established
 * posture, everywhere a value must be true in two services with no shared
 * type: oracle and the frontend deliberately import nothing from each
 * other, so the text lives twice and `npm run roleplay-voices:check`
 * (`agent/tools/check-roleplay-voice-parity.mjs`) asserts the two copies
 * say the same thing, beat for beat, locale for locale — the identical
 * discipline `instruments:check`/`demo-step:check` already hold two other
 * hand-mirrored surfaces to.
 *
 * WHY THIS EXISTS AT ALL: a roleplay beat's dialogue is fixed, catalog
 * text — nobody generates it, nobody's session changes it — so paying a
 * live synthesis call every time a family plays a scene would be billing
 * the SAME sentence forever for content that never varies. This is
 * `scripted.ts`'s own reasoning, applied to a second closed set: enumerate
 * it once, synthesize each entry ONCE via `npm run speech:pregenerate --
 * confirm` (which merges `roleplayLineCatalogue()` below into the same
 * catalogue and the same shared, un-swept Depot bucket `scripted.ts`
 * already writes to), and every family's every future play is free.
 *
 * WHY EVERY CHARACTER, NOT JUST TWO: a beat's `speaker` is an abstract
 * ROLE ('lead' | 'companion'), resolved at PLAY TIME to whichever of the 4
 * canon characters the family actually has standing in that role
 * (`useRoleplayDirector.ts`'s own resolution) — so the audio has to exist
 * for every character who could plausibly hold either role, the same
 * reason `scripted.ts` pre-generates its 12 lines per character rather
 * than once.
 */

export interface RoleplayVoiceBeat {
  speaker: 'lead' | 'companion';
  text: Record<Locale, string>;
}

export interface RoleplayVoiceScene {
  beats: readonly RoleplayVoiceBeat[];
}

const LEMONADE_CHANGE: RoleplayVoiceScene = {
  beats: [
    {
      speaker: 'companion',
      text: {
        'en-US': "Hi! I'd like a lemonade, please. Here's five dollars!",
        'es-MX': '¡Hola! Quiero una limonada, por favor. ¡Aquí tienes cinco pesos!',
        'pt-BR': 'Oi! Eu queria uma limonada, por favor. Aqui estão cinco reais!',
      },
    },
    {
      speaker: 'lead',
      text: {
        'en-US': "One lemonade is three dollars. Let's see how much change that is.",
        'es-MX': 'Una limonada cuesta tres pesos. Veamos cuánto cambio es eso.',
        'pt-BR': 'Uma limonada custa três reais. Vamos ver quanto é o troco.',
      },
    },
    {
      speaker: 'companion',
      text: {
        'en-US': "Hmm, five dollars minus three dollars… I'm not sure!",
        'es-MX': 'Mmm, cinco pesos menos tres pesos… ¡no estoy segura!',
        'pt-BR': 'Hmm, cinco reais menos três reais… não tenho certeza!',
      },
    },
    {
      speaker: 'lead',
      text: {
        'en-US': 'You help me figure out the change — go ahead!',
        'es-MX': 'Ayúdame a calcular el cambio — adelante.',
        'pt-BR': 'Me ajude a descobrir o troco — pode ir.',
      },
    },
  ],
};

/**
 * Keyed the same way `ROLEPLAY_SCENE_IDS` is — every scene id that field can
 * carry MUST have an entry here, checked by `roleplay-voices:check` rather
 * than left to fail silently at synthesis time (a missing entry would just
 * mean that scene never gets voiced, an invisible gap `scripted.ts`'s own
 * closed-set reasoning exists to prevent).
 */
export const ROLEPLAY_VOICE_SCENES: Record<RoleplaySceneId, RoleplayVoiceScene> = {
  lemonade_change: LEMONADE_CHANGE,
};

/**
 * Every (scene, beat, character-who-might-hold-that-role, locale)
 * combination, in `ScriptedLine`'s own shape so `pregenerate-speech.ts`
 * merges this catalogue into its existing one unmodified — same content-hash
 * keying, same shared bucket, same manifest.
 *
 * `key` encodes the scene and beat index (`roleplay.<sceneId>.<beatIndex>`)
 * so a manifest entry is legible to a human reviewing the diff, the same
 * reason `scripted.ts`'s own keys are dotted strings rather than the hash
 * alone.
 */
export function roleplayLineCatalogue(): ScriptedLine[] {
  const lines: ScriptedLine[] = [];
  for (const sceneId of ROLEPLAY_SCENE_IDS) {
    const scene = ROLEPLAY_VOICE_SCENES[sceneId];
    scene.beats.forEach((beat, index) => {
      for (const character of CHARACTER_IDS) {
        for (const locale of LOCALES) {
          lines.push({
            key: `roleplay.${sceneId}.${index}`,
            character,
            locale,
            text: beat.text[locale],
          });
        }
      }
    });
  }
  return lines;
}

/** For the parity gate — every scene id this file must cover. */
export function roleplaySceneIds(): readonly RoleplaySceneId[] {
  return ROLEPLAY_SCENE_IDS;
}

