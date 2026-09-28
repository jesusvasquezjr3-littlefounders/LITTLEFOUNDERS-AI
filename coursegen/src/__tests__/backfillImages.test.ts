import { describe, expect, it, vi } from 'vitest';
import {
  backfillImages,
  ID_BATCH_SIZE,
  selectByIds,
  spendAllowed,
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
      { courseSlug: 'financial-education', maxUsd: 10 },
    );

    // 3 generated images at the $0.075 default (COST_QWEN_IMAGE_PER_IMAGE).
    expect(summary).toEqual({ scanned: 3, patched: 2, imagesGenerated: 3, imagesInherited: 0, imagesPlaced: 3, skipped: 1, notConfigured: false, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0, usdSpent: 0.225, stoppedOnBudget: false, skippedPublished: 0 });
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
      { courseSlug: 'c', maxUsd: 10 },
    );

    expect(writeDocument).toHaveBeenCalledTimes(1);
    const body: BackfillWriteBody = writeDocument.mock.calls[0]![1];
    // The load-bearing assertion: the write carries the document key and NOTHING
    // else — no `audio`, no `answer_keys`.
    expect(Object.keys(body)).toEqual(['document']);
    // …and it is the ILLUSTRATED clone, not the original stored doc.
    expect(body.document).toBe(illustratedDoc);
  });

  it('G.2: never illustrates or writes a PUBLISHED lesson, and reports each one it skipped', async () => {
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockResolvedValue(illustrated(2, doc('review-out')));
    const lines: string[] = [];
    const summary = await backfillImages(
      {
        listDocuments: async () => [
          { ...row('live', 'es-MX', doc('LIVE')), lessonStatus: 'published' },
          { ...row('live', 'en-US', doc('LIVE-EN')), lessonStatus: 'published' },
          { ...row('draft', 'es-MX', doc('REVIEW')), lessonStatus: 'review' },
        ],
        illustrate,
        writeDocument,
        log: (line) => lines.push(line),
      },
      { courseSlug: 'c', maxUsd: 10 },
    );
    // Only the review lesson is illustrated and written; the live one is untouched.
    expect(illustrate).toHaveBeenCalledTimes(1);
    expect(illustrate.mock.calls[0]![0]).toEqual(doc('REVIEW'));
    expect(writeDocument.mock.calls.map((call) => call[0].lessonId)).toEqual(['draft']);
    expect(summary).toMatchObject({ scanned: 1, patched: 1, skippedPublished: 2 });
    expect(lines.filter((l) => l.includes('published'))).toHaveLength(2);
  });

  it('G.2: a --locale pass counts only the published documents of that locale as skipped', async () => {
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockResolvedValue(illustrated(0, doc('x')));
    const summary = await backfillImages(
      {
        listDocuments: async () => [
          { ...row('live', 'es-MX', doc('LIVE')), lessonStatus: 'published' },
          { ...row('live', 'en-US', doc('LIVE-EN')), lessonStatus: 'published' },
        ],
        illustrate,
        writeDocument,
      },
      { courseSlug: 'c', locale: 'es-MX', maxUsd: 10 },
    );
    expect(illustrate).not.toHaveBeenCalled();
    expect(writeDocument).not.toHaveBeenCalled();
    expect(summary.skippedPublished).toBe(1);
  });

  it('dry-run illustrates reuse-only (zero spend) and reports would-be patches but performs NO writes', async () => {
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
    // OD-23/OD-28: a dry-run never reaches Prism's paid path.
    for (const call of illustrate.mock.calls) expect(call[1]).toMatchObject({ reuseOnly: true });
    expect(writeDocument).not.toHaveBeenCalled(); // dry-run: zero writes
    // patched still counts what WOULD be written, so the operator sees the impact.
    expect(summary).toEqual({ scanned: 2, patched: 2, imagesGenerated: 4, imagesInherited: 0, imagesPlaced: 4, skipped: 0, notConfigured: false, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0, usdSpent: 0, stoppedOnBudget: false, skippedPublished: 0 });
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
      { courseSlug: 'c', maxUsd: 10 },
    );

    expect(writeDocument).not.toHaveBeenCalled();
    expect(summary).toEqual({ scanned: 2, patched: 0, imagesGenerated: 0, imagesInherited: 0, imagesPlaced: 0, skipped: 2, notConfigured: false, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0, usdSpent: 0, stoppedOnBudget: false, skippedPublished: 0 });
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
      { courseSlug: 'c', maxUsd: 10 },
    );

    // Stopped after the first doc's not-configured result: no writes, nothing scanned.
    expect(illustrate).toHaveBeenCalledTimes(1);
    expect(writeDocument).not.toHaveBeenCalled();
    expect(summary).toEqual({ scanned: 0, patched: 0, imagesGenerated: 0, imagesInherited: 0, imagesPlaced: 0, skipped: 0, notConfigured: true, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0, usdSpent: 0, stoppedOnBudget: false, skippedPublished: 0 });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Prism (PICTUREGEN_URL) not configured'));
  });

  it('handles an empty course (no documents) as a clean zero-summary', async () => {
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);
    const illustrate = vi.fn<BackfillDeps['illustrate']>();

    const summary = await backfillImages(
      { listDocuments: async () => [], illustrate, writeDocument },
      { courseSlug: 'empty', maxUsd: 10 },
    );

    expect(illustrate).not.toHaveBeenCalled();
    expect(writeDocument).not.toHaveBeenCalled();
    expect(summary).toEqual({ scanned: 0, patched: 0, imagesGenerated: 0, imagesInherited: 0, imagesPlaced: 0, skipped: 0, notConfigured: false, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0, usdSpent: 0, stoppedOnBudget: false, skippedPublished: 0 });
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
    expect(summary).toEqual({ scanned: 2, patched: 1, imagesGenerated: 0, imagesInherited: 1, imagesPlaced: 1, skipped: 1, notConfigured: false, scenesCleared: 0, scenesCopiedToLocales: 0, lessonsAlreadyCurrent: 0, usdSpent: 0, stoppedOnBudget: false, skippedPublished: 0 });
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
      backfillImages({ listDocuments, illustrate, writeDocument, probeStyleVersion }, { courseSlug: 'c', maxUsd: 10 }),
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
        { courseSlug: 'c', maxUsd: 10 },
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
      { courseSlug: 'c', maxUsd: 10 },
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

/*
 * HTTP 414, reproduced live 2026-08-15 against the real financial-education
 * catalog: `/lessons?topic_id=in.(…300 uuids…)` blew past Kong's request-line
 * limit. verifyCourse.ts had already been fixed for this exact ceiling on
 * 2026-08-10; this script had only batched its LAST hop, so the failure simply
 * moved one level up the hierarchy walk. The guard belongs on the helper, not
 * on whichever call site someone remembers.
 */
describe('selectByIds — every id hop is bounded, not just the last one', () => {
  it('splits a large id list into batches that fit a request line', async () => {
    const ids = Array.from({ length: 400 }, (_, i) => `id-${i}`);
    const seen: string[][] = [];
    const select = async (path: string) => {
      seen.push(path.replace(/^.*in\.\(/, '').replace(/\).*$/, '').split(','));
      return [];
    };

    await selectByIds((batch) => `/lessons?topic_id=in.(${batch.join(',')})`, ids, select);

    expect(seen.length).toBe(Math.ceil(400 / ID_BATCH_SIZE));
    for (const batch of seen) expect(batch.length).toBeLessThanOrEqual(ID_BATCH_SIZE);
    // Nothing dropped, nothing duplicated.
    expect(seen.flat()).toEqual(ids);
  });

  it('makes exactly one call for a small list and none for an empty one', async () => {
    const select = vi.fn().mockResolvedValue([]);
    await selectByIds((b) => `/x?id=in.(${b.join(',')})`, ['a', 'b'], select);
    expect(select).toHaveBeenCalledTimes(1);

    select.mockClear();
    await selectByIds((b) => `/x?id=in.(${b.join(',')})`, [], select);
    expect(select).not.toHaveBeenCalled();
  });

  it('concatenates the batches in order', async () => {
    const ids = Array.from({ length: ID_BATCH_SIZE + 5 }, (_, i) => `id-${i}`);
    let call = 0;
    const select = async () => [`batch-${call++}`];
    await expect(selectByIds<string>((b) => b.join(','), ids, select)).resolves.toEqual(['batch-0', 'batch-1']);
  });
});

/*
 * NEAR-MISS 2026-08-15. `--dry-run` historically meant "no Vault writes" and
 * still ran the full PAID illustration pass — defensible for the add-only
 * backfill (you are previewing art that does not exist yet), indefensible for a
 * restyle, which clears every stale scene first. An operator typing --dry-run
 * to find out what a repair costs would have paid for the repair. Caught before
 * it billed anything; these tests keep it caught.
 */
/*
 * OD-28 (owner review D-03): every paid mode states the owner-approved USD
 * ceiling, and the ceiling binds in the ordinary add-only pass too.
 */
describe('owner USD ceiling on every paid backfill (OD-28)', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => row(`l${i}`, 'es-MX', doc(`D${i}`)));

  it('refuses a paid add-only pass without --max-usd before the probe, the Vault read or any Prism call', async () => {
    const listDocuments = vi.fn<BackfillDeps['listDocuments']>().mockResolvedValue(rows(1));
    const illustrate = vi.fn<BackfillDeps['illustrate']>();
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>();
    const probeStyleVersion = vi.fn<NonNullable<BackfillDeps['probeStyleVersion']>>();
    for (const maxUsd of [undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(
        backfillImages({ listDocuments, illustrate, writeDocument, probeStyleVersion }, { courseSlug: 'c', maxUsd }),
      ).rejects.toThrow(/images:backfill: a paid run needs the owner-approved USD ceiling \(--max-usd <n>\)/);
    }
    expect(probeStyleVersion).not.toHaveBeenCalled();
    expect(listDocuments).not.toHaveBeenCalled();
    expect(illustrate).not.toHaveBeenCalled();
    expect(writeDocument).not.toHaveBeenCalled();
  });

  it('needs no ceiling for --dry-run or --reuse-only, which never reach the paid path', async () => {
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockImplementation(async (document) => illustrated(0, document));
    const deps = { listDocuments: async () => rows(2), illustrate, writeDocument: vi.fn().mockResolvedValue(undefined) };
    await expect(backfillImages(deps, { courseSlug: 'c', dryRun: true })).resolves.toMatchObject({ scanned: 2, usdSpent: 0 });
    await expect(backfillImages(deps, { courseSlug: 'c', reuseOnly: true })).resolves.toMatchObject({ scanned: 2, usdSpent: 0 });
    for (const call of illustrate.mock.calls) expect(call[1]).toMatchObject({ reuseOnly: true });
  });

  it('stops the add-only pass once the drawn images reach the ceiling', async () => {
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockImplementation(async () => illustrated(2, doc('out')));
    const summary = await backfillImages(
      { listDocuments: async () => rows(10), illustrate, writeDocument },
      { courseSlug: 'c', maxUsd: 0.3 },
    );
    // $0.075 × 2 per document → the ceiling of $0.30 is reached after the second document.
    expect(illustrate).toHaveBeenCalledTimes(2);
    expect(writeDocument).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ stoppedOnBudget: true, imagesGenerated: 4, usdSpent: 0.3 });
    for (const call of illustrate.mock.calls) expect(call[1]).toMatchObject({ reuseOnly: false });
  });

  it('runs to completion under a generous ceiling and reports the spend', async () => {
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockImplementation(async () => illustrated(1, doc('out')));
    const summary = await backfillImages(
      { listDocuments: async () => rows(4), illustrate, writeDocument: vi.fn().mockResolvedValue(undefined) },
      { courseSlug: 'c', maxUsd: 100 },
    );
    expect(summary).toMatchObject({ stoppedOnBudget: false, imagesGenerated: 4, usdSpent: 0.3 });
  });
});

