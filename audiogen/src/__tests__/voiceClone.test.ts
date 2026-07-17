import { describe, expect, it, vi } from 'vitest';
import { registerVoice } from '../tts/voiceClone.js';
import { TtsError } from '../tts/errors.js';

const baseOpts = {
  apiUrl: 'https://dashscope-intl.example/customization',
  apiKey: 'k',
  targetModel: 'qwen3-tts-vc-2026-01-22',
  sleep: async () => undefined,
  rand: () => 0,
};

const input = { audioBase64: 'ZmFrZS13YXYtYnl0ZXM=', mimeType: 'audio/wav', preferredName: 'dina-en-us' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('registerVoice', () => {
  it('accepts a direct root.voice field', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { voice: 'voice-abc123' }));
    const voiceId = await registerVoice(input, { ...baseOpts, fetchImpl });
    expect(voiceId).toBe('voice-abc123');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('accepts the output.voice fallback shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { output: { voice: 'voice-def456' } }));
    const voiceId = await registerVoice(input, { ...baseOpts, fetchImpl });
    expect(voiceId).toBe('voice-def456');
  });

  it('accepts the output.voice_id fallback shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { output: { voice_id: 'voice-ghi789' } }));
    const voiceId = await registerVoice(input, { ...baseOpts, fetchImpl });
    expect(voiceId).toBe('voice-ghi789');
  });

  it('sends the confirmed enrollment request shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { voice: 'voice-abc123' }));
    await registerVoice(input, { ...baseOpts, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      baseOpts.apiUrl,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer k' }),
      }),
    );
    const body = JSON.parse((fetchImpl.mock.calls[0]?.[1] as { body: string }).body);
    expect(body).toEqual({
      model: 'qwen-voice-enrollment',
      input: {
        action: 'create',
        target_model: baseOpts.targetModel,
        preferred_name: input.preferredName,
        audio: { data: `data:${input.mimeType};base64,${input.audioBase64}` },
      },
    });
  });

  it('throws VOICE_CLONE_BAD_RESPONSE when no recognizable voice id field is present', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { output: {} }));
    await expect(registerVoice(input, { ...baseOpts, fetchImpl })).rejects.toMatchObject({
      code: 'VOICE_CLONE_BAD_RESPONSE',
    });
  });

  it('retries on 429 then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(200, { voice: 'voice-retry-ok' }));
    const voiceId = await registerVoice(input, { ...baseOpts, fetchImpl });
    expect(voiceId).toBe('voice-retry-ok');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable 4xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { message: 'bad audio' }));
    await expect(registerVoice(input, { ...baseOpts, fetchImpl })).rejects.toMatchObject({
      code: 'VOICE_CLONE_PROVIDER_ERROR',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts on persistent 500s', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    await expect(registerVoice(input, { ...baseOpts, fetchImpl, maxAttempts: 3 })).rejects.toMatchObject({
      code: 'VOICE_CLONE_PROVIDER_ERROR',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('classifies an aborted request as VOICE_CLONE_PROVIDER_ERROR with a timeout message', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchImpl = vi.fn().mockRejectedValue(abortError);
    await expect(registerVoice(input, { ...baseOpts, fetchImpl, maxAttempts: 1 })).rejects.toBeInstanceOf(TtsError);
    await expect(registerVoice(input, { ...baseOpts, fetchImpl, maxAttempts: 1 })).rejects.toMatchObject({
      code: 'VOICE_CLONE_PROVIDER_ERROR',
      message: expect.stringContaining('timed out'),
    });
  });
});
