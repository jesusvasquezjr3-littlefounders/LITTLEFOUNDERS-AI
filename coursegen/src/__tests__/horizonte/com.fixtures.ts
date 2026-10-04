/** The authored examples of the com pack (F2.16, F2.17, F2.18), mirroring the backend fixtures. */

export const NETWORK = 'math.network-count.v2';
export const TRIG = 'trig.unit-circle.v2';
export const CALCULUS = 'calculus.explorer.v2';
export const CIRCUITS = 'computing.bits-gates.v2';

export type Seg = { id: string; type: string; visual: { type: string }; prompt: string; labels?: Record<string, string>; payload: Record<string, unknown> };
export type Doc = { age_band?: string; segments: Seg[] };
export type Slots = Record<string, string[]>;

export const named = (ids: readonly string[]): Record<string, string> => Object.fromEntries(ids.map((id) => [id, id.replace(/[-.]/g, ' ')]));
export const seg = (id: string, type: string, visual: string, payload: Record<string, unknown>, labels?: readonly string[]): Seg => ({
  id, type, visual: { type: visual }, prompt: 'Work the board.', ...(labels ? { labels: named(labels) } : {}), payload,
});
export const keyOf = (...solutions: Slots[]) => ({ solutions });
export const pascalByRow = (cells: readonly string[]): Slots => {
  const out: Slots = {};
  for (const cell of cells) (out[`row-${/^r(\d+)c/.exec(cell)![1]}`] ??= []).push(cell);
  return out;
};

/* ── F2.16 networks and counting ── */

export const bridgeNodes = [{ id: 'island', x: 50, y: 50 }, { id: 'north', x: 50, y: 12 }, { id: 'south', x: 50, y: 88 }, { id: 'east', x: 90, y: 50 }];
export const bridgeEdges = [
  { id: 'bridge-1', from: 'island', to: 'north' }, { id: 'bridge-2', from: 'island', to: 'north' }, { id: 'bridge-3', from: 'island', to: 'south' }, { id: 'bridge-4', from: 'island', to: 'south' },
  { id: 'bridge-5', from: 'island', to: 'east' }, { id: 'bridge-6', from: 'north', to: 'east' }, { id: 'bridge-7', from: 'south', to: 'east' },
];
export const konigsberg = seg('konigsberg', NETWORK, 'graph', { task: 'odd', nodes: bridgeNodes, edges: bridgeEdges }, ['island', 'north', 'south', 'east']);
export const konigsbergKey = keyOf({ odd: ['island', 'north', 'south', 'east'] });

export const walkNodes = [{ id: 'west', x: 12, y: 50 }, { id: 'island', x: 50, y: 50 }, { id: 'east', x: 88, y: 50 }, { id: 'north', x: 50, y: 12 }];
export const walkEdges = [
  { id: 'bridge-1', from: 'west', to: 'island' }, { id: 'bridge-2', from: 'west', to: 'island' }, { id: 'bridge-3', from: 'island', to: 'east' },
  { id: 'bridge-4', from: 'island', to: 'north' }, { id: 'bridge-5', from: 'north', to: 'east' }, { id: 'bridge-6', from: 'west', to: 'north' },
];
export const walkIds = ['west', 'island', 'east', 'north', 'bridge-1', 'bridge-2', 'bridge-3', 'bridge-4', 'bridge-5', 'bridge-6'];
export const bridgeWalk = seg('bridge-walk', NETWORK, 'graph', { task: 'trail', nodes: walkNodes, edges: walkEdges }, walkIds);
export const bridgeWalkKey = keyOf({ walk: ['bridge-1', 'bridge-3', 'bridge-5', 'bridge-4', 'bridge-2', 'bridge-6'] });

