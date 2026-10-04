import { bounded, unique, type HzBuilder } from './shared.js';

interface Pan { x: number; u: number }
interface Scale { l: Pan; r: Pan }

const MAX_UNITS = 30;
const MAX_STEPS = 16;

/** Independent of the scorer's model on purpose: a route is replayed here with its own arithmetic. */
function step(scale: Scale, op: string): Scale | null {
  const { l, r } = scale;
  if (op === 'sub-x') return l.x >= 1 && r.x >= 1 ? { l: { x: l.x - 1, u: l.u }, r: { x: r.x - 1, u: r.u } } : null;
  if (op === 'sub-unit') return l.u >= 1 && r.u >= 1 ? { l: { x: l.x, u: l.u - 1 }, r: { x: r.x, u: r.u - 1 } } : null;
  if (op === 'add-unit') return l.u < MAX_UNITS && r.u < MAX_UNITS ? { l: { x: l.x, u: l.u + 1 }, r: { x: r.x, u: r.u + 1 } } : null;
  const n = Number(op.slice(4));
  const counts = [l.x, l.u, r.x, r.u];
  return counts.every((count) => count % n === 0) && counts.some((count) => count > 0) ? { l: { x: l.x / n, u: l.u / n }, r: { x: r.x / n, u: r.u / n } } : null;
}

const alone = ({ l, r }: Scale): number | null => (l.x === 1 && l.u === 0 && r.x === 0 ? r.u : r.x === 1 && r.u === 0 && l.x === 0 ? l.u : null);
const key = ({ l, r }: Scale) => `${l.x},${l.u},${r.x},${r.u}`;

const equationBalance: HzBuilder = (p, r) => {
  const ops = (p.ops as string[]).filter((op) => op !== 'slip-left' && op !== 'slip-right');
  const start = p.start as Scale;
  const witnesses = new Map<string, string[]>([[key(start), []]]);
  let frontier = [{ scale: start, route: [] as string[] }];
  for (let depth = 0; depth < MAX_STEPS && frontier.length > 0; depth += 1) {
    const next: typeof frontier = [];
    for (const { scale, route } of frontier) for (const op of ops) {
      const after = step(scale, op);
      if (after === null || witnesses.has(key(after))) continue;
      witnesses.set(key(after), [...route, op]);
      next.push({ scale: after, route: [...route, op] });
    }
    frontier = next;
  }
  const routes = [...witnesses.values()];
  const solvedRoutes = routes.filter((route) => alone(route.reduce<Scale>((scale, op) => step(scale, op)!, start)) !== null);
  const answers = ['0', String(r.x), String(r.x + 1), String(r.x + 7)];
  const inRange = bounded(unique(routes).flatMap((steps) => answers.map((answer) => ({ steps, answer }))), 1_500, solvedRoutes.map((steps) => ({ steps, answer: String(r.x) })));
  const offeredAway = ['sub-x', 'sub-unit', 'add-unit', 'div-2', 'div-3', 'div-4', 'div-5'].find((op) => !ops.includes(op));
  const blocked = ops.find((op) => step(start, op) === null);
  const stuck = blocked ? [{ steps: [blocked], answer: '' }, { steps: [blocked], answer: String(r.x) }] : [];
  return {
    inRange,
    invalid: [
      { steps: ['slip-left'], answer: '' }, { steps: ['slip-right'], answer: String(r.x) }, { steps: ['wipe'], answer: '' }, { steps: [1], answer: '' },
      { steps: Array.from({ length: MAX_STEPS + 1 }, () => 'add-unit'), answer: '' },
      { steps: [], answer: '-0' }, { steps: [], answer: '1,5' }, { steps: [], answer: '21.980' }, { steps: [], answer: '007' }, { steps: [], answer: 5 },
      { steps: 'sub-x', answer: '' }, { steps: [] }, { answer: '' }, { steps: [], answer: '', extra: true },
      ...(offeredAway ? [{ steps: [offeredAway], answer: '' }] : []),
      ...stuck,
    ],
    initial: { steps: [], answer: '' },
    expectMet: (response) => {
      let scale: Scale | null = start;
      for (const op of response.steps as string[]) { scale = scale === null ? null : step(scale, op); }
      return scale !== null && alone(scale) === r.x && response.answer === String(r.x);
    },
  };
};

const visualProof: HzBuilder = (p, r) => {
  const choices = p.choices as string[];
  const values = unique([r.value, '1', '7', '0', '12.5']);
  const bad = ['cheat', ''].filter((choice) => choice !== '' && !choices.includes(choice));
  return {
    inRange: choices.flatMap((choice) => values.map((value) => ({ choice, value }))),
    invalid: [...bad.map((choice) => ({ choice, value: '1' })), { choice: choices[0], value: '1,5' }, { choice: choices[0], value: '01' }, { choice: choices[0], value: '-0' }, { choice: choices[0], value: 3 },
      { choice: 3, value: '1' }, { choice: choices[0] }, { value: '1' }, { choice: choices[0], value: '1', extra: 1 }],
    initial: { choice: '', value: '' },
    expectMet: (response) => response.choice === r.choice && response.value === r.value,
  };
};

export const BALANCE_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'math.equation-balance.v2': equationBalance,
  'math.visual-proof.v2': visualProof,
};
