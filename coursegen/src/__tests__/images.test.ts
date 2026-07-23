import { describe, expect, it, vi } from 'vitest';
import { illustrateSegments } from '../pipeline/images.js';
import { ProviderNotConfiguredError } from '../providers/errors.js';
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

describe('illustrateSegments', () => {
  it('generates and uploads an image per memory_flip card side missing image_url', async () => {
    const doc = docWithMemoryFlip();
    const generate = vi.fn().mockResolvedValue({ pngBuffer: Buffer.from('fake-png') });
    const upload = vi.fn().mockResolvedValue({ id: 'x', url: 'https://filebase.example/files/card.png' });

    const result = await illustrateSegments(doc, {}, { generate: generate as never, upload: upload as never });

    expect(result.generated).toBe(4); // 2 pairs × 2 sides
    const memorySegment = result.document.segments.find((s) => s.type === 'memory_flip')!;
    const pairs = (memorySegment.payload as { pairs: { a_image_url?: string; b_image_url?: string }[] }).pairs;
    expect(pairs.every((p) => p.a_image_url?.startsWith('https://') && p.b_image_url?.startsWith('https://'))).toBe(true);
  });

  it('leaves memory_flip icons as the fallback when illustration fails, without failing the lesson', async () => {
    const doc = docWithMemoryFlip();
    const generate = vi.fn().mockRejectedValue(new Error('gemini-image HTTP 429: quota exceeded, limit: 0'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await illustrateSegments(doc, {}, { generate: generate as never });

    expect(result.generated).toBe(0);
    const pairs = (result.document.segments.find((s) => s.type === 'memory_flip')!.payload as { pairs: { a_image_url?: string }[] }).pairs;
    expect(pairs.every((p) => p.a_image_url === undefined)).toBe(true);
    warn.mockRestore();
  });

  it('skips cleanly and returns the original document unmodified when --no-images is passed', async () => {
    const doc = docWithPictureChoice();
    const generate = vi.fn();
    const result = await illustrateSegments(doc, { skip: true }, { generate: generate as never });
    expect(result.skippedReason).toBe('flag');
    expect(result.generated).toBe(0);
    expect(generate).not.toHaveBeenCalled();
    expect(result.document).toBe(doc);
  });

  it('skips cleanly when Gemini is NOT_CONFIGURED, without throwing', async () => {
    const doc = docWithPictureChoice();
    const generate = vi.fn().mockRejectedValue(new ProviderNotConfiguredError('gemini-image'));
    const upload = vi.fn();
    const result = await illustrateSegments(doc, {}, { generate: generate as never, upload: upload as never });
    expect(result.skippedReason).toBe('not-configured');
    expect(result.generated).toBe(0);
    expect(upload).not.toHaveBeenCalled();
  });

  it('generates and uploads an image per option missing image_url', async () => {
    const doc = docWithPictureChoice();
    const generate = vi.fn().mockResolvedValue({ pngBuffer: Buffer.from('fake-png') });
    const upload = vi.fn().mockResolvedValue({ id: 'lesson-images/abc.png', url: 'https://filebase.example/files/lesson-images/abc.png' });

    const result = await illustrateSegments(doc, {}, { generate: generate as never, upload: upload as never });

    expect(result.generated).toBe(2); // two options in picture_choice
    expect(generate).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledTimes(2);
    const pictureSegment = result.document.segments.find((s) => s.type === 'picture_choice')!;
    const options = (pictureSegment.payload as { options: { image_url?: string }[] }).options;
    expect(options.every((o) => o.image_url?.startsWith('https://'))).toBe(true);
  });

  it('skips a single failing option (icon fallback) without failing the whole lesson — quota/HTTP/network errors are per-option, not fatal', async () => {
    const doc = docWithPictureChoice();
    const generate = vi.fn().mockRejectedValue(new Error('gemini-image HTTP 429: quota exceeded, limit: 0'));
    const upload = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await illustrateSegments(doc, {}, { generate: generate as never, upload: upload as never });

    expect(result.generated).toBe(0);
    expect(result.skippedReason).toBeUndefined();
    expect(upload).not.toHaveBeenCalled();
    const options = (result.document.segments.find((s) => s.type === 'picture_choice')!.payload as { options: { image_url?: string }[] }).options;
    expect(options.every((o) => o.image_url === undefined)).toBe(true); // icons remain the fallback
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('never touches segments that already have image_url set', async () => {
    const doc = docWithPictureChoice();
    const pictureSegment = doc.segments.find((s) => s.type === 'picture_choice')! as { payload: { options: { image_url?: string }[] } };
    pictureSegment.payload.options[0]!.image_url = 'https://filebase.example/files/existing.png';

    const generate = vi.fn().mockResolvedValue({ pngBuffer: Buffer.from('fake-png') });
    const upload = vi.fn().mockResolvedValue({ id: 'x', url: 'https://filebase.example/files/new.png' });
    const result = await illustrateSegments(doc, {}, { generate: generate as never, upload: upload as never });

    expect(generate).toHaveBeenCalledTimes(1); // only the option WITHOUT image_url
    const options = (result.document.segments.find((s) => s.type === 'picture_choice')!.payload as { options: { image_url?: string }[] }).options;
    expect(options[0]!.image_url).toBe('https://filebase.example/files/existing.png');
  });
});
