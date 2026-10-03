import { ALG1_BEHAVIOUR } from './alg1.js';
import { ALG2_BEHAVIOUR } from './alg2.js';
import { BALANCE_BEHAVIOUR } from './balance.js';
import { COM_BEHAVIOUR } from './com.js';
import { FIN_BEHAVIOUR } from './fin.js';
import { FIN2_BEHAVIOUR } from './fin2.js';
import { GEOM2_BEHAVIOUR } from './geom2.js';
import { NUMA_BEHAVIOUR } from './numa.js';
import { NUMBER_BEHAVIOUR } from './numbers.js';
import { PLANE_BEHAVIOUR } from './plane.js';
import { PROB_BEHAVIOUR } from './prob.js';
import { SOLIDS_BEHAVIOUR } from './solids.js';
import { SPACE_LIMIT, type HzBuilder, type HzSpace, type Json } from './shared.js';
import { SPACE1_BEHAVIOUR } from './space1.js';
import { SPACE2_BEHAVIOUR } from './space2.js';
import { STATS_BEHAVIOUR } from './stats.js';

/** The seeded simulations (sim1, sim2) are graded against an attempt the gate never has, so they stay fail-closed here. */
const BUILDERS: Readonly<Record<string, HzBuilder>> = {
  ...NUMBER_BEHAVIOUR,
  ...NUMA_BEHAVIOUR,
  ...ALG1_BEHAVIOUR,
  ...ALG2_BEHAVIOUR,
  ...BALANCE_BEHAVIOUR,
  ...STATS_BEHAVIOUR,
  ...PLANE_BEHAVIOUR,
  ...FIN_BEHAVIOUR,
  ...FIN2_BEHAVIOUR,
  ...GEOM2_BEHAVIOUR,
  ...PROB_BEHAVIOUR,
  ...COM_BEHAVIOUR,
  ...SOLIDS_BEHAVIOUR,
  ...SPACE1_BEHAVIOUR,
  ...SPACE2_BEHAVIOUR,
};

export const horizonteBehaviourKinds = (): string[] => Object.keys(BUILDERS).sort();

/** The behaviour space of a Horizonte kind, or null for a kind or a mode it does not model (the gate then fails closed). */
export function horizonteBehaviourSpace(segment: Json, rubric: Json): HzSpace | null {
  const builder = Object.hasOwn(BUILDERS, segment.type) ? BUILDERS[segment.type as string] : undefined;
  if (!builder || typeof segment.payload !== 'object' || segment.payload === null || typeof rubric !== 'object' || rubric === null) return null;
  try {
    const space = builder(segment.payload as Json, rubric, segment);
    if (!space || space.inRange.length === 0 || space.inRange.length > SPACE_LIMIT * 2) return null;
    return space;
  } catch {
    return null;
  }
}
