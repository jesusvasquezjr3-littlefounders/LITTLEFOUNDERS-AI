import { useMemo } from 'react';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { AreaBoard, type AreaRow } from './AreaBoard';
import type { FigurePanel } from './NetFigure';
import { frameOf, shapeOf } from './netFrame';
import { polyFoldPanels } from './polyFold';
import { buildNet, buildSolid, type PolyNet, type PolySolid } from './polynet.generated';
import { readSolidNetPayload, type SolidArea } from './rules.generated';
import { SolidCompleteBoard } from './SolidCompleteBoard';
import { SolidLabelBoard } from './SolidLabelBoard';
import { fill, lengthsLabel, polyKindLabel, shapeLabel, solidsText } from './solidsText';

type SolidSegment = Extract<HorizonteSegment, { type: 'geometry.solid-net.v2' }>;

const FRAME_PAD = 0.8;

/** Surface area of a box, prism or pyramid net: the panels drawn with their lengths, and the learner adds up the faces. */
function SolidAreaBoard(props: Omit<HorizonteBoardProps, 'segment'> & { segment: SolidSegment; payload: SolidArea; solid: PolySolid; net: PolyNet }) {
  const { document, solid, net } = props;
  const t = solidsText(document.locale);
  const panels = net.layout.panels;
  const frame = useMemo(() => frameOf(panels.flatMap((panel) => panel.points), FRAME_PAD), [panels]);
  const fold = useMemo(() => polyFoldPanels(solid, net.layout), [solid, net]);
  const figure: FigurePanel[] = panels.map((panel, index) => ({
    id: `panel${index}`, number: index + 1, points: panel.points, measures: solid.faces[panel.face]!.measures, name: null, state: 'plain',
  }));
  const rows: AreaRow[] = panels.map((panel, index) => {
    const face = solid.faces[panel.face]!;
    return { number: index + 1, shape: shapeLabel(t, shapeOf(face)), lengths: lengthsLabel(t, face) };
  });
  return <AreaBoard {...props} screen="solid-net" label={fill(t.netLabel, { solid: polyKindLabel(t, solid.kind) })} panels={figure} frame={frame} fold={fold} rows={rows} />;
}

/*
 * F4.2 for the solids that are not cubes: one segment type, three modes. The payload is read and the solid and net are built once here,
 * so a segment the model cannot build renders nothing rather than a broken board; Core re-validates the same payload on every grade.
 */
export default function SolidNetBoard(props: HorizonteBoardProps) {
  const segment = props.segment;
  const payload = useMemo(() => (segment.type === 'geometry.solid-net.v2' ? readSolidNetPayload(segment.payload) : null), [segment]);
  const solid = useMemo(() => (payload ? buildSolid(payload.solid) : null), [payload]);
  const net = useMemo(() => (solid && payload && payload.mode !== 'complete' ? buildNet(solid, payload.net) : null), [solid, payload]);
  if (segment.type !== 'geometry.solid-net.v2' || !payload || !solid) return null;
  const board = { ...props, segment };
  if (payload.mode === 'complete') return <SolidCompleteBoard {...board} payload={payload} solid={solid} />;
  if (!net) return null;
  if (payload.mode === 'label') return <SolidLabelBoard {...board} payload={payload} solid={solid} net={net} />;
  return <SolidAreaBoard {...board} payload={payload} solid={solid} net={net} />;
}
