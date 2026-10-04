import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HorizontePack } from './types.generated';
import { HORIZONTE_CAPABILITIES, horizontePackIdOf } from './contract';
import { HORIZONTE_FIXTURES } from './fixtures';

/*
 * The player ships only the capability tables and loads a pack's schemas, scorer and age scope when a document names one of its
 * types (BUD-1). Each test starts from a fresh module graph, so "not loaded yet" is the real starting state, not leftover state.
 */
const plain = {
  schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'saving-basics',
  lesson_id: 'pilot-allocation', version_id: 'rev-001', locale: 'es-MX', age_band: '6-9',
  eligibility: { minimum_age: 6, maximum_age: 9 },
  knowledge_component_ids: ['kc-saving-allocation'], adventure_scene_id: 'diorama-a', title: 'Divide tu dinero',
  required_capabilities: ['visual.stacked-bar.v1', 'operation.reallocate.v1'],
  segments: [{ id: 'allocate-01', type: 'money.allocation.v2', prompt: 'Divide 12 monedas.', grading: 'server',
    visual: { type: 'stacked-bar' }, payload: { total: 12, step: 1, currency: 'coins' } }],
};

async function fresh() {
  vi.resetModules();
  const contract = await import('./contract');
  const document = await import('../lessonDocument');
  const preview = await import('./previewDocument');
  const fixtures = await import('./fixtures');
  const doc = (pack: string): Record<string, unknown> => {
    const id = fixtures.HORIZONTE_FIXTURES[pack]![0]!.id;
    return preview.horizonteFixtureDocument(pack, id, 'en-US')!;
  };
  return { ...contract, load: document.loadLessonClientDocument, doc };
}

afterEach(() => {
  vi.doUnmock('./alg1/index');
  vi.resetModules();
});

describe('the player loads a Horizonte pack only when a document names it', () => {
  it('needs no pack for a document without a Horizonte segment', async () => {
    const c = await fresh();
    expect(c.horizontePacksFor(plain)).toEqual([]);
    expect(c.missingHorizontePacks(plain)).toEqual([]);
    expect(c.load(plain).status).toBe('ready');
  });

  it('names exactly the packs behind the types a document uses, once each', async () => {
    const c = await fresh();
    const golden = c.doc('golden');
    const alg1 = c.doc('alg1');
    expect(c.horizontePacksFor(golden)).toEqual(['golden']);
    expect(c.horizontePacksFor({ ...golden, segments: [...(golden.segments as unknown[]), ...(alg1.segments as unknown[]), ...(golden.segments as unknown[])] }).sort()).toEqual(['alg1', 'golden']);
    expect(c.horizontePacksFor(null)).toEqual([]);
    expect(c.horizontePacksFor({ segments: [null, 7, { type: 3 }, { type: 'money.allocation.v2' }] })).toEqual([]);
  });

  it('answers upgrade-required until the pack has loaded, then reads the document', async () => {
    const c = await fresh();
    const raw = c.doc('golden');
    expect(c.missingHorizontePacks(raw)).toEqual(['golden']);
    expect(c.load(raw).status).toBe('upgrade-required');
    await c.loadHorizontePacksFor(raw);
    expect(c.missingHorizontePacks(raw)).toEqual([]);
    expect(c.load(raw).status).toBe('ready');
  });

  it('loads one pack without loading another', async () => {
    const c = await fresh();
    await c.loadHorizontePacksFor(c.doc('golden'));
    const other = c.doc('alg1');
    expect(c.missingHorizontePacks(other)).toEqual(['alg1']);
    expect(c.load(other).status).toBe('upgrade-required');
  });

  it('keeps the segment schema itself closed to a segment whose pack is absent', async () => {
    const c = await fresh();
    const segment = (c.doc('golden').segments as Array<Record<string, unknown>>)[0]!;
    expect(c.horizonteSegmentGate.safeParse(segment).success).toBe(false);
    await c.loadHorizontePacksFor(c.doc('golden'));
    expect(c.horizonteSegmentGate.safeParse(segment).success).toBe(true);
  });

  it('still refuses a malformed segment once its pack is loaded', async () => {
    const c = await fresh();
    const raw = c.doc('golden');
    await c.loadHorizontePacksFor(raw);
    const broken = { ...raw, segments: [{ ...(raw.segments as Array<Record<string, unknown>>)[0], id: 42 }] };
    expect(c.load(broken).status).toBe('invalid');
  });

  it('fails closed on age scope and gives no verdict while the pack is absent', async () => {
    const c = await fresh();
    const raw = c.doc('golden') as { age_band: string; eligibility: { minimum_age: number; maximum_age: number }; segments: Array<{ type: string }> };
    const segment = raw.segments[0]!;
    expect(c.horizonteScopeProblem(segment, raw)).not.toBeNull();
    expect(c.horizonteClientVerdict(segment, {})).toBeUndefined();
    await c.loadHorizontePacksFor(raw);
    expect(c.horizonteScopeProblem(segment, raw)).toBeNull();
    expect(['valid', 'invalid']).toContain(c.horizonteClientVerdict(segment, {}));
  });

  it('forgets a download that failed, so the next attempt asks again', async () => {
    vi.resetModules();
    vi.doMock('./alg1/index', () => { throw new Error('chunk failed'); });
    const c = await import('./contract');
    const document = await import('../lessonDocument');
    const preview = await import('./previewDocument');
    const fixtures = await import('./fixtures');
    const raw = preview.horizonteFixtureDocument('alg1', fixtures.HORIZONTE_FIXTURES['alg1']![0]!.id, 'en-US')!;

    await expect(c.loadHorizontePacksFor(raw)).rejects.toThrow();
    expect(c.missingHorizontePacks(raw)).toEqual(['alg1']);
    expect(document.loadLessonClientDocument(raw).status).toBe('upgrade-required');

    vi.doUnmock('./alg1/index');
    await c.loadHorizontePacksFor(raw);
    expect(c.missingHorizontePacks(raw)).toEqual([]);
    expect(document.loadLessonClientDocument(raw).status).toBe('ready');
  });
});

