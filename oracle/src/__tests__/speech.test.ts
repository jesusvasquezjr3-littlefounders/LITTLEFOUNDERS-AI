import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigCache } from '../env.js';
import { resetVoiceProvider } from '../voice/index.js';
import { isReusableText, newSpeechScope, speakLine, speechKey } from '../voice/speech.js';
import { resetPregeneratedManifest } from '../voice/pregenerated.js';
import { estimateVoiceCostUsd, TutorOrchestrator } from '../tutor/orchestrator.js';
import { scriptedLineCatalogue, SCRIPTED_TEXTS, greetingResponse } from '../tutor/scripted.js';
import { CHARACTER_IDS, LOCALES } from '../context/schema.js';
import type { SessionContext } from '../core/client.js';

/*
 * STOPPING PAYING FOR THE SAME AUDIO OVER AND OVER.
 *
 * Three properties, and every one of them was a real invoice before:
 *
 *   1. The scripted set is FINITE and enumerated, so it can be bought once.
 *   2. The cache sits BEFORE the paid call, and a miss degrades to a paid call
 *      rather than to silence — which is the failure that would be worse than
 *      the bill.
 *   3. What we DID pay for reaches the session ledger, so the saving is
 *      measurable rather than believed.
 *
 * The fourth property is the child-safety one and it is asserted hardest: a
 * cached line is the same reviewed line, because the key is a hash of the text
 * itself. Edit the text and the old audio becomes unreachable.
 */

const SESSION: SessionContext = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  tier: 2,
  locale: 'es-MX',
  nickname: 'Robi',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  intent: 'course_topic',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  isMinor: true,
  voiceConsent: true,
  intelDegraded: false,
};

/** One scripted line that really is in the catalogue, in this session's locale. */
const SCRIPTED_LINE = greetingResponse('rho', 'es-MX').say;

