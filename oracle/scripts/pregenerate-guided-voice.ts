/*
 * `npm run voice:guided -- --confirm` — gives the characters their voices during
 * onboarding and placement.
 *
 * WHY THIS EXISTS SEPARATELY FROM speech:pregenerate. That script voices the
 * TUTOR's closed set of lines, which live in this service because they are turns
 * — they carry an emotion, an action, and a transcript entry. These lines are
 * not turns. They are the product's own copy, they are subtitled on screen, and
 * they live where every other user-facing string lives: the frontend i18n
 * bundles. So this script reads THOSE, and the frontend renders the same string
 * it hears. One sentence, one source, no chance of a character saying something
 * the subtitle does not.
 *
 * WHY IT STILL LIVES IN ORACLE. Because /AGENTS.md §1.2 says the real-time voice
 * provider is reached ONLY from `oracle/`, and this needs the enrolled canonical
 * voices. It reads two files from the frontend package and writes one back; it
 * imports no frontend code.
 *
 * WHAT IT WRITES. `frontend/src/guided-voice/manifest.json`, keyed
 * `<line-key>|<locale>`, each entry carrying the URL and THE EXACT TEXT it was
 * synthesised from. The frontend refuses to play a clip whose recorded text no
 * longer matches the subtitle it is about to show, so editing the copy makes
 * that line go silent rather than speak last month's sentence. Re-run this and
 * it is voiced again.
 *
 * INTERPOLATED LINES ARE REFUSED, LOUDLY. A line containing `{{name}}` cannot
 * have fixed audio — there is no one recording that says every name. Such a line
 * is a design error in the copy, not something to synthesise a broken version
 * of, so the script stops rather than quietly recording the placeholder out loud.
 *
 * OPERATOR-OPT-IN. Zero network calls without `--confirm`. Without it this is a
 * report: what exists, what is missing, what went stale.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { getConfig } from '../src/env.js';
import { getVoiceProvider } from '../src/voice/index.js';
import { CHARACTER_IDS, LOCALES, type CharacterId, type Locale } from '../src/context/schema.js';
import { storeSpeechAudio } from '../src/depot/client.js';

const here = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(here, '..', '..', 'frontend');
const CAST_PATH = join(FRONTEND_ROOT, 'src', 'guided-voice', 'cast.json');
const MANIFEST_PATH = join(FRONTEND_ROOT, 'src', 'guided-voice', 'manifest.json');
const I18N_DIR = join(FRONTEND_ROOT, 'src', 'i18n');

/** Its own Depot bucket, never swept by the 90-day session-retention job. */
const BUCKET = 'guided-voice-shared';

interface Entry {
  url: string;
  character: string;
  /** The exact string this clip says. The frontend's drift guard compares against it. */
  text: string;
}

interface Manifest {
  _comment?: unknown;
  generated: string | null;
  provider: string | null;
  depot: string | null;
  bucket: string;
  lines: Record<string, Entry>;
}

interface Line {
  /** e.g. "onboarding.welcome" */
  key: string;
  locale: Locale;
  character: CharacterId;
  text: string;
}

