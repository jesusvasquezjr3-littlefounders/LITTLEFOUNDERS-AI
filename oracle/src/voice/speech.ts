import { createHash } from 'node:crypto';
import { getConfig } from '../env.js';
import type { CharacterId, Locale } from '../context/schema.js';
import { SCRIPTED_TEXTS } from '../tutor/scripted.js';
import { SHARED_SPEECH_BUCKET, SESSION_SPEECH_BUCKET, storeSpeechAudio } from '../depot/client.js';
import { getVoiceProvider } from './index.js';
import { cachedSpeechUrl, rememberSpeechUrl } from './cache.js';
import { pregeneratedUrl } from './pregenerated.js';

/*
 * ONE function turns a sentence into something a child can hear, and it is the
 * only place in the service that can spend money on speech.
 *
 * THE ORDER IS THE WHOLE POINT — cheapest first, paid last:
 *
 *   1. PRE-GENERATED   the closed scripted set, synthesised once ever and
 *                      recorded in `speech.pregenerated.json`. Free.
 *   2. CACHE           a line we have paid for before, in this voice. Free.
 *   3. SYNTHESIZE      the provider, then Depot. Billed, and recorded in the
 *                      session ledger (/ORACLE.md §15).
 *
 * Before all three there is a check that costs nothing and prevents the worst
 * outcome: if the provider has no voice for this character in this locale, we
 * stop here. Silence over a stranger's voice, exactly as the adapter does
 * (/ORACLE.md §3.3) — and stopping BEFORE the cache means we never key
 * anything on an absent voice.
 *
 * ── HOW FAR A CLIP MAY BE REUSED, AND WHY IT IS NOT SIMPLY "ALWAYS" ─────────
 *
 * Reuse and deletion are the same question asked twice. A clip reused across
 * sessions is ONE Depot object that many transcripts point at (Depot is
 * content-addressed), and Core's nightly sweep deletes a session's audio at 90
 * days (/ORACLE.md §12) — so a clip shared between sessions either outlives
 * the retention promise or gets deleted out from under everyone who still
 * points at it. There is no third option, and picking the wrong one silently
 * is how a privacy promise or a replay quietly stops being true.
 *
 * So reuse is scoped by what the text IS:
 *
 *   SCRIPTED (`SCRIPTED_TEXTS`) — human-written, closed, reviewed, identical
 *     for every learner, containing nothing about anybody. Shared bucket,
 *     shared cache, permanent, and deliberately excluded from the sweep. There
 *     is nothing here to delete on anyone's behalf.
 *
 *   EVERYTHING ELSE — a model turn, generated in answer to what one child
 *     said, possibly carrying their nickname. Session bucket, session-scoped
 *     memo, swept at 90 days exactly as today. It is still cached: a tutor
 *     that re-explains, encourages twice or reuses a framing inside one
 *     session pays once.
 *
 * `SPEECH_CACHE_SCOPE=all` widens the second class to the first class's terms.
 * It is a real switch and it is OFF, because turning it on gives a child's
 * session audio a life longer than their session — a change to a documented
 * privacy promise (/ORACLE.md §12), which is an owner decision with counsel in
 * it, not an engineering one. Same shape as `TUTOR_VOICE_FOR_MINORS`: a named
 * flag, a default, and a sign-off to record when it flips.
 */

export type SpeechSource = 'pregenerated' | 'cache' | 'synthesized' | 'unavailable';

export interface SpeechResult {
  /** Browser-fetchable URL, or `null` when this turn is captioned and silent. */
  url: string | null;
  source: SpeechSource;
  /**
   * Characters actually sent to the paid API. Zero on every free path.
   *
   * It is reported even when `url` is null, because a synthesis that succeeded
   * and then failed to store WAS billed. A ledger that only counted audio the
   * learner heard would under-report exactly the failure that wastes the most
   * money (`npm run speaks:verify` exists for that one).
   */
  billedChars: number;
}

