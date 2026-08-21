/*
 * `npm run speaks:verify` — proves a character can actually be HEARD, all the
 * way from a cloned voice to a URL a browser can fetch.
 *
 * WHY THIS IS SEPARATE FROM voices:verify. That script proves TRANSPORT: our
 * endpoints, headers and parsing match Inworld as it exists today, and each
 * character is enrolled. Both can be perfectly green while every learner sits
 * in silence, because between "Inworld returned audio" and "a child hears it"
 * there is a step that fails without saying anything:
 *
 *   storeTurnAudio() returns null the instant DEPOT_URL or DEPOT_INTERNAL_KEY
 *   is missing (depot/client.ts). The turn is emitted with audioUrl: null and
 *   the session continues, captioned, exactly as designed — after a text-to-
 *   speech call that succeeded and was BILLED. From the outside that is
 *   indistinguishable from an unenrolled character, so nobody looks at Depot.
 *
 * That is the whole reason this exists: to make a paid-for, discarded voice
 * loud instead of silent.
 *
 * WHAT IT CHECKS, in order, because each answer only means something if the one
 * before it held:
 *
 *   1. ENROLMENT  — does this character resolve to a cloned voice in this
 *                   locale, or would they be silent? Checked BEFORE any network
 *                   call, because that is where the adapter checks it.
 *   2. SYNTHESIS  — does the real provider return audio for their own voice?
 *   3. STORAGE    — does Depot accept it and report a URL? The URL must come
 *                   from the RESPONSE; Depot is content-addressed and a
 *                   constructed filename is a 404 waiting to happen.
 *   4. RETRIEVAL  — does that URL actually serve the bytes, unauthenticated,
 *                   the way a browser will ask for them? This is the step that
 *                   catches a bucket that exists but is not world-readable.
 *
 * It runs one character in one locale by default (rho, es-MX) and takes
 * `--all` to sweep every enrolled slot. One short line of speech per slot.
 *
 * It writes nothing to the database and starts no session.
 */

import process from 'node:process';
import { getConfig } from '../src/env.js';
import { getVoiceProvider } from '../src/voice/index.js';
import { resolveCharacterVoice, voiceEnvVar } from '../src/voice/inworld.js';
import { storeTurnAudio } from '../src/depot/client.js';
import type { Locale } from '../src/context/schema.js';

const CHARACTERS = ['dina', 'liruf', 'rho', 'zara'] as const;
const LOCALES: Locale[] = ['en-US', 'es-MX', 'pt-BR'];

/** One short, ordinary sentence per locale. Deliberately about money. */
const LINE: Record<Locale, string> = {
  'en-US': 'If you save a little every week, it adds up faster than you think.',
  'es-MX': 'Si guardas un poco cada semana, se junta más rápido de lo que crees.',
  'pt-BR': 'Se você guardar um pouco toda semana, junta mais rápido do que imagina.',
};

type Character = (typeof CHARACTERS)[number];

let failures = 0;

function ok(label: string, detail = ''): void {
  console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
}

function bad(label: string, detail: string): void {
  failures += 1;
  console.log(`  FAIL  ${label} — ${detail}`);
}

async function checkSlot(character: Character, locale: Locale): Promise<void> {
  const config = getConfig();
  console.log('');
  console.log(`== ${character} · ${locale} ==`);

  // 1. ENROLMENT — before any network call, exactly where the adapter looks.
  const voiceId = resolveCharacterVoice(character, locale);
  if (!voiceId) {
    bad('not enrolled', `${voiceEnvVar(character, locale)} is unset — this character is SILENT in ${locale}`);
    return;
  }
  ok('enrolled', voiceId);

  // 2. SYNTHESIS — the character's own voice, not a stock one.
  const started = Date.now();
  let audio: { audio: Buffer; mimeType: string };
  try {
    audio = await getVoiceProvider().synthesize({ text: LINE[locale], character, locale });
    ok('synthesized', `${audio.audio.byteLength} bytes of ${audio.mimeType} in ${Date.now() - started} ms`);
  } catch (error) {
    bad('synthesis', error instanceof Error ? error.message : String(error));
    return;
  }

  // 3. STORAGE — the step that fails silently in production.
  if (!config.DEPOT_URL || !config.DEPOT_INTERNAL_KEY) {
    bad(
      'storage',
      'DEPOT_URL or DEPOT_INTERNAL_KEY is unset, so storeTurnAudio would return null — ' +
        'every turn synthesized, billed, and discarded before the browser ever saw it',
    );
    return;
  }
  const stored = await storeTurnAudio(audio.audio, audio.mimeType, `verify-${character}-${locale}`);
  if (!stored) {
    bad('storage', 'Depot refused the upload — the turn would be captioned and silent');
    return;
  }
  ok('stored', stored.url);

  // 4. RETRIEVAL — as the browser will ask, with no credentials at all.
  try {
    const response = await fetch(stored.url);
    const bytes = response.ok ? (await response.arrayBuffer()).byteLength : 0;
    if (!response.ok) {
      bad('retrieval', `HTTP ${response.status} — the URL exists and does not serve`);
      return;
    }
    if (bytes === 0) {
      bad('retrieval', 'served 0 bytes');
      return;
    }
    // Not byte-identical by requirement — Depot may re-encode or dedupe — but a
    // wildly different length means we fetched something that is not this clip.
    const drift = Math.abs(bytes - audio.audio.byteLength) / audio.audio.byteLength;
    ok('retrievable', `${bytes} bytes over plain HTTP${drift > 0.05 ? ` (${Math.round(drift * 100)}% different from what we sent)` : ''}`);
  } catch (error) {
    bad('retrieval', error instanceof Error ? error.message : String(error));
  }
}

async function main(): Promise<void> {
  const config = getConfig();
  const all = process.argv.includes('--all');

  console.log('== What this Oracle is configured to speak with ==');
  console.log(`  provider  ${config.VOICE_PROVIDER}`);
  console.log(`  depot     ${config.DEPOT_URL ?? 'UNSET'}${config.DEPOT_INTERNAL_KEY ? '' : '  (no key)'}`);
  console.log(`  minors    TUTOR_VOICE_FOR_MINORS=${String(config.TUTOR_VOICE_FOR_MINORS)}`);

  if (!getVoiceProvider().available) {
    console.error('');
    console.error('The voice provider reports unavailable. With VOICE_PROVIDER=none every character is');
    console.error('captioned and silent by design — which is a valid deployment and not what this checks.');
    process.exit(1);
  }

  const slots: [Character, Locale][] = all
    ? CHARACTERS.flatMap((c) => LOCALES.map((l) => [c, l] as [Character, Locale]))
    : [['rho', 'es-MX']];

  for (const [character, locale] of slots) {
    await checkSlot(character, locale);
  }

  console.log('');
  if (failures > 0) {
    console.log(`speaks:verify FAILED — ${failures} broken step(s) across ${slots.length} slot(s).`);
    process.exit(1);
  }
  console.log(
    `speaks:verify OK — ${slots.length} slot(s): enrolled, synthesized in their own voice, stored, and fetchable.`,
  );
}

await main();
