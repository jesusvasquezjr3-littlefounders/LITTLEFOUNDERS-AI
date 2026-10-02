import type { Locale } from '../../../design/copyBudget';
import { copyText } from '../copyText';
import { fill, money, spokenMoney } from '../fin1/format';
import { PITCH_NAMES, type SolidView } from '../solids/projection.generated';
import { SPACE1_COPY } from './copy';
import type { CoinPiece, ReferenceId } from './coins.generated';
import type { CountName, PlatonicId, SectionShape } from './polyhedra.generated';
import type { StallId } from './stall.generated';
import { TARGET_IDS, type Cell, type RotationAxis, type TargetId } from './voxels.generated';

export type Space1Text = { readonly [K in keyof typeof SPACE1_COPY]: string };

export const space1Text = (locale: Locale): Space1Text => copyText(SPACE1_COPY, locale);

export { fill, money, spokenMoney };

const number = (locale: Locale, maximum: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: maximum });

/** A length in millimetres as it is written: "8 mm", "0.7 mm", "1.2 m". Metric symbols are the same in every locale. */
export function lengthText(mm: number, locale: Locale): string {
  return mm >= 1000 ? `${number(locale, 2).format(mm / 1000)} m` : `${number(locale, 1).format(mm)} mm`;
}

const UNITS = {
  'en-US': { mm: ['millimeter', 'millimeters'], m: ['meter', 'meters'] },
  'es-MX': { mm: ['milímetro', 'milímetros'], m: ['metro', 'metros'] },
  'pt-BR': { mm: ['milímetro', 'milímetros'], m: ['metro', 'metros'] },
} as const;

/** The same length as it is read aloud, for aria labels. */
export function spokenLength(mm: number, locale: Locale): string {
  const [unit, value] = mm >= 1000 ? ['m', mm / 1000] as const : ['mm', mm] as const;
  const forms = UNITS[locale][unit];
  return `${number(locale, unit === 'm' ? 2 : 1).format(value)} ${value === 1 ? forms[0] : forms[1]}`;
}

const SOLID_KEYS = {
  tetrahedron: 'solidTetrahedron', cube: 'solidCube', octahedron: 'solidOctahedron', dodecahedron: 'solidDodecahedron', icosahedron: 'solidIcosahedron',
} as const;
export const solidName = (t: Space1Text, solid: PlatonicId): string => t[SOLID_KEYS[solid]];

const SHAPE_KEYS = {
  triangle: 'shapeTriangle', square: 'shapeSquare', rectangle: 'shapeRectangle', rhombus: 'shapeRhombus', parallelogram: 'shapeParallelogram',
  trapezoid: 'shapeTrapezoid', quadrilateral: 'shapeQuadrilateral', pentagon: 'shapePentagon', hexagon: 'shapeHexagon', polygon: 'shapePolygon',
} as const;
export const shapeName = (t: Space1Text, shape: SectionShape): string => t[SHAPE_KEYS[shape]];

const ITEM_KEYS = {
  apple: 'itemApple', bread: 'itemBread', juice: 'itemJuice', toy: 'itemToy', book: 'itemBook',
  pen: 'itemPen', cap: 'itemCap', kite: 'itemKite', shell: 'itemShell', stamp: 'itemStamp',
} as const;
export const itemName = (t: Space1Text, item: StallId): string => t[ITEM_KEYS[item]];

const COUNT_KEYS = { vertices: 'countVertices', edges: 'countEdges', faces: 'countFaces' } as const;
export const countName = (t: Space1Text, name: CountName): string => t[COUNT_KEYS[name]];
const ASK_KEYS = { vertices: 'askVertices', edges: 'askEdges', faces: 'askFaces' } as const;
export const askName = (t: Space1Text, name: CountName): string => t[ASK_KEYS[name]];

const REF_KEYS = { phone: 'refPhone', book: 'refBook', desk: 'refDesk', door: 'refDoor' } as const;
export const referenceName = (t: Space1Text, id: ReferenceId): string => t[REF_KEYS[id]];

export const pieceName = (t: Space1Text, piece: CoinPiece): string => (piece === 'coin' ? t.pieceCoin : t.pieceBill);
export const piecesName = (t: Space1Text, piece: CoinPiece): string => (piece === 'coin' ? t.piecesCoin : t.piecesBill);

const AXIS_KEYS = { up: 'rotAxisUp', side: 'rotAxisSide', depth: 'rotAxisDepth' } as const;
export const axisNote = (t: Space1Text, axis: RotationAxis): string => t[AXIS_KEYS[axis]];

export const targetLetter = (id: TargetId): string => id.toUpperCase();
export const targetId = (index: number): TargetId => TARGET_IDS[index]!;

/** The cells of a figure as "(x, y, z)" places, in reading order, for the table. */
export const cellsText = (cells: readonly Cell[]): string => [...cells]
  .sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0])
  .map((cell) => `(${cell[0]}, ${cell[1]}, ${cell[2]})`).join('; ');

const PITCH_KEYS = { level: 'viewLevel', corner: 'viewCorner', top: 'viewTop' } as const;
export const viewLabel = (t: Space1Text, view: SolidView): string => t[PITCH_KEYS[PITCH_NAMES[view.pitch]]];

/** "Corner view. Turn 2 of 4": what a screen reader hears after every move. */
export const viewState = (t: Space1Text, view: SolidView): string => `${viewLabel(t, view)}. ${fill(t.viewTurn, { n: view.yaw + 1 })}`;
