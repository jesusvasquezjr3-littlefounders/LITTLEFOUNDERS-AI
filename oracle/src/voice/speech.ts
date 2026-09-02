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
   *
   * ALREADY CORRECT AT N>1 REPLICAS, by construction rather than by luck —
   * examined 2026-09-01 (round 142) and recorded here so the next person
   * asking "which of these maps blocks scaling?" does not have to re-derive
   * it. A `SpeechScope` has exactly one production constructor
   * (`ws/server.ts`'s `resumed?.speech ?? newSpeechScope(session)`) and
   * exactly one production consumer (the `Synthesizer` closure built on the
   * next line), both bound to ONE socket — and a socket lives entirely inside
   * the process that accepted it. Every caller that can race on a key in here
   * is therefore already in the same process. This map must NOT be migrated
   * to a shared store; making it shared is an active privacy regression (see
   * the ternary in `speakLine` that chooses between the two maps).
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
 * cache's own docstring promises "pay once, ever". Scoped per-process, which
 * covers every session that can actually race on the same instance — and
 * which stayed per-process on PURPOSE once Oracle stopped requiring a single
 * replica (§16, round 143), for the measured reason set out immediately
 * below, not because nobody revisited it.
 *
 * ── WHAT THIS ACTUALLY COSTS AT N>1 REPLICAS, MEASURED (round 142) ──────────
 *
 * This is the map ORACLE.md §16 named as blocking a second replica, and the
 * exposure was measured rather than assumed before deciding anything. With the
 * shipped default `SPEECH_CACHE_SCOPE=scripted`, "reusable" IS the closed
 * catalogue and nothing else: 144 keys (12 texts x 4 characters x 3 locales),
 * 16,697 characters in total, $0.0835 at `USD_PER_1K_TTS_CHARS`. It does not
 * grow with usage. So the ENTIRE worst case of leaving this per-process is
 * $0.0835 x (N-1), ONCE, on a cold cache — after which the shared Redis cache
 * (180-day TTL) serves every replica.
 *
 * A distributed claim is the wrong instrument for that. A Promise cannot cross
 * a process boundary, so the only cross-replica shape is "leader claims,
 * follower POLLS the cache until it appears" — and a follower that waits adds
 * latency to a child's turn on the one feature where latency IS the product,
 * while a follower that does not wait pays anyway, which is today's behaviour
 * with an extra Redis round trip bolted on. Failing CLOSED is worse still:
 * this module's contract is "never throws... a lost voice costs the sound",
 * and `cache.ts` promises an unreachable store degrades to one paid synthesis
 * "spoken normally". Silence to save a cent inverts both.
 *
 * THE CHEAP FIX IS AN OPERATOR ACTION, NOT A LOCK: `npm run
 * speech:pregenerate -- --confirm` buys the whole set once, records it in the
 * TRACKED `speech.pregenerated.json`, and `pregeneratedUrl` is consulted
 * BEFORE the cache with no network at all. The manifest ships in the deploy
 * image, so it is identical on every replica by construction and the exposure
 * above becomes $0.00. It currently ships with `"lines": {}` — a documented,
 * valid state, and the reason this map has any cross-replica cost at all.
 *
 * CONDITIONAL, AND THE CONDITION IS A FLAG: all of the above holds only while
 * `SPEECH_CACHE_SCOPE=scripted`. Under `all`, "reusable" becomes every
 * generated turn, the keyspace is unbounded and grows with traffic, and the
 * duplicate spend stops being a one-time 8-cent rounding error. That flag
 * already needs owner sign-off for privacy reasons (see the header comment);
 * this is a second, independent reason it cannot be flipped casually — and
 * flipping it at N>1 REOPENS this question rather than inheriting this answer.
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
  /*
   * WHICH MAP, AND WHY IT IS NOT ONE MAP (round 142, 2026-09-01).
   *
   * Collapsing this ternary to `inFlightShared` is the cheapest-looking way to
   * make speech coalescing replica-safe, and it is a PRIVACY regression: a
   * follower in session B would receive the URL of an object
   * `synthesizeAndStore` wrote to the SESSION bucket under session A's own
   * name, on A's 90-day retention clock (/ORACLE.md §12). Fenced by
   * `speech.test.ts`'s "never coalesces two CONCURRENT sessions ... for a
   * GENERATED line", which was confirmed to fail against exactly that change.
   */
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
