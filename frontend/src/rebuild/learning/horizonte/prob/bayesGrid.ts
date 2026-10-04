/*
 * Drawing plan of the natural-frequencies grid. It only decides how the people are laid out and how often a cell line is
 * drawn; the counts, the chance and the verdict come from the pure model and never read this file.
 */

export const GRID_VIEW_W = 640;
export const GRID_PAD = 28;
/** The closest two cell lines may sit, in drawing units: 12 of 640 stays readable on a phone. */
export const GRID_MIN_LINE = 12;

export interface GridPlan {
  columns: number;
  rows: number;
  /** One person, in drawing units. */
  cell: number;
  /** People per side of a drawn square: 1 draws a line around every person, 3 around every 3 by 3. */
  step: number;
  /** Side of a drawn square, in drawing units (`step * cell`). */
  tile: number;
  /** People inside one drawn square. */
  perSquare: number;
  height: number;
  /** Stroke of the outline round the asked people: heavy, but never wider than a person is wide. */
  heavy: number;
}

export function planGrid(population: number): GridPlan {
  const columns = Math.ceil(Math.sqrt(population * 2));
  const rows = Math.ceil(population / columns);
  const cell = (GRID_VIEW_W - 2 * GRID_PAD) / columns;
  const step = Math.max(1, Math.ceil(GRID_MIN_LINE / cell));
  return { columns, rows, cell, step, tile: step * cell, perSquare: step * step, height: rows * cell + 2 * GRID_PAD, heavy: Math.min(5, Math.max(1.5, cell * 0.6)) };
}
