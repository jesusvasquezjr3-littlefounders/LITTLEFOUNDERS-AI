import { useMemo } from 'react';
import { composeVoxelScene, voxelAxis, type Cell, type Point, type RotationAxis } from './voxels.generated';

const points = (list: readonly Point[]): string => list.map((point) => `${point[0]},${point[1]}`).join(' ');

/**
 * A figure of unit cubes in its 3 by 3 by 3 box, drawn as isometric SVG from `composeVoxelScene`. With `axis` the line the
 * figure turns about is drawn through it. A figure with no `label` is decoration of a control that already has a name.
 */
export function VoxelFigure({ cells, axis, label, className = 'lf-vox' }: { cells: readonly Cell[]; axis?: RotationAxis; label?: string; className?: string }) {
  const scene = useMemo(() => composeVoxelScene(cells), [cells]);
  const line = axis ? voxelAxis(axis) : null;
  const named = label ? { role: 'img' as const, 'aria-label': label, 'data-copy-role': 'data' } : { 'aria-hidden': true as const };
  return <svg className={className} viewBox={`0 0 ${scene.width} ${scene.height}`} focusable="false" {...named}>
    <polygon className="lf-vox-floor" points={points(scene.floor)} />
    {scene.cubes.map((cube) => <g key={cube.cell.join('-')}>
      <polygon className="lf-vox-front lf-vox-line" points={points(cube.front)} />
      <polygon className="lf-vox-side lf-vox-line" points={points(cube.side)} />
      <polygon className="lf-vox-top lf-vox-line" points={points(cube.top)} />
    </g>)}
    {line ? <line className="lf-vox-axis" x1={line.from[0]} y1={line.from[1]} x2={line.to[0]} y2={line.to[1]} /> : null}
  </svg>;
}
