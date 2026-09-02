import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui';
import type { TutorMapNode, TutorMapResponse } from '../tutorApi';
import { layoutMap } from './mapLayout';

/*
 * The learning map's graph (Tutor v3) — the KC graph made literal, so the
 * learner SEES why change-making waits on counting (blueprint §A.2).
 *
 * Pure presentation over `layoutMap`'s deterministic rows: nodes are DOM
 * buttons on a percentage grid, edges are one SVG underneath drawn from the
 * SAME (row, col) arithmetic, so the two layers agree by construction and
 * nothing is measured from the DOM.
 *
 * State grammar (no red anywhere, §A.3): mastered = success ring + check;
 * needs_review = warning-soft "repasar" badge; in_progress = primary ring;
 * available = plain lumen; locked = dimmed with a lock, and its accessible
 * label NAMES the prerequisite instead of just refusing.
 *
 * The graph is wide content: it scrolls inside its own overflow-x container
 * (§1.11 — the page never scrolls horizontally).
 */

export interface MapGraphProps {
  map: TutorMapResponse;
  /** Tap on a startable node. Locked nodes never call it. */
  onPick: (node: TutorMapNode) => void;
  disabled?: boolean;
}

const NODE_STATE_CLASSES: Record<TutorMapNode['state'], string> = {
  mastered: 'ring-2 ring-success bg-success-soft',
  needs_review: 'ring-2 ring-warning bg-warning-soft',
  in_progress: 'ring-2 ring-primary bg-primary-soft',
  available: 'ring-1 ring-outline bg-surface',
  locked: 'ring-1 ring-outline bg-surface opacity-50',
};

const NODE_ICON: Record<TutorMapNode['state'], string> = {
  mastered: 'check_circle',
  needs_review: 'history',
  in_progress: 'adjust',
  available: 'radio_button_unchecked',
  locked: 'lock',
};

/** Node centre in percent, shared by the DOM grid and the SVG edge layer. */
function centerOf(row: number, col: number, rowSize: number, rows: number): { x: number; y: number } {
  return { x: ((col + 0.5) / rowSize) * 100, y: ((row + 0.5) / Math.max(rows, 1)) * 100 };
}

/*
 * THE NODE'S WIDTH IS A MEASUREMENT OF THE CATALOG, NOT A ROUND NUMBER.
 *
 * Found live, 2026-09-02, es-MX at 1280x900 AND 390x844 (/AGENTS.md §1.11's
 * two mandated breakpoints): `w-24` (96 px, so 80 px of text after `p-2`) left
 * "Dar cambio contando hacia arriba" and "Lo que queda: la ganancia" needing
 * three lines inside a `line-clamp-2`, so the map read `Dar cambio contando…`
 * and `Lo que queda: la…` — on the ONE screen where a child who cannot yet
 * read well has to CHOOSE. `i18n:check` is structurally unable to see this:
 * these titles come from Vault's own catalog (`database/seeds/kc_graph.v1.json`,
 * localized per row), not from `frontend/src/i18n/**`.
 *
 * The container was fitted to English to the character: 80 px of text holds
 * ~26 characters over two lines, and 26 is EXACTLY the longest en-US title in
 * the seed ("Give change by counting up") — which is itself already clipped,
 * so this was never only a Spanish defect, just a much rarer English one.
 * es-MX runs to 32 characters and pt-BR to 33.
 *
 * 144 px is measured rather than reasoned. All 84 real catalog titles (28 KCs
 * x 3 locales) were rendered in the live page, in this exact span's own
 * computed style (Inter 12 px / 15 px), at six candidate widths:
 *
 *     text width   titles needing a 3rd line
 *      80 px  (today)      16 of 84
 *      96 px                6
 *     112 px                1
 *     128 px                0      <- 144 px node, minus `p-2`
 *
 * So 144 px is the first width at which the CLAMP NEVER TRUNCATES ANYTHING,
 * in any locale, rather than the first width that happens to fix the two
 * titles a screenshot caught. `line-clamp-2` stays, and its job changes: it is
 * now a guarantee about the GRID's geometry (every node is 74 px tall, so the
 * 92 px row pitch and the SVG edge layer keep agreeing by construction) rather
 * than a truncation anyone should ever see. A future title longer than any of
 * today's 84 would clip again — re-run the measurement above if one is added.
 *
 * The width is inline rather than a `w-36` class so that ONE number feeds both
 * the node and the pitch arithmetic below; `left`/`top` are already inline
 * here for the same reason.
 */
const NODE_WIDTH_PX = 144;
/**
 * The smallest gap that still reads as two separate nodes rather than one
 * strip — the same 16 px `margin-mobile` inset the rest of the product uses
 * for "not touching".
 */
