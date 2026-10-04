import { z } from 'zod';
import type { V2VisualVerdict } from '../v2VisualScorer.generated';
import { isSeededCapabilitySet } from './seed/protocol.generated';
import { horizonteAgeScopeProblem } from './shared.generated';
import type { HorizontePack } from './types.generated';
import type { HorizonteSegment } from './segmentType';
import { GOLDEN_CAPABILITIES } from './golden/capabilities';
import { NUM_A_CAPABILITIES } from './num-a/capabilities';
import { NUM_B_CAPABILITIES } from './num-b/capabilities';
import { BALANCE_CAPABILITIES } from './balance/capabilities';
import { STATS1_CAPABILITIES } from './stats1/capabilities';
import { PLANE1_CAPABILITIES } from './plane1/capabilities';
import { FIN1_CAPABILITIES } from './fin1/capabilities';
import { FIN2_CAPABILITIES } from './fin2/capabilities';
import { ALG1_CAPABILITIES } from './alg1/capabilities';
import { ALG2_CAPABILITIES } from './alg2/capabilities';
import { GEOM2_CAPABILITIES } from './geom2/capabilities';
import { PROB_CAPABILITIES } from './prob/capabilities';
import { COM_CAPABILITIES } from './com/capabilities';
import { SIM1_CAPABILITIES } from './sim1/capabilities';
import { SIM2_CAPABILITIES } from './sim2/capabilities';
import { SOLIDS_CAPABILITIES } from './solids/capabilities';
import { SPACE1_CAPABILITIES } from './space1/capabilities';
import { SPACE2_CAPABILITIES } from './space2/capabilities';

export type { HorizonteSegment };

/*
 * Everything here ships with the lesson player, so it holds only what the player needs before any piece is on screen: which
 * segment types exist (the capability literals, imports-free) and which pack serves each. A pack's schemas, models, age scope
 * and scorer load only when a document names one of its types (`loadHorizontePacksFor`), so an ordinary lesson downloads none
 * of them. A pack lane registers itself here twice: its capabilities and its loader.
 */
const PACK_CAPABILITIES = {
  'golden': GOLDEN_CAPABILITIES,
  'num-a': NUM_A_CAPABILITIES,
  'num-b': NUM_B_CAPABILITIES,
  'balance': BALANCE_CAPABILITIES,
  'stats1': STATS1_CAPABILITIES,
  'plane1': PLANE1_CAPABILITIES,
  'fin1': FIN1_CAPABILITIES,
  'fin2': FIN2_CAPABILITIES,
  'alg1': ALG1_CAPABILITIES,
  'alg2': ALG2_CAPABILITIES,
  'geom2': GEOM2_CAPABILITIES,
  'prob': PROB_CAPABILITIES,
  'com': COM_CAPABILITIES,
  'sim1': SIM1_CAPABILITIES,
  'sim2': SIM2_CAPABILITIES,
  'solids': SOLIDS_CAPABILITIES,
  'space1': SPACE1_CAPABILITIES,
  'space2': SPACE2_CAPABILITIES,
} as const;
export type HorizontePackId = keyof typeof PACK_CAPABILITIES;

const PACK_LOADERS: Readonly<Record<HorizontePackId, () => Promise<HorizontePack>>> = {
  'golden': async () => (await import('./golden/index')).golden,
  'num-a': async () => (await import('./num-a/index')).numA,
  'num-b': async () => (await import('./num-b/index')).numB,
  'balance': async () => (await import('./balance/index')).balance,
  'stats1': async () => (await import('./stats1/index')).stats1,
  'plane1': async () => (await import('./plane1/index')).plane1,
  'fin1': async () => (await import('./fin1/index')).fin1,
  'fin2': async () => (await import('./fin2/index')).fin2,
  'alg1': async () => (await import('./alg1/index')).alg1,
  'alg2': async () => (await import('./alg2/index')).alg2,
  'geom2': async () => (await import('./geom2/index')).geom2,
  'prob': async () => (await import('./prob/index')).prob,
  'com': async () => (await import('./com/index')).com,
  'sim1': async () => (await import('./sim1/index')).sim1,
  'sim2': async () => (await import('./sim2/index')).sim2,
  'solids': async () => (await import('./solids/index')).solids,
  'space1': async () => (await import('./space1/index')).space1,
  'space2': async () => (await import('./space2/index')).space2,
};

export const HORIZONTE_CAPABILITIES = {
  ...PACK_CAPABILITIES['golden'],
  ...PACK_CAPABILITIES['num-a'],
  ...PACK_CAPABILITIES['num-b'],
  ...PACK_CAPABILITIES['balance'],
  ...PACK_CAPABILITIES['stats1'],
  ...PACK_CAPABILITIES['plane1'],
  ...PACK_CAPABILITIES['fin1'],
  ...PACK_CAPABILITIES['fin2'],
  ...PACK_CAPABILITIES['alg1'],
  ...PACK_CAPABILITIES['alg2'],
  ...PACK_CAPABILITIES['geom2'],
  ...PACK_CAPABILITIES['prob'],
  ...PACK_CAPABILITIES['com'],
  ...PACK_CAPABILITIES['sim1'],
  ...PACK_CAPABILITIES['sim2'],
  ...PACK_CAPABILITIES['solids'],
  ...PACK_CAPABILITIES['space1'],
  ...PACK_CAPABILITIES['space2'],
} as const;

