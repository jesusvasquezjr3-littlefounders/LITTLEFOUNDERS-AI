/*
 * imageInheritance.ts — reuse the art a lesson already has instead of re-paying for it.
 *
 * WHY THIS EXISTS (the dominant cost of mass generation):
 * Prism caches by `sha256(model + size + "STYLE_VERSION | purpose | label | context")`,
 * so a cache hit needs the label AND the context to be byte-identical. When a lesson is
 * REGENERATED the author rewrites both, so every slot misses the cache and every image
 * is paid for again — even when the object being drawn is exactly the same lemon.
 *
 * The numbers make this the most expensive single fact about the pipeline: a 1000-lesson
 * course carries ~5 images per lesson at ~$0.02 each, so illustration alone is ~$100 per
 * full generation, several times the entire text cost. One failed 62-slot run already
 * billed 424 fresh generations (~$8.48) and published nothing.
 *
 * So before asking Prism for "limones", we ask the PREVIOUS published document for this
 * lesson whether it already has a picture of limones. If it does, that URL is reused and
 * the paid call never happens.
 *
 * THE DELIBERATE TRADE-OFF: the index is keyed on the normalized LABEL, not on
 * label+purpose. Prism art-directs per purpose (an `item_card` is framed differently from
 * an `option_card`), so a reused image can carry the framing of the slot it was first
 * drawn for. That is a small, on-brand cosmetic difference — both are the same
 * text-free object on the same background — and it is the right price for not re-billing
 * an identical drawing. Scene anchors are the exception and are NEVER inherited: there
 * the whole point is that the picture matches THAT prompt's scene, so a stale scene would
 * be wrong rather than merely differently framed.
 */

import type { LessonDocumentParsed } from '../contract/schema.js';

/** Object-level image keys, paired with the sibling field that names what was drawn. */
const IMAGE_LABEL_PAIRS: Array<{ imageKey: string; labelKeys: string[] }> = [
  { imageKey: 'image_url', labelKeys: ['text_md', 'label', 'ask_label'] },
  { imageKey: 'a_image_url', labelKeys: ['a_md'] },
  { imageKey: 'b_image_url', labelKeys: ['b_md'] },
  { imageKey: 'ask_image_url', labelKeys: ['ask_label', 'label', 'text_md'] },
];

/**
 * Same normalization the label would go through before reaching Prism, plus
 * accent/case folding — "Limones" and "limones" are the same drawing, while
 * "Limones grandes" is deliberately NOT (a different object deserves new art).
 */
export function normalizeLabel(raw: string): string {
  return raw
    .replace(/[*_`~#>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type ImageInheritance = Map<string, string>;

interface DocumentWithIllustrationStyle {
  segments?: unknown;
  illustration_style_version?: unknown;
}

/**
 * Indexes every OBJECT-level illustration in the given documents by normalized label.
 *
 * Segment-level `image_url` (the scene anchor) is skipped on purpose — see the header.
 * Documents are walked in order, and the first URL found for a label wins, so passing
 * the authoring locale first keeps the index deterministic.
 */
export function buildImageInheritance(
  documents: readonly (LessonDocumentParsed & DocumentWithIllustrationStyle)[],
  requiredStyleVersion?: string,
): ImageInheritance {
  const index: ImageInheritance = new Map();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    for (const { imageKey, labelKeys } of IMAGE_LABEL_PAIRS) {
      const url = obj[imageKey];
      if (typeof url !== 'string' || url.length === 0) continue;
      const labelRaw = labelKeys.map((k) => obj[k]).find((v): v is string => typeof v === 'string' && v.length > 0);
      if (!labelRaw) continue; // no sibling label → this is a scene anchor, not an object
      const key = normalizeLabel(labelRaw);
      if (key.length > 0 && !index.has(key)) index.set(key, url);
    }
    for (const value of Object.values(obj)) visit(value);
  };

  for (const document of documents) {
    if (requiredStyleVersion && document.illustration_style_version !== requiredStyleVersion) continue;
    // Only the segments carry illustrations; meta/scoring never do.
    visit(document.segments);
  }
  return index;
}

/** The URL already drawn for this label, if any. */
export function inheritedUrl(index: ImageInheritance | undefined, label: string): string | undefined {
  if (!index || index.size === 0) return undefined;
  return index.get(normalizeLabel(label));
}
