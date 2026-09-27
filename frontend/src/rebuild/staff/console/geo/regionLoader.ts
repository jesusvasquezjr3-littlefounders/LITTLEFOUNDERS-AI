import type { RegionShape } from './regionTypes';
import { COUNTRIES_WITH_REGIONS } from './regions';

/*
 * Admin-1 geometry is one generated module per country (~4,600 regions across
 * 238 countries in total). Loading it eagerly would put megabytes of states and
 * provinces in a bundle to draw one country, so each is fetched only when an
 * operator zooms in, and remembered afterwards.
 *
 * The import path has a static prefix and suffix so the bundler can enumerate
 * the candidates at build time and emit one chunk per country. This file lives
 * ABOVE `regions/` deliberately: Vite refuses a variable import that targets
 * its own directory, and silently emitted no chunks at all when it did.
 */

const cache = new Map<string, RegionShape[]>();

export function hasRegions(country: string): boolean {
  return COUNTRIES_WITH_REGIONS.has(country.toUpperCase());
}

export function cachedRegions(country: string): RegionShape[] | undefined {
  return cache.get(country.toUpperCase());
}

/** Regions for a country, or an empty list when none are published for it. */
export async function loadRegions(country: string): Promise<RegionShape[]> {
  const code = country.toUpperCase();
  const hit = cache.get(code);
  if (hit) return hit;
  if (!hasRegions(code)) return [];
  try {
    const module = (await import(`./regions/${code}.ts`)) as { REGIONS: RegionShape[] };
    cache.set(code, module.REGIONS);
    return module.REGIONS;
  } catch {
    // A missing chunk must not break the map: it falls back to the country
    // outline and the ranked list, which still answer the question.
    cache.set(code, []);
    return [];
  }
}

/*
 * ── Matching Plausible's region labels to geometry ──────────────────────────
 *
 * VERIFIED AGAINST PRODUCTION, not the spec. The Stats API v2 documentation
 * says `visit:region` returns ISO 3166-2 codes (`US-MD`), and `visit:country`
 * does return codes — but this deployment answers regions as NAMES:
 * "Mexico City", "Nuevo Leon", "State of Mexico", "Jalisco", "Oregon".
 * Keying the choropleth on codes alone matched nothing and painted every
 * state grey while the data was sitting right there.
 *
 * So resolution tries, in order: the ISO code (for deployments that do return
 * codes), the accent-insensitive name, and finally a small alias table for the
 * handful of genuine naming differences. Accent folding is not cosmetic here —
 * Natural Earth writes "México" and "Nuevo León" where Plausible writes
 * "State of Mexico" and "Nuevo Leon".
 */

/** Lowercase, strip diacritics, collapse whitespace. */
export function normalizeRegionName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Plausible's name (normalized) → the geometry's name (normalized), for the
 * cases where the two sources genuinely disagree rather than differ by accent.
 */
const REGION_ALIASES: Record<string, string> = {
  'mexico city': 'distrito federal',
  'state of mexico': 'mexico',
  'ciudad de mexico': 'distrito federal',
  'mexico state': 'mexico',
  'district of columbia': 'washington, d.c.',
  'washington dc': 'washington, d.c.',
};

/** Index a country's regions for lookup by code AND by name. */
export function buildRegionIndex(regions: RegionShape[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const region of regions) {
    index.set(region.code.toUpperCase(), region.code);
    index.set(normalizeRegionName(region.name), region.code);
  }
  return index;
}

/** The region code a Plausible label refers to, or null when it cannot be placed. */
export function resolveRegionCode(index: Map<string, string>, label: string): string | null {
  const raw = label.trim();
  if (!raw) return null;
  const byCode = index.get(raw.toUpperCase());
  if (byCode) return byCode;

  const normalized = normalizeRegionName(raw);
  const byName = index.get(normalized) ?? index.get(REGION_ALIASES[normalized] ?? '');
  if (byName) return byName;

  /*
   * Last resort: a prefix match, for official long forms
   * ("Veracruz de Ignacio de la Llave" vs "Veracruz"). Only accepted when it
   * is UNAMBIGUOUS — two candidates means we cannot say which state the
   * traffic belongs to, and guessing would put real visitors on the wrong one.
   */
  const candidates = [...index.entries()].filter(
    ([key]) => key.includes(' ') || /^[a-z]/.test(key),
  ).filter(([key]) => key.startsWith(normalized) || normalized.startsWith(key));
  const unique = new Set(candidates.map(([, code]) => code));
  return unique.size === 1 ? [...unique][0]! : null;
}
