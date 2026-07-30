import { useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  resolveGenerationKind,
  stagesForKind,
  type GenerationStageDescriptor,
  type LiveRunHeartbeat,
} from './generationTypes';

/*
 * /admin/generation live flow visualization. Shows the active run's pipeline as
 * an interactive React Flow canvas. Nodes are colored by slot activity: gray
 * (idle), papaya pulse (active), green (all done).
 *
 * The stage list is PER-KIND (see generationTypes.ts): Forge lesson runs and
 * Arcade game runs share the telemetry tables but not the stage vocabulary, so
 * the list is derived from the run rather than hardcoded. A hardcoded Forge list
 * rendered a live game run as a row of empty pills.
 */

const NODE_W = 140;
const NODE_H = 72;
const NODE_GAP = 28;
const NODE_W_SM = 110;
const NODE_H_SM = 60;
const START_X = 20;

// ── Custom node ──────────────────────────────────────────────────────────────

interface PipelineNodeData {
  stage: string;
  label: string;
  icon: string;
  count: number;
  active: boolean;
  terminal?: boolean;
}

function PipelineNode({ data }: NodeProps) {
  const d = data as unknown as PipelineNodeData;
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-2xl border px-4 py-3 text-center transition-all duration-500',
        d.terminal
          ? 'border-success-strong/30 bg-success-soft'
          : d.active
            ? 'border-accent/50 bg-accent-soft animate-pulse shadow-glass'
            : d.count > 0
              ? 'border-outline bg-surface-sunken'
              : 'border-outline/30 bg-surface-sunken/50',
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle type="target" position={Position.Left} className="!bg-outline" />
      <span className="material-symbols-outlined text-lg leading-none text-content-muted">
        {d.icon}
      </span>
      <span className="lf-caption truncate max-w-full">{d.label}</span>
      <span className={cn('lf-number text-xs', d.count > 0 ? 'text-content' : 'text-content-faint')}>
        {d.count}
      </span>
      <Handle type="source" position={Position.Right} className="!bg-outline" />
    </div>
  );
}

const nodeTypes = { pipeline: PipelineNode };

// ── Props ───────────────────────────────────────────────────────────────────

