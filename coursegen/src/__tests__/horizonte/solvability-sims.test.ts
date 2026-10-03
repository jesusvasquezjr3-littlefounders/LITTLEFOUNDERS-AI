import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURE_EMITTED_HORIZONTE } from '../../v2/cli.js';
import { horizontePieceGates } from '../../v2/horizonte/index.js';
import { binChance, exactEdges, solveCoverage } from '../../v2/horizonte/sim1.js';
import { analyse, type Payload } from '../../v2/horizonte/sim2.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate, type SolvabilityFinding } from '../../v2/solvability.js';

const CHANCE = 'math.chance-sim.v2';
const GALTON = 'math.galton-sim.v2';
const COVERAGE = 'stats.coverage-sim.v2';
const BOOTSTRAP = 'stats.bootstrap-sim.v2';
const LIFE = 'money.life-sim.v2';
const TYPES = [CHANCE, GALTON, COVERAGE, BOOTSTRAP, LIFE];

type Payloads = Record<string, unknown>;
const run = (type: string, payload: unknown, key?: unknown, nodeBudget?: number): SolvabilityFinding[] =>
  runSolvabilityGate({ segments: [{ id: 'seg-sim', type, grading: 'server', payload }] }, key === undefined ? undefined : { 'seg-sim': key }, nodeBudget === undefined ? {} : { nodeBudget });
const codes = (type: string, payload: unknown, key?: unknown, nodeBudget?: number): string[] => run(type, payload, key, nodeBudget).map((finding) => finding.code).sort();
const patch = (base: Payloads, change: Payloads): Payloads => ({ ...base, ...change });

const die: Payloads = { machine: { kind: 'die', weights: [1, 1, 1, 1, 1, 1] }, event: [5], stops: [10, 100, 500, 2000, 5000], tolerance: 3, minTrials: 2000 };
const spinner: Payloads = { machine: { kind: 'spinner', weights: [2, 1, 1, 2] }, event: [0, 3], stops: [20, 100, 500, 2000, 5000], tolerance: 4, minTrials: 2000 };
const board: Payloads = { view: 'board', rows: 6, rightPct: 50, bin: 3, stops: [20, 100, 500, 1500, 3000], tolerance: 5, minBalls: 1500 };
const biased: Payloads = { view: 'board', rows: 4, rightPct: 70, bin: 3, stops: [20, 100, 500, 1500, 3000], tolerance: 5, minBalls: 1500 };
const coverage: Payloads = { truth: { num: 3, den: 5 }, levels: [80, 90, 95, 99], sizes: [20, 50, 100, 200], start: { level: 80, size: 20 }, goal: { covered: 92 } };
const half: Payloads = { truth: { num: 1, den: 2 }, levels: [90, 95, 99], sizes: [30, 100, 300], start: { level: 90, size: 30 }, goal: { covered: 93 } };
const wide: Payloads = { truth: { num: 1, den: 2 }, levels: [50, 80, 90, 95, 99], sizes: [20, 50, 100, 200], start: { level: 50, size: 20 }, goal: { covered: 70 } };
const bootstrap: Payloads = { axis: { min: 0, max: 10 }, data: [2, 3, 3, 5, 6, 8], level: 90, stops: [50, 200, 500, 1000, 3000], tolerance: 1, minResamples: 500 };
const eight: Payloads = { axis: { min: 10, max: 30 }, data: [12, 15, 15, 18, 22, 25, 25, 28], level: 80, stops: [100, 300, 1000, 2000, 3000], tolerance: 3, minResamples: 1000 };
const portfolio: Payloads = { scenario: 'portfolio', periods: 5, cash: 10000, debt: 0, flow: 1000, finish: 19000, floor: 11000, goal: 90, choices: [0, 10, 25, 60, 80, 100], start: 80 };
const retirement: Payloads = { scenario: 'retirement', periods: 5, cash: 100000, debt: 0, flow: 0, finish: 0, floor: 16000, goal: 80, choices: [10000, 15000, 20000, 25000, 30000, 35000], start: 30000 };
const insurance: Payloads = { scenario: 'insurance', periods: 5, cash: 3000, debt: 0, flow: 3000, finish: 5500, floor: 1000, goal: 90, choices: [0, 10, 25, 85, 95, 100], start: 0 };
const life: Payloads = { scenario: 'life', periods: 5, cash: 1000, debt: 5000, flow: 4000, finish: 5700, floor: 1400, goal: 60, choices: [0, 5, 30, 40, 50, 95, 100], start: 100 };

