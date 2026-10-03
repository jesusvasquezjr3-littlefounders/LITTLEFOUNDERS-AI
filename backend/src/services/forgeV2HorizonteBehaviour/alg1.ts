import { classSpace, type ClassBoard, type ClassPiece, type ClassState } from './classBoards.js';
import type { HzBuilder } from './shared.js';

const TILE_CLASSES = ['sq-pos', 'sq-neg', 'bar-pos', 'bar-neg', 'unit-pos', 'unit-neg'];

const tiles: HzBuilder = (p, r) => {
  const counts = p.counts as Record<string, number>;
  const pieces: ClassPiece[] = TILE_CLASSES.flatMap((cls) => Array.from({ length: counts[cls]! }, (_, index) => ({ id: `${cls}-${index + 1}`, cls, home: 'mat' })));
  const balanced = (state: ClassState) => ['sq', 'bar', 'unit'].every((kind) => (state.zero ?? []).filter((cls) => cls === `${kind}-pos`).length === (state.zero ?? []).filter((cls) => cls === `${kind}-neg`).length);
  return classSpace({ pieces, slots: ['mat', 'zero'], compare: ['mat', 'zero'], consistent: balanced, keys: r.solutions });
};

const value = (face: string): [number, number] => {
  if (face === 'unk') return [1, 0];
  if (face === 'unk-neg') return [-1, 0];
  const [sign, amount] = face.split('-') as [string, string];
  return [0, (sign === 'pos' ? 1 : -1) * Number(amount)];
};
const total = (faces: string[] = []): [number, number] => faces.reduce<[number, number]>(([u, c], face) => { const [du, dc] = value(face); return [u + du, c + dc]; }, [0, 0]);

const cards: HzBuilder = (p, r) => {
  const pieces: ClassPiece[] = [
    ...(p.left as string[]).map((cls, index) => ({ id: `left-${index + 1}`, cls, home: 'left' })),
    ...(p.right as string[]).map((cls, index) => ({ id: `right-${index + 1}`, cls, home: 'right' })),
    ...(p.supply as string[]).flatMap((cls, index) => [{ id: `supply-${index + 1}-a`, cls, home: 'tray' }, { id: `supply-${index + 1}-b`, cls, home: 'tray' }]),
  ];
  const [startUnknown, startConstant] = total(p.left);
  const [rightUnknown, rightConstant] = total(p.right);
  const consistent = (state: ClassState) => {
    const [lu, lc] = total(state.left); const [ru, rc] = total(state.right); const [bu, bc] = total(state.bin);
    return lu - ru === startUnknown - rightUnknown && lc - rc === startConstant - rightConstant && bu === 0 && bc === 0;
  };
  return classSpace({ pieces, slots: ['left', 'right', 'bin', 'tray'], compare: ['left', 'right'], consistent, keys: r.solutions });
};

const area: HzBuilder = (p, r) => {
  if (p.fill !== 'cells' && p.fill !== 'edges' && p.fill !== 'square') return null;
  const slots = p.fill === 'square' ? ['tray', 'corner', 'constant'] : p.fill === 'edges' ? ['tray', 'row-0', 'row-1', 'col-0', 'col-1']
    : ['tray', ...(p.rows as string[]).flatMap((_, row) => (p.cols as string[]).map((__, col) => `cell-${row}-${col}`))];
  const pieces: ClassPiece[] = (p.pool as string[]).map((cls, index) => ({ id: `piece-${index + 1}`, cls, home: 'tray' }));
  const board: ClassBoard = { pieces, slots, compare: slots.slice(1), consistent: (state) => slots.slice(1).every((slot) => (state[slot] ?? []).length <= 1), keys: r.solutions };
  return classSpace(board);
};

export const ALG1_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'math.algebra-tiles.v2': tiles,
  'math.algebra-cards.v2': cards,
  'math.area-model.v2': area,
};
