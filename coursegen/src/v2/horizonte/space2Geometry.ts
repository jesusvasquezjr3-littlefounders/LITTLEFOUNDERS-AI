/*
 * The Forge copy of the space2 models (F4.7 surface, F4.8 globe, F4.9 AR table). The Forge imports nothing from the backend,
 * so the pure rules the solvability checkers and gate 4 need are repeated here and pinned by the pack test. Every value is
 * whole cents or whole kilometres computed with integers, exactly as Core computes them.
 */

export const SURFACE_KINDS = ['compound', 'profit'] as const;
export type SurfaceKind = (typeof SURFACE_KINDS)[number];
export const SURFACE_ASKS = ['highest', 'lowest', 'reach'] as const;
export const SURFACE_OPTION_IDS = ['a', 'b', 'c', 'd'] as const;
export type SurfaceOptionId = (typeof SURFACE_OPTION_IDS)[number];

export const SURFACE_LIMITS = {
  xCount: { min: 3, max: 6 },
  yCount: { min: 3, max: 7 },
  options: { min: 2, max: 4 },
  rateBps: 1500,
  termYears: 40,
  principalCents: { min: 100, max: 1_000_000 },
  priceCents: 100_000,
  units: 1000,
  unitCostCents: 50_000,
  fixedCents: 1_000_000,
  targetCents: 1_000_000_000,
} as const;

export interface CompoundSurface { kind: 'compound'; principalCents: number; ratesBps: number[]; terms: number[] }
export interface ProfitSurface { kind: 'profit'; unitCostCents: number; fixedCents: number; prices: number[]; units: number[] }
export type SurfaceSpec = CompoundSurface | ProfitSurface;
export type SurfaceAsk = { kind: 'highest' } | { kind: 'lowest' } | { kind: 'reach'; targetCents: number };
export interface SurfaceOption { id: SurfaceOptionId; x: number; y: number }
export interface SurfacePayload { surface: SurfaceSpec; ask: SurfaceAsk; options: SurfaceOption[] }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

/** One year of interest on whole cents, rounded half up: floor(amount x (10000 + bps) / 10000 + 1/2) in exact integers. */
export const nextYearCents = (amountCents: number, rateBps: number): number => Math.floor((amountCents * (10000 + rateBps) * 2 + 10000) / 20000);

export function compoundCents(principalCents: number, rateBps: number, years: number): number {
  let amount = principalCents;
  for (let year = 0; year < years; year += 1) amount = nextYearCents(amount, rateBps);
  return amount;
}

export const profitCents = (unitCostCents: number, fixedCents: number, priceCents: number, units: number): number => units * (priceCents - unitCostCents) - fixedCents;

export const xAxis = (spec: SurfaceSpec): number[] => (spec.kind === 'compound' ? spec.ratesBps : spec.prices);
export const yAxis = (spec: SurfaceSpec): number[] => (spec.kind === 'compound' ? spec.terms : spec.units);

/** The output at grid position (xi, yi), in whole cents. */
export function surfaceCents(spec: SurfaceSpec, xi: number, yi: number): number {
  return spec.kind === 'compound'
    ? compoundCents(spec.principalCents, spec.ratesBps[xi]!, spec.terms[yi]!)
    : profitCents(spec.unitCostCents, spec.fixedCents, spec.prices[xi]!, spec.units[yi]!);
}

export const surfaceGrid = (spec: SurfaceSpec): number[][] => yAxis(spec).map((_, yi) => xAxis(spec).map((__, xi) => surfaceCents(spec, xi, yi)));

function ascending(value: unknown, count: { min: number; max: number }, low: number, high: number): number[] | null {
  if (!Array.isArray(value) || value.length < count.min || value.length > count.max || !value.every((entry) => whole(entry, low, high))) return null;
  return value.every((entry, index) => index === 0 || entry > value[index - 1]!) ? [...value] : null;
}

function readSurfaceSpec(value: unknown): SurfaceSpec | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'compound') {
    if (!exactKeys(value, ['kind', 'principalCents', 'ratesBps', 'terms']) || !whole(value.principalCents, SURFACE_LIMITS.principalCents.min, SURFACE_LIMITS.principalCents.max)) return null;
    const ratesBps = ascending(value.ratesBps, SURFACE_LIMITS.xCount, 0, SURFACE_LIMITS.rateBps);
    const terms = ascending(value.terms, SURFACE_LIMITS.yCount, 0, SURFACE_LIMITS.termYears);
    return ratesBps && terms ? { kind: 'compound', principalCents: value.principalCents, ratesBps, terms } : null;
  }
  if (value.kind === 'profit') {
    if (!exactKeys(value, ['kind', 'unitCostCents', 'fixedCents', 'prices', 'units']) || !whole(value.unitCostCents, 1, SURFACE_LIMITS.unitCostCents) || !whole(value.fixedCents, 0, SURFACE_LIMITS.fixedCents)) return null;
    const prices = ascending(value.prices, SURFACE_LIMITS.xCount, 1, SURFACE_LIMITS.priceCents);
    const units = ascending(value.units, SURFACE_LIMITS.yCount, 0, SURFACE_LIMITS.units);
    return prices && units ? { kind: 'profit', unitCostCents: value.unitCostCents, fixedCents: value.fixedCents, prices, units } : null;
  }
  return null;
}

