import type { HorizonteFixture, HorizonteLocale } from '../types.js';
import { areaCells } from './areaModel.js';
import type { Lattice } from './geometry.js';
import { imageOf, type TransformMove } from './transformModel.js';
import { floorFromCopies, type TileCopy, type TileMotion } from './tessellationModel.js';

const text = (en: string, es: string, pt: string): Record<HorizonteLocale, string> => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });
const at = (x: number, y: number): Lattice => ({ x, y });
const shape = (...corners: Array<[number, number]>): Lattice[] => corners.map(([x, y]) => at(x, y));
const untouched = { points: [] };
const outside = { points: [at(99, 99)] };

const area = (id: string, title: Record<HorizonteLocale, string>, band: '6-9' | '10-12', prompt: Record<HorizonteLocale, string>, columns: number, rows: number, outline: Lattice[]): HorizonteFixture => {
  const required = areaCells({ columns, rows, outline });
  return {
    id, title, ageBand: band, eligibility: band === '6-9' ? { minimum_age: 8, maximum_age: 9 } : { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({ id, type: 'math.area-squares.v2', grading: 'server', visual: { type: 'area-squares' }, prompt: prompt[locale], payload: { columns, rows, outline } }),
    rubric: { required },
    ladder: { invalid: outside, valid: untouched, met: { points: required } },
  };
};

const move = (
  id: string, title: Record<HorizonteLocale, string>, band: '6-9' | '10-12', prompt: Record<HorizonteLocale, string>,
  extent: number, figure: Lattice[], step: TransformMove, visual: 'transform-plane' | 'symmetry-mirror' = 'transform-plane',
): HorizonteFixture => {
  const image = imageOf(step, figure) ?? [];
  const eligibility = band === '6-9' ? { minimum_age: 8, maximum_age: 9 } : { minimum_age: 10, maximum_age: 12 };
  return {
    id, title, ageBand: band, eligibility,
    segment: (locale) => ({ id, type: 'math.transform.v2', grading: 'server', visual: { type: visual }, prompt: prompt[locale], payload: { extent, figure, move: step } }),
    rubric: { required: image },
    ladder: { invalid: outside, valid: { points: figure }, met: { points: image } },
  };
};

const slides = (...anchors: Lattice[]): TileCopy[] => anchors.map((anchor): TileCopy => ({ anchor, motion: 'slide' }));
const copy = (x: number, y: number, motion: TileMotion): TileCopy => ({ anchor: at(x, y), motion });

const tiling = (
  id: string, title: Record<HorizonteLocale, string>, band: '6-9' | '10-12', prompt: Record<HorizonteLocale, string>,
  tile: Lattice[], copies: TileCopy[], overlapping: Lattice[], moves?: TileMotion[],
): HorizonteFixture => {
  const eligibility = band === '6-9' ? { minimum_age: 8, maximum_age: 9 } : { minimum_age: 10, maximum_age: 12 };
  const floor = floorFromCopies(tile, copies);
  const anchors = copies.map((entry) => entry.anchor);
  const met = moves ? { points: anchors, motions: copies.map((entry) => entry.motion) } : { points: anchors };
  return {
    id, title, ageBand: band, eligibility,
    segment: (locale) => ({ id, type: 'math.tessellation.v2', grading: 'server', visual: { type: 'tessellation' }, prompt: prompt[locale], payload: moves ? { floor, tile, moves } : { floor, tile } }),
    rubric: { copies: copies.length },
    ladder: { invalid: { points: overlapping }, valid: untouched, met },
  };
};

export const GEOM2_FIXTURES: readonly HorizonteFixture[] = [
  {
    id: 'geoboard-area-six',
    title: text('Area of six', 'Área de seis', 'Área de seis'),
    ageBand: '6-9',
    eligibility: { minimum_age: 8, maximum_age: 9 },
    segment: (locale) => ({
      id: 'geoboard-area-six', type: 'math.geoboard.v2', grading: 'server', visual: { type: 'geoboard' },
      prompt: text(
        'Stretch the band to make a shape that covers 6 squares.',
        'Estira la liga para formar una figura que cubra 6 cuadritos.',
        'Estique o elástico para formar uma figura que cubra 6 quadradinhos.',
      )[locale],
      payload: { size: 5 },
    }),
    rubric: { area2: 12 },
    ladder: { invalid: { points: shape([0, 0], [1, 0]) }, valid: untouched, met: { points: shape([0, 0], [3, 0], [3, 2], [0, 2]) } },
  },
  {
    id: 'geoboard-right-triangle',
    title: text('A right triangle', 'Un triángulo rectángulo', 'Um triângulo retângulo'),
    ageBand: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 },
    segment: (locale) => ({
      id: 'geoboard-right-triangle', type: 'math.geoboard.v2', grading: 'server', visual: { type: 'geoboard' },
      prompt: text(
        'Make a right triangle that covers 4 squares.',
        'Forma un triángulo rectángulo que cubra 4 cuadritos.',
        'Forme um triângulo retângulo que cubra 4 quadradinhos.',
      )[locale],
      payload: { size: 5 },
    }),
    rubric: { area2: 8, shape: 'right-triangle' },
    ladder: { invalid: { points: shape([0, 0], [2, 2], [2, 0], [0, 2]) }, valid: untouched, met: { points: shape([0, 0], [4, 0], [0, 2]) } },
  },
  area(
    'area-l-shape', text('Squares in an L', 'Cuadritos en una L', 'Quadradinhos em um L'), '6-9',
    text('Shade every square inside the outline.', 'Sombrea todos los cuadritos dentro del contorno.', 'Pinte todos os quadradinhos dentro do contorno.'),
    5, 4, shape([0, 0], [4, 0], [4, 2], [2, 2], [2, 3], [0, 3]),
  ),
  area(
    'area-staircase', text('Squares in a staircase', 'Cuadritos en una escalera', 'Quadradinhos em uma escada'), '10-12',
    text('Shade the squares inside the staircase to find its area.', 'Sombrea los cuadritos dentro de la escalera para hallar su área.', 'Pinte os quadradinhos dentro da escada para achar a área.'),
    6, 4, shape([0, 0], [5, 0], [5, 1], [4, 1], [4, 2], [3, 2], [3, 3], [0, 3]),
  ),
  move(
    'reflect-triangle', text('Reflect a triangle', 'Refleja un triángulo', 'Reflita um triângulo'), '6-9',
    text('Reflect the triangle across the line. Move each corner to its image.', 'Refleja el triángulo sobre la recta. Mueve cada vértice a su imagen.', 'Reflita o triângulo sobre a reta. Mova cada vértice para a sua imagem.'),
    5, shape([1, 1], [3, 1], [1, 4]), { kind: 'reflect', across: 'vertical', at: 0 },
  ),
  move(
    'translate-parallelogram', text('Slide a shape', 'Desliza una figura', 'Deslize uma figura'), '6-9',
    text('Slide the shape 5 to the right and 3 up.', 'Desliza la figura 5 a la derecha y 3 hacia arriba.', 'Deslize a figura 5 para a direita e 3 para cima.'),
    6, shape([-4, -2], [-1, -2], [0, 0], [-3, 0]), { kind: 'translate', dx: 5, dy: 3 },
  ),
  move(
    'rotate-quarter', text('Quarter turn', 'Cuarto de vuelta', 'Quarto de volta'), '10-12',
    text('Turn the triangle a quarter turn counterclockwise about the origin.', 'Gira el triángulo un cuarto de vuelta en sentido contrario a las manecillas del reloj alrededor del origen.', 'Gire o triângulo um quarto de volta no sentido anti-horário em torno da origem.'),
    6, shape([1, 1], [4, 1], [1, 3]), { kind: 'rotate', degrees: 90, about: at(0, 0) },
  ),
  move(
    'mirror-half', text('Draw the other half', 'Dibuja la otra mitad', 'Desenhe a outra metade'), '10-12',
    text('Draw the other half so the shape is symmetric about the mirror line.', 'Dibuja la otra mitad para que la figura sea simétrica respecto a la línea del espejo.', 'Desenhe a outra metade para que a figura fique simétrica em relação à linha do espelho.'),
    5, shape([0, -2], [-3, -1], [-2, 2], [0, 3]), { kind: 'reflect', across: 'vertical', at: 0 }, 'symmetry-mirror',
  ),
  move(
    'dilate-center', text('Enlarge a triangle', 'Amplía un triángulo', 'Amplie um triângulo'), '10-12',
    text('Enlarge the triangle by a scale factor of 2 from the center of dilation.', 'Amplía el triángulo con razón 2 desde el centro de la homotecia.', 'Amplie o triângulo com razão 2 a partir do centro da homotetia.'),
    6, shape([2, 1], [3, 1], [2, 3]), { kind: 'dilate', num: 2, den: 1, about: at(1, 1) },
  ),
  tiling(
    'tile-domino', text('Cover with dominoes', 'Cubre con dominós', 'Cubra com dominós'), '6-9',
    text('Cover the floor with the tile. Slide it, never turn it.', 'Cubre el piso con la baldosa. Deslízala, no la gires.', 'Cubra o piso com o ladrilho. Deslize-o, sem girar.'),
    shape([0, 0], [1, 0]), slides(at(0, 0), at(2, 0), at(0, 1), at(2, 1), at(0, 2), at(2, 2)), shape([0, 0], [1, 0]),
  ),
  tiling(
    'tile-l', text('Cover with L tiles', 'Cubre con baldosas en L', 'Cubra com ladrilhos em L'), '10-12',
    text('Cover the floor with the L-shaped tile, with no gaps and no overlaps.', 'Cubre el piso con la baldosa en forma de L, sin huecos ni encimados.', 'Cubra o piso com o ladrilho em forma de L, sem lacunas nem sobreposições.'),
    shape([0, 0], [0, 1], [0, 2], [1, 0]), slides(at(0, 0), at(1, 1), at(2, 2), at(3, 3)), shape([0, 0], [0, 1]),
  ),
  tiling(
    'tile-bump', text('Fit the bump', 'Encaja el saliente', 'Encaixe a saliência'), '10-12',
    text('Fit the bumped tile into the notches until the floor is covered.', 'Encaja la baldosa con saliente en las hendiduras hasta cubrir el piso.', 'Encaixe o ladrilho com saliência nos recortes até cobrir o piso.'),
    shape([0, 0], [1, 0], [2, 0], [1, 1]), slides(at(0, 0), at(4, 0), at(2, 1), at(6, 1)), shape([0, 0], [1, 0]),
  ),
  tiling(
    'tile-turn', text('Turn to fit', 'Gira para encajar', 'Gire para encaixar'), '10-12',
    text('Cover the floor. You may turn the tile half a turn.', 'Cubre el piso. Puedes girar la baldosa media vuelta.', 'Cubra o piso. Você pode girar o ladrilho meia volta.'),
    shape([0, 0], [1, 0], [0, 1]), [copy(0, 0, 'slide'), copy(0, 1, 'turn'), copy(2, 0, 'slide'), copy(2, 1, 'turn')], shape([0, 0], [0, 0]), ['slide', 'turn'],
  ),
  tiling(
    'tile-flip', text('Flip to fit', 'Voltea para encajar', 'Vire para encaixar'), '10-12',
    text('Cover the floor. You may flip the tile over.', 'Cubre el piso. Puedes voltear la baldosa.', 'Cubra o piso. Você pode virar o ladrilho.'),
    shape([1, 0], [2, 0], [0, 1], [1, 1]), [copy(0, 0, 'slide'), copy(2, 0, 'slide'), copy(5, 0, 'flip')], shape([0, 0], [1, 0]), ['slide', 'flip'],
  ),
];
