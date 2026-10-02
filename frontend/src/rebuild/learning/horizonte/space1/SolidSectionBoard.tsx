import { useMemo, useState } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { MathExpression } from '../../pizarron/MathExpression';
import { BoardShell, GradedFoot, NumberAnswer, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { DEFAULT_VIEW, type SolidView } from '../solids/projection.generated';
import { PolyCut, PolyEdges, PolyFaces, PolyStage } from './PolyStage';
import {
  COUNT_NAMES, PLATONIC_COUNTS, composePolyScene, eulerSum, lensFor, planeCrossings, prismMesh, prismVolume, platonicMesh, pyramidMesh,
  type CountName, type SectionShape,
} from './polyhedra.generated';
import {
  EULER_BOUNDS, VOLUME_BOUNDS, readSolidSectionPayload, type EulerPayload, type SectionPayload, type SolidSectionPayload, type VolumePayload,
} from './sectionRules.generated';
import { askName, countName, fill, shapeName, solidName, space1Text } from './space1Text';
import '../horizonte.css';
import './space1.css';

type SectionSegment = Extract<HorizonteSegment, { type: 'geometry.solid-section.v2' }>;

const RULE = 'V - E + F = 2';

/*
 * F4.5: three questions about solids drawn in twelve fixed views. A plane cuts a solid and the learner names the shape of the
 * cut; or a Platonic solid shows two of its three counts and the learner finds the third from V - E + F = 2; or a pyramid sits
 * in a prism of the same base and height and the learner gives its volume. The board draws only what the solid is: the cut is
 * the plane's section, never a hint at the answer. Core holds the key; the browser never says met.
 */
function SolidSection({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: SectionSegment; payload: SolidSectionPayload }) {
  const locale = document.locale;
  const t = space1Text(locale);
  const [view, setView] = useState<SolidView>(DEFAULT_VIEW);
  const [pick, setPick] = useState<'' | SectionShape>('');
  const [text, setText] = useState('');
  const [value, setValue] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = pick !== '' || text !== '' || view.yaw !== DEFAULT_VIEW.yaw || view.pitch !== DEFAULT_VIEW.pitch;

  const reset = () => { grading.reset(); setView(DEFAULT_VIEW); setPick(''); setText(''); };
  const choose = (shape: SectionShape) => { grading.reset(); setPick((current) => (current === shape ? '' : shape)); };
  const typeText = (next: string) => { grading.reset(); setText(next); };

  const answer = payload.mode === 'section' ? { pick } : { value: value ?? '' };
  const ready = payload.mode === 'section' ? pick !== '' : value !== null;
  const named = payload.mode === 'section' ? { met: t.metSection, hint: t.hintSection }
    : payload.mode === 'euler' ? { met: t.metEuler, hint: t.hintEuler } : { met: t.metVolume, hint: t.hintVolume };

  return <BoardShell screen="solid-section" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={ready && !locked} sequence={sequence} feedback={segment.feedback}
      named={named} onCheck={() => grading.check(answer)} />}>
    {payload.mode === 'section' ? <SectionView payload={payload} view={view} onView={setView} pick={pick} onPick={choose} locked={locked} table={table} locale={locale} />
      : payload.mode === 'euler' ? <EulerView payload={payload} view={view} onView={setView} text={text} onText={typeText} onValue={setValue} locked={locked} table={table} locale={locale} />
        : <VolumeView payload={payload} view={view} onView={setView} text={text} onText={typeText} onValue={setValue} locked={locked} table={table} locale={locale} />}
  </BoardShell>;
}

