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