const TYPES: ReadonlySet<string> = new Set(Object.keys(HORIZONTE_CAPABILITIES));
const PACK_OF_TYPE: ReadonlyMap<string, HorizontePackId> = new Map(
  (Object.entries(PACK_CAPABILITIES) as Array<[HorizontePackId, Readonly<Record<string, readonly string[]>>]>)
    .flatMap(([id, capabilities]) => Object.keys(capabilities).map((type) => [type, id] as const)),
);

export function isHorizonteType(type: string): boolean { return TYPES.has(type); }
export function isHorizonteSegment(segment: { type: string }): segment is HorizonteSegment { return TYPES.has(segment.type); }
/** A seeded type simulates from a seed Core issues with the attempt; it never runs without one. */
export function isSeededHorizonteType(type: string): boolean {
  return TYPES.has(type) && isSeededCapabilitySet((HORIZONTE_CAPABILITIES as Record<string, readonly string[]>)[type] ?? []);
}
export function horizontePackIdOf(type: string): HorizontePackId | undefined { return PACK_OF_TYPE.get(type); }

type LoadedPack = { segments: z.ZodType; ageScope: HorizontePack['ageScope']; scorers: HorizontePack['scorers'] };
const loaded = new Map<HorizontePackId, LoadedPack>();
const loading = new Map<HorizontePackId, Promise<void>>();

function loadPack(id: HorizontePackId): Promise<void> {
  if (loaded.has(id)) return Promise.resolve();
  let pending = loading.get(id);
  if (!pending) {
    // A failed load is forgotten, so the next attempt asks the network again instead of replaying the failure.
    pending = PACK_LOADERS[id]()
      .then((pack) => {
        const segments = z.discriminatedUnion('type', pack.segments as unknown as [z.ZodObject<{ type: z.ZodLiteral<string> }>, ...Array<z.ZodObject<{ type: z.ZodLiteral<string> }>>]);
        loaded.set(id, { segments, ageScope: pack.ageScope, scorers: pack.scorers });
      })
      .finally(() => { loading.delete(id); });
    loading.set(id, pending);
  }
  return pending;
}

export function loadHorizontePacks(ids: readonly HorizontePackId[]): Promise<void> {
  return Promise.all([...new Set(ids)].map(loadPack)).then(() => undefined);
}

/** The packs a raw lesson document needs: the one behind each Horizonte type its segments name, and nothing else. */
export function horizontePacksFor(raw: unknown): HorizontePackId[] {
  const segments = typeof raw === 'object' && raw !== null ? (raw as { segments?: unknown }).segments : undefined;
  if (!Array.isArray(segments)) return [];
  const ids = new Set<HorizontePackId>();
  for (const item of segments) {
    const type = typeof item === 'object' && item !== null ? (item as { type?: unknown }).type : undefined;
    const id = typeof type === 'string' ? PACK_OF_TYPE.get(type) : undefined;
    if (id) ids.add(id);
  }
  return [...ids];
}
/** The packs a document needs that are not loaded yet; empty means it can be validated and played now. */
export function missingHorizontePacks(raw: unknown): HorizontePackId[] { return horizontePacksFor(raw).filter((id) => !loaded.has(id)); }
export function loadHorizontePacksFor(raw: unknown): Promise<void> { return loadHorizontePacks(horizontePacksFor(raw)); }
/** Preview, audit and tests stage any piece, so they load every pack up front; the player never calls this. */
export function loadAllHorizontePacks(): Promise<void> { return loadHorizontePacks(Object.keys(PACK_LOADERS) as HorizontePackId[]); }

const TYPE_LIST = Object.keys(HORIZONTE_CAPABILITIES) as [string, ...string[]];
/**
 * The document schema's one member for every Horizonte type: it picks the type, then hands the segment to its pack's own
 * schemas. A pack that is not loaded cannot vouch for its segment, so the segment fails closed (the loader never asks).
 */
export const horizonteSegmentGate = z.object({ type: z.enum(TYPE_LIST) }).loose().transform((value, ctx): HorizonteSegment => {
  const id = PACK_OF_TYPE.get(value.type);
  const pack = id ? loaded.get(id) : undefined;
  if (!pack) {
    ctx.addIssue({ code: 'custom', path: ['type'], message: 'The pack for this segment is not loaded' });
    return z.NEVER;
  }
  const parsed = pack.segments.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    return z.NEVER;
  }
  return parsed.data as HorizonteSegment;
});

export function horizonteScopeProblem(segment: { type: string }, document: { age_band: string; eligibility: { minimum_age: number; maximum_age: number } }): string | null {
  const id = PACK_OF_TYPE.get(segment.type);
  return id ? horizonteAgeScopeProblem(loaded.get(id)?.ageScope[segment.type], document) : null;
}

/** Advisory instant feedback, never a grade: the browser has no rubric, so a pack scorer can only say invalid or valid. */
export function horizonteClientVerdict(segment: { type: string }, answer: unknown): 'valid' | 'invalid' | undefined {
  const id = PACK_OF_TYPE.get(segment.type);
  const scorer = id ? loaded.get(id)?.scorers[segment.type] : undefined;
  if (!scorer) return undefined;
  try {
    const verdict: V2VisualVerdict = (scorer.grade as unknown as (segment: unknown, response: unknown, rubric: undefined) => { verdict: V2VisualVerdict })(segment, answer, undefined).verdict;
    return verdict === 'invalid' ? 'invalid' : 'valid';
  } catch {
    return 'invalid';
  }
}
