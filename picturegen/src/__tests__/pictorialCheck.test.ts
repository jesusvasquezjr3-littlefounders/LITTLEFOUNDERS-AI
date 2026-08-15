import { describe, expect, it, vi } from 'vitest';
import { parseInspection, parseVerdict, verifyInstruction, verifyPictorial } from '../verify/pictorialCheck.js';

const OPTS = { apiBase: 'https://judge.example/v1', apiKey: 'k', model: 'qwen-vl-plus' };

function chatResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The text part of the single chat message the verifier posts. */
function instructionOf(fetchImpl: { mock: { calls: unknown[][] } }): string {
  const body = JSON.parse((fetchImpl.mock.calls[0]![1] as { body: string }).body) as {
    messages: { content: { type: string; text?: string }[] }[];
  };
  return body.messages[0]!.content.find((p) => p.type === 'text')?.text ?? '';
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
      verdict: 'defect', hasText: true, hasPerson: false, depictsSubject: null,
    });
    expect(parseInspection('{"has_text": false, "has_person": true, "found": "child"}')).toEqual({
      verdict: 'defect', hasText: false, hasPerson: true, depictsSubject: null,
    });
  });

  it('does not treat a partial all-clear reply as a clean image', () => {
    expect(parseInspection('{"has_text": false}')).toEqual({
      verdict: 'unavailable', hasText: false, hasPerson: null, depictsSubject: null,
    });
  });

  // The defect this whole check exists for: form is perfect, content is wrong.
  it('fails a text-free, people-free image that depicts the wrong subject', () => {
    expect(parseInspection('{"has_text": false, "has_person": false, "depicts_subject": false, "found": "a drinks stand"}')).toEqual({
      verdict: 'defect', hasText: false, hasPerson: false, depictsSubject: false,
    });
  });

  it('passes when the subject matches', () => {
    expect(parseInspection('{"has_text": false, "has_person": false, "depicts_subject": true, "found": ""}')).toEqual({
      verdict: 'clean', hasText: false, hasPerson: false, depictsSubject: true,
    });
  });

  /*
   * Asymmetry guard: a verifier that ignores the new question must keep
   * producing clean verdicts. Treating a missing answer as a failure would
   * have turned every quiet model into an infinite paid redraw loop.
   */
  it('still calls an image clean when the model omits the subject answer', () => {
    expect(parseInspection('{"has_text": false, "has_person": false, "found": ""}')).toEqual({
      verdict: 'clean', hasText: false, hasPerson: false, depictsSubject: null,
    });
  });

  it('recovers the subject answer from a fenced/prose wrapper', () => {
    expect(parseInspection('```json\n{"has_text": false, "has_person": false, "depicts_subject": false}\n```').verdict).toBe('defect');
  });
});

describe('verifyPictorial', () => {
  it('sends the image as a base64 data URL and returns the structured inspection', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse('{"has_text": true, "has_person": false, "found": "wordmark"}'));
    const inspection = await verifyPictorial(Buffer.from([1, 2, 3]), 'image/png', { ...OPTS, fetchImpl });

    expect(inspection).toEqual({ verdict: 'defect', hasText: true, hasPerson: false, depictsSubject: null });
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
    const unavailable = { verdict: 'unavailable', hasText: null, hasPerson: null, depictsSubject: null };
    const httpFail = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
    await expect(verifyPictorial(Buffer.from([1]), 'image/png', { ...OPTS, fetchImpl: httpFail })).resolves.toEqual(unavailable);

    const netFail = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(verifyPictorial(Buffer.from([1]), 'image/png', { ...OPTS, fetchImpl: netFail })).resolves.toEqual(unavailable);
  });

  it('asks the subject question only when a subject is supplied', async () => {
    const withSubject = vi.fn().mockResolvedValue(chatResponse('{"has_text": false, "has_person": false, "depicts_subject": true}'));
    await verifyPictorial(Buffer.from([1]), 'image/png', { ...OPTS, subject: 'El mostrador del banco', fetchImpl: withSubject });
    const asked = instructionOf(withSubject);
    expect(asked).toContain('El mostrador del banco');
    expect(asked).toContain('depicts_subject');

    const without = vi.fn().mockResolvedValue(chatResponse('{"has_text": false, "has_person": false}'));
    await verifyPictorial(Buffer.from([1]), 'image/png', { ...OPTS, fetchImpl: without });
    expect(instructionOf(without)).not.toContain('depicts_subject');
  });

  // The subject is lesson prose reaching a prompt: collapse whitespace and cap
  // it, so a runaway label can never swamp the instruction it sits inside.
  it('normalizes and truncates a long subject', () => {
    const long = `${'a'.repeat(400)}\n\n   b`;
    const instruction = verifyInstruction(long);
    expect(instruction).not.toContain('\n\n');
    expect(instruction).toContain('a'.repeat(300));
    expect(instruction).not.toContain('a'.repeat(301));
  });
});
