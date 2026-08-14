import { describe, expect, it, vi } from 'vitest';
import {
  backfillImages,
  type BackfillDeps,
  type BackfillDocRow,
  type BackfillWriteBody,
} from '../scripts/backfill-images.js';
import { illustrateSegments, type IllustrateResult } from '../pipeline/images.js';
import type { LessonDocumentParsed } from '../contract/schema.js';
import { FORGE_ILLUSTRATION_STYLE_VERSION } from '../pipeline/illustrationStyle.js';
import type { PrismStyleProbe } from '../providers/picturegen.js';

// The orchestration under test never parses or inspects the document — it only
// routes it through illustrate → writeDocument. Tiny tagged objects are enough
// to prove the routing (mirrors the DI seams in images.test.ts).
function doc(tag: string): LessonDocumentParsed {
  return { tag } as unknown as LessonDocumentParsed;
}

function row(lessonId: string, locale: string, document: LessonDocumentParsed): BackfillDocRow {
  return { lessonId, lessonSlug: `slug-${lessonId}`, locale, illustrationStyleVersion: FORGE_ILLUSTRATION_STYLE_VERSION, document };
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

    expect(summary).toEqual({ scanned: 3, patched: 2, imagesGenerated: 3, imagesInherited: 0, imagesPlaced: 3, skipped: 1, notConfigured: false, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0 });
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
    expect(summary).toEqual({ scanned: 2, patched: 2, imagesGenerated: 4, imagesInherited: 0, imagesPlaced: 4, skipped: 0, notConfigured: false, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0 });
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
    expect(summary).toEqual({ scanned: 2, patched: 0, imagesGenerated: 0, imagesInherited: 0, imagesPlaced: 0, skipped: 2, notConfigured: false, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0 });
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
    expect(summary).toEqual({ scanned: 0, patched: 0, imagesGenerated: 0, imagesInherited: 0, imagesPlaced: 0, skipped: 0, notConfigured: true, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0 });
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
    expect(summary).toEqual({ scanned: 0, patched: 0, imagesGenerated: 0, imagesInherited: 0, imagesPlaced: 0, skipped: 0, notConfigured: false, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0 });
  });

  it('builds a deterministic course-local index and patches inherited art without any Prism request', async () => {
    const donor = {
      segments: [{ id: 'source', type: 'picture_choice', prompt_md: 'Elige.', payload: { options: [{ label: 'Limones', image_url: 'https://depot/limones.webp' }] } }],
    } as unknown as LessonDocumentParsed;
    const recipient = {
      segments: [{ id: 'target', type: 'picture_choice', prompt_md: 'Elige.', payload: { options: [{ label: 'Limones' }] } }],
    } as unknown as LessonDocumentParsed;
    const request = vi.fn();
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);

    // Same locale, different lessons — a safe donor scope that must keep working.
    const summary = await backfillImages(
      {
        listDocuments: async () => [row('source', 'es-MX', donor), row('target', 'es-MX', recipient)],
        illustrate: (document, options) => illustrateSegments(document, options, { request: request as never }),
        writeDocument,
      },
      { courseSlug: 'c', reuseOnly: true },
    );

    expect(request).not.toHaveBeenCalled();
    expect(summary).toEqual({ scanned: 2, patched: 1, imagesGenerated: 0, imagesInherited: 1, imagesPlaced: 1, skipped: 1, notConfigured: false, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0 });
    expect(writeDocument).toHaveBeenCalledTimes(1);
    expect(writeDocument.mock.calls[0]![0].lessonId).toBe('target');
  });

  it('NEVER lets a cross-lesson interlingual homograph donate: es-MX "Pan" (bread) does not fill en-US "pan" (frying pan)', async () => {
    const esBread = {
      segments: [{ id: 'source', type: 'picture_choice', prompt_md: 'Elige.', payload: { options: [{ label: 'Pan', image_url: 'https://depot/pan-dulce.webp' }] } }],
    } as unknown as LessonDocumentParsed;
    const enFryingPan = {
      segments: [{ id: 'target', type: 'picture_choice', prompt_md: 'Choose.', payload: { options: [{ label: 'pan' }] } }],
    } as unknown as LessonDocumentParsed;
    const request = vi.fn();
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);

    const summary = await backfillImages(
      {
        listDocuments: async () => [row('lesson-a', 'es-MX', esBread), row('lesson-b', 'en-US', enFryingPan)],
        illustrate: (document, options) => illustrateSegments(document, options, { request: request as never }),
        writeDocument,
      },
      { courseSlug: 'c', reuseOnly: true },
    );

    expect(request).not.toHaveBeenCalled();
    expect(writeDocument).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ scanned: 2, patched: 0, imagesInherited: 0 });
  });

  it('still inherits ACROSS locales within the SAME lesson — the deliberate 1-image-per-3-locales design', async () => {
    const esDoc = {
      segments: [{ id: 'source', type: 'picture_choice', prompt_md: 'Elige.', payload: { options: [{ label: 'Pan', image_url: 'https://depot/pan-dulce.webp' }] } }],
    } as unknown as LessonDocumentParsed;
    const enDoc = {
      segments: [{ id: 'target', type: 'picture_choice', prompt_md: 'Choose.', payload: { options: [{ label: 'Pan' }] } }],
    } as unknown as LessonDocumentParsed;
    const request = vi.fn();
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);

    const summary = await backfillImages(
      {
        listDocuments: async () => [row('lesson-a', 'es-MX', esDoc), row('lesson-a', 'en-US', enDoc)],
        illustrate: (document, options) => illustrateSegments(document, options, { request: request as never }),
        writeDocument,
      },
      { courseSlug: 'c', reuseOnly: true },
    );

    expect(request).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ scanned: 2, patched: 1, imagesInherited: 1 });
    const patched = writeDocument.mock.calls[0]![1].document as unknown as {
      segments: Array<{ payload: { options: Array<{ image_url?: string }> } }>;
    };
    expect(patched.segments[0]!.payload.options[0]!.image_url).toBe('https://depot/pan-dulce.webp');
  });
});

