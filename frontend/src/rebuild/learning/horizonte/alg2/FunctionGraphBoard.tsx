import { useMemo, useState } from 'react';
import { Slider } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { Plano } from '../plano';
import { ALG2_COPY } from './copy';
import {
  curveFunction, formatDecimal, parseSliderNumber, passesThrough, readGraphPayload, responseNames, sliderNames, toStandard,
  type Dec, type GraphFamily, type GraphForm, type ReadGraph,
} from './model.generated';
import { equationText, fmt, pairText, slots, stepOf, textAt, trackOf, type Track } from './shared';
import '../horizonte.css';
import './alg2.css';

type GraphSegment = Extract<HorizonteSegment, { type: 'math.function-graph.v2' }>;
type NameKey = 'nameSlope' | 'nameLineB' | 'nameOpening' | 'nameLinearTerm' | 'nameConstant' | 'nameVertexX' | 'nameVertexY' | 'nameStart' | 'nameBase';

/** The copy key that names one slider, by family, form and slider letter. */
function nameKey(curve: GraphFamily, form: GraphForm, name: string): NameKey {
  if (curve === 'line') return name === 'm' ? 'nameSlope' : 'nameLineB';
  if (curve === 'quadratic') {
    if (name === 'a') return 'nameOpening';
    if (form === 'vertex') return name === 'h' ? 'nameVertexX' : 'nameVertexY';
    return name === 'b' ? 'nameLinearTerm' : 'nameConstant';
  }
  return name === 'a' ? 'nameStart' : 'nameBase';
}

/*
 * F2.4, D14, D27, D12, T01: a curve (line, quadratic or exponential) with a slider for each parameter, drawn on the
 * Plano plane, and a few dots to bring it through. Each slider is a row of whole steps, so its value is an exact
 * decimal text, never a float. A quadratic in vertex form shows its vertex sliders and sends the standard parameters
 * (b = -2ah, c = ah^2 + k) so Core scores one shape. The browser only draws and counts the dots; Core holds the key.
 */
function FunctionGraph({ document, segment, onBack, sequence, onGrade, graph }: Omit<HorizonteBoardProps, 'segment'> & { segment: GraphSegment; graph: ReadGraph }) {
  const locale = document.locale;
  const t = copyText(ALG2_COPY, locale);
  const names = useMemo(() => sliderNames(graph.curve, graph.form), [graph]);
  const tracks = useMemo(() => new Map<string, Track>(names.map((name) => [name, trackOf(graph.sliders.get(name)!)])), [graph, names]);
  const startSteps = useMemo(() => Object.fromEntries(names.map((name) => [name, stepOf(tracks.get(name)!, graph.start.get(name)!)])) as Record<string, number>, [graph, names, tracks]);
  const [steps, setSteps] = useState<Record<string, number>>(startSteps);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = names.some((name) => steps[name] !== startSteps[name]);

  const texts = new Map(names.map((name) => [name, textAt(tracks.get(name)!, steps[name]!)]));
  const values = new Map<string, Dec>(names.map((name) => [name, parseSliderNumber(texts.get(name))!]));
  const standard = toStandard(graph, values);
  const params: Record<string, string> | null = (() => {
    if (!standard) return null;
    const out: Record<string, string> = {};
    for (const name of responseNames(graph.curve)) {
      const text = formatDecimal(standard.get(name)!);
      if (text === null) return null;
      out[name] = text;
    }
    return out;
  })();
  const fn = params ? curveFunction(graph.curve, params) : null;
  const hits = standard ? graph.marks.filter((mark) => passesThrough(graph.curve, standard, [mark])).length : 0;

  const move = (name: string, step: number) => { grading.reset(); setSteps((current) => ({ ...current, [name]: step })); };
  const reset = () => { grading.reset(); setSteps(startSteps); };

  return <BoardShell screen="function-graph" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={changed && !locked && params !== null} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metGraph, hint: t.hintGraph }} onCheck={() => { if (params) grading.check({ family: graph.curve, params }); }} />}>
    <section className="lf-learning-board lf-alg2" aria-label={t.graphName}>
      <Plano label={t.graphName} domain={graph.window} xLabel="x" yLabel="y" digits={3}
        layers={{
          curves: fn ? [{ id: 'curve', fn, label: t.curveName, series: 1 }] : [],
          points: graph.marks.map((mark, index) => ({ id: `dot-${index}`, x: mark.x, y: mark.y, label: pairText(locale, mark.x, mark.y), series: 3 as const })),
        }} />
      <p className="lf-alg2-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {equationText(locale, graph.curve, graph.form, texts)}
        {graph.marks.length > 0 ? `. ${slots(t.dotsOnCurve, { n: hits, m: graph.marks.length })}` : ''}
      </p>
    </section>
    <section className="lf-learning-control-strip lf-alg2-sliders" aria-label={t.slidersName}>
      {names.map((name) => {
        const track = tracks.get(name)!;
        return <Slider key={name} label={t[nameKey(graph.curve, graph.form, name)]} valueText={fmt(locale, Number(texts.get(name)), 3)}
          min={0} max={track.steps} step={1} value={steps[name]!} onValueChange={(step) => move(name, step)} disabled={locked}
          stepLabels={{ decrease: t.less, increase: t.more }} />;
      })}
    </section>
  </BoardShell>;
}

export default function FunctionGraphBoard({ segment, ...rest }: HorizonteBoardProps) {
  const graph = useMemo(() => (segment.type === 'math.function-graph.v2' ? readGraphPayload(segment.payload) : null), [segment]);
  return segment.type === 'math.function-graph.v2' && graph !== null && typeof graph !== 'string' ? <FunctionGraph segment={segment} graph={graph} {...rest} /> : null;
}