export const roadNodes = [{ id: 'home', x: 10, y: 50 }, { id: 'park', x: 36, y: 16 }, { id: 'shop', x: 36, y: 84 }, { id: 'mall', x: 66, y: 16 }, { id: 'pool', x: 66, y: 84 }, { id: 'school', x: 92, y: 50 }];
export const roadEdges = [
  { id: 'road-1', from: 'home', to: 'park', weight: 2 }, { id: 'road-2', from: 'home', to: 'shop', weight: 5 }, { id: 'road-3', from: 'park', to: 'mall', weight: 4 },
  { id: 'road-4', from: 'park', to: 'shop', weight: 1 }, { id: 'road-5', from: 'shop', to: 'pool', weight: 3 }, { id: 'road-6', from: 'mall', to: 'school', weight: 6 },
  { id: 'road-7', from: 'pool', to: 'school', weight: 4 },
];
export const cheapest = seg('cheapest-route', NETWORK, 'shortest-path', { nodes: roadNodes, edges: roadEdges, start: 'home', goal: 'school' }, roadNodes.map((node) => node.id));
export const cheapestKey = keyOf({ route: ['home', 'park', 'shop', 'pool', 'school'] });

export const tieNodes = [{ id: 'camp', x: 8, y: 50 }, { id: 'ridge', x: 40, y: 14 }, { id: 'creek', x: 40, y: 86 }, { id: 'cave', x: 70, y: 50 }, { id: 'peak', x: 94, y: 50 }];
export const tieEdges = [
  { id: 'path-1', from: 'camp', to: 'ridge', weight: 3 }, { id: 'path-2', from: 'camp', to: 'creek', weight: 4 }, { id: 'path-3', from: 'ridge', to: 'cave', weight: 4 },
  { id: 'path-4', from: 'creek', to: 'cave', weight: 3 }, { id: 'path-5', from: 'cave', to: 'peak', weight: 2 },
];
export const tie = seg('cheapest-tie', NETWORK, 'shortest-path', { nodes: tieNodes, edges: tieEdges, start: 'camp', goal: 'peak' }, tieNodes.map((node) => node.id));
export const tieKey = keyOf({ route: ['camp', 'creek', 'cave', 'peak'] }, { route: ['camp', 'ridge', 'cave', 'peak'] });

export const teamPicks = seg('team-picks', NETWORK, 'choice-tree', { items: ['ana', 'ben', 'cai', 'dev'], pick: 2, mode: 'group' }, ['ana', 'ben', 'cai', 'dev']);
export const teamPicksKey = keyOf({ keep: ['ana.ben', 'ana.cai', 'ana.dev', 'ben.cai', 'ben.dev', 'cai.dev'] });
export const podium = seg('podium', NETWORK, 'choice-tree', { items: ['ana', 'ben', 'cai'], pick: 3, mode: 'order', first: 'ana' }, ['ana', 'ben', 'cai']);
export const podiumKey = keyOf({ keep: ['ana.ben.cai', 'ana.cai.ben'] });

export const pascalEvens = seg('pascal-evens', NETWORK, 'pascal', { rows: 8, multiple: 2 });
export const pascalEvensKey = keyOf(pascalByRow(['r2c1', 'r4c1', 'r4c2', 'r4c3', 'r5c2', 'r5c3', 'r6c1', 'r6c3', 'r6c5']));
export const pascalThrees = seg('pascal-threes', NETWORK, 'pascal', { rows: 9, multiple: 3 });
export const pascalThreesKey = keyOf(pascalByRow(['r3c1', 'r3c2', 'r4c2', 'r6c1', 'r6c2', 'r6c4', 'r6c5', 'r7c2', 'r7c5']));

/* ── F2.17 trigonometry and calculus ── */

export const unitCos = seg('unit-circle-cos', TRIG, 'unit-circle', { ask: 'cos', level: 'root2', sign: -1, side: 'upper', step: 15, start: 0 });
export const unitCosKey = { predict: 'quadrant-2', value: 135 };
export const unitSin = seg('unit-circle-sin', TRIG, 'unit-circle', { ask: 'sin', level: 'root3', sign: -1, side: 'left', step: 30, start: 0 });
export const unitSinKey = { predict: 'quadrant-3', value: 240 };
export const wave = seg('circle-wave', TRIG, 'circle-wave', { fn: 'sin', level: 'half', sign: 1, slope: 'falling', step: 30, start: 0 });
export const waveKey = { predict: 'times-2', value: 150 };

