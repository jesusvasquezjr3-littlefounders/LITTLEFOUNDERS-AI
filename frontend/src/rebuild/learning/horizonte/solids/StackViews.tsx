import { STACK_MAX_HEIGHT, STACK_VIEW_IDS, viewsOf, type Heights, type StackGoal, type StackViewId } from './stack.generated';
import { fill, type SolidsText } from './solidsText';

type Layer = readonly number[] | readonly (readonly number[])[];
type Who = 'yours' | 'goal';

const UNIT = 20;

const isGrid = (layer: Layer): layer is readonly (readonly number[])[] => layer.length > 0 && Array.isArray(layer[0]);

/** A view as rows of filled and empty squares, top row first: a plan is its grid, a front or side view stands each column up to its height. */
export function viewMatrix(layer: Layer): boolean[][] {
  if (isGrid(layer)) return layer.map((row) => row.map((cell) => cell > 0));
  return Array.from({ length: STACK_MAX_HEIGHT }, (_, from) => layer.map((height) => height > STACK_MAX_HEIGHT - 1 - from));
}

export const viewName = (t: SolidsText, id: StackViewId): string => ({ plan: t.viewPlan, front: t.viewFront, side: t.viewSide })[id];

/** The same view in words, for a screen reader and for the table. */
export function describeLayer(t: SolidsText, layer: Layer): string {
  if (isGrid(layer)) return layer.map((row) => row.map((cell) => (cell > 0 ? t.filled : t.empty)).join(', ')).join('; ');
  return layer.join(', ');
}

export const sameLayer = (a: Layer, b: Layer): boolean => JSON.stringify(a) === JSON.stringify(b);

export function goalViews(goal: StackGoal): StackViewId[] {
  return STACK_VIEW_IDS.filter((id) => goal[id] !== undefined);
}

function Diagram({ matrix, who, label }: { matrix: boolean[][]; who: Who; label: string }) {
  const cols = matrix[0]?.length ?? 0;
  return <svg viewBox={`0 0 ${cols * UNIT} ${matrix.length * UNIT}`} role="img" aria-label={label} focusable="false" data-copy-role="data">
    {matrix.flatMap((row, r) => row.map((on, c) => <rect key={`${r}-${c}`} className="lf-stack-unit" data-who={who} data-empty={on ? 'false' : 'true'}
      x={c * UNIT} y={r * UNIT} width={UNIT} height={UNIT} />))}
  </svg>;
}

/**
 * Each view the goal names, drawn twice: the learner's stack and the goal. The match line only compares the drawings; it never says
 * the stack is right, because the minimum cube count a task may ask for stays with Core.
 */
export function StackViews({ t, heights, goal }: { t: SolidsText; heights: Heights; goal: StackGoal }) {
  const mine = viewsOf(heights);
  return <div className="lf-stack-views">
    {goalViews(goal).map((id) => {
      const wanted = goal[id]!;
      const yours: Layer = mine[id];
      const name = viewName(t, id);
      const same = sameLayer(yours, wanted);
      const drawn: ReadonlyArray<{ who: Who; layer: Layer; heading: string }> = [
        { who: 'yours', layer: yours, heading: t.colYours }, { who: 'goal', layer: wanted, heading: t.colGoal },
      ];
      return <div key={id} className="lf-stack-view">
        {drawn.map(({ who, layer, heading }) => <div key={who} className="lf-stack-diagram">
          <Diagram matrix={viewMatrix(layer)} who={who} label={fill(t.diagramLabel, { view: name, who: heading, values: describeLayer(t, layer) })} />
          <span data-copy-role="data">{heading}</span>
        </div>)}
        <p className="lf-stack-line" data-same={same ? 'true' : 'false'} data-copy-role="data">{fill(t.viewLine, { view: name, state: same ? t.viewSame : t.viewDifferent })}</p>
      </div>;
    })}
  </div>;
}
