import { describe, expect, it, vi } from 'vitest';
import { localizeLesson, translateTitle } from '../pipeline/localize.js';
import { buildDocument, buildTaxonomy, buildFacts } from './fixtures.js';
import type { ChatCompleteRequest, ChatCompleteResult } from '../providers/openaiChat.js';

function makeIdentityTranslateMock() {
  return vi.fn(async (req: ChatCompleteRequest): Promise<ChatCompleteResult> => {
    const lastLine = req.messages[req.messages.length - 1]!.content.split('\n').pop()!;
    const map = JSON.parse(lastLine) as Record<string, string>;
    const translated: Record<string, string> = {};
    for (const [k, v] of Object.entries(map)) translated[k] = `EN:${v}`;
    return { content: JSON.stringify(translated), promptTokens: 5, completionTokens: 5 };
  });
}

describe('localizeLesson (string-freeze)', () => {
  const gateCtx = { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() };

  it('preserves every segment id exactly', async () => {
    const source = buildDocument();
    const translate = makeIdentityTranslateMock();
    const result = await localizeLesson(source, 'en-US', gateCtx, { translate: translate as never });

    expect(result.document.segments.map((s) => s.id)).toEqual(source.segments.map((s) => s.id));
  });

  it('leaves every answer subtree byte-identical (never sent to the translator)', async () => {
    const source = buildDocument();
    const translate = makeIdentityTranslateMock();
    const result = await localizeLesson(source, 'en-US', gateCtx, { translate: translate as never });

    for (let i = 0; i < source.segments.length; i++) {
      const before = (source.segments[i] as { answer?: unknown }).answer;
      const after = (result.document.segments[i] as { answer?: unknown }).answer;
      expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    }
  });

  it('leaves numbers (e.g. difficulty, xp) untouched', async () => {
    const source = buildDocument();
    const translate = makeIdentityTranslateMock();
    const result = await localizeLesson(source, 'en-US', gateCtx, { translate: translate as never });

    for (let i = 0; i < source.segments.length; i++) {
      expect(result.document.segments[i]!.difficulty).toBe(source.segments[i]!.difficulty);
      expect(result.document.segments[i]!.xp).toBe(source.segments[i]!.xp);
    }
  });

  it('actually translates learner-visible strings and patches meta.locale', async () => {
    const source = buildDocument();
    const translate = makeIdentityTranslateMock();
    const result = await localizeLesson(source, 'en-US', gateCtx, { translate: translate as never });

    expect(result.document.meta.locale).toBe('en-US');
    expect(result.document.meta.title.startsWith('EN:')).toBe(true);
    expect(translate).toHaveBeenCalled();
  });

  it('never sends the `answer` map to the translator at all', async () => {
    const source = buildDocument();
    const translate = makeIdentityTranslateMock();
    await localizeLesson(source, 'en-US', gateCtx, { translate: translate as never });

    const sentContent = translate.mock.calls[0]![0].messages.map((m) => m.content).join('\n');
    expect(sentContent).not.toContain('correct_option_id');
  });

  it('splits a large visible-string map into bounded atomic batches', async () => {
    const source = buildDocument();
    source.segments = Array.from({ length: 6 }, (_, index) => ({
      id: `large-${index + 1}`,
      type: 'story_scene',
      prompt_md: 'Mira la isla.',
      difficulty: 1,
      xp: 0,
      payload: { backdrop: 'base', body_md: 'x'.repeat(3_997) },
    })) as never;
    const translate = makeIdentityTranslateMock();

    const result = await localizeLesson(source, 'en-US', gateCtx, { translate: translate as never });

    expect(translate.mock.calls.length).toBeGreaterThan(1);
    for (const [request] of translate.mock.calls) {
      const lastLine = request.messages[request.messages.length - 1]!.content.split('\n').pop()!;
      const batch = JSON.parse(lastLine) as Record<string, string>;
      // A single exceptionally long string is kept whole; normal batches stay
      // within the deterministic request budget.
      if (Object.values(batch).every((value) => value.length <= 6_000)) {
        expect(JSON.stringify(batch).length).toBeLessThanOrEqual(6_100);
      }
    }
    expect((result.document.segments[0]!.payload as { body_md: string }).body_md).toBe(`EN:${'x'.repeat(3_997)}`);
  });

  it('re-translates JUST the offending string, shorter, when a translation overflows a schema max-length (production 2026-08-03: "options.1.label: Too big <=60")', async () => {
    const source = buildDocument();
    source.segments = [
      {
        id: 's-tile',
        type: 'picture_choice',
        prompt_md: '¿Cuál moneda vale más?',
        difficulty: 1,
        xp: 10,
        payload: {
          options: [
            { id: 'o1', icon: 'monetization_on', label: 'Moneda pequeña' },
            { id: 'o2', icon: 'monetization_on', label: 'Moneda grande' },
          ],
        },
        answer: { correct_option_id: 'o1' },
      },
    ] as never;

    let call = 0;
    const translate = vi.fn(async (req: ChatCompleteRequest): Promise<ChatCompleteResult> => {
      call += 1;
      const lastLine = req.messages[req.messages.length - 1]!.content.split('\n').pop()!;
      const map = JSON.parse(lastLine) as Record<string, string>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(map)) {
        // First pass: translate everything, but blow the 60-char label cap on
        // purpose for exactly ONE source string. Second pass (the corrective
        // retry) returns a compliant one for just that string.
        out[k] = call === 1 && v === 'Moneda pequeña' ? 'A very small commemorative coin, freshly minted today just for this stand' : `EN:${v}`;
      }
      return { content: JSON.stringify(out), promptTokens: 5, completionTokens: 5 };
    });

    const result = await localizeLesson(source, 'en-US', gateCtx, { translate: translate as never });

    // Never threw, never fell back to salvage — the schema is satisfied.
    const options = (result.document.segments[0]!.payload as { options: { label: string }[] }).options;
    expect(options[0]!.label.length).toBeLessThanOrEqual(60);
    expect(options[1]!.label.length).toBeLessThanOrEqual(60);
    // Exactly one extra round-trip for the single offending label — not a
    // full re-translation of the whole document.
    expect(translate).toHaveBeenCalledTimes(2);
    const retryUser = translate.mock.calls[1]![0].messages[1]!.content;
    const retrySent = JSON.parse(retryUser) as Record<string, string>;
    // Only the ONE broken key was re-sent, and re-sent as the ORIGINAL es-MX
    // source (not the over-long failed translation) so the model isn't
    // anchored on its own broken output.
    expect(Object.keys(retrySent)).toHaveLength(1);
    expect(Object.values(retrySent)[0]).toContain('Moneda');
  });

  it('falls back to the original es-MX string for a field that STILL overflows after every corrective retry — one field, not the whole lesson', async () => {
    const source = buildDocument();
    source.segments = [
      {
        id: 's-tile',
        type: 'picture_choice',
        prompt_md: '¿Cuál moneda vale más?',
        difficulty: 1,
        xp: 10,
        payload: { options: [{ id: 'o1', icon: 'monetization_on', label: 'Moneda' }, { id: 'o2', icon: 'monetization_on', label: 'Otra' }] },
        answer: { correct_option_id: 'o1' },
      },
    ] as never;
    // Every attempt (initial + every corrective retry) keeps blowing the cap.
    const translate = vi.fn(async (req: ChatCompleteRequest): Promise<ChatCompleteResult> => {
      const lastLine = req.messages[req.messages.length - 1]!.content.split('\n').pop()!;
      const map = JSON.parse(lastLine) as Record<string, string>;
      const out: Record<string, string> = {};
      for (const k of Object.keys(map)) out[k] = 'x'.repeat(200);
      return { content: JSON.stringify(out), promptTokens: 5, completionTokens: 5 };
    });

    const result = await localizeLesson(source, 'en-US', gateCtx, { translate: translate as never });

    // Never throws: the field that could never be shortened ships in its
    // ORIGINAL es-MX text rather than losing the whole lesson.
    const options = (result.document.segments[0]!.payload as { options: { label: string }[] }).options;
    expect(options[0]!.label).toBe('Moneda');
    // 1 initial + 3 corrective retries (MAX_REINJECT_ATTEMPTS).
    expect(translate).toHaveBeenCalledTimes(4);
  });
});

