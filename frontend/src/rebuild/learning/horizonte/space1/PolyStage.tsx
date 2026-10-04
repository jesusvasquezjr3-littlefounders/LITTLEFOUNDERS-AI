import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { ARROW_STEPS, SCENE_SIZE, stepView, type SolidView } from '../solids/projection.generated';
import type { PolyScene } from './polyhedra.generated';
import { space1Text, viewState } from './space1Text';
import '../horizonte.css';
import './space1.css';

const points = (list: ReadonlyArray<readonly [number, number]>): string => list.map((point) => `${point[0]},${point[1]}`).join(' ');

/** The lit faces of a solid, shaded from the light in the scene; the faces facing away are not drawn. */
export function PolyFaces({ scene, tone = 'solid' }: { scene: PolyScene; tone?: 'solid' | 'ghost' }) {
  return <>{scene.polygons.map((polygon) => <polygon key={polygon.face} className="lf-poly-face" data-shade={polygon.shade} data-tone={tone} data-curved={scene.curved ? 'true' : 'false'} points={points(polygon.points)} />)}</>;
}

/** Every edge, the ones behind the solid dashed. `frame` draws a solid that is only an outline. */
export function PolyEdges({ scene, tone = 'solid' }: { scene: PolyScene; tone?: 'solid' | 'frame' }) {
  return <>{scene.edges.map((edge, index) => <line key={index} className="lf-poly-edge" data-hidden={edge.hidden ? 'true' : 'false'} data-tone={tone}
    x1={edge.from[0]} y1={edge.from[1]} x2={edge.to[0]} y2={edge.to[1]} />)}</>;
}

/** The cutting plane as a dashed square about the solid, so a plane that has slid clear of the solid can still be seen. */
export function PolySheet({ scene }: { scene: PolyScene }) {
  return scene.sheet ? <polygon className="lf-poly-sheet" points={points(scene.sheet)} /> : null;
}

/** The plane's cut over the faces and under the edges: a filled polygon whose sides on faces turned away from the viewer are dashed. */
export function PolyCut({ scene }: { scene: PolyScene }) {
  const cut = scene.cut;
  if (!cut) return null;
  return <g>
    <polygon className="lf-poly-cut-fill" points={points(cut.points)} />
    {cut.points.map((from, index) => {
      const to = cut.points[(index + 1) % cut.points.length]!;
      return <line key={index} className="lf-poly-cut-edge" data-hidden={cut.hiddenEdges[index] ? 'true' : 'false'} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />;
    })}
  </g>;
}

/**
 * A solid in one of twelve fixed views (four turns at three heights): arrow keys and four buttons step between them, the same
 * model as the solids viewer, drawn as SVG only. The board owns the view and the drawing; this owns the frame, the keys and the
 * words a screen reader gets when the stage has focus.
 */
export function PolyStage({ name, description, view, onViewChange, locale, children }: {
  name: string; description: string; view: SolidView; onViewChange: (view: SolidView) => void; locale: Locale; children: ReactNode;
}) {
  const t = space1Text(locale);
  const id = useId();
  const go = (step: 'left' | 'right' | 'up' | 'down') => onViewChange(stepView(view, step));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !Object.hasOwn(ARROW_STEPS, event.key)) return;
    event.preventDefault();
    go(ARROW_STEPS[event.key]!);
  };
  return <div className="lf-poly">
    <div className="lf-poly-stage" role="group" tabIndex={0} aria-label={name} aria-describedby={`${id}-description ${id}-keys`} onKeyDown={onKeyDown}>
      <svg className="lf-poly-svg" viewBox={`0 0 ${SCENE_SIZE} ${SCENE_SIZE}`} role="img" aria-label={name} focusable="false" data-copy-role="data">{children}</svg>
    </div>
    <p id={`${id}-description`} className="lf-sp-sr" data-copy-role="data">{description}</p>
    <p id={`${id}-keys`} className="lf-poly-keys" data-copy-role="body">{t.stageKeys}</p>
    <p className="lf-poly-readout" role="status" data-copy-role="data">{name}. {viewState(t, view)}</p>
    <div className="lf-poly-pad" role="group" aria-label={t.stageHeading}>
      <Button size="sm" onClick={() => go('left')}>{t.turnLeft}</Button>
      <Button size="sm" onClick={() => go('right')}>{t.turnRight}</Button>
      <Button size="sm" disabled={view.pitch === 2} onClick={() => go('up')}>{t.viewHigher}</Button>
      <Button size="sm" disabled={view.pitch === 0} onClick={() => go('down')}>{t.viewLower}</Button>
    </div>
  </div>;
}
