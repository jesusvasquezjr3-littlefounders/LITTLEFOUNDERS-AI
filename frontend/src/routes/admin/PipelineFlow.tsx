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
import type { LiveRunHeartbeat } from './generationTypes';

/*
 * /admin/generation live flow visualization. Shows the 7-stage Forge pipeline
 * as an interactive React Flow canvas. Nodes are colored by slot activity:
 * gray (idle), papaya pulse (active), green (all done), red (has failures).
 */

const STAGES = [
  'pending',
  'planning',
  'writing',
  'reviewing',
  'localizing',
  'illustrating',
  'publishing',
  'published',
] as const;

const STAGE_ICONS: Record<string, string> = {
  pending: 'pending',
  planning: 'psychology',
  writing: 'edit_note',
  reviewing: 'grading',
  localizing: 'translate',
  illustrating: 'image',
  publishing: 'cloud_upload',
  published: 'task_alt',
};

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

function buildNodes(t: (key: string, opts?: Record<string, unknown>) => string, breakdown: Record<string, number>): Node[] {
  return STAGES.map((stage, i) => {
    const isTerminal = stage === 'published';
    const isFirst = i === 0;
    return {
      id: stage,
      type: 'pipeline',
      position: { x: START_X + i * (NODE_W + NODE_GAP), y: 60 },
      data: {
        stage,
        label: t(`admin.generation.stages.${stage}`, { defaultValue: stage }),
        icon: STAGE_ICONS[stage] ?? 'circle',
        count: breakdown[stage] ?? 0,
        active: false,
        terminal: isTerminal,
      } satisfies PipelineNodeData,
      sourcePosition: isFirst ? undefined : Position.Right,
      targetPosition: isFirst ? undefined : Position.Left,
    };
  });
}

function buildEdges(): Edge[] {
  return STAGES.slice(0, -1).map((_, i) => ({
    id: `e-${STAGES[i]}-${STAGES[i + 1]}`,
    source: STAGES[i]!,
    target: STAGES[i + 1]!,
    animated: false,
    style: { stroke: 'var(--color-outline)', strokeWidth: 2 },
  }));
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

  const initialNodes = useMemo<Node[]>(() => buildNodes(t, breakdown), [t]);
  const initialEdges = useMemo<Edge[]>(() => buildEdges(), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  // Update node data when heartbeat/breakdown changes — use useEffect, NOT useMemo,
  // because setNodes/setEdges are side effects. useMemo on non-pure functions causes
  // infinite render loops (setState → re-render → useMemo → setState → …).
  useEffect(() => {
    setNodes((nds) => {
      // Bail out when nothing actually changed: returning the SAME array makes
      // React skip the re-render entirely. Belt and braces against this effect
      // ever becoming self-triggering again (every poll delivers a fresh
      // stageBreakdown object even when the numbers are identical).
      let changed = false;
      const next = nds.map((n) => {
        const count = breakdown[n.id] ?? 0;
        const active = n.id !== 'published' && n.id !== 'pending' && count > 0;
        const terminal = n.id === 'published';
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
      let changed = false;
      const next = eds.map((e) => {
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
  }, [breakdown, setNodes, setEdges]);

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
