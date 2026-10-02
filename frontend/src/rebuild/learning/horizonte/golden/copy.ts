import type { HorizonteCopy } from '../boardTypes';

export const GOLDEN_COPY = {
  frame: { role: 'data', 'en-US': 'Frame {n}', 'es-MX': 'Cuadro {n}', 'pt-BR': 'Quadro {n}' },
  cell: { role: 'data', 'en-US': 'Cell {n}', 'es-MX': 'Celda {n}', 'pt-BR': 'Célula {n}' },
  filled: { role: 'data', 'en-US': 'filled', 'es-MX': 'llena', 'pt-BR': 'cheia' },
  empty: { role: 'data', 'en-US': 'empty', 'es-MX': 'vacía', 'pt-BR': 'vazia' },
  total: { role: 'data', 'en-US': 'Total', 'es-MX': 'Total', 'pt-BR': 'Total' },
  emptyCells: { role: 'data', 'en-US': 'Empty cells', 'es-MX': 'Celdas vacías', 'pt-BR': 'Células vazias' },
  tray: { role: 'heading', 'en-US': 'Counters', 'es-MX': 'Fichas', 'pt-BR': 'Fichas' },
  addCounter: { role: 'option', 'en-US': 'Add a counter', 'es-MX': 'Agrega una ficha', 'pt-BR': 'Adicione uma ficha' },
  moveFrom: { role: 'option', 'en-US': 'Move one from frame {n}', 'es-MX': 'Mueve una del cuadro {n}', 'pt-BR': 'Mova uma do quadro {n}' },
  showTable: { role: 'action', 'en-US': 'Show as table', 'es-MX': 'Mostrar como tabla', 'pt-BR': 'Mostrar como tabela' },
  hideTable: { role: 'action', 'en-US': 'Hide table', 'es-MX': 'Ocultar tabla', 'pt-BR': 'Ocultar tabela' },
  tableCaption: { role: 'heading', 'en-US': 'Counters in each frame', 'es-MX': 'Fichas en cada cuadro', 'pt-BR': 'Fichas em cada quadro' },
  colFrame: { role: 'data', 'en-US': 'Frame', 'es-MX': 'Cuadro', 'pt-BR': 'Quadro' },
  colFilled: { role: 'data', 'en-US': 'Filled', 'es-MX': 'Llenas', 'pt-BR': 'Cheias' },
  colEmpty: { role: 'data', 'en-US': 'Empty', 'es-MX': 'Vacías', 'pt-BR': 'Vazias' },
  metSingle: { role: 'body', 'en-US': 'You filled the frame to the goal.', 'es-MX': 'Llenaste el cuadro hasta la meta.', 'pt-BR': 'Você encheu o quadro até a meta.' },
  hintSingle: { role: 'body', 'en-US': 'Not yet. Count the empty cells.', 'es-MX': 'Aún no. Cuenta las celdas vacías.', 'pt-BR': 'Ainda não. Conte as células vazias.' },
  metDouble: { role: 'body', 'en-US': 'You moved counters and kept the total.', 'es-MX': 'Moviste fichas y el total no cambió.', 'pt-BR': 'Você moveu fichas e o total não mudou.' },
  hintDouble: { role: 'body', 'en-US': 'Not yet. Count the counters in each frame.', 'es-MX': 'Aún no. Cuenta las fichas de cada cuadro.', 'pt-BR': 'Ainda não. Conte as fichas de cada quadro.' },
} as const satisfies HorizonteCopy;
