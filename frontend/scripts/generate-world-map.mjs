/*
 * Generates src/routes/admin/analytics/worldGeography.ts — real country
 * outlines for the staff-console choropleth.
 *
 * WHY GENERATE INSTEAD OF PROJECTING AT RUNTIME: the admin console is bundled
 * with the rest of the SPA, so shipping d3-geo + topojson + a TopoJSON world
 * to the browser would put a projection pipeline on the critical path of a
 * page that only ever draws ONE fixed map. Projecting here instead makes the
 * runtime cost a static string table, adds zero production dependencies, and
 * keeps the geometry byte-identical between deploys.
 *
 * Source: world-atlas 110m (Natural Earth, public domain), the resolution
 * Natural Earth publishes for exactly this size of map. Country identity is
 * the ISO-3166-1 numeric id it carries, mapped to the alpha-2 codes Plausible
 * reports so a lookup is a plain object access — no name matching.
 *
 * Run: npm run map:gen   (author-time only; d3-geo/topojson-client/
 * world-atlas/iso-3166 are devDependencies and never reach the bundle)
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import { iso31661 } from 'iso-3166';

const require = createRequire(import.meta.url);
const world = require('world-atlas/countries-110m.json');

const WIDTH = 1000;
const HEIGHT = 500;
/** One decimal ≈ 0.1px at the authored size — invisible, and ~35% smaller. */
const PRECISION = 1;

const numericToAlpha2 = new Map(iso31661.map((entry) => [String(Number(entry.numeric)), entry.alpha2]));

const countries = feature(world, world.objects.countries);
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' });
const path = geoPath(projection);

function round(d) {
  return d.replace(/-?\d+\.\d+/g, (n) => String(Number(Number.parseFloat(n).toFixed(PRECISION))));
}

const shapes = [];
for (const country of countries.features) {
  const code = numericToAlpha2.get(String(Number(country.id)));
  // Natural Earth carries a few entities without an ISO-3166-1 assignment
  // (disputed/uninhabited). They are drawn as unattributed land below rather
  // than silently attached to a neighbour.
  const d = path(country);
  if (!d) continue;
  const [cx, cy] = path.centroid(country);
  // Projected bounds drive zoom-to-country: the map animates its viewBox to
  // these, so the zoom is the real geometry rather than a scaled screenshot.
  const [[x0, y0], [x1, y1]] = path.bounds(country);
  const entry = {
    code: code ?? null,
    name: country.properties?.name ?? code ?? '',
    d: round(d),
    centroid: Number.isFinite(cx) && Number.isFinite(cy) ? [Number(cx.toFixed(1)), Number(cy.toFixed(1))] : null,
    bbox: [x0, y0, x1, y1].every(Number.isFinite)
      ? [Number(x0.toFixed(1)), Number(y0.toFixed(1)), Number(x1.toFixed(1)), Number(y1.toFixed(1))]
      : null,
  };
  shapes.push(entry);
}

shapes.sort((a, b) => (a.code ?? 'ZZ').localeCompare(b.code ?? 'ZZ'));
const attributed = shapes.filter((s) => s.code);

/*
 * Natural Earth's 110m file omits micro-states (Singapore, Malta, Hong
 * Kong…) — they are smaller than the resolution. Dropping them would mean a
 * country with real visitors appears NOWHERE on the map, which is exactly the
 * kind of quiet omission this map exists to stop. Their centroids come from
 * the 50m file: a point each, so the map can plot them, at no meaningful size
 * cost (the 50m geometry itself is never shipped).
 */
const drawn = new Set(attributed.map((s) => s.code));
const world50 = require('world-atlas/countries-50m.json');
const centroidOnly = {};
for (const country of feature(world50, world50.objects.countries).features) {
  const code = numericToAlpha2.get(String(Number(country.id)));
  if (!code || drawn.has(code) || centroidOnly[code]) continue;
  const [cx, cy] = path.centroid(country);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
  centroidOnly[code] = [Number(cx.toFixed(1)), Number(cy.toFixed(1))];
}

const sphere = round(path({ type: 'Sphere' }));
const graticule = round(path(geoGraticule10()));

const header = `/*
 * GENERATED FILE — do not edit by hand. Run \`npm run map:gen\`.
 * Source: world-atlas 110m (Natural Earth, public domain), projected with
 * d3-geo geoNaturalEarth1 into a ${WIDTH}×${HEIGHT} viewBox at author time.
 * See scripts/generate-world-map.mjs for why the projection is not done in
 * the browser.
 */

export const WORLD_WIDTH = ${WIDTH};
export const WORLD_HEIGHT = ${HEIGHT};
export const WORLD_VIEWBOX = '0 0 ${WIDTH} ${HEIGHT}';

/** Outline of the projected globe — the water behind the land. */
export const WORLD_SPHERE_PATH = ${JSON.stringify(sphere)};

/** 10° graticule, drawn faintly so the projection reads as a map, not a blob. */
export const WORLD_GRATICULE_PATH = ${JSON.stringify(graticule)};

export interface CountryShape {
  /** ISO-3166-1 alpha-2 — the same code Plausible reports for visit:country. */
  code: string;
  /** English endonym-agnostic name from Natural Earth; UI prefers Intl.DisplayNames. */
  name: string;
  /** SVG path data in the ${WIDTH}×${HEIGHT} viewBox. */
  d: string;
  /** Projected centroid, for markers and labels. */
  centroid: [number, number] | null;
  /** Projected bounds [x0, y0, x1, y1] — the viewBox the map zooms to. */
  bbox: [number, number, number, number] | null;
}

/** Every ISO-assigned country/territory Natural Earth draws at 110m. */
export const COUNTRY_SHAPES: CountryShape[] = `;

const body = `${JSON.stringify(
  attributed.map((s) => ({ code: s.code, name: s.name, d: s.d, centroid: s.centroid, bbox: s.bbox })),
)};

/** Land without an ISO-3166-1 assignment (disputed or uninhabited) — drawn, never attributed. */
export const UNATTRIBUTED_LAND: string[] = ${JSON.stringify(shapes.filter((s) => !s.code).map((s) => s.d))};

/**
 * Countries too small to be drawn at 110m (Singapore, Malta, Hong Kong…),
 * with a real projected position so they can still be plotted as a point
 * rather than vanishing from the map.
 */
export const MICRO_STATE_CENTROIDS: Record<string, [number, number]> = ${JSON.stringify(centroidOnly)};

/** alpha-2 → shape, for O(1) lookup while rendering a breakdown. */
export const COUNTRY_SHAPE_BY_CODE: Record<string, CountryShape> = Object.fromEntries(
  COUNTRY_SHAPES.map((shape) => [shape.code, shape]),
);

/** Projected position for any country we can place at all — drawn or not. */
export function countryPosition(code: string): [number, number] | null {
  return COUNTRY_SHAPE_BY_CODE[code]?.centroid ?? MICRO_STATE_CENTROIDS[code] ?? null;
}
`;

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/routes/admin/analytics/worldGeography.ts');
writeFileSync(out, `${header}${body}`);
console.log(
  `worldGeography.ts — ${attributed.length} ISO countries, ${shapes.length - attributed.length} unattributed, ` +
    `${(Buffer.byteLength(header + body) / 1024).toFixed(0)} KB`,
);