function inworldTts(): Response {
  return new Response(
    JSON.stringify({ audioContent: Buffer.from('fake-mp3-bytes').toString('base64') }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function depotAccepts(url: string): Response {
  return new Response(JSON.stringify({ data: { url, path: url.split('/files/')[1] }, error: null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * A configured, working voice + Depot, with `fetch` answering both.
 *
 * Returns the fetch spy so a test can count PAID CALLS, which is the only
 * number any of this is about.
 */
function withVoice(): ReturnType<typeof vi.fn> {
  process.env.VOICE_PROVIDER = 'inworld';
  process.env.INWORLD_API_KEY = 'test-inworld-key-0123';
  process.env.INWORLD_VOICE_RHO_ES_MX = 'workspace__lf-rho-es-mx';
  process.env.DEPOT_URL = 'http://depot.test';
  process.env.DEPOT_INTERNAL_KEY = 'test-depot-key-0123456789';
  resetConfigCache();
  resetVoiceProvider();

  let n = 0;
  const spy = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/tts/v1/voice')) return Promise.resolve(inworldTts());
    if (url.includes('/api/v1/files')) {
      n += 1;
      return Promise.resolve(depotAccepts(`http://depot.test/files/tutor-speech-shared/hash${n}.mp3`));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

function ttsCalls(spy: ReturnType<typeof vi.fn>): number {
  return spy.mock.calls.filter((c) => String(c[0]).includes('/tts/v1/voice')).length;
}

beforeEach(() => {
  resetPregeneratedManifest();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const key of [
    'VOICE_PROVIDER',
    'INWORLD_API_KEY',
    'INWORLD_VOICE_RHO_ES_MX',
    'DEPOT_URL',
    'DEPOT_INTERNAL_KEY',
    'SPEECH_CACHE_SCOPE',
    'SPEECH_CACHE_ENABLED',
  ]) {
    delete process.env[key];
  }
  process.env.VOICE_PROVIDER = 'none';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetConfigCache();
  resetVoiceProvider();
  resetPregeneratedManifest();
});

describe('the scripted set is closed, which is what makes it buyable once', () => {
  it('enumerates every fixed line for every character in every locale', () => {
    const catalogue = scriptedLineCatalogue();
    // 12 texts (greeting + 6 safety + 5 fixed) x 4 characters x 3 locales.
    expect(catalogue).toHaveLength(12 * CHARACTER_IDS.length * LOCALES.length);

    for (const character of CHARACTER_IDS) {
      for (const locale of LOCALES) {
        const slot = catalogue.filter((l) => l.character === character && l.locale === locale);
        expect(slot).toHaveLength(12);
        expect(new Set(slot.map((l) => l.key)).size).toBe(12);
        for (const line of slot) expect(line.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('gives each character their OWN greeting, in each locale', () => {
    for (const locale of LOCALES) {
      const greetings = CHARACTER_IDS.map((c) => greetingResponse(c, locale).say);
      expect(new Set(greetings).size).toBe(CHARACTER_IDS.length);
    }
  });

  it('writes every locale deliberately rather than reusing the English', () => {
    for (const character of CHARACTER_IDS) {
      const said = LOCALES.map((l) => greetingResponse(character, l).say);
      expect(new Set(said).size).toBe(LOCALES.length);
    }
  });

  it('never names the learner — the nickname belongs in the caption', () => {
    // A name in the audio makes the clip unshareable, which is precisely the
    // cost this work removed.
    for (const line of scriptedLineCatalogue()) {
      expect(line.text).not.toMatch(/\{\{|\$\{|%s|\{nickname\}/);
    }
  });

  it('treats the catalogue as the ONE definition of what is reusable', () => {
    for (const line of scriptedLineCatalogue()) expect(SCRIPTED_TEXTS.has(line.text)).toBe(true);
    expect(isReusableText(SCRIPTED_LINE)).toBe(true);
    expect(isReusableText('Muy bien pensado, esa idea sirve.')).toBe(false);
  });
});

describe('the content key is a hash of the line itself', () => {
  it('changes when the text changes, so edited copy can never play old audio', () => {
    const a = speechKey('inworld:m:v', 'That is our time for today.');
    const b = speechKey('inworld:m:v', 'That is our time for today!');
    expect(a).not.toBe(b);
  });

  it('changes when the voice changes, so a re-enrolled character is not last month’s actor', () => {
    expect(speechKey('inworld:m:v1', 'hola')).not.toBe(speechKey('inworld:m:v2', 'hola'));
  });

  it('ignores only surrounding whitespace and unicode form', () => {
    expect(speechKey('f', '  hola  ')).toBe(speechKey('f', 'hola'));
    expect(speechKey('f', 'está'.normalize('NFD'))).toBe(speechKey('f', 'está'.normalize('NFC')));
  });
});

describe('the cache sits BEFORE the paid call', () => {
  it('pays once for a scripted line and never again in the same process', async () => {
    const spy = withVoice();
    const first = await speakLine(SCRIPTED_LINE, newSpeechScope(SESSION));
    expect(first.source).toBe('synthesized');
    expect(first.billedChars).toBe(SCRIPTED_LINE.length);
    expect(ttsCalls(spy)).toBe(1);
  });

  it('pays once for a repeated GENERATED line inside one session', async () => {
    const spy = withVoice();
    const scope = newSpeechScope(SESSION);
    const generated = 'Muy bien pensado, esa idea sirve.';

    const first = await speakLine(generated, scope);
    const second = await speakLine(generated, scope);

    expect(first.source).toBe('synthesized');
    expect(second).toMatchObject({ source: 'cache', billedChars: 0, url: first.url });
    expect(ttsCalls(spy)).toBe(1);
  });

  it('keeps a generated line inside its OWN session', async () => {
    // Two learners, two scopes. A generated turn belongs to one child's
    // session and is deleted with it (/ORACLE.md §12), so it must not be
    // served to somebody else.
    const spy = withVoice();
    const generated = 'Muy bien pensado, esa idea sirve.';
    await speakLine(generated, newSpeechScope(SESSION));
    await speakLine(generated, newSpeechScope({ ...SESSION, sessionId: 'other-session' }));
    expect(ttsCalls(spy)).toBe(2);
  });

  it('serves a scripted line from the shared cache the SECOND time, across sessions', async () => {
    /*
     * The Redis leg, with Redis replaced by a Map at the one seam that talks
     * to it. This is the path that makes the scripted set free in a deployment
     * where `speech:pregenerate` has not been run yet — and, more importantly,
     * across replicas and across deploys, which a per-process map cannot do.
     */
    const store = new Map<string, string>();
    vi.doMock('../lib/redis.js', () => ({
      redisClient: { isOpen: true },
      redisGet: (k: string) => Promise.resolve(store.get(k) ?? null),
      redisSetEx: (k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve(true);
      },
    }));
    vi.resetModules();

    const spy = withVoice();
    const fresh = await import('../voice/speech.js');

    const first = await fresh.speakLine(SCRIPTED_LINE, fresh.newSpeechScope(SESSION));
    // A different session entirely — a different child, on a different replica.
    const second = await fresh.speakLine(
      SCRIPTED_LINE,
      fresh.newSpeechScope({ ...SESSION, sessionId: 'a-completely-different-session' }),
    );

    expect(first.source).toBe('synthesized');
    expect(second).toMatchObject({ source: 'cache', billedChars: 0, url: first.url });
    expect(ttsCalls(spy)).toBe(1);
    expect(store.size).toBe(1);

    vi.doUnmock('../lib/redis.js');
    vi.resetModules();
  });

  /*
   * Found by adversarial review, 2026-08-30 (MEDIUM): steps 1+2 (pregenerated,
   * cache) are a read-check-then-write with nothing between the two. Two
   * callers that both miss before either has written back both fell through
   * to the paid path — proven here by firing two calls for the identical
   * GENERATED line, on the SAME session, at the same instant instead of
   * sequentially.
   */
  it('coalesces two CONCURRENT calls for the identical generated line into one paid call', async () => {
    const spy = withVoice();
    const scope = newSpeechScope(SESSION);
    const generated = 'Muy bien pensado, esa idea sirve.';

    const [first, second] = await Promise.all([speakLine(generated, scope), speakLine(generated, scope)]);

    // Exactly one of the two actually paid; the other coalesced onto it.
    const sources = [first.source, second.source].sort();
    expect(sources).toEqual(['cache', 'synthesized']);
    expect(first.url).toBe(second.url);
    expect(first.billedChars + second.billedChars).toBe(generated.length);
    expect(ttsCalls(spy)).toBe(1);
  });

  it('coalesces two CONCURRENT sessions greeting on a cold shared cache into one paid call', async () => {
    // The exact shape the review found: two different children's sockets,
    // nothing serializes them against each other, both racing a cold cache
    // right after a deploy or a locale/character not yet pregenerated.
    const store = new Map<string, string>();
    vi.doMock('../lib/redis.js', () => ({
      redisClient: { isOpen: true },
      redisGet: (k: string) => Promise.resolve(store.get(k) ?? null),
      redisSetEx: (k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve(true);
      },
    }));
    vi.resetModules();

    const spy = withVoice();
    const fresh = await import('../voice/speech.js');

    const [first, second] = await Promise.all([
      fresh.speakLine(SCRIPTED_LINE, fresh.newSpeechScope(SESSION)),
      fresh.speakLine(SCRIPTED_LINE, fresh.newSpeechScope({ ...SESSION, sessionId: 'a-different-session' })),
    ]);

    const sources = [first.source, second.source].sort();
    expect(sources).toEqual(['cache', 'synthesized']);
    expect(first.url).toBe(second.url);
    expect(ttsCalls(spy)).toBe(1);

    vi.doUnmock('../lib/redis.js');
    vi.resetModules();
  });

  it('degrades a cache outage to a PAID CALL, never to silence', async () => {
    // Redis is not connected in tests, so every lookup is already a miss —
    // which is exactly the outage posture. The line is still spoken.
    const spy = withVoice();
    const result = await speakLine(SCRIPTED_LINE, newSpeechScope(SESSION));
    expect(result.url).not.toBeNull();
    expect(result.source).toBe('synthesized');
    expect(ttsCalls(spy)).toBe(1);
  });

  it('reports a billed-then-lost synthesis as billed, not as free', async () => {
    // Depot refusing the upload after the provider charged us is the failure
    // `speaks:verify` exists for. The ledger must not report it as a saving.
    withVoice();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/tts/v1/voice')) return Promise.resolve(inworldTts());
        return Promise.resolve(new Response(null, { status: 500 }));
      }),
    );

    const result = await speakLine(SCRIPTED_LINE, newSpeechScope(SESSION));
    expect(result).toMatchObject({ url: null, source: 'synthesized' });
    expect(result.billedChars).toBeGreaterThan(0);
  });
});

describe('an unenrolled or absent voice never reaches the paid path', () => {
  it('is silent, with no network call at all, when the character has no voice', async () => {
    process.env.VOICE_PROVIDER = 'inworld';
    process.env.INWORLD_API_KEY = 'test-inworld-key-0123';
    resetConfigCache();
    resetVoiceProvider();
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);

    const result = await speakLine(SCRIPTED_LINE, newSpeechScope(SESSION));
    expect(result).toEqual({ url: null, source: 'unavailable', billedChars: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('is silent with the default provider', async () => {
    resetConfigCache();
    resetVoiceProvider();
    const result = await speakLine(SCRIPTED_LINE, newSpeechScope(SESSION));
    expect(result).toEqual({ url: null, source: 'unavailable', billedChars: 0 });
  });
});

describe('voice cost reaches the session ledger', () => {
  it('charges only what was actually synthesized', () => {
    expect(estimateVoiceCostUsd(0)).toBe(0);
    expect(estimateVoiceCostUsd(1000)).toBeGreaterThan(0);
    expect(estimateVoiceCostUsd(2000)).toBeCloseTo(2 * estimateVoiceCostUsd(1000), 12);
  });

  it('adds a paid synthesis to the session total, and a free one to nothing', async () => {
    const paid = new TutorOrchestrator(SESSION, Date.now(), async () => ({
      url: 'http://depot.test/files/tutor-speech/a.mp3',
      source: 'synthesized' as const,
      billedChars: 120,
    }));
    await paid.greet(Date.now());
    expect(paid.voiceCostUsd).toBeGreaterThan(0);
    expect(paid.totalCostUsd).toBe(paid.voiceCostUsd);
    expect(paid.speechCounts).toEqual({ paid: 1, free: 0, discarded: 0 });

    const free = new TutorOrchestrator(SESSION, Date.now(), async () => ({
      url: 'http://depot.test/files/tutor-speech-shared/a.mp3',
      source: 'pregenerated' as const,
      billedChars: 0,
    }));
    await free.greet(Date.now());
    // The whole point, in one assertion: the greeting is spoken and costs nil.
    expect(free.voiceCostUsd).toBe(0);
    expect(free.totalCostUsd).toBe(0);
    expect(free.speechCounts).toEqual({ paid: 0, free: 1, discarded: 0 });
  });
});
