/*
 * `npm run speech:pregenerate -- --confirm` — synthesises every FIXED line the
 * Tutor can say, once, ever, and records the resulting URLs as tracked config.
 *
 * WHY. `src/tutor/scripted.ts` holds a closed set of human-written lines: the
 * four characters' greetings, the six safety responses, the two closes, and
 * the model-down / moderation-blocked / consent-revoked fallbacks. Twelve texts
 * per character per locale — 144 clips — and until now every one of them was
 * synthesised and BILLED again each time a child heard it. Depot already
 * deduplicated the storage by content hash, so not even the disk grew; only
 * the invoice did. The set does not grow with usage, so it can be paid for
 * exactly once and then be free for the life of the product (/ORACLE.md §15).
 *
 * SINCE 2026-09-03 this also covers `src/tutor/roleplayScenes.ts`'s
 * pre-authored scene dialogue (Class III `roleplay`) — the identical
 * reasoning applied to a second closed set: a beat's text is fixed catalog
 * content nobody generates per session, and every canon character could end
 * up holding either role, so it is 4 beats × 4 characters × 3 locales = 48
 * more clips per scene, merged into the SAME catalogue, run and manifest
 * below rather than a second script re-deriving this one's Depot/manifest
 * plumbing.
 *
 * OPERATOR-OPT-IN, like `voices:clone`: it makes ZERO network calls without
 * `--confirm`. Without the flag it is a REPORT — what exists, what is missing,
 * what went stale because a line was edited or a voice re-enrolled — which is
 * the mode you want most of the time, because a stale manifest is silent and
 * expensive rather than broken.
 *
 * WHAT IT WRITES. `oracle/speech.pregenerated.json`, keyed by the content hash
 * of (voice fingerprint, text). It never writes a `.env` and holds no secret:
 * the values are URLs to world-readable audio in our own Depot, exactly the
 * clips a browser fetches during a lesson.
 *
 * WHERE THE AUDIO GOES. Depot bucket `tutor-speech-shared`, NOT `tutor-speech`.
 * The second is swept with each session at 90 days; these clips belong to no
 * session and to no learner, and deleting one would silence every future
 * session rather than protect anybody (/ORACLE.md §12, §15).
 *
 * COST. 144 clips at roughly 90 characters each is about 13,000 characters of
 * text-to-speech — a fraction of a cent at any provider's rate, spent once,
 * against a per-session charge that recurred forever.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { getConfig } from '../src/env.js';
import { getVoiceProvider } from '../src/voice/index.js';
import { speechKey } from '../src/voice/speech.js';
import { scriptedLineCatalogue, type ScriptedLine } from '../src/tutor/scripted.js';
import { roleplayLineCatalogue } from '../src/tutor/roleplayScenes.js';
import { SHARED_SPEECH_BUCKET, storeSpeechAudio } from '../src/depot/client.js';

const here = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(here, '..', 'speech.pregenerated.json');

interface Entry {
  url: string;
  key: string;
  character: string;
  locale: string;
  preview: string;
  chars: number;
}

interface Manifest {
  _comment?: unknown;
  generated: string | null;
  provider: string | null;
  depot: string | null;
  bucket: string;
  lines: Record<string, Entry>;
}

/** A line and where it stands relative to what is already recorded. */
interface Slot {
  line: ScriptedLine;
  /** null when this character has no enrolled voice in this locale. */
  contentKey: string | null;
  have: boolean;
}

function preview(text: string): string {
  return text.length <= 48 ? text : `${text.slice(0, 47)}…`;
}

async function readManifest(): Promise<Manifest> {
  try {
    const parsed = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Partial<Manifest>;
    return {
      _comment: parsed._comment,
      generated: parsed.generated ?? null,
      provider: parsed.provider ?? null,
      depot: parsed.depot ?? null,
      bucket: parsed.bucket ?? SHARED_SPEECH_BUCKET,
      lines: parsed.lines ?? {},
    };
  } catch {
    return { generated: null, provider: null, depot: null, bucket: SHARED_SPEECH_BUCKET, lines: {} };
  }
}