describe('spendAllowed — money is never on the table by default in restyle mode', () => {
  const base = { courseSlug: 'financial-education' };

  it('blocks a restyle unless it is explicitly confirmed', () => {
    expect(spendAllowed({ ...base, restyleScenes: true })).toBe(false);
    expect(spendAllowed({ ...base, restyleScenes: true, confirmSpend: true })).toBe(true);
  });

  it('blocks a restyle dry-run even when spending was confirmed', () => {
    expect(spendAllowed({ ...base, restyleScenes: true, confirmSpend: true, dryRun: true })).toBe(false);
  });

  it('blocks reuse-only everywhere', () => {
    expect(spendAllowed({ ...base, reuseOnly: true })).toBe(false);
    expect(spendAllowed({ ...base, restyleScenes: true, confirmSpend: true, reuseOnly: true })).toBe(false);
  });

  // The add-only path keeps its documented behaviour: --confirm-spend is a
  // restyle concept, because only a restyle destroys before it rebuilds.
  it('leaves the ordinary backfill unchanged', () => {
    expect(spendAllowed(base)).toBe(true);
    expect(spendAllowed({ ...base, dryRun: true })).toBe(false);
  });
});

describe('restyle honours the spend gate end to end', () => {
  const STALE_V = 'v7-old+v8-qwen-image-max-object-white-flat-vector';
  const doc1 = (): LessonDocumentParsed =>
    ({
      meta: { title: 'T' },
      segments: [{ id: 's1', type: 'best_decision', prompt_md: 'Liruf cuenta la caja.', payload: {}, image_url: 'http://depot.test/old.webp' }],
    }) as unknown as LessonDocumentParsed;

  const rows = (): BackfillDocRow[] => [
    { lessonId: 'a', lessonSlug: 'slug-a', locale: 'es-MX', illustrationStyleVersion: STALE_V, document: doc1() },
  ];

  it('runs measurement-only without --confirm-spend, and still reports the redraw count', async () => {
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockImplementation(async (document) => ({ document, generated: 0 }));
    const probeStyleVersion = vi.fn<NonNullable<BackfillDeps['probeStyleVersion']>>();

    const summary = await backfillImages(
      { listDocuments: async () => rows(), illustrate, writeDocument: vi.fn().mockResolvedValue(undefined), probeStyleVersion },
      { courseSlug: 'financial-education', restyleScenes: true },
    );

    // Prism is never asked for a picture...
    expect(illustrate.mock.calls[0]![1]).toMatchObject({ reuseOnly: true });
    // ...nor even probed, because no paid call can follow.
    expect(probeStyleVersion).not.toHaveBeenCalled();
    // And the number the operator came for is still produced.
    expect(summary.scenesCleared).toBe(1);
  });

  it('allows the paid redraw once --confirm-spend is given', async () => {
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockImplementation(async (document) => ({ document, generated: 1 }));
    const probeStyleVersion = vi
      .fn<NonNullable<BackfillDeps['probeStyleVersion']>>()
      .mockResolvedValue({ styleVersion: FORGE_ILLUSTRATION_STYLE_VERSION });

    await backfillImages(
      { listDocuments: async () => rows(), illustrate, writeDocument: vi.fn().mockResolvedValue(undefined), probeStyleVersion },
      { courseSlug: 'financial-education', restyleScenes: true, confirmSpend: true, maxUsd: 100 },
    );

    expect(probeStyleVersion).toHaveBeenCalled();
    expect(illustrate.mock.calls[0]![1]).toMatchObject({ reuseOnly: false });
  });
});

