/*
 * `npm run voices:verify` — proves the voice path against the LIVE Inworld
 * API, through the real adapter rather than through curl.
 *
 * Two questions, and they are genuinely different:
 *
 *   1. TRANSPORT — do our endpoints, headers, request shapes and response
 *      parsing match the API as it exists today? A round trip answers it
 *      completely: synthesize a sentence, transcribe the audio back, compare.
 *      If our TTS body is wrong we get no audio; if our STT parsing is wrong
 *      we get no text; if either shape drifted we find out here rather than
 *      in front of a child.
 *
 *   2. BROWSER CONTAINERS — can we transcribe what a MICROPHONE produces?
 *      This is the question whose absence cost the entire feature. The round
 *      trip above transcribes the TTS response using ITS OWN mimeType, which is
 *      `audio/mpeg`, so for months the only container this script ever exercised
 *      was MP3 — a format no browser records. Meanwhile every Chrome, Edge and
 *      Android turn arrived as WebM, was labelled `OGG_OPUS`, and came back 500.
 *      `voices:verify` was green throughout, because MP3 was fine.
 *
 *      So this section replays real recorded containers from
 *      `scripts/fixtures/`: WebM/Opus (Chrome, Edge, Android) and M4A
 *      (Safari/iOS, which offers nothing else). Committed as fixtures rather
 *      than transcoded at run time because the point is to test bytes a browser
 *      really writes, on a runner that may have no ffmpeg.
 *
 *   3. CASTING — is each canonical character enrolled in each locale? This is
 *      not a transport question and a green transport says nothing about it.
 *      An unenrolled character is SILENT (never a stock substitute), so this
 *      section is the difference between "the tutor can speak" and "the tutor
 *      can speak AS DR. RHO".
 *
 * It costs a few characters of TTS and one short STT call. It makes no
 * enrolment calls and creates nothing in the workspace.
 */

import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { getConfig, resetConfigCache } from '../src/env.js';
import { InworldVoiceProvider, resolveCharacterVoice, voiceEnvVar } from '../src/voice/inworld.js';
import type { Locale } from '../src/context/schema.js';

const CHARACTERS = ['dina', 'liruf', 'rho', 'zara'] as const;
const LOCALES: Locale[] = ['en-US', 'es-MX', 'pt-BR'];

/** A stock catalogue voice, used ONLY to exercise the transport. */
const PROBE_VOICE = 'Ximena';
const PROBE_LOCALE: Locale = 'es-MX';
const PROBE_TEXT = 'Si ahorras veinticinco pesos cada semana, en cuatro semanas juntas cien pesos.';