async function main(): Promise<void> {
  const confirmed = process.argv.includes('--confirm');
  const config = getConfig();
  const provider = getVoiceProvider();
  const manifest = await readManifest();

  console.log('== What this Oracle would pre-generate ==');
  console.log(`  provider  ${config.VOICE_PROVIDER}${provider.available ? '' : '  (UNAVAILABLE)'}`);
  console.log(`  depot     ${config.DEPOT_URL ?? 'UNSET'}${config.DEPOT_INTERNAL_KEY ? '' : '  (no key)'}`);
  console.log(`  bucket    ${SHARED_SPEECH_BUCKET}  (never swept by the 90-day retention job)`);
  console.log(`  recorded  ${Object.keys(manifest.lines).length} line(s)${manifest.generated ? ` on ${manifest.generated}` : ''}`);

  /*
   * Two closed sets, merged into one run: `scripted.ts`'s always-say-this
   * lines and `roleplayScenes.ts`'s pre-authored scene dialogue. Both are
   * fixed text nobody generates per session, so both are free after this
   * script pays for them once — one catalogue, one manifest, one shared
   * bucket, rather than a second script duplicating this one's Depot/manifest
   * plumbing for a second closed set.
   */
  const catalogue = [...scriptedLineCatalogue(), ...roleplayLineCatalogue()];
  const slots: Slot[] = catalogue.map((line) => {
    const fingerprint = provider.voiceFingerprint(line.character, line.locale);
    const contentKey = fingerprint ? speechKey(fingerprint, line.text) : null;
    return { line, contentKey, have: contentKey !== null && manifest.lines[contentKey] !== undefined };
  });

  const unvoiced = slots.filter((s) => s.contentKey === null);
  const todo = slots.filter((s) => s.contentKey !== null && !s.have);
  const done = slots.filter((s) => s.have);

  /*
   * ORPHANS ARE THE REASON THIS SCRIPT HAS A REPORT MODE.
   *
   * An entry nothing in the catalogue points at any more means a line was
   * edited or a voice re-enrolled. Nothing breaks — the runtime just misses
   * and pays — so it is invisible unless something says it out loud.
   */
  const live = new Set(slots.map((s) => s.contentKey).filter((k): k is string => k !== null));
  const orphans = Object.entries(manifest.lines).filter(([key]) => !live.has(key));

  console.log('');
  console.log(`  ${catalogue.length} scripted line(s) in the catalogue`);
  console.log(`  ${done.length} already pre-generated`);
  console.log(`  ${todo.length} to synthesize`);
  if (unvoiced.length > 0) {
    const characters = [...new Set(unvoiced.map((s) => `${s.line.character}/${s.line.locale}`))];
    console.log(`  ${unvoiced.length} SKIPPED — no enrolled voice: ${characters.join(', ')}`);
    console.log(`      An unenrolled character is SILENT, never substituted. Run \`npm run voices:clone\`.`);
  }
  if (orphans.length > 0) {
    console.log(`  ${orphans.length} ORPHANED entr(y/ies) — the line was edited or the voice re-enrolled:`);
    for (const [, entry] of orphans.slice(0, 10)) {
      console.log(`      ${entry.character}/${entry.locale} ${entry.key}: "${entry.preview}"`);
    }
    console.log('      They are dead weight, not a hazard: the runtime misses and pays once.');
  }

  if (!provider.available) {
    console.error('');
    console.error('The voice provider reports unavailable, so nothing can be synthesized. With');
    console.error('VOICE_PROVIDER=none every line is captioned and silent by design — a valid');
    console.error('deployment, and not one that needs a manifest.');
    process.exit(1);
  }
  if (!config.DEPOT_URL || !config.DEPOT_INTERNAL_KEY) {
    console.error('');
    console.error('DEPOT_URL or DEPOT_INTERNAL_KEY is unset. Every clip would be synthesized,');
    console.error('BILLED, and then discarded before it reached a URL. Refusing to run.');
    process.exit(1);
  }

  if (todo.length === 0) {
    console.log('');
    console.log('Nothing to do — every voiced line is already pre-generated.');
    return;
  }

  if (!confirmed) {
    const chars = todo.reduce((sum, s) => sum + s.line.text.length, 0);
    console.log('');
    console.log(`speech:pregenerate would synthesize ${todo.length} clip(s) (~${chars} characters) and did NOT run.`);
    console.log('That is a one-off charge; each of those lines is billed on every play today.');
    console.log('');
    console.log('  npm run speech:pregenerate -- --confirm');
    return;
  }

  let failures = 0;
  for (const [index, slot] of todo.entries()) {
    const { line, contentKey } = slot;
    if (contentKey === null) continue;
    const label = `[${index + 1}/${todo.length}] ${line.character}/${line.locale} ${line.key}`;
    try {
      const audio = await provider.synthesize({
        text: line.text,
        locale: line.locale,
        character: line.character,
      });
      const stored = await storeSpeechAudio(audio.audio, audio.mimeType, {
        bucket: SHARED_SPEECH_BUCKET,
        name: `scripted-${contentKey.slice(0, 16)}`,
      });
      if (!stored) {
        failures += 1;
        console.error(`${label}  ✗ synthesized and BILLED, but Depot refused it`);
        continue;
      }
      manifest.lines[contentKey] = {
        url: stored.url,
        key: line.key,
        character: line.character,
        locale: line.locale,
        preview: preview(line.text),
        chars: line.text.length,
      };
      console.log(`${label}  → ${stored.url}`);
    } catch (error) {
      failures += 1;
      console.error(`${label}  ✗ ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  manifest.generated = new Date().toISOString().slice(0, 10);
  manifest.provider = provider.name;
  manifest.depot = config.DEPOT_URL;
  manifest.bucket = SHARED_SPEECH_BUCKET;

  // Written even on a partial run: a manifest with 130 of 144 lines makes 130
  // lines free, and re-running only picks up the rest. Partial is a real state.
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log('');
  console.log(`${'─'.repeat(64)}`);
  console.log(`Wrote ${Object.keys(manifest.lines).length} line(s) to speech.pregenerated.json.`);
  console.log('Review the diff and commit it — that file is what makes these lines free.');
  if (failures > 0) {
    console.error(`${failures} clip(s) failed. Re-run to pick up only those.`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('[oracle] speech:pregenerate failed:', error);
  process.exitCode = 1;
});
