import { useState } from 'react';
import { Button } from '../../../design/controls';
import { BoardShell, GradedFoot, NumberAnswer, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { NetFigure, type FigurePanel } from './NetFigure';
import { FoldPlayer } from './FoldPlayer';
import type { Frame } from './netFrame';
import type { FoldPanel } from './polyFold';
import { POLY_LIMITS } from './polynet.generated';
import { solidsText } from './solidsText';
import '../horizonte.css';
import './solids.css';

type AreaSegment = Extract<HorizonteSegment, { type: 'geometry.cube-net.v2' | 'geometry.solid-net.v2' }>;

export interface AreaRow { number: number; shape: string; lengths: string }

/*
 * The surface-area step of a net, for the cube net and for the box, prism and pyramid nets: the learner reads the lengths printed on
 * the panels and works out the area of the whole surface. The net is drawn with its lengths and nothing else: the total is not shown
 * anywhere, and the table lists each panel's shape and lengths, never its area. The answer is { value }; Core holds the one number
 * and the browser never says met. The fold preview is free to play with and never reveals the area.
 */
export function AreaBoard({ document, segment, onBack, sequence, onGrade, screen, label, panels, frame, fold, rows }: Omit<HorizonteBoardProps, 'segment'> & {
  segment: AreaSegment; screen: string; label: string; panels: readonly FigurePanel[]; frame: Frame; fold: readonly FoldPanel[] | null; rows: readonly AreaRow[];
}) {
  const t = solidsText(document.locale);
  const [text, setText] = useState('');
  const [value, setValue] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const reset = () => { grading.reset(); setText(''); setValue(null); };

  return <BoardShell screen={screen} locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={text === '' || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={value !== null && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metArea, hint: t.hintArea }} onCheck={() => grading.check({ value })} />}>
    <section className="lf-learning-board lf-net" aria-label={label}>
      <NetFigure frame={frame} panels={panels} label={label} role="img" />
      <FoldPlayer t={t} panels={fold} />
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.areaCaption}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{t.colPanel}</th><th scope="col" data-copy-role="data">{t.colShape}</th><th scope="col" data-copy-role="data">{t.colLengths}</th>
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row.number}>
          <th scope="row" data-copy-role="data">{row.number}</th><td data-copy-role="data">{row.shape}</td><td data-copy-role="data">{row.lengths}</td>
        </tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.areaLabel}>
      <p data-copy-role="data">{t.areaUnit}</p>
      <div className="lf-solid-answer">
        <NumberAnswer label={t.areaAsk} locale={document.locale} min={1} max={POLY_LIMITS.areaMaximum} disabled={locked} value={text}
          onTextChange={(next) => { grading.reset(); setText(next); }} onChange={setValue} />
      </div>
    </section>
  </BoardShell>;
}
