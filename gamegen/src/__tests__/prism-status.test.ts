// Prism's HTTP STATUS IS A RETRY INSTRUCTION (picturegen/AGENTS.md), and the
// `illustrate` loop is the exact shape that defeated Forge's budget cap.
//
// Two independent invariants are pinned here, in the order a run meets them:
//
//  1. TRANSPORT — a 502 from picturegen is transient and retried; a 4xx (422, 400)
//     is TERMINAL and must never be retried. Re-asking for a generation that can
//     never differ re-pays it: with the 4-attempt ladder and 3 targets that is up to
//     12 paid generations for one broken request. `ProviderHttpError.retryable`
//     already encodes the split — this suite proves `requestPicture` actually
//     inherits it rather than wrapping the call in its own catch.
//
//  2. STAGE — a failed image NEVER fails a slot (every item keeps its Material
//     Symbols `icon` fallback), with EXACTLY TWO exemptions that must ESCAPE:
//     `ProviderNotConfiguredError` (skip the whole document, reported, not silent)
//     and `BudgetExceededError`. The kill switch only exists if the error escapes —
//     Forge's `illustrateSegments` swallowed it per target, so a run that had
//     already hit its USD cap kept walking every remaining image, paid for each,
//     and shipped lessons with silently missing art while the cap read as enforced.
//     `illustrateGame` loops over sprite slots: identical shape, identical trap.
//
// Every network boundary is mocked. Nothing here can reach picturegen, DashScope or
// Vault, and no test in this file spends anything.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { resetConfigCache } from '../env.js';
import { requestPicture, type PictureResult } from '../providers/picturegen.js';
import { ProviderHttpError, ProviderNotConfiguredError } from '../providers/errors.js';
import { BudgetExceededError, UsageLedger } from '../providers/usage.js';
import { illustrateGame } from '../pipeline/images.js';
import type { GameDocument } from '../contract/core/types.js';

const PRISM_ENV = ['PICTUREGEN_URL', 'PICTUREGEN_INTERNAL_KEY'] as const;
const saved: Record<string, string | undefined> = {};

let ledgerDir: string;

beforeEach(() => {
  for (const key of PRISM_ENV) saved[key] = process.env[key];
  process.env.PICTUREGEN_URL = 'http://prism.test';
  // Placeholder credential: the VALUE starts with `test-`, the exemption
  // agent/tools/check-secrets.sh recognizes for a min(16) fixture (/AGENTS.md §1.14).
  process.env.PICTUREGEN_INTERNAL_KEY = 'test-prism-internal-key-not-a-credential';
  resetConfigCache();
  ledgerDir = mkdtempSync(path.join(tmpdir(), 'arcade-prism-'));
});