function ok(label: string, detail = ''): void {
  console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
}
function bad(label: string, detail = ''): void {
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main(): Promise<void> {
  resetConfigCache();
  const config = getConfig();

  if (!config.INWORLD_API_KEY) {
    console.error(
      '\n[oracle] INWORLD_API_KEY is not set, so nothing was called.\n' +
        'This is a valid deployment posture — sessions run captioned and silent.\n',
    );
    process.exitCode = 1;
    return;
  }

  let failures = 0;
  const provider = new InworldVoiceProvider();

  console.log('\n1. Transport — a real round trip through the adapter\n');
  ok('provider reports available', provider.name);

  /*
   * `synthesize()` refuses a character with no cloned voice, by design. To
   * exercise the transport on a workspace where nothing is enrolled yet, the
   * probe temporarily injects a STOCK voice for one character — and says so,
   * loudly, so nobody mistakes a green transport for a cast that is ready.
   */
  const probeVar = voiceEnvVar('rho', PROBE_LOCALE);
  const realVoice = process.env[probeVar];
  const usingStock = !realVoice;
  if (usingStock) {
    process.env[probeVar] = PROBE_VOICE;
    console.log(`        (probing with the stock voice "${PROBE_VOICE}" — no character is enrolled yet)`);
  }

  try {
    const started = Date.now();
    const spoken = await provider.synthesize({
      text: PROBE_TEXT,
      locale: PROBE_LOCALE,
      character: 'rho',
    });
    const ttsMs = Date.now() - started;

    if (spoken.audio.byteLength < 1_000) {
      bad('text-to-speech returned suspiciously little audio', `${spoken.audio.byteLength} bytes`);
      failures += 1;
    } else {
      ok('text-to-speech', `${spoken.audio.byteLength} bytes of ${spoken.mimeType} in ${ttsMs}ms`);
    }

    const sttStarted = Date.now();
    const heard = await provider.transcribe({
      audio: spoken.audio,
      mimeType: spoken.mimeType,
      locale: PROBE_LOCALE,
    });
    const sttMs = Date.now() - sttStarted;

    if (heard.text.trim() === '') {
      bad('speech-to-text returned nothing');
      failures += 1;
    } else {
      ok('speech-to-text', `${sttMs}ms`);
      console.log(`        said  : ${PROBE_TEXT}`);
      console.log(`        heard : ${heard.text}`);

      // Word overlap rather than equality: the model normalises spoken numbers
      // ("veinticinco" → "25"), which is correct behaviour and would fail a
      // strict comparison for the wrong reason.
      const words = (s: string) =>
        new Set(
          s
            .toLowerCase()
            .replace(/[.,¿?¡!]/g, '')
            .split(/\s+/)
            .filter((w) => w.length > 3),
        );
      const said = words(PROBE_TEXT);
      const got = words(heard.text);
      const overlap = [...said].filter((w) => got.has(w)).length / Math.max(said.size, 1);
      if (overlap < 0.5) {
        bad('the transcript does not resemble what was spoken', `${Math.round(overlap * 100)}% overlap`);
        failures += 1;
      } else {
        ok('round trip is faithful', `${Math.round(overlap * 100)}% word overlap`);
      }
      ok('total voice latency', `${ttsMs + sttMs}ms`);
    }
  } catch (error) {
    bad('round trip threw', error instanceof Error ? error.message : String(error));
    failures += 1;
  } finally {
    if (usingStock) delete process.env[probeVar];
  }

  /*
   * THE CONTAINERS A MICROPHONE ACTUALLY PRODUCES.
   *
   * A 500 here means Inworld has changed what it accepts, and the microphone is
   * down for whichever browser owns the failing fixture. That is not a warning.
   */
  const FIXTURES = [
    { file: 'browser-chrome.webm', mimeType: 'audio/webm;codecs=opus', browsers: 'Chrome, Edge, Android' },
    { file: 'browser-safari.m4a', mimeType: 'audio/mp4', browsers: 'Safari, iOS' },
  ] as const;

  const fixtureDir = new URL('fixtures/', import.meta.url);
  for (const fixture of FIXTURES) {
    try {
      const audio = await readFile(new URL(fixture.file, fixtureDir));
      const started = Date.now();
      const heard = await provider.transcribe({ audio, mimeType: fixture.mimeType, locale: PROBE_LOCALE });
      const ms = Date.now() - started;

      if (heard.text.trim() === '') {
        bad(`${fixture.file} transcribed to nothing`, `the microphone is down for ${fixture.browsers}`);
        failures += 1;
      } else {
        ok(`microphone container ${fixture.mimeType}`, `${ms}ms — ${fixture.browsers}`);
        console.log(`        heard : ${heard.text}`);
      }
    } catch (error) {
      bad(
        `${fixture.file} could not be transcribed`,
        `${error instanceof Error ? error.message : String(error)} — the microphone is down for ${fixture.browsers}`,
      );
      failures += 1;
    }
  }

  console.log('\n2. Casting — is each character enrolled, per locale?\n');

  let enrolled = 0;
  for (const character of CHARACTERS) {
    const row = LOCALES.map((locale) => {
      const voiceId = resolveCharacterVoice(character, locale);
      if (voiceId) enrolled += 1;
      return `${locale}: ${voiceId ?? '— silent —'}`;
    });
    console.log(`  ${character.padEnd(6)} ${row.join('   ')}`);
  }

  const total = CHARACTERS.length * LOCALES.length;
  console.log(`\n  ${enrolled}/${total} enrolled.`);
  if (enrolled < total) {
    console.log(
      `  An unenrolled character is SILENT in that locale — never a stock voice,\n` +
        `  because a stranger speaking as Dr. Rho is worse than Dr. Rho not speaking.\n` +
        `  Enrol with: npm run voices:clone -- --confirm`,
    );
  }

  if (failures > 0) {
    console.error(`\nvoices:verify FAILED — ${failures} transport check(s) did not hold.\n`);
    process.exitCode = 1;
    return;
  }
  console.log('\nvoices:verify OK — transport confirmed against the live API.\n');
}

main().catch((error: unknown) => {
  console.error('[oracle] voices:verify failed:', error);
  process.exitCode = 1;
});