const authored: Array<[string, string, Payloads, unknown]> = [
  ['die', CHANCE, die, { target: { num: 1, den: 6 } }], ['spinner', CHANCE, spinner, { target: { num: 2, den: 3 } }],
  ['board', GALTON, board, { target: { num: 5, den: 16 } }], ['biased', GALTON, biased, { target: { num: 1029, den: 2500 } }],
  ['coverage', COVERAGE, coverage, { target: { level: 99 } }], ['half', COVERAGE, half, { target: { level: 99 } }],
  ['bootstrap', BOOTSTRAP, bootstrap, { target: { low: 19, high: 36 } }], ['eight', BOOTSTRAP, eight, { target: { low: 140, high: 180 } }],
  ['portfolio', LIFE, portfolio, { target: { answers: [25] } }], ['retirement', LIFE, retirement, { target: { answers: [15000] } }],
  ['insurance', LIFE, insurance, { target: { answers: [85] } }], ['life', LIFE, life, { target: { answers: [30, 40, 50] } }],
];

describe('seeded simulations F0.4 checkers', () => {
  it('registers all five types and leaves the AR table exempt', () => {
    for (const type of TYPES) expect(registeredSolvabilityTypes()).toContain(type);
    expect(registeredSolvabilityTypes()).not.toContain('space.ar-table.v2');
  });

  it('accepts every authored example, with its key and without one', () => {
    for (const [name, type, payload, key] of authored) {
      expect(codes(type, payload), name).toEqual([]);
      expect(codes(type, payload, key), name).toEqual([]);
    }
  });

  it('accepts every committed emitted fixture of these types, with its key and without one', () => {
    const rows = JSON.parse(readFileSync(FIXTURE_EMITTED_HORIZONTE, 'utf8')) as Array<{ document: { segments: Array<{ id: string; type: string; payload: unknown }> }; answer_keys: Record<string, unknown> }>;
    const seen = new Set<string>();
    for (const row of rows) {
      for (const segment of row.document.segments.filter((candidate) => TYPES.includes(candidate.type))) {
        seen.add(segment.type);
        const target = { segments: [segment] };
        expect(runSolvabilityGate(target), segment.id).toEqual([]);
        expect(runSolvabilityGate(target, row.answer_keys), segment.id).toEqual([]);
      }
    }
    expect([...seen].sort()).toEqual([...TYPES].sort());
  });

  describe('chance', () => {
    it('refuses a tolerance no stop can meet, with no key needed', () => {
      expect(codes(CHANCE, patch(die, { tolerance: 1 }))).toEqual(['no-solution']);
      expect(horizontePieceGates({ segments: [{ id: 'seg-sim', type: CHANCE, visual: { type: 'chance-sim' }, prompt: 'Roll 2000 times, within 1 point', payload: patch(die, { tolerance: 1 }) }] })).toHaveLength(1);
    });

    it('refuses a floor that does not bind: the stop below it already lands inside the tolerance', () => {
      expect(codes(CHANCE, patch(die, { tolerance: 5, stops: [10, 100, 2000, 3000, 5000], minTrials: 3000 }))).toEqual(['ambiguous-solution']);
      expect(codes(CHANCE, patch(die, { tolerance: 5, stops: [10, 100, 2000, 3000, 5000], minTrials: 2000 }))).toEqual([]);
    });

    it('refuses a chance outside 5% to 95%', () => {
      const rare = patch(die, { machine: { kind: 'spinner', weights: [1, 12, 12, 12, 12, 12, 12, 12] }, event: [0] });
      expect(codes(CHANCE, rare)).toEqual(['out-of-bounds']);
    });

    it('refuses a machine, an event, stops, a floor and a tolerance the contract refuses', () => {
      const bad: Payloads[] = [
        patch(die, { machine: { kind: 'die', weights: [1, 1, 1] } }), patch(die, { machine: { kind: 'die', weights: [1, 1, 1, 1, 1, 13] } }),
        patch(die, { event: [] }), patch(die, { event: [0, 1, 2, 3, 4, 5] }), patch(die, { event: [3, 2] }),
        patch(die, { stops: [10, 100] }), patch(die, { stops: [10, 100, 500, 2000, 6000] }),
        patch(die, { minTrials: 7 }), patch(die, { minTrials: 10 }), patch(die, { stops: [2000, 3000, 4000], minTrials: 2000 }),
        patch(die, { tolerance: 26 }), patch(die, { tolerance: 2.5 }),
      ];
      for (const payload of bad) expect(codes(CHANCE, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('checks the key against the reduced chance, and only when a key is given', () => {
      expect(codes(CHANCE, die, { target: { num: 1, den: 5 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(CHANCE, die, { target: { num: 2, den: 12 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(CHANCE, die, { target: 'one sixth' })).toEqual(['impossible-state']);
      expect(codes(CHANCE, die, { target: { num: 1, den: 6 }, extra: 1 })).toEqual(['impossible-state']);
      expect(codes(CHANCE, die, null)).toEqual(['impossible-state']);
      expect(codes(CHANCE, patch(die, { tolerance: 1 }), { target: { num: 1, den: 5 } })).toEqual(['no-solution']);
    });
  });

  describe('Galton board', () => {
    it('refuses a tolerance no stop can meet', () => {
      expect(codes(GALTON, patch(board, { tolerance: 2 }))).toEqual(['no-solution']);
      expect(codes(GALTON, patch(biased, { tolerance: 3 }))).toEqual(['no-solution']);
    });

    it('refuses a floor that does not bind', () => {
      expect(codes(GALTON, patch(board, { stops: [20, 100, 2500, 2800, 3000], minBalls: 2800 }))).toEqual(['ambiguous-solution']);
      expect(codes(GALTON, patch(board, { stops: [20, 100, 2500, 2800, 3000], minBalls: 2500 }))).toEqual([]);
    });

    it('refuses a bin the board almost never fills', () => {
      expect(codes(GALTON, patch(board, { rows: 10, rightPct: 10, bin: 10 }))).toEqual(['out-of-bounds']);
      expect(codes(GALTON, patch(board, { rows: 10, rightPct: 10, bin: 0 }))).toEqual([]);
    });

    it('refuses a board, stops and a floor the contract refuses', () => {
      const bad: Payloads[] = [
        patch(board, { rows: 11 }), patch(board, { rows: 2 }), patch(board, { rightPct: 55 }), patch(board, { rightPct: 0 }), patch(board, { bin: 7 }),
        patch(board, { view: 'tree' }), patch(board, { stops: [20, 100] }), patch(board, { minBalls: 1000 }), patch(board, { tolerance: 0 }),
      ];
      for (const payload of bad) expect(codes(GALTON, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('checks the key against the exact chance of the bin', () => {
      expect(codes(GALTON, board, { target: { num: 3, den: 8 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(GALTON, biased, { target: { num: 1029, den: 2501 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(GALTON, board, { num: 5, den: 16 })).toEqual(['impossible-state']);
      expect(codes(GALTON, board, { target: { num: 5.5, den: 16 } })).toEqual(['impossible-state']);
    });
  });

  describe('coverage', () => {
    it('refuses a goal no level and size reach reliably', () => {
      expect(codes(COVERAGE, patch(half, { goal: { covered: 99 } }))).toEqual(['no-solution']);
      expect(codes(COVERAGE, patch(coverage, { goal: { covered: 99 } }))).toEqual(['no-solution']);
    });

    it('refuses a start that is already the answer level, or already reaches the goal on nearly every seed', () => {
      expect(codes(COVERAGE, patch(coverage, { start: { level: 99, size: 20 } }))).toEqual(['impossible-state']);
      expect(codes(COVERAGE, patch(wide, { start: { level: 80, size: 100 } }))).toEqual(['impossible-state']);
      expect(codes(COVERAGE, patch(wide, { start: { level: 99, size: 20 } }))).toEqual(['impossible-state']);
    });

    it('flags for review a lower level the board accepts on nearly every seed, which the key calls too low', () => {
      const answer = solveCoverage({ num: 1, den: 2 }, [50, 80, 90, 95, 99], [20, 50, 100, 200], 70);
      expect(answer).toBe(90);
      const flagged = run(COVERAGE, wide, { target: { level: answer } });
      expect(flagged.map((finding) => [finding.code, finding.severity])).toEqual([['ambiguous-solution', 'review']]);
      expect(run(COVERAGE, wide).map((finding) => finding.severity)).toEqual(['review']);
      expect(codes(COVERAGE, wide, { target: { level: 95 } })).toEqual(['ambiguous-solution', 'rubric-accepts-invalid', 'rubric-gap']);
    });

    it('refuses a truth, levels, sizes, start and goal the contract refuses', () => {
      const bad: Payloads[] = [
        patch(coverage, { truth: { num: 1, den: 10 } }), patch(coverage, { truth: { num: 1, den: 21 } }), patch(coverage, { levels: [80, 85] }),
        patch(coverage, { levels: [99] }), patch(coverage, { sizes: [20, 5] }), patch(coverage, { sizes: [20, 500] }),
        patch(coverage, { start: { level: 70, size: 20 } }), patch(coverage, { start: { level: 80 } }), patch(coverage, { goal: { covered: 100 } }),
        patch(coverage, { goal: 92 }),
      ];
      for (const payload of bad) expect(codes(COVERAGE, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('checks the key against the lowest reliable level', () => {
      expect(codes(COVERAGE, coverage, { target: { level: 95 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(COVERAGE, half, { target: { level: 95 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(COVERAGE, coverage, { target: { level: '99' } })).toEqual(['impossible-state']);
      expect(codes(COVERAGE, coverage, { target: { level: 99, size: 200 } })).toEqual(['impossible-state']);
    });
  });

  describe('bootstrap', () => {
    it('refuses a tolerance no stop can meet', () => {
      expect(codes(BOOTSTRAP, patch(bootstrap, { stops: [10, 20, 50, 100, 200], minResamples: 50 }))).toEqual(['no-solution']);
      expect(codes(BOOTSTRAP, patch(eight, { stops: [60, 100, 200, 300, 400], minResamples: 100, tolerance: 1 }))).toEqual(['no-solution']);
    });

    it('refuses a floor that does not bind', () => {
      expect(codes(BOOTSTRAP, patch(bootstrap, { tolerance: 40 }))).toEqual(['ambiguous-solution']);
      expect(codes(BOOTSTRAP, patch(eight, { tolerance: 40 }))).toEqual(['ambiguous-solution']);
    });

    it('refuses an axis, data, level, stops, a floor and a tolerance the contract refuses', () => {
      const bad: Payloads[] = [
        patch(bootstrap, { axis: { min: 0, max: 3 } }), patch(bootstrap, { axis: { min: 0, max: 30 } }), patch(bootstrap, { data: [2, 3, 3] }),
        patch(bootstrap, { data: [2, 2, 2, 5] }), patch(bootstrap, { data: [2, 3, 3, 5, 6, 11] }), patch(bootstrap, { level: 85 }),
        patch(bootstrap, { stops: [50, 200] }), patch(bootstrap, { minResamples: 49 }), patch(bootstrap, { minResamples: 50, stops: [50, 200, 500] }),
        patch(bootstrap, { minResamples: 600 }), patch(bootstrap, { tolerance: 41 }), patch(bootstrap, { tolerance: 0 }),
      ];
      for (const payload of bad) expect(codes(BOOTSTRAP, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('checks the key against the exact edges', () => {
      expect(codes(BOOTSTRAP, bootstrap, { target: { low: 19, high: 35 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(BOOTSTRAP, bootstrap, { target: { low: 36, high: 19 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(BOOTSTRAP, bootstrap, { target: { low: 19 } })).toEqual(['impossible-state']);
      expect(codes(BOOTSTRAP, bootstrap, { target: { low: -1, high: 36 } })).toEqual(['impossible-state']);
    });
  });

  describe('life', () => {
    it('refuses a board no choice reaches reliably', () => {
      expect(codes(LIFE, patch(portfolio, { finish: 5_000_000 }))).toEqual(['no-solution']);
      expect(codes(LIFE, patch(life, { finish: 9_000_000 }))).toEqual(['no-solution']);
    });

    it('refuses a choice that reaches the goal by luck, neither an answer nor a clear miss', () => {
      expect(codes(LIFE, patch(portfolio, { goal: 60 }))).toEqual(['ambiguous-solution']);
      expect(codes(LIFE, patch(portfolio, { goal: 99, finish: 18000 }))).toEqual(['ambiguous-solution']);
    });

    it('refuses a start that is already an answer', () => {
      expect(codes(LIFE, patch(portfolio, { start: 25 }))).toEqual(['impossible-state']);
      expect(codes(LIFE, patch(life, { start: 40 }))).toEqual(['impossible-state']);
      expect(codes(LIFE, patch(insurance, { start: 85 }))).toEqual(['impossible-state']);
    });

    it('refuses a payload the contract refuses', () => {
      const bad: Payloads[] = [
        patch(portfolio, { scenario: 'bonds' }), patch(portfolio, { periods: 6 }), patch(portfolio, { periods: 1 }), patch(portfolio, { debt: 5 }),
        patch(life, { debt: 0 }), patch(portfolio, { goal: 100 }), patch(portfolio, { choices: [0, 25] }), patch(portfolio, { choices: [0, 60, 25, 80] }),
        patch(portfolio, { choices: [0, 10, 25, 150] }), patch(portfolio, { start: 70 }), patch(portfolio, { cash: -1 }), patch(portfolio, { extra: 1 }),
      ];
      for (const payload of bad) expect(codes(LIFE, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('checks the key against the exact answer set, in order', () => {
      expect(codes(LIFE, portfolio, { target: { answers: [10] } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(LIFE, portfolio, { target: { answers: [10, 25] } })).toEqual(['rubric-accepts-invalid']);
      expect(codes(LIFE, life, { target: { answers: [30, 40] } })).toEqual(['rubric-gap']);
      expect(codes(LIFE, life, { target: { answers: [50, 40, 30] } })).toEqual(['impossible-state']);
      expect(codes(LIFE, life, { target: { answers: [30, 30, 40, 50] } })).toEqual(['impossible-state']);
      expect(codes(LIFE, portfolio, { target: 25 })).toEqual(['impossible-state']);
      expect(codes(LIFE, portfolio, { target: { answers: [25.5] } })).toEqual(['impossible-state']);
      expect(codes(LIFE, portfolio, { answers: [25] })).toEqual(['impossible-state']);
    });
  });

  describe('budget', () => {
    it('says so when the budget runs out instead of calling the board unsolvable', () => {
      for (const [name, type, payload] of authored) expect(codes(type, payload, undefined, 3), name).toEqual(['budget-exceeded']);
    });

    it('charges one unit per chapter state for life, so the largest board costs 37448 units', () => {
      const largest = patch(portfolio, { choices: [0, 10, 25, 40, 60, 80, 90, 100] });
      expect(codes(LIFE, largest, undefined, 37_448)).not.toContain('budget-exceeded');
      expect(codes(LIFE, largest, undefined, 37_447)).toEqual(['budget-exceeded']);
      expect(codes(LIFE, portfolio, undefined, 28_086)).not.toContain('budget-exceeded');
      expect(codes(LIFE, portfolio, undefined, 28_085)).toEqual(['budget-exceeded']);
    });

    it('charges a chance board by its last stop and the stop below the floor', () => {
      expect(codes(CHANCE, die, undefined, 5_500)).toEqual([]);
      expect(codes(CHANCE, die, undefined, 5_499)).toEqual(['budget-exceeded']);
    });

    it('proves the largest legitimate boards inside the default budget', () => {
      const maxChance = patch(die, { stops: [10, 100, 500, 1000, 2000, 3000, 4000, 5000], minTrials: 5000 });
      const maxGalton = patch(board, { stops: [20, 100, 500, 1000, 1500, 2000, 2500, 3000], minBalls: 3000 });
      const maxCoverage = { truth: { num: 3, den: 5 }, levels: [50, 80, 90, 95, 99], sizes: [100, 200, 300, 350, 400], start: { level: 50, size: 100 }, goal: { covered: 92 } };
      const maxBootstrap = { axis: { min: 80, max: 100 }, data: [80, 82, 85, 88, 90, 93, 95, 97, 99, 100], level: 95, stops: [50, 200, 500, 1000, 2000, 3000], tolerance: 40, minResamples: 3000 };
      const maxLife = patch(life, { choices: [0, 5, 30, 40, 50, 95, 99, 100] });
      for (const [type, payload] of [[CHANCE, maxChance], [GALTON, maxGalton], [COVERAGE, maxCoverage], [BOOTSTRAP, maxBootstrap], [LIFE, maxLife]] as const) {
        expect(codes(type, payload), type).not.toContain('budget-exceeded');
        expect(codes(type, payload), type).not.toContain('checker-error');
      }
    });
  });

  describe('malformed input', () => {
    const garbage: unknown[] = [
      undefined, null, 'text', 7, [], {}, { stops: new Array(100_000).fill(1) }, { choices: Array.from({ length: 100_000 }, (_, index) => index), periods: 1e9 },
      { data: new Array(100_000).fill(3), levels: new Array(100_000).fill(90), sizes: [1e12, 2e12], truth: { num: 1e300, den: 2e300 } },
      { machine: { kind: 'die', weights: new Array(100_000).fill(1) }, rows: 1e9, bin: -1, rightPct: Number.NaN, tolerance: Number.POSITIVE_INFINITY },
      { scenario: 'portfolio', periods: 5, cash: 1e300, debt: 0, flow: 1e300, finish: 1e300, floor: 0, goal: 90, choices: [0, 10, 25], start: 0 },
    ];

    it('names an impossible state and never throws or hangs', () => {
      for (const type of TYPES) {
        for (const payload of garbage) {
          const found = run(type, payload, { target: { junk: [] } }, 50);
          expect(found.length, `${type} ${JSON.stringify(payload)?.slice(0, 40)}`).toBeGreaterThan(0);
          expect(found.some((finding) => finding.code === 'checker-error')).toBe(false);
        }
      }
    });
  });

  describe('agreement with the pack gates', () => {
    type Instance = { payload: Payloads; prompt: string; key: unknown };
    const blockCodes = (type: string, payload: Payloads, key: unknown): string[] => run(type, payload, key).filter((finding) => finding.severity === 'block').map((finding) => finding.code);
    const packRefuses = (type: string, visual: string, instance: Instance): boolean =>
      horizontePieceGates({ segments: [{ id: 'seg-sim', type, visual: { type: visual }, prompt: instance.prompt, payload: instance.payload }] }, { 'seg-sim': instance.key }).length > 0;

    // The checker may never accept what the pack refuses, and may refuse what the pack accepts only for the codes named here.
    const compare = (type: string, visual: string, instances: Instance[], allowed: readonly string[]): { both: number; extra: number } => {
      let both = 0;
      let extra = 0;
      for (const instance of instances) {
        const refused = packRefuses(type, visual, instance);
        const found = blockCodes(type, instance.payload, instance.key);
        const label = JSON.stringify(instance.payload);
        if (refused) expect(found.length, label).toBeGreaterThan(0);
        else if (found.length === 0) both += 1;
        else {
          extra += 1;
          for (const code of found) expect(allowed, label).toContain(code);
        }
      }
      return { both, extra };
    };

    it('chance', () => {
      const machines: Array<[Payloads, unknown]> = [
        [{ machine: { kind: 'die', weights: [1, 1, 1, 1, 1, 1] }, event: [5] }, { num: 1, den: 6 }],
        [{ machine: { kind: 'spinner', weights: [2, 1, 1, 2] }, event: [0, 3] }, { num: 2, den: 3 }],
        [{ machine: { kind: 'coin', weights: [1, 3] }, event: [1] }, { num: 3, den: 4 }],
      ];
      const instances: Instance[] = [];
      for (const [machine, target] of machines) for (const tolerance of [1, 2, 3, 4, 5, 8, 12, 25]) for (const minTrials of [100, 500, 2000, 5000]) {
        instances.push({ payload: { ...machine, stops: [20, 100, 500, 2000, 5000], tolerance, minTrials }, prompt: `Run it. Stay within ${tolerance} points.`, key: { target } });
      }
      const { both, extra } = compare(CHANCE, 'chance-sim', instances, ['ambiguous-solution']);
      expect(both).toBeGreaterThan(10);
      expect(extra).toBeGreaterThan(0);
    });

    it('Galton board', () => {
      const instances: Instance[] = [];
      for (const rows of [4, 6, 10]) for (const rightPct of [30, 50, 70]) for (const bin of [1, 3]) for (const tolerance of [3, 5, 10]) for (const minBalls of [500, 1500, 3000]) {
        const target = binChance(rows, rightPct, bin);
        instances.push({ payload: { view: 'board', rows, rightPct, bin, stops: [20, 100, 500, 1500, 3000], tolerance, minBalls }, prompt: `Drop balls into bin ${bin}. Stay within ${tolerance} points.`, key: { target } });
      }
      const { both, extra } = compare(GALTON, 'galton-sim', instances, ['ambiguous-solution']);
      expect(both).toBeGreaterThan(10);
      expect(extra).toBeGreaterThan(0);
    });

    it('coverage', () => {
      const instances: Instance[] = [];
      for (const truth of [{ num: 1, den: 2 }, { num: 3, den: 5 }, { num: 2, den: 5 }]) for (const levels of [[80, 90, 95, 99], [50, 80, 90, 95, 99]]) for (const sizes of [[20, 50, 100, 200], [30, 100, 300]]) for (const covered of [70, 80, 85, 92, 95, 98]) {
        const key = { target: { level: solveCoverage(truth, levels, sizes, covered) ?? 99 } };
        instances.push({ payload: { truth, levels, sizes, start: { level: levels[0], size: sizes[0] }, goal: { covered } }, prompt: `Pick a level so ${covered} intervals cover the truth.`, key });
      }
      const { both } = compare(COVERAGE, 'coverage-sim', instances, ['impossible-state']);
      expect(both).toBeGreaterThan(10);
    });

    it('bootstrap', () => {
      const instances: Instance[] = [];
      for (const level of [80, 90, 95]) for (const tolerance of [1, 2, 3, 5, 10, 40]) for (const minResamples of [200, 500, 1000]) {
        const data = [2, 3, 3, 5, 6, 8];
        instances.push({ payload: { axis: { min: 0, max: 10 }, data, level, stops: [50, 200, 500, 1000, 3000], tolerance, minResamples }, prompt: `Run at least ${minResamples} resamples for the middle ${level}%.`, key: { target: exactEdges(data, level) } });
      }
      const { both, extra } = compare(BOOTSTRAP, 'bootstrap-sim', instances, ['ambiguous-solution']);
      expect(both).toBeGreaterThan(5);
      expect(extra).toBeGreaterThan(0);
    });

    it('life', () => {
      const instances: Instance[] = [];
      for (const goal of [50, 60, 70, 80, 85, 90, 95, 99]) for (const finish of [15000, 17000, 19000, 20000]) for (const start of [25, 80]) {
        const payload = { ...portfolio, goal, finish, start };
        instances.push({ payload, prompt: `Get at least ${goal} of 100 futures past the target.`, key: { target: { answers: analyse(payload as unknown as Payload).answers } } });
      }
      const { both, extra } = compare(LIFE, 'life-sim', instances, []);
      expect(both).toBeGreaterThan(5);
      expect(extra).toBe(0);
    }, 30_000);
  });
});