const SILENT: SpeechResult = { url: null, source: 'unavailable', billedChars: 0 };

/**
 * One live session's memo of what it has already paid to say.
 *
 * Deliberately per session and in memory: it is dropped when the socket
 * closes, so a generated line never leaks into another learner's session and
 * never outlives the session's own audio.
 */
export interface SpeechScope {
  sessionId: string;
  character: CharacterId;
  locale: Locale;
  memo: Map<string, string>;
}

export function newSpeechScope(session: {
  sessionId: string;
  character: CharacterId;
  locale: Locale;
}): SpeechScope {
  return {
    sessionId: session.sessionId,
    character: session.character,
    locale: session.locale,
    memo: new Map(),
  };
}

/**
 * The content key: everything that decides what these bytes sound like.
 *
 * `fingerprint` comes from the provider and covers provider, model and the
 * enrolled voice — which is what makes this key (character, locale, text) in
 * the way that actually matters, since a voice id already names a character in
 * a locale. Text is NFC-normalised and trimmed so two spellings of the same
 * accented sentence are one entry rather than two paid calls.
 */
export function speechKey(fingerprint: string, text: string): string {
  return createHash('sha256')
    .update(`v1\u0000${fingerprint}\u0000${text.normalize('NFC').trim()}`)
    .digest('hex');
}

/** Whether this text may be shared between learners. See the header comment. */
export function isReusableText(text: string): boolean {
  return getConfig().SPEECH_CACHE_SCOPE === 'all' || SCRIPTED_TEXTS.has(text.trim());
}

/**
 * Speaks one line, spending money only if it has to.
 *
 * Never throws: the caller is mid-session and a lost voice costs the sound,
 * not the lesson (/ORACLE.md §14).
 */
export async function speakLine(text: string, scope: SpeechScope): Promise<SpeechResult> {
  const provider = getVoiceProvider();
  if (!provider.available) return SILENT;

  // No enrolled voice for this character here → silent, before anything else.
  const fingerprint = provider.voiceFingerprint(scope.character, scope.locale);
  if (!fingerprint) return SILENT;

  const key = speechKey(fingerprint, text);
  const reusable = isReusableText(text);

  // ── 1 + 2: the free paths ────────────────────────────────────────────────
  if (reusable) {
    const stored = pregeneratedUrl(key);
    if (stored) return { url: stored, source: 'pregenerated', billedChars: 0 };

    const cached = await cachedSpeechUrl(key);
    if (cached) return { url: cached, source: 'cache', billedChars: 0 };
  } else {
    const remembered = scope.memo.get(key);
    if (remembered) return { url: remembered, source: 'cache', billedChars: 0 };
  }

  // ── 3: the paid path ─────────────────────────────────────────────────────
  let audio: { audio: Buffer; mimeType: string };
  try {
    audio = await provider.synthesize({ text, locale: scope.locale, character: scope.character });
  } catch (error) {
    console.warn('[oracle] synthesis failed:', error instanceof Error ? error.message : error);
    return SILENT;
  }

  const billedChars = text.length;

  const stored = await storeSpeechAudio(audio.audio, audio.mimeType, {
    bucket: reusable ? SHARED_SPEECH_BUCKET : SESSION_SPEECH_BUCKET,
    // A shared clip is named for the line, not for a session: a session id in
    // the filename of something every learner hears would be a stray
    // identifier attached to content that belongs to nobody.
    name: reusable ? `scripted-${key.slice(0, 16)}` : scope.sessionId,
  });

  if (!stored) {
    // Billed and lost. Say so in the ledger rather than reporting it free.
    console.warn('[oracle] synthesized audio could not be stored — the turn will be captioned and silent');
    return { url: null, source: 'synthesized', billedChars };
  }

  if (reusable) await rememberSpeechUrl(key, stored.url);
  else scope.memo.set(key, stored.url);

  return { url: stored.url, source: 'synthesized', billedChars };
}