describe('translateTitle (topic titles — es-MX-only in curriculum YAML, filled in at publish time)', () => {
  function makePlainTranslateMock(reply: string) {
    return vi.fn(async (): Promise<ChatCompleteResult> => ({ content: reply, promptTokens: 3, completionTokens: 3 }));
  }

  it('returns the translated title, trimmed', async () => {
    const translate = makePlainTranslateMock('  The Big Idea  ');
    const result = await translateTitle('La Gran Idea', 'en-US', { translate: translate as never });
    expect(result).toBe('The Big Idea');
  });

  it('strips wrapping quotes the model sometimes adds', async () => {
    const translate = makePlainTranslateMock('"A Grande Ideia"');
    const result = await translateTitle('La Gran Idea', 'pt-BR', { translate: translate as never });
    expect(result).toBe('A Grande Ideia');
  });

  it('sends the source title as the only user content, and names the target locale', async () => {
    const translate = makePlainTranslateMock('Vendor Decisions');
    await translateTitle('Decisiones de Vendedor', 'en-US', { translate: translate as never });
    const [req] = translate.mock.calls[0]!;
    expect(req.messages.some((m) => m.content === 'Decisiones de Vendedor')).toBe(true);
    expect(req.messages.some((m) => m.content.includes('English (US)'))).toBe(true);
  });
});
