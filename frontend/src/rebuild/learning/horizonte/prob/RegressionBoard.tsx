import { useId, useState } from 'react';
import { Slider } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { MathExpression } from '../../pizarron/MathExpression';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { PROB_COPY } from './copy';
import { INTERCEPT_MAX, INTERCEPT_MIN, SLOPE_MAX, SLOPE_MIN, residualTenths, sseHundredths, tenthsText, type LineTenths } from './regression.generated';
import { TableToggle, fmt } from './shared';
import '../horizonte.css';
import './prob.css';

type RegressionSegment = Extract<HorizonteSegment, { type: 'prob.regression.v2' }>;
type Words = { readonly [K in keyof typeof PROB_COPY]: string };

const LEFT = 56;
const TOP = 20;
const PLOT = 480;
const VIEW_W = LEFT + PLOT + 24;
const VIEW_H = TOP + PLOT + 48;

/** The equation three ways: TeX for the eye, plain text until KaTeX loads, and the words a screen reader speaks. */
function equation(line: LineTenths, locale: Locale, t: Words): { tex: string; plain: string; spoken: string } {
  const { slope, intercept } = line;
  const number = (tenths: number) => fmt(locale, Math.abs(tenths) / 10, 1);
  const texNumber = (tenths: number) => tenthsText(Math.abs(tenths));
  const unit = Math.abs(slope) === 10;
  const lead = slope < 0 ? '-' : '';
  const tex: string[] = [];
  const plain: string[] = [];
  const spoken: string[] = [];
  if (slope !== 0) {
    tex.push(unit ? `${lead}x` : `${lead}${texNumber(slope)}x`);
    plain.push(unit ? `${lead}x` : `${lead}${number(slope)}x`);
    spoken.push(`${slope < 0 ? `${t.wordMinus} ` : ''}${unit ? 'x' : `${number(slope)} x`}`);
  }
  if (intercept !== 0 || slope === 0) {
    const negative = intercept < 0;
    if (slope === 0) {
      tex.push(`${negative ? '-' : ''}${texNumber(intercept)}`);
      plain.push(`${negative ? '-' : ''}${number(intercept)}`);
      spoken.push(`${negative ? `${t.wordMinus} ` : ''}${number(intercept)}`);
    } else {
      tex.push(`${negative ? '-' : '+'} ${texNumber(intercept)}`);
      plain.push(`${negative ? '-' : '+'} ${number(intercept)}`);
      spoken.push(`${negative ? t.wordMinus : t.wordPlus} ${number(intercept)}`);
    }
  }
  return { tex: `y = ${tex.join(' ')}`, plain: `y = ${plain.join(' ')}`, spoken: `y ${t.wordEquals} ${spoken.join(' ')}` };
}

/*
 * H11: points on a square grid and a line the learner moves with two sliders (slope and intercept, in steps of a tenth).
 * Each point hangs a square on the line whose side is its distance to the line; the written sum of the squares falls as the
 * line fits. The answer is the pair of numbers; Core holds the one line that makes the squares smallest.
 */
