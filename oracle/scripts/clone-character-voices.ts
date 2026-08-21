/*
 * `npm run voices:clone -- --confirm` — enrols the four canonical characters
 * into Inworld, one cloned voice per character per locale.
 *
 * OPERATOR-OPT-IN, like Echo's `voices:register`: it makes ZERO network calls
 * without `--confirm`, and it never writes to a `.env` — it prints the lines
 * for a human to review and paste.
 *
 * WHY THIS EXISTS AT ALL. The cast already has voices. Echo clones them from
 * `audiogen/src/samples/trimmed/{locale}/{character}.wav` and narrates every
 * lesson with them. If the Tutor spoke in a stock catalogue voice, a child who
 * knows Dr. Rho from a lesson would meet a stranger wearing his face. Reading
 * the SAME trimmed samples is what makes the two castings identical by
 * construction rather than by intention — nobody has to remember to keep them
 * in sync, because there is only one source.
 *
 * TWO MEASURED FACTS shape the pacing, both from a live run on 2026-08-21:
 *
 *   - Inworld's clone endpoint is RATE LIMITED TO 2 REQUESTS PER MINUTE. The
 *     full cast is 12 enrolments, so this takes about six minutes. The script
 *     paces itself instead of discovering it as a wall of 429s at slot seven.
 *   - Instant cloning wants 5-15 seconds of reference audio and returns a
 *     voice usable immediately, with no training step.
 *
 * Prereq: Echo's `npm run trim:samples` must already have produced the trimmed
 * WAVs. They are gitignored (large binary audio the owner holds), so a machine
 * without them gets a loud, itemised SKIP rather than a confusing failure.
 */

import { readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { cloneVoice, voiceEnvVar } from '../src/voice/inworld.js';
import type { Locale } from '../src/context/schema.js';

const here = dirname(fileURLToPath(import.meta.url));
/** Echo's output, read directly. One source of truth for the casting. */
const TRIMMED_DIR = join(here, '..', '..', 'audiogen', 'src', 'samples', 'trimmed');

const CHARACTERS = ['dina', 'liruf', 'rho', 'zara'] as const;
const LOCALES: Locale[] = ['en-US', 'es-MX', 'pt-BR'];

/** 2 per minute, measured. 35 s keeps a comfortable margin under the limiter. */
const PACING_MS = 35_000;

type Character = (typeof CHARACTERS)[number];

interface Outcome {
  character: Character;
  locale: Locale;
  voiceId?: string;
  skipped?: string;
  error?: string;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const confirmed = process.argv.includes('--confirm');

  const planned: { character: Character; locale: Locale; path: string }[] = [];
  for (const locale of LOCALES) {
    for (const character of CHARACTERS) {
      planned.push({ character, locale, path: join(TRIMMED_DIR, locale, `${character}.wav`) });
    }
  }

  const present = await Promise.all(planned.map((p) => exists(p.path)));
  const available = planned.filter((_, i) => present[i]);
  const missing = planned.filter((_, i) => !present[i]);

  if (missing.length > 0) {
    console.warn(
      `\n[oracle] ${missing.length} reference sample(s) are not on this machine:\n` +
        missing.map((m) => `  MISSING  ${m.locale}/${m.character}.wav`).join('\n') +
        `\n\nThey live outside the repository (gitignored, owner-held). Run Echo's\n` +
        `\`npm run trim:samples\` on a machine that has them first.\n`,
    );
  }

  if (available.length === 0) {
    console.error('[oracle] nothing to enrol — no reference samples found. Nothing was called.');
    process.exitCode = 1;
    return;
  }

  if (!confirmed) {
    const minutes = Math.ceil((available.length * PACING_MS) / 60_000);
    console.log(
      `\n[oracle] voices:clone would enrol ${available.length} voice(s) and did NOT run.\n` +
        `Inworld's clone endpoint allows 2 requests per minute, so this takes about ${minutes} minute(s).\n\n` +
        available.map((a) => `  ${a.locale}/${a.character}.wav`).join('\n') +
        `\n\nRe-run with --confirm once you are ready:\n  npm run voices:clone -- --confirm\n`,
    );
    return;
  }

  const results: Outcome[] = [];

  for (const [index, slot] of available.entries()) {
    if (index > 0) {
      process.stdout.write(`  …pacing ${PACING_MS / 1000}s for the rate limit\n`);
      await new Promise((resolve) => setTimeout(resolve, PACING_MS));
    }

    try {
      const wav = await readFile(slot.path);
      console.log(`[${index + 1}/${available.length}] ${slot.locale}/${slot.character} (${wav.byteLength} bytes)`);
      const voiceId = await cloneVoice({
        // Named so a human scanning the Inworld workspace can tell instantly
        // what a voice is for and which product owns it.
        displayName: `lf-${slot.character}-${slot.locale.toLowerCase()}`,
        locale: slot.locale,
        audioBase64: wav.toString('base64'),
        description: `LittleFounders canonical character ${slot.character} (${slot.locale})`,
      });
      results.push({ ...slot, voiceId });
      console.log(`    → ${voiceId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ...slot, error: message });
      console.error(`    ✗ ${message}`);
    }
  }

  const enrolled = results.filter((r) => r.voiceId);
  const failed = results.filter((r) => r.error);

  console.log(`\n${'─'.repeat(64)}`);
  console.log(`Enrolled ${enrolled.length}/${results.length}.`);

  if (enrolled.length > 0) {
    console.log(`\nPaste into oracle/.env (this script never writes a secrets file):\n`);
    for (const r of enrolled) {
      console.log(`${voiceEnvVar(r.character, r.locale)}=${r.voiceId}`);
    }
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} failed:`);
    for (const r of failed) console.error(`  ${r.locale}/${r.character}: ${r.error}`);
    // A partial enrolment is a REAL state, not a disaster: an unmapped
    // character is silent rather than wrong-voiced, and re-running only needs
    // the missing slots.
    process.exitCode = 1;
  }

  console.log(
    `\nAn unset character stays SILENT in that locale — never a stock substitute.\n` +
      `That is deliberate: a stranger's voice for Dr. Rho is worse than no voice.\n`,
  );
}

main().catch((error: unknown) => {
  console.error('[oracle] voices:clone failed:', error);
  process.exitCode = 1;
});
