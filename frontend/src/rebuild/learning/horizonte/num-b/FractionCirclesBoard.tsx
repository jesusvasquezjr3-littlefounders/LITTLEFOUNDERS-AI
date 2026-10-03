import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '../../../design/controls';
import { fractionName } from '../../fractionName';
import { useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { DataTable, FractionFields, NumBFrame, fill, useFractionText, type Copy } from './boardKit';
import { NUM_B_COPY } from './copy';
import { isCirclePayload, type CirclePairPayload, type ShowPayload } from './fractionCirclesModel.generated';
import { WALL_DENOMINATORS } from './fractionWallModel.generated';
import './FractionCirclesBoard.css';

type CircleSegment = Extract<HorizonteSegment, { type: 'math.fraction-circles.v2' }>;
type Props<P> = Omit<HorizonteBoardProps, 'segment'> & { segment: CircleSegment; payload: P };
type Hue = 'sky' | 'mint' | 'berry';

const RADIUS = 48;
const point = (turn: number) => `${(RADIUS * Math.sin(turn * 2 * Math.PI)).toFixed(3)} ${(-RADIUS * Math.cos(turn * 2 * Math.PI)).toFixed(3)}`;
const wedge = (index: number, slices: number) => `M 0 0 L ${point(index / slices)} A ${RADIUS} ${RADIUS} 0 0 1 ${point((index + 1) / slices)} Z`;

/* A circle cut into equal slices, the first `shaded` filled. With onSlice every slice is a focusable button; without it the circle is a picture the spoken line and the table describe. */
function Circle({ slices, shaded, hue, name, sliceName, onSlice, disabled }: {
  slices: number; shaded: number; hue: Hue; name: string; sliceName?: (part: number) => string; onSlice?: (part: number) => void; disabled?: boolean;
}) {
  const live = onSlice !== undefined && sliceName !== undefined && slices > 1;
  const press = (part: number) => { if (!disabled) onSlice?.(part); };
  const key = (part: number) => (event: KeyboardEvent<SVGPathElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    press(part);
  };
  return <svg className="lf-circle" viewBox="-52 -52 104 104" role={live ? 'group' : 'img'} aria-label={name}>
    {slices <= 1
      ? <circle className="lf-circle-slice" r={RADIUS} data-on="false" data-hue={hue} />
      : Array.from({ length: slices }, (_, index) => live
        ? <path key={index} className="lf-circle-slice" d={wedge(index, slices)} data-on={index < shaded} data-hue={hue} role="button" aria-label={sliceName(index + 1)}
          aria-pressed={index < shaded} aria-disabled={disabled ? true : undefined} tabIndex={disabled ? undefined : 0} onClick={() => press(index + 1)} onKeyDown={key(index + 1)} />
        : <path key={index} className="lf-circle-slice" d={wedge(index, slices)} data-on={index < shaded} data-hue={hue} />)}
  </svg>;
}

function CircleFigure({ legend, children }: { legend: string; children: ReactNode }) {
  return <figure className="lf-circle-figure">{children}<figcaption className="lf-numb-legend" data-copy-role="data">{legend}</figcaption></figure>;
}

/* Shade-to-here: tapping part k fills parts 1 to k, and tapping the last filled part takes one back. */
const shadeTo = (shaded: number, part: number) => (shaded === part ? part - 1 : part);

function Stepper({ t, heading, id, more, fewer, locked }: { t: Copy; heading: string; id: string; more: { disabled: boolean; press: () => void }; fewer: { disabled: boolean; press: () => void }; locked: boolean }) {
  return <section className="lf-learning-control-strip" aria-labelledby={`${id}-shade`}>
    <h2 id={`${id}-shade`} data-copy-role="heading">{heading}</h2>
    <div className="lf-numb-row">
      <Button size="sm" disabled={locked || more.disabled} onClick={more.press}>{t.shadeMore}</Button>
      <Button size="sm" disabled={locked || fewer.disabled} onClick={fewer.press}>{t.shadeFewer}</Button>
    </div>
  </section>;
}

/* F1.6 circles, show: cut one circle into equal parts and shade the parts the fraction names. The learner chooses both numbers. */
function ShowBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<ShowPayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const [n, d] = payload.fraction;
  const [cut, setCut] = useState(0);
  const [shaded, setShaded] = useState(0);
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const name = fractionName(n, d, locale);
  const shade = (to: number) => { grading.reset(); setShaded(Math.max(0, Math.min(cut, to))); };
  const cutInto = (parts: number) => { if (parts === cut) return; grading.reset(); setCut(parts); setShaded(0); };
  const reset = () => { grading.reset(); setCut(0); setShaded(0); };

  return <NumBFrame screen="fraction-circles" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={cut > 0 && shaded >= 1} answer={{ n: shaded, d: cut }} named={{ met: t.metCircleShow, hint: t.hintCircleShow }} changed={cut > 0}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.circlesLabel}
    status={cut === 0 ? fill(t.circleShowFresh, { name }) : fill(t.circleShowFacts, { name, d: cut, k: shaded })}
    board={<div className="lf-circles">
      <CircleFigure legend={t.circleYours}>
        <Circle slices={cut} shaded={shaded} hue="sky" name={cut === 0 ? t.circleWhole : fill(t.circleName, { d: cut, k: shaded })}
          sliceName={(part) => fill(t.circlePartOf, { circle: t.circleYours, n: part, d: cut })} onSlice={(part) => shade(shadeTo(shaded, part))} disabled={locked} />
      </CircleFigure>
    </div>}
    tableNode={<DataTable caption={t.circlesCaption} head={[t.colItem, t.colParts, t.colShaded]} rows={[[t.circleYours, String(Math.max(cut, 1)), String(shaded)]]} />}>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-cut`}>
      <h2 id={`${segment.id}-cut`} data-copy-role="heading">{t.circleCutHeading}</h2>
      <div className="lf-numb-row">
        {WALL_DENOMINATORS.map((parts) => <Button key={parts} size="sm" variant={cut === parts ? 'sky' : 'secondary'} className="lf-circle-choice" aria-pressed={cut === parts}
          disabled={locked} onClick={() => cutInto(parts)}>{fill(t.cutInto, { n: parts })}</Button>)}
      </div>
    </section>
    <Stepper t={t} heading={t.circleShadeHeading} id={segment.id} locked={locked}
      more={{ disabled: cut === 0 || shaded >= cut, press: () => shade(shaded + 1) }} fewer={{ disabled: shaded <= 0, press: () => shade(shaded - 1) }} />
  </NumBFrame>;
}

/* F1.6 circles, compare: two circles cut the same way; shade each to its name, then say which holds more. */
function CompareBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<CirclePairPayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const [a, d] = payload.left;
  const [c] = payload.right;
  const [first, setFirst] = useState(0);
  const [second, setSecond] = useState(0);
  const [picked, setPicked] = useState<'first' | 'second' | null>(null);
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const pickedShaded = picked === 'first' ? first : picked === 'second' ? second : 0;
  const move = (set: (to: number) => void) => (to: number) => { grading.reset(); set(Math.max(0, Math.min(d, to))); };
  const pick = (which: 'first' | 'second') => { grading.reset(); setPicked((now) => (now === which ? null : which)); };
  const reset = () => { grading.reset(); setFirst(0); setSecond(0); setPicked(null); };
  const legend = (which: string, name: string) => fill(t.circleLegend, { which, name });

  return <NumBFrame screen="fraction-circles" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={picked !== null && pickedShaded >= 1} answer={{ n: pickedShaded, d }} named={{ met: t.metCircleCompare, hint: t.hintCircleCompare }}
    changed={first > 0 || second > 0 || picked !== null} onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.circlesLabel}
    status={`${fill(t.circleCompareFacts, { d, a: first, b: second })}${picked === null ? '' : ` ${picked === 'first' ? t.pickedFirst : t.pickedSecond}`}`}
    board={<div className="lf-circles">
      <CircleFigure legend={legend(t.circleFirst, fractionName(a, d, locale))}>
        <Circle slices={d} shaded={first} hue="sky" name={fill(t.circleName, { d, k: first })} sliceName={(part) => fill(t.circlePartOf, { circle: t.circleFirst, n: part, d })}
          onSlice={(part) => move(setFirst)(shadeTo(first, part))} disabled={locked} />
      </CircleFigure>
      <CircleFigure legend={legend(t.circleSecond, fractionName(c, d, locale))}>
        <Circle slices={d} shaded={second} hue="mint" name={fill(t.circleName, { d, k: second })} sliceName={(part) => fill(t.circlePartOf, { circle: t.circleSecond, n: part, d })}
          onSlice={(part) => move(setSecond)(shadeTo(second, part))} disabled={locked} />
      </CircleFigure>
    </div>}
    tableNode={<DataTable caption={t.circlesCaption} head={[t.colItem, t.colParts, t.colShaded]}
      rows={[[t.circleFirst, String(d), String(first)], [t.circleSecond, String(d), String(second)]]} />}>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-more`}>
      <h2 id={`${segment.id}-more`} data-copy-role="heading">{t.circleMoreHeading}</h2>
      <div className="lf-numb-row">
        <Button size="sm" variant={picked === 'first' ? 'sky' : 'secondary'} className="lf-circle-choice" aria-pressed={picked === 'first'} disabled={locked} onClick={() => pick('first')}>{t.moreFirst}</Button>
        <Button size="sm" variant={picked === 'second' ? 'mint' : 'secondary'} className="lf-circle-choice" aria-pressed={picked === 'second'} disabled={locked} onClick={() => pick('second')}>{t.moreSecond}</Button>
      </div>
    </section>
  </NumBFrame>;
}

