/*
 * F4.8: routes on a globe. Each route joins two places on the Earth and carries a remittance fee, and the learner picks the
 * route that is shortest, longest or cheapest. Distances are great-circle kilometres from a fixed gazetteer, rounded to the
 * whole kilometre; fees are whole cents computed with integers. A question whose answer rests on a distance must win by at
 * least 2 percent, so a rounding or engine difference can never change which route is right.
 */

export interface Place { lat: number; lon: number }

/** The fixed gazetteer: latitude and longitude in degrees to one decimal. The board and Forge name a place only by one of these ids. */
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
} as const satisfies Record<string, Place>;

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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

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

/** The place ids a payload draws, in route order without repeats. */
export const globePlaces = (payload: GlobePayload): PlaceId[] => [...new Set(payload.routes.flatMap((route) => [route.from, route.to]))];

export interface GlobeCenter { lon: number; lat: number }

/** The middle of a route on the sphere (the great-circle midpoint) in whole degrees: where the globe turns to look at it. */
export function routeCenter(from: PlaceId, to: PlaceId): GlobeCenter {
  const a = PLACES[from];
  const b = PLACES[to];
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const lon1 = radians(a.lon);
  const dLon = radians(b.lon - a.lon);
  const bx = Math.cos(lat2) * Math.cos(dLon);
  const by = Math.cos(lat2) * Math.sin(dLon);
  const lat = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.hypot(Math.cos(lat1) + bx, by));
  const lon = lon1 + Math.atan2(by, Math.cos(lat1) + bx);
  const wrapped = ((((lon * 180) / Math.PI + 180) % 360) + 360) % 360 - 180;
  return { lon: Math.round(wrapped), lat: Math.round((lat * 180) / Math.PI) };
}
