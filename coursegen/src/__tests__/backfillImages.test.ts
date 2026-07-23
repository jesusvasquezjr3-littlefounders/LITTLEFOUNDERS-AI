import { describe, expect, it, vi } from 'vitest';
import {
  backfillImages,
  type BackfillDeps,
  type BackfillDocRow,
  type BackfillWriteBody,
} from '../scripts/backfill-images.js';
import type { IllustrateResult } from '../pipeline/images.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

// The orchestration under test never parses or inspects the document — it only
// routes it through illustrate → writeDocument. Tiny tagged objects are enough
// to prove the routing (mirrors the DI seams in images.test.ts).
function doc(tag: string): LessonDocumentParsed {
  return { tag } as unknown as LessonDocumentParsed;
}

function row(lessonId: string, locale: string, document: LessonDocumentParsed): BackfillDocRow {
  return { lessonId, lessonSlug: `slug-${lessonId}`, locale, document };
}

/** An illustrate fake that reports N generated images and returns a distinct illustrated doc. */
function illustrated(generated: number, out: LessonDocumentParsed): IllustrateResult {
  return { document: out, generated };
}

describe('backfillImages orchestration', () => {
  it('patches ONLY the documents that gained images, leaving no-op documents untouched', async () => {
    const outA = doc('A-illustrated');
    const outC = doc('C-illustrated');
    const rows = [
      row('a', 'es-MX', doc('A')),
      row('b', 'es-MX', doc('B')),
      row('c', 'en-US', doc('C')),
    ];

    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);
    const illustrate = vi
      .fn<BackfillDeps['illustrate']>()
      .mockResolvedValueOnce(illustrated(2, outA)) // a → 2 images
      .mockResolvedValueOnce(illustrated(0, doc('B'))) // b → nothing
      .mockResolvedValueOnce(illustrated(1, outC)); // c → 1 image

    const summary = await backfillImages(
      { listDocuments: async () => rows, illustrate, writeDocument },
      { courseSlug: 'financial-education' },
    );

    expect(summary).toEqual({ scanned: 3, patched: 2, imagesGenerated: 3, skipped: 1, notConfigured: false });
    // Only a and c were written — b (0 images) was not.
    expect(writeDocument).toHaveBeenCalledTimes(2);
    expect(writeDocument.mock.calls.map((call) => call[0].lessonId)).toEqual(['a', 'c']);
  });

  it('writes a PATCH body containing ONLY the document column (audio / answer_keys never touched)', async () => {
    const illustratedDoc = doc('illustrated');
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockResolvedValue(illustrated(1, illustratedDoc));

    await backfillImages(
      { listDocuments: async () => [row('a', 'es-MX', doc('stored'))], illustrate, writeDocument },
      { courseSlug: 'c' },
    );

    expect(writeDocument).toHaveBeenCalledTimes(1);
    const body: BackfillWriteBody = writeDocument.mock.calls[0]![1];
    // The load-bearing assertion: the write carries the document key and NOTHING
    // else — no `audio`, no `answer_keys`.
    expect(Object.keys(body)).toEqual(['document']);
    // …and it is the ILLUSTRATED clone, not the original stored doc.
    expect(body.document).toBe(illustratedDoc);
  });

  it('dry-run illustrates and reports would-be patches but performs NO writes', async () => {
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);
    const illustrate = vi
      .fn<BackfillDeps['illustrate']>()
      .mockResolvedValueOnce(illustrated(3, doc('A-out')))
      .mockResolvedValueOnce(illustrated(1, doc('B-out')));

    const summary = await backfillImages(
      {
        listDocuments: async () => [row('a', 'es-MX', doc('A')), row('b', 'es-MX', doc('B'))],
        illustrate,
        writeDocument,
      },
      { courseSlug: 'c', dryRun: true },
    );

    expect(illustrate).toHaveBeenCalledTimes(2);
    expect(writeDocument).not.toHaveBeenCalled(); // dry-run: zero writes
    // patched still counts what WOULD be written, so the operator sees the impact.
    expect(summary).toEqual({ scanned: 2, patched: 2, imagesGenerated: 4, skipped: 0, notConfigured: false });
  });

  it('exits cleanly on a fully quota-exhausted run — every document skipped, nothing patched', async () => {
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);
    // Quota exhausted: illustrateSegments swallows the per-option 429s and
    // returns generated:0 with the (unchanged) document — no skippedReason.
    const illustrate = vi
      .fn<BackfillDeps['illustrate']>()
      .mockImplementation(async (document) => illustrated(0, document));

    const summary = await backfillImages(
      {
        listDocuments: async () => [row('a', 'es-MX', doc('A')), row('b', 'en-US', doc('B'))],
        illustrate,
        writeDocument,
      },
      { courseSlug: 'c' },
    );

    expect(writeDocument).not.toHaveBeenCalled();
    expect(summary).toEqual({ scanned: 2, patched: 0, imagesGenerated: 0, skipped: 2, notConfigured: false });
  });

  it('short-circuits the whole pass (and never writes) when Prism is NOT_CONFIGURED', async () => {
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);
    const illustrate = vi
      .fn<BackfillDeps['illustrate']>()
      .mockResolvedValue({ document: doc('unchanged'), generated: 0, skippedReason: 'not-configured' });
    const log = vi.fn<NonNullable<BackfillDeps['log']>>();

    const summary = await backfillImages(
      {
        listDocuments: async () => [row('a', 'es-MX', doc('A')), row('b', 'en-US', doc('B'))],
        illustrate,
        writeDocument,
        log,
      },
      { courseSlug: 'c' },
    );

    // Stopped after the first doc's not-configured result: no writes, nothing scanned.
    expect(illustrate).toHaveBeenCalledTimes(1);
    expect(writeDocument).not.toHaveBeenCalled();
    expect(summary).toEqual({ scanned: 0, patched: 0, imagesGenerated: 0, skipped: 0, notConfigured: true });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Prism (PICTUREGEN_URL) not configured'));
  });

  it('handles an empty course (no documents) as a clean zero-summary', async () => {
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);
    const illustrate = vi.fn<BackfillDeps['illustrate']>();

    const summary = await backfillImages(
      { listDocuments: async () => [], illustrate, writeDocument },
      { courseSlug: 'empty' },
    );

    expect(illustrate).not.toHaveBeenCalled();
    expect(writeDocument).not.toHaveBeenCalled();
    expect(summary).toEqual({ scanned: 0, patched: 0, imagesGenerated: 0, skipped: 0, notConfigured: false });
  });
});
