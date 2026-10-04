import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { MathExpression } from '../../pizarron/MathExpression';
import { BoardShell, GradedFoot, MoveToChoice, NumberAnswer, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { Prose } from '../Prose';
import { DEFAULT_VIEW, type SolidView } from '../solids/projection.generated';
import { cutState, cutText, directionText, cylinderDirection } from './cutFacts';
import { PolyCut, PolyEdges, PolyFaces, PolySheet, PolyStage } from './PolyStage';
import {
  COUNT_NAMES, CYLINDER, EULER_COUNTS, OFFSET_UNIT, composePolyScene, coneMesh, cylinderMesh, cylinderVolume, eulerMesh, eulerSum, lensFor, planeCrossings,
  prismMesh, prismVolume, pyramidMesh, sectionSolidMesh, slideRange, type CountName, type SectionShape,
} from './polyhedra.generated';
import {
  VOLUME_BOUNDS, eulerBounds, readSolidSectionPayload, type ConePayload, type EulerPayload, type SectionPayload, type SlidePayload, type SolidSectionPayload, type VolumePayload,
} from './sectionRules.generated';
import { askName, countName, fill, shapeName, solidName, space1Text } from './space1Text';
import { TableScroll } from './TableScroll';
import '../horizonte.css';
import './space1.css';

type SectionSegment = Extract<HorizonteSegment, { type: 'geometry.solid-section.v2' }>;

const RULE = 'V - E + F = 2';
const PAGE = OFFSET_UNIT;

/** A two-column text equivalent of what the stage draws, inside its own scrolling region so it never widens the page. */
function FactTable({ locale, caption, labelHead, valueHead, rows, current }: {
  locale: Locale; caption: string; labelHead?: string; valueHead: string; rows: ReadonlyArray<readonly [string, string | number]>; current?: number;
}) {
  const t = space1Text(locale);
  return <TableScroll label={caption}><table className="lf-hz-table" data-hz-table="">
    <caption data-copy-role="heading">{caption}</caption>
    <thead><tr><th scope="col" data-copy-role="data">{labelHead ?? t.colFact}</th><th scope="col" data-copy-role="data">{valueHead}</th></tr></thead>
    <tbody>{rows.map(([label, value], at) => <tr key={`${label}-${at}`} aria-current={at === current ? 'true' : undefined}>
      <th scope="row" data-copy-role="data">{label}</th><td data-copy-role="data">{value}</td>
    </tr>)}</tbody>
  </table></TableScroll>;
}

/*
 * F4.5: five questions about solids drawn in twelve fixed views. A plane cuts a solid (a tetrahedron, a cube, an octahedron or
 * a cylinder) and the learner names the shape of the cut; or slides the plane along its normal to make a named shape; or a
 * Platonic or Archimedean solid shows two of its three counts and the learner finds the third from V - E + F = 2; or a pyramid
 * sits in a prism, or a cone in a cylinder, of the same base and height and the learner gives its volume. The board draws only
 * what the solid is: the cut is the plane's section, never a hint at the answer. Core holds the key; the browser never says met.
 */
function SolidSection({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: SectionSegment; payload: SolidSectionPayload }) {
  const locale = document.locale;
  const t = space1Text(locale);
  const start = payload.mode === 'slide' ? payload.start : 0;
  const [view, setView] = useState<SolidView>(DEFAULT_VIEW);
  const [pick, setPick] = useState<'' | SectionShape>('');
  const [text, setText] = useState('');
  const [value, setValue] = useState<string | null>(null);
  const [offset, setOffset] = useState(start);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = pick !== '' || text !== '' || offset !== start || view.yaw !== DEFAULT_VIEW.yaw || view.pitch !== DEFAULT_VIEW.pitch;

  const reset = () => { grading.reset(); setView(DEFAULT_VIEW); setPick(''); setText(''); setOffset(start); };
  const choose = (shape: SectionShape) => { grading.reset(); setPick((current) => (current === shape ? '' : shape)); };
  const typeText = (next: string) => { grading.reset(); setText(next); };
  const slideTo = (next: number) => { if (next !== offset) { grading.reset(); setOffset(next); } };

  const answer = payload.mode === 'section' ? { pick } : payload.mode === 'slide' ? { offset } : { value: value ?? '' };
  const ready = payload.mode === 'section' ? pick !== '' : payload.mode === 'slide' ? offset !== start : value !== null;
  const named = payload.mode === 'section' ? { met: t.metSection, hint: t.hintSection }
    : payload.mode === 'slide' ? { met: t.metSlide, hint: t.hintSlide }
      : payload.mode === 'euler' ? { met: t.metEuler, hint: t.hintEuler }
        : payload.mode === 'cone' ? { met: t.metCone, hint: t.hintCone } : { met: t.metVolume, hint: t.hintVolume };
  const numberProps = { view, onView: setView, text, onText: typeText, onValue: setValue, locked, table, locale };

  return <BoardShell screen="solid-section" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={ready && !locked} sequence={sequence} feedback={segment.feedback}
      named={named} onCheck={() => grading.check(answer)} />}>
    {payload.mode === 'section' ? <SectionView payload={payload} view={view} onView={setView} pick={pick} onPick={choose} locked={locked} table={table} locale={locale} />
      : payload.mode === 'slide' ? <SlideView payload={payload} view={view} onView={setView} offset={offset} onOffset={slideTo} locked={locked} table={table} locale={locale} />
        : payload.mode === 'euler' ? <EulerView payload={payload} {...numberProps} />
          : payload.mode === 'cone' ? <ConeView payload={payload} {...numberProps} />
            : <VolumeView payload={payload} {...numberProps} />}
  </BoardShell>;
}

