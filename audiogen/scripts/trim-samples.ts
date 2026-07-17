/*
 * `npm run trim:samples` — FREE, local-only, no network calls, safe to run
 * any time. Reads the raw character voice reference samples (long-form,
 * native-locale recordings the user added under src/samples/) and selects
 * the cleanest ~18s window per DashScope's qwen-voice-enrollment
 * constraints (src/tts/trimSample.ts), writing the trimmed WAVs to
 * src/samples/trimmed/{locale}/{character}.wav. Prints a pass/fail table
 * against the enrollment API's hard limits (60s max, 10MB max, 2s max
 * pause) — run this and review the table BEFORE ever running
 * `npm run voices:register` (which spends money).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWav } from '../src/tts/wav.js';
import { encodeWav } from '../src/tts/wavEncode.js';
import { selectCleanWindow, MAX_PAUSE_MS } from '../src/tts/trimSample.js';
import type { CanonCharacter, LessonLocale } from '../src/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = join(__dirname, '..', 'src', 'samples');
const OUTPUT_DIR = join(SAMPLES_DIR, 'trimmed');

const MAX_SECONDS = 60;
const MAX_BYTES = 10_000_000; // 10MB decimal — stays inside the provider's binary-MB limit too

const LOCALE_DIRS: Record<string, LessonLocale> = { EN: 'en-US', ES: 'es-MX', PT: 'pt-BR' };

/** Filename prefix -> canon character (src/env.ts CANON_CHARACTERS). */
const CHARACTER_FILENAME_MAP: Record<string, CanonCharacter> = {
  Dina: 'dina',
  Liruf: 'liruf',
  Rho: 'rho',
  Zara: 'zara',
};

interface Row {
  character: CanonCharacter;
  locale: LessonLocale;
  status: 'OK' | 'MISSING' | 'ERROR';
  origSeconds?: number;
  origBytes?: number;
  trimmedSeconds?: number;
  trimmedBytes?: number;
  withinPauseLimit?: boolean;
  detail?: string;
}

async function main(): Promise<void> {
  const rows: Row[] = [];

  for (const [localeDir, locale] of Object.entries(LOCALE_DIRS)) {
    for (const [filenamePrefix, character] of Object.entries(CHARACTER_FILENAME_MAP)) {
      const inputPath = join(SAMPLES_DIR, localeDir, `${filenamePrefix}_${localeDir}.wav`);
      try {
        const raw = await readFile(inputPath);
        const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
        const decoded = parseWav(arrayBuffer);
        const origSeconds = decoded.samples.length / decoded.sampleRate;

        const trimmed = selectCleanWindow(decoded);
        const trimmedWav = encodeWav(trimmed.samples, trimmed.sampleRate);

        const outDir = join(OUTPUT_DIR, locale);
        await mkdir(outDir, { recursive: true });
        await writeFile(join(outDir, `${character}.wav`), trimmedWav);

        rows.push({
          character,
          locale,
          status: 'OK',
          origSeconds,
          origBytes: raw.byteLength,
          trimmedSeconds: trimmed.durationMs / 1000,
          trimmedBytes: trimmedWav.length,
          withinPauseLimit: trimmed.withinPauseLimit,
        });
      } catch (err) {
        const isMissing = err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT';
        rows.push({
          character,
          locale,
          status: isMissing ? 'MISSING' : 'ERROR',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  printTable(rows);

  const anyFail = rows.some(
    (r) =>
      r.status !== 'OK' ||
      (r.trimmedSeconds ?? 0) > MAX_SECONDS ||
      (r.trimmedBytes ?? 0) > MAX_BYTES ||
      r.withinPauseLimit === false,
  );
  if (anyFail) {
    console.error('\n[audiogen] trim:samples — one or more samples failed enrollment constraints. See table above.');
    process.exit(1);
  }
  console.log(`\n[audiogen] trim:samples — all ${rows.length} samples trimmed cleanly. Output: ${OUTPUT_DIR}`);
}

function printTable(rows: Row[]): void {
  console.log(
    [
      'character'.padEnd(8),
      'locale'.padEnd(8),
      'status'.padEnd(8),
      'orig(s)'.padEnd(9),
      'trimmed(s)'.padEnd(11),
      'bytes'.padEnd(10),
      `pause<=${MAX_PAUSE_MS / 1000}s`.padEnd(11),
      'pass',
    ].join(' '),
  );
  for (const r of rows) {
    const durationOk = (r.trimmedSeconds ?? 0) <= MAX_SECONDS;
    const bytesOk = (r.trimmedBytes ?? 0) <= MAX_BYTES;
    const pass = r.status === 'OK' && durationOk && bytesOk && r.withinPauseLimit !== false;
    console.log(
      [
        r.character.padEnd(8),
        r.locale.padEnd(8),
        r.status.padEnd(8),
        (r.origSeconds?.toFixed(1) ?? '-').padEnd(9),
        (r.trimmedSeconds?.toFixed(1) ?? '-').padEnd(11),
        (r.trimmedBytes?.toString() ?? '-').padEnd(10),
        (r.withinPauseLimit === undefined ? '-' : r.withinPauseLimit ? 'yes' : 'NO').padEnd(11),
        pass ? 'PASS' : `FAIL${r.detail ? ` (${r.detail})` : ''}`,
      ].join(' '),
    );
  }
}

main().catch((err) => {
  console.error('[audiogen] trim:samples failed:', err);
  process.exit(1);
});
