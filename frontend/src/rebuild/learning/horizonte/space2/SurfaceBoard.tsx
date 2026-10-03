import { useMemo, useState } from 'react';
import { Button, ChoiceChip, Slider } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { DEFAULT_VIEW, SCENE_SIZE, projectPoint, type SolidView } from '../solids/projection.generated';
import { MESH_HALF_WIDTH, readSurfacePayload, surfaceGrid, surfaceMesh, surfaceSlice, xAxis, yAxis, type SurfaceMesh, type SurfaceOption, type SurfacePayload, type SurfaceSlice } from './surface.generated';
import { axisName, axisValue, fill, holdName, money, outputName, spaceText, type SpaceText } from './spaceText';
import { ScrollRegion } from './ScrollRegion';
import { TurnStage } from './TurnStage';
import '../horizonte.css';
import './space2.css';

type Segment = Extract<HorizonteSegment, { type: 'math.surface.v2' }>;
type Axis = 'x' | 'y';

const points = (list: ReadonlyArray<{ x: number; y: number }>): string => list.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

/** The surface as a mesh of shaded cells on the solids projection: far cells first, the held slice as a heavy line, the options as lettered pins. */
function SurfaceSvg({ mesh, view, held, options, chosen, name }: { mesh: SurfaceMesh; view: SolidView; held: { fixed: Axis; index: number }; options: SurfaceOption[]; chosen: string | null; name: string }) {
  const scene = useMemo(() => {
    const projected = mesh.points.map((row) => row.map((point) => projectPoint(point, view)));
    const cells: Array<{ key: string; depth: number; shade: number; outline: string }> = [];
    for (let yi = 0; yi + 1 < projected.length; yi += 1) {
      for (let xi = 0; xi + 1 < projected[yi]!.length; xi += 1) {
        const corners = [projected[yi]![xi]!, projected[yi]![xi + 1]!, projected[yi + 1]![xi + 1]!, projected[yi + 1]![xi]!];
        const height = (mesh.points[yi]![xi]![1] + mesh.points[yi]![xi + 1]![1] + mesh.points[yi + 1]![xi + 1]![1] + mesh.points[yi + 1]![xi]![1]) / 4;
        cells.push({ key: `${xi}-${yi}`, depth: corners.reduce((sum, corner) => sum + corner.depth, 0) / 4, shade: Math.min(3, Math.max(0, Math.floor((height + 0.5) * 4))), outline: points(corners) });
      }
    }
    cells.sort((left, right) => left.depth - right.depth);
    const line = held.fixed === 'x' ? projected.map((row) => row[held.index]!) : projected[held.index]!;
    const zero = mesh.zero === null ? null : points([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => projectPoint([x! * MESH_HALF_WIDTH, mesh.zero!, z! * MESH_HALF_WIDTH], view)));
    return { cells, line: points(line), zero, pins: options.map((option) => ({ id: option.id, ...projected[option.y]![option.x]! })) };
  }, [mesh, view, held.fixed, held.index, options]);
  return <svg className="lf-s2-svg" viewBox={`0 0 ${SCENE_SIZE} ${SCENE_SIZE}`} role="img" aria-label={name} focusable="false" data-copy-role="data">
    {scene.zero ? <polygon className="lf-s2-zero" points={scene.zero} /> : null}
    {scene.cells.map((cell) => <polygon key={cell.key} className="lf-s2-cell" data-shade={cell.shade} points={cell.outline} />)}
    <polyline className="lf-s2-held" points={scene.line} fill="none" />
    {scene.pins.map((pin) => <g key={pin.id} className="lf-s2-pin" data-chosen={chosen === pin.id ? 'true' : 'false'}>
      <circle cx={pin.x} cy={pin.y} r="9" />
      <text x={pin.x} y={pin.y} textAnchor="middle" dominantBaseline="central">{pin.id.toUpperCase()}</text>
    </g>)}
  </svg>;
}

