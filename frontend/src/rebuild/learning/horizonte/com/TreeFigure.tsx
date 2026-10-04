import { BoardLabel, LabelledDrawing } from '../BoardLabel';
import { leafId, treeLeaves, type TreePayload } from './network.generated';
import './treeBoard.css';

/* Viewbox units. Rows and the last column fit one line of 14 px text at the narrowest phone, where the drawing scales to about 0.75. */
const TREE = { width: 320, top: 16, row: 28, left: 24, right: 52, glyph: 12, shown: 14, gap: 6 };

/** The choice tree: the lines are SVG, every outcome name is an HTML label over them, and the kept outcomes show in the primary ink. */
export function TreeFigure({ tree, labels, kept, aria }: { tree: TreePayload; labels: Readonly<Record<string, string>>; kept: ReadonlySet<string>; aria: string }) {
  const leaves = treeLeaves(tree);
  const name = (id: string) => labels[id] ?? id;
  /* The last column keeps room for the longest name (up to TREE.shown characters); the chips and the table carry every name whole. */
  const longest = Math.min(TREE.shown, Math.max(...leaves.flat().map((id) => name(id).length)));
  const right = Math.max(TREE.right, 12 + longest * TREE.glyph);
  const step = (TREE.width - TREE.left - right) / tree.pick;
  const x = (level: number) => TREE.left + level * step;
  const y = (index: number) => TREE.top + index * TREE.row;
  const height = TREE.top * 2 + (leaves.length - 1) * TREE.row;
  const box = { width: TREE.width, height };
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
  return <div className="lf-net-frame">
    <LabelledDrawing>
      <svg className="lf-net lf-net-tree" viewBox={`0 0 ${TREE.width} ${height}`} role="img" aria-label={aria} data-copy-role="data" focusable="false">
        {[...nodes.entries()].map(([key, node]) => {
          const from = node.parent === null ? { x: x(0), y: mid } : { x: x(node.level - 1), y: nodes.get(node.parent)!.y };
          return <path key={key} className={onPath.has(key) ? 'lf-net-edge lf-net-edge--used' : 'lf-net-edge'} d={`M${from.x} ${from.y} L${x(node.level)} ${node.y}`} fill="none" />;
        })}
        <circle className="lf-net-node" cx={x(0)} cy={mid} r="4" />
      </svg>
      {[...nodes.entries()].map(([key, node]) => {
        const left = x(node.level) + TREE.gap;
        const room = (node.leaf ? TREE.width : x(node.level) + step) - left - TREE.gap;
        return <BoardLabel key={key} x={left} y={node.y} box={box} align="start" room={room}>
          <span className={node.leaf && kept.has(key) ? 'lf-net-word lf-net-word--on' : 'lf-net-word'}>{name(node.item)}</span>
        </BoardLabel>;
      })}
    </LabelledDrawing>
  </div>;
}
