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

describe('illustrateSegments', () => {
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