function isCharacterId(value: string): value is CharacterId {
  return (CHARACTER_IDS as readonly string[]).includes(value);
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function readManifest(): Promise<Manifest> {
  try {
    const parsed = await readJson<Partial<Manifest>>(MANIFEST_PATH);
    return {
      _comment: parsed._comment,
      generated: parsed.generated ?? null,
      provider: parsed.provider ?? null,
      depot: parsed.depot ?? null,
      bucket: parsed.bucket ?? BUCKET,
      lines: parsed.lines ?? {},
    };
  } catch {
    return { generated: null, provider: null, depot: null, bucket: BUCKET, lines: {} };
  }
}

/**
 * Builds the line catalogue by joining the cast map to the i18n bundles.
 *
 * A cast key names `<namespace>.<step>`; the text is that namespace's
 * `narration.<step>`. A cast entry with no matching string is an error and not a
 * skip — it means someone added a step to the flow and never wrote what the
 * character says, and the character would stand there mute.
 */
async function buildCatalogue(): Promise<Line[]> {
  const cast = (await readJson<{ cast: Record<string, string> }>(CAST_PATH)).cast;
  const bundles = new Map<string, Record<string, { narration?: Record<string, string> }>>();

  for (const locale of LOCALES) {
    const namespaces = new Set(Object.keys(cast).map((key) => key.split('.')[0]!));
    const loaded: Record<string, { narration?: Record<string, string> }> = {};
    for (const namespace of namespaces) {
      loaded[namespace] = await readJson(join(I18N_DIR, locale, `${namespace}.json`));
    }
    bundles.set(locale, loaded);
  }

  const lines: Line[] = [];
  const problems: string[] = [];

  for (const [key, character] of Object.entries(cast)) {
    if (!isCharacterId(character)) {
      problems.push(`cast["${key}"] names "${character}", which is not one of ${CHARACTER_IDS.join(', ')}`);
      continue;
    }
    const [namespace, step] = key.split('.');
    for (const locale of LOCALES) {
      const text = bundles.get(locale)?.[namespace!]?.narration?.[step!];
      if (!text) {
        problems.push(`${locale}/${namespace}.json is missing narration.${step} — the character would be mute`);
        continue;
      }
      if (text.includes('{{')) {
        problems.push(
          `${locale} ${key}: the line interpolates a value, so no fixed recording can say it. ` +
            'Move the variable part to an on-screen aside and keep the spoken line constant.',
        );
        continue;
      }
      lines.push({ key, locale, character, text });
    }
  }

  if (problems.length > 0) {
    console.error('The guided-voice catalogue is not consistent:');
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    process.exit(1);
  }
  return lines;
}

function preview(text: string): string {
  return text.length <= 56 ? text : `${text.slice(0, 55)}…`;
}

async function main(): Promise<void> {
  const confirmed = process.argv.includes('--confirm');
  const config = getConfig();
  const provider = getVoiceProvider();
  const manifest = await readManifest();
  const catalogue = await buildCatalogue();

  console.log('== Guided-flow narration (onboarding + placement) ==');
  console.log(`  provider  ${config.VOICE_PROVIDER}${provider.available ? '' : '  (UNAVAILABLE)'}`);
  console.log(`  depot     ${config.DEPOT_URL ?? 'UNSET'}${config.DEPOT_INTERNAL_KEY ? '' : '  (no key)'}`);
  console.log(`  bucket    ${BUCKET}  (never swept by the 90-day retention job)`);
  console.log(`  recorded  ${Object.keys(manifest.lines).length} line(s)${manifest.generated ? ` on ${manifest.generated}` : ''}`);

  const slots = catalogue.map((line) => {
    const manifestKey = `${line.key}|${line.locale}`;
    const existing = manifest.lines[manifestKey];
    const voiced = provider.voiceFingerprint(line.character, line.locale) !== null;
    return { line, manifestKey, voiced, have: existing !== undefined && existing.text === line.text };
  });

  const unvoiced = slots.filter((s) => !s.voiced);
  const todo = slots.filter((s) => s.voiced && !s.have);
  const done = slots.filter((s) => s.have);

  /*
   * A stale entry is one whose recorded text no longer matches the copy. It is
   * not dangerous — the frontend refuses to play it and the line is silent —
   * but it IS invisible unless something says so out loud, and a silently
   * silent character is exactly the failure this whole flow exists to avoid.
   */
  const live = new Set(slots.map((s) => s.manifestKey));
  const stale = Object.entries(manifest.lines).filter(
    ([key, entry]) => !live.has(key) || !catalogue.some((l) => `${l.key}|${l.locale}` === key && l.text === entry.text),
  );

  console.log('');
  console.log(`  ${catalogue.length} narrated line(s) across ${LOCALES.length} locale(s)`);
  console.log(`  ${done.length} already voiced`);
  console.log(`  ${todo.length} to synthesize`);
  if (unvoiced.length > 0) {
    const who = [...new Set(unvoiced.map((s) => `${s.line.character}/${s.line.locale}`))];
    console.log(`  ${unvoiced.length} SKIPPED — no enrolled voice: ${who.join(', ')}`);
    console.log('      An unenrolled character stays SILENT and subtitled, never given a stock voice.');
  }
  if (stale.length > 0) {
    console.log(`  ${stale.length} STALE entr(y/ies) — the copy was edited since they were recorded:`);
    for (const [key, entry] of stale.slice(0, 10)) console.log(`      ${key}: "${preview(entry.text)}"`);
    console.log('      Those lines are SILENT (subtitled) until this script re-runs.');
  }

  if (!provider.available) {
    console.error('');
    console.error('The voice provider reports unavailable, so nothing can be synthesized.');
    console.error('Onboarding and placement remain fully usable with subtitles alone.');
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
    console.log('Nothing to do — every narrated line is already voiced and current.');
    return;
  }

  if (!confirmed) {
    const chars = todo.reduce((sum, s) => sum + s.line.text.length, 0);
    console.log('');
    console.log(`voice:guided would synthesize ${todo.length} clip(s) (~${chars} characters) and did NOT run.`);
    console.log('It is a one-off charge: this set does not grow with usage.');
    console.log('');
    console.log('  npm run voice:guided -- --confirm');
    return;
  }

  let failures = 0;
  for (const [index, slot] of todo.entries()) {
    const { line, manifestKey } = slot;
    const label = `[${index + 1}/${todo.length}] ${line.character}/${line.locale} ${line.key}`;
    try {
      const audio = await provider.synthesize({ text: line.text, locale: line.locale, character: line.character });
      const stored = await storeSpeechAudio(audio.audio, audio.mimeType, {
        bucket: BUCKET,
        name: `guided-${line.key.replace(/[^a-z0-9]+/gi, '-')}-${line.locale}`,
      });
      if (!stored) {
        failures += 1;
        console.error(`${label}  ✗ synthesized and BILLED, but Depot refused it`);
        continue;
      }
      manifest.lines[manifestKey] = { url: stored.url, character: line.character, text: line.text };
      console.log(`${label}  → ${stored.url}`);
    } catch (error) {
      failures += 1;
      console.error(`${label}  ✗ ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Drop entries nothing points at any more, so the committed file stays a true
  // picture of what is voiced rather than accumulating a decade of old takes.
  for (const [key] of Object.entries(manifest.lines)) {
    if (!live.has(key)) delete manifest.lines[key];
  }

  manifest.generated = new Date().toISOString().slice(0, 10);
  manifest.provider = provider.name;
  manifest.depot = config.DEPOT_URL;
  manifest.bucket = BUCKET;

  // Written even on a partial run: a manifest with most of its lines makes most
  // of them voiced, and a re-run picks up only the rest. Partial is a real state.
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log('');
  console.log('─'.repeat(64));
  console.log(`Wrote ${Object.keys(manifest.lines).length} line(s) to frontend/src/guided-voice/manifest.json.`);
  console.log('Review the diff and commit it — that file is what gives the characters their voices.');
  if (failures > 0) {
    console.error(`${failures} clip(s) failed. Re-run to pick up only those.`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('[oracle] voice:guided failed:', error);
  process.exitCode = 1;
});
