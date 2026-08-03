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
