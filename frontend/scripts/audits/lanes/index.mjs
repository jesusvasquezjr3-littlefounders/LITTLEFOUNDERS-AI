import * as core from './core.mjs';
import * as family from './family.mjs';
import * as horizonte from './horizonte.mjs';
import * as learn from './learn.mjs';
import * as mentor from './mentor.mjs';
import * as profile from './profile.mjs';
import * as site from './site.mjs';
import * as staff from './staff.mjs';

/*
 * The audit's per-lane files (Lane 0 owns this index; each wave-2 lane edits
 * only its own file). A state id and a scenario name are unique across lanes:
 * two lanes claiming one would make the report ambiguous, so it refuses to load.
 */
export const LANES = [core, site, learn, mentor, family, profile, staff, horizonte];

function unique(kind, entries) {
  const owner = new Map();
  for (const [lane, id] of entries) {
    if (owner.has(id)) throw new Error(`Audit ${kind} "${id}" is declared by both ${owner.get(id)} and ${lane}`);
    owner.set(id, lane);
  }
}
unique('state', LANES.flatMap(({ lane, states }) => states.map((state) => [lane, state.id])));
unique('scenario', LANES.flatMap(({ lane, scenarios }) => Object.keys(scenarios).map((name) => [lane, name])));

export const LANE_STATES = LANES.flatMap(({ states }) => states);
export const LANE_SCENARIOS = Object.assign({}, ...LANES.map(({ scenarios }) => scenarios));