function Regression({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: RegressionSegment }) {
  const locale = document.locale;
  const t: Words = copyText(PROB_COPY, locale);
  const { size, points, start } = segment.payload;
  const [slope, setSlope] = useState(start.slope);
  const [intercept, setIntercept] = useState(start.intercept);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const clip = `lf-prob-clip-${useId().replace(/:/g, '')}`;
  const line: LineTenths = { slope, intercept };
  const changed = slope !== start.slope || intercept !== start.intercept;
  const change = (next: () => void) => { grading.reset(); next(); };

  const unit = PLOT / size;
  const px = (x: number) => LEFT + x * unit;
  const py = (y: number) => TOP + PLOT - y * unit;
  const at = (x: number) => (slope * x + intercept) / 10;
  const step = size <= 10 ? 1 : 2;
  const ticks = Array.from({ length: Math.floor(size / step) + 1 }, (_, index) => index * step);
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const sum = sseHundredths(points, line) / 100;
  const words = equation(line, locale, t);

  return <BoardShell screen="regression-squares" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => change(() => { setSlope(start.slope); setIntercept(start.intercept); })} resetDisabled={!changed || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metFit, hint: t.hintFit }} onCheck={() => grading.check({ family: 'line', params: { m: tenthsText(slope), b: tenthsText(intercept) } })} />}>
    <section className="lf-learning-board lf-prob" aria-label={t.regressionName}>
      <div className="lf-prob-equation"><MathExpression tex={words.tex} spokenText={words.spoken} fallback={words.plain} locale={locale} block /></div>
      <svg className="lf-prob-chart" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={t.regressionName} focusable="false" data-copy-role="data">
        <defs><clipPath id={clip}><rect x={LEFT} y={TOP} width={PLOT} height={PLOT} /></clipPath></defs>
        <g className="lf-prob-axis">
          {ticks.map((value) => <g key={value}>
            <line className="lf-prob-grid" x1={px(value)} x2={px(value)} y1={TOP} y2={TOP + PLOT} />
            <line className="lf-prob-grid" x1={LEFT} x2={LEFT + PLOT} y1={py(value)} y2={py(value)} />
            <text x={px(value)} y={TOP + PLOT + 30} textAnchor="middle">{value}</text>
            <text x={LEFT - 12} y={py(value) + 6} textAnchor="end">{value}</text>
          </g>)}
        </g>
        <g clipPath={`url(#${clip})`}>
          {points.map((point) => {
            const miss = residualTenths(point, line);
            if (miss === 0) return null;
            const side = Math.abs(miss) / 10;
            const onLine = at(point.x);
            const left = point.x + side > size ? point.x - side : point.x;
            return <rect key={`${point.x}-${point.y}`} className="lf-prob-square" x={px(left)} y={py(Math.max(point.y, onLine))} width={side * unit} height={side * unit} />;
          })}
          <line className="lf-prob-line" x1={px(0)} y1={py(at(0))} x2={px(size)} y2={py(at(size))} />
        </g>
        <rect className="lf-prob-frame" x={LEFT} y={TOP} width={PLOT} height={PLOT} />
        {points.map((point) => <circle key={`${point.x}-${point.y}`} className="lf-prob-point" cx={px(point.x)} cy={py(point.y)} r={7} />)}
      </svg>
      <p className="lf-prob-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {t.slopeLabel}: {fmt(locale, slope / 10, 1)}. {t.interceptLabel}: {fmt(locale, intercept / 10, 1)}. {t.squaresTotal}: {fmt(locale, sum, 2)}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tableCaptionFit}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">x</th><th scope="col" data-copy-role="data">y</th>
          <th scope="col" data-copy-role="data">{t.colOnLine}</th><th scope="col" data-copy-role="data">{t.colResidual}</th><th scope="col" data-copy-role="data">{t.colSquare}</th>
        </tr></thead>
        <tbody>
          {sorted.map((point) => {
            const miss = residualTenths(point, line);
            return <tr key={`${point.x}-${point.y}`}>
              <th scope="row" data-copy-role="data">{fmt(locale, point.x, 0)}</th>
              <td data-copy-role="data">{fmt(locale, point.y, 0)}</td>
              <td data-copy-role="data">{fmt(locale, at(point.x), 1)}</td>
              <td data-copy-role="data">{fmt(locale, miss / 10, 1)}</td>
              <td data-copy-role="data">{fmt(locale, (miss * miss) / 100, 2)}</td>
            </tr>;
          })}
        </tbody>
        <tfoot><tr><th scope="row" colSpan={4} data-copy-role="data">{t.total}</th><td data-copy-role="data">{fmt(locale, sum, 2)}</td></tr></tfoot>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.regressionName}>
      <Slider label={t.slopeLabel} valueText={fmt(locale, slope / 10, 1)} min={SLOPE_MIN} max={SLOPE_MAX} step={1} value={slope}
        onValueChange={(next) => change(() => setSlope(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
      <Slider label={t.interceptLabel} valueText={fmt(locale, intercept / 10, 1)} min={INTERCEPT_MIN} max={INTERCEPT_MAX} step={1} value={intercept}
        onValueChange={(next) => change(() => setIntercept(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function RegressionBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'prob.regression.v2' ? <Regression segment={segment} {...rest} /> : null;
}
