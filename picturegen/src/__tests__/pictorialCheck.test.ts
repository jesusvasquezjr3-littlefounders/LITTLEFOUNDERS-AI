import { describe, expect, it, vi } from 'vitest';
import { parseVerdict, verifyPictorial } from '../verify/pictorialCheck.js';

const OPTS = { apiBase: 'https://judge.example/v1', apiKey: 'k', model: 'qwen-vl-plus' };

function chatResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseVerdict', () => {
  it('parses strict JSON verdicts', () => {
    expect(parseVerdict('{"has_text": true, "has_person": false, "found": "Founters sign"}')).toBe('defect');
    expect(parseVerdict('{"has_text": false, "has_person": true, "found": "a smiling boy"}')).toBe('defect');
    expect(parseVerdict('{"has_text": false, "has_person": false, "found": ""}')).toBe('clean');
  });

  it('recovers the flag from prose/fenced wrappers via regex', () => {
    expect(parseVerdict('```json\n{"has_text": true, "has_person": false, "found": "1 peso"}\n```')).toBe('defect');
    expect(parseVerdict('Sure! {"has_text": false, "has_person": false, "found": ""}')).toBe('clean');
  });

  it('returns unavailable for garbage or empty content', () => {
    expect(parseVerdict('the image looks nice')).toBe('unavailable');
    expect(parseVerdict('')).toBe('unavailable');
    expect(parseVerdict(null)).toBe('unavailable');
    // Boolean-typed flag only — a string "true" is not a confident verdict.
    expect(parseVerdict('{"has_text": "maybe"}')).toBe('unavailable');
  });
});

describe('verifyPictorial', () => {
  it('sends the image as a base64 data URL and returns the parsed verdict', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse('{"has_text": true, "has_person": false, "found": "wordmark"}'));
    const verdict = await verifyPictorial(Buffer.from([1, 2, 3]), 'image/png', { ...OPTS, fetchImpl });

    expect(verdict).toBe('defect');
    expect(fetchImpl).toHaveBeenCalledWith('https://judge.example/v1/chat/completions', expect.any(Object));
    const body = JSON.parse((fetchImpl.mock.calls[0]![1] as { body: string }).body) as {
      model: string;
      messages: { content: { type: string; image_url?: { url: string } }[] }[];
    };
    expect(body.model).toBe('qwen-vl-plus');
    const imagePart = body.messages[0]!.content.find((p) => p.type === 'image_url');
    expect(imagePart?.image_url?.url).toBe(`data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`);
  });

  it('never blocks: HTTP errors and network failures are unavailable, not throws', async () => {
    const httpFail = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
    await expect(verifyPictorial(Buffer.from([1]), 'image/png', { ...OPTS, fetchImpl: httpFail })).resolves.toBe('unavailable');

    const netFail = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(verifyPictorial(Buffer.from([1]), 'image/png', { ...OPTS, fetchImpl: netFail })).resolves.toBe('unavailable');
  });
});
