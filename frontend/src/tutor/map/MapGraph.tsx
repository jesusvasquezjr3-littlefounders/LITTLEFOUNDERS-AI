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

  const prereqTitleOf = (node: TutorMapNode): string | null => {
    const edge = map.edges.find((e) => e.to === node.kcKey);
    if (!edge) return null;
    return map.nodes.find((n) => n.kcKey === edge.from)?.title ?? null;
  };

  return (
    <div className="overflow-x-auto overscroll-contain" role="group" aria-label={t('tutor.map.graphLabel')}>
      <div className="relative min-w-[560px]" style={{ height }}>
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
                'absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-md p-2 text-center',
                'min-h-12 transition-opacity',
                NODE_STATE_CLASSES[node.state],
                startable && 'cursor-pointer hover:opacity-90',
              )}
              style={{ left: `${center.x}%`, top: `${center.y}%` }}
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