afterEach(() => {
  for (const key of PRISM_ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetConfigCache();
  rmSync(ledgerDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A Prism §1.6 success envelope. */
function prismOk(url: string, cached = false): Response {
  return new Response(JSON.stringify({ data: { url, file_id: 'file-1', cached }, error: null }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** A Prism §1.6 error envelope at an arbitrary status. */
function prismErr(status: number, code: string): Response {
  return new Response(JSON.stringify({ data: null, error: { code, message: code } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// 1. Transport — the status decides whether we ask again
// ---------------------------------------------------------------------------

describe('requestPicture — Prism status is a retry instruction', () => {
  it('RETRIES a 502: the generation may still succeed, so the transient failure is not terminal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(prismErr(502, 'BAD_GATEWAY'))
      .mockResolvedValueOnce(prismErr(502, 'BAD_GATEWAY'))
      .mockResolvedValueOnce(prismOk('https://depot.test/a.webp'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestPicture({ label: 'manzana', purpose: 'game_sprite' });

    expect(result.url).toBe('https://depot.test/a.webp');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('DOES NOT RETRY a 422 — the request can never succeed, and re-asking re-pays a generation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(prismErr(422, 'UNPROCESSABLE'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestPicture({ label: 'manzana', purpose: 'game_sprite' })).rejects.toMatchObject({
      name: 'ProviderHttpError',
      status: 422,
      retryable: false,
    });
    // The whole point: ONE call, not the 4-attempt ladder.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('DOES NOT RETRY a 400 either — an over-long label is our bug, not Prism having a bad minute', async () => {
    const fetchMock = vi.fn().mockResolvedValue(prismErr(400, 'VALIDATION_ERROR'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestPicture({ label: 'x'.repeat(500) })).rejects.toBeInstanceOf(ProviderHttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses without ever opening a socket when Prism is not configured', async () => {
    delete process.env.PICTUREGEN_INTERNAL_KEY;
    resetConfigCache();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestPicture({ label: 'manzana' })).rejects.toBeInstanceOf(ProviderNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the internal key and the requested purpose to Prism, and nothing else', async () => {
    const fetchMock = vi.fn().mockResolvedValue(prismOk('https://depot.test/b.webp', true));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestPicture({ label: 'tienda', context: 'Concept: ahorrar', purpose: 'game_background' });

    expect(result.cached).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://prism.test/api/v1/pictures');
    expect((init.headers as Record<string, string>)['x-internal-api-key']).toBe(
      'test-prism-internal-key-not-a-credential',
    );
    expect(JSON.parse(String(init.body))).toEqual({
      label: 'tienda',
      context: 'Concept: ahorrar',
      purpose: 'game_background',
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Stage — what a per-image failure may and may not do to the run
// ---------------------------------------------------------------------------

/** A sorter manifest with two categories and one item bound to declared slots.
 *  Only the fields `illustrateGame` actually reads matter here; the schema-level
 *  contract is exercised by `simulateGate.test.ts` and `publish.test.ts`. */
function sorterDocument(): GameDocument {
  return {
    schema_version: 1,
    meta: {
      slug: 'necesito-o-quiero',
      title: 'Necesito o quiero',
      locale: 'es-MX',
      mechanic: 'sorter',
      concept: {
        topic_path: 'mi-primer-dinero/decidir-con-calma/necesidades-y-deseos',
        recap_md: 'Una necesidad no puede esperar; un deseo si.',
      },
      tier: 1,
      estimated_minutes: 3,
    },
    skin: { palette: 'forest-pear', sprites: {} },
    config: { mode: 'static' },
    content: {
      categories: [
        { id: 'necesito', label_md: 'Necesito', image_slot: 'bin_1' },
        { id: 'quiero', label_md: 'Quiero', image_slot: 'bin_2' },
      ],
      items: [{ id: 'agua', label_md: 'Agua para tomar', category: 'necesito', icon: 'water_drop', image_slot: 'item_1' }],
      feedback: { correct_md: ['Bien'], incorrect_md: ['Casi'], results_md: 'Listo' },
    },
    scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null },
  };
}

/** A ledger whose caps are already blown — the state a mid-run kill switch is in. */
async function exhaustedLedger(): Promise<UsageLedger> {
  const ledger = new UsageLedger(ledgerDir);
  await ledger.hydrate({ maxTokens: 10, maxUsd: 1000 });
  await ledger.record({
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    operation: 'author',
    promptTokens: 100,
    completionTokens: 100,
  });
  expect(() => ledger.checkBudget()).toThrow(BudgetExceededError);
  return ledger;
}

describe('illustrateGame — a failed image never fails the slot', () => {
  it('keeps illustrating the remaining slots after a TERMINAL 422 on one target', async () => {
    let call = 0;
    const request = vi.fn(async (): Promise<PictureResult> => {
      call += 1;
      if (call === 2) throw new ProviderHttpError('picturegen', 422, 'UNPROCESSABLE');
      return { url: `https://depot.test/${call}.webp`, fileId: `f${call}`, cached: false };
    });

    const result = await illustrateGame(sorterDocument(), {}, { request });

    // The doomed target simply keeps its icon/text fallback; everything else fills.
    expect(request.mock.calls.length).toBeGreaterThan(2);
    expect(result.generated).toBe(request.mock.calls.length - 1);
    expect(result.skippedReason).toBeUndefined();
    expect(Object.keys(result.document.skin.sprites).length).toBeGreaterThan(0);
  });

  it('bills only FRESH generations — a Prism cache hit costs nothing', async () => {
    const ledger = new UsageLedger(ledgerDir);
    const request = vi.fn(
      async (): Promise<PictureResult> => ({ url: 'https://depot.test/c.webp', fileId: 'f', cached: true }),
    );

    const result = await illustrateGame(sorterDocument(), { ledger }, { request });

    expect(result.generated).toBeGreaterThan(0);
    expect(result.billed).toBe(0);
    expect(ledger.usd).toBe(0);
    expect(ledger.images).toBe(0);
  });
});

describe('illustrateGame — the two exemptions that MUST escape', () => {
  it('PROPAGATES BudgetExceededError instead of degrading it to "skip this image"', async () => {
    const ledger = await exhaustedLedger();
    const request = vi.fn(
      async (): Promise<PictureResult> => ({ url: 'https://depot.test/x.webp', fileId: 'f', cached: false }),
    );

    await expect(illustrateGame(sorterDocument(), { ledger }, { request })).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
    // checkBudget runs BEFORE the paid call, so the over-cap run pays for NOTHING —
    // not even the first sprite of the first slot it was about to walk.
    expect(request).not.toHaveBeenCalled();
  });

  it('does not let a swallowing catch turn the cap into a suggestion mid-document', async () => {
    // The cap is blown by the FIRST image's own accounting: a naive per-target catch
    // would log "skipping bin_2 — budget exceeded" and keep paying for the rest.
    const ledger = new UsageLedger(ledgerDir);
    await ledger.hydrate({ maxTokens: 5_000_000, maxUsd: 0.0349 }); // < one qwen-image
    const request = vi.fn(
      async (): Promise<PictureResult> => ({ url: 'https://depot.test/y.webp', fileId: 'f', cached: false }),
    );

    await expect(illustrateGame(sorterDocument(), { ledger }, { request })).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
    expect(request).toHaveBeenCalledTimes(1); // exactly one image paid for, then STOP
  });

  it('turns ProviderNotConfiguredError into a reported skip of the WHOLE document, unmodified', async () => {
    const request = vi.fn(async (): Promise<PictureResult> => {
      throw new ProviderNotConfiguredError('picturegen');
    });
    const document = sorterDocument();

    const result = await illustrateGame(document, {}, { request });

    expect(result.skippedReason).toBe('not-configured');
    expect(result.generated).toBe(0);
    expect(result.document.skin.sprites).toEqual({});
    expect(result.document.skin.background_url).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1); // bailed on the first refusal, did not walk 27 slots
  });

  it('the --no-images flag costs nothing and mutates nothing', async () => {
    const request = vi.fn();
    const result = await illustrateGame(sorterDocument(), { skip: true }, { request });
    expect(result.skippedReason).toBe('flag');
    expect(request).not.toHaveBeenCalled();
  });
});
