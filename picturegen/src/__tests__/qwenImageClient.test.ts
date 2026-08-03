import { describe, expect, it, vi } from 'vitest';
import { downloadImage, generateImage } from '../gen/qwenImageClient.js';
import { ImageError } from '../gen/errors.js';

const baseOpts = {
  apiBase: 'https://dashscope-intl.example',
  apiKey: 'k',
  model: 'qwen-image',
  size: '1024*1024',
  sleep: async () => undefined,
  rand: () => 0,
  pollIntervalMs: 1,
  timeoutMs: 120_000,
};

const input = { prompt: 'a jar of coins in the sun' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function imageResponse(): Response {
  return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'image/png' } });
}

describe('generateImage', () => {
  it('submits, polls until SUCCEEDED, downloads bytes — retrying a 429 on submit', async () => {
    let submitCalls = 0;
    const fetchImpl = vi.fn();
    fetchImpl.mockImplementation(async (url: string) => {
      if (url.includes('image-synthesis')) {
        submitCalls += 1;
        if (submitCalls === 1) return jsonResponse(429, {});
        return jsonResponse(200, { output: { task_id: 't1', task_status: 'PENDING' } });
      }
      if (url.includes('/tasks/')) {
        return jsonResponse(200, { output: { task_status: 'SUCCEEDED', results: [{ url: 'https://img.example/x.png' }] } });
      }
      return imageResponse();
    });

    const image = await generateImage(input, { ...baseOpts, fetchImpl });

    expect(submitCalls).toBe(2);
    expect(image.contentType).toBe('image/png');
    expect(image.bytes).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it('uses the synchronous multimodal endpoint for qwen-image-max', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('multimodal-generation')) {
        const request = JSON.parse(String(init?.body)) as { model: string; input: { messages: { content: { text: string }[] }[] }; parameters: { n: number; size: string; negative_prompt?: string } };
        expect(request.model).toBe('qwen-image-max');
        expect(request.input.messages[0]?.content[0]?.text).toBe(input.prompt);
        expect(request.parameters.n).toBe(1);
        expect(request.parameters.size).toBe('1328*1328');
        expect(request.parameters.negative_prompt?.length).toBeLessThanOrEqual(500);
        return jsonResponse(200, { output: { choices: [{ message: { content: [{ image: 'https://img.example/max.png' }] } }] } });
      }
      return imageResponse();
    });

    const image = await generateImage(
      { ...input, negativePrompt: 'x'.repeat(700) },
      { ...baseOpts, model: 'qwen-image-max', size: '1328*1328', fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(image.bytes).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it('waits through PENDING/RUNNING before SUCCEEDED', async () => {
    let pollCalls = 0;
    const fetchImpl = vi.fn();
    fetchImpl.mockImplementation(async (url: string) => {
      if (url.includes('image-synthesis')) return jsonResponse(200, { output: { task_id: 't2' } });
      if (url.includes('/tasks/')) {
        pollCalls += 1;
        if (pollCalls < 3) return jsonResponse(200, { output: { task_status: 'RUNNING' } });
        return jsonResponse(200, { output: { task_status: 'SUCCEEDED', results: [{ url: 'https://img.example/y.png' }] } });
      }
      return imageResponse();
    });

    const image = await generateImage(input, { ...baseOpts, fetchImpl });
    expect(pollCalls).toBe(3);
    expect(image.bytes.length).toBe(4);
  });

  it('does not retry a non-retryable 4xx on submit → IMAGE_PROVIDER_ERROR', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { message: 'bad prompt' }));
    await expect(generateImage(input, { ...baseOpts, fetchImpl })).rejects.toMatchObject({ code: 'IMAGE_PROVIDER_ERROR' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts on persistent 500s → IMAGE_RATE_LIMITED', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    await expect(generateImage(input, { ...baseOpts, fetchImpl, maxAttempts: 3 })).rejects.toMatchObject({
      code: 'IMAGE_RATE_LIMITED',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('throws IMAGE_BAD_RESPONSE when submit returns no task_id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { output: {} }));
    await expect(generateImage(input, { ...baseOpts, fetchImpl })).rejects.toMatchObject({ code: 'IMAGE_BAD_RESPONSE' });
  });

  it('throws IMAGE_PROVIDER_ERROR when the task FAILED', async () => {
    const fetchImpl = vi.fn();
    fetchImpl.mockImplementation(async (url: string) => {
      if (url.includes('image-synthesis')) return jsonResponse(200, { output: { task_id: 't3' } });
      return jsonResponse(200, { output: { task_status: 'FAILED', message: 'content filtered' } });
    });
    await expect(generateImage(input, { ...baseOpts, fetchImpl })).rejects.toMatchObject({ code: 'IMAGE_PROVIDER_ERROR' });
  });

  it('classifies an aborted request as IMAGE_TIMEOUT', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchImpl = vi.fn().mockRejectedValue(abortError);
    await expect(generateImage(input, { ...baseOpts, fetchImpl, maxAttempts: 1 })).rejects.toMatchObject({
      code: 'IMAGE_TIMEOUT',
    });
  });
});

describe('downloadImage', () => {
  it('returns bytes and the response content-type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([9, 9]), { status: 200, headers: { 'content-type': 'image/webp' } }),
    );
    const image = await downloadImage('https://img.example/z.webp', fetchImpl);
    expect(image.contentType).toBe('image/webp');
    expect(image.bytes).toEqual(Buffer.from([9, 9]));
  });

  it('throws IMAGE_DOWNLOAD_FAILED on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('nope', { status: 403 }));
    await expect(downloadImage('https://img.example/z.png', fetchImpl)).rejects.toBeInstanceOf(ImageError);
    await expect(downloadImage('https://img.example/z.png', fetchImpl)).rejects.toMatchObject({
      code: 'IMAGE_DOWNLOAD_FAILED',
    });
  });
});
