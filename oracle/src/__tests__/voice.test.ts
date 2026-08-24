import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InworldVoiceProvider, resolveCharacterVoice, voiceEnvVar } from '../voice/inworld.js';
import { getVoiceProvider, resetVoiceProvider, VoiceUnavailableError } from '../voice/index.js';
import { resetConfigCache } from '../env.js';

/*
 * The voice layer, without a network.
 *
 * The property that matters most here is the one the owner named: the cast
 * ALREADY has voices, cloned per locale from the owner's reference recordings
 * and used in every lesson. If the Tutor spoke in a stock catalogue voice, a
 * child who knows Dr. Rho from a lesson would meet a stranger wearing his
 * face. So an unenrolled character must be SILENT, and these tests are what
 * stop a well-meaning fallback from being added later.
 *
 * The live transport is proven separately by `npm run voices:verify`, which
 * calls the real API — measured on 2026-08-21 at 814 ms TTS + 715 ms STT.
 */

const VOICE_VARS = [
  'INWORLD_VOICE_RHO_ES_MX',
  'INWORLD_VOICE_RHO_EN_US',
  'INWORLD_VOICE_ZARA_PT_BR',
  'INWORLD_VOICE_DINA_ES_MX',
];

beforeEach(() => {
  for (const v of VOICE_VARS) delete process.env[v];
  resetVoiceProvider();
  resetConfigCache();
});

afterEach(() => {
  for (const v of VOICE_VARS) delete process.env[v];
  delete process.env.INWORLD_API_KEY;
  delete process.env.VOICE_PROVIDER;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetVoiceProvider();
  resetConfigCache();
});

describe('the character voice map', () => {
  it('names variables that mirror Echo’s, so the two castings are comparable', () => {
    // Echo uses TTS_VOICE_RHO_ES_MX. The parallel is deliberate: a human
    // comparing the two services should not have to translate a convention.
    expect(voiceEnvVar('rho', 'es-MX')).toBe('INWORLD_VOICE_RHO_ES_MX');
    expect(voiceEnvVar('zara', 'pt-BR')).toBe('INWORLD_VOICE_ZARA_PT_BR');
    expect(voiceEnvVar('dina', 'en-US')).toBe('INWORLD_VOICE_DINA_EN_US');
  });

  it('resolves an enrolled voice', () => {
    process.env.INWORLD_VOICE_RHO_ES_MX = 'workspace__lf-rho-es-mx';
    expect(resolveCharacterVoice('rho', 'es-MX')).toBe('workspace__lf-rho-es-mx');
  });

  it('treats an empty value as unenrolled rather than as a voice id', () => {
    process.env.INWORLD_VOICE_RHO_ES_MX = '   ';
    expect(resolveCharacterVoice('rho', 'es-MX')).toBeNull();
  });

  it('is per LOCALE — an English enrolment does not speak Spanish', () => {
    process.env.INWORLD_VOICE_RHO_EN_US = 'workspace__lf-rho-en-us';
    expect(resolveCharacterVoice('rho', 'en-US')).toBe('workspace__lf-rho-en-us');
    expect(resolveCharacterVoice('rho', 'es-MX')).toBeNull();
  });
});

describe('an unenrolled character is SILENT, never substituted', () => {
  it('refuses to synthesize, and says which variable is missing', async () => {
    process.env.INWORLD_API_KEY = 'test-inworld-key-0123';
    resetConfigCache();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new InworldVoiceProvider();
    await expect(
      provider.synthesize({ text: 'hola', locale: 'es-MX', character: 'rho' }),
    ).rejects.toThrow(/no cloned voice enrolled for rho in es-MX/);

    // And it never reached the network: a stock voice was not "tried first".
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('names the exact env var to set, so the fix is obvious', async () => {
    process.env.INWORLD_API_KEY = 'test-inworld-key-0123';
    resetConfigCache();
    vi.stubGlobal('fetch', vi.fn());

    const provider = new InworldVoiceProvider();
    await expect(
      provider.synthesize({ text: 'hi', locale: 'pt-BR', character: 'zara' }),
    ).rejects.toThrow(/INWORLD_VOICE_ZARA_PT_BR/);
  });

  it('speaks once the character IS enrolled', async () => {
    process.env.INWORLD_API_KEY = 'test-inworld-key-0123';
    process.env.INWORLD_VOICE_RHO_ES_MX = 'workspace__lf-rho-es-mx';
    resetConfigCache();

    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ audioContent: Buffer.from('fake-mp3-bytes').toString('base64') }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await new InworldVoiceProvider().synthesize({
      text: 'Muy bien pensado.',
      locale: 'es-MX',
      character: 'rho',
    });
    expect(result.mimeType).toBe('audio/mpeg');

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body.voiceId).toBe('workspace__lf-rho-es-mx');
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/tts/v1/voice');
  });
});

