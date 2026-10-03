import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const NUM_A_BOARDS: HorizonteBoards = {
  'math.rekenrek.v2': { board: lazy(() => import('./RekenrekBoard')), icap: 'active', chunkBudgetKb: 24 },
  'math.abacus.v2': { board: lazy(() => import('./AbacusBoard')), icap: 'active', chunkBudgetKb: 24 },
  'math.number-line.empty.v2': { board: lazy(() => import('./EmptyLineBoard')), icap: 'active', chunkBudgetKb: 24 },
  'math.number-line.zoom.v2': { board: lazy(() => import('./ZoomLineBoard')), icap: 'active', chunkBudgetKb: 24 },
  'math.clock.v2': { board: lazy(() => import('./ClockBoard')), icap: 'active', chunkBudgetKb: 24 },
  'math.ruler.v2': { board: lazy(() => import('./RulerBoard')), icap: 'active', chunkBudgetKb: 24 },
  'math.pan-balance.v2': { board: lazy(() => import('./PanBalanceBoard')), icap: 'active', chunkBudgetKb: 24 },
  'math.number-line.order.v2': { board: lazy(() => import('./OrderLineBoard')), icap: 'active', chunkBudgetKb: 24 },
  'math.ruler.measure.v2': { board: lazy(() => import('./RulerMeasureBoard')), icap: 'active', chunkBudgetKb: 24 },
};
