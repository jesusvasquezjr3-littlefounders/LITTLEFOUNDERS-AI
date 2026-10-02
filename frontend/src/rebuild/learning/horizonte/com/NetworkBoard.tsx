import { useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { TRAY, type Frame } from './arrange.generated';
import { COM_COPY } from './copy';
import { fill, fmt, list, type Words } from './format';
import {
  KEEP_SLOT, ODD_SLOT, ROUTE_SLOT, WALK_SLOT, dijkstraSteps, isTrail, leafId, networkFrame, pascalAccepts, pascalCellId, pascalSlotId, pascalValues,
  pathWeight, treeLeaves, type GraphPayload, type NetEdge, type NetNode, type PascalPayload, type PathPayload, type TreePayload,
} from './network.generated';
import { SlotBoardShell, Zone, useSlotBoard, type SlotBoard } from './slotBoard';
import { SpecTable, type TableSpec } from './specTable';
import './NetworkBoard.css';

type NetworkSegment = Extract<HorizonteSegment, { type: 'math.network-count.v2' }>;
type Labels = Readonly<Record<string, string>>;
type Props = Omit<HorizonteBoardProps, 'segment'> & { segment: NetworkSegment };
interface Inner extends Props { t: Words; locale: Locale; labels: Labels }

const NOTHING: Frame = { pieceIds: [], slotIds: [], capacities: {} };
const frameOf = (segment: NetworkSegment): Frame => networkFrame(segment.visual.type, segment.payload) ?? NOTHING;
const placed = (board: SlotBoard, slot: string): string[] => board.slots[slot] ?? [];

/* ── the map: nodes and the roads or bridges between them ── */

interface Geometry { edge: NetEdge; d: string; mid: { x: number; y: number } }

/** Parallel edges between the same two nodes fan out as curves, so every bridge stays visible and none hides another. */
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
    const offset = (same.indexOf(edge) - (same.length - 1) / 2) * 16;
    const nx = (-(b.y - a.y) / length) * offset;
    const ny = ((b.x - a.x) / length) * offset;
    const mid = { x: (a.x + b.x) / 2 + nx, y: (a.y + b.y) / 2 + ny };
    return { edge, mid, d: same.length === 1 ? `M${a.x} ${a.y} L${b.x} ${b.y}` : `M${a.x} ${a.y} Q${mid.x + nx} ${mid.y + ny} ${b.x} ${b.y}` };
  });
}

interface FigureProps {
  aria: string; nodes: readonly NetNode[]; edges: readonly NetEdge[]; labels: Labels;
  /** The text on an edge (a bridge number, a cost); null leaves it bare. */
  badge: (edge: NetEdge, index: number) => string | null;
  used: ReadonlySet<string>; marked: ReadonlySet<string>;
  /** 1-based place of a node in the learner's route. */
  order?: ReadonlyMap<string, number>;
  tags?: Readonly<Record<string, string>>;
}

