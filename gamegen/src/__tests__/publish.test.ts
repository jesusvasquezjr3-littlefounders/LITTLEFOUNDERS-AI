// Regression pins for the two publish invariants that cannot be enforced by a comment:
//   1. the SERVER-ONLY sidecar reaches the `validation` column and NEVER `document`
//      (a leak hands a client the numbers it needs to forge a maximal input log past
//      Core's replay — migration 0027's header), and
//   2. `status` is ALWAYS 'review' — there is no code path to 'published', because the
//      human review queue is the publish gate for kid-facing generated content.
// Plus the idempotency keys, because "re-publishing duplicates the game" is a defect
// you only discover on the second real run.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetConfigCache } from '../env.js';
import { publishGameSlot, splitGameDocument, type PublishGameInput } from '../pipeline/publish.js';
import { TopicResolutionError, resetTopicResolutionCache } from '../vault/gamesRepo.js';
import type { GameDocument, GameLocale, GameValidation } from '../contract/core/types.js';

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const saved: Record<string, string | undefined> = {};

interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
}

let calls: RecordedCall[] = [];
const realFetch = globalThis.fetch;

/** Vault stub: the hierarchy chain resolves, both upserts return a representation. */
function installVaultStub(options: { missingLevel?: 'course' | 'adventure' | 'saga' | 'topic' } = {}): void {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ url, method, body });

    const table = url.split('/rest/v1/')[1]?.split('?')[0] ?? '';
    const json = (payload: unknown): Response =>
      new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });

    if (method === 'GET') {
      const level =
        table === 'courses' ? 'course' : table === 'adventures' ? 'adventure' : table === 'sagas' ? 'saga' : 'topic';
      if (options.missingLevel === level) return json([]);
      return json([{ id: `id-${level}` }]);
    }
    if (table === 'games') return json([{ id: 'game-uuid' }]);
    return json([{ game_id: 'game-uuid' }]);
  }) as typeof fetch;
}

function makeDocument(locale: GameLocale, overrides: Partial<GameDocument> = {}): GameDocument {
  return {
    schema_version: 1,
    meta: {
      slug: 'reparte-la-mesada',
      title: locale === 'es-MX' ? 'Reparte la mesada' : 'Split the allowance',
      locale,
      mechanic: 'sorter',
      concept: { topic_path: 'mi-primer-dinero/ahorrar/necesidad-vs-deseo', recap_md: 'Necesidad o deseo.' },
      tier: 2,
      estimated_minutes: 3,
    },
    skin: { palette: 'navy-papaya', sprites: {} },
    config: { rounds: 3 },
    content: {
      items: [{ id: 'item-1', label_md: 'Leche' }],
      feedback: { correct_md: ['Bien'], incorrect_md: ['Casi'], results_md: 'Listo' },
    },
    scoring: { mode: 'arcade', xp_max: 15, pass_score: 70, lives: 3 },
    ...overrides,
  };
}

const VALIDATION: GameValidation = {
  max_score: 100,
  min_duration_seconds: 20,
  max_events: 400,
  item_values: { 'item-1': 12 },
};

function makeInput(documents: Partial<Record<GameLocale, GameDocument>>): PublishGameInput {
  return {
    courseSlug: 'mi-primer-dinero',
    blueprint: {
      slug: 'reparte-la-mesada',
      topicPath: 'mi-primer-dinero/ahorrar/necesidad-vs-deseo',
      mechanic: 'sorter',
      tier: 2,
      position: 1,
    },
    documents,
    validation: VALIDATION,
  };
}

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  // Placeholder credential: the VALUE starts with `test-`, which is exactly the
  // exemption agent/tools/check-secrets.sh recognizes (/AGENTS.md §1.14).
  process.env.SUPABASE_URL = 'http://vault.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-for-publish-specs';
  resetConfigCache();
  resetTopicResolutionCache();
  calls = [];
  installVaultStub();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetConfigCache();
  resetTopicResolutionCache();
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('splitGameDocument', () => {
  it('keeps the sidecar out of the client document', () => {
    const { clientDocument, validation } = splitGameDocument(makeDocument('es-MX'), VALIDATION);
    expect(clientDocument).not.toHaveProperty('validation');
    expect(JSON.stringify(clientDocument)).not.toContain('max_events');
    expect(validation).toEqual(VALIDATION);
  });

  it('refuses a document carrying a NESTED validation key', () => {
    const smuggled = makeDocument('es-MX');
    (smuggled.content as Record<string, unknown>).validation = VALIDATION;
    expect(() => splitGameDocument(smuggled, VALIDATION)).toThrow(/content\.validation/);
  });

  it('refuses a sidecar that does not satisfy the contract', () => {
    const bad = { ...VALIDATION, max_events: 0 } as GameValidation;
    expect(() => splitGameDocument(makeDocument('es-MX'), bad)).toThrow(/validation sidecar/);
  });
});