const CHART_WIDTH = 240;
const CHART_HEIGHT = 120;
const CHART_PAD = 16;

/** The slice as a plain 2D curve. Every slice shares the surface's own scale, so moving the slider shows which line is higher. */
function SliceChart({ slice, mesh, options, name }: { slice: SurfaceSlice; mesh: SurfaceMesh; options: SurfaceOption[]; name: string }) {
  const last = Math.max(1, slice.values.length - 1);
  const rise = mesh.maxCents - mesh.minCents || 1;
  const atX = (step: number) => CHART_PAD + (step * (CHART_WIDTH - 2 * CHART_PAD)) / last;
  const atY = (cents: number) => CHART_HEIGHT - CHART_PAD - ((cents - mesh.minCents) * (CHART_HEIGHT - 2 * CHART_PAD)) / rise;
  const dots = slice.values.map((cents, step) => ({ step, x: atX(step), y: atY(cents) }));
  const pins = options.filter((option) => (slice.fixed === 'x' ? option.x : option.y) === slice.index)
    .map((option) => ({ id: option.id, ...dots[slice.fixed === 'x' ? option.y : option.x]! }));
  return <svg className="lf-s2-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={name} focusable="false" data-copy-role="data">
    {mesh.zero !== null ? <line className="lf-s2-zero-line" x1={CHART_PAD} x2={CHART_WIDTH - CHART_PAD} y1={atY(0)} y2={atY(0)} /> : null}
    <polyline className="lf-s2-curve" points={points(dots)} fill="none" />
    {dots.map((dot) => <circle key={dot.step} className="lf-s2-dot" cx={dot.x} cy={dot.y} r="4" />)}
    {pins.map((pin) => <text key={pin.id} className="lf-s2-pin-label" x={pin.x} y={pin.y - 10} textAnchor="middle">{pin.id.toUpperCase()}</text>)}
  </svg>;
}

function sliceNote(t: SpaceText, locale: Locale, payload: SurfacePayload, slice: SurfaceSlice): string {
  const { surface } = payload;
  const held = `${axisName(t, surface, slice.fixed)}: ${axisValue(t, surface, slice.fixed, slice.index, locale)}`;
  return fill(t.sliceNote, { held, out: outputName(t, surface), low: money(Math.min(...slice.values), locale), high: money(Math.max(...slice.values), locale) });
}

/*
 * F4.7: a surface is a third real variable. Two inputs (a rate and a term, or a price and a quantity) make one output (an amount
 * or a profit). The learner turns the mesh, slices it into a 2D curve under a slider, reads the lettered options and picks the one
 * the question asks for. The answer is { choice }; Core holds the key and the browser never says met.
 */
