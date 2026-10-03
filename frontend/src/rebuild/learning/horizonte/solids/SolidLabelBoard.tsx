import { useMemo, useState } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { NetFigure, type FigurePanel } from './NetFigure';
import { FoldPlayer } from './FoldPlayer';
import { frameOf, shapeOf } from './netFrame';
import { polyFoldPanels } from './polyFold';
import { POLY_FACES, isPolyFaceName, panelSlot, type PolyFaceName, type PolyNet, type PolySolid } from './polynet.generated';
import type { SolidLabel } from './rules.generated';
import { faceLabel, fill, lengthsLabel, polyKindLabel, shapeLabel, solidsText } from './solidsText';
import '../horizonte.css';
import './solids.css';

type SolidSegment = Extract<HorizonteSegment, { type: 'geometry.solid-net.v2' }>;
type Names = Readonly<Record<number, PolyFaceName>>;

export const FRAME_PAD = 0.8;

/*
 * F4.2, naming mode for the box, the triangular prism and the square pyramid: the net is drawn flat with the lengths on every panel and a
 * few panels already named. The learner names the rest by dragging a name onto a panel, tapping a name then a panel, or with "Move to";
 * tapping a named panel takes its name back. The lengths and the panels that touch are what tell the faces apart. The answer is the
 * name of every panel; Core holds the one correct naming, the browser never says met.
 */
export function SolidLabelBoard({ document, segment, payload, solid, net, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & {
  segment: SolidSegment; payload: SolidLabel; solid: PolySolid; net: PolyNet;
}) {
  const t = solidsText(document.locale);
  const given = useMemo<Names>(() => Object.fromEntries(payload.fixed.map((entry) => [entry.panel, entry.name])), [payload.fixed]);
  const [names, setNames] = useState<Names>(() => ({ ...given }));
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const panels = net.layout.panels;
  const named = Object.keys(names).length;
  const used = new Set(Object.values(names));
  const tray = POLY_FACES[solid.kind].filter((name) => !used.has(name));
  const changed = Object.keys(names).some((key) => !(Number(key) in given));
  const frame = useMemo(() => frameOf(panels.flatMap((panel) => panel.points), FRAME_PAD), [panels]);
  const fold = useMemo(() => polyFoldPanels(solid, net.layout), [solid, net]);
  const panelName = (index: number) => fill(t.panelN, { n: index + 1 });

  const edit = (next: Names) => { grading.reset(); setNames(next); };
  const place = (item: string, target: string) => {
    const index = Number(target.slice('panel'.length));
    if (!isPolyFaceName(item) || !Number.isInteger(index) || index < 0 || index >= panels.length || index in given) return;
    edit({ ...names, [index]: item });
  };
  const drag = useDragPlace<string>(place, locked);
  const takeBack = (index: number) => {
    if (drag.carried || locked || index in given || !(index in names)) return;
    const rest: Record<number, PolyFaceName> = { ...names };
    delete rest[index];
    edit(rest);
  };
  const reset = () => { grading.reset(); drag.clear(); setNames({ ...given }); };
  const answer = panels.map((_, index) => names[index]);
  const complete = answer.every((name): name is PolyFaceName => name !== undefined);

  const figure: FigurePanel[] = panels.map((panel, index) => {
    const face = solid.faces[panel.face]!;
    const name = names[index];
    const fixed = index in given;
    return {
      id: panelSlot(index), number: index + 1, points: panel.points, measures: face.measures, name: name ? faceLabel(t, name) : null,
      state: fixed ? 'given' : name ? 'named' : 'open',
      label: `${panelName(index)}: ${name ? faceLabel(t, name) : t.unnamed}, ${lengthsLabel(t, face)}${fixed ? `, ${t.given}` : ''}`,
      enabled: !locked && !fixed && (name !== undefined || drag.carried !== null),
      onPress: () => takeBack(index),
      target: panelSlot(index),
    };
  });

  return <BoardShell screen="solid-net" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={complete && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metSolidLabel, hint: t.hintSolidLabel }}
      onCheck={() => grading.check({ slots: Object.fromEntries(answer.map((name, index) => [panelSlot(index), [name]])) })} />}>
    <section className="lf-learning-board lf-net" aria-label={fill(t.netLabel, { solid: polyKindLabel(t, solid.kind) })}>
      <NetFigure frame={frame} panels={figure} label={fill(t.netLabel, { solid: polyKindLabel(t, solid.kind) })} role="group" drop={drag.target} />
      <p className="lf-solid-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{fill(t.namedOf, { n: named, total: panels.length })}</p>
      <FoldPlayer t={t} panels={fold} />
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.labelCaption}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{t.colPanel}</th><th scope="col" data-copy-role="data">{t.colShape}</th>
          <th scope="col" data-copy-role="data">{t.colLengths}</th><th scope="col" data-copy-role="data">{t.colName}</th>
        </tr></thead>
        <tbody>{panels.map((panel, index) => {
          const face = solid.faces[panel.face]!;
          const name = names[index];
          return <tr key={index}>
            <th scope="row" data-copy-role="data">{index + 1}</th><td data-copy-role="data">{shapeLabel(t, shapeOf(face))}</td><td data-copy-role="data">{lengthsLabel(t, face)}</td>
            <td data-copy-role="data">{name ? `${faceLabel(t, name)}${index in given ? ` (${t.given})` : ''}` : t.unnamed}</td>
          </tr>;
        })}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.facesHeading}>
      <h2 data-copy-role="heading">{t.facesHeading}</h2>
      <p data-copy-role="body">{t.placePanelHint}</p>
      <div className="lf-net-tray">
        {tray.map((name) => <span key={name} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
          <ChoiceChip {...drag.chip(name)} disabled={locked}>{faceLabel(t, name)}</ChoiceChip>
        </span>)}
      </div>
      <MoveToChoice locale={document.locale} item={drag.carried && isPolyFaceName(drag.carried) ? { label: faceLabel(t, drag.carried) } : null}
        options={panels.flatMap((_, index) => (index in given || index in names ? [] : [{ value: panelSlot(index), label: panelName(index) }]))} disabled={locked}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}
