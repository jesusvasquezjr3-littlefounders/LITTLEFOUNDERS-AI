import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { countryLabel, type BreakdownRow } from './analyticsShared';
import {
  COUNTRY_SHAPES,
  COUNTRY_SHAPE_BY_CODE,
  MICRO_STATE_CENTROIDS,
  UNATTRIBUTED_LAND,
  WORLD_GRATICULE_PATH,
  WORLD_HEIGHT,
  WORLD_SPHERE_PATH,
  WORLD_WIDTH,
} from './worldGeography';
import { buildRegionIndex, cachedRegions, hasRegions, loadRegions, resolveRegionCode } from './regionLoader';
import type { RegionShape } from './regionTypes';

/*
 * Real geography, not a suggestion of one. The previous map drew seven
 * hand-authored blobs and dropped a dot per country on top, so a country's
 * position was decorative and anything outside a 39-entry lookup table simply
 * did not exist. This renders Natural Earth outlines (projected at author
 * time, see scripts/generate-world-map.mjs) and fills each country by traffic.
 *
 * Honesty rules this component keeps:
 *  - A country with visitors is ALWAYS visible: drawn if geometry exists,
 *    plotted as a point if it is too small to draw at this resolution, and
 *    reported to the caller as unplaceable otherwise. Nothing disappears.
 *  - The legend prints real value ranges, so a shade can be read back to a
 *    number instead of being ambient colour.
 *  - Only countries with traffic are interactive; an empty country is land,
 *    not a filter you can click into a guaranteed-empty result.
 */

/** Ordered alpha ramp for the sequential scale, lightest to full brand. */
const RAMP = [0.16, 0.32, 0.5, 0.72, 1] as const;

export interface ChoroplethTooltip {
  code: string;
  visitors: number;
  share: number;
  x: number;
  y: number;
}

interface Props {
  rows: BreakdownRow[];
  selected: string | null;
  onSelect: (code: string) => void;
  /** Codes with traffic that this map cannot place at all — the caller lists them. */
  onUnplaceable?: (codes: string[]) => void;
  /** Country the map is zoomed into, or null for the world. */
  zoomed: string | null;
  onZoom: (code: string | null) => void;
  /** Region rows (ISO 3166-2) for the zoomed country. */
  regionRows: BreakdownRow[];
}

/** Fraction of the country's own size added as breathing room when zoomed. */
const ZOOM_PADDING = 0.18;
/** Never zoom past this, or a small country fills the frame with pixels. */
const MIN_ZOOM_SPAN = 40;

/**
 * viewBox for the current zoom, in the same projected space as every path.
 * Zooming is therefore the real geometry at a larger scale, not an image
 * transform: borders stay crisp and regions land exactly inside their country.
 */
function viewBoxFor(code: string | null): string {
  const bbox = code ? COUNTRY_SHAPE_BY_CODE[code]?.bbox : null;
  if (!bbox) return `0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`;
  const [x0, y0, x1, y1] = bbox;
  const padX = Math.max((x1 - x0) * ZOOM_PADDING, 4);
  const padY = Math.max((y1 - y0) * ZOOM_PADDING, 4);
  const width = Math.max(x1 - x0 + padX * 2, MIN_ZOOM_SPAN);
  const height = Math.max(y1 - y0 + padY * 2, MIN_ZOOM_SPAN / 2);
  // Keep the frame inside the projected world so the ocean never runs out.
  const x = Math.min(Math.max(x0 - padX, 0), Math.max(WORLD_WIDTH - width, 0));
  const y = Math.min(Math.max(y0 - padY, 0), Math.max(WORLD_HEIGHT - height, 0));
  return `${x} ${y} ${width} ${height}`;
}

/** Upper bound of each ramp step, as a share of the busiest country. */
const STEP_EDGES = [0.05, 0.2, 0.45, 0.75, 1] as const;

function stepFor(value: number, max: number): number {
  if (value <= 0) return -1;
  const share = value / max;
  for (const [index, edge] of STEP_EDGES.entries()) if (share <= edge) return index;
  return RAMP.length - 1;
}

