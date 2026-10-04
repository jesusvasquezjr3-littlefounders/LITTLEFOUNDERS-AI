import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { NetEdge, NetNode } from './network.generated';
import { BoardLabel, LabelledDrawing } from '../BoardLabel';
import { blockOf, type Block } from './labelBlock';
import './networkMap.css';

/*
 * The map of places and the roads or bridges between them. The names are HTML over the drawing (Frontend Bible 05 section 5),
 * so they keep their size and wrap in translation. A name is 14 px wherever the map is, so the drawing is laid out in CSS
 * pixels: it measures the room it has, spreads the places as far apart as that room and the names allow, and for each place
 * picks the side of its circle where the name touches no road, bridge number or other name.
 */

const NODE_R = 12;
/** Pixels per percent of the fixture's 0..100 grid: the places spread as far as the room lets them, between these. */
const SPREAD_MAX = 3.6;
const SPREAD_MIN = 1.1;
const SPREAD_STEP = 0.15;
/** Before the room is measured (and where nothing is measured) the drawing assumes a 320 px screen's room. */
const FALLBACK_PX = 240;
const HEIGHT_MAX = 360;
const GAP = 5;
const PAD = 6;
/** How far parallel bridges between the same two places bulge apart. */
const BULGE = 30;

type Labels = Readonly<Record<string, string>>;
interface Point { x: number; y: number }
interface Rect { x0: number; y0: number; x1: number; y1: number }
interface Geometry { edge: NetEdge; d: string; mid: Point; points: Point[] }

const SPOTS = ['N', 'S', 'NR', 'NL', 'SR', 'SL', 'E', 'W', 'NE', 'NW', 'SE', 'SW'] as const;
type Spot = (typeof SPOTS)[number];
/* R and L hang the name above or below the place, from its right or left edge, so a place at the map's edge needs no extra room. */
const ALIGN: Record<Spot, 'start' | 'middle' | 'end'> = { N: 'middle', S: 'middle', NR: 'start', NL: 'end', SR: 'start', SL: 'end', E: 'start', W: 'end', NE: 'start', NW: 'end', SE: 'start', SW: 'end' };
const VALIGN: Record<Spot, 'top' | 'middle' | 'bottom'> = { N: 'bottom', S: 'top', NR: 'bottom', NL: 'bottom', SR: 'top', SL: 'top', E: 'middle', W: 'middle', NE: 'bottom', NW: 'bottom', SE: 'top', SW: 'top' };
/* Above and below read first, the sides next, the corners last. */
const PREFER: Record<Spot, number> = { N: 0, S: 1, NR: 2, NL: 2, SR: 3, SL: 3, E: 4, W: 4, NE: 7, NW: 7, SE: 8, SW: 8 };

/** Parallel edges between the same two places fan out as curves, so every bridge stays visible and none hides another. */
function geometryOf(nodes: readonly NetNode[], edges: readonly NetEdge[]): Geometry[] {
  const at = new Map(nodes.map((node) => [node.id, node]));
  const pairOf = (edge: NetEdge) => [edge.from, edge.to].sort().join('|');
  const group = new Map<string, NetEdge[]>();
  for (const edge of edges) group.set(pairOf(edge), [...(group.get(pairOf(edge)) ?? []), edge]);
  return edges.map((edge) => {
    const same = group.get(pairOf(edge))!;
    const [first, second] = [edge.from, edge.to].sort();
    const a = at.get(first!)!;
    const b = at.get(second!)!;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const offset = (same.indexOf(edge) - (same.length - 1) / 2) * BULGE;
    const nx = (-(b.y - a.y) / length) * offset;
    const ny = ((b.x - a.x) / length) * offset;
    const mid = { x: (a.x + b.x) / 2 + nx, y: (a.y + b.y) / 2 + ny };
    const steps = Math.max(8, Math.ceil(length / 6));
    const control = { x: mid.x + nx, y: mid.y + ny };
    const points = Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      if (same.length === 1) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      return { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t ** 2 * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t ** 2 * b.y };
    });
    return { edge, mid, points, d: same.length === 1 ? `M${a.x} ${a.y} L${b.x} ${b.y}` : `M${a.x} ${a.y} Q${control.x} ${control.y} ${b.x} ${b.y}` };
  });
}