function SectionView({ payload, view, onView, pick, onPick, locked, table, locale }: {
  payload: SectionPayload; view: SolidView; onView: (view: SolidView) => void; pick: '' | SectionShape; onPick: (shape: SectionShape) => void;
  locked: boolean; table: boolean; locale: Locale;
}) {
  const t = space1Text(locale);
  const round = payload.solid === 'cylinder';
  const mesh = useMemo(() => sectionSolidMesh(payload.solid), [payload.solid]);
  const scene = useMemo(() => composePolyScene(mesh, view, { plane: payload.plane }), [mesh, view, payload.plane]);
  const crossing = useMemo(() => planeCrossings(mesh, payload.plane), [mesh, payload.plane]);
  const counts = round ? null : EULER_COUNTS[payload.solid as Exclude<SectionPayload['solid'], 'cylinder'>];
  const facts = counts ? fill(t.solidFacts, { faces: counts.faces, edges: counts.edges, vertices: counts.vertices }) : t.solidFactsCylinder;
  const crossed = round ? directionText(t, cylinderDirection(payload.plane.normal)) : fill(t.secCrossing, { n: crossing.insideEdges.length });
  const chosen = pick === '' ? t.secChosenNone : fill(t.secChosen, { shape: shapeName(t, pick) });
  const number = new Intl.NumberFormat(locale);
  const rows: [string, string | number][] = round
    ? [
      [t.cylFactSize, `${number.format(CYLINDER.radius)}, ${number.format(CYLINDER.half * 2)}`],
      [t.cylFactNormal, payload.plane.normal.join(', ')],
      [t.cylFactPosition, number.format(payload.plane.offset / OFFSET_UNIT)],
    ]
    : [
      [t.secFactEdges, crossing.insideEdges.length], [t.secFactCorners, crossing.onCorners.length],
      [t.secFactAbove, crossing.sides.above], [t.secFactBelow, crossing.sides.below],
    ];
  return <>
    <section className="lf-learning-board lf-sec" aria-label={solidName(t, payload.solid)}>
      <PolyStage name={solidName(t, payload.solid)} description={`${facts}. ${crossed}`} view={view} onViewChange={onView} locale={locale}>
        <PolyFaces scene={scene} tone="ghost" />
        <PolyCut scene={scene} />
        <PolyEdges scene={scene} />
      </PolyStage>
      <p data-copy-role="body">{t.secCutNote}</p>
      <p className="lf-sec-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{round ? <Prose>{crossed}</Prose> : crossed} {chosen}</p>
      {table ? <FactTable locale={locale} caption={t.secTableCaption} valueHead={round ? t.colValue : t.colCount} rows={rows} /> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.secOptionsHeading}>
      <h2 data-copy-role="heading">{t.secOptionsHeading}</h2>
      <div className="lf-sec-options">
        {payload.options.map((shape) => <ChoiceChip key={shape} selected={pick === shape} onToggle={() => { if (!locked) onPick(shape); }} disabled={locked}>{shapeName(t, shape)}</ChoiceChip>)}
      </div>
    </section>
  </>;
}