/*
 * A confirmed restyle spends real money in an unattended loop over a live
 * catalog. `illustrateSegments` takes an OPTIONAL ledger and this path never
 * supplied one, so repairing financial-education — 3,397 redraws at
 * $0.075 each, more with verifier retries — had no kill switch behind it at
 * all. AGENTS.md §1.14: a budget guard that does not bind is not a guard.
 */
describe('restyle budget ceiling', () => {
  const STALE_V = 'v7-old+v8-qwen-image-max-object-white-flat-vector';

  function lessonRows(count: number): BackfillDocRow[] {
    return Array.from({ length: count }, (_, i) => ({
      lessonId: `l${i}`,
      lessonSlug: `slug-${i}`,
      locale: 'es-MX',
      illustrationStyleVersion: STALE_V,
      document: {
        meta: { title: 'T' },
        segments: [{ id: 's1', type: 'best_decision', prompt_md: 'x', payload: {}, image_url: 'http://depot.test/old.webp' }],
      } as unknown as LessonDocumentParsed,
    }));
  }

  /** Every lesson costs exactly one generated image. */
  const oneImageEach = () =>
    vi.fn<BackfillDeps['illustrate']>().mockImplementation(async (document) => {
      const clone = structuredClone(document) as unknown as { segments: Array<{ image_url?: string }> };
      clone.segments[0]!.image_url = 'http://depot.test/fresh.webp';
      return { document: clone as unknown as LessonDocumentParsed, generated: 1 };
    });

  const deps = (illustrate: BackfillDeps['illustrate']): BackfillDeps => ({
    listDocuments: async () => lessonRows(10),
    illustrate,
    writeDocument: vi.fn().mockResolvedValue(undefined),
    probeStyleVersion: vi.fn().mockResolvedValue({ styleVersion: FORGE_ILLUSTRATION_STYLE_VERSION }),
  });

  it('refuses a confirmed restyle that states no ceiling', async () => {
    await expect(
      backfillImages(deps(oneImageEach()), { courseSlug: 'c', restyleScenes: true, confirmSpend: true }),
    ).rejects.toThrow(/--max-usd/);
  });

  it('stops once the ceiling is reached, leaving repaired lessons complete', async () => {
    const illustrate = oneImageEach();
    // $0.075/image (COST_QWEN_IMAGE_PER_IMAGE default) → $0.20 buys 3 images.
    const summary = await backfillImages(deps(illustrate), {
      courseSlug: 'c',
      restyleScenes: true,
      confirmSpend: true,
      maxUsd: 0.2,
    });

    expect(summary.stoppedOnBudget).toBe(true);
    expect(summary.imagesGenerated).toBe(3);
    expect(summary.usdSpent).toBeCloseTo(0.225, 4);
    // It stopped BETWEEN lessons, so nothing is half-repaired.
    expect(illustrate).toHaveBeenCalledTimes(3);
    expect(summary.patched).toBe(3);
  });

  it('runs to completion and reports the spend when the ceiling is generous', async () => {
    const summary = await backfillImages(deps(oneImageEach()), {
      courseSlug: 'c',
      restyleScenes: true,
      confirmSpend: true,
      maxUsd: 100,
    });

    expect(summary.stoppedOnBudget).toBe(false);
    expect(summary.imagesGenerated).toBe(10);
    expect(summary.usdSpent).toBeCloseTo(0.75, 4);
  });

  it('never demands a ceiling for a measurement-only pass', async () => {
    const summary = await backfillImages(
      deps(vi.fn<BackfillDeps['illustrate']>().mockImplementation(async (document) => ({ document, generated: 0 }))),
      { courseSlug: 'c', restyleScenes: true },
    );
    expect(summary.usdSpent).toBe(0);
    expect(summary.stoppedOnBudget).toBe(false);
  });
});

