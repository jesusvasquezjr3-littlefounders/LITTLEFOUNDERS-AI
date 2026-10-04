import { useMemo, useState, type CSSProperties } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { FoldPlayer } from './FoldPlayer';
import { FACE_NAMES, isFaceName, netBounds, netSlotId, type FaceName } from './net.generated';
import { cellFoldPanels } from './polyFold';
import { fixedNames, type LabelNet } from './rules.generated';
import { faceLabel, fill, solidsText } from './solidsText';
import '../horizonte.css';
import './solids.css';

type NetSegment = Extract<HorizonteSegment, { type: 'geometry.cube-net.v2' }>;
type Names = Readonly<Record<number, FaceName>>;

/*
 * F4.2, naming mode: six squares laid out as a net, a few already named. The learner names the rest by dragging a name chip onto a
 * square, tapping a chip then a square, or with "Move to"; tapping a named square takes its name back. The answer is the name of
 * every square; Core holds the one correct naming, the browser never says met.
 */
export function NetLabelBoard({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: NetSegment; payload: LabelNet }) {
  const t = solidsText(document.locale);
  const given = fixedNames(payload.fixed);
  const [names, setNames] = useState<Names>(() => ({ ...given }));
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const { cols } = netBounds(payload.cells);
  const fold = useMemo(() => cellFoldPanels(payload.cells, payload.edge), [payload.cells, payload.edge]);
  const named = Object.keys(names).length;
  const used = new Set(Object.values(names));
  const tray = FACE_NAMES.filter((name) => !used.has(name));
  const changed = Object.keys(names).some((key) => !(key in given));
  const squareName = (index: number) => fill(t.squareN, { n: index + 1 });

  const edit = (next: Names) => { grading.reset(); setNames(next); };
  const place = (item: string, target: string) => {
    const index = Number(target.slice('cell'.length));
    if (!isFaceName(item) || !Number.isInteger(index) || index in given) return;
    edit({ ...names, [index]: item });
  };
  const drag = useDragPlace<string>(place, locked);
  const takeBack = (index: number) => {
    if (drag.carried || locked || index in given || !(index in names)) return;
    const rest: Record<number, FaceName> = { ...names };
    delete rest[index];
    edit(rest);
  };
  const reset = () => { grading.reset(); drag.clear(); setNames({ ...given }); };
  const answer = payload.cells.map((_, index) => names[index]);
  const complete = answer.every((name): name is FaceName => name !== undefined);

  return <BoardShell screen="cube-net" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={complete && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metNetLabel, hint: t.hintNetLabel }}
      onCheck={() => grading.check({ slots: Object.fromEntries(answer.map((name, index) => [netSlotId(index), [name]])) })} />}>
    <section className="lf-learning-board lf-net" aria-label={t.gridName}>
      <div className="lf-net-grid" role="group" aria-label={t.gridName} style={{ '--cols': cols } as CSSProperties}>
        {payload.cells.map(([col, row], index) => {
          const name = names[index];
          const fixed = index in given;
          const label = `${squareName(index)}: ${name ? faceLabel(t, name) : t.unnamed}${fixed ? `, ${t.given}` : ''}`;
          return <div key={index} className="lf-net-cell" style={{ gridColumn: col + 1, gridRow: row + 1 }} {...drag.target(netSlotId(index))}>
            <button type="button" className="lf-net-square" data-state={fixed ? 'given' : 'square'} data-copy-role="data" aria-label={label}
              aria-disabled={locked || fixed || (name === undefined && !drag.carried)} onClick={() => takeBack(index)}>
              <span className="lf-net-tag" data-copy-role="data">{index + 1}</span>
              {name ? <span className="lf-net-name" data-copy-role="data">{faceLabel(t, name)}</span> : null}
            </button>
          </div>;
        })}
      </div>
      <p className="lf-solid-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{fill(t.namedCount, { n: named })}</p>
      <FoldPlayer t={t} panels={fold} />
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.netCaption}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{t.colSquare}</th><th scope="col" data-copy-role="data">{t.colColumn}</th>
          <th scope="col" data-copy-role="data">{t.colRow}</th><th scope="col" data-copy-role="data">{t.colName}</th>
        </tr></thead>
        <tbody>{payload.cells.map(([col, row], index) => {
          const name = names[index];
          return <tr key={index}>
            <th scope="row" data-copy-role="data">{index + 1}</th><td data-copy-role="data">{col + 1}</td><td data-copy-role="data">{row + 1}</td>
            <td data-copy-role="data">{name ? `${faceLabel(t, name)}${index in given ? ` (${t.given})` : ''}` : t.unnamed}</td>
          </tr>;
        })}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.facesHeading}>
      <h2 data-copy-role="heading">{t.facesHeading}</h2>
      <p data-copy-role="body">{t.placeHint}</p>
      <div className="lf-net-tray">
        {tray.map((name) => <span key={name} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
          <ChoiceChip {...drag.chip(name)} disabled={locked}>{faceLabel(t, name)}</ChoiceChip>
        </span>)}
      </div>
      <MoveToChoice locale={document.locale} item={drag.carried && isFaceName(drag.carried) ? { label: faceLabel(t, drag.carried) } : null}
        options={payload.cells.flatMap((_, index) => (index in given ? [] : [{ value: netSlotId(index), label: squareName(index) }]))} disabled={locked}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}