describe('the thin tables the player keeps agree with the packs they stand for', () => {
  const modules = import.meta.glob<Record<string, HorizontePack>>('./*/index.ts', { eager: true });
  const packs = Object.entries(modules)
    .map(([path, exports]) => ({ dir: path.split('/')[1]!, pack: Object.values(exports)[0]! }))
    .filter(({ pack }) => typeof pack === 'object' && 'scorers' in pack);

  it('covers every pack folder, each under its own id', () => {
    expect(packs.length).toBe(Object.keys(HORIZONTE_FIXTURES).length);
    for (const { dir, pack } of packs) expect(pack.id, `${dir}: the pack's id is its folder`).toBe(dir);
    expect(new Set(Object.keys(HORIZONTE_CAPABILITIES).map((type) => horizontePackIdOf(type))), 'every type maps to a pack').toEqual(new Set(packs.map(({ pack }) => pack.id)));
  });

  it('lists each pack\'s types and capabilities exactly as the pack declares them', () => {
    for (const { pack } of packs) {
      const listed = Object.keys(HORIZONTE_CAPABILITIES).filter((type) => horizontePackIdOf(type) === pack.id).sort();
      expect(listed, `${pack.id}: the types the player maps to this pack`).toEqual(Object.keys(pack.capabilities).sort());
      for (const type of listed) expect((HORIZONTE_CAPABILITIES as Record<string, readonly string[]>)[type], `${type}: capabilities`).toEqual(pack.capabilities[type]);
    }
  });

  it('gives no type to two packs', () => {
    const declared = packs.flatMap(({ pack }) => Object.keys(pack.capabilities));
    expect(new Set(declared).size).toBe(declared.length);
    expect(Object.keys(HORIZONTE_CAPABILITIES).length).toBe(declared.length);
  });
});