function rectOf(node: Point, spot: Spot, block: Block): Rect {
  const reach = NODE_R + GAP;
  const diagonal = reach * 0.72;
  const anchor = {
    N: { x: node.x, y: node.y - reach }, S: { x: node.x, y: node.y + reach }, E: { x: node.x + reach, y: node.y }, W: { x: node.x - reach, y: node.y },
    NR: { x: node.x - NODE_R, y: node.y - reach }, NL: { x: node.x + NODE_R, y: node.y - reach }, SR: { x: node.x - NODE_R, y: node.y + reach }, SL: { x: node.x + NODE_R, y: node.y + reach },
    NE: { x: node.x + diagonal, y: node.y - diagonal }, NW: { x: node.x - diagonal, y: node.y - diagonal }, SE: { x: node.x + diagonal, y: node.y + diagonal }, SW: { x: node.x - diagonal, y: node.y + diagonal },
  }[spot];
  const x0 = ALIGN[spot] === 'middle' ? anchor.x - block.w / 2 : ALIGN[spot] === 'end' ? anchor.x - block.w : anchor.x;
  const y0 = VALIGN[spot] === 'middle' ? anchor.y - block.h / 2 : VALIGN[spot] === 'bottom' ? anchor.y - block.h : anchor.y;
  return { x0, y0, x1: x0 + block.w, y1: y0 + block.h };
}

const grow = (rect: Rect, by: number): Rect => ({ x0: rect.x0 - by, y0: rect.y0 - by, x1: rect.x1 + by, y1: rect.y1 + by });
const meets = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (rect: Rect, point: Point) => point.x > rect.x0 && point.x < rect.x1 && point.y > rect.y0 && point.y < rect.y1;
function touchesCircle(rect: Rect, center: Point, radius: number): boolean {
  const dx = Math.max(rect.x0 - center.x, 0, center.x - rect.x1);
  const dy = Math.max(rect.y0 - center.y, 0, center.y - rect.y1);
  return dx * dx + dy * dy < radius * radius;
}

interface Layout { nodes: NetNode[]; roads: Geometry[]; spots: Spot[]; blocks: Block[]; rects: Rect[]; box: Rect }

function solve(raw: readonly NetNode[], edges: readonly NetEdge[], blocks: readonly Block[], numbers: ReadonlySet<string>, spread: number): Layout {
  const nodes = raw.map((node) => ({ ...node, x: node.x * spread, y: node.y * spread }));
  const roads = geometryOf(nodes, edges);
  const base: Rect = {
    x0: Math.min(...nodes.map((node) => node.x)) - NODE_R - PAD, y0: Math.min(...nodes.map((node) => node.y)) - NODE_R - PAD,
    x1: Math.max(...nodes.map((node) => node.x)) + NODE_R + PAD, y1: Math.max(...nodes.map((node) => node.y)) + NODE_R + PAD,
  };
  const marks = roads.filter((road) => numbers.has(road.edge.id)).map((road) => road.mid);
  const cost = (index: number, spot: Spot, taken: readonly (Rect | null)[]): number => {
    const rect = rectOf(nodes[index]!, spot, blocks[index]!);
    const padded = grow(rect, 2);
    let total = PREFER[spot];
    nodes.forEach((node, other) => { if (touchesCircle(padded, node, other === index ? NODE_R + 1 : NODE_R + 3)) total += other === index ? 400 : 1000; });
    for (const road of roads) for (const point of road.points) if (inside(padded, point)) total += 20;
    for (const mark of marks) if (touchesCircle(padded, mark, NODE_R + 2)) total += 600;
    taken.forEach((other, at) => { if (at !== index && other && meets(padded, grow(other, 2))) total += 1000; });
    /* A name outside the places' own box widens the drawing, which shrinks it on a phone: inside is preferred. */
    total += 2 * (Math.max(0, base.x0 - rect.x0) + Math.max(0, rect.x1 - base.x1) + Math.max(0, base.y0 - rect.y0) + Math.max(0, rect.y1 - base.y1));
    return total;
  };
  const spots: Spot[] = nodes.map((_, index) => SPOTS.reduce((best, spot) => (cost(index, spot, []) < cost(index, best, []) ? spot : best), 'N' as Spot));
  const taken = (): (Rect | null)[] => spots.map((spot, index) => rectOf(nodes[index]!, spot, blocks[index]!));
  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    nodes.forEach((_, index) => {
      const others = taken();
      const best = SPOTS.reduce((winner, spot) => (cost(index, spot, others) < cost(index, winner, others) ? spot : winner), spots[index]!);
      if (best !== spots[index]) { spots[index] = best; moved = true; }
    });
    if (!moved) break;
  }
  const rects = taken().map((rect) => rect!);
  const roadPoints = roads.flatMap((road) => road.points);
  const box = [...rects.map((rect) => grow(rect, 2)), base, ...roadPoints.map((point) => ({ x0: point.x - 3, y0: point.y - 3, x1: point.x + 3, y1: point.y + 3 }))].reduce((all, rect) => ({
    x0: Math.min(all.x0, rect.x0), y0: Math.min(all.y0, rect.y0), x1: Math.max(all.x1, rect.x1), y1: Math.max(all.y1, rect.y1),
  }));
  return { nodes, roads, spots, blocks: [...blocks], rects, box };
}

