import { useEffect, useMemo, useState, type PointerEvent } from 'react';
import {
  COUNTRY_SHAPE_BY_CODE, COUNTRY_SHAPES, MICRO_STATE_CENTROIDS, UNATTRIBUTED_LAND, WORLD_GRATICULE_PATH, WORLD_HEIGHT, WORLD_SPHERE_PATH, WORLD_WIDTH,
} from './worldGeography';
import { buildRegionIndex, cachedRegions, loadRegions, resolveRegionCode } from './regionLoader';
import type { RegionShape } from './regionTypes';
import { stepFor } from './steps';

/*
 * The drawn map of the Analytics geography block (W2T.3). The geometry is the
 * existing generated data, relocated unchanged from the legacy console:
 * Natural Earth outlines projected at author time into one 1000 x 500 space
 * (scripts/generate-world-map.mjs), and one admin-1 module per country loaded
 * only when a country is opened (scripts/generate-region-maps.mjs). This file
 * is its own chunk: the ~170 KB of outlines reach only the people who open
 * the geography view.
 *
 * The SVG is a picture (aria-hidden). Its reading lives in HTML beside it, in
 * WorldMap.tsx: the ranked list (the keyboard and tap path), the readout, the
 * legend with real ranges and the notes for what could not be placed. A press
 * on a country with visitors selects it, as the list does; an empty country is
 * land, not a filter into a guaranteed-empty result.
 */

const ZOOM_PADDING = 0.18;
const MIN_ZOOM_SPAN = 40;
/** The frame for a country, in the same projected space as every path: zooming is real geometry at a larger scale. */
export function viewBoxFor(code: string | null): string {
  const bbox = code ? COUNTRY_SHAPE_BY_CODE[code]?.bbox : null;
  if (!bbox) return `0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`;
  const [x0, y0, x1, y1] = bbox;
  const padX = Math.max((x1 - x0) * ZOOM_PADDING, 4);
  const padY = Math.max((y1 - y0) * ZOOM_PADDING, 4);
  const width = Math.max(x1 - x0 + padX * 2, MIN_ZOOM_SPAN);
  const height = Math.max(y1 - y0 + padY * 2, MIN_ZOOM_SPAN / 2);
  const x = Math.min(Math.max(x0 - padX, 0), Math.max(WORLD_WIDTH - width, 0));
  const y = Math.min(Math.max(y0 - padY, 0), Math.max(WORLD_HEIGHT - height, 0));
  return `${x} ${y} ${width} ${height}`;
}

/** Countries with visitors the map cannot draw or plot (no outline and no known point). They are listed, never dropped. */
export function unplaceable(codes: readonly string[]): string[] {
  return codes.filter((code) => !COUNTRY_SHAPE_BY_CODE[code] && !MICRO_STATE_CENTROIDS[code]);
}

export interface MapCanvasProps {
  /** Visitors by ISO alpha-2 country code. */
  countries: ReadonlyMap<string, number>;
  /** Visitors by region label, as Plausible reports them (names or ISO 3166-2 codes), for the opened country. */
  regionRows: readonly { label: string; visitors: number }[];
  selected: string | null;
  zoomed: string | null;
  onSelect: (code: string) => void;
  onHover: (target: { kind: 'country' | 'region'; code: string; name: string; visitors: number } | null) => void;
  /** The regions of the opened country resolved: how many labels could not be placed (named by the caller). */
  onRegions: (result: { max: number; unresolved: string[] }) => void;
  /** Countries with visitors the map cannot place at all (named by the caller). */
  onUnplaceable: (codes: string[]) => void;
}

