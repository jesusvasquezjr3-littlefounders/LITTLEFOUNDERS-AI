import { useMemo, useState, type CSSProperties } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { StackViews, describeLayer, goalViews, sameLayer, viewName } from './StackViews';
import { STACK_MAX_HEIGHT, composeStackScene, sameHeights, stackSlotId, stackToSlots, stackTotal, viewsOf, type Heights, type Point } from './stack.generated';
import { readStackPayload, type StackPayload } from './rules.generated';
import { fill, solidsText } from './solidsText';
import '../horizonte.css';
import './solids.css';

type StackSegment = Extract<HorizonteSegment, { type: 'geometry.cube-stack.v2' }>;

const points = (list: readonly Point[]): string => list.map((point) => `${point[0]},${point[1]}`).join(' ');

/*
 * F4.3: a grid of columns of cubes drawn in isometric SVG, with the plan, front and side views beside it. The learner sets the height
 * of each cell by tapping it, by dragging the cube chip onto a cell, or with "Move to"; the goal views are the task. The answer is
 * the height of every cell; Core holds the goal (and the fewest-cubes rule), the browser never says met.
 */
function CubeStack({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: StackSegment; payload: StackPayload }) {
  const t = solidsText(document.locale);
  const { size, start, goal, fewest } = payload;
  const [heights, setHeights] = useState<Heights>(start);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const total = stackTotal(heights);
  const changed = !sameHeights(heights, start);
  const scene = useMemo(() => composeStackScene(heights), [heights]);
  const where = (col: number, row: number) => ({ c: col + 1, r: row + 1 });

  const edit = (next: Heights) => { grading.reset(); setHeights(next); };
  const setCell = (col: number, row: number, height: number) => edit(heights.map((line, r) => line.map((value, c) => (r === row && c === col ? height : value))));
  const place = (_item: string, target: string) => {
    const match = /^c(\d)r(\d)$/.exec(target);
    if (!match) return;
    const [col, row] = [Number(match[1]), Number(match[2])];
    const height = heights[row]?.[col];
    if (height !== undefined && height < STACK_MAX_HEIGHT) setCell(col, row, height + 1);
  };
  const drag = useDragPlace<string>(place, locked);
  const reset = () => { grading.reset(); drag.clear(); setHeights(start); };
  const mine = viewsOf(heights);
  const cells = Array.from({ length: size * size }, (_, index) => ({ col: index % size, row: Math.floor(index / size) }));

  return <BoardShell screen="cube-stack" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={changed && total > 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={fewest ? { met: t.metStackFewest, hint: t.hintStackFewest } : { met: t.metStack, hint: t.hintStack }}
      onCheck={() => grading.check({ slots: stackToSlots(heights) })} />}>
    <section className="lf-learning-board lf-stack" aria-label={t.stackHeading}>
      <div className="lf-stack-scene">
        <div className="lf-stack-iso">
          <svg viewBox={`0 0 ${scene.width} ${scene.height}`} role="img" aria-label={`${t.stackName}. ${fill(t.cubesTotal, { n: total })}`} focusable="false" data-copy-role="data">
            <polygon className="lf-stack-ground" points={points(scene.ground)} />
            {scene.cubes.map((cube) => <g key={`${cube.col}-${cube.row}-${cube.level}`}>
              <polygon className="lf-stack-cube-front lf-stack-cube-line" points={points(cube.front)} />
              <polygon className="lf-stack-cube-side lf-stack-cube-line" points={points(cube.side)} />
              <polygon className="lf-stack-cube-top lf-stack-cube-line" points={points(cube.top)} />
            </g>)}
          </svg>
        </div>
        <div className="lf-stack-grid" role="group" aria-label={t.stackHeading} style={{ '--size': size } as CSSProperties}>
          {cells.map(({ col, row }) => {
            const height = heights[row]![col]!;
            return <div key={stackSlotId(col, row)} className="lf-stack-cell" {...drag.target(stackSlotId(col, row))}>
              <button type="button" className="lf-stack-height" data-height={height} data-copy-role="data" aria-disabled={locked}
                aria-label={fill(t.stackCell, { ...where(col, row), n: height })}
                onClick={() => { if (!drag.carried && !locked) setCell(col, row, (height + 1) % (STACK_MAX_HEIGHT + 1)); }}>{height}</button>
            </div>;
          })}
        </div>
      </div>
      <p data-copy-role="body">{t.gridNote}</p>
      <p className="lf-solid-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{fill(t.cubesTotal, { n: total })}</p>
      <h3 data-copy-role="heading">{t.viewsHeading}</h3>
      <StackViews t={t} heights={heights} goal={goal} />
      {table ? <>
        <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.stackCaption}</caption>
          <thead><tr><th scope="col" data-copy-role="data" />{heights[0]!.map((_, col) => <th key={col} scope="col" data-copy-role="data">{col + 1}</th>)}</tr></thead>
          <tbody>{heights.map((line, row) => <tr key={row}>
            <th scope="row" data-copy-role="data">{fill(t.rowN, { r: row + 1 })}</th>{line.map((value, col) => <td key={col} data-copy-role="data">{value}</td>)}
          </tr>)}</tbody>
        </table>
        <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.viewsCaption}</caption>
          <thead><tr>
            <th scope="col" data-copy-role="data">{t.colView}</th><th scope="col" data-copy-role="data">{t.colYours}</th>
            <th scope="col" data-copy-role="data">{t.colGoal}</th><th scope="col" data-copy-role="data">{t.colMatch}</th>
          </tr></thead>
          <tbody>{goalViews(goal).map((id) => <tr key={id}>
            <th scope="row" data-copy-role="data">{viewName(t, id)}</th>
            <td data-copy-role="data">{describeLayer(t, mine[id])}</td><td data-copy-role="data">{describeLayer(t, goal[id]!)}</td>
            <td data-copy-role="data">{sameLayer(mine[id], goal[id]!) ? t.yes : t.no}</td>
          </tr>)}</tbody>
        </table>
      </> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.stackHeading}>
      <h2 data-copy-role="heading">{t.stackHeading}</h2>
      <p data-copy-role="body">{t.stackHint}</p>
      <div className="lf-net-tray">
        <span className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
          <ChoiceChip {...drag.chip('cube')} disabled={locked}>{t.addCube}</ChoiceChip>
        </span>
      </div>
      <MoveToChoice locale={document.locale} item={drag.carried ? { label: t.addCube } : null} disabled={locked}
        options={cells.map(({ col, row }) => ({ value: stackSlotId(col, row), label: fill(t.cellName, where(col, row)) }))}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function CubeStackBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'geometry.cube-stack.v2') return null;
  const payload = readStackPayload(segment.payload);
  return payload ? <CubeStack segment={segment} payload={payload} {...rest} /> : null;
}
