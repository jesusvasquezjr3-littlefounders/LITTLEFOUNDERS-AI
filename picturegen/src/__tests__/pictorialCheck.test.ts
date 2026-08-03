import { describe, expect, it, vi } from 'vitest';
import { parseInspection, parseVerdict, verifyPictorial } from '../verify/pictorialCheck.js';

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

describe('parseInspection', () => {
  it('retains only the mechanical defect flags for operational diagnosis', () => {
    expect(parseInspection('{"has_text": true, "has_person": false, "found": "wordmark"}')).toEqual({
      verdict: 'defect', hasText: true, hasPerson: false,
    });
    expect(parseInspection('{"has_text": false, "has_person": true, "found": "child"}')).toEqual({
      verdict: 'defect', hasText: false, hasPerson: true,
    });
  });

  it('does not treat a partial all-clear reply as a clean image', () => {
    expect(parseInspection('{"has_text": false}')).toEqual({ verdict: 'unavailable', hasText: false, hasPerson: null });
  });
});

describe('verifyPictorial', () => {
  it('sends the image as a base64 data URL and returns the structured inspection', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse('{"has_text": true, "has_person": false, "found": "wordmark"}'));
    const inspection = await verifyPictorial(Buffer.from([1, 2, 3]), 'image/png', { ...OPTS, fetchImpl });

    expect(inspection).toEqual({ verdict: 'defect', hasText: true, hasPerson: false });
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
    await expect(verifyPictorial(Buffer.from([1]), 'image/png', { ...OPTS, fetchImpl: httpFail })).resolves.toEqual({ verdict: 'unavailable', hasText: null, hasPerson: null });

    const netFail = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(verifyPictorial(Buffer.from([1]), 'image/png', { ...OPTS, fetchImpl: netFail })).resolves.toEqual({ verdict: 'unavailable', hasText: null, hasPerson: null });
  });
});