export const secant = seg('secant-slope', CALCULUS, 'secant', { coeffs: [0, 1, -2, 0], a: 1 });
export const secantKey = { predict: 'negative', value: -3 };
export const linked = seg('linked-graphs', CALCULUS, 'derivative-link', { lead: 1, roots: [-1, 2], base: 0, ask: 'max' });
export const linkedKey = { predict: 'falling', value: -1 };
export const riemann = seg('riemann-sums', CALCULUS, 'riemann', { coeffs: [1, 0, 1, 0], from: 0, to: 3, method: 'left', tolerance: 2 });
export const riemannKey = { predict: 'too-small', value: 7 };
export const area = seg('area-so-far', CALCULUS, 'accumulation', { coeffs: [6, -1, 0, 0], from: 0, to: 8, target: 18 });
export const areaKey = { predict: 'flat', value: 6 };

/* ── F2.18 bits and gates ── */

export const bitsTen = seg('bits-ten', CIRCUITS, 'bits', { bits: 4, target: 10 });
export const bitsTenKey = keyOf({ 'bits-on': ['bit-8', 'bit-2'] });
export const bitsByte = seg('bits-byte', CIRCUITS, 'bits', { bits: 8, target: 200 });
export const bitsByteKey = keyOf({ 'bits-on': ['bit-128', 'bit-64', 'bit-8'] });

export const xorPayload = {
  inputs: ['in-a', 'in-b'],
  slots: [{ id: 'pos-1', from: ['in-a', 'in-b'] }, { id: 'pos-2', from: ['in-a', 'in-b'] }, { id: 'pos-3', from: ['pos-1', 'pos-2'] }],
  pieces: [{ id: 'gate-a', kind: 'or' }, { id: 'gate-b', kind: 'nand' }, { id: 'gate-c', kind: 'and' }, { id: 'gate-d', kind: 'nor' }],
  expected: [0, 1, 1, 0],
};
export const gatesXor = seg('gates-xor', CIRCUITS, 'gates', xorPayload, ['in-a', 'in-b', 'pos-3']);
export const gatesXorKey = keyOf({ 'pos-1': ['gate-a'], 'pos-2': ['gate-b'], 'pos-3': ['gate-c'] }, { 'pos-1': ['gate-b'], 'pos-2': ['gate-a'], 'pos-3': ['gate-c'] });

export const alarmPayload = {
  inputs: ['in-door', 'in-window', 'in-key'],
  slots: [{ id: 'pos-1', from: ['in-door', 'in-window'] }, { id: 'pos-2', from: ['in-key'] }, { id: 'pos-3', from: ['pos-1', 'pos-2'] }],
  pieces: [{ id: 'gate-a', kind: 'or' }, { id: 'gate-b', kind: 'not' }, { id: 'gate-c', kind: 'and' }, { id: 'gate-d', kind: 'xor' }],
  expected: [0, 0, 1, 0, 1, 0, 1, 0],
};
export const gatesAlarm = seg('gates-alarm', CIRCUITS, 'gates', alarmPayload, ['in-door', 'in-window', 'in-key', 'pos-3']);
export const gatesAlarmKey = keyOf({ 'pos-1': ['gate-a'], 'pos-2': ['gate-b'], 'pos-3': ['gate-c'] });

/** Every authored example: the segment, its key, the age band it is authored for. */
export const fixtures: Array<[Seg, unknown, string]> = [
  [konigsberg, konigsbergKey, '10-12'], [bridgeWalk, bridgeWalkKey, '10-12'], [cheapest, cheapestKey, '10-12'], [tie, tieKey, '10-12'],
  [teamPicks, teamPicksKey, '10-12'], [podium, podiumKey, '10-12'], [pascalEvens, pascalEvensKey, '10-12'], [pascalThrees, pascalThreesKey, '10-12'],
  [unitCos, unitCosKey, '13-17'], [unitSin, unitSinKey, '13-17'], [wave, waveKey, '13-17'],
  [secant, secantKey, '13-17'], [linked, linkedKey, '13-17'], [riemann, riemannKey, '13-17'], [area, areaKey, '13-17'],
  [bitsTen, bitsTenKey, '10-12'], [bitsByte, bitsByteKey, '10-12'], [gatesXor, gatesXorKey, '10-12'], [gatesAlarm, gatesAlarmKey, '10-12'],
];
