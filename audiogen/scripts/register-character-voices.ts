/*
 * `npm run voices:register -- --confirm` — PAID, calls the real DashScope
 * qwen-voice-enrollment API once per character/locale (12 calls, one per
 * trimmed sample). OPERATOR-OPT-IN per /AGENTS.md BOUNDARIES: does nothing
 * — makes zero network calls — unless invoked with the `--confirm` flag.
 *
 * Prereq: `npm run trim:samples` must have already produced clean output
 * under src/samples/trimmed/{locale}/{character}.wav (run it first and
 * review its pass/fail table).
 *
 * This script does NOT write to .env — it prints the resulting
 * TTS_VOICE_<CHARACTER>_<LOCALE>=<voice-id> lines for a human to review and
 * paste into audiogen/.env themselves (never auto-edit a secrets file).
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../src/env.js';
import { registerVoice } from '../src/tts/voiceClone.js';
import type { CanonCharacter, LessonLocale } from '../src/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRIMMED_DIR = join(__dirname, '..', 'src', 'samples', 'trimmed');

const CANON_CHARACTERS: CanonCharacter[] = ['dina', 'liruf', 'rho', 'zara'];
const LOCALES: LessonLocale[] = ['en-US', 'es-MX', 'pt-BR'];

const LOCALE_ENV_SLUG: Record<LessonLocale, string> = {
  'en-US': 'EN_US',
  'es-MX': 'ES_MX',
  'pt-BR': 'PT_BR',
};

async function main(): Promise<void> {
  const confirmed = process.argv.includes('--confirm');
  if (!confirmed) {
    console.log(
      '[audiogen] voices:register is a PAID action (12 DashScope enrollment calls) and did NOT run.\n' +
        'Re-run with the --confirm flag once you have reviewed npm run trim:samples output:\n' +
        '  npm run voices:register -- --confirm',
    );
    return;
  }

  const config = getConfig();
  const results: { character: CanonCharacter; locale: LessonLocale; voiceId?: string; error?: string }[] = [];

  for (const locale of LOCALES) {
    for (const character of CANON_CHARACTERS) {
      const path = join(TRIMMED_DIR, locale, `${character}.wav`);
      try {
        const wav = await readFile(path);
        // preferred_name rejects hyphens (probed live 2026-07-13: "dina-en-us"
        // → InvalidParameter; "dina_es_mx"/"dinaesmx" pass validation).
        const voiceId = await registerVoice(
          {
            audioBase64: wav.toString('base64'),
            mimeType: 'audio/wav',
            preferredName: `${character}_${LOCALE_ENV_SLUG[locale].toLowerCase()}`,
          },
          {
            apiUrl: config.TTS_ENROLLMENT_API_URL,
            apiKey: config.TTS_API_KEY,
            targetModel: config.TTS_CLONE_MODEL,
          },
        );
        results.push({ character, locale, voiceId });
        console.log(`[audiogen] registered ${character}/${locale} -> ${voiceId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ character, locale, error: message });
        console.error(`[audiogen] FAILED ${character}/${locale}: ${message}`);
      }
    }
  }

  const failures = results.filter((r) => r.error);
  console.log(`\n[audiogen] voices:register done — ${results.length - failures.length}/${results.length} succeeded.`);

  const succeeded = results.filter((r) => r.voiceId);
  if (succeeded.length > 0) {
    console.log('\nAdd these to audiogen/.env:\n');
    for (const r of succeeded) {
      console.log(`TTS_VOICE_${r.character.toUpperCase()}_${LOCALE_ENV_SLUG[r.locale]}=${r.voiceId}`);
    }
  }

  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[audiogen] voices:register failed:', err);
  process.exit(1);
});
