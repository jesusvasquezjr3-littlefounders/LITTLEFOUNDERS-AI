import { describe, expect, it, vi } from 'vitest';
import { illustrateSegments } from '../pipeline/images.js';
import { ProviderNotConfiguredError, ProviderHttpError } from '../providers/errors.js';
import { buildDocument } from './fixtures.js';

// Focused documents: ONE segment under test (no base-segment noise), so target
// counts are deterministic as illustrate coverage grows.
function docWith(segment: unknown) {
  return buildDocument({ segments: [segment] as never });
}

function pictureChoiceSeg() {
  return {
    id: 'pc1',
    type: 'picture_choice',
    prompt_md: 'Elige la moneda correcta.',
    difficulty: 1,
    xp: 10,
    payload: {
      options: [
        { id: 'o1', icon: 'savings', label: 'Ahorro' },
        { id: 'o2', icon: 'shopping_bag', label: 'Gasto' },
      ],
    },
    answer: { correct_option_id: 'o1' },
  };
}

function memoryFlipSeg() {
  return {
    id: 'mf1',
    type: 'memory_flip',
    prompt_md: 'Encuentra las parejas.',
    difficulty: 1,
    xp: 10,
    payload: {
      pairs: [
        { a_md: 'Ahorrar', a_icon: 'savings', b_md: 'Guardar dinero', b_icon: 'account_balance_wallet' },
        { a_md: 'Gastar', a_icon: 'shopping_cart', b_md: 'Comprar algo', b_icon: 'payments' },
      ],
    },
  };
}

function needsWantsSeg() {
  return {
    id: 'nw1',
    type: 'needs_wants',
    prompt_md: 'Clasifica.',
    difficulty: 1,
    xp: 10,
    payload: {
      items: [
        { id: 'limones', text_md: '**Limones**', icon: 'nutrition' },
        { id: 'comic', text_md: 'Cómic', icon: 'menu_book' },
      ],
    },
    answer: { needs_ids: ['limones'] },
  };
}

function bestDecisionSeg() {
  return {
    id: 'bd1',
    type: 'best_decision',
    prompt_md: 'Liruf recibe un billete grande.',
    difficulty: 2,
    xp: 15,
    payload: {
      scenario_md: 'Una clienta paga.',
      options: [
        { id: 'a', text_md: 'Contar el cambio', rationale_md: 'bien' },
        { id: 'b', text_md: 'Adivinar', rationale_md: 'mal' },
      ],
    },
    answer: { qualities: { a: 100, b: 0 } },
  };
}

const okPicture = (url = 'http://localhost:4006/files/lesson-images/x.png') =>
  vi.fn().mockResolvedValue({ url, fileId: 'lesson-images/x.png', cached: false });

describe('illustrateSegments (via Prism/picturegen)', () => {
  it('skips cleanly and returns the original document unmodified when --no-images is passed', async () => {
    const doc = docWith(pictureChoiceSeg());
    const request = vi.fn();
    const result = await illustrateSegments(doc, { skip: true }, { request: request as never });
    expect(result.skippedReason).toBe('flag');
    expect(result.generated).toBe(0);
    expect(request).not.toHaveBeenCalled();
    expect(result.document).toBe(doc);
  });

  it('skips cleanly when Prism is NOT_CONFIGURED, without throwing', async () => {
    const doc = docWith(pictureChoiceSeg());
    const request = vi.fn().mockRejectedValue(new ProviderNotConfiguredError('picturegen'));
    const result = await illustrateSegments(doc, {}, { request: request as never });
    expect(result.skippedReason).toBe('not-configured');
    expect(result.generated).toBe(0);
    expect(result.document).toBe(doc); // untouched original
  });

  it('illustrates each picture_choice option as an option_card and embeds the Depot URL', async () => {
    const doc = docWith(pictureChoiceSeg());
    const request = okPicture();

    const result = await illustrateSegments(doc, {}, { request: request as never });

    expect(result.generated).toBe(2);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledWith({ label: 'Ahorro', context: 'Elige la moneda correcta.', purpose: 'option_card' });
    const options = (result.document.segments.find((s) => s.type === 'picture_choice')!.payload as { options: { image_url?: string }[] }).options;
    expect(options.every((o) => o.image_url?.startsWith('http'))).toBe(true);
  });

  it('illustrates each memory_flip card side, tagged memory_card', async () => {
    const doc = docWith(memoryFlipSeg());
    const request = okPicture();

    const result = await illustrateSegments(doc, {}, { request: request as never });

    expect(result.generated).toBe(4); // 2 pairs × 2 sides
    expect(request).toHaveBeenCalledWith({ label: 'Ahorrar', context: 'Encuentra las parejas.', purpose: 'memory_card' });
    const pairs = (result.document.segments.find((s) => s.type === 'memory_flip')!.payload as { pairs: { a_image_url?: string; b_image_url?: string }[] }).pairs;
    expect(pairs.every((p) => p.a_image_url && p.b_image_url)).toBe(true);
  });

  it('illustrates needs_wants items as item_cards, stripping markdown from the label', async () => {
    const doc = docWith(needsWantsSeg());
    const request = okPicture();

    const result = await illustrateSegments(doc, {}, { request: request as never });

    expect(result.generated).toBe(2);
    // Markdown emphasis stripped so the judge sees a clean object name.
    expect(request).toHaveBeenCalledWith({ label: 'Limones', context: 'Clasifica.', purpose: 'item_card' });
    const items = (result.document.segments.find((s) => s.type === 'needs_wants')!.payload as { items: { image_url?: string }[] }).items;
    expect(items.every((i) => i.image_url?.startsWith('http'))).toBe(true);
  });

  it('gives scene-worthy types a segment-level scene_anchor illustration', async () => {
    const doc = docWith(bestDecisionSeg());
    const request = okPicture();

    const result = await illustrateSegments(doc, {}, { request: request as never });

    expect(result.generated).toBe(1);
    expect(request).toHaveBeenCalledWith({
      label: 'Liruf recibe un billete grande.',
      context: 'Liruf recibe un billete grande.',
      purpose: 'scene_anchor',
    });
    const seg = result.document.segments.find((s) => s.type === 'best_decision')! as { image_url?: string };
    expect(seg.image_url?.startsWith('http')).toBe(true);
  });

  it('skips a single failing target (icon fallback) without failing the whole lesson', async () => {
    const doc = docWith(pictureChoiceSeg());
    const request = vi.fn().mockRejectedValue(new ProviderHttpError('picturegen', 502, 'upstream quota'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await illustrateSegments(doc, {}, { request: request as never });

    expect(result.generated).toBe(0);
    expect(result.skippedReason).toBeUndefined();
    const options = (result.document.segments.find((s) => s.type === 'picture_choice')!.payload as { options: { image_url?: string }[] }).options;
    expect(options.every((o) => o.image_url === undefined)).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('never re-requests a slot that already has image_url set (consumption discipline)', async () => {
    const seg = pictureChoiceSeg();
    seg.payload.options[0]!.image_url = 'http://localhost:4006/files/existing.png';
    const doc = docWith(seg);

    const request = okPicture();
    const result = await illustrateSegments(doc, {}, { request: request as never });

    expect(request).toHaveBeenCalledTimes(1); // only the option WITHOUT image_url
    const options = (result.document.segments.find((s) => s.type === 'picture_choice')!.payload as { options: { image_url?: string }[] }).options;
    expect(options[0]!.image_url).toBe('http://localhost:4006/files/existing.png');
  });
});
