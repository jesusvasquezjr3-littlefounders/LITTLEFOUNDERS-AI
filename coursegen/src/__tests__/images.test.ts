import { describe, expect, it, vi } from 'vitest';
import { illustrateSegments, inspectIllustrationCoverage } from '../pipeline/images.js';
import { ProviderNotConfiguredError, ProviderHttpError } from '../providers/errors.js';
import { PicturegenGenerationError } from '../providers/picturegen.js';
import { estimateCostUsd, UsageLedger } from '../providers/usage.js';
import { buildDocument } from './fixtures.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

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
        { id: 'o1', icon: 'savings', label: 'Alcancía' },
        { id: 'o2', icon: 'shopping_bag', label: 'Helado' },
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
        { a_md: 'Limón', a_icon: 'nutrition', b_md: 'Limonada', b_icon: 'local_drink' },
        { a_md: 'Concha', a_icon: 'emoji_objects', b_md: 'Pluma', b_icon: 'brush' },
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
  vi.fn().mockResolvedValue({ url, fileId: 'lesson-images/x.png', cached: false, generatedImages: 1 });

describe('illustrateSegments (via Prism/picturegen)', () => {
  it('reports only plan-eligible visual targets and never bills or mutates while inspecting', () => {
    const doc = docWith(pictureChoiceSeg());
    const coverage = inspectIllustrationCoverage(doc);

    expect(coverage.required).toBe(2);
    expect(coverage.present).toBe(0);
    expect(coverage.missing).toEqual([
      { segmentId: 'pc1', label: 'Alcancía', purpose: 'option_card' },
      { segmentId: 'pc1', label: 'Helado', purpose: 'option_card' },
    ]);

    (doc.segments[0]!.payload as { options: Array<{ image_url?: string }> }).options[0]!.image_url = 'http://localhost:4006/files/a.png';
    expect(inspectIllustrationCoverage(doc)).toMatchObject({ required: 2, present: 1 });
  });

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
    expect(request).toHaveBeenCalledWith({ label: 'Alcancía', context: 'Elige la moneda correcta.', purpose: 'option_card' });
    const options = (result.document.segments.find((s) => s.type === 'picture_choice')!.payload as { options: { image_url?: string }[] }).options;
    expect(options.every((o) => o.image_url?.startsWith('http'))).toBe(true);
  });

  it('illustrates each memory_flip card side, tagged memory_card', async () => {
    const doc = docWith(memoryFlipSeg());
    const request = okPicture();

    const result = await illustrateSegments(doc, {}, { request: request as never });

    expect(result.generated).toBe(4); // 2 pairs × 2 sides
    expect(request).toHaveBeenCalledWith({ label: 'Limón', context: 'Encuentra las parejas.', purpose: 'memory_card' });
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

  it('does not spend on concepts, questions, people, actions, prices or sentence-shaped labels', async () => {
    const doc = docWith({
      id: 'abstract',
      type: 'picture_choice',
      prompt_md: 'Elige un objeto.',
      difficulty: 1,
      xp: 10,
      payload: {
        options: [
          { id: 'concept', icon: 'lightbulb', label: 'Deseo' },
          { id: 'person', icon: 'person', label: 'Niño mirando un perro en la tienda' },
        ],
      },
      answer: { correct_option_id: 'concept' },
    });
    const request = okPicture();

    const result = await illustrateSegments(doc, {}, { request: request as never });

    expect(inspectIllustrationCoverage(doc)).toMatchObject({ required: 0, present: 0 });
    expect(result.generated).toBe(0);
    expect(request).not.toHaveBeenCalled();
  });

  it('does not turn a localized person/action label into a paid object tile', async () => {
    const doc = docWith({
      id: 'localized-person',
      type: 'picture_choice',
      prompt_md: 'Choose the picture.',
      difficulty: 1,
      xp: 10,
      payload: { options: [{ id: 'child', icon: 'toys', label: 'Child holding a toy' }] },
      answer: { correct_option_id: 'child' },
    });
    const request = okPicture();

    const result = await illustrateSegments(doc, { required: true }, { request: request as never });

    expect(inspectIllustrationCoverage(result.document)).toMatchObject({ required: 0, present: 0 });
    expect(result.generated).toBe(0);
    expect(request).not.toHaveBeenCalled();
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

  it('fails closed on a target failure in required visual mode', async () => {
    const doc = docWith(pictureChoiceSeg());
    const request = vi.fn().mockRejectedValue(new ProviderHttpError('picturegen', 422, 'verification failed'));

    await expect(illustrateSegments(doc, { required: true }, { request: request as never })).rejects.toThrow('verification failed');
  });

  it('rejects an underfunded required visual bundle before any partial image spend', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'forge-images-required-admission-'));
    try {
      const ledger = new UsageLedger(dir);
      // One picture_choice has two targets. At three verifier redraws each,
      // a one-redraw budget cannot truthfully promise a complete visual bundle.
      await ledger.hydrate({
        maxUsd: estimateCostUsd({ provider: 'picturegen', promptTokens: 0, completionTokens: 0, images: 3 }),
      });
      const request = okPicture();

      await expect(
        illustrateSegments(docWith(pictureChoiceSeg()), { required: true, ledger }, { request: request as never }),
      ).rejects.toThrow('budget exceeded');
      expect(request).not.toHaveBeenCalled();
      expect(ledger.images).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not start an image that would exceed the known image budget', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'forge-images-budget-'));
    try {
      const ledger = new UsageLedger(dir);
      await ledger.hydrate({
        maxUsd: estimateCostUsd({ provider: 'picturegen', promptTokens: 0, completionTokens: 0, images: 3 }),
      });
      const request = okPicture();

      await expect(illustrateSegments(docWith(pictureChoiceSeg()), { ledger }, { request: request as never })).rejects.toThrow('budget exceeded');
      expect(request).toHaveBeenCalledTimes(1);
      expect(ledger.images).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ledgers pixels Prism rejected before failing a required visual run', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'forge-images-rejected-'));
    try {
      const ledger = new UsageLedger(dir);
      await ledger.hydrate({ maxUsd: 1 });
      const request = vi.fn().mockRejectedValue(new PicturegenGenerationError(422, 'text detected', undefined, 3));

      await expect(illustrateSegments(docWith(pictureChoiceSeg()), { required: true, ledger }, { request: request as never })).rejects.toThrow('text detected');
      expect(request).toHaveBeenCalledTimes(1);
      expect(ledger.images).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reuses matching object art without contacting Prism in reuse-only mode', async () => {
    const doc = docWith(pictureChoiceSeg());
    const request = vi.fn();
    const result = await illustrateSegments(
      doc,
      { reuseOnly: true, inherit: new Map([['alcancia', 'http://localhost:4006/files/alcancia.webp']]) },
      { request: request as never },
    );

    expect(request).not.toHaveBeenCalled();
    expect(result).toMatchObject({ generated: 0, inherited: 1 });
    const options = (result.document.segments.find((s) => s.type === 'picture_choice')!.payload as { options: { image_url?: string }[] }).options;
    expect(options[0]!.image_url).toBe('http://localhost:4006/files/alcancia.webp');
    expect(options[1]!.image_url).toBeUndefined();
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