function readAsk(value: unknown): SurfaceAsk | null {
  if (!isRecord(value)) return null;
  if ((value.kind === 'highest' || value.kind === 'lowest') && exactKeys(value, ['kind'])) return { kind: value.kind };
  if (value.kind === 'reach' && exactKeys(value, ['kind', 'targetCents']) && whole(value.targetCents, -SURFACE_LIMITS.targetCents, SURFACE_LIMITS.targetCents)) return { kind: 'reach', targetCents: value.targetCents };
  return null;
}

function readOptions(value: unknown, spec: SurfaceSpec): SurfaceOption[] | null {
  if (!Array.isArray(value) || value.length < SURFACE_LIMITS.options.min || value.length > SURFACE_LIMITS.options.max) return null;
  const options: SurfaceOption[] = [];
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry) || !exactKeys(entry, ['id', 'x', 'y']) || entry.id !== SURFACE_OPTION_IDS[index]) return null;
    if (!whole(entry.x, 0, xAxis(spec).length - 1) || !whole(entry.y, 0, yAxis(spec).length - 1)) return null;
    options.push({ id: SURFACE_OPTION_IDS[index]!, x: entry.x, y: entry.y });
  }
  return new Set(options.map((option) => `${option.x},${option.y}`)).size === options.length ? options : null;
}

export function readSurfacePayload(value: unknown): SurfacePayload | null {
  if (!isRecord(value) || !exactKeys(value, ['surface', 'ask', 'options'])) return null;
  const surface = readSurfaceSpec(value.surface);
  const ask = readAsk(value.ask);
  const options = surface ? readOptions(value.options, surface) : null;
  return surface && ask && options ? { surface, ask, options } : null;
}

export const optionCents = (payload: SurfacePayload): number[] => payload.options.map((option) => surfaceCents(payload.surface, option.x, option.y));

/** The one option the question asks for, or null when none or several qualify (the question must have exactly one answer). */
export function surfaceKey(payload: SurfacePayload): SurfaceOptionId | null {
  const values = optionCents(payload);
  const { ask } = payload;
  const hits = ask.kind === 'reach'
    ? values.flatMap((cents, index) => (cents >= ask.targetCents ? [index] : []))
    : values.flatMap((cents, index) => (cents === (ask.kind === 'highest' ? Math.max(...values) : Math.min(...values)) ? [index] : []));
  return hits.length === 1 ? payload.options[hits[0]!]!.id : null;
}

export const isFlatSurface = (payload: SurfacePayload): boolean => {
  const flat = surfaceGrid(payload.surface).flat();
  return Math.min(...flat) === Math.max(...flat);
};

/** The authoring rules a surface payload must meet: the surface rises or falls somewhere, and the question has exactly one answer. */
export function surfaceProblem(payload: SurfacePayload): string | null {
  if (isFlatSurface(payload)) return 'The surface must not be flat';
  if (surfaceKey(payload) !== null) return null;
  return payload.ask.kind === 'reach' ? 'Exactly one option must reach the target' : `Exactly one option must be the ${payload.ask.kind}`;
}

/** The fixed gazetteer: latitude and longitude in degrees to one decimal. A place is named only by one of these ids. */
export const PLACES = {
  'mexico-city': { lat: 19.4, lon: -99.1 },
  'los-angeles': { lat: 34.1, lon: -118.2 },
  houston: { lat: 29.8, lon: -95.4 },
  'new-york': { lat: 40.7, lon: -74.0 },
  bogota: { lat: 4.7, lon: -74.1 },
  'sao-paulo': { lat: -23.6, lon: -46.6 },
  lisbon: { lat: 38.7, lon: -9.1 },
  madrid: { lat: 40.4, lon: -3.7 },
  lagos: { lat: 6.5, lon: 3.4 },
  nairobi: { lat: -1.3, lon: 36.8 },
  johannesburg: { lat: -26.2, lon: 28.0 },
  dubai: { lat: 25.2, lon: 55.3 },
  mumbai: { lat: 19.1, lon: 72.9 },
  manila: { lat: 14.6, lon: 121.0 },
  tokyo: { lat: 35.7, lon: 139.7 },
  sydney: { lat: -33.9, lon: 151.2 },
} as const satisfies Record<string, { lat: number; lon: number }>;

export type PlaceId = keyof typeof PLACES;
export const PLACE_IDS = Object.keys(PLACES) as PlaceId[];
export const isPlaceId = (value: unknown): value is PlaceId => typeof value === 'string' && Object.hasOwn(PLACES, value);

export const GLOBE_ASKS = ['shortest', 'longest', 'cheapest'] as const;
export type GlobeAsk = (typeof GLOBE_ASKS)[number];
export const ROUTE_IDS = ['a', 'b', 'c', 'd'] as const;
export type RouteId = (typeof ROUTE_IDS)[number];

