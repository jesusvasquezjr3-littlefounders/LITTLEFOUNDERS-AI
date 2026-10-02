import { useMemo } from 'react';
import type { SolidId } from './model.generated';
import { SCENE_SIZE, composeScene, type LabelMode, type SolidView } from './projection.generated';

/** The full viewer in plain SVG: the same faces, edges and labels the 3D chunk shows, drawn from `composeScene`. */
export function SolidSvg({ solid, view, labels, name }: { solid: SolidId; view: SolidView; labels: LabelMode; name: string }) {
  const scene = useMemo(() => composeScene(solid, view, { labels }), [solid, view, labels]);
  return <svg className="lf-solid-svg" viewBox={`0 0 ${SCENE_SIZE} ${SCENE_SIZE}`} role="img" aria-label={name} focusable="false" data-copy-role="data">
    {scene.polygons.map((polygon) => <polygon key={polygon.face} className="lf-solid-face" data-shade={polygon.shade} data-curved={polygon.curved ? 'true' : 'false'}
      points={polygon.points.map((point) => `${point[0]},${point[1]}`).join(' ')} />)}
    {scene.edges.map((edge) => <line key={edge.edge} className="lf-solid-edge" data-hidden={edge.hidden ? 'true' : 'false'}
      x1={edge.from[0]} y1={edge.from[1]} x2={edge.to[0]} y2={edge.to[1]} />)}
    {scene.labels.map((label) => <text key={label.id} className="lf-solid-label" data-hidden={label.hidden ? 'true' : 'false'}
      x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central">{label.text}</text>)}
  </svg>;
}
