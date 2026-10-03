import { useState, type CSSProperties } from 'react';
import { MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { Prose } from '../Prose';
import { DataTable, Handle, MAX_TYPED, NumBFrame, NumField, fill, typedNumber } from './boardKit';
import { NUM_B_COPY } from './copy';
import { isDoubleLinePayload, isRatioTapePayload, lineScale, type DoubleLinePayload, type RatioTapePayload, type RatioUnit } from './ratioLineModel.generated';
import './RatioLineBoard.css';

type RatioLineSegment = Extract<HorizonteSegment, { type: 'math.ratio-line.v2' }>;
type Props<P> = Omit<HorizonteBoardProps, 'segment'> & { segment: RatioLineSegment; payload: P };

const UNIT_KEYS = {
  coins: 'unitCoins', pencils: 'unitPencils', tickets: 'unitTickets', cups: 'unitCups',
  minutes: 'unitMinutes', pages: 'unitPages', stickers: 'unitStickers', boxes: 'unitBoxes',
} as const satisfies Record<RatioUnit, keyof typeof NUM_B_COPY>;

/* F1.5 double number line: both lines scale by the same steps; the learner reads the steps on the given line and types the other. */
function DoubleLineBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<DoubleLinePayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const scale = lineScale(payload);
  const given = payload.given.line === 'top' ? 0 : 1;
  const other = 1 - given;
  const name = (line: number) => t[UNIT_KEYS[payload.units[line]!]];
  const [marker, setMarker] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const value = typedNumber(text, locale, MAX_TYPED, 1);
  const place = (target: string) => { grading.reset(); setMarker(Number(target.slice('step-'.length))); };
  const drag = useDragPlace<string>((_item, target) => place(target), locked);
  const steps = Array.from({ length: scale + 1 }, (_, step) => step);
  const known = (line: number, step: number) => (line === given || step === 0 || step === 1 ? String(payload.base[line]! * step) : step === scale ? '?' : '');
  const reset = () => { grading.reset(); drag.clear(); setMarker(null); setText(''); };
  const markerText = marker === null ? <Prose>{t.markerNone}</Prose> : fill(t.markerAt, { n: marker, value: payload.base[given]! * marker, unit: name(given) });
  const status = <>{fill(t.lineFacts, { a: payload.base[0]!, unitA: name(0), b: payload.base[1]!, unitB: name(1), given: payload.given.value, givenUnit: name(given) })} {markerText}</>;

  return <NumBFrame screen="ratio-line" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={value !== null} answer={{ value: value ?? '' }} named={{ met: t.metLine, hint: t.hintLine }} changed={marker !== null || text !== ''}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.lineLabel} status={status}
    board={<div className="lf-line-scroll"><div className="lf-line" role="group" aria-label={t.lineLabel} style={{ '--steps': scale + 1 } as CSSProperties}>
      <div className="lf-line-names"><span data-copy-role="data">{name(0)}</span><span data-copy-role="data">{name(1)}</span></div>
      {steps.map((step) => {
        const top = known(0, step);
        const bottom = known(1, step);
        return <div key={step} className="lf-line-col" {...drag.target(`step-${step}`)}>
          <button type="button" className="lf-line-step" aria-pressed={marker === step} disabled={locked}
            aria-label={`${fill(t.step, { n: step })}: ${name(0)} ${top || '?'}, ${name(1)} ${bottom || '?'}`}
            onClick={() => { if (drag.carried) return; grading.reset(); setMarker(marker === step ? null : step); }}>
            <span className="lf-line-val" data-copy-role="data">{top}</span>
            <svg className="lf-line-tick" viewBox="0 0 24 48" aria-hidden="true" focusable="false">
              <line x1="12" y1="0" x2="12" y2="48" />
              {marker === step ? <circle cx="12" cy="24" r="8" /> : null}
            </svg>
            <span className="lf-line-val" data-copy-role="data">{bottom}</span>
          </button>
        </div>;
      })}
    </div></div>}
    tableNode={<DataTable caption={t.lineCaption} head={[t.colStep, name(0), name(1)]}
      rows={steps.map((step) => [String(step), known(0, step) || '?', known(1, step) || '?'])} />}>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-mark`}>
      <h2 id={`${segment.id}-mark`} data-copy-role="heading">{t.markHeading}</h2>
      <div className="lf-numb-row">
        <Handle drag={drag} id="marker" label={t.markerChip} disabled={locked} />
        <MoveToChoice locale={locale} item={drag.carried === null ? null : { label: t.markerChip }} disabled={locked}
          options={steps.map((step) => ({ value: `step-${step}`, label: fill(t.stepOption, { n: step }) }))}
          onChange={(target) => { if (drag.carried) { place(target); drag.clear(); } }} />
      </div>
    </section>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-answer`}>
      <h2 id={`${segment.id}-answer`} data-copy-role="heading">{t.answerHeading}</h2>
      <NumField label={fill(t.quantityOf, { unit: name(other) })} locale={locale} value={text} onText={(next) => { grading.reset(); setText(next); }} disabled={locked} min={1} />
    </section>
  </NumBFrame>;
}

