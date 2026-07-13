import { describe, expect, it, vi } from 'vitest';
import { localizeLesson } from '../pipeline/localize.js';
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
});