// ---------------------------------------------------------------------------
// Style-version handshake — a paid backfill (neither --reuse-only nor
// --dry-run) is a paid Prism path, so it must run the same GET /health
// handshake pipeline/run.ts enforces BEFORE any paid call. Drifted art
// would otherwise be generated and PATCHed into documents whose
// illustration_style_version stamp is untouched.
// ---------------------------------------------------------------------------

describe('backfillImages style-version handshake', () => {
  function probeReturning(probe: PrismStyleProbe) {
    return vi.fn<NonNullable<BackfillDeps['probeStyleVersion']>>().mockResolvedValue(probe);
  }

  it('paid mode: refuses on a drifted Prism style version BEFORE any Prism call or Vault read', async () => {
    const probeStyleVersion = probeReturning({ styleVersion: `${FORGE_ILLUSTRATION_STYLE_VERSION}-drifted` });
    const listDocuments = vi.fn<BackfillDeps['listDocuments']>().mockResolvedValue([row('a', 'es-MX', doc('A'))]);
    const illustrate = vi.fn<BackfillDeps['illustrate']>();
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>();

    await expect(
      backfillImages({ listDocuments, illustrate, writeDocument, probeStyleVersion }, { courseSlug: 'c' }),
    ).rejects.toThrow(/style-version mismatch/);

    // Hard-failed before ANY paid Prism generate call — or even the Vault listing.
    expect(probeStyleVersion).toHaveBeenCalledTimes(1);
    expect(listDocuments).not.toHaveBeenCalled();
    expect(illustrate).not.toHaveBeenCalled();
    expect(writeDocument).not.toHaveBeenCalled();
  });

  it('paid mode: refuses when the style version is unverifiable (fail closed — no unattended paid spend)', async () => {
    const probeStyleVersion = probeReturning({ unavailable: 'Prism /health unreachable: timeout' });
    const illustrate = vi.fn<BackfillDeps['illustrate']>();
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>();

    await expect(
      backfillImages(
        { listDocuments: async () => [row('a', 'es-MX', doc('A'))], illustrate, writeDocument, probeStyleVersion },
        { courseSlug: 'c' },
      ),
    ).rejects.toThrow(/could not verify/);

    expect(illustrate).not.toHaveBeenCalled();
    expect(writeDocument).not.toHaveBeenCalled();
  });

  it('paid mode: proceeds when Prism advertises the exact expected style version', async () => {
    const probeStyleVersion = probeReturning({ styleVersion: FORGE_ILLUSTRATION_STYLE_VERSION });
    const illustratedDoc = doc('A-illustrated');
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockResolvedValue(illustrated(1, illustratedDoc));
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);

    const summary = await backfillImages(
      { listDocuments: async () => [row('a', 'es-MX', doc('A'))], illustrate, writeDocument, probeStyleVersion },
      { courseSlug: 'c' },
    );

    expect(probeStyleVersion).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ scanned: 1, patched: 1, imagesGenerated: 1 });
    expect(writeDocument).toHaveBeenCalledTimes(1);
  });

  it('reuse-only mode NEVER probes /health — no Prism request of any kind can happen', async () => {
    const probeStyleVersion = probeReturning({ styleVersion: `${FORGE_ILLUSTRATION_STYLE_VERSION}-drifted` });
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockImplementation(async (document) => illustrated(0, document));
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);

    const summary = await backfillImages(
      { listDocuments: async () => [row('a', 'es-MX', doc('A'))], illustrate, writeDocument, probeStyleVersion },
      { courseSlug: 'c', reuseOnly: true },
    );

    expect(probeStyleVersion).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ scanned: 1, notConfigured: false });
  });

  it('dry-run mode NEVER probes /health — nothing is PATCHed, so no drift can land in Vault', async () => {
    const probeStyleVersion = probeReturning({ styleVersion: `${FORGE_ILLUSTRATION_STYLE_VERSION}-drifted` });
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockResolvedValue(illustrated(1, doc('A-out')));
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);

    const summary = await backfillImages(
      { listDocuments: async () => [row('a', 'es-MX', doc('A'))], illustrate, writeDocument, probeStyleVersion },
      { courseSlug: 'c', dryRun: true },
    );

    expect(probeStyleVersion).not.toHaveBeenCalled();
    expect(writeDocument).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ scanned: 1, patched: 1 });
  });
});