/** The plane slides along its normal on a slider with a keyboard alternative; the board shows the cut at every position and never says which is right. */
function SlideView({ payload, view, onView, offset, onOffset, locked, table, locale }: {
  payload: SlidePayload; view: SolidView; onView: (view: SolidView) => void; offset: number; onOffset: (offset: number) => void; locked: boolean; table: boolean; locale: Locale;
}) {
  const t = space1Text(locale);
  const mesh = useMemo(() => sectionSolidMesh(payload.solid), [payload.solid]);
  const { min, max } = useMemo(() => slideRange(payload.solid, payload.normal), [payload.solid, payload.normal]);
  const plane = useMemo(() => ({ normal: payload.normal, offset }), [payload.normal, offset]);
  const scene = useMemo(() => composePolyScene(mesh, view, { plane, sheet: true }), [mesh, view, plane]);
  const cut = cutState(payload.solid, plane);
  const state = cutText(t, cut);
  const position = fill(t.slideStatus, { n: offset });
  const status = `${position} ${state}`;
  const positions = useMemo(() => Array.from({ length: max - min + 1 }, (_, at) => min + at), [min, max]);
  const rows = useMemo(() => positions.map((at) => [fill(t.slideValue, { n: at }), cutText(t, cutState(payload.solid, { normal: payload.normal, offset: at }))] as const), [positions, payload.solid, payload.normal, t]);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const span = Math.max(max - min, 1);
  const clamp = (value: number) => Math.min(Math.max(value, min), max);
  const label = solidName(t, payload.solid);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (locked || event.altKey || event.ctrlKey || event.metaKey) return;
    const next = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? offset + 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? offset - 1
        : event.key === 'PageUp' ? offset + PAGE : event.key === 'PageDown' ? offset - PAGE
          : event.key === 'Home' ? min : event.key === 'End' ? max : null;
    if (next === null) return;
    event.preventDefault();
    onOffset(clamp(next));
  };
  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    onOffset(clamp(min + Math.round(Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1) * span)));
  };

  return <>
    <section className="lf-learning-board lf-sec lf-slide" aria-label={label}>
      <p data-copy-role="body">{fill(t.slideGoal, { shape: shapeName(t, payload.target) })}</p>
      <PolyStage name={label} description={status} view={view} onViewChange={onView} locale={locale}>
        <PolyFaces scene={scene} tone="ghost" />
        <PolyCut scene={scene} />
        <PolyEdges scene={scene} />
        <PolySheet scene={scene} />
      </PolyStage>
      <p data-copy-role="body">{t.slideNote}</p>
      <p className="lf-slide-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{position} {cut.kind === 'sides' ? state : <Prose>{state}</Prose>}</p>
      {table ? <FactTable locale={locale} caption={t.slideTableCaption} labelHead={t.slideColPosition} valueHead={t.slideColCut} rows={rows} current={positions.indexOf(offset)} /> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.slideHeading}>
      <h2 data-copy-role="heading">{t.slideHeading}</h2>
      <div className="lf-slide-track" ref={track} data-offset={offset}
        onPointerDown={(event) => { if (locked) return; dragging.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); follow(event); }}
        onPointerMove={(event) => { if (dragging.current) follow(event); }}
        onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
        <svg className="lf-slide-rail" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <line className="lf-slide-rail-line" x1="0" y1="4" x2="100" y2="4" />
          {positions.filter((at) => at % PAGE === 0).map((at) => <line key={at} className="lf-slide-rail-stop" x1={(100 * (at - min)) / span} y1="1" x2={(100 * (at - min)) / span} y2="7" />)}
        </svg>
        <span className="lf-hz-handle lf-slide-handle" data-hz-handle="" data-hz-hit="64" style={{ left: `${(100 * (clamp(offset) - min)) / span}%` }}>
          <span role="slider" tabIndex={0} className="lf-slide-knob" aria-label={t.slideSliderLabel} aria-valuemin={min} aria-valuemax={max} aria-valuenow={offset}
            aria-valuetext={fill(t.slideValue, { n: offset })} aria-disabled={locked} onKeyDown={onKeyDown} />
        </span>
      </div>
      <p data-copy-role="body">{t.slideKeys}</p>
      <div className="lf-slide-pad" role="group" aria-label={t.slideSliderLabel}>
        <Button size="sm" disabled={locked || offset <= min} onClick={() => onOffset(clamp(offset - 1))}>{t.slideBack}</Button>
        <Button size="sm" disabled={locked || offset >= max} onClick={() => onOffset(clamp(offset + 1))}>{t.slideForward}</Button>
      </div>
      <MoveToChoice locale={locale} item={{ label: t.slideSliderLabel }} disabled={locked}
        options={positions.map((at) => ({ value: String(at), label: fill(t.slideValue, { n: at }) }))} onChange={(next) => onOffset(clamp(Number(next)))} />
    </section>
  </>;
}