/** The widest spread whose drawing, names included, fits the room; the narrowest one when nothing does. */
function fit(raw: readonly NetNode[], edges: readonly NetEdge[], names: readonly string[], tags: readonly (string | undefined)[], numbers: ReadonlySet<string>, room: number): Layout {
  const blocks = raw.map((_, index) => blockOf(names[index]!, tags[index]));
  let layout = solve(raw, edges, blocks, numbers, SPREAD_MAX);
  for (let spread = SPREAD_MAX - SPREAD_STEP; spread >= SPREAD_MIN && (layout.box.x1 - layout.box.x0 > room || layout.box.y1 - layout.box.y0 > HEIGHT_MAX); spread -= SPREAD_STEP) {
    layout = solve(raw, edges, blocks, numbers, spread);
  }
  return layout;
}

/** The width the drawing may take inside its frame, in CSS pixels; a screen's worth until it is measured. */
function useRoom() {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(FALLBACK_PX);
  useLayoutEffect(() => {
    const node = ref.current;
    const inner = frame.current;
    if (!node || !inner) return undefined;
    const read = () => {
      const style = getComputedStyle(inner);
      const width = Math.floor(node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
      if (width > 0) setRoom(width);
    };
    read();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', read); return () => window.removeEventListener('resize', read); }
    const watcher = new ResizeObserver(read);
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);
  return { ref, frame, room };
}

export interface MapFigureProps {
  aria: string; nodes: readonly NetNode[]; edges: readonly NetEdge[]; labels: Labels;
  /** The text on an edge (a bridge number, a cost); null leaves it bare. */
  badge: (edge: NetEdge, index: number) => string | null;
  used: ReadonlySet<string>; marked: ReadonlySet<string>;
  /** 1-based place of a node in the learner's route. */
  order?: ReadonlyMap<string, number>;
  tags?: Readonly<Record<string, string>>;
}

export function MapFigure({ aria, nodes: raw, edges, labels, badge, used, marked, order, tags }: MapFigureProps) {
  const { ref, frame, room } = useRoom();
  const texts = edges.map((edge, index) => badge(edge, index));
  const names = raw.map((node) => labels[node.id] ?? node.id);
  const marks = raw.map((node) => tags?.[node.id]);
  const numbered = new Set(edges.filter((_, index) => texts[index] !== null).map((edge) => edge.id));
  const key = JSON.stringify([names, marks, [...numbered]]);
  /* `key` stands for the names, tags and numbered edges, which are rebuilt on every render. */
  const layout = useMemo(() => fit(raw, edges, names, marks, numbered, room), [raw, edges, key, room]);
  const { box, nodes, roads } = layout;
  const size = { width: box.x1 - box.x0, height: box.y1 - box.y0 };
  return <div className="lf-map-room" ref={ref}>
    <div className="lf-map-frame" ref={frame}>
      <div className="lf-map-sized" style={{ inlineSize: size.width }}>
        <LabelledDrawing>
          <svg viewBox={`${box.x0} ${box.y0} ${size.width} ${size.height}`} role="img" aria-label={aria} data-copy-role="data" focusable="false">
            {roads.map(({ edge, d, mid }, index) => <g key={edge.id}>
              <path className={used.has(edge.id) ? 'lf-net-edge lf-net-edge--used' : 'lf-net-edge'} d={d} fill="none" />
              {texts[index] === null ? null : <text className="lf-map-badge" x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central">{texts[index]}</text>}
            </g>)}
            {nodes.map((node) => {
              const step = order?.get(node.id);
              return <g key={node.id}>
                <circle className={marked.has(node.id) ? 'lf-net-node lf-net-node--on' : 'lf-net-node'} cx={node.x} cy={node.y} r={NODE_R} />
                {step === undefined ? null : <text className="lf-map-order" x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central">{step}</text>}
              </g>;
            })}
          </svg>
          {nodes.map((node, index) => {
            const spot = layout.spots[index]!;
            const rect = layout.rects[index]!;
            const block = layout.blocks[index]!;
            const x = ALIGN[spot] === 'middle' ? (rect.x0 + rect.x1) / 2 : ALIGN[spot] === 'end' ? rect.x1 : rect.x0;
            const y = VALIGN[spot] === 'middle' ? (rect.y0 + rect.y1) / 2 : VALIGN[spot] === 'bottom' ? rect.y1 : rect.y0;
            return <BoardLabel key={node.id} x={x - box.x0} y={y - box.y0} box={size} align={ALIGN[spot]} valign={VALIGN[spot]} room={block.room + 2}>
              <span className="lf-map-name" style={{ maxInlineSize: `${block.room / 14}em` }}>{names[index]}</span>
              {marks[index] ? <span className="lf-map-tag">{marks[index]}</span> : null}
            </BoardLabel>;
          })}
        </LabelledDrawing>
      </div>
    </div>
  </div>;
}