/* F1.6 circles, add and subtract: two given circles cut the same way, a work circle to shade the join or what is left, then the typed fraction. */
function JoinBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<CirclePairPayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const [a, d] = payload.left;
  const [c] = payload.right;
  const adding = payload.op === 'add';
  const start = adding ? 0 : a;
  const [work, setWork] = useState(start);
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const fraction = useFractionText(locale, grading);
  const left = fractionName(a, d, locale);
  const right = fractionName(c, d, locale);
  const shade = (to: number) => { grading.reset(); setWork(Math.max(0, Math.min(d, to))); };
  const reset = () => { grading.reset(); fraction.clear(); setWork(start); };

  return <NumBFrame screen="fraction-circles" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={fraction.ready} answer={fraction.answer} named={{ met: adding ? t.metCircleAdd : t.metCircleSubtract, hint: adding ? t.hintCircleAdd : t.hintCircleSubtract }}
    changed={work !== start || fraction.typed} onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.circlesLabel}
    status={`${fill(adding ? t.addFacts : t.subtractFacts, { left, right })} ${fill(t.circleWorkFacts, { k: work, d })}`}
    board={<div className="lf-circles">
      <CircleFigure legend={fill(t.circleLegend, { which: t.circleFirst, name: left })}>
        <Circle slices={d} shaded={a} hue="sky" name={fill(t.circleName, { d, k: a })} />
      </CircleFigure>
      <CircleFigure legend={fill(t.circleLegend, { which: t.circleSecond, name: right })}>
        <Circle slices={d} shaded={c} hue="mint" name={fill(t.circleName, { d, k: c })} />
      </CircleFigure>
      <CircleFigure legend={t.circleWork}>
        <Circle slices={d} shaded={work} hue="berry" name={fill(t.circleName, { d, k: work })} sliceName={(part) => fill(t.circlePartOf, { circle: t.circleWork, n: part, d })}
          onSlice={(part) => shade(shadeTo(work, part))} disabled={locked} />
      </CircleFigure>
    </div>}
    tableNode={<DataTable caption={t.circlesCaption} head={[t.colItem, t.colParts, t.colShaded]}
      rows={[[t.circleFirst, String(d), String(a)], [t.circleSecond, String(d), String(c)], [t.circleWork, String(d), String(work)]]} />}>
    <Stepper t={t} heading={t.circleShadeHeading} id={segment.id} locked={locked}
      more={{ disabled: work >= d, press: () => shade(work + 1) }} fewer={{ disabled: work <= 0, press: () => shade(work - 1) }} />
    <FractionFields id={segment.id} t={t} locale={locale} fraction={fraction} locked={locked} />
  </NumBFrame>;
}

export default function FractionCirclesBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'math.fraction-circles.v2') return null;
  const { payload } = segment;
  if (!isCirclePayload(payload)) return null;
  if (payload.op === 'show') return <ShowBoard segment={segment} payload={payload} {...rest} />;
  if (payload.op === 'compare') return <CompareBoard segment={segment} payload={payload} {...rest} />;
  return <JoinBoard segment={segment} payload={payload} {...rest} />;
}