function SectionView({ payload, view, onView, pick, onPick, locked, table, locale }: {
  payload: SectionPayload; view: SolidView; onView: (view: SolidView) => void; pick: '' | SectionShape; onPick: (shape: SectionShape) => void;
  locked: boolean; table: boolean; locale: Locale;
}) {
  const t = space1Text(locale);
  const mesh = useMemo(() => platonicMesh(payload.solid), [payload.solid]);
  const scene = useMemo(() => composePolyScene(mesh, view, { plane: payload.plane }), [mesh, view, payload.plane]);
  const crossing = useMemo(() => planeCrossings(mesh, payload.plane), [mesh, payload.plane]);
  const counts = PLATONIC_COUNTS[payload.solid];
  const facts = fill(t.solidFacts, { faces: counts.faces, edges: counts.edges, vertices: counts.vertices });
  const crossed = fill(t.secCrossing, { n: crossing.insideEdges.length });
  const chosen = pick === '' ? t.secChosenNone : fill(t.secChosen, { shape: shapeName(t, pick) });
  const rows: [string, number][] = [
    [t.secFactEdges, crossing.insideEdges.length], [t.secFactCorners, crossing.onCorners.length],
    [t.secFactAbove, crossing.sides.above], [t.secFactBelow, crossing.sides.below],
  ];
  return <>
    <section className="lf-learning-board lf-sec" aria-label={solidName(t, payload.solid)}>
      <PolyStage name={solidName(t, payload.solid)} description={`${facts}. ${crossed}`} view={view} onViewChange={onView} locale={locale}>
        <PolyFaces scene={scene} tone="ghost" />
        <PolyEdges scene={scene} />
        <PolyCut scene={scene} />
      </PolyStage>
      <p data-copy-role="body">{t.secCutNote}</p>
      <p className="lf-sec-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{`${crossed} ${chosen}`}</p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.secTableCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colFact}</th><th scope="col" data-copy-role="data">{t.colCount}</th></tr></thead>
        <tbody>{rows.map(([label, count]) => <tr key={label}><th scope="row" data-copy-role="data">{label}</th><td data-copy-role="data">{count}</td></tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.secOptionsHeading}>
      <h2 data-copy-role="heading">{t.secOptionsHeading}</h2>
      <div className="lf-sec-options">
        {payload.options.map((shape) => <ChoiceChip key={shape} selected={pick === shape} onToggle={() => { if (!locked) onPick(shape); }} disabled={locked}>{shapeName(t, shape)}</ChoiceChip>)}
      </div>
    </section>
  </>;
}

interface NumberViewProps { view: SolidView; onView: (view: SolidView) => void; text: string; onText: (text: string) => void; onValue: (value: string | null) => void; locked: boolean; table: boolean; locale: Locale }

function EulerView({ payload, view, onView, text, onText, onValue, locked, table, locale }: NumberViewProps & { payload: EulerPayload }) {
  const t = space1Text(locale);
  const mesh = useMemo(() => platonicMesh(payload.solid), [payload.solid]);
  const scene = useMemo(() => composePolyScene(mesh, view), [mesh, view]);
  const counts = PLATONIC_COUNTS[payload.solid];
  const shown = (name: CountName): string => (name === payload.hide ? t.eulHidden : String(counts[name]));
  const status = fill(t.eulStatus, { solid: solidName(t, payload.solid), v: shown('vertices'), e: shown('edges'), f: shown('faces') });
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
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.eulTableCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colFact}</th><th scope="col" data-copy-role="data">{t.colCount}</th></tr></thead>
        <tbody>
          {COUNT_NAMES.map((name) => <tr key={name}><th scope="row" data-copy-role="data">{countName(t, name)}</th><td data-copy-role="data">{shown(name)}</td></tr>)}
          <tr><th scope="row" data-copy-role="data">{t.eulSumRow}</th><td data-copy-role="data">{eulerSum(counts)}</td></tr>
        </tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.eulRuleHeading}>
      <h2 data-copy-role="heading">{t.eulRuleHeading}</h2>
      <MathExpression tex={RULE} spokenText={t.eulSpoken} fallback={RULE} locale={locale} block />
      <p data-copy-role="body">{t.eulRuleNote}</p>
      <NumberAnswer label={askName(t, payload.hide)} locale={locale} whole min={Number(EULER_BOUNDS.minimum)} max={Number(EULER_BOUNDS.maximum)}
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
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.volTableCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colFact}</th><th scope="col" data-copy-role="data">{t.colValue}</th></tr></thead>
        <tbody>{rows.map(([label, count]) => <tr key={label}><th scope="row" data-copy-role="data">{label}</th><td data-copy-role="data">{count}</td></tr>)}</tbody>
      </table> : null}
    </section>
    <div className="lf-learning-control-strip">
      <NumberAnswer label={t.volAsk} locale={locale} whole min={Number(VOLUME_BOUNDS.minimum)} max={Number(VOLUME_BOUNDS.maximum)}
        value={text} onTextChange={onText} onChange={onValue} disabled={locked} />
    </div>
  </>;
}

export default function SolidSectionBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'geometry.solid-section.v2') return null;
  const payload = readSolidSectionPayload(segment.payload);
  return payload ? <SolidSection segment={segment} payload={payload} {...rest} /> : null;
}
