import type { V2DocumentLike } from '../gates.js';
import type { GateProblem } from '../../pipeline/gates.js';
import { answerLeakGates } from './answerLeak.js';
import { golden } from './golden.js';
import { numA } from './num-a.js';
import { numB } from './num-b.js';
import { balance } from './balance.js';
import { stats1 } from './stats1.js';
import { plane1 } from './plane1.js';
import { fin1 } from './fin1.js';
import { fin2 } from './fin2.js';
import { alg1 } from './alg1.js';
import { alg2 } from './alg2.js';
import { geom2 } from './geom2.js';
import { prob } from './prob.js';
import { com } from './com.js';
import { sim1 } from './sim1.js';
import { sim2 } from './sim2.js';
import { solids } from './solids.js';
import { space1 } from './space1.js';
import { space2 } from './space2.js';

/** Registered here once; a pack lane edits only its own file. */
export const HORIZONTE_FORGE_PACKS = [golden, numA, numB, balance, stats1, plane1, fin1, fin2, alg1, alg2, geom2, prob, com, sim1, sim2, solids, space1, space2] as const;
export const HORIZONTE_FORGE_CAPABILITIES = {
  ...golden.capabilities,
  ...numA.capabilities,
  ...numB.capabilities,
  ...balance.capabilities,
  ...stats1.capabilities,
  ...plane1.capabilities,
  ...fin1.capabilities,
  ...fin2.capabilities,
  ...alg1.capabilities,
  ...alg2.capabilities,
  ...geom2.capabilities,
  ...prob.capabilities,
  ...com.capabilities,
  ...sim1.capabilities,
  ...sim2.capabilities,
  ...solids.capabilities,
  ...space1.capabilities,
  ...space2.capabilities,
} as const;

const HORIZONTE_TYPES: ReadonlySet<string> = new Set(Object.keys(HORIZONTE_FORGE_CAPABILITIES));

/** Authoring guidance lines for the segment types a lesson skeleton uses. */
export function horizonteGuidanceFor(types: readonly string[]): string[] {
  const used = new Set(types);
  return HORIZONTE_FORGE_PACKS.flatMap((pack) => (pack.guidance as readonly { type: string; lines: readonly string[] }[]).filter((entry) => used.has(entry.type)).flatMap((entry) => entry.lines));
}

/** Every pack's piece gates over one document and its private keys. */
export function horizontePieceGates(document: V2DocumentLike, answerKeys?: Record<string, unknown>): GateProblem[] {
  const packs = HORIZONTE_FORGE_PACKS.flatMap((pack) => (pack.gates as (document: V2DocumentLike, answerKeys?: Record<string, unknown>) => GateProblem[])(document, answerKeys));
  return [...packs, ...answerLeakGates(document, answerKeys, HORIZONTE_TYPES)];
}