interface PipelineFlowProps {
  heartbeat: LiveRunHeartbeat | null;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type Translate = (key: string, opts?: Record<string, unknown>) => string;

function buildNodes(t: Translate, stages: readonly GenerationStageDescriptor[]): Node[] {
  return stages.map((stage, i) => ({
    id: stage.key,
    type: 'pipeline',
    position: { x: START_X + i * (NODE_W + NODE_GAP), y: 60 },
    data: {
      stage: stage.key,
      // Every label comes from i18n — the stage key is only a last-resort
      // developer fallback, never a shipped user-facing string.
      label: t(`admin.generation.stages.${stage.key}`, { defaultValue: stage.key }),
      icon: stage.icon,
      count: 0,
      active: false,
      terminal: stage.terminal === true,
    } satisfies PipelineNodeData,
    sourcePosition: i === 0 ? undefined : Position.Right,
    targetPosition: i === 0 ? undefined : Position.Left,
  }));
}

function buildEdges(stages: readonly GenerationStageDescriptor[]): Edge[] {
  const edges: Edge[] = [];
  // Indexed reads are guarded: noUncheckedIndexedAccess types them as possibly
  // undefined and the pipeline list is data-driven now.
  for (let i = 0; i < stages.length - 1; i += 1) {
    const from = stages[i];
    const to = stages[i + 1];
    if (!from || !to) continue;
    edges.push({
      id: `e-${from.key}-${to.key}`,
      source: from.key,
      target: to.key,
      animated: false,
      style: { stroke: 'var(--color-outline)', strokeWidth: 2 },
    });
  }
  return edges;
}

/** True when the rendered graph already matches this stage list, in order. */
function matchesStages(nodes: readonly Node[], stages: readonly GenerationStageDescriptor[]): boolean {
  return nodes.length === stages.length && stages.every((s, i) => nodes[i]?.id === s.key);
}

/**
 * Stable identity for "no heartbeat yet". Shared across every render so the
 * effect's dependency only changes when a real breakdown arrives.
 */
const EMPTY_BREAKDOWN: Record<string, number> = {};

// ── Component ───────────────────────────────────────────────────────────────

export function PipelineFlow({ heartbeat, className }: PipelineFlowProps) {
  const { t } = useTranslation();
  // MUST be the module-level constant, never a fresh `{}`. The effect below
  // depends on `breakdown`, so a new object literal per render made the
  // dependency change every time: setNodes → re-render → new {} → setNodes …
  // an unbreakable loop in the page's DEFAULT state (no active run).
  const breakdown = heartbeat?.stageBreakdown ?? EMPTY_BREAKDOWN;

  // Same footgun class as EMPTY_BREAKDOWN: `stages` is a hook dependency, so it
  // MUST be referentially stable. `stagesForKind` returns the module-level array
  // for the kind — it never allocates — and `resolveGenerationKind` returns a
  // primitive, so neither changes identity between renders of the same run.
  const kind = resolveGenerationKind(heartbeat);
  const stages = stagesForKind(kind);

  const initialNodes = useMemo<Node[]>(() => buildNodes(t, stages), [t, stages]);
  const initialEdges = useMemo<Edge[]>(() => buildEdges(stages), [stages]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  // Update node data when heartbeat/breakdown changes — use useEffect, NOT useMemo,
  // because setNodes/setEdges are side effects. useMemo on non-pure functions causes
  // infinite render loops (setState → re-render → useMemo → setState → …).
  useEffect(() => {
    setNodes((nds) => {
      // A run of a different kind carries a different stage list, so rebuild the
      // graph from scratch; otherwise patch the existing nodes in place and keep
      // React Flow's per-node state.
      const aligned = matchesStages(nds, stages);
      const base = aligned ? nds : buildNodes(t, stages);
      // Bail out when nothing actually changed: returning the SAME array makes
      // React skip the re-render entirely. Belt and braces against this effect
      // ever becoming self-triggering again (every poll delivers a fresh
      // stageBreakdown object even when the numbers are identical).
      let changed = !aligned;
      const next = base.map((n, i) => {
        const stage = stages[i];
        const count = breakdown[n.id] ?? 0;
        const active = stage !== undefined && !stage.terminal && !stage.idle && count > 0;
        const terminal = stage?.terminal === true;
        const prev = n.data as unknown as PipelineNodeData;
        if (prev.count === count && prev.active === active && prev.terminal === terminal) return n;
        changed = true;
        return {
          ...n,
          data: { ...prev, count, active, terminal } satisfies PipelineNodeData,
        };
      });
      return changed ? next : nds;
    });
    setEdges((eds) => {
      const aligned =
        eds.length === Math.max(stages.length - 1, 0) &&
        eds.every((e, i) => e.source === stages[i]?.key);
      const base = aligned ? eds : buildEdges(stages);
      let changed = !aligned;
      const next = base.map((e) => {
        const count = breakdown[e.source] ?? 0;
        const active = count > 0;
        const sameLabel = e.label === (active ? String(count) : undefined);
        if (e.animated === active && sameLabel) return e;
        changed = true;
        return {
          ...e,
          animated: active,
          style: {
            stroke: active ? 'var(--color-accent)' : 'var(--color-outline)',
            strokeWidth: active ? 2.5 : 1.5,
          },
          markerEnd: active
            ? { type: MarkerType.ArrowClosed, color: 'var(--color-accent)', width: 12, height: 12 }
            : undefined,
          label: active ? String(count) : undefined,
          labelStyle: { fill: 'var(--color-content-muted)', fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: 'var(--color-surface-sunken)', rx: 8, ry: 8 },
          labelBgPadding: [6, 3] as [number, number],
        };
      });
      return changed ? next : eds;
    });
  }, [breakdown, stages, t, setNodes, setEdges]);

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-outline/30 bg-base',
        'h-[220px] sm:h-[280px]',
        '[&_.react-flow__attribution]:hidden',
        '[&_.react-flow__controls]:hidden',
        '[&_.react-flow__minimap]:hidden',
        className,
      )}
    >
      <style>{`
        .react-flow__node { cursor: default !important; }
        .react-flow__handle { width: 8px !important; height: 8px !important; }
        @media (max-width: 639px) {
          .react-flow__node-pipeline > div {
            width: ${NODE_W_SM}px !important;
            height: ${NODE_H_SM}px !important;
            padding: 0.25rem 0.5rem !important;
          }
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        proOptions={{ hideAttribution: true }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