export const GLOBE_LIMITS = {
  routes: { min: 2, max: 4 },
  feeBps: 2000,
  flatCents: 5000,
  sendCents: { min: 1000, max: 500_000 },
  /** The winner of a distance question must beat the runner-up by this share (2 percent). */
  distanceMarginPermille: 20,
} as const;

export const EARTH_RADIUS_KM = 6371;
const radians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance between two places in whole kilometres (haversine on a sphere of radius 6371 km). */
export function distanceKm(from: PlaceId, to: PlaceId): number {
  const a = PLACES[from];
  const b = PLACES[to];
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** The fee on a transfer, whole cents: the rate on the amount rounded half up, plus the flat charge. */
export const feeCents = (sendCents: number, feeBps: number, flatCents: number): number => Math.floor((sendCents * feeBps * 2 + 10000) / 20000) + flatCents;

export interface GlobeRoute { id: RouteId; from: PlaceId; to: PlaceId; feeBps: number; flatCents: number }
export interface GlobePayload { routes: GlobeRoute[]; ask: GlobeAsk; sendCents: number }

export function readGlobePayload(value: unknown): GlobePayload | null {
  if (!isRecord(value) || !exactKeys(value, ['routes', 'ask', 'sendCents'])) return null;
  const { routes, ask, sendCents } = value;
  if (!(GLOBE_ASKS as readonly unknown[]).includes(ask) || !whole(sendCents, GLOBE_LIMITS.sendCents.min, GLOBE_LIMITS.sendCents.max)) return null;
  if (!Array.isArray(routes) || routes.length < GLOBE_LIMITS.routes.min || routes.length > GLOBE_LIMITS.routes.max) return null;
  const read: GlobeRoute[] = [];
  for (const [index, entry] of routes.entries()) {
    if (!isRecord(entry) || !exactKeys(entry, ['id', 'from', 'to', 'feeBps', 'flatCents']) || entry.id !== ROUTE_IDS[index]) return null;
    if (!isPlaceId(entry.from) || !isPlaceId(entry.to) || !whole(entry.feeBps, 0, GLOBE_LIMITS.feeBps) || !whole(entry.flatCents, 0, GLOBE_LIMITS.flatCents)) return null;
    read.push({ id: ROUTE_IDS[index]!, from: entry.from, to: entry.to, feeBps: entry.feeBps, flatCents: entry.flatCents });
  }
  return { routes: read, ask: ask as GlobeAsk, sendCents };
}

export const routeDistances = (payload: GlobePayload): number[] => payload.routes.map((route) => distanceKm(route.from, route.to));
export const routeFees = (payload: GlobePayload): number[] => payload.routes.map((route) => feeCents(payload.sendCents, route.feeBps, route.flatCents));

/** The one route the question asks for, or null when none, several, or a distance winner inside the safety margin. */
export function globeKey(payload: GlobePayload): RouteId | null {
  if (payload.ask === 'cheapest') {
    const fees = routeFees(payload);
    const least = Math.min(...fees);
    const hits = fees.flatMap((fee, index) => (fee === least ? [index] : []));
    return hits.length === 1 ? payload.routes[hits[0]!]!.id : null;
  }
  const distances = routeDistances(payload);
  const order = distances.map((km, index) => ({ km, index })).sort((left, right) => (payload.ask === 'shortest' ? left.km - right.km : right.km - left.km));
  const [best, next] = order;
  if (!best || !next) return null;
  const gap = Math.abs(next.km - best.km);
  return gap * 1000 >= best.km * GLOBE_LIMITS.distanceMarginPermille ? payload.routes[best.index]!.id : null;
}

/** The authoring rules a globe payload must meet: real, different ends, no repeated corridor, and exactly one clear answer. */
export function globeProblem(payload: GlobePayload): string | null {
  if (payload.routes.some((route) => route.from === route.to)) return 'A route joins two different places';
  const corridors = payload.routes.map((route) => [route.from, route.to].sort().join('|'));
  if (new Set(corridors).size !== corridors.length) return 'Each corridor is listed once';
  if (globeKey(payload) !== null) return null;
  if (payload.ask === 'cheapest') return 'Exactly one route must have the lowest fee';
  return `Exactly one route must be the ${payload.ask}, ahead of the next by at least 2 percent`;
}

/** The fixed catalogue of the AR table pilot: the true size in whole centimetres as width, height and depth. */
export const AR_OBJECT_IDS = ['litre-box', 'cereal-box', 'soup-can', 'shoebox'] as const;
export type ArObjectId = (typeof AR_OBJECT_IDS)[number];
export const isArObjectId = (value: unknown): value is ArObjectId => (AR_OBJECT_IDS as readonly unknown[]).includes(value);
export interface ArPayload { object: ArObjectId }

export function readArPayload(value: unknown): ArPayload | null {
  return isRecord(value) && exactKeys(value, ['object']) && isArObjectId(value.object) ? { object: value.object } : null;
}
