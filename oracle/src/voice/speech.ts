import { createHash } from 'node:crypto';
import { getConfig } from '../env.js';
import type { CharacterId, Locale } from '../context/schema.js';
import { SCRIPTED_TEXTS } from '../tutor/scripted.js';
import { SHARED_SPEECH_BUCKET, SESSION_SPEECH_BUCKET, storeSpeechAudio } from '../depot/client.js';
import { getVoiceProvider } from './index.js';
import { cachedSpeechUrl, rememberSpeechUrl } from './cache.js';
import { pregeneratedUrl } from './pregenerated.js';
import type { WordTiming } from './provider.js';

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
  /**
   * Word-level timing for THIS clip, or `null`.
   *
   * Deliberately `null` (never fabricated) on `pregenerated` and `cache`:
   * both paths hand back a URL some EARLIER call already resolved, and
   * neither the pre-generation script's manifest nor the Redis cache (see
   * `cache.ts` — it stores a bare URL string, nothing else) carries timing
   * alongside it. A cache hit is therefore an honest "no timing for this
   * clip", identical in shape to a provider that never supports it — the
   * caption falls back to prose either way rather than guessing. Only a
   * fresh `synthesized` result can ever carry real timings, straight from
   * the provider's own response for these exact bytes.
   */
  wordTimings: WordTiming[] | null;
}

const SILENT: SpeechResult = { url: null, source: 'unavailable', billedChars: 0, wordTimings: null };

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
  /**
   * Non-reusable lines currently being synthesized for THIS session, keyed
   * the same way `memo` is. See the module-level `inFlightShared` map's
   * comment for why this exists; this is its session-scoped twin, for the
   * text class `memo` itself covers (never shared across sessions, so the
   * coalescing must not be either).
   */
  inFlight: Map<string, Promise<SynthesisOutcome>>;
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
    inFlight: new Map(),
  };
}

/**
 * Reusable/scripted lines currently being synthesized, process-wide.
 *
 * Found by adversarial review, 2026-08-30 (MEDIUM): the cache
 * (`cachedSpeechUrl`/`rememberSpeechUrl`) is a read-check-then-write with
 * nothing between the two, so two callers that both miss before either has
 * written back both fall through to the paid path — proven with two
 * sessions greeting concurrently on a cold cache, 2 Inworld calls where the
 * cache's own docstring promises "pay once, ever". Scoped per-process,
 * which is correct here: Oracle runs as a single replica (unlike Core —
 * see `backend/AGENTS.md`), so this already covers every session that could
 * actually race on the same instance.
 */
const inFlightShared = new Map<string, Promise<SynthesisOutcome>>();

/** What one paid synthesis attempt produced, for the leader AND every follower coalesced onto it. */
interface SynthesisOutcome {
  url: string | null;
  /** Whether the provider call itself succeeded — true even if storage then failed (§15: billed and lost, never billed and free). */
  billed: boolean;
  /**
   * The provider's timing for these exact bytes, or `null`. Shared with every
   * follower coalesced onto this same call — the audio is identical for all
   * of them, so the timing that describes it is too.
   */
  wordTimings: WordTiming[] | null;
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
  // No timing on any of these: see `SpeechResult.wordTimings`'s own comment
  // on why a cache hit is an honest "none", never a guess.
  if (reusable) {
    const stored = pregeneratedUrl(key);
    if (stored) return { url: stored, source: 'pregenerated', billedChars: 0, wordTimings: null };

    const cached = await cachedSpeechUrl(key);
    if (cached) return { url: cached, source: 'cache', billedChars: 0, wordTimings: null };
  } else {
    const remembered = scope.memo.get(key);
    if (remembered) return { url: remembered, source: 'cache', billedChars: 0, wordTimings: null };
  }

  // ── 3: the paid path, COALESCED ──────────────────────────────────────────
  //
  // Found by adversarial review, 2026-08-30 (MEDIUM): steps 1+2 above are a
  // read-check-then-write with nothing between the two, so two callers that
  // both miss before either has written back both fell through to here —
  // proven with two sessions greeting concurrently on a cold cache, 2
  // Inworld calls for the identical shared line the cache's own docstring
  // promises "pay once, ever" for. A second caller for the exact key now
  // AWAITS the first's in-flight promise instead of starting a second paid
  // call, and reports its own cost as zero — only the leader's `speak()`
  // call, which actually caused the spend, is billed for it.
  const inFlightMap = reusable ? inFlightShared : scope.inFlight;
  let promise = inFlightMap.get(key);
  const isLeader = promise === undefined;
  if (promise === undefined) {
    promise = synthesizeAndStore(text, scope, reusable, key);
    inFlightMap.set(key, promise);
    void promise.finally(() => inFlightMap.delete(key));
  }
  const outcome = await promise;

  if (!isLeader) {
    /*
     * Somebody else's in-flight synthesis — this call spent nothing, whether
     * it succeeded (a cache hit, effectively) or failed (silent, same as
     * them). The timing rides along too: the bytes are identical for every
     * caller coalesced onto the same promise, so a follower's caption can
     * highlight exactly as the leader's can, not merely play the same audio.
     */
    return outcome.url
      ? { url: outcome.url, source: 'cache', billedChars: 0, wordTimings: outcome.wordTimings }
      : SILENT;
  }
  return {
    url: outcome.url,
    source: outcome.billed ? 'synthesized' : 'unavailable',
    billedChars: outcome.billed ? text.length : 0,
    wordTimings: outcome.wordTimings,
  };
}

/** Does the actual provider call and storage. Never throws — every failure is a `SynthesisOutcome`. */
async function synthesizeAndStore(
  text: string,
  scope: SpeechScope,
  reusable: boolean,
  key: string,
): Promise<SynthesisOutcome> {
  const provider = getVoiceProvider();
  let audio: { audio: Buffer; mimeType: string; wordTimings: WordTiming[] | null };
  try {
    audio = await provider.synthesize({ text, locale: scope.locale, character: scope.character });
  } catch (error) {
    console.warn('[oracle] synthesis failed:', error instanceof Error ? error.message : error);
    return { url: null, billed: false, wordTimings: null };
  }

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
    return { url: null, billed: true, wordTimings: null };
  }

  if (reusable) await rememberSpeechUrl(key, stored.url);
  else scope.memo.set(key, stored.url);

  return { url: stored.url, billed: true, wordTimings: audio.wordTimings };
}