describe('publishGameSlot', () => {
  it('resolves the topic chain, upserts by (topic_id, slug) and (game_id, locale)', async () => {
    const result = await publishGameSlot(
      makeInput({ 'es-MX': makeDocument('es-MX'), 'en-US': makeDocument('en-US') }),
    );

    expect(result.gameId).toBe('game-uuid');
    expect(result.topicId).toBe('id-topic');
    expect(result.localesPublished).toEqual(['es-MX', 'en-US']);
    expect(result.xpMax).toBe(15);

    const reads = calls.filter((call) => call.method === 'GET').map((call) => call.url);
    expect(reads).toHaveLength(4);
    expect(reads[0]).toContain('/courses?select=id&slug=eq.mi-primer-dinero');
    expect(reads[3]).toContain('/topics?select=id&saga_id=eq.id-saga');

    const gameCall = calls.find((call) => call.url.includes('/games?'));
    expect(gameCall?.url).toContain('on_conflict=topic_id,slug');
    const docCall = calls.find((call) => call.url.includes('/game_documents?'));
    expect(docCall?.url).toContain('on_conflict=game_id,locale');
  });

  it("never writes a status other than 'review'", async () => {
    const result = await publishGameSlot(makeInput({ 'es-MX': makeDocument('es-MX') }));
    expect(result.status).toBe('review');
    const gameRows = calls.find((call) => call.url.includes('/games?'))?.body as { status: string }[];
    expect(gameRows[0]?.status).toBe('review');
    expect(JSON.stringify(calls)).not.toContain('published');
  });

  it('writes the sidecar to the validation column only', async () => {
    await publishGameSlot(makeInput({ 'es-MX': makeDocument('es-MX'), 'pt-BR': makeDocument('pt-BR') }));
    const rows = calls.find((call) => call.url.includes('/game_documents?'))?.body as {
      locale: string;
      document: Record<string, unknown>;
      validation: Record<string, unknown>;
    }[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.document).not.toHaveProperty('validation');
      expect(JSON.stringify(row.document)).not.toContain('min_duration_seconds');
      expect(row.validation.max_events).toBe(400);
    }
  });

  it('fails the slot when the topic path does not resolve', async () => {
    installVaultStub({ missingLevel: 'saga' });
    await expect(publishGameSlot(makeInput({ 'es-MX': makeDocument('es-MX') }))).rejects.toBeInstanceOf(
      TopicResolutionError,
    );
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('refuses a document whose meta disagrees with its blueprint', async () => {
    const drifted = makeDocument('es-MX');
    drifted.meta.slug = 'otro-juego';
    await expect(publishGameSlot(makeInput({ 'es-MX': drifted }))).rejects.toThrow(/disagrees with its blueprint/);
  });

  it('refuses locale-dependent xp_max', async () => {
    const enUS = makeDocument('en-US');
    enUS.scoring = { ...enUS.scoring, xp_max: 40 };
    await expect(
      publishGameSlot(makeInput({ 'es-MX': makeDocument('es-MX'), 'en-US': enUS })),
    ).rejects.toThrow(/locale-dependent scoring.xp_max/);
  });

  it('refuses a slot with no documents', async () => {
    await expect(publishGameSlot(makeInput({}))).rejects.toThrow(/no generated documents/);
  });
});