export default function MapCanvas({ countries, regionRows, selected, zoomed, onSelect, onHover, onRegions, onUnplaceable }: MapCanvasProps) {
  const [regions, setRegions] = useState<RegionShape[]>(() => (zoomed ? cachedRegions(zoomed) ?? [] : []));
  useEffect(() => {
    if (!zoomed) { setRegions([]); return undefined; }
    let live = true;
    void loadRegions(zoomed).then((shapes) => { if (live) setRegions(shapes); });
    return () => { live = false; };
  }, [zoomed]);

  const index = useMemo(() => buildRegionIndex(regions), [regions]);
  const { regionValues, unresolved } = useMemo(() => {
    const values = new Map<string, number>();
    const missed: string[] = [];
    for (const row of regionRows) {
      const code = resolveRegionCode(index, row.label);
      if (!code) { if (row.label.trim() && regions.length) missed.push(row.label); continue; }
      values.set(code, (values.get(code) ?? 0) + row.visitors);
    }
    return { regionValues: values, unresolved: missed };
  }, [regionRows, index, regions.length]);
  const regionMax = Math.max(0, ...regionValues.values());
  const unresolvedKey = unresolved.join('|');
  useEffect(() => { onRegions({ max: regionMax, unresolved: unresolvedKey ? unresolvedKey.split('|') : [] }); }, [regionMax, unresolvedKey, onRegions]);

  const missingKey = unplaceable([...countries.keys()]).sort().join(',');
  useEffect(() => { onUnplaceable(missingKey ? missingKey.split(',') : []); }, [missingKey, onUnplaceable]);

  const max = Math.max(0, ...countries.values());
  const micro = [...countries].filter(([code]) => !COUNTRY_SHAPE_BY_CODE[code] && MICRO_STATE_CENTROIDS[code]);
  const pick = (event: PointerEvent<SVGElement>, code: string) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    onSelect(code);
  };

  return <svg viewBox={viewBoxFor(zoomed)} className="lf-staff-map-svg" aria-hidden="true" data-zoomed={zoomed ?? undefined}>
    <path className="lf-staff-map-water" d={WORLD_SPHERE_PATH} />
    <path className="lf-staff-map-graticule" d={WORLD_GRATICULE_PATH} />
    {UNATTRIBUTED_LAND.map((d) => <path key={d.slice(0, 24)} className="lf-staff-map-land" d={d} />)}
    {COUNTRY_SHAPES.map((shape) => {
      const visitors = countries.get(shape.code) ?? 0;
      // While a country is open its regions carry the data; the countries around it are context.
      const step = zoomed ? -1 : stepFor(visitors, max);
      const live = !zoomed && visitors > 0;
      return <path key={shape.code} d={shape.d} data-country={shape.code}
        className={`lf-staff-map-land${step >= 0 ? ` lf-staff-map-step-${step}` : ''}${!zoomed && selected === shape.code ? ' lf-staff-map-selected' : ''}`}
        onPointerUp={live ? (event) => pick(event, shape.code) : undefined}
        onPointerEnter={live ? () => onHover({ kind: 'country', code: shape.code, name: shape.name, visitors }) : undefined}
        onPointerLeave={live ? () => onHover(null) : undefined} />;
    })}
    {zoomed && COUNTRY_SHAPE_BY_CODE[zoomed] ? <path className="lf-staff-map-border" d={COUNTRY_SHAPE_BY_CODE[zoomed]!.d} /> : null}
    {zoomed ? regions.map((region) => {
      const visitors = regionValues.get(region.code) ?? 0;
      const step = stepFor(visitors, regionMax);
      return <path key={region.code} d={region.d} data-region={region.code}
        className={`lf-staff-map-region${step >= 0 ? ` lf-staff-map-step-${step}` : ''}`}
        onPointerEnter={visitors > 0 ? () => onHover({ kind: 'region', code: region.code, name: region.name, visitors }) : undefined}
        onPointerLeave={visitors > 0 ? () => onHover(null) : undefined} />;
    }) : null}
    {zoomed ? null : micro.map(([code, visitors]) => {
      const [cx, cy] = MICRO_STATE_CENTROIDS[code]!;
      return <circle key={code} cx={cx} cy={cy} r={selected === code ? 6 : 4} data-country={code}
        className={`lf-staff-map-point lf-staff-map-step-${Math.max(stepFor(visitors, max), 1)}${selected === code ? ' lf-staff-map-selected' : ''}`}
        onPointerUp={(event) => pick(event, code)}
        onPointerEnter={() => onHover({ kind: 'country', code, name: code, visitors })} onPointerLeave={() => onHover(null)} />;
    })}
  </svg>;
}

