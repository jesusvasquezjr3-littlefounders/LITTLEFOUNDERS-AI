import { useId, useMemo } from 'react';
import type { FaceName } from './net.generated';
import { SCENE_SIZE, composeScene, type SolidView } from './projection.generated';
import { PAIR_OF } from './netFold';
import { fill, type SolidsText } from './solidsText';

const SIDES: ReadonlyArray<{ view: SolidView; side: 'sideFrontRight' | 'sideBackLeft' }> = [
  { view: { yaw: 0, pitch: 1 }, side: 'sideFrontRight' },
  { view: { yaw: 2, pitch: 1 }, side: 'sideBackLeft' },
];

const isFace = (key: string): key is FaceName => key in PAIR_OF;

function CubeSide({ faces, view, caption }: { faces: ReadonlySet<FaceName>; view: SolidView; caption: string }) {
  const id = useId();
  const scene = useMemo(() => composeScene('cube', view), [view]);
  return <div className="lf-net-folded">
    <svg viewBox={`0 0 ${SCENE_SIZE} ${SCENE_SIZE}`} role="img" aria-labelledby={id} focusable="false" data-copy-role="data">
      {scene.polygons.map((polygon) => isFace(polygon.key)
        ? <polygon key={polygon.face} className="lf-net-face" data-covered={faces.has(polygon.key) ? 'true' : 'false'} data-pair={PAIR_OF[polygon.key]}
          points={polygon.points.map((point) => `${point[0]},${point[1]}`).join(' ')} />
        : null)}
    </svg>
    <p id={id} data-copy-role="data">{caption}</p>
  </div>;
}

/**
 * The squares laid so far on a cube, from the front right and from the back left. The bottom face is never in a corner view, so a
 * square that lands there is reported by the status line and the squares table instead.
 */
export function FoldedCube({ t, faces }: { t: SolidsText; faces: ReadonlyArray<FaceName | null> }) {
  const covered = useMemo(() => new Set(faces.filter((face): face is FaceName => face !== null)), [faces]);
  return <div className="lf-net-previews">
    <h3 data-copy-role="heading">{t.foldedHeading}</h3>
    <div className="lf-net-fold">
      {SIDES.map(({ view, side }) => <CubeSide key={side} faces={covered} view={view} caption={fill(t.foldedView, { side: t[side] })} />)}
    </div>
    <p data-copy-role="body">{t.pairsNote}</p>
  </div>;
}
