import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { REFERENCE_MARKS, THICKNESS_TENTHS, coinPositions, readCoinPayload, stackCents, stackTenths, type CoinPayload } from './coins.generated';
import { fill, lengthText, money, pieceName, piecesName, referenceName, space1Text, spokenLength, spokenMoney } from './space1Text';
import '../horizonte.css';
import './space1.css';

type CoinSegment = Extract<HorizonteSegment, { type: 'money.coin-stack.v2' }>;

const SCENE = { width: 260, height: 240, base: 220, top: 20, left: 24, stack: 96, tick: 128, label: 154 } as const;
const MANY = 40;
const LEAST_PIECE_PX = 3;

/*
 * F4.6, the stack: coins or bills are stacked to scale beside things whose height is known, and the learner sets how many
 * with a handle that rests on a few counts (drag, arrow keys, or the Move to menu). The question is a total worth or a height;
 * the other is printed live, so a stack of a million in bills can be seen to be as tall as a person. Thickness is a teaching
 * figure (a coin 2 mm, a bill 0.1 mm), not a measurement of any real currency. Core holds the key; the browser never says met.
 */
function CoinStack({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: CoinSegment; payload: CoinPayload }) {
  const locale = document.locale;
  const t = space1Text(locale);
  const { piece, goal } = payload;
  const positions = useMemo(() => coinPositions(payload), [payload]);
  const [count, setCount] = useState(0);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const index = Math.max(positions.indexOf(count), 0);
  const last = positions.length - 1;
  const span = Math.max(last, 1);

  const set = (next: number) => { if (next !== count) { grading.reset(); setCount(next); } };
  const reset = () => { grading.reset(); setCount(0); };
  const stepTo = (at: number) => set(positions[Math.min(Math.max(at, 0), last)]!);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (locked || event.altKey || event.ctrlKey || event.metaKey) return;
    const next = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? index + 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? index - 1
        : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (next === null) return;
    event.preventDefault();
    stepTo(next);
  };
  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    stepTo(Math.round(Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1) * span));
  };

  const tenths = stackTenths(piece, count);
  const mm = tenths / 10;
  const thickMm = THICKNESS_TENTHS[piece] / 10;
  const pieces = piecesName(t, piece);
  const worth = money(stackCents(payload, count), locale, true);
  const status = fill(t.coinStatus, { n: new Intl.NumberFormat(locale).format(count), pieces, amount: worth, height: lengthText(mm, locale) });
  const spoken = `${t.coinStackLabel}. ${fill(t.coinStatus, { n: new Intl.NumberFormat(locale).format(count), pieces, amount: spokenMoney(stackCents(payload, count), locale), height: spokenLength(mm, locale) })}`;
  const goalLine = goal.kind === 'amount'
    ? fill(t.coinGoalAmount, { pieces, amount: money(goal.total, locale, true) })
    : fill(t.coinGoalHeight, { pieces, height: lengthText(goal.mm, locale) });

  const maxMm = Math.max(stackTenths(piece, payload.max) / 10, goal.kind === 'height' ? goal.mm : 0);
  const scale = (SCENE.base - SCENE.top) / maxMm;
  const yOf = (heightMm: number) => SCENE.base - heightMm * scale;
  const marks = REFERENCE_MARKS.filter((mark) => mark.mm <= maxMm).map((mark) => ({ ...mark, y: yOf(mark.mm), label: 0 }));
  marks.forEach((mark, at) => { mark.label = Math.max(Math.min(mark.y, at === 0 ? Infinity : marks[at - 1]!.label - 13), 12); });
  const pieceH = thickMm * scale;
  const separate = count <= MANY && pieceH >= LEAST_PIECE_PX;

  return <BoardShell screen="coin-stack" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={count === 0 || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={count > 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metCoin, hint: t.hintCoin }} onCheck={() => grading.check({ value: String(count) })} />}>
    <section className="lf-learning-board lf-coin" aria-label={t.coinHeading}>
      <p data-copy-role="body">{goalLine}</p>
      <p data-copy-role="data">{fill(t.coinEach, { piece: pieceName(t, piece), amount: money(payload.value, locale, true), thick: lengthText(thickMm, locale) })}</p>
      <svg className="lf-coin-scene" viewBox={`0 0 ${SCENE.width} ${SCENE.height}`} role="img" aria-label={spoken} focusable="false" data-copy-role="data">
        <line className="lf-coin-base" x1="8" y1={SCENE.base} x2={SCENE.width - 8} y2={SCENE.base} />
        {count === 0 ? null : separate
          ? Array.from({ length: count }, (_, at) => <rect key={at} className="lf-coin-piece" data-odd={at % 2 === 1 ? 'true' : 'false'}
            x={SCENE.left} y={SCENE.base - (at + 1) * pieceH} width={SCENE.stack} height={pieceH} />)
          : <rect className="lf-coin-piece" data-odd="false" x={SCENE.left} y={SCENE.base - Math.max(mm * scale, 1)} width={SCENE.stack} height={Math.max(mm * scale, 1)} />}
        {goal.kind === 'height' ? <g className="lf-coin-goal">
          <line x1={SCENE.left - 10} y1={yOf(goal.mm)} x2={SCENE.left + SCENE.stack + 10} y2={yOf(goal.mm)} />
          <text x={SCENE.left} y={yOf(goal.mm) - 5}>{t.coinMarkGoal}</text>
        </g> : null}
        {marks.map((mark) => <g key={mark.id} className="lf-coin-ref">
          <line x1={SCENE.tick} y1={mark.y} x2={SCENE.tick + 14} y2={mark.y} />
          <line className="lf-coin-lead" x1={SCENE.tick + 14} y1={mark.y} x2={SCENE.label - 4} y2={mark.label} />
          <text x={SCENE.label} y={mark.label + 4}>{referenceName(t, mark.id)} {lengthText(mark.mm, locale)}</text>
        </g>)}
      </svg>
      <p className="lf-coin-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {table ? <>
        <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.coinTableCaption}</caption>
          <thead><tr>
            <th scope="col" data-copy-role="data">{t.coinColPieces}</th><th scope="col" data-copy-role="data">{t.coinColWorth}</th><th scope="col" data-copy-role="data">{t.coinColHeight}</th>
          </tr></thead>
          <tbody>{positions.map((at) => <tr key={at} aria-current={at === count ? 'true' : undefined}>
            <th scope="row" data-copy-role="data">{new Intl.NumberFormat(locale).format(at)}</th>
            <td data-copy-role="data">{money(stackCents(payload, at), locale, true)}</td><td data-copy-role="data">{lengthText(stackTenths(piece, at) / 10, locale)}</td>
          </tr>)}</tbody>
        </table>
        <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.coinRefCaption}</caption>
          <thead><tr><th scope="col" data-copy-role="data">{t.coinColThing}</th><th scope="col" data-copy-role="data">{t.coinColHeight}</th></tr></thead>
          <tbody>{REFERENCE_MARKS.map((mark) => <tr key={mark.id}>
            <th scope="row" data-copy-role="data">{referenceName(t, mark.id)}</th><td data-copy-role="data">{lengthText(mark.mm, locale)}</td>
          </tr>)}</tbody>
        </table>
      </> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.coinHeading}>
      <h2 data-copy-role="heading">{t.coinHeading}</h2>
      <div className="lf-coin-track" ref={track} data-count={count}
        onPointerDown={(event) => { if (locked) return; dragging.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); follow(event); }}
        onPointerMove={(event) => { if (dragging.current) follow(event); }}
        onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
        <svg className="lf-coin-rail" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <line className="lf-coin-rail-line" x1="0" y1="4" x2="100" y2="4" />
          {positions.map((at, stop) => <line key={at} className="lf-coin-rail-stop" x1={(100 * stop) / span} y1="1" x2={(100 * stop) / span} y2="7" />)}
        </svg>
        <span className="lf-hz-handle lf-coin-handle" data-hz-handle="" data-hz-hit="64" style={{ left: `${(100 * index) / span}%` }}>
          <span role="slider" tabIndex={0} className="lf-coin-knob" aria-label={fill(t.coinSliderLabel, { pieces })} aria-valuemin={0} aria-valuemax={payload.max} aria-valuenow={count}
            aria-valuetext={`${new Intl.NumberFormat(locale).format(count)} ${pieces}`} aria-disabled={locked} onKeyDown={onKeyDown} />
        </span>
      </div>
      <p data-copy-role="body">{t.coinSliderKeys}</p>
      <MoveToChoice locale={locale} item={{ label: fill(t.coinSliderLabel, { pieces }) }} disabled={locked}
        options={positions.map((at) => ({ value: String(at), label: new Intl.NumberFormat(locale).format(at) }))} onChange={(value) => set(Number(value))} />
    </section>
  </BoardShell>;
}

export default function CoinStackBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'money.coin-stack.v2') return null;
  const payload = readCoinPayload(segment.payload);
  return payload ? <CoinStack segment={segment} payload={payload} {...rest} /> : null;
}
