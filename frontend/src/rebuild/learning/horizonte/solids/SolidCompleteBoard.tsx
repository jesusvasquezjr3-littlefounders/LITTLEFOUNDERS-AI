import { useMemo, useState } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { Prose } from '../Prose';
import { NetFigure, type FigureHinge, type FigurePanel } from './NetFigure';
import { FoldPlayer } from './FoldPlayer';
import { frameOf, type Frame } from './netFrame';
import { polyFoldPanels } from './polyFold';
import {
  attach, completionsOf, faceIndex, fitsSheet, hingeSlot, hingesToSlots, isPolyFaceName, layoutBounds, layoutExtent, unfold,
  type Hinge, type Layout, type PolySolid,
} from './polynet.generated';
import { givenHinges, type SolidComplete } from './rules.generated';
import { faceLabel, fill, lengthsLabel, polyKindLabel, solidsText } from './solidsText';
import '../horizonte.css';
import './solids.css';

type SolidSegment = Extract<HorizonteSegment, { type: 'geometry.solid-net.v2' }>;

const PAD = 0.8;
const tidy = (value: number): number => Math.round(value * 100) / 100;

/** The panels and the sheet must stay inside the window in every state of the board, so it is sized from every net the given hinges can still become. */
function windowOf(solid: PolySolid, root: number, given: readonly Hinge[], sheet: { width: number; height: number }, current: Layout): Frame {
  const layouts = completionsOf(solid, root, given, null, 5000).sets.map((hinges) => unfold(solid, root, hinges)).filter((layout): layout is Layout => layout !== null);
  const points = [...layouts, current].flatMap((layout) => layout.panels.flatMap((panel) => panel.points));
  const base = frameOf(points, PAD);
  const start = layoutBounds(unfold(solid, root, attach(root, given).ordered) ?? current);
  const right = Math.max(base.x + base.width, start.minX + sheet.width + PAD);
  const bottom = Math.max(base.y + base.height, -start.maxY + sheet.height + PAD);
  return { x: base.x, y: base.y, width: right - base.x, height: bottom - base.y };
}

/** The face hanging from `face` and everything that hangs from those, so taking one back leaves no panel floating. */
function withDescendants(hinges: readonly Hinge[], face: number): Set<number> {
  const gone = new Set<number>([face]);
  for (let grew = true; grew;) {
    grew = false;
    for (const hinge of hinges) if (gone.has(hinge.parent) && !gone.has(hinge.child)) { gone.add(hinge.child); grew = true; }
  }
  return gone;
}

/*
 * F4.2, completion mode for the box, the triangular prism and the square pyramid: a few faces are already joined to the root and the
 * learner joins the rest, one face at a time, so the net folds into the solid and fits the sheet. A face is picked (tap, drag or the
 * Move to menu) and then hung on an edge of a face already in the net; the net unfolds as it grows and the fold preview shows it
 * closing. Tapping a face the learner added takes it back with everything that hangs from it. Core decides whether the net is
 * complete and fits; the browser only shows how big it is next to the sheet.
 */