describe('the transcription request', () => {
  beforeEach(() => {
    process.env.INWORLD_API_KEY = 'test-inworld-key-0123';
    resetConfigCache();
  });

  it('DISABLES the voice profile explicitly', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ transcription: { transcript: 'hola' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await new InworldVoiceProvider().transcribe({
      audio: Buffer.from('audio'),
      mimeType: 'audio/webm;codecs=opus',
      locale: 'es-MX',
    });

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as {
      transcribeConfig: { voiceProfileConfig?: { enableVoiceProfile?: boolean }; audioEncoding: string; language: string };
    };
    /*
     * Inworld's STT can infer emotion, accent, AGE and pitch from a voice.
     * Measured: it is off by default. Off by default is not the same as off —
     * a default is something a provider may change and we would never notice.
     */
    expect(body.transcribeConfig.voiceProfileConfig?.enableVoiceProfile).toBe(false);
    expect(body.transcribeConfig.audioEncoding).toBe('AUTO_DETECT');
    expect(body.transcribeConfig.language).toBe('es');
  });

  it('discards a voice profile loudly if one arrives anyway', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ transcription: { transcript: 'hola', voiceProfile: { age: 'child' } } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    );

    const result = await new InworldVoiceProvider().transcribe({
      audio: Buffer.from('audio'),
      mimeType: 'audio/webm',
      locale: 'es-MX',
    });

    expect(result.text).toBe('hola');
    // If this ever fires, the provider changed a default and we need to know.
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('voice profile'));
  });

  /*
   * THIS TEST USED TO ASSERT THE DEFECT.
   *
   * It expected `audio/webm;codecs=opus` — Chrome, Edge and every Android
   * browser — to be labelled `OGG_OPUS`, and it passed for as long as the
   * microphone was broken in production. WebM is not Ogg; Inworld's demuxer
   * answers 500. Measured against the live API on 2026-08-24, `AUTO_DETECT`
   * transcribed webm, ogg, m4a, wav and mp3 correctly, all five.
   *
   * So the assertion is inverted on purpose: NO browser MIME type may ever
   * produce a named encoding again. A future edit that reintroduces a
   * MIME→enum table fails here instead of in a child's microphone.
   */
  it('never names an encoding — the container header is the provider\'s to read', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: unknown, init: RequestInit) => {
        seen.push(
          (JSON.parse(String(init.body)) as { transcribeConfig: { audioEncoding: string } }).transcribeConfig
            .audioEncoding,
        );
        return Promise.resolve(
          new Response(JSON.stringify({ transcription: { transcript: 'x' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }),
    );

    const provider = new InworldVoiceProvider();
    // Every format a MediaRecorder anywhere actually emits, plus the ones the
    // old table named. `audio/webm;codecs=opus` is Chrome/Android; `audio/mp4`
    // is Safari/iOS, which has no other option.
    const mimes = [
      'audio/wav',
      'audio/mpeg',
      'audio/flac',
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/weird',
    ];
    for (const mime of mimes) {
      await provider.transcribe({ audio: Buffer.from('a'), mimeType: mime, locale: 'en-US' });
    }
    expect(seen).toEqual(mimes.map(() => 'AUTO_DETECT'));
  });

  /*
   * The 500 that hid this defect said only `inworld stt responded 500`. The
   * provider's real answer never reached a log, so a bad container could not
   * be told apart from a bad key or an exhausted quota.
   */
  it('carries the provider\'s error body and the mimeType into the thrown message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response('{"code":13, "message":"proxy has failed to process your request"}', {
            status: 500,
          }),
        ),
      ),
    );

    await expect(
      new InworldVoiceProvider().transcribe({
        audio: Buffer.from('a'),
        mimeType: 'audio/webm;codecs=opus',
        locale: 'es-MX',
      }),
    ).rejects.toThrow(/500 for audio\/webm;codecs=opus: .*proxy has failed/);
  });
});

describe('the silent provider', () => {
  it('is the DEFAULT, and is a real posture rather than a stub', async () => {
    resetConfigCache();
    const provider = getVoiceProvider();
    expect(provider.name).toBe('none');
    expect(provider.available).toBe(false);
    await expect(
      provider.synthesize({ text: 'hola', locale: 'es-MX', character: 'rho' }),
    ).rejects.toBeInstanceOf(VoiceUnavailableError);
  });
});
