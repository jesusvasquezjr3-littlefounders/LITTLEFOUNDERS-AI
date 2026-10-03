import { Component, Suspense, lazy, useId, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import type { SolidId } from './model.generated';
import { ARROW_STEPS, stepView, type LabelMode, type SolidView } from './projection.generated';
import { useSolidRenderMode, type SolidRenderRequest } from './renderMode';
import { SolidSvg } from './SolidSvg';
import { solidsText, viewState } from './solidsText';
import './solids.css';

const SolidScene3D = lazy(() => import('./SolidScene3D'));

/** A WebGL failure inside the lazy scene hands the viewer to the SVG instead of blanking the board. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  componentDidCatch(): void { this.props.onError(); }
  render(): ReactNode { return this.state.failed ? null : this.props.children; }
}

export interface SolidViewerProps {
  solid: SolidId;
  view: SolidView;
  onViewChange: (view: SolidView) => void;
  labels: LabelMode;
  /** The solid's spoken name: the stage's accessible name and the first words of the status line. */
  name: string;
  /** Faces, edges and vertices in words, read by a screen reader when the stage has focus. */
  description: string;
  /** 'auto' picks 3D when it is available, cheap and allowed; 'svg' forces the fallback. */
  renderMode?: SolidRenderRequest;
  locale?: Locale;
}

/**
 * The OD-32 solids viewer: fixed views only, arrow keys and four buttons snap between them, and the SVG draws every view the 3D chunk can.
 * Other boards embed it by passing the state they own; it holds none, so a lesson can read or reset the view.
 */
export function SolidViewer({ solid, view, onViewChange, labels, name, description, renderMode = 'auto', locale = 'en-US' }: SolidViewerProps) {
  const t = solidsText(locale);
  const id = useId();
  const { mode, yieldToSvg } = useSolidRenderMode(renderMode);
  const go = (step: 'left' | 'right' | 'up' | 'down') => onViewChange(stepView(view, step));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !Object.hasOwn(ARROW_STEPS, event.key)) return;
    event.preventDefault();
    go(ARROW_STEPS[event.key]!);
  };
  const flat = <SolidSvg solid={solid} view={view} labels={labels} name={name} />;
  return <div className="lf-solid-viewer" data-render={mode}>
    <div className="lf-solid-stage" role="group" tabIndex={0} aria-label={name} aria-describedby={`${id}-description ${id}-keys`} onKeyDown={onKeyDown}>
      {mode === 'webgl'
        ? <SceneBoundary onError={yieldToSvg}>
          <Suspense fallback={flat}><SolidScene3D solid={solid} view={view} labels={labels} name={name} onYield={yieldToSvg} /></Suspense>
        </SceneBoundary>
        : flat}
    </div>
    <p id={`${id}-keys`} className="lf-solid-keys" data-copy-role="body">{t.viewerKeys}</p>
    <p id={`${id}-description`} className="lf-solid-sr" data-copy-role="data">{description}</p>
    <p className="lf-solid-readout" role="status" data-copy-role="data" data-hz-text-equivalent="">{name}. {viewState(t, view)}</p>
    <div className="lf-solid-pad" role="group" aria-label={t.viewerControls}>
      <Button size="sm" onClick={() => go('left')}>{t.turnLeft}</Button>
      <Button size="sm" onClick={() => go('right')}>{t.turnRight}</Button>
      <Button size="sm" disabled={view.pitch === 2} onClick={() => go('up')}>{t.viewHigher}</Button>
      <Button size="sm" disabled={view.pitch === 0} onClick={() => go('down')}>{t.viewLower}</Button>
    </div>
  </div>;
}