export function WorldChoropleth({ rows, selected, onSelect, onUnplaceable, zoomed, onZoom, regionRows }: Props) {
  const { t, i18n } = useTranslation();
  const [hovered, setHovered] = useState<string | null>(null);
  // `cachedRegions` seeds synchronously on a revisit, so returning to a country
  // does not flash an empty outline before its states reappear.
  const [regions, setRegions] = useState<RegionShape[]>(() => (zoomed ? (cachedRegions(zoomed) ?? []) : []));

  useEffect(() => {
    if (!zoomed) {
      setRegions([]);
      return;
    }
    let cancelled = false;
    void loadRegions(zoomed).then((shapes) => {
      if (!cancelled) setRegions(shapes);
    });
    return () => {
      cancelled = true;
    };
  }, [zoomed]);

  /*
   * Region traffic keyed by the geometry's ISO 3166-2 code.
   *
   * Plausible labels regions by NAME in this deployment ("Jalisco", "Mexico
   * City") even though its documentation promises codes, so every row is
   * resolved through the index rather than assumed to be a code. Rows that
   * cannot be resolved are counted, not dropped: the panel says how many so a
   * silent mismatch cannot masquerade as "no traffic there".
   */
  const regionIndex = useMemo(() => buildRegionIndex(regions), [regions]);
  const { regionValues, unresolvedRegions } = useMemo(() => {
    const byCode = new Map<string, number>();
    const unresolved: string[] = [];
    for (const row of regionRows) {
      const code = resolveRegionCode(regionIndex, row.label);
      if (!code) {
        if (row.label.trim()) unresolved.push(row.label);
        continue;
      }
      byCode.set(code, (byCode.get(code) ?? 0) + row.visitors);
    }
    return { regionValues: byCode, unresolvedRegions: unresolved };
  }, [regionRows, regionIndex]);
  const regionMax = Math.max(...regionValues.values(), 0);

  const { valueByCode, max, total, unplaceable } = useMemo(() => {
    const byCode = new Map<string, number>();
    for (const row of rows) {
      const code = row.label.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(code)) byCode.set(code, (byCode.get(code) ?? 0) + row.visitors);
    }
    const values = [...byCode.values()];
    const missing = [...byCode.keys()].filter(
      (code) => !COUNTRY_SHAPE_BY_CODE[code] && !MICRO_STATE_CENTROIDS[code],
    );
    return {
      valueByCode: byCode,
      max: values.length ? Math.max(...values) : 0,
      total: values.reduce((sum, value) => sum + value, 0),
      unplaceable: missing,
    };
  }, [rows]);

  /*
   * Keyed on the joined codes, not the array identity, so a re-render with the
   * same set does not re-notify the caller. `onUnplaceable` is expected to be
   * stable (a setState function or a useCallback); an inline lambda would make
   * this fire every render.
   */
  const unplaceableKey = unplaceable.join(',');
  useEffect(() => {
    onUnplaceable?.(unplaceableKey ? unplaceableKey.split(',') : []);
  }, [unplaceableKey, onUnplaceable]);

  const numberFormat = new Intl.NumberFormat(i18n.resolvedLanguage);
  const percentFormat = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 1 });

  // While zoomed only a hovered REGION should speak: the country selection
  // that got us here would otherwise sit on top saying "100%".
  const activeCode = zoomed ? hovered : (hovered ?? selected);
  const activeRegion = activeCode ? regions.find((region) => region.code === activeCode) : undefined;
  const activeValue = activeRegion
    ? (regionValues.get(activeRegion.code) ?? 0)
    : activeCode
      ? (valueByCode.get(activeCode) ?? 0)
      : 0;
  const activeLabel = activeRegion
    ? activeRegion.name
    : activeCode
      ? countryLabel(activeCode, i18n.resolvedLanguage)
      : '';
  const activePosition = activeRegion
    ? activeRegion.centroid
    : activeCode
      ? (COUNTRY_SHAPE_BY_CODE[activeCode]?.centroid ?? MICRO_STATE_CENTROIDS[activeCode] ?? null)
      : null;
  // When zoomed, shares are of the country's own total, not the world's.
  const shareBase = zoomed ? [...regionValues.values()].reduce((sum, v) => sum + v, 0) : total;

  /**
   * Legend edges as real visitor counts, so a shade maps back to a number.
   * Scaled to whichever layer is on screen: while zoomed the colours encode
   * region traffic, and a legend still describing world totals would misread
   * every shade in the frame.
   */
  const legendMax = zoomed ? regionMax : max;
  const legendSteps = RAMP.map((alpha, index) => {
    const upper = Math.round((STEP_EDGES[index] as number) * legendMax);
    const lower = index === 0 ? 1 : Math.round((STEP_EDGES[index - 1] as number) * legendMax) + 1;
    return { alpha, lower, upper: Math.max(upper, lower) };
  });

  const describe = (code: string, visitors: number): string =>
    `${countryLabel(code, i18n.resolvedLanguage)}: ${numberFormat.format(visitors)}`;

  const microStates = [...valueByCode.entries()].filter(
    ([code]) => !COUNTRY_SHAPE_BY_CODE[code] && MICRO_STATE_CENTROIDS[code],
  );

  return (
    <div className="min-w-0">
      <div className="relative w-full overflow-hidden rounded-xl border border-outline/40 bg-surface-sunken/30">
        <svg
          viewBox={viewBoxFor(zoomed)}
          className="block h-auto w-full [transition:view-box_400ms_var(--lf-ease)] motion-reduce:transition-none"
          role="img"
          aria-label={t('admin.analytics.geo.mapAria')}
        >
          <title>{t('admin.analytics.geo.mapAria')}</title>

          {/* Ocean, then a faint graticule so the projection reads as a map. */}
          <path d={WORLD_SPHERE_PATH} fill="rgb(var(--lf-base))" />
          <path
            d={WORLD_GRATICULE_PATH}
            fill="none"
            stroke="rgb(var(--lf-outline))"
            strokeWidth="0.4"
            opacity="0.35"
          />

          {UNATTRIBUTED_LAND.map((d) => (
            <path key={d.slice(0, 24)} d={d} fill="rgb(var(--lf-outline))" stroke="rgb(var(--lf-outline))" strokeWidth="0.3" />
          ))}

          {COUNTRY_SHAPES.map((shape) => {
            const visitors = valueByCode.get(shape.code) ?? 0;
            /*
             * While zoomed, the REGION layer carries the data and countries are
             * context. Leaving them coloured by world traffic put a solid
             * neighbour (the United States beside Mexico) in the frame louder
             * than every state being examined, and the shades meant something
             * different on each side of the border.
             */
            const step = zoomed ? -1 : stepFor(visitors, max);
            const isActive = !zoomed && activeCode === shape.code;
            const interactive = !zoomed && visitors > 0;
            return (
              <path
                key={shape.code}
                d={shape.d}
                // A country with no traffic is land, not a pale version of
                // traffic: it takes the neutral outline tone so the coastline
                // stays legible against the ocean in both themes.
                fill={step >= 0 ? 'rgb(var(--lf-primary))' : 'rgb(var(--lf-outline))'}
                fillOpacity={step >= 0 ? RAMP[step] : 1}
                stroke={isActive ? 'rgb(var(--lf-content))' : 'rgb(var(--lf-surface))'}
                strokeWidth={isActive ? 1.2 : 0.4}
                className={cn(
                  'transition-[fill-opacity,stroke-width] duration-150',
                  interactive && 'cursor-pointer outline-none',
                )}
                {...(interactive
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': describe(shape.code, visitors),
                      onClick: () => onSelect(shape.code),
                      onMouseEnter: () => setHovered(shape.code),
                      onMouseLeave: () => setHovered(null),
                      onFocus: () => setHovered(shape.code),
                      onBlur: () => setHovered(null),
                      onKeyDown: (event: KeyboardEvent<SVGPathElement>) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelect(shape.code);
                        }
                      },
                    }
                  : { 'aria-hidden': true })}
              />
            );
          })}

          {/*
            The focused country's own border, drawn under its regions so the
            frame still says which country you are inside. Without it every
            neighbour is the same neutral tone and the boundary disappears.
          */}
          {zoomed && COUNTRY_SHAPE_BY_CODE[zoomed] && (
            <path
              d={COUNTRY_SHAPE_BY_CODE[zoomed]!.d}
              fill="none"
              stroke="rgb(var(--lf-content-muted))"
              strokeWidth="0.8"
              strokeLinejoin="round"
              opacity="0.7"
              aria-hidden="true"
            />
          )}

          {/*
            Region layer. Drawn only when zoomed, above the country fills, in
            the same projected space — so a state sits exactly inside its
            country with no re-projection and no seam.
          */}
          {zoomed &&
            regions.map((region) => {
              const visitors = regionValues.get(region.code) ?? 0;
              const step = stepFor(visitors, regionMax);
              const isActive = hovered === region.code;
              const interactive = visitors > 0;
              return (
                <path
                  key={region.code}
                  d={region.d}
                  fill={step >= 0 ? 'rgb(var(--lf-primary))' : 'rgb(var(--lf-surface-sunken))'}
                  fillOpacity={step >= 0 ? RAMP[step] : 0.9}
                  stroke={isActive ? 'rgb(var(--lf-content))' : 'rgb(var(--lf-surface))'}
                  strokeWidth={isActive ? 0.6 : 0.25}
                  className={cn('transition-[fill-opacity]', interactive && 'cursor-pointer outline-none')}
                  {...(interactive
                    ? {
                        role: 'button',
                        tabIndex: 0,
                        'aria-label': `${region.name}: ${numberFormat.format(visitors)}`,
                        onMouseEnter: () => setHovered(region.code),
                        onMouseLeave: () => setHovered(null),
                        onFocus: () => setHovered(region.code),
                        onBlur: () => setHovered(null),
                      }
                    : { 'aria-hidden': true })}
                />
              );
            })}

          {/* Too small to draw at this resolution, too real to omit. */}
          {microStates.map(([code, visitors]) => {
            const [x, y] = MICRO_STATE_CENTROIDS[code] as [number, number];
            const step = stepFor(visitors, max);
            return (
              <circle
                key={code}
                cx={x}
                cy={y}
                r={activeCode === code ? 6 : 4}
                fill="rgb(var(--lf-primary))"
                fillOpacity={RAMP[Math.max(step, 1)]}
                stroke="rgb(var(--lf-surface))"
                strokeWidth="1.2"
                role="button"
                tabIndex={0}
                aria-label={describe(code, visitors)}
                className="cursor-pointer outline-none"
                onClick={() => onSelect(code)}
                onMouseEnter={() => setHovered(code)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(code)}
                onBlur={() => setHovered(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(code);
                  }
                }}
              />
            );
          })}
        </svg>

        {/* Zoom control. Present only when zooming is meaningful. */}
        {zoomed ? (
          <button
            type="button"
            onClick={() => onZoom(null)}
            className="lf-glass absolute left-3 top-3 z-10 flex min-h-11 items-center gap-1.5 rounded-full border border-outline/50 px-3 py-1.5 font-bold text-content shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="arrow_back" className="!text-[18px]" />
            <span className="lf-caption">{t('admin.analytics.geo.backToWorld')}</span>
          </button>
        ) : (
          selected &&
          hasRegions(selected) && (
            <button
              type="button"
              onClick={() => onZoom(selected)}
              className="lf-glass absolute left-3 top-3 z-10 flex min-h-11 items-center gap-1.5 rounded-full border border-outline/50 px-3 py-1.5 font-bold text-content shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="zoom_in" className="!text-[18px]" />
              <span className="lf-caption">
                {t('admin.analytics.geo.zoomInto', { country: countryLabel(selected, i18n.resolvedLanguage) })}
              </span>
            </button>
          )
        )}

        {/*
          Tooltip is an HTML overlay positioned from the projected centroid, so
          it uses real type styles and stays legible at every viewport width.
          It appears on hover AND on focus AND on selection, so a touch device
          (tap = select) gets the same information a mouse does.
        */}
        {activeCode && activePosition && activeValue > 0 && (
          <div
            className="lf-glass pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] rounded-lg border border-outline/50 px-3 py-2 shadow-pop"
            style={{ left: `${(activePosition[0] / 1000) * 100}%`, top: `${(activePosition[1] / 500) * 100}%` }}
          >
            <p className="lf-caption font-bold text-content">{activeLabel}</p>
            <p className="lf-caption text-content-muted">
              <span className="lf-number text-content">{numberFormat.format(activeValue)}</span>{' '}
              {t('admin.analytics.geo.visitorsWord')}
              {shareBase > 0 && ` (${percentFormat.format(activeValue / shareBase)})`}
            </p>
          </div>
        )}
      </div>

      {/*
        A region Plausible reported but the map could not place. Named rather
        than dropped: an unmatched label silently discarded looks exactly like
        a state with no visitors, which is how a labelling mismatch would hide.
      */}
      {zoomed && unresolvedRegions.length > 0 && (
        <p className="lf-caption mt-2 rounded-lg border border-outline/40 bg-surface-sunken/40 p-2 text-content-muted">
          {t('admin.analytics.geo.unmatchedRegions', { regions: unresolvedRegions.slice(0, 6).join(', ') })}
        </p>
      )}

      {/*
        Legend with real ranges, not an unlabelled gradient.
        Every level of this wraps: five swatches with number ranges are wider
        than a 375px viewport, and a non-wrapping inner row pushed the whole
        page sideways (the flex parent then stretched every sibling card to
        match). `min-w-0` stops the same thing happening again from the grid side.
      */}
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <span className="lf-caption text-content-faint">
          {zoomed ? t('admin.analytics.geo.legendTitleRegion') : t('admin.analytics.geo.legendTitle')}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          {legendSteps.map((step) => (
            <span key={step.alpha} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-3 w-6 shrink-0 rounded-sm border border-outline/40"
                style={{ backgroundColor: `rgb(var(--lf-primary) / ${step.alpha})` }}
              />
              <span className="lf-caption whitespace-nowrap tabular-nums text-content-faint">
                {step.lower === step.upper
                  ? numberFormat.format(step.upper)
                  : `${numberFormat.format(step.lower)}-${numberFormat.format(step.upper)}`}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