/*
 * --restyle-scenes — the repair path for the 2026-08-14 incident. The published
 * catalog does not LACK scene art; it holds the wrong scene art, so the normal
 * add-only backfill is structurally unable to fix it.
 */
describe('backfillImages --restyle-scenes', () => {
  const STALE = 'v7-old+v8-qwen-image-max-object-white-flat-vector';

  /** A document with one scene anchor and one object tile, both already filled. */
  function sceneDoc(sceneUrl: string | undefined, tileUrl = 'http://depot.test/tile.webp'): LessonDocumentParsed {
    return {
      meta: { title: 'Contar la caja' },
      segments: [
        { id: 's1', type: 'best_decision', prompt_md: 'Liruf cuenta la caja.', payload: {}, ...(sceneUrl ? { image_url: sceneUrl } : {}) },
        { id: 's2', type: 'picture_choice', prompt_md: 'Elige.', payload: { options: [{ id: 'o1', label: 'Alcancía', image_url: tileUrl }] } },
      ],
    } as unknown as LessonDocumentParsed;
  }

  function staleRow(lessonId: string, locale: string, sceneUrl: string): BackfillDocRow {
    return { lessonId, lessonSlug: `slug-${lessonId}`, locale, illustrationStyleVersion: STALE, document: sceneDoc(sceneUrl) };
  }

  /** Illustrate fake that fills every empty scene anchor with a fresh URL. */
  function redrawing(url: string) {
    return vi.fn<BackfillDeps['illustrate']>().mockImplementation(async (document) => {
      const clone = structuredClone(document) as unknown as { segments: Array<{ type: string; image_url?: string }> };
      let generated = 0;
      for (const segment of clone.segments) {
        if (segment.type === 'best_decision' && !segment.image_url) {
          segment.image_url = url;
          generated++;
        }
      }
      return { document: clone as unknown as LessonDocumentParsed, generated };
    });
  }

  it('pays ONCE per lesson and copies the redrawn scene to the sibling locales', async () => {
    const rows = [
      staleRow('a', 'es-MX', 'http://depot.test/lemonade.webp'),
      staleRow('a', 'en-US', 'http://depot.test/lemonade.webp'),
      staleRow('a', 'pt-BR', 'http://depot.test/lemonade.webp'),
    ];
    const illustrate = redrawing('http://depot.test/fresh.webp');
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);

    const summary = await backfillImages(
      { listDocuments: async () => rows, illustrate, writeDocument },
      { courseSlug: 'financial-education', restyleScenes: true },
    );

    // One paid pass for three documents — illustrations carry no text.
    expect(illustrate).toHaveBeenCalledTimes(1);
    expect(illustrate.mock.calls[0]![1]).toMatchObject({ scope: 'financial-education/slug-a' });
    expect(summary.scenesCleared).toBe(3);
    expect(summary.scenesCopiedToLocales).toBe(2);
    expect(writeDocument).toHaveBeenCalledTimes(3);

    for (const [, body] of writeDocument.mock.calls as Array<[BackfillDocRow, BackfillWriteBody]>) {
      const segments = (body.document as unknown as { segments: Array<{ image_url?: string; payload: Record<string, unknown> }> }).segments;
      expect(segments[0]!.image_url).toBe('http://depot.test/fresh.webp');
      // The tile is untouched — its style version never moved.
      expect((segments[1]!.payload.options as Array<{ image_url?: string }>)[0]!.image_url).toBe('http://depot.test/tile.webp');
      expect(body.illustration_style_version).toBe(FORGE_ILLUSTRATION_STYLE_VERSION);
    }
  });

  it('leaves lessons that are already on the current style completely alone', async () => {
    const rows = [row('a', 'es-MX', sceneDoc('http://depot.test/good.webp'))];
    const illustrate = redrawing('http://depot.test/fresh.webp');
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);

    const summary = await backfillImages(
      { listDocuments: async () => rows, illustrate, writeDocument },
      { courseSlug: 'financial-education', restyleScenes: true },
    );

    expect(illustrate).not.toHaveBeenCalled();
    expect(writeDocument).not.toHaveBeenCalled();
    expect(summary.lessonsAlreadyCurrent).toBe(1);
  });

  /*
   * An emptied anchor renders as no image, which is honest; the stale one is an
   * actively misleading picture. So the clear is persisted even when the redraw
   * could not happen — but the style stamp is NOT advanced, leaving the lesson
   * visible to the release check as missing coverage.
   */
  it('persists the clear but withholds the style stamp when the redraw produced nothing', async () => {
    const rows = [staleRow('a', 'es-MX', 'http://depot.test/lemonade.webp')];
    const illustrate = vi
      .fn<BackfillDeps['illustrate']>()
      .mockImplementation(async (document) => ({ document, generated: 0 }));
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);

    await backfillImages(
      { listDocuments: async () => rows, illustrate, writeDocument },
      { courseSlug: 'financial-education', restyleScenes: true, reuseOnly: true },
    );

    const [, body] = writeDocument.mock.calls[0]! as [BackfillDocRow, BackfillWriteBody];
    expect((body.document as unknown as { segments: Array<{ image_url?: string }> }).segments[0]!.image_url).toBeUndefined();
    expect(body.illustration_style_version).toBeUndefined();
  });

  it('dry-run reports the repair without writing anything', async () => {
    const rows = [staleRow('a', 'es-MX', 'http://depot.test/lemonade.webp')];
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);

    const summary = await backfillImages(
      { listDocuments: async () => rows, illustrate: redrawing('http://depot.test/fresh.webp'), writeDocument },
      { courseSlug: 'financial-education', restyleScenes: true, dryRun: true },
    );

    expect(writeDocument).not.toHaveBeenCalled();
    expect(summary.patched).toBe(1);
    expect(summary.imagesGenerated).toBe(1);
  });

  /*
   * Clearing one locale's scenes and repointing only that locale would leave a
   * lesson rendering two different pictures for one segment depending on the
   * language the child reads it in.
   */
  it('refuses to run against a single locale', async () => {
    await expect(
      backfillImages(
        { listDocuments: async () => [], illustrate: vi.fn(), writeDocument: vi.fn() },
        { courseSlug: 'financial-education', restyleScenes: true, locale: 'es-MX' },
      ),
    ).rejects.toThrow(/all locales/i);
  });
});
