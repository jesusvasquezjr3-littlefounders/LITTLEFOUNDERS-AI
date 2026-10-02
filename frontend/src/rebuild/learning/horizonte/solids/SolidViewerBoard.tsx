import { useMemo, useState } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, NumberAnswer, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { SolidViewer } from './SolidViewer';
import { describeSolid, type SolidId } from './model.generated';
import { DEFAULT_VIEW, LABEL_MODES, type LabelMode, type SolidView } from './projection.generated';
import { VIEWER_COUNT_LIMIT, readViewerPayload, type ViewerPayload } from './rules.generated';
import { fill, solidLabel, solidsText } from './solidsText';
import '../horizonte.css';
import './solids.css';

type ViewerSegment = Extract<HorizonteSegment, { type: 'geometry.solid-viewer.v2' }>;

/*
 * F4.1: turn the solids through fixed views, label their faces, edges or vertices, choose the one with the searched
 * count, then count something else on it. The viewed solid and the chosen solid are separate on purpose: looking is free.
 * The answer is { solid, count }; Core holds the target and the browser never says met.
 */
function SolidViewerBoardView({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: ViewerSegment; payload: ViewerPayload }) {
  const t = solidsText(document.locale);
  const first = payload.solids[0]!;
  const [viewed, setViewed] = useState<SolidId>(first);
  const [view, setView] = useState<SolidView>(DEFAULT_VIEW);
  const [labels, setLabels] = useState<LabelMode>('none');
  const [chosen, setChosen] = useState<SolidId | null>(null);
  const [text, setText] = useState('');
  const [count, setCount] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const facts = useMemo(() => describeSolid(viewed), [viewed]);
  const changed = chosen !== null || text !== '' || viewed !== first || labels !== 'none' || view.yaw !== DEFAULT_VIEW.yaw || view.pitch !== DEFAULT_VIEW.pitch;
  const edit = <T,>(set: (value: T) => void) => (value: T) => { grading.reset(); set(value); };
  const labelOf: Record<LabelMode, string> = { none: t.optLabelsNone, faces: t.optFaces, edges: t.optEdges, vertices: t.optVertices };
  const countLabel = { faces: t.countFaces, edges: t.countEdges, vertices: t.countVertices }[payload.report];
  const rows: ReadonlyArray<readonly [string, number]> = [
    [t.factFaces, facts.faces], [t.factFlat, facts.flatFaces], [t.factCurvedFaces, facts.curvedFaces],
    [t.factEdges, facts.edges], [t.factStraight, facts.straightEdges], [t.factCurvedEdges, facts.curvedEdges], [t.factVertices, facts.vertices],
  ];
  const description = `${t.factFaces}: ${facts.faces}. ${t.factEdges}: ${facts.edges}. ${t.factVertices}: ${facts.vertices}.`;
  const reset = () => { grading.reset(); setViewed(first); setView(DEFAULT_VIEW); setLabels('none'); setChosen(null); setText(''); setCount(null); };

  return <BoardShell screen="solid-viewer" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={chosen !== null && count !== null && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metViewer, hint: t.hintViewer }} onCheck={() => grading.check({ solid: chosen, count })} />}>
    <section className="lf-learning-board lf-solid-board">
      <SolidViewer solid={viewed} view={view} onViewChange={edit(setView)} labels={labels} name={solidLabel(t, viewed)} description={description} locale={document.locale} />
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.factsCaption} <span data-copy-role="data">({solidLabel(t, viewed)})</span></caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colFact}</th><th scope="col" data-copy-role="data">{t.colCount}</th></tr></thead>
        <tbody>{rows.map(([name, value]) => <tr key={name}><th scope="row" data-copy-role="data">{name}</th><td data-copy-role="data">{value}</td></tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.solidsHeading}>
      <h2 data-copy-role="heading">{t.solidsHeading}</h2>
      <div className="lf-solid-picker">
        {payload.solids.map((solid) => <ChoiceChip key={solid} selected={viewed === solid} disabled={locked} onToggle={() => edit(setViewed)(solid)}>{solidLabel(t, solid)}</ChoiceChip>)}
      </div>
      <h2 data-copy-role="heading">{t.labelsHeading}</h2>
      <div className="lf-solid-picker">
        {LABEL_MODES.map((mode) => <ChoiceChip key={mode} selected={labels === mode} onToggle={() => setLabels(mode)}>{labelOf[mode]}</ChoiceChip>)}
      </div>
      <div className="lf-solid-answer">
        <Button size="sm" disabled={locked} onClick={() => edit(setChosen)(viewed)}>{t.chooseThis}</Button>
        <p className="lf-solid-status" role="status" data-copy-role="data">{chosen === null ? t.chosenNone : fill(t.chosen, { solid: solidLabel(t, chosen) })}</p>
        <NumberAnswer label={countLabel} locale={document.locale} whole min={0} max={VIEWER_COUNT_LIMIT} disabled={locked} value={text}
          onTextChange={(next) => { grading.reset(); setText(next); }} onChange={setCount} />
      </div>
    </section>
  </BoardShell>;
}

export default function SolidViewerBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'geometry.solid-viewer.v2') return null;
  const payload = readViewerPayload(segment.payload);
  return payload ? <SolidViewerBoardView segment={segment} payload={payload} {...rest} /> : null;
}