function SurfaceBoardView({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: Segment; payload: SurfacePayload }) {
  const { locale } = document;
  const t = spaceText(locale);
  const spec = payload.surface;
  const mesh = useMemo(() => surfaceMesh(spec), [spec]);
  const grid = useMemo(() => surfaceGrid(spec), [spec]);
  const [view, setView] = useState<SolidView>(DEFAULT_VIEW);
  const [fixed, setFixed] = useState<Axis>('x');
  const [slots, setSlots] = useState<Record<Axis, number>>({ x: 0, y: 0 });
  const [chosen, setChosen] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const slice = surfaceSlice(spec, fixed, slots[fixed])!;
  const changed = chosen !== null || fixed !== 'x' || slots.x !== 0 || slots.y !== 0 || view.yaw !== DEFAULT_VIEW.yaw || view.pitch !== DEFAULT_VIEW.pitch;
  const xs = xAxis(spec);
  const ys = yAxis(spec);
  const reset = () => { grading.reset(); setView(DEFAULT_VIEW); setFixed('x'); setSlots({ x: 0, y: 0 }); setChosen(null); };
  const pick = (id: string) => { grading.reset(); setChosen((current) => (current === id ? null : id)); };
  const pinsAt = (xi: number, yi: number): string => payload.options.filter((option) => option.x === xi && option.y === yi).map((option) => option.id.toUpperCase()).join(', ');

  return <BoardShell screen="surface" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={chosen !== null && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metSurface, hint: t.hintSurface }} onCheck={() => grading.check({ choice: chosen })} />}>
    <section className="lf-learning-board lf-s2-board">
      <TurnStage view={view} onViewChange={setView} name={t.surfaceName} keys={t.surfaceKeys} controls={t.surfaceControls} locale={locale}>
        <SurfaceSvg mesh={mesh} view={view} held={{ fixed, index: slots[fixed] }} options={payload.options} chosen={chosen} name={t.surfaceName} />
      </TurnStage>
      {table ? <ScrollRegion label={spec.kind === 'compound' ? t.tableAmount : t.tableProfit}><table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{spec.kind === 'compound' ? t.tableAmount : t.tableProfit}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{fill(t.tableCorner, { y: axisName(t, spec, 'y'), x: axisName(t, spec, 'x') })}</th>
          {xs.map((_, xi) => <th key={xi} scope="col" data-copy-role="data">{axisValue(t, spec, 'x', xi, locale)}</th>)}
        </tr></thead>
        <tbody>{ys.map((_, yi) => <tr key={yi}>
          <th scope="row" data-copy-role="data">{axisValue(t, spec, 'y', yi, locale)}</th>
          {xs.map((__, xi) => <td key={xi} data-copy-role="data">{money(grid[yi]![xi]!, locale)}{pinsAt(xi, yi) ? ` (${pinsAt(xi, yi)})` : ''}</td>)}
        </tr>)}</tbody>
      </table></ScrollRegion> : null}
    </section>
    <section className="lf-learning-control-strip lf-s2-strip" aria-label={t.sliceHeading}>
      <h2 data-copy-role="heading">{t.sliceHeading}</h2>
      <SliceChart slice={slice} mesh={mesh} options={payload.options} name={t.sliceName} />
      <p className="lf-s2-note" data-copy-role="data">{sliceNote(t, locale, payload, slice)}</p>
      <h2 data-copy-role="heading">{t.holdHeading}</h2>
      <div className="lf-s2-chips">
        {(['x', 'y'] as const).map((axis) => <ChoiceChip key={axis} selected={fixed === axis} onToggle={() => setFixed(axis)}>{holdName(t, spec, axis)}</ChoiceChip>)}
      </div>
      <Slider label={axisName(t, spec, fixed)} valueText={axisValue(t, spec, fixed, slots[fixed], locale)} min={0} max={(fixed === 'x' ? xs : ys).length - 1} step={1}
        value={slots[fixed]} onValueChange={(next) => setSlots((current) => ({ ...current, [fixed]: next }))} stepLabels={{ decrease: t.less, increase: t.more }} />
      <h2 data-copy-role="heading">{t.optionsHeading}</h2>
      <div className="lf-s2-chips">
        {payload.options.map((option) => <ChoiceChip key={option.id} selected={chosen === option.id} disabled={locked} onToggle={() => pick(option.id)}>
          <span data-copy-role="data">{fill(t.optionLine, { id: option.id.toUpperCase(), x: axisValue(t, spec, 'x', option.x, locale), y: axisValue(t, spec, 'y', option.y, locale) })}</span>
        </ChoiceChip>)}
      </div>
      <p className="lf-s2-status" role="status" data-copy-role="data">{chosen === null ? t.chosenNone : fill(t.chosen, { option: chosen.toUpperCase() })}</p>
    </section>
  </BoardShell>;
}

export default function SurfaceBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'math.surface.v2') return null;
  const payload = readSurfacePayload(segment.payload);
  return payload ? <SurfaceBoardView segment={segment} payload={payload} {...rest} /> : null;
}
