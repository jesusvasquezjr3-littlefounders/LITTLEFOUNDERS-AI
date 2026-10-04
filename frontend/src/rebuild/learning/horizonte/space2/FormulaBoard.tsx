import { useMemo, useState, type KeyboardEvent } from 'react';
import { Button, TextField } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { MathExpression } from '../../pizarron/MathExpression';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { Prose } from '../Prose';
import { DEFAULT_VIEW, SCENE_SIZE, projectPoint, type SolidView } from '../solids/projection.generated';
import {
  FORMULA_HALF_HEIGHT, FORMULA_HALF_WIDTH, FORMULA_LIMITS, answerCount, evaluate, formulaGrid, formulaLatex, formulaMesh, formulaProblem, formulaSpoken,
  newMeter, parseFormula, ratCompare, ratEquals, ratFromInt, ratText, ratToNumber, readFormulaPayload, readNumber, taskFormula, walkPath, worldPoint,
  type FormulaGrid, type FormulaPayload, type Node, type ParseError, type Vec3, type WalkPoint,
} from './field.generated';
import { fill, formulaMark, formulaWords, ratShow, spaceText, type SpaceText } from './spaceText';
import { ScrollRegion } from './ScrollRegion';
import { TurnStage } from './TurnStage';
import '../horizonte.css';
import './space2.css';

type Segment = Extract<HorizonteSegment, { type: 'math.surface-formula.v2' }>;
type Spot = { x: number; y: number; depth: number };

const points = (list: ReadonlyArray<{ x: number; y: number }>): string => list.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
const present = <T,>(list: ReadonlyArray<T | null | undefined>): T[] => list.filter((item): item is T => item !== null && item !== undefined);

interface Scene {
  floor: string;
  cells: Array<{ key: string; depth: number; shade: number; outline: string }>;
  held: string[];
  dot: Spot | null;
  trail: Spot[];
  pins: Array<Spot & { n: number; hit: boolean }>;
}

/** The surface as a mesh of shaded cells on the solids projection, with the question's marks on it: the dot, the walk so far or the numbered dots. */
function drawScene(input: {
  payload: FormulaPayload; mesh: ReadonlyArray<ReadonlyArray<Vec3 | null>>; low: number; high: number; view: SolidView;
  walk: ReadonlyArray<WalkPoint>; hits: ReadonlyArray<boolean>;
}): Scene {
  const { payload, mesh, low, high, view, walk, hits } = input;
  const { task, window } = payload;
  const project = (point: Vec3): Spot => projectPoint(point, view);
  const rows = mesh.map((row) => row.map((point) => (point ? project(point) : null)));
  const cells: Scene['cells'] = [];
  for (let yi = 0; yi + 1 < rows.length; yi += 1) {
    for (let xi = 0; xi + 1 < rows[yi]!.length; xi += 1) {
      const world = [mesh[yi]![xi], mesh[yi]![xi + 1], mesh[yi + 1]![xi + 1], mesh[yi + 1]![xi]];
      const corners = [rows[yi]![xi], rows[yi]![xi + 1], rows[yi + 1]![xi + 1], rows[yi + 1]![xi]];
      if (world.some((point) => !point) || corners.some((corner) => !corner)) continue;
      const height = world.reduce((sum, point) => sum + point![1], 0) / 4;
      const shown = corners as Spot[];
      cells.push({ key: `${xi}-${yi}`, depth: shown.reduce((sum, corner) => sum + corner.depth, 0) / 4, shade: Math.min(3, Math.max(0, Math.floor((height + 0.5) * 4))), outline: points(shown) });
    }
  }
  cells.sort((left, right) => left.depth - right.depth);
  const floor = points([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => project([x! * FORMULA_HALF_WIDTH, -FORMULA_HALF_HEIGHT, z! * FORMULA_HALF_WIDTH])));
  const held: string[] = [];
  let dot: Spot | null = null;
  const trail: Spot[] = [];
  const pins: Scene['pins'] = [];
  if (task.kind === 'build') {
    task.through.forEach((through, index) => pins.push({ ...project(worldPoint(window, through.x, through.y, through.z, low, high)), n: index + 1, hit: hits[index] === true }));
  } else {
    const column = task.at.x - window.xMin;
    const row = task.at.y - window.yMin;
    dot = rows[row]?.[column] ?? null;
    if (task.kind === 'slope' || task.kind === 'gradient') {
      if (task.kind === 'gradient' || task.axis === 'x') held.push(points(present(rows[row] ?? [])));
      if (task.kind === 'gradient' || task.axis === 'y') held.push(points(present(rows.map((line) => line[column]))));
    }
    if (task.kind === 'walk') {
      for (const step of walk) trail.push(project(worldPoint(window, ratToNumber(step.x), ratToNumber(step.y), ratToNumber(step.z), low, high)));
    }
  }
  return { floor, cells, held, dot, trail, pins };
}