export function SolidCompleteBoard({ document, segment, payload, solid, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & {
  segment: SolidSegment; payload: SolidComplete; solid: PolySolid;
}) {
  const t = solidsText(document.locale);
  const given = useMemo(() => givenHinges(payload), [payload]);
  const root = given?.root ?? 0;
  const fixed = useMemo<Hinge[]>(() => given?.hinges ?? [], [given]);
  const base = useMemo(() => attach(root, fixed).ordered, [root, fixed]);
  const [added, setAdded] = useState<readonly Hinge[]>([]);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const hinges = useMemo(() => [...base, ...added], [base, added]);
  const layout = useMemo(() => unfold(solid, root, hinges) ?? unfold(solid, root, [])!, [solid, root, hinges]);
  const frame = useMemo(() => windowOf(solid, root, fixed, payload.sheet, layout), [solid, root, fixed, payload.sheet, layout]);
  const fold = useMemo(() => polyFoldPanels(solid, layout), [solid, layout]);
  const placed = new Set(layout.panels.map((panel) => panel.face));
  const total = solid.faces.length;
  const fits = fitsSheet(layout, payload.sheet);
  const extent = layoutExtent(layout);
  const box = layoutBounds(layout);
  const givenFaces = new Set<number>([root, ...base.map((hinge) => hinge.child)]);
  const name = (face: number) => faceLabel(t, solid.faces[face]!.name);
  const tray = solid.faces.flatMap((face, index) => (placed.has(index) ? [] : [{ index, name: face.name }]));

  const edit = (next: readonly Hinge[]) => { grading.reset(); setAdded(next); };
  const carriedFace = (carried: string | null): number => (carried !== null && isPolyFaceName(carried) ? faceIndex(solid, carried) : -1);

  const place = (item: string, target: string) => {
    const child = carriedFace(item);
    const edge = solid.edges.find((entry) => hingeSlot(solid, entry) === target);
    if (locked || child < 0 || !edge || !edge.faces.includes(child) || placed.has(child)) return;
    const parent = edge.faces[0] === child ? edge.faces[1] : edge.faces[0];
    if (!placed.has(parent)) return;
    edit([...added, { parent, child }]);
  };
  const drag = useDragPlace<string>(place, locked);
  const takeBack = (face: number) => {
    if (drag.carried || locked || givenFaces.has(face)) return;
    const gone = withDescendants(added, face);
    edit(added.filter((hinge) => !gone.has(hinge.child)));
  };
  const reset = () => { grading.reset(); drag.clear(); setAdded([]); };

  const carried = carriedFace(drag.carried);
  /** The edges a carried face can hang from: each one is an edge of the carried face shared with a face already in the net. */
  const targets = carried < 0 || placed.has(carried) ? [] : solid.edges.flatMap((edge) => {
    if (!edge.faces.includes(carried)) return [];
    const parent = edge.faces[0] === carried ? edge.faces[1] : edge.faces[0];
    const panel = layout.panels.find((entry) => entry.face === parent);
    if (!panel) return [];
    const parentFace = solid.faces[parent]!;
    const [from, to] = [panel.points[parentFace.vertices.indexOf(edge.vertices[0])], panel.points[parentFace.vertices.indexOf(edge.vertices[1])]];
    return from && to ? [{ id: hingeSlot(solid, edge), parent, from, to }] : [];
  });

  const figure: FigurePanel[] = layout.panels.map((panel, index) => {
    const face = solid.faces[panel.face]!;
    const fixedFace = givenFaces.has(panel.face);
    return {
      id: `face${panel.face}`, number: index + 1, points: panel.points, measures: face.measures, name: faceLabel(t, face.name),
      state: fixedFace ? 'given' : 'added',
      label: `${faceLabel(t, face.name)}, ${lengthsLabel(t, face)}, ${fixedFace ? t.given : t.takeBack}`,
      enabled: !locked && !fixedFace && drag.carried === null,
      onPress: () => takeBack(panel.face),
    };
  });
  const marks: FigureHinge[] = targets.map((target) => ({
    id: target.id, from: [target.from[0], -target.from[1]], to: [target.to[0], -target.to[1]],
    label: `${faceLabel(t, solid.faces[carried]!.name)}, ${fill(t.joinTo, { parent: name(target.parent) })}`,
  }));
  const sheetBox = { x: box.minX, y: -box.maxY, width: payload.sheet.width, height: payload.sheet.height };
  const sheetText = fill(t.sheetSize, { w: payload.sheet.width, h: payload.sheet.height });
  const status = `${fill(t.joinedOf, { n: placed.size, total })}. ${fill(t.netSize, { w: tidy(extent.width), h: tidy(extent.height) })}. ${sheetText}.`;
  const kind = polyKindLabel(t, solid.kind);

  return <BoardShell screen="solid-net" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={added.length === 0 || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={placed.size === total && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metSolidComplete, hint: t.hintSolidComplete }}
      onCheck={() => grading.check({ slots: hingesToSlots(solid, hinges) })} />}>
    <section className="lf-learning-board lf-net" aria-label={fill(t.netLabel, { solid: kind })}>
      <NetFigure frame={frame} panels={figure} hinges={marks} sheet={sheetBox} label={fill(t.netLabel, { solid: kind })} role="group" drop={drag.target} />
      <p className="lf-solid-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status} <Prose>{fits ? t.sheetFits : t.sheetTooBig}</Prose></p>
      <FoldPlayer t={t} panels={fold} />
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.joinCaption}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{t.colFace}</th><th scope="col" data-copy-role="data">{t.colJoined}</th><th scope="col" data-copy-role="data">{t.colLengths}</th>
        </tr></thead>
        <tbody>{solid.faces.map((face, index) => {
          const panel = layout.panels.find((entry) => entry.face === index);
          const parent = panel && panel.parent !== null ? layout.panels[panel.parent]!.face : null;
          return <tr key={face.name}>
            <th scope="row" data-copy-role="data">{faceLabel(t, face.name)}{givenFaces.has(index) ? ` (${t.given})` : ''}</th>
            <td data-copy-role="data">{!panel ? t.notJoined : parent === null ? t.firstFace : name(parent)}</td>
            <td data-copy-role="data">{lengthsLabel(t, face)}</td>
          </tr>;
        })}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.joinHeading}>
      <h2 data-copy-role="heading">{t.joinHeading}</h2>
      <p data-copy-role="body">{t.joinHint}</p>
      <div className="lf-net-tray">
        {tray.map((face) => <span key={face.name} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
          <ChoiceChip {...drag.chip(face.name)} disabled={locked}>{`${faceLabel(t, face.name)}: ${lengthsLabel(t, solid.faces[face.index]!)}`}</ChoiceChip>
        </span>)}
      </div>
      <MoveToChoice locale={document.locale} item={carried >= 0 ? { label: name(carried) } : null} disabled={locked}
        options={targets.map((target) => ({ value: target.id, label: fill(t.joinTo, { parent: name(target.parent) }) }))}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}
