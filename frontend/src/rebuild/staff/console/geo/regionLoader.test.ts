import { describe, expect, it } from 'vitest';
import { buildRegionIndex, normalizeRegionName, resolveRegionCode } from './regionLoader';
import { REGIONS as MX } from './regions/MX';
import { REGIONS as US } from './regions/US';

/*
 * These labels are the REAL ones returned by the production Plausible instance
 * on 2026-08-13, captured from inside Railway's private network:
 *
 *   "Mexico City", "Guanajuato", "Jalisco", "Virginia", "Oregon",
 *   "State of Mexico", "Iowa", "Nuevo Leon", "Baja California"
 *
 * The Stats API v2 docs promise ISO 3166-2 codes for visit:region, and
 * visit:country really does return codes — but regions come back as names
 * here. Keying the choropleth on codes alone matched nothing and would have
 * shipped an all-grey map with the data sitting right there. This test exists
 * so that never regresses silently.
 */

const mxIndex = buildRegionIndex(MX);
const usIndex = buildRegionIndex(US);

describe('resolveRegionCode', () => {
  it('resolves the exact labels production returns', () => {
    expect(resolveRegionCode(mxIndex, 'Jalisco')).toBe('MX-JAL');
    expect(resolveRegionCode(mxIndex, 'Guanajuato')).toBe('MX-GUA');
    expect(resolveRegionCode(mxIndex, 'Baja California')).toBe('MX-BCN');
    expect(resolveRegionCode(usIndex, 'Virginia')).toBe('US-VA');
    expect(resolveRegionCode(usIndex, 'Oregon')).toBe('US-OR');
    expect(resolveRegionCode(usIndex, 'Iowa')).toBe('US-IA');
  });

  it('folds accents, because the geometry writes them and Plausible does not', () => {
    // Natural Earth: "Nuevo León" / "México". Plausible: "Nuevo Leon".
    expect(resolveRegionCode(mxIndex, 'Nuevo Leon')).toBe('MX-NLE');
    expect(resolveRegionCode(mxIndex, 'Queretaro')).toBe('MX-QUE');
    expect(resolveRegionCode(mxIndex, 'Yucatan')).toBe('MX-YUC');
  });

  it('maps the names that genuinely differ between the two sources', () => {
    // Plausible says "Mexico City"; the geometry says "Distrito Federal".
    expect(resolveRegionCode(mxIndex, 'Mexico City')).toBe('MX-DIF');
    expect(resolveRegionCode(mxIndex, 'State of Mexico')).toBe('MX-MEX');
  });

  it('still accepts ISO codes, for deployments that return them', () => {
    expect(resolveRegionCode(mxIndex, 'MX-JAL')).toBe('MX-JAL');
    expect(resolveRegionCode(usIndex, 'US-CA')).toBe('US-CA');
  });

  it('returns null rather than guessing when a label cannot be placed', () => {
    expect(resolveRegionCode(mxIndex, '')).toBeNull();
    expect(resolveRegionCode(mxIndex, 'Atlantis')).toBeNull();
    // An unknown label must not be silently attached to the nearest state.
    expect(resolveRegionCode(usIndex, 'Somewhere Else')).toBeNull();
  });

  it('normalizes consistently', () => {
    expect(normalizeRegionName('  Nuevo   León ')).toBe('nuevo leon');
    expect(normalizeRegionName('MÉXICO')).toBe('mexico');
  });
});
