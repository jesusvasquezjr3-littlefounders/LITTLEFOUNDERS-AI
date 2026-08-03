import { describe, expect, it, vi } from 'vitest';
import { openAiCompatibleComplete } from '../providers/openaiChat.js';
import { ProviderTimeoutError } from '../providers/errors.js';

describe('openAiCompatibleComplete', () => {
  it('applies the configured timeout to the complete retry series, not each retry', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init.signal as AbortSignal;
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    })));
    const startedAt = Date.now();

    await expect(openAiCompatibleComplete(
      { providerName: 'test', baseUrl: 'https://provider.test/v1', apiKey: 'test-key', model: 'test-model', timeoutMs: 25 },
      { messages: [{ role: 'user', content: 'Write one sentence.' }], temperature: 0 },
    )).rejects.toBeInstanceOf(ProviderTimeoutError);

    // The old retry wrapper spent the timeout once per attempt; a little
    // scheduling slack is allowed, but it must not start a second full window.
    expect(Date.now() - startedAt).toBeLessThan(150);
    vi.unstubAllGlobals();
  });

  it('times out when headers arrive but the response body never finishes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => new Promise<string>(() => undefined),
    }));
    const startedAt = Date.now();

    await expect(openAiCompatibleComplete(
      { providerName: 'test', baseUrl: 'https://provider.test/v1', apiKey: 'test-key', model: 'test-model', timeoutMs: 25 },
      { messages: [{ role: 'user', content: 'Write one sentence.' }], temperature: 0 },
    )).rejects.toBeInstanceOf(ProviderTimeoutError);

    expect(Date.now() - startedAt).toBeLessThan(150);
    vi.unstubAllGlobals();
  });

  it('times out even when a provider ignores abort before sending headers', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    const startedAt = Date.now();

    await expect(openAiCompatibleComplete(
      { providerName: 'test', baseUrl: 'https://provider.test/v1', apiKey: 'test-key', model: 'test-model', timeoutMs: 25 },
      { messages: [{ role: 'user', content: 'Write one sentence.' }], temperature: 0 },
    )).rejects.toBeInstanceOf(ProviderTimeoutError);

    expect(Date.now() - startedAt).toBeLessThan(150);
    vi.unstubAllGlobals();
  });
});