interface NumberViewProps { view: SolidView; onView: (view: SolidView) => void; text: string; onText: (text: string) => void; onValue: (value: string | null) => void; locked: boolean; table: boolean; locale: Locale }

function EulerView({ payload, view, onView, text, onText, onValue, locked, table, locale }: NumberViewProps & { payload: EulerPayload }) {
  const t = space1Text(locale);
  const mesh = useMemo(() => eulerMesh(payload.solid), [payload.solid]);
  const scene = useMemo(() => composePolyScene(mesh, view), [mesh, view]);
  const counts = EULER_COUNTS[payload.solid];
  const bounds = eulerBounds(payload.solid);
  const shown = (name: CountName): string => (name === payload.hide ? t.eulHidden : String(counts[name]));
  const status = fill(t.eulStatus, { solid: solidName(t, payload.solid), v: shown('vertices'), e: shown('edges'), f: shown('faces') });
  const rows: [string, string | number][] = [...COUNT_NAMES.map((name) => [countName(t, name), shown(name)] as [string, string]), [t.eulSumRow, eulerSum(counts)]];
  return <>
    <section className="lf-learning-board lf-eul" aria-label={t.eulHeading}>
      <PolyStage name={solidName(t, payload.solid)} description={status} view={view} onViewChange={onView} locale={locale}>
        <PolyFaces scene={scene} tone="ghost" />
        <PolyEdges scene={scene} />
      </PolyStage>
      <ul className="lf-eul-counts">
        {COUNT_NAMES.map((name) => <li key={name} data-copy-role="data" data-hidden={name === payload.hide ? 'true' : 'false'}>
          <span>{countName(t, name)}</span> <b>{shown(name)}</b>
        </li>)}
      </ul>
      <p className="lf-eul-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {table ? <FactTable locale={locale} caption={t.eulTableCaption} valueHead={t.colCount} rows={rows} /> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.eulRuleHeading}>
      <h2 data-copy-role="heading">{t.eulRuleHeading}</h2>
      <MathExpression tex={RULE} spokenText={t.eulSpoken} fallback={RULE} locale={locale} block />
      <p data-copy-role="body">{t.eulRuleNote}</p>
      <NumberAnswer label={askName(t, payload.hide)} locale={locale} whole min={Number(bounds.minimum)} max={Number(bounds.maximum)}
        value={text} onTextChange={onText} onChange={onValue} disabled={locked} />
    </section>
  </>;
}

