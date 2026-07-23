import { describe, expect, it, vi } from 'vitest';
import { illustrateSegments } from '../pipeline/images.js';
import { ProviderNotConfiguredError, ProviderHttpError } from '../providers/errors.js';
import { buildDocument } from './fixtures.js';

function docWithPictureChoice() {
  return buildDocument({
    segments: [
      ...buildDocument().segments,
      {
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
      } as never,
    ],
  });
}

function docWithMemoryFlip() {
  return buildDocument({
    segments: [
      ...buildDocument().segments,
      {
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
      } as never,
    ],
  });
}

const okPicture = (url = 'http://localhost:4006/files/lesson-images/x.png') =>
  vi.fn().mockResolvedValue({ url, fileId: 'lesson-images/x.png', cached: false });

describe('illustrateSegments (via Prism/picturegen)', () => {
  it('skips cleanly and returns the original document unmodified when --no-images is passed', async () => {
    const doc = docWithPictureChoice();
    const request = vi.fn();
    const result = await illustrateSegments(doc, { skip: true }, { request: request as never });
    expect(result.skippedReason).toBe('flag');
    expect(result.generated).toBe(0);
    expect(request).not.toHaveBeenCalled();
    expect(result.document).toBe(doc);
  });

  it('skips cleanly when Prism is NOT_CONFIGURED, without throwing', async () => {
    const doc = docWithPictureChoice();
    const request = vi.fn().mockRejectedValue(new ProviderNotConfiguredError('picturegen'));
    const result = await illustrateSegments(doc, {}, { request: request as never });
    expect(result.skippedReason).toBe('not-configured');
    expect(result.generated).toBe(0);
    expect(result.document).toBe(doc); // untouched original
  });

  it('requests one picture per option missing image_url and embeds the returned Depot URL', async () => {
    const doc = docWithPictureChoice();
    const request = okPicture();

    const result = await illustrateSegments(doc, {}, { request: request as never });

    expect(result.generated).toBe(2);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledWith({ label: 'Ahorro', context: 'Elige la moneda correcta.', purpose: 'lesson_option' });
    const options = (result.document.segments.find((s) => s.type === 'picture_choice')!.payload as { options: { image_url?: string }[] }).options;
    expect(options.every((o) => o.image_url?.startsWith('http'))).toBe(true);
  });

  it('requests one picture per memory_flip card side, tagged memory_card', async () => {
    const doc = docWithMemoryFlip();
    const request = okPicture();

    const result = await illustrateSegments(doc, {}, { request: request as never });

    expect(result.generated).toBe(4); // 2 pairs × 2 sides
    expect(request).toHaveBeenCalledWith({ label: 'Ahorrar', context: 'Encuentra las parejas.', purpose: 'memory_card' });
    const pairs = (result.document.segments.find((s) => s.type === 'memory_flip')!.payload as { pairs: { a_image_url?: string; b_image_url?: string }[] }).pairs;
    expect(pairs.every((p) => p.a_image_url && p.b_image_url)).toBe(true);
  });

  it('skips a single failing option (icon fallback) without failing the whole lesson', async () => {
    const doc = docWithPictureChoice();
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

  it('never re-requests options that already have image_url set (consumption discipline)', async () => {
    const doc = docWithPictureChoice();
    const pictureSegment = doc.segments.find((s) => s.type === 'picture_choice')! as { payload: { options: { image_url?: string }[] } };
    pictureSegment.payload.options[0]!.image_url = 'http://localhost:4006/files/existing.png';

    const request = okPicture();
    const result = await illustrateSegments(doc, {}, { request: request as never });

    expect(request).toHaveBeenCalledTimes(1); // only the option WITHOUT image_url
    const options = (result.document.segments.find((s) => s.type === 'picture_choice')!.payload as { options: { image_url?: string }[] }).options;
    expect(options[0]!.image_url).toBe('http://localhost:4006/files/existing.png');
  });
});
