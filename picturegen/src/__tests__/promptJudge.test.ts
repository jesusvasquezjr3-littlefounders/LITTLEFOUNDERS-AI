import { describe, expect, it, vi } from 'vitest';
import { craftImagePrompt, fallbackPrompt, LF_VISUAL_IDENTITY, PICTORIAL_CLAUSE } from '../judge/promptJudge.js';

const opts = { apiBase: 'https://judge.example/v1', apiKey: 'k', model: 'qwen-plus' };

function chatResponse(status: number, content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

describe('craftImagePrompt', () => {
  it('returns the judge JSON {prompt, negative}', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(chatResponse(200, JSON.stringify({ prompt: 'A sunny lemonade stand with a jar of coins', negative: 'text, watermark' })));
    const crafted = await craftImagePrompt({ label: 'a jar of coins', purpose: 'generic' }, { ...opts, fetchImpl });
    expect(crafted.prompt).toBe('A sunny lemonade stand with a jar of coins.' + PICTORIAL_CLAUSE);
    // Judge negatives EXTEND the non-negotiable base list (no text/logos).
    expect(crafted.negative).toContain('logo');
    expect(crafted.negative).toContain('watermark');
    expect(crafted.negative?.endsWith('text, watermark')).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('clamps an over-long judge prompt to 800 chars', async () => {
    const long = 'lemon '.repeat(300); // ~1800 chars
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse(200, JSON.stringify({ prompt: long })));
    const crafted = await craftImagePrompt({ label: 'lemons' }, { ...opts, fetchImpl });
    expect(crafted.prompt.endsWith(PICTORIAL_CLAUSE)).toBe(true);
    expect(crafted.prompt.length).toBeLessThanOrEqual(800);
  });

  it('falls back deterministically on a judge HTTP error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse(500, ''));
    const crafted = await craftImagePrompt({ label: 'a piggy bank', context: 'saving money for later' }, { ...opts, fetchImpl });
    expect(crafted).toEqual(fallbackPrompt({ label: 'a piggy bank', context: 'saving money for later' }));
    expect(crafted.prompt).toContain('a piggy bank');
    expect(crafted.prompt).toContain(LF_VISUAL_IDENTITY.slice(0, 300));
    // HTTP error retried up to the 2-attempt ceiling before falling back.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('uses no art-director network call for a constrained object tile', async () => {
    const fetchImpl = vi.fn();
    const crafted = await craftImagePrompt({ label: 'Helado', purpose: 'item_card' }, { ...opts, fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(crafted.prompt).toContain('Single object: Helado');
    expect(crafted.prompt).toContain('Solid pure white #FFFFFF background filling all four edges');
    expect(crafted.prompt).toContain('Flat 2D animated vector illustration');
    expect(crafted.prompt).toContain('clean geometric shapes');
    expect(crafted.prompt).toContain('No other objects, text, logo or people');
    expect(crafted.prompt).not.toContain('LittleFounders');
    expect(crafted.prompt).not.toContain('colored backdrop');
    expect(crafted.negative).toContain('3d render');
    expect(crafted.prompt).not.toContain('reserve Purely');
    expect(crafted.negative).toContain('person');
  });

  it('keeps every object-tile purpose on the same white-canvas contract', async () => {
    const purposes = ['item_card', 'option_card', 'lesson_option', 'memory_card'] as const;
    for (const purpose of purposes) {
      const fetchImpl = vi.fn();
      const crafted = await craftImagePrompt({ label: 'Moneda', purpose }, { ...opts, fetchImpl });
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(crafted.prompt).toContain('Solid pure white #FFFFFF background filling all four edges');
      expect(crafted.prompt).toContain('Flat 2D animated vector illustration');
      expect(crafted.prompt).not.toContain('LittleFounders');
    }
  });

  it('falls back when the judge returns unparseable JSON twice', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(chatResponse(200, 'not json at all'));
    const crafted = await craftImagePrompt({ label: 'a market stall' }, { ...opts, fetchImpl });
    expect(crafted.prompt).toContain('a market stall');
    expect(crafted.prompt).toContain(LF_VISUAL_IDENTITY.slice(0, 300));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('falls back when the network throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const crafted = await craftImagePrompt({ label: 'coins' }, { ...opts, fetchImpl });
    expect(crafted.prompt).toContain('coins');
  });
});

describe('fallbackPrompt', () => {
  it('embeds label + context slice + identity', () => {
    const crafted = fallbackPrompt({ label: 'a lemon', context: 'x'.repeat(400) });
    expect(crafted.prompt.startsWith('a lemon — ')).toBe(true);
    // context is sliced to 160 chars.
    expect(crafted.prompt).toContain('x'.repeat(160));
    expect(crafted.prompt).not.toContain('x'.repeat(161));
  });

  it('omits the dash when there is no context', () => {
    const crafted = fallbackPrompt({ label: 'a lemon' });
    expect(crafted.prompt.startsWith('a lemon. ')).toBe(true);
  });
});
