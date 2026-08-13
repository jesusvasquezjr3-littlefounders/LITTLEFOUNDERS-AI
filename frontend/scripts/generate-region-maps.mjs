/*
 * Generates src/routes/admin/analytics/regions/<CC>.ts — real state/province
 * outlines, one module per country, loaded only when an operator zooms into
 * that country.
 *
 * WHY PER-COUNTRY MODULES: the full admin-1 world is several megabytes. Nobody
 * needs Kazakhstan's oblasts to look at Mexico, so each country is its own
 * chunk and the map fetches exactly the one being viewed.
 *
 * WHY THE SAME PROJECTION AS THE WORLD MAP: regions are projected with the
 * identical geoNaturalEarth1 fitted to the same 1000x500 viewBox as
 * worldGeography.ts. Zooming is then a pure viewBox change — the region
 * outlines land exactly inside the country outline already on screen, with no
 * re-projection and no seams. Precision is 2 decimals rather than the world
 * map's 1, because zooming magnifies rounding.
 *
 * Identity is ISO 3166-2 (`MX-JAL`), which is what Plausible's `visit:region`
 * dimension reports, so a lookup is a plain object access.
 *
 * Run: npm run map:gen:regions   (author-time only; needs network once)
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { feature } from 'topojson-client';

const WIDTH = 1000;
const HEIGHT = 500;
const PRECISION = 2;

/*
 * 10m, not 50m: Natural Earth's 50m admin-1 file covers only nine large
 * federations (AU BR CA CN ID IN RU US ZA), so half the platform's markets
 * would have had no regions at all. The 10m file is global (~4,600 regions)
 * and far more detailed than a 1000x500 map needs, which is what the
 * simplification below is for.
 */
const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

/*
 * Retained detail after Visvalingam simplification. 0.06 keeps borders clearly
 * recognisable at the zoom levels this map reaches while cutting the generated
 * output by roughly an order of magnitude.
 */
const RETAIN = 0.06;

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../src/routes/admin/analytics/regions');
const cachePath = resolve(here, '../.cache/admin1-10m.geojson');

async function loadSource() {
  // Cached so a re-run is offline and byte-identical.
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf8'));
  console.log('fetching Natural Earth admin-1 (40 MB, cached after the first run)...');
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`admin-1 source responded ${res.status}`);
  const text = await res.text();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, text);
  return JSON.parse(text);
}

const raw = await loadSource();

/*
 * Simplify in GEOGRAPHIC space, before projecting: topology() shares borders
 * between neighbouring regions, so simplification moves a shared border
 * identically on both sides and never opens a gap between two states.
 * Simplifying each projected path independently would tear them apart.
 */
console.log(`simplifying ${raw.features.length} regions...`);
const topo = presimplify(topology({ regions: raw }));
const world = feature(simplify(topo, quantile(topo, RETAIN)), topo.objects.regions);

const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' });
const path = geoPath(projection);

function round(d) {
  return d.replace(/-?\d+\.\d+/g, (n) => String(Number(Number.parseFloat(n).toFixed(PRECISION))));
}

/** Natural Earth spells the country code differently across vintages. */
function countryCode(props) {
  const raw = props.iso_a2 ?? props.adm0_a3 ?? props.iso_3166_2?.split('-')[0] ?? '';
  return String(raw).slice(0, 2).toUpperCase();
}

const byCountry = new Map();
let skipped = 0;

for (const feature of world.features) {
  const props = feature.properties ?? {};
  const iso = props.iso_3166_2 ? String(props.iso_3166_2).toUpperCase() : null;
  const country = iso && iso.includes('-') ? iso.split('-')[0] : countryCode(props);
  if (!country || country.length !== 2 || country === '-9') {
    skipped += 1;
    continue;
  }
  const d = path(feature);
  if (!d) {
    skipped += 1;
    continue;
  }
  const [cx, cy] = path.centroid(feature);
  const name = props.name ?? props.name_en ?? iso ?? 'Unknown';
  const entry = {
    // Regions with no ISO code still draw; they simply never match traffic.
    code: iso ?? `${country}-?${byCountry.get(country)?.length ?? 0}`,
    name: String(name),
    d: round(d),
    centroid: Number.isFinite(cx) && Number.isFinite(cy) ? [Number(cx.toFixed(2)), Number(cy.toFixed(2))] : null,
  };
  if (!byCountry.has(country)) byCountry.set(country, []);
  byCountry.get(country).push(entry);
}

mkdirSync(outDir, { recursive: true });

const header = (country, count) => `/*
 * GENERATED FILE — do not edit by hand. Run \`npm run map:gen:regions\`.
 * ${count} admin-1 regions for ${country}, from Natural Earth 10m (public
 * domain), projected with the SAME geoNaturalEarth1 / ${WIDTH}x${HEIGHT}
 * viewBox as worldGeography.ts so they align with the country outline exactly.
 * Keys are ISO 3166-2, matching Plausible's visit:region dimension.
 */
import type { RegionShape } from '../regionTypes';

export const REGIONS: RegionShape[] = `;

let total = 0;
const index = [];
for (const [country, regions] of [...byCountry.entries()].sort()) {
  regions.sort((a, b) => a.code.localeCompare(b.code));
  writeFileSync(resolve(outDir, `${country}.ts`), `${header(country, regions.length)}${JSON.stringify(regions)};\n`);
  total += regions.length;
  index.push(country);
}

writeFileSync(
  resolve(outDir, 'index.ts'),
  `/*
 * GENERATED FILE — do not edit by hand. Run \`npm run map:gen:regions\`.
 * Countries with admin-1 geometry available. The map only offers to zoom into
 * a country listed here, so it never promises detail it cannot draw.
 */
export const COUNTRIES_WITH_REGIONS: ReadonlySet<string> = new Set(${JSON.stringify(index)});
`,
);

console.log(
  `regions: ${total} across ${index.length} countries (${skipped} features skipped for want of a country code)`,
);
