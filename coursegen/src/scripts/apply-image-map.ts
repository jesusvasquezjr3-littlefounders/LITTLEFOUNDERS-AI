#!/usr/bin/env node
// images:apply-map — rewrite image URLs embedded in lesson documents from an
// old-url → new-url JSON map (produced by picturegen's `backfill:webp`).
//
//   npm run images:apply-map -- <map.json> [--confirm]
//
// Ownership split of the WebP storage migration: Prism converts the objects
// and updates ITS cache rows (picture_assets), then hands over this map;
// Forge owns the urls it embedded in lesson documents, so Forge applies it.
//
// Invariants (same as images:backfill):
//  - PATCH body is `{ document }` and nothing else — `audio` and `answer_keys`
//    are never read or written.
//  - Only values of the four image keys are touched ({image_url, a_image_url,
//    b_image_url, ask_image_url} — the complete set per the contract, see
//    imageInheritance.ts), and only when the exact old url is in the map.
//  - STRICT completeness: any lesson-images url left over that is neither in
//    the map nor already converted is reported and fails the run — a silent
//    partial rewrite would strand PNGs that the cleanup step then deletes.

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { vaultSelect, vaultPatch } from '../vault/restClient.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

/** The four keys that can hold an image url anywhere in a document (imageInheritance.ts). */
const IMAGE_KEYS = ['image_url', 'a_image_url', 'b_image_url', 'ask_image_url'] as const;

export interface RewriteResult {
  document: LessonDocumentParsed;
  replaced: number;
  /** lesson-images urls encountered that the map does not cover (excluding already-new ones). */
  unmapped: string[];
}

/** Pure rewrite over a document — covers scene anchors AND every nested payload slot. */
export function rewriteImageUrls(
  document: LessonDocumentParsed,
  map: Readonly<Record<string, string>>,
): RewriteResult {
  const clone = structuredClone(document);
  let replaced = 0;
  const unmapped = new Set<string>();
  const converted = new Set(Object.values(map));

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    for (const key of IMAGE_KEYS) {
      const url = obj[key];
      if (typeof url !== 'string' || url.length === 0) continue;
      const next = map[url];
      if (next) {
        obj[key] = next;
        replaced += 1;
      } else if (url.includes('/lesson-images/') && !converted.has(url)) {
        unmapped.add(url);
      }
    }
    for (const value of Object.values(obj)) visit(value);
  };

  visit((clone as unknown as { segments?: unknown }).segments);
  return { document: clone, replaced, unmapped: [...unmapped] };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mapPath = args.find((a) => a.endsWith('.json'));
  const confirm = args.includes('--confirm');
  if (!mapPath) {
    console.error('usage: npm run images:apply-map -- <map.json> [--confirm]');
    process.exitCode = 1;
    return;
  }

  const map = JSON.parse(await readFile(mapPath, 'utf8')) as Record<string, string>;
  console.log(`[images:apply-map] ${Object.keys(map).length} url mappings loaded from ${mapPath}`);

  const rows = await vaultSelect<{ lesson_id: string; locale: string; document: LessonDocumentParsed }>(
    `/lesson_documents?select=lesson_id,locale,document&document=not.is.null`,
  );

  let patched = 0;
  let totalReplaced = 0;
  const allUnmapped = new Set<string>();
  for (const row of rows) {
    const { document, replaced, unmapped } = rewriteImageUrls(row.document, map);
    for (const u of unmapped) allUnmapped.add(u);
    if (replaced === 0) continue;
    totalReplaced += replaced;
    if (confirm) {
      await vaultPatch(
        `/lesson_documents?lesson_id=eq.${encodeURIComponent(row.lesson_id)}&locale=eq.${encodeURIComponent(row.locale)}`,
        { document },
      );
    }
    patched += 1;
  }

  console.log(
    `[images:apply-map] ${confirm ? 'patched' : 'WOULD patch (dry run — pass --confirm)'} ` +
      `${patched} document(s), ${totalReplaced} url(s) rewritten across ${rows.length} rows scanned`,
  );
  if (allUnmapped.size > 0) {
    console.error(`[images:apply-map] ${allUnmapped.size} lesson-images url(s) NOT covered by the map:`);
    for (const u of [...allUnmapped].slice(0, 10)) console.error(`  ${u}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error('[images:apply-map] fatal:', err);
    process.exitCode = 1;
  });
}
