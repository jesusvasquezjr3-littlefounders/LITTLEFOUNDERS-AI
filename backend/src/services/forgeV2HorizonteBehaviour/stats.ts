import { bounded, product, range, sameJson, type HzBuilder } from './shared.js';

const sorted = (dots: number[]) => [...dots].sort((a, b) => a - b);
const mean = (dots: number[]) => dots.reduce((sum, dot) => sum + dot, 0) / dots.length;
const medianTwice = (dots: number[]) => { const s = sorted(dots); const m = s.length >> 1; return s.length % 2 === 1 ? 2 * s[m]! : s[m - 1]! + s[m]!; };
function modeOf(dots: number[]): number | null {
  const counts = new Map<number, number>();
  for (const dot of dots) counts.set(dot, (counts.get(dot) ?? 0) + 1);
  const top = Math.max(...counts.values());
  const winners = [...counts.entries()].filter(([, count]) => count === top);
  return winners.length === 1 ? winners[0]![0] : null;
}
const measureMet = (measure: string, dots: number[], target: number) =>
  measure === 'mean' ? mean(dots) === target : measure === 'median' ? medianTwice(dots) === 2 * target : modeOf(dots) === target;

const dotPlot: HzBuilder = (p, r) => {
  const { min, max } = p.axis as { min: number; max: number };
  const length = max - min + 1;
  const first = new Array<number>(length).fill(0);
  for (const dot of p.dots as number[]) first[dot - min]! += 1;
  const asDots = (counts: number[]) => counts.flatMap((count, index) => new Array<number>(count).fill(min + index));
  const seen = new Set([first.join()]);
  const layers: number[][][] = [[first]];
  for (let depth = 0; depth <= p.moves; depth += 1) {
    const next: number[][] = [];
    for (const counts of layers[depth]!) for (let from = 0; from < length; from += 1) {
      if (counts[from]! < 1) continue;
      for (let to = 0; to < length; to += 1) {
        if (to === from) continue;
        const moved = counts.slice();
        moved[from]! -= 1;
        moved[to]! += 1;
        if (seen.has(moved.join())) continue;
        seen.add(moved.join());
        next.push(moved);
      }
    }
    layers.push(next);
  }
  const reachable = layers.slice(1, p.moves + 1).flat().map(asDots);
  const tooFar = layers[p.moves + 1]!.slice(0, 2).map(asDots);
  const dots = p.dots as number[];
  const states = bounded(reachable, 2_500, reachable.filter((state) => measureMet(p.measure, state, r.target)).slice(0, 50)).map((state) => ({ dots: state }));
  return {
    inRange: states,
    invalid: [{ dots: dots.slice(1) }, { dots: [...dots, min] }, { dots: [max + 1, ...dots.slice(1)] }, { dots: [min - 1, ...dots.slice(1)] }, { dots: [1.5, ...dots.slice(1)] },
      { dots: dots.map(String) }, { dots: 'x' }, {}, { dots, extra: 1 }, ...tooFar.map((state) => ({ dots: state }))],
    initial: { dots },
    expectMet: (response) => measureMet(p.measure, response.dots as number[], r.target),
  };
};

const balancePoint: HzBuilder = (p, r) => {
  const { min, max } = p.axis as { min: number; max: number };
  return {
    inRange: range(min, max).filter((pivot) => pivot !== p.pivot).map((pivot) => ({ pivot })),
    invalid: [{ pivot: min - 1 }, { pivot: max + 1 }, { pivot: 1.5 }, { pivot: String(min) }, {}, { pivot: min, extra: 1 }],
    initial: { pivot: p.pivot },
    expectMet: (response) => response.pivot === r.target,
  };
};

const normal: HzBuilder = (p, r) => {
  const { min, max } = p.axis as { min: number; max: number };
  const all = product([range(min, max), range(1, p.sdMax)]).filter(([m, sd]) => !(m === p.start.mean && sd === p.start.sd)).map(([m, sd]) => ({ mean: m, sd }));
  return {
    inRange: bounded(all, 2_500, [r.target]),
    invalid: [{ mean: min - 1, sd: 1 }, { mean: max + 1, sd: 1 }, { mean: min, sd: 0 }, { mean: min, sd: p.sdMax + 1 }, { mean: 1.5, sd: 1 }, { mean: min }, { mean: min, sd: 1, extra: 1 }],
    initial: { mean: p.start.mean, sd: p.start.sd },
    expectMet: (response) => response.mean === r.target.mean && response.sd === r.target.sd,
  };
};

const binomial: HzBuilder = (p, r) => ({
  inRange: product([range(1, p.nMax), range(5, 95, 5)]).filter(([n, pct]) => !(n === p.start.n && pct === p.start.pct)).map(([n, pct]) => ({ n, pct })),
  invalid: [{ n: 0, pct: 50 }, { n: p.nMax + 1, pct: 50 }, { n: 1, pct: 52 }, { n: 1, pct: 0 }, { n: 1, pct: 100 }, { n: 1.5, pct: 50 }, { n: 1 }, { n: 1, pct: 50, extra: 1 }],
  initial: { n: p.start.n, pct: p.start.pct },
  expectMet: (response) => sameJson({ n: response.n, pct: response.pct }, { n: r.target.n, pct: r.target.pct }),
});

const clt: HzBuilder = (p, r) => ({
  inRange: range(1, p.nMax).filter((n) => n !== p.start.n).map((n) => ({ n })),
  invalid: [{ n: 0 }, { n: p.nMax + 1 }, { n: 1.5 }, { n: '4' }, {}, { n: 1, extra: 1 }],
  initial: { n: p.start.n },
  expectMet: (response) => response.n === r.target.n,
});

export const STATS_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'stats.dot-plot.v2': dotPlot,
  'stats.balance-point.v2': balancePoint,
  'stats.normal.v2': normal,
  'stats.binomial.v2': binomial,
  'stats.clt.v2': clt,
};