/* F1.5 ratio tape: a whole cut into equal boxes, part A and part B made of some of them; find the value of the asked part. */
function RatioTapeBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<RatioTapePayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const [a, b] = payload.parts;
  const boxes = a + b;
  const unit = t[UNIT_KEYS[payload.unit]];
  const [check, setCheck] = useState('');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const value = typedNumber(text, locale, MAX_TYPED, 1);
  const boxValue = typedNumber(check, locale, MAX_TYPED, 1);
  const asked = payload.ask === 'a' ? 0 : 1;
  const width = 360;
  const each = width / boxes;
  const spans = [{ from: 0, count: a, key: 'a' }, { from: a, count: b, key: 'b' }];
  const reset = () => { grading.reset(); setCheck(''); setText(''); };
  const product = boxValue === null ? null : boxes * Number(boxValue);

  return <NumBFrame screen="ratio-line" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={value !== null} answer={{ value: value ?? '' }} named={{ met: t.metTape, hint: t.hintTape }} changed={check !== '' || text !== ''}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.tapeLabel}
    status={fill(t.tapeFacts, { whole: payload.whole, unit, boxes, a, b })}
    board={<svg className="lf-tape-svg" viewBox={`0 0 ${width} 116`} role="img" aria-label={t.tapeLabel}>
      <text data-copy-role="data" x={width / 2} y={16} textAnchor="middle">{payload.whole}</text>
      <line className="lf-tape-whole" x1={0} y1={26} x2={width} y2={26} />
      {spans.map((span, index) => <g key={span.key}>
        {Array.from({ length: span.count }, (_, at) => <rect key={at} className={`lf-tape-box lf-tape-box--${index === 0 ? 'sky' : 'mint'}`}
          x={(span.from + at) * each} y={44} width={each} height={36} />)}
        {index === asked ? <text data-copy-role="data" x={(span.from + span.count / 2) * each} y={38} textAnchor="middle">?</text> : null}
        <text data-copy-role="data" x={(span.from + span.count / 2) * each} y={102} textAnchor="middle">{index === 0 ? t.partA : t.partB}</text>
      </g>)}
    </svg>}
    tableNode={<DataTable caption={t.tapeCaption} head={[t.colPart, t.colBoxes, t.colValue]}
      rows={[[t.partA, String(a), '?'], [t.partB, String(b), '?']]} foot={[t.wholeName, String(boxes), String(payload.whole)]} />}>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-check`}>
      <h2 id={`${segment.id}-check`} data-copy-role="heading">{t.checkHeading}</h2>
      <NumField label={t.boxValue} locale={locale} value={check} onText={setCheck} disabled={locked} min={1} />
      {product === null ? null : <p className="lf-numb-status" data-copy-role="data" aria-live="polite">
        {fill(t.boxCheck, { boxes, value: boxValue!, product })} <Prose>{product === payload.whole ? t.boxMatch : t.boxMiss}</Prose>
      </p>}
    </section>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-answer`}>
      <h2 id={`${segment.id}-answer`} data-copy-role="heading">{t.answerHeading}</h2>
      <NumField label={payload.ask === 'a' ? t.askA : t.askB} locale={locale} value={text} onText={(next) => { grading.reset(); setText(next); }} disabled={locked} min={1} />
    </section>
  </NumBFrame>;
}

export default function RatioLineBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'math.ratio-line.v2') return null;
  const { payload } = segment;
  if (isDoubleLinePayload(payload)) return <DoubleLineBoard segment={segment} payload={payload} {...rest} />;
  if (isRatioTapePayload(payload)) return <RatioTapeBoard segment={segment} payload={payload} {...rest} />;
  return null;
}
