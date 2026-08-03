import { describe, expect, it, vi } from 'vitest';
import {
  BASE_NEGATIVE_CORE,
  baseNegativeFor,
  craftImagePrompt,
  fallbackPrompt,
  LF_VISUAL_IDENTITY,
  mergeNegative,
  OBJECT_TILE_NEGATIVE_EXTENSION,
  OBJECT_TILE_PURPOSES,
  PICTORIAL_CLAUSE,
  PICTURE_PURPOSES,
} from '../judge/promptJudge.js';
import { MAX_NEGATIVE_PROMPT_CHARS } from '../gen/qwenImageClient.js';

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
    // Non-tile purposes must never receive anti-scenery/anti-background terms
    // that fight their own positive prompt.
    expect(crafted.negative).not.toContain('scenery');
    expect(crafted.negative).not.toContain('background');
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
    // 'silhouette' is banned from the tile prompt: qwen-image-max reads it as
    // monochrome-icon-on-a-dark-field (live 46% tile failure on the inversion).
    expect(crafted.prompt).not.toContain('silhouette');
    expect(crafted.prompt).toContain('Single brightly colored object: Helado');
    expect(crafted.prompt).toContain('Solid pure white #FFFFFF background filling the entire canvas to all four edges');
    expect(crafted.prompt).toContain('Flat 2D animated vector illustration');
    expect(crafted.prompt).toContain('clean geometric shapes');
    expect(crafted.prompt).toContain('No other objects, text, logo or people');
    expect(crafted.prompt).not.toContain('LittleFounders');
    expect(crafted.prompt).not.toContain('colored backdrop');
    expect(crafted.negative).toContain('3d render');
    expect(crafted.prompt).not.toContain('reserve Purely');
    expect(crafted.negative).toContain('person');
    // Tiles DO get the anti-scenery / non-white-canvas extension.
    expect(crafted.negative).toContain('scenery');
    expect(crafted.negative).toContain('gray background');
  });

  it('keeps every object-tile purpose on the same white-canvas contract', async () => {
    const purposes = ['item_card', 'option_card', 'lesson_option', 'memory_card'] as const;
    for (const purpose of purposes) {
      const fetchImpl = vi.fn();
      const crafted = await craftImagePrompt({ label: 'Moneda', purpose }, { ...opts, fetchImpl });
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(crafted.prompt).toContain('Solid pure white #FFFFFF background filling the entire canvas to all four edges');
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

describe('OBJECT_TILE_PURPOSES — single source of truth', () => {
  it('pins membership to exactly the four tile purposes', () => {
    // service/pictures.ts imports this set for its cache-key collapse; the
    // membership is a cache-correctness invariant, so it is pinned here.
    expect([...OBJECT_TILE_PURPOSES].sort()).toEqual(['item_card', 'lesson_option', 'memory_card', 'option_card']);
  });

  it('every tile purpose is a valid picture purpose', () => {
    for (const purpose of OBJECT_TILE_PURPOSES) {
      expect(PICTURE_PURPOSES).toContain(purpose);
    }
  });
});

describe('baseNegativeFor — purpose-aware base negative', () => {
  it('keeps both variants well under the 500-char provider cap', () => {
    // The core must leave a real remainder for judge extras inside the
    // DashScope cap; the tile variant never receives judge extras (tiles skip
    // the judge) so it may use nearly the whole cap, but must still fit whole.
    expect(BASE_NEGATIVE_CORE.length).toBeLessThanOrEqual(300);
    expect(baseNegativeFor('item_card').length).toBeLessThanOrEqual(500);
    expect(baseNegativeFor('item_card')).toBe(`${BASE_NEGATIVE_CORE}, ${OBJECT_TILE_NEGATIVE_EXTENSION}`);
  });

  it('sends the common core (people / 3D / text / watermark) to EVERY purpose', () => {
    for (const purpose of PICTURE_PURPOSES) {
      const negative = baseNegativeFor(purpose);
      for (const term of ['person', 'people', 'child', 'face', 'mascot', '3d render', 'photorealistic', 'text', 'letters', 'logo', 'watermark']) {
        expect(negative).toContain(term);
      }
    }
  });

  it('covers rendered digits and captions for EVERY purpose (recorded live failure: "10 peces + 10 peces")', () => {
    for (const purpose of PICTURE_PURPOSES) {
      const negative = baseNegativeFor(purpose);
      for (const term of ['captions', 'words', 'numbers', 'numerals']) {
        expect(negative).toContain(term);
      }
    }
  });

  it('tile negative negates scenery and non-white canvases (gray/off-white/cream/colored)', () => {
    for (const purpose of OBJECT_TILE_PURPOSES) {
      const negative = baseNegativeFor(purpose);
      expect(negative).toContain('scenery');
      for (const term of ['gray background', 'off-white background', 'cream background', 'colored background']) {
        expect(negative).toContain(term);
      }
    }
  });

  it('scene purposes get the core but NO anti-scenery / anti-background terms', () => {
    for (const purpose of ['scene_anchor', 'scene', 'outcome', 'generic'] as const) {
      const negative = baseNegativeFor(purpose);
      expect(negative).toBe(BASE_NEGATIVE_CORE);
      // A wide establishing scene's positive prompt demands scenery and a
      // complete background — the negative must never fight it.
      expect(negative).not.toContain('scenery');
      expect(negative).not.toContain('background');
    }
  });

  it('an undefined purpose behaves as generic (core only)', () => {
    expect(baseNegativeFor(undefined)).toBe(BASE_NEGATIVE_CORE);
  });
});

describe('mergeNegative — provider cap budgeting', () => {
  it('returns the purpose base unchanged without judge extras', () => {
    expect(mergeNegative()).toBe(BASE_NEGATIVE_CORE);
    expect(mergeNegative('   ')).toBe(BASE_NEGATIVE_CORE);
    expect(mergeNegative(undefined, 'item_card')).toBe(baseNegativeFor('item_card'));
  });

  it('appends judge extras whole when they fit the remaining budget', () => {
    const merged = mergeNegative('blurry, scary', 'scene');
    expect(merged).toBe(`${BASE_NEGATIVE_CORE}, blurry, scary`);
    expect(merged.length).toBeLessThanOrEqual(MAX_NEGATIVE_PROMPT_CHARS);
  });

  it('truncates over-budget judge extras at a comma boundary, never mid-token', () => {
    const terms = Array.from({ length: 40 }, (_, i) => `judgeterm${String(i).padStart(2, '0')}`);
    const base = baseNegativeFor('scene');
    const merged = mergeNegative(terms.join(', '), 'scene');
    expect(merged.length).toBeLessThanOrEqual(MAX_NEGATIVE_PROMPT_CHARS);
    expect(merged.startsWith(`${base}, `)).toBe(true);
    const kept = merged.slice(base.length + 2).split(', ');
    expect(kept.length).toBeGreaterThan(0);
    // Every surviving extra is a whole term — the clip point is a comma.
    expect(kept).toEqual(terms.slice(0, kept.length));
    // The tile variant fills nearly the whole cap (and deterministic tiles
    // never carry judge extras): extras that cannot fit are dropped WHOLE.
    const tileMerged = mergeNegative(terms.join(', '), 'item_card');
    expect(tileMerged.length).toBeLessThanOrEqual(MAX_NEGATIVE_PROMPT_CHARS);
    expect(tileMerged.startsWith(baseNegativeFor('item_card'))).toBe(true);
    expect(tileMerged).not.toContain('judgeterm0'.slice(0, -1) + '…');
  });

  it('drops an extra that cannot fit rather than slicing it', () => {
    expect(mergeNegative('x'.repeat(600))).toBe(BASE_NEGATIVE_CORE);
    expect(mergeNegative('x'.repeat(600), 'memory_card')).toBe(baseNegativeFor('memory_card'));
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
