import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { ARROW_STEPS, stepView, type SolidView } from '../solids/projection.generated';
import { spaceText, viewState } from './spaceText';
import './space2.css';

export interface TurnStageProps {
  view: SolidView;
  onViewChange: (view: SolidView) => void;
  /** The drawing's spoken name: the stage's accessible name and the first words of the status line. */
  name: string;
  /** The line under the drawing that says how to turn it (role body). */
  keys: string;
  /** The accessible name of the four turn buttons as a group (role heading copy). */
  controls: string;
  locale: Locale;
  children: ReactNode;
}

/**
 * A drawing the learner turns through the solids viewer's fixed views: arrow keys on the focused stage and four buttons snap
 * between them, one step at a time. It holds no state, so the board owns, resets and reads the view.
 */
export function TurnStage({ view, onViewChange, name, keys, controls, locale, children }: TurnStageProps) {
  const t = spaceText(locale);
  const id = useId();
  const go = (step: 'left' | 'right' | 'up' | 'down') => onViewChange(stepView(view, step));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !Object.hasOwn(ARROW_STEPS, event.key)) return;
    event.preventDefault();
    go(ARROW_STEPS[event.key]!);
  };
  return <div className="lf-s2-turn">
    <div className="lf-s2-stage" role="group" tabIndex={0} aria-label={name} aria-describedby={`${id}-keys`} onKeyDown={onKeyDown}>{children}</div>
    <p id={`${id}-keys`} className="lf-s2-keys" data-copy-role="body">{keys}</p>
    <p className="lf-s2-readout" role="status" data-copy-role="data" data-hz-text-equivalent="">{name}. {viewState(t, view)}</p>
    <div className="lf-s2-pad" role="group" aria-label={controls}>
      <Button size="sm" onClick={() => go('left')}>{t.turnLeft}</Button>
      <Button size="sm" onClick={() => go('right')}>{t.turnRight}</Button>
      <Button size="sm" disabled={view.pitch === 2} onClick={() => go('up')}>{t.viewHigher}</Button>
      <Button size="sm" disabled={view.pitch === 0} onClick={() => go('down')}>{t.viewLower}</Button>
    </div>
  </div>;
}
