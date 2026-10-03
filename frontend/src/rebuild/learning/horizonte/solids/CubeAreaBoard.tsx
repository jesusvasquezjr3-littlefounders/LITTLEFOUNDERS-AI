import { useMemo } from 'react';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { AreaBoard, type AreaRow } from './AreaBoard';
import type { FigurePanel } from './NetFigure';
import { frameOf } from './netFrame';
import { cellFoldPanels } from './polyFold';
import type { Measure, Pt } from './polynet.generated';
import type { AreaNet } from './rules.generated';
import { fill, solidsText } from './solidsText';

type NetSegment = Extract<HorizonteSegment, { type: 'geometry.cube-net.v2' }>;

/** The corners of a net square on its grid cell, counter-clockwise with y up, so the figure draws it the way the grid shows it. */
const squareOf = (col: number, row: number, edge: number): Pt[] => {
  const [x, top] = [col * edge, -row * edge];
  return [[x, top - edge], [x + edge, top - edge], [x + edge, top], [x, top]];
};

/** Two sides of a square carry its length; the other two are the same length by the shape. */
const sidesOf = (edge: number): Measure[] => [{ type: 'edge', from: 0, to: 1, length: edge }, { type: 'edge', from: 1, to: 2, length: edge }];

/** Surface area of the cube net: six squares drawn with their edge printed on them, and the learner works out the area of the whole cube. */
export function CubeAreaBoard({ document, payload, segment, ...rest }: Omit<HorizonteBoardProps, 'segment'> & { segment: NetSegment; payload: AreaNet }) {
  const t = solidsText(document.locale);
  const { cells, edge } = payload;
  const panels = useMemo<FigurePanel[]>(() => cells.map(([col, row], index) => ({
    id: `panel${index}`, number: index + 1, points: squareOf(col, row, edge), measures: sidesOf(edge), name: null, state: 'plain',
  })), [cells, edge]);
  const frame = useMemo(() => frameOf(panels.flatMap((panel) => panel.points), Math.max(0.8, edge * 0.3)), [panels, edge]);
  const fold = useMemo(() => cellFoldPanels(cells, edge), [cells, edge]);
  const rows: AreaRow[] = cells.map((_, index) => ({ number: index + 1, shape: t.shapeSquare, lengths: fill(t.lengthsRect, { a: edge, b: edge }) }));
  return <AreaBoard {...rest} document={document} segment={segment} screen="cube-net" label={t.gridName} panels={panels} frame={frame} fold={fold} rows={rows} />;
}
