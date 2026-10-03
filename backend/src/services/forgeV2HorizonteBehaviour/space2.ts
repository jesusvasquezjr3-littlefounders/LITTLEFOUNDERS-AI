import { range, type HzBuilder, type HzSpace, type Json } from './shared.js';

const IDS = ['a', 'b', 'c', 'd'];

/** One choice from a short list: the key is met, any other listed choice is a misread value, and a blank choice is the start. */
function choice(ids: readonly string[], key: string): HzSpace {
  const stray = ids.length < IDS.length ? IDS[ids.length]! : 'e';
  return {
    inRange: ids.map((id) => ({ choice: id })),
    invalid: [
      { choice: stray }, { choice: 'A' }, { choice: ` ${ids[0]}` }, { choice: 'ab' }, { choice: 1 }, { choice: null }, { choice: ['a'] }, {}, { choice: ids[0], extra: 1 }, { pick: ids[0] }, null, [], 'x',
    ],
    initial: { choice: '' },
    expectMet: (response) => response.choice === key,
    expectDiagnostic: () => 'value',
  };
}

const only = (values: readonly bigint[], wanted: (value: bigint) => boolean): number | null => {
  const hits = values.flatMap((value, index) => (wanted(value) ? [index] : []));
  return hits.length === 1 ? hits[0]! : null;
};

/* ── math.surface.v2 ── */

const grow = (cents: bigint, bps: bigint, years: number): bigint => {
  let amount = cents;
  for (let year = 0; year < years; year += 1) amount = (amount * (10_000n + bps) + 5_000n) / 10_000n;
  return amount;
};

const surface: HzBuilder = (p) => {
  const spec = p.surface as Json;
  const options = p.options as Json[];
  const ask = p.ask as Json;
  if (!Array.isArray(options) || options.length < 2 || options.length > 4) return null;
  const at = (x: number, y: number): bigint => (spec.kind === 'compound'
    ? grow(BigInt(spec.principalCents), BigInt(spec.ratesBps[x]), spec.terms[y])
    : BigInt(spec.units[y]) * (BigInt(spec.prices[x]) - BigInt(spec.unitCostCents)) - BigInt(spec.fixedCents));
  if (spec.kind !== 'compound' && spec.kind !== 'profit') return null;
  const values = options.map((option) => at(option.x, option.y));
  const top = values.reduce((a, b) => (a > b ? a : b));
  const bottom = values.reduce((a, b) => (a < b ? a : b));
  const hit = ask.kind === 'highest' ? only(values, (value) => value === top)
    : ask.kind === 'lowest' ? only(values, (value) => value === bottom)
      : ask.kind === 'reach' ? only(values, (value) => value >= BigInt(ask.targetCents)) : null;
  if (hit === null) return null;
  return choice(options.map((_, index) => IDS[index]!), IDS[hit]!);
};

/* ── geography.globe-route.v2 ── */

const PLACES: Readonly<Record<string, readonly [number, number]>> = {
  'mexico-city': [19.4, -99.1], 'los-angeles': [34.1, -118.2], houston: [29.8, -95.4], 'new-york': [40.7, -74.0],
  bogota: [4.7, -74.1], 'sao-paulo': [-23.6, -46.6], lisbon: [38.7, -9.1], madrid: [40.4, -3.7],
  lagos: [6.5, 3.4], nairobi: [-1.3, 36.8], johannesburg: [-26.2, 28.0], dubai: [25.2, 55.3],
  mumbai: [19.1, 72.9], manila: [14.6, 121.0], tokyo: [35.7, 139.7], sydney: [-33.9, 151.2],
};

const rad = (degrees: number): number => (degrees * Math.PI) / 180;

const kilometres = (from: string, to: string): number => {
  const [lat1, lon1] = PLACES[from]!;
  const [lat2, lon2] = PLACES[to]!;
  const sine = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(sine), Math.sqrt(1 - sine)));
};

const globe: HzBuilder = (p) => {
  const routes = p.routes as Json[];
  if (!Array.isArray(routes) || routes.length < 2 || routes.length > 4) return null;
  if (routes.some((route) => !Object.hasOwn(PLACES, route.from) || !Object.hasOwn(PLACES, route.to))) return null;
  let hit: number | null;
  if (p.ask === 'cheapest') {
    const fees = routes.map((route) => (BigInt(p.sendCents) * BigInt(route.feeBps) + 5_000n) / 10_000n + BigInt(route.flatCents));
    const least = fees.reduce((a, b) => (a < b ? a : b));
    hit = only(fees, (fee) => fee === least);
  } else {
    const km = routes.map((route) => kilometres(route.from, route.to));
    const order = range(0, km.length - 1).sort((a, b) => (p.ask === 'shortest' ? km[a]! - km[b]! : km[b]! - km[a]!));
    const best = km[order[0]!]!;
    const gap = Math.abs(km[order[1]!]! - best);
    hit = p.ask !== 'shortest' && p.ask !== 'longest' ? null : gap * 50 >= best ? order[0]! : null;
  }
  if (hit === null) return null;
  return choice(routes.map((_, index) => IDS[index]!), IDS[hit]!);
};

export const SPACE2_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'math.surface.v2': surface,
  'geography.globe-route.v2': globe,
};
