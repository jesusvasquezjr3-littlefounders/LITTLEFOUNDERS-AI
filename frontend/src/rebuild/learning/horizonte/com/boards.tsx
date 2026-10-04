import { lazy } from 'react';
import type { HorizonteBoards } from '../boardTypes';

export const COM_BOARDS: HorizonteBoards = {
  'math.network-count.v2': { board: lazy(() => import('./NetworkBoard')), icap: 'constructive', chunkBudgetKb: 20 },
  'trig.unit-circle.v2': { board: lazy(() => import('./TrigBoard')), icap: 'constructive', chunkBudgetKb: 16 },
  'calculus.explorer.v2': { board: lazy(() => import('./CalculusBoard')), icap: 'constructive', chunkBudgetKb: 18 },
  'computing.bits-gates.v2': { board: lazy(() => import('./CircuitsBoard')), icap: 'constructive', chunkBudgetKb: 16 },
};