function SceneSvg({ scene, name }: { scene: Scene; name: string }) {
  return <svg className="lf-s2-svg" viewBox={`0 0 ${SCENE_SIZE} ${SCENE_SIZE}`} role="img" aria-label={name} focusable="false" data-copy-role="data">
    <polygon className="lf-s2-floor" points={scene.floor} />
    {scene.cells.map((cell) => <polygon key={cell.key} className="lf-s2-cell" data-shade={cell.shade} points={cell.outline} />)}
    {scene.held.map((line, index) => <polyline key={index} className="lf-s2-held" points={line} fill="none" />)}
    {scene.trail.length > 1 ? <polyline className="lf-s2-walk-line" points={points(scene.trail)} fill="none" /> : null}
    {scene.trail.map((spot, index) => <circle key={index} className="lf-s2-walk-dot" data-current={index === scene.trail.length - 1 ? 'true' : 'false'} cx={spot.x} cy={spot.y} r={index === scene.trail.length - 1 ? 7 : 4} />)}
    {scene.dot ? <circle className="lf-s2-dot-at" cx={scene.dot.x} cy={scene.dot.y} r="7" /> : null}
    {scene.pins.map((pin) => <g key={pin.n} className="lf-s2-pin" data-chosen={pin.hit ? 'true' : 'false'}>
      <circle cx={pin.x} cy={pin.y} r="9" />
      <text x={pin.x} y={pin.y} textAnchor="middle" dominantBaseline="central">{pin.n}</text>
    </g>)}
  </svg>;
}

/** What a parse refusal says, in the learner's words: one short line, never the raw error. */
function formulaMessage(t: SpaceText, error: ParseError): string | null {
  switch (error) {
    case 'empty': return null;
    case 'too-long': case 'too-complex': return t.formulaTooLong;
    case 'bad-char': case 'unknown-symbol': return t.formulaChars;
    case 'bad-number': return t.formulaNumber;
    case 'bad-exponent': return t.formulaPower;
    default: return t.formulaShape;
  }
}

/** A number typed the way the learner writes it (2, 0.5, 0,5, 1/3), echoed back in the locale's own form. */
function NumberBox({ label, text, onText, disabled, locale, t, help }: {
  label: string; text: string; onText: (text: string) => void; disabled: boolean; locale: Locale; t: SpaceText; help?: string;
}) {
  const value = readNumber(text);
  const error = text.trim() !== '' && value === null ? t.numberHelp : undefined;
  return <div className="lf-number-answer">
    <TextField label={label} help={help} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={FORMULA_LIMITS.maxNumberChars}
      value={text} disabled={disabled} error={error} onChange={(event) => onText(event.target.value)} />
    <p className="lf-number-echo" data-copy-role="data" aria-live="polite">{value ? fill(t.readsAs, { value: ratShow(value, locale) }) : ' '}</p>
  </div>;
}

function Notation({ expr, text, t, locale }: { expr: Node; text: string; t: SpaceText; locale: Locale }) {
  return <p className="lf-s2-formula">
    <MathExpression tex={`z=${formulaLatex(expr, '.')}`} spokenText={`${t.spokenZ} ${formulaSpoken(expr, formulaWords(t), formulaMark(locale))}`} fallback={`z = ${text}`} locale={locale} />
  </p>;
}