const NODE_GUTTER_PX = 16;
/**
 * Enough width that the WIDEST row's nodes stand apart, derived rather than
 * pinned. The old flat `min-w-[560px]` was sized for 96 px nodes and four per
 * row (140 px columns); at 144 px those columns would overlap. Every tier of
 * the real graph tops out at four per row (measured over the seed: 4/4/4 for
 * tiers 1/2/3), so this is 640 px there — but a fifth node in a row would
 * widen the canvas instead of silently stacking two titles on top of each
 * other, which is what the flat number would have done.
 */
const MIN_GRAPH_WIDTH_PX = 560;

export function MapGraph({ map, onPick, disabled = false }: MapGraphProps) {
  const { t } = useTranslation();
  const layout = useMemo(() => layoutMap(map.nodes, map.edges), [map]);

  const positionByKey = useMemo(() => {
    const out = new Map<string, { x: number; y: number; state: TutorMapNode['state'] }>();
    for (const laid of layout.nodes) {
      out.set(laid.node.kcKey, {
        ...centerOf(laid.row, laid.col, laid.rowSize, layout.rows),
        state: laid.node.state,
      });
    }
    return out;
  }, [layout]);

  if (layout.nodes.length === 0) return null;

  const rowHeight = 92;
  const height = layout.rows * rowHeight;
  const widestRow = layout.nodes.reduce((widest, laid) => Math.max(widest, laid.rowSize), 1);
  const minWidth = Math.max(MIN_GRAPH_WIDTH_PX, widestRow * (NODE_WIDTH_PX + NODE_GUTTER_PX));

  /*
   * THE FIRST-LISTED PREREQUISITE IS NOT NECESSARILY THE ONE BLOCKING IT.
   *
   * Found by adversarial review, 2026-08-30 (MEDIUM): a node with several
   * prerequisites (the backend's `prereqsMet` requires ALL of them to meet
   * the mastery threshold) named whichever one happened to be first in
   * `map.edges`' array order — which could be one the learner has already
   * mastered, while the real blocker went unmentioned. That is a false
   * statement about the child's own progress, read out through the
   * accessible name.
   *
   * The lowest-mastery candidate is the actual reason the gate is still
   * closed, mirroring the same rule Oracle's own controller already uses
   * for its backward-prerequisite walk (`oracle/src/tutor/controller.ts`'s
   * PROBE rule: "probes the prerequisite with the LOWEST mastery, not the
   * first listed"). A prerequisite with NO evidence at all (`mastery: null`)
   * reads as the weakest of all, for the same reason that walk does.
   */
  const prereqTitleOf = (node: TutorMapNode): string | null => {
    let worst: TutorMapNode | null = null;
    for (const edge of map.edges) {
      if (edge.to !== node.kcKey) continue;
      const candidate = map.nodes.find((n) => n.kcKey === edge.from);
      if (!candidate) continue;
      if (worst === null || (candidate.mastery ?? -1) < (worst.mastery ?? -1)) worst = candidate;
    }
    return worst?.title ?? null;
  };

  return (
    <div className="overflow-x-auto overscroll-contain" role="group" aria-label={t('tutor.map.graphLabel')}>
      <div className="relative" style={{ height, minWidth }}>
        {/* Edges first, under the nodes — the prerequisite graph made visible. */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {layout.edges.map((edge) => {
            const from = positionByKey.get(edge.from);
            const to = positionByKey.get(edge.to);
            if (!from || !to) return null;
            return (
              <line
                key={`${edge.from}->${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={cn('stroke-outline', to.state === 'locked' && 'opacity-40')}
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {layout.nodes.map(({ node, row, col, rowSize }) => {
          const center = centerOf(row, col, rowSize, layout.rows);
          const startable = !disabled && node.state !== 'locked' && node.state !== 'mastered';
          const prereq = node.state === 'locked' ? prereqTitleOf(node) : null;
          const stateLine = t(`tutor.map.state.${node.state}`);
          return (
            <button
              key={node.kcKey}
              type="button"
              disabled={!startable}
              onClick={() => onPick(node)}
              aria-label={
                prereq
                  ? `${node.title}. ${t('tutor.map.lockedBy', { title: prereq })}`
                  : `${node.title}. ${stateLine}`
              }
              className={cn(
                'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-md p-2 text-center',
                'min-h-12 transition-opacity',
                NODE_STATE_CLASSES[node.state],
                startable && 'cursor-pointer hover:opacity-90',
              )}
              style={{ left: `${center.x}%`, top: `${center.y}%`, width: NODE_WIDTH_PX }}
            >
              <Icon
                name={NODE_ICON[node.state]}
                className={cn(
                  'text-base',
                  node.state === 'mastered' && 'text-success-strong',
                  node.state === 'needs_review' && 'text-warning-strong',
                  node.state === 'in_progress' && 'text-primary',
                  (node.state === 'available' || node.state === 'locked') && 'text-content-muted',
                )}
              />
              <span className="lf-caption line-clamp-2 leading-tight text-content">{node.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