/*
 * Two defects the 2026-08-15 arrears outage exposed in this repair path, both
 * caught on a live run that generated nothing and cost nothing.
 */
describe('restyle refuses to degrade a catalog it cannot repair', () => {
  const STALE_V = 'v7-old+v8-qwen-image-max-object-white-flat-vector';

  /** A lesson whose scene anchor is MISSING, not stale — clears zero. */
  function anchorlessDoc(): LessonDocumentParsed {
    return {
      meta: { title: 'T' },
      segments: [{ id: 's1', type: 'best_decision', prompt_md: 'Rho mira los tres tesoros.', payload: {} }],
    } as unknown as LessonDocumentParsed;
  }

  function rows(count: number): BackfillDocRow[] {
    return Array.from({ length: count }, (_, i) => ({
      lessonId: `l${i}`,
      lessonSlug: `slug-${i}`,
      locale: 'es-MX',
      illustrationStyleVersion: STALE_V,
      document: anchorlessDoc(),
    }));
  }

  const failingIllustrate = () =>
    vi.fn<BackfillDeps['illustrate']>().mockImplementation(async (document) => ({ document, generated: 0 }));

  const deps = (illustrate: BackfillDeps['illustrate'], count: number): BackfillDeps => ({
    listDocuments: async () => rows(count),
    illustrate,
    writeDocument: vi.fn().mockResolvedValue(undefined),
    probeStyleVersion: vi.fn().mockResolvedValue({ styleVersion: FORGE_ILLUSTRATION_STYLE_VERSION }),
  });

  /*
   * The stamp bug: nothing stale to clear and nothing drawn is 0 === 0, which
   * used to read as "complete" and marked a lesson CURRENT with no art at all.
   * Two published lessons were stamped that way for real before being reverted.
   */
  it('never stamps a document whose illustrations are still missing', async () => {
    const writeDocument = vi.fn<BackfillDeps['writeDocument']>().mockResolvedValue(undefined);
    await backfillImages(
      { ...deps(failingIllustrate(), 1), writeDocument },
      { courseSlug: 'c', restyleScenes: true, confirmSpend: true, maxUsd: 10 },
    );

    expect(writeDocument).toHaveBeenCalled();
    for (const [, body] of writeDocument.mock.calls as Array<[BackfillDocRow, BackfillWriteBody]>) {
      expect(body.illustration_style_version).toBeUndefined();
    }
  });

  /*
   * The walk-on bug: with the provider hard-down, the pass kept clearing art it
   * could not replace, lesson after lesson. Several barren lessons in a row is
   * never a content problem.
   */
  it('aborts after a run of lessons that need images and get none', async () => {
    const illustrate = failingIllustrate();
    await expect(
      backfillImages(deps(illustrate, 20), { courseSlug: 'c', restyleScenes: true, confirmSpend: true, maxUsd: 100 }),
    ).rejects.toThrow(/systemic failure/i);
    // It stopped early rather than walking all twenty.
    expect(illustrate.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('does not abort while images are actually being produced', async () => {
    const illustrate = vi.fn<BackfillDeps['illustrate']>().mockImplementation(async (document) => {
      const clone = structuredClone(document) as unknown as { segments: Array<{ image_url?: string }> };
      clone.segments[0]!.image_url = 'http://depot.test/fresh.webp';
      return { document: clone as unknown as LessonDocumentParsed, generated: 1 };
    });

    const summary = await backfillImages(deps(illustrate, 6), {
      courseSlug: 'c',
      restyleScenes: true,
      confirmSpend: true,
      maxUsd: 100,
    });
    expect(summary.scanned).toBe(6);
  });

  // A measurement-only pass produces zero images BY DESIGN — the breaker must
  // not fire on it, or `--dry-run` could never survive its own third lesson.
  it('never fires the breaker on a measurement-only pass', async () => {
    const summary = await backfillImages(deps(failingIllustrate(), 20), { courseSlug: 'c', restyleScenes: true });
    expect(summary.scanned).toBe(20);
  });
});
