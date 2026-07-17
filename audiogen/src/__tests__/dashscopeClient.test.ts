import { describe, expect, it, vi } from 'vitest';
import { synthesizeSpeech } from '../tts/dashscopeClient.js';
import { TtsError } from '../tts/errors.js';

const baseOpts = {
  apiUrl: 'https://dashscope-intl.example/generation',
  apiKey: 'k',
  model: 'qwen3-tts-flash',
  sleep: async () => undefined,
  rand: () => 0,
};

const input = { text: 'hello', voice: 'Jennifer', languageType: 'English' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('synthesizeSpeech', () => {
  it('accepts output.audio.url', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { output: { audio: { url: 'https://x/1.wav' } } }));
    const url = await synthesizeSpeech(input, { ...baseOpts, fetchImpl });
    expect(url).toBe('https://x/1.wav');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('accepts the output.audio_url fallback shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { output: { audio_url: 'https://x/2.wav' } }));
    const url = await synthesizeSpeech(input, { ...baseOpts, fetchImpl });
    expect(url).toBe('https://x/2.wav');
  });

  it('throws TTS_BAD_RESPONSE when neither shape is present', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { output: {} }));
    await expect(synthesizeSpeech(input, { ...baseOpts, fetchImpl })).rejects.toMatchObject({ code: 'TTS_BAD_RESPONSE' });
  });

  it('retries on 429 then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(200, { output: { audio: { url: 'https://x/3.wav' } } }));
    const url = await synthesizeSpeech(input, { ...baseOpts, fetchImpl });
    expect(url).toBe('https://x/3.wav');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable 4xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, {}));
    await expect(synthesizeSpeech(input, { ...baseOpts, fetchImpl })).rejects.toMatchObject({ code: 'TTS_PROVIDER_ERROR' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts on persistent 500s', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    await expect(synthesizeSpeech(input, { ...baseOpts, fetchImpl, maxAttempts: 3 })).rejects.toMatchObject({
      code: 'TTS_RATE_LIMITED',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('classifies an aborted request as TTS_TIMEOUT', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchImpl = vi.fn().mockRejectedValue(abortError);
    await expect(synthesizeSpeech(input, { ...baseOpts, fetchImpl, maxAttempts: 1 })).rejects.toBeInstanceOf(TtsError);
    await expect(synthesizeSpeech(input, { ...baseOpts, fetchImpl, maxAttempts: 1 })).rejects.toMatchObject({
      code: 'TTS_TIMEOUT',
    });
  });
});