function Figure({ aria, nodes, edges, labels, badge, used, marked, order, tags }: FigureProps) {
  return <svg className="lf-net" viewBox="-18 -8 136 120" role="img" aria-label={aria} data-copy-role="data" focusable="false">
    {geometryOf(nodes, edges).map(({ edge, d, mid }, index) => {
      const text = badge(edge, index);
      return <g key={edge.id}>
        <path className={used.has(edge.id) ? 'lf-net-edge lf-net-edge--used' : 'lf-net-edge'} d={d} fill="none" />
        {text === null ? null : <text className="lf-net-badge" x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central">{text}</text>}
      </g>;
    })}
    {nodes.map((node) => {
      const below = node.y >= 50;
      const step = order?.get(node.id);
      return <g key={node.id}>
        <circle className={marked.has(node.id) ? 'lf-net-node lf-net-node--on' : 'lf-net-node'} cx={node.x} cy={node.y} r="5.5" />
        {step === undefined ? null : <text className="lf-net-order" x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central">{step}</text>}
        <text className="lf-net-name" x={node.x} y={node.y + (below ? 12 : -8)} textAnchor="middle">{labels[node.id] ?? node.id}</text>
        {tags?.[node.id] ? <text className="lf-net-tag" x={node.x} y={node.y + (below ? 18 : -14)} textAnchor="middle">{tags[node.id]}</text> : null}
      </g>;
    })}
  </svg>;
}

/* ── graph: the odd places, or a walk over every bridge ── */

function GraphBoard({ document, segment, onBack, sequence, onGrade, t, labels }: Inner) {
  const graph = segment.payload as GraphPayload;
  const trail = graph.task === 'trail';
  const name = (id: string) => labels[id] ?? id;
  const bridgeName = (edge: NetEdge) => labels[edge.id] ?? fill(t.bridgeN, { n: graph.edges.indexOf(edge) + 1 });
  const edgeOf = (id: string) => graph.edges.find((edge) => edge.id === id)!;
  const slot = trail ? WALK_SLOT : ODD_SLOT;
  const board = useSlotBoard({
    segmentId: segment.id, frame: frameOf(segment), start: {}, onGrade,
    label: (id) => (trail ? bridgeName(edgeOf(id)) : name(id)),
    note: (id) => (trail ? fill(t.between, { a: name(edgeOf(id).from), b: name(edgeOf(id).to) }) : null),
    name: (id) => (id === WALK_SLOT ? t.zoneWalk : t.zoneOdd), trayLabel: t.backToTray,
  });
  const chosen = placed(board, slot);
  const linked = trail && chosen.length >= 2 ? isTrail(graph.edges, chosen, false) : null;
  const status = trail
    ? fill(t.walkStatus, { count: chosen.length, total: graph.edges.length, list: list(chosen.map((id) => bridgeName(edgeOf(id))), t.none), link: linked === null ? '' : linked ? t.walkLinked : t.walkBroken })
    : fill(t.oddStatus, { count: chosen.length, total: graph.nodes.length, list: list(chosen.map(name), t.none) });
  const table: TableSpec = { caption: t.tableBridges, head: [t.colBridge, t.colFrom, t.colTo], rows: graph.edges.map((edge) => [bridgeName(edge), name(edge.from), name(edge.to)]) };
  return <SlotBoardShell screen={trail ? 'network-walk' : 'network-odd'} document={document} segment={segment} onBack={onBack} sequence={sequence} board={board} t={t}
    named={trail ? { met: t.metWalk, hint: t.hintWalk } : { met: t.metOdd, hint: t.hintOdd }} status={status} table={table} tray heading={trail ? t.headingBridges : t.headingPlaces}>
    <Figure aria={fill(t.chartGraph, { places: graph.nodes.length, bridges: graph.edges.length })} nodes={graph.nodes} edges={graph.edges} labels={labels}
      badge={(edge, index) => (trail ? String(index + 1) : null)} used={new Set(trail ? chosen : [])} marked={new Set(trail ? [] : chosen)} />
    <div className="lf-slotzones"><Zone board={board} id={slot} name={trail ? t.zoneWalk : t.zoneOdd} numbered={trail ? (position) => fill(t.stepN, { n: position }) : undefined} /></div>
  </SlotBoardShell>;
}

/* ── shortest path: Dijkstra, one settled place at a time, offered after a try ── */

function RouteSteps({ route, t, locale, labels }: { route: PathPayload; t: Words; locale: Locale; labels: Labels }) {
  const steps = dijkstraSteps(route);
  const [at, setAt] = useState(0);
  const step = steps[at]!;
  const name = (id: string) => labels[id] ?? id;
  const table: TableSpec = {
    caption: t.tableSteps, head: [t.colPlace, t.colCost, t.colThrough],
    rows: route.nodes.map((node) => [name(node.id), step.distance[node.id] === null ? t.unreached : fmt(locale, step.distance[node.id]!), step.via[node.id] ? name(step.via[node.id]!) : '-']),
  };
  return <div className="lf-net-steps">
    <h3 data-copy-role="heading">{t.stepsHeading}</h3>
    <p data-copy-role="body">{fill(t.stepLine, { n: at + 1, total: steps.length, name: name(step.settled) })}</p>
    <div className="lf-net-steps-nav">
      <Button size="sm" variant="secondary" disabled={at === 0} onClick={() => setAt(at - 1)}>{t.stepPrev}</Button>
      <Button size="sm" variant="secondary" disabled={at === steps.length - 1} onClick={() => setAt(at + 1)}>{t.stepNext}</Button>
    </div>
    <SpecTable table={table} />
  </div>;
}

function RouteBoard({ document, segment, onBack, sequence, onGrade, t, locale, labels }: Inner) {
  const route = segment.payload as PathPayload;
  const name = (id: string) => labels[id] ?? id;
  const board = useSlotBoard({ segmentId: segment.id, frame: frameOf(segment), start: {}, onGrade, label: name, name: () => t.zoneRoute, trayLabel: t.backToTray });
  const [help, setHelp] = useState(false);
  const chosen = placed(board, ROUTE_SLOT);
  const cost = chosen.length >= 2 ? pathWeight(route.edges, chosen) : chosen.length === 1 ? 0 : null;
  const roads = new Set<string>();
  for (let i = 0; i + 1 < chosen.length; i += 1) {
    const road = route.edges.find((edge) => (edge.from === chosen[i] && edge.to === chosen[i + 1]) || (edge.to === chosen[i] && edge.from === chosen[i + 1]));
    if (road) roads.add(road.id);
  }
  const note = chosen.length === 0 ? '' : cost === null ? t.routeBroken : fill(t.routeCost, { total: fmt(locale, cost) });
  const result = board.grading.result;
  const tried = result !== null && result !== 'unavailable' && result.verdict !== 'met';
  const table: TableSpec = {
    caption: t.tableRoads, head: [t.colRoad, t.colFrom, t.colTo, t.colCost],
    rows: route.edges.map((edge, index) => [fill(t.roadN, { n: index + 1 }), name(edge.from), name(edge.to), fmt(locale, edge.weight ?? 0)]),
  };
  return <SlotBoardShell screen="network-route" document={document} segment={segment} onBack={onBack} sequence={sequence} board={board} t={t}
    named={{ met: t.metRoute, hint: t.hintRoute }} status={fill(t.routeStatus, { list: list(chosen.map(name), t.none), note })} table={table} tray heading={t.headingStops}
    aside={tried ? <>
      <Button size="sm" variant="secondary" aria-expanded={help} onClick={() => setHelp((shown) => !shown)}>{help ? t.hideSteps : t.showSteps}</Button>
      {help ? <RouteSteps route={route} t={t} locale={locale} labels={labels} /> : null}
    </> : undefined}>
    <Figure aria={fill(t.chartRoute, { places: route.nodes.length, roads: route.edges.length })} nodes={route.nodes} edges={route.edges} labels={labels}
      badge={(edge) => fmt(locale, edge.weight ?? 0)} used={roads} marked={new Set(chosen)} order={new Map(chosen.map((id, index) => [id, index + 1]))}
      tags={{ [route.start]: t.tagStart, [route.goal]: t.tagGoal }} />
    <div className="lf-slotzones"><Zone board={board} id={ROUTE_SLOT} name={t.zoneRoute} note={fill(t.routeFromTo, { a: name(route.start), b: name(route.goal) })} numbered={(position) => fill(t.stopN, { n: position })} /></div>
  </SlotBoardShell>;
}

/* ── choice tree: every outcome is a leaf; the learner keeps the ones the task asks for ── */

const TREE = { width: 320, top: 14, row: 17, left: 30, right: 36, glyph: 6.4, shown: 18 };

function Tree({ tree, labels, kept, aria }: { tree: TreePayload; labels: Labels; kept: ReadonlySet<string>; aria: string }) {
  const leaves = treeLeaves(tree);
  const name = (id: string) => labels[id] ?? id;
  /* The last column keeps room for the longest name (up to TREE.shown characters); the chips and the table carry every name whole. */
  const longest = Math.min(TREE.shown, Math.max(...leaves.flat().map((id) => name(id).length)));
  const right = Math.max(TREE.right, 10 + longest * TREE.glyph);
  const step = (TREE.width - TREE.left - right) / tree.pick;
  const x = (level: number) => TREE.left + level * step;
  const y = (index: number) => TREE.top + index * TREE.row;
  const height = TREE.top * 2 + (leaves.length - 1) * TREE.row;
  /* One node per distinct prefix; its height is the middle of the leaves beneath it. */
  const nodes = new Map<string, { level: number; item: string; y: number; parent: string | null; leaf: boolean }>();
  const span = new Map<string, number[]>();
  leaves.forEach((leaf, index) => {
    for (let level = 1; level <= leaf.length; level += 1) {
      const key = leaf.slice(0, level).join('.');
      span.set(key, [...(span.get(key) ?? []), index]);
      if (!nodes.has(key)) nodes.set(key, { level, item: leaf[level - 1]!, y: 0, parent: level === 1 ? null : leaf.slice(0, level - 1).join('.'), leaf: level === leaf.length });
    }
  });
  for (const [key, node] of nodes) { const rows = span.get(key)!; node.y = y((rows[0]! + rows[rows.length - 1]!) / 2); }
  const mid = y((leaves.length - 1) / 2);
  const onPath = new Set<string>();
  for (const leaf of leaves) if (kept.has(leafId(leaf))) for (let level = 1; level <= leaf.length; level += 1) onPath.add(leaf.slice(0, level).join('.'));
  return <svg className="lf-net lf-net-tree" viewBox={`0 0 ${TREE.width} ${height}`} role="img" aria-label={aria} data-copy-role="data" focusable="false">
    {[...nodes.entries()].map(([key, node]) => {
      const from = node.parent === null ? { x: x(0), y: mid } : { x: x(node.level - 1), y: nodes.get(node.parent)!.y };
      return <path key={key} className={onPath.has(key) ? 'lf-net-edge lf-net-edge--used' : 'lf-net-edge'} d={`M${from.x} ${from.y} L${x(node.level)} ${node.y}`} fill="none" />;
    })}
    <circle className="lf-net-node" cx={x(0)} cy={mid} r="4" />
    {[...nodes.entries()].map(([key, node]) => <text key={key} className={node.leaf && kept.has(key) ? 'lf-net-name lf-net-name--on' : 'lf-net-name'} x={x(node.level) + 5} y={node.y} dominantBaseline="central">{name(node.item)}</text>)}
  </svg>;
}

function TreeBoard({ document, segment, onBack, sequence, onGrade, t, labels }: Inner) {
  const tree = segment.payload as TreePayload;
  const name = (id: string) => labels[id] ?? id;
  const order = tree.mode === 'order';
  const leafName = (id: string) => id.split('.').map(name).join(order ? ` ${t.then} ` : ', ');
  const board = useSlotBoard({ segmentId: segment.id, frame: frameOf(segment), start: {}, onGrade, label: leafName, name: () => t.zoneKeep, trayLabel: t.backToTray });
  const kept = placed(board, KEEP_SLOT);
  const leaves = treeLeaves(tree).map(leafId);
  const table: TableSpec = { caption: t.tableOutcomes, head: [t.colOutcome, t.colKept], rows: leaves.map((id) => [leafName(id), kept.includes(id) ? t.yes : t.no]) };
  return <SlotBoardShell screen="network-tree" document={document} segment={segment} onBack={onBack} sequence={sequence} board={board} t={t}
    named={{ met: t.metTree, hint: order ? t.hintTreeOrder : t.hintTreeGroup }} status={fill(t.keepStatus, { count: kept.length, total: leaves.length })} table={table} tray heading={t.headingOutcomes}>
    <Tree tree={tree} labels={labels} kept={new Set(kept)} aria={fill(t.chartTree, { pick: tree.pick, total: leaves.length })} />
    <div className="lf-slotzones"><Zone board={board} id={KEEP_SLOT} name={t.zoneKeep} /></div>
  </SlotBoardShell>;
}

/* ── Pascal's triangle: color the multiples ── */

function PascalBoard({ document, segment, onBack, sequence, onGrade, t, locale }: Inner) {
  const pascal = segment.payload as PascalPayload;
  const values = pascalValues(pascal.rows);
  const board = useSlotBoard({
    segmentId: segment.id, frame: frameOf(segment), start: {}, onGrade, accepts: pascalAccepts,
    label: (id) => id, name: (id) => id, trayLabel: null,
  });
  const marked = new Set(Object.values(board.slots).flat());
  const [focus, setFocus] = useState(pascalCellId(0, 0));
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const total = values.reduce((sum, line) => sum + line.length, 0);
  const go = (event: KeyboardEvent<HTMLElement>, row: number, col: number) => {
    const target: [number, number] | null = event.key === 'ArrowRight' ? [row, col + 1] : event.key === 'ArrowLeft' ? [row, col - 1]
      : event.key === 'ArrowDown' ? [row + 1, col] : event.key === 'ArrowUp' ? [row - 1, Math.min(col, row - 1)]
        : event.key === 'Home' ? [row, 0] : event.key === 'End' ? [row, row] : null;
    if (target === null) return;
    const [nextRow, nextCol] = target;
    if (nextRow < 0 || nextRow >= pascal.rows || nextCol < 0 || nextCol > nextRow) return;
    event.preventDefault();
    const id = pascalCellId(nextRow, nextCol);
    setFocus(id);
    refs.current.get(id)?.focus();
  };
  const table: TableSpec = {
    caption: t.tableTriangle, head: [t.colRow, t.colNumbers, t.colMarked],
    rows: values.map((line, row) => [String(row + 1), line.map((value) => fmt(locale, value, 0)).join(' '),
      list(line.flatMap((value, col) => (marked.has(pascalCellId(row, col)) ? [fmt(locale, value, 0)] : [])), t.none)]),
  };
  return <SlotBoardShell screen="network-pascal" document={document} segment={segment} onBack={onBack} sequence={sequence} board={board} t={t}
    named={{ met: t.metPascal, hint: t.hintPascal }} status={fill(t.pascalStatus, { count: marked.size, total, multiple: pascal.multiple })} table={table} tray={false} move={false} heading={t.headingTriangle}>
    <div className="lf-pascal-scroll">
      <div className="lf-pascal" role="group" aria-label={t.chartPascal}>
        {values.map((line, row) => <div key={row} className="lf-pascal-row" role="group" aria-label={fill(t.pascalRow, { row: row + 1 })}>
          {line.map((value, col) => {
            const id = pascalCellId(row, col);
            const on = marked.has(id);
            return <button key={id} type="button" className="lf-pascal-cell" aria-pressed={on} disabled={board.locked} data-copy-role="data" data-hz-roving=""
              tabIndex={focus === id ? 0 : -1} aria-label={fill(t.pascalCell, { row: row + 1, place: col + 1, value: fmt(locale, value, 0) })}
              ref={(node) => { if (node) refs.current.set(id, node); else refs.current.delete(id); }}
              onFocus={() => setFocus(id)} onKeyDown={(event) => go(event, row, col)}
              onClick={() => board.place(id, on ? TRAY : pascalSlotId(row))}>{fmt(locale, value, 0)}</button>;
          })}
        </div>)}
      </div>
    </div>
  </SlotBoardShell>;
}

/* ── the board ── */

function Network(props: Props) {
  const { segment, document } = props;
  const t = copyText(COM_COPY, document.locale);
  const inner: Inner = { ...props, t, locale: document.locale, labels: segment.labels ?? {} };
  switch (segment.visual.type) {
    case 'graph': return <GraphBoard {...inner} />;
    case 'shortest-path': return <RouteBoard {...inner} />;
    case 'choice-tree': return <TreeBoard {...inner} />;
    default: return <PascalBoard {...inner} />;
  }
}

export default function NetworkBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.network-count.v2' ? <Network segment={segment} {...rest} /> : null;
}