function VolumeView({ payload, view, onView, text, onText, onValue, locked, table, locale }: NumberViewProps & { payload: VolumePayload }) {
  const t = space1Text(locale);
  const { side, height } = payload;
  const prism = useMemo(() => prismMesh(side, height), [side, height]);
  const pyramid = useMemo(() => pyramidMesh(side, height), [side, height]);
  const lens = useMemo(() => lensFor(prism), [prism]);
  const prismScene = useMemo(() => composePolyScene(prism, view, { lens }), [prism, view, lens]);
  const pyramidScene = useMemo(() => composePolyScene(pyramid, view, { lens }), [pyramid, view, lens]);
  const volume = prismVolume(side, height);
  const status = fill(t.volStatus, { side, height, prism: volume });
  const rows: [string, number][] = [[t.volSide, side], [t.volHeight, height], [t.volPrism, volume]];
  return <>
    <section className="lf-learning-board lf-vol" aria-label={t.volHeading}>
      <PolyStage name={t.volHeading} description={status} view={view} onViewChange={onView} locale={locale}>
        <PolyFaces scene={pyramidScene} />
        <PolyEdges scene={prismScene} tone="frame" />
        <PolyEdges scene={pyramidScene} />
      </PolyStage>
      <p data-copy-role="body">{t.volNote}</p>
      <p className="lf-vol-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {table ? <FactTable locale={locale} caption={t.volTableCaption} valueHead={t.colValue} rows={rows} /> : null}
    </section>
    <div className="lf-learning-control-strip">
      <NumberAnswer label={t.volAsk} locale={locale} whole min={Number(VOLUME_BOUNDS.minimum)} max={Number(VOLUME_BOUNDS.maximum)}
        value={text} onTextChange={onText} onChange={onValue} disabled={locked} />
    </div>
  </>;
}

/** The cone in the cylinder of the same base and height, the volume counted in pi: the learner finds one third of the cylinder. */
function ConeView({ payload, view, onView, text, onText, onValue, locked, table, locale }: NumberViewProps & { payload: ConePayload }) {
  const t = space1Text(locale);
  const { radius, height } = payload;
  const cylinder = useMemo(() => cylinderMesh(radius, height), [radius, height]);
  const cone = useMemo(() => coneMesh(radius, height), [radius, height]);
  const lens = useMemo(() => lensFor(cylinder), [cylinder]);
  const cylinderScene = useMemo(() => composePolyScene(cylinder, view, { lens }), [cylinder, view, lens]);
  const coneScene = useMemo(() => composePolyScene(cone, view, { lens }), [cone, view, lens]);
  const volume = cylinderVolume(radius, height);
  const status = fill(t.coneStatus, { radius, height, cylinder: volume });
  const rows: [string, number][] = [[t.coneRadius, radius], [t.volHeight, height], [t.coneCylinder, volume]];
  return <>
    <section className="lf-learning-board lf-vol" aria-label={t.coneHeading}>
      <PolyStage name={t.coneHeading} description={status} view={view} onViewChange={onView} locale={locale}>
        <PolyFaces scene={coneScene} />
        <PolyEdges scene={cylinderScene} tone="frame" />
        <PolyEdges scene={coneScene} />
      </PolyStage>
      <p data-copy-role="body">{t.coneNote}</p>
      <p className="lf-vol-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {table ? <FactTable locale={locale} caption={t.volTableCaption} valueHead={t.colValue} rows={rows} /> : null}
    </section>
    <div className="lf-learning-control-strip">
      <NumberAnswer label={t.coneAsk} locale={locale} whole min={Number(VOLUME_BOUNDS.minimum)} max={Number(VOLUME_BOUNDS.maximum)}
        value={text} onTextChange={onText} onChange={onValue} disabled={locked} />
    </div>
  </>;
}

export default function SolidSectionBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'geometry.solid-section.v2') return null;
  const payload = readSolidSectionPayload(segment.payload);
  return payload ? <SolidSection segment={segment} payload={payload} {...rest} /> : null;
}