const hintFor = (t: SpaceText, diagnostic: string | undefined, kind: FormulaPayload['task']['kind']): string => {
  if (diagnostic === 'structure') return t.hintStructure;
  if (diagnostic === 'partial') return t.hintPartial;
  if (diagnostic === 'miss') return t.hintMiss;
  return kind === 'build' ? t.hintMiss : t.hintFormula;
};

/*
 * F4.7 (fix round): a surface from a typed formula z = f(x, y). A slope or a gradient is read at a dot, a walk is stepped downhill
 * with buttons or the arrow keys, and a build is typed as a formula that must pass through numbered dots. The slopes are never
 * shown: the learner works them out. The board never says met; the answer is { answer: [text] } and Core scores it exactly.
 */
function FormulaBoardView({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: Segment; payload: FormulaPayload }) {
  const { locale } = document;
  const t = spaceText(locale);
  const { task, window } = payload;
  const given = useMemo(() => taskFormula(task), [task]);
  const boxes = answerCount(task);
  const [texts, setTexts] = useState<string[]>(() => Array.from({ length: boxes }, () => ''));
  const [steps, setSteps] = useState(0);
  const [view, setView] = useState<SolidView>(DEFAULT_VIEW);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;

  const learner = useMemo(() => (task.kind === 'build' ? parseFormula(texts[0]) : null), [task.kind, texts]);
  const expr = task.kind === 'build' ? (learner?.ok ? learner.expr : null) : given;
  const grid = useMemo<FormulaGrid | null>(() => (expr ? formulaGrid(expr, window) : null), [expr, window]);
  const walk = useMemo(() => (task.kind === 'walk' && given ? walkPath(given, task.at, task.rate, task.maxSteps) : null), [task, given]);
  const through = task.kind === 'build' ? task.through : null;
  const hits = useMemo(() => {
    if (!through) return [];
    const meter = newMeter();
    return through.map((point) => {
      if (!expr) return false;
      const found = evaluate(expr, ratFromInt(point.x), ratFromInt(point.y), meter);
      return found.ok && ratEquals(found.z, ratFromInt(point.z));
    });
  }, [through, expr]);
  const yours = useMemo(() => {
    if (!through || !expr) return [];
    const meter = newMeter();
    return through.map((point) => { const found = evaluate(expr, ratFromInt(point.x), ratFromInt(point.y), meter); return found.ok ? found.z : null; });
  }, [through, expr]);
  const scale = useMemo(() => {
    if (task.kind !== 'build') return grid ? { low: grid.low, high: grid.high } : { low: 0, high: 1 };
    const heights = [...task.through.map((point) => point.z), ...(grid ? [grid.low, grid.high] : [])];
    return { low: Math.min(...heights), high: Math.max(...heights) };
  }, [task, grid]);
  const scene = useMemo(() => {
    const mesh = grid ? formulaMesh({ ...grid, low: scale.low, high: scale.high }, window) : [];
    return drawScene({ payload, mesh, low: scale.low, high: scale.high, view, walk: walk?.path.slice(0, steps + 1) ?? [], hits });
  }, [grid, scale, window, payload, view, walk, steps, hits]);

  const readings = texts.map((text) => (task.kind === 'build' ? null : readNumber(text)));
  const ready = task.kind === 'build' ? learner?.ok === true : readings.every((reading) => reading !== null);
  const changed = texts.some((text) => text !== '') || steps !== 0 || view.yaw !== DEFAULT_VIEW.yaw || view.pitch !== DEFAULT_VIEW.pitch;
  const edit = (index: number, text: string) => { grading.reset(); setTexts((current) => current.map((old, at) => (at === index ? text : old))); };
  const reset = () => { grading.reset(); setTexts(Array.from({ length: boxes }, () => '')); setSteps(0); setView(DEFAULT_VIEW); };
  const submit = () => grading.check({ answer: task.kind === 'build' ? [texts[0]!.trim()] : readings.map((reading) => ratText(reading!)) });
  const maxSteps = task.kind === 'walk' ? task.maxSteps : 0;
  const stepBy = (change: number) => setSteps((current) => Math.min(maxSteps, Math.max(0, current + change)));
  const onWalkKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') stepBy(1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') stepBy(-1);
    else if (event.key === 'Home') setSteps(0);
    else return;
    event.preventDefault();
  };

  const diagnostic = grading.result && grading.result !== 'unavailable' ? grading.result.diagnostic : undefined;
  const dot = task.kind === 'build' ? null : fill(t.dotAt, { x: task.at.x, y: task.at.y });
  const shown = walk?.path.slice(0, steps + 1) ?? [];
  const here = shown[shown.length - 1];
  const message = learner && !learner.ok && texts[0]!.trim() !== '' ? formulaMessage(t, learner.error) : null;
  const heightGrid = task.kind === 'build' ? null : grid;
  const cellMark = (xi: number, yi: number): string => (task.kind !== 'build' && task.at.x - window.xMin === xi && task.at.y - window.yMin === yi ? ` (${t.dotMark})` : '');

  return <BoardShell screen="surface-formula" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={ready && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metFormula, hint: hintFor(t, diagnostic, task.kind) }} onCheck={submit} />}>
    <section className="lf-learning-board lf-s2-board">
      <TurnStage view={view} onViewChange={setView} name={t.formulaName} keys={t.surfaceKeys} controls={t.surfaceControls} locale={locale}>
        <SceneSvg scene={scene} name={t.formulaName} />
      </TurnStage>
      {table ? <ScrollRegion label={task.kind === 'build' ? t.tableDots : t.tableHeights}>
        {heightGrid ? <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.tableHeights}</caption>
          <thead><tr>
            <th scope="col" data-copy-role="data">{fill(t.tableCorner, { y: t.colY, x: t.colX })}</th>
            {heightGrid.xs.map((x) => <th key={x} scope="col" data-copy-role="data">{x}</th>)}
          </tr></thead>
          <tbody>{heightGrid.ys.map((y, yi) => <tr key={y}>
            <th scope="row" data-copy-role="data">{y}</th>
            {heightGrid.xs.map((x, xi) => <td key={x} data-copy-role="data">{(heightGrid.values[yi]![xi] ? ratShow(heightGrid.values[yi]![xi]!, locale) : t.notDefined) + cellMark(xi, yi)}</td>)}
          </tr>)}</tbody>
        </table> : null}
        {through ? <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.tableDots}</caption>
          <thead><tr>
            <th scope="col" data-copy-role="data">#</th>
            <th scope="col" data-copy-role="data">{t.colX}</th>
            <th scope="col" data-copy-role="data">{t.colY}</th>
            <th scope="col" data-copy-role="data">{t.colHeight}</th>
            <th scope="col" data-copy-role="data">{t.colYours}</th>
          </tr></thead>
          <tbody>{through.map((point, index) => <tr key={index}>
            <th scope="row" data-copy-role="data">{index + 1}</th>
            <td data-copy-role="data">{point.x}</td>
            <td data-copy-role="data">{point.y}</td>
            <td data-copy-role="data">{point.z}</td>
            <td data-copy-role="data">{yours[index] ? ratShow(yours[index]!, locale) : t.notDefined}</td>
          </tr>)}</tbody>
        </table> : null}
        {task.kind === 'walk' ? <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.tableSteps}</caption>
          <thead><tr>
            <th scope="col" data-copy-role="data">{t.colStep}</th>
            <th scope="col" data-copy-role="data">{t.colX}</th>
            <th scope="col" data-copy-role="data">{t.colY}</th>
            <th scope="col" data-copy-role="data">{t.colHeight}</th>
            <th scope="col" data-copy-role="data">{t.colSlopeX}</th>
            <th scope="col" data-copy-role="data">{t.colSlopeY}</th>
          </tr></thead>
          <tbody>{shown.map((step, index) => <tr key={index}>
            <th scope="row" data-copy-role="data">{index}</th>
            <td data-copy-role="data">{ratShow(step.x, locale)}</td>
            <td data-copy-role="data">{ratShow(step.y, locale)}</td>
            <td data-copy-role="data">{ratShow(step.z, locale)}</td>
            <td data-copy-role="data">{ratShow(step.dx, locale)}</td>
            <td data-copy-role="data">{ratShow(step.dy, locale)}</td>
          </tr>)}</tbody>
        </table> : null}
      </ScrollRegion> : null}
    </section>
    <section className="lf-learning-control-strip lf-s2-strip" aria-label={t.formulaHeading}>
      <h2 data-copy-role="heading">{t.formulaHeading}</h2>
      {given && task.kind !== 'build' ? <Notation expr={given} text={task.expression} t={t} locale={locale} /> : null}
      {dot ? <p className="lf-s2-note" data-copy-role="data">{dot}</p> : null}
      {through ? <ol className="lf-s2-dots">{through.map((point, index) => <li key={index} data-copy-role="data">
        {fill(t.throughLine, { n: index + 1, x: point.x, y: point.y, z: point.z })}
      </li>)}</ol> : null}
      {task.kind === 'walk' && walk ? <div className="lf-s2-walk" role="group" tabIndex={0} aria-label={t.walkHeading} onKeyDown={onWalkKey}>
        <h2 data-copy-role="heading">{t.walkHeading}</h2>
        <p className="lf-s2-note" data-copy-role="data">{fill(t.walkGoal, { below: task.below, rate: `${task.rate.n}/${task.rate.d}` })}</p>
        <p className="lf-s2-keys" data-copy-role="body">{t.walkKeys}</p>
        <div className="lf-s2-walk-pad">
          <Button size="sm" disabled={steps >= maxSteps} onClick={() => stepBy(1)}>{t.stepDown}</Button>
          <Button size="sm" disabled={steps <= 0} onClick={() => stepBy(-1)}>{t.stepBack}</Button>
        </div>
        <p className="lf-s2-status" role="status" data-copy-role="data">
          {here ? fill(t.walkStatus, { n: steps, max: maxSteps, z: ratShow(here.z, locale) }) : ''}
          {here && ratCompare(here.z, ratFromInt(task.below)) <= 0 ? <> <Prose>{t.walkLow}</Prose></> : null}
        </p>
      </div> : null}
      <h2 data-copy-role="heading">{t.answerHeading}</h2>
      {task.kind === 'slope' ? <NumberBox label={task.axis === 'x' ? t.labelSlopeX : t.labelSlopeY} text={texts[0]!} onText={(text) => edit(0, text)} disabled={locked} locale={locale} t={t} help={t.numberHelp} /> : null}
      {task.kind === 'gradient' ? <>
        <NumberBox label={t.labelSlopeX} text={texts[0]!} onText={(text) => edit(0, text)} disabled={locked} locale={locale} t={t} help={t.numberHelp} />
        <NumberBox label={t.labelSlopeY} text={texts[1]!} onText={(text) => edit(1, text)} disabled={locked} locale={locale} t={t} />
      </> : null}
      {task.kind === 'walk' ? <NumberBox label={t.labelSteps} text={texts[0]!} onText={(text) => edit(0, text)} disabled={locked} locale={locale} t={t} help={t.numberHelp} /> : null}
      {task.kind === 'build' ? <>
        <TextField label={t.labelFormula} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={FORMULA_LIMITS.maxChars}
          value={texts[0]!} disabled={locked} error={message ?? undefined} onChange={(event) => edit(0, event.target.value)} />
        {learner?.ok ? <Notation expr={learner.expr} text={texts[0]!.trim()} t={t} locale={locale} /> : null}
        <p className="lf-s2-status" role="status" data-copy-role="data">{learner?.ok ? fill(t.passes, { n: hits.filter(Boolean).length, total: through?.length ?? 0 }) : ' '}</p>
      </> : null}
    </section>
  </BoardShell>;
}

export default function FormulaBoard({ segment, ...rest }: HorizonteBoardProps) {
  const payload = useMemo(() => (segment.type === 'math.surface-formula.v2' ? readFormulaPayload(segment.payload) : null), [segment]);
  const problem = useMemo(() => (payload ? formulaProblem(payload) : 'unreadable'), [payload]);
  if (segment.type !== 'math.surface-formula.v2' || !payload || problem !== null) return null;
  return <FormulaBoardView segment={segment} payload={payload} {...rest} />;
}
